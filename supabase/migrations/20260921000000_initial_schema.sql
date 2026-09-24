-- Koya Lead Agent — initial schema
-- Run with: supabase db push  (or apply via SQL editor in order)

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: keep updated_at fresh
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles — mirrors auth.users; role is RBAC
-- ─────────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text,
  role text not null default 'researcher'
    check (role in ('admin', 'researcher', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);

-- Auto-create a profile on signup. Default role is the safe, non-admin
-- `researcher`. Users are NEVER auto-promoted to admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'researcher'
  )
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- research_runs
-- ─────────────────────────────────────────────────────────────────────────────
create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_objective text not null,
  refined_icp jsonb,
  icp_overrides jsonb not null default '{}'::jsonb,
  desired_lead_count int not null default 10,
  status text not null default 'draft' check (
    status in (
      'draft', 'refining', 'awaiting_confirmation', 'queued',
      'discovering', 'researching', 'qualifying', 'drafting',
      'quality_check', 'completed', 'failed', 'cancelled', 'needs_review'
    )
  ),
  tool_limits jsonb not null default '{}'::jsonb,
  candidate_count int not null default 0,
  qualified_count int not null default 0,
  needs_review_count int not null default 0,
  not_qualified_count int not null default 0,
  error_message text,
  quality_report jsonb,
  pending_candidates jsonb not null default '[]'::jsonb,
  agent_metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index research_runs_user_id_idx on public.research_runs(user_id, created_at desc);
create index research_runs_status_idx on public.research_runs(status);

create trigger research_runs_updated_at
  before update on public.research_runs
  for each row execute procedure public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- leads
-- ─────────────────────────────────────────────────────────────────────────────
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.research_runs(id) on delete cascade,
  company_name text not null,
  domain text not null,
  qualification_status text not null check (
    qualification_status in ('qualified', 'not_qualified', 'needs_review')
  ),
  confidence numeric(4, 3) check (confidence >= 0 and confidence <= 1),
  fit_reasons jsonb not null default '[]'::jsonb,
  concerns jsonb not null default '[]'::jsonb,
  source_urls jsonb not null default '[]'::jsonb,
  source_summary text,
  discovery_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Duplicate protection: one company per research run.
  unique (run_id, domain)
);

create index leads_run_id_idx on public.leads(run_id);
create index leads_status_idx on public.leads(qualification_status);
create index leads_domain_idx on public.leads(domain);

create trigger leads_updated_at
  before update on public.leads
  for each row execute procedure public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- outreach_drafts — 3-step sequence per lead, human review required
-- ─────────────────────────────────────────────────────────────────────────────
create table public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  sequence_step int not null check (sequence_step in (1, 2, 3)),
  subject text not null default '',
  body text not null default '',
  personalization_note text not null default '',
  linkedin_message text,
  review_status text not null default 'draft' check (
    review_status in ('draft', 'reviewed', 'approved', 'rejected')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, sequence_step)
);

create index outreach_drafts_lead_id_idx on public.outreach_drafts(lead_id);

create trigger outreach_drafts_updated_at
  before update on public.outreach_drafts
  for each row execute procedure public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- tool_calls — one row per agent tool invocation (grading evidence)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.tool_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.research_runs(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  tool_name text not null,
  purpose text not null default '',
  input_summary text not null default '',
  result_summary text not null default '',
  status text not null default 'pending' check (
    status in ('pending', 'success', 'error', 'cancelled', 'skipped')
  ),
  error_message text,
  duration_ms int,
  created_at timestamptz not null default now()
);

create index tool_calls_run_id_idx on public.tool_calls(run_id, created_at desc);
create index tool_calls_lead_id_idx on public.tool_calls(lead_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- run_events — human-readable activity timeline
-- ─────────────────────────────────────────────────────────────────────────────
create table public.run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.research_runs(id) on delete cascade,
  event_type text not null,
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index run_events_run_id_idx on public.run_events(run_id, created_at desc);