-- Koya Lead Agent — Row Level Security policies
-- Run after the initial schema.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper functions (SECURITY DEFINER, stable)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_run_owner(run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.research_runs
    where id = run_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_run_owner_or_admin(run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_run_owner(run_id);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────────────────
-- authenticated users can manage their own profile (full_name, and role only
-- under the admin_update policy).
grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, role) on public.profiles to authenticated;

-- Runs: authenticated users read/create/update (scoped by policies below).
grant select, insert, update on public.research_runs to authenticated;

-- All other application tables are READ via RLS for authenticated users; the
-- agent worker inserts/updates with the service role only.
grant select on public.leads to authenticated;
grant select, update on public.outreach_drafts to authenticated;
grant update on public.leads to authenticated;
grant select on public.tool_calls to authenticated;
grant select on public.run_events to authenticated;

-- service_role gets full access (default in Supabase); anon stays locked out.
revoke all on public.leads from anon;
revoke all on public.outreach_drafts from anon;
revoke all on public.tool_calls from anon;
revoke all on public.run_events from anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- Self-update may change full_name but must keep role unchanged (no self
-- promotion). Admins may change any field of any profile.
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid() and
    (select role from public.profiles where id = auth.uid()) = role
  );

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- research_runs
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.research_runs enable row level security;

drop policy if exists "research_runs_select" on public.research_runs;
create policy "research_runs_select"
  on public.research_runs for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "research_runs_insert" on public.research_runs;
create policy "research_runs_insert"
  on public.research_runs for insert
  with check (user_id = auth.uid());

drop policy if exists "research_runs_update" on public.research_runs;
create policy "research_runs_update"
  on public.research_runs for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- leads (owner-of-run or admin can read; owner researcher or admin can update)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.leads enable row level security;

drop policy if exists "leads_select" on public.leads;
create policy "leads_select"
  on public.leads for select
  using (public.is_run_owner_or_admin(run_id));

drop policy if exists "leads_update" on public.leads;
create policy "leads_update"
  on public.leads for update
  using (public.is_run_owner_or_admin(run_id))
  with check (public.is_run_owner_or_admin(run_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- outreach_drafts
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.outreach_drafts enable row level security;

drop policy if exists "outreach_select" on public.outreach_drafts;
create policy "outreach_select"
  on public.outreach_drafts for select
  using (public.is_run_owner_or_admin((
    select run_id from public.leads where id = lead_id
  )));

drop policy if exists "outreach_update" on public.outreach_drafts;
create policy "outreach_update"
  on public.outreach_drafts for update
  using (public.is_run_owner_or_admin((
    select run_id from public.leads where id = lead_id
  )))
  with check (public.is_run_owner_or_admin((
    select run_id from public.leads where id = lead_id
  )));

-- ─────────────────────────────────────────────────────────────────────────────
-- tool_calls / run_events (read via RLS; written by service role only)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.tool_calls enable row level security;

drop policy if exists "tool_calls_select" on public.tool_calls;
create policy "tool_calls_select"
  on public.tool_calls for select
  using (public.is_run_owner_or_admin(run_id));

alter table public.run_events enable row level security;

drop policy if exists "run_events_select" on public.run_events;
create policy "run_events_select"
  on public.run_events for select
  using (public.is_run_owner_or_admin(run_id));