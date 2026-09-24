# Supabase setup

## Apply the schema

Two migrations, in order:

```
supabase/migrations/20260921000000_initial_schema.sql
supabase/migrations/20260921000001_rls_policies.sql
```

Use the Supabase CLI (`supabase db push`) or paste each file into the SQL editor.
Then:

```bash
npm run migrate:check    # verifies tables/columns/RLS are present
```

## Tables

| Table | Purpose |
| --- | --- |
| `profiles` | Mirrors `auth.users`; holds `role` (`admin` / `researcher` / `viewer`). Created by an `on_auth_user_created` trigger with the safe default `researcher` — users are never auto-promoted. |
| `research_runs` | Objective, `refined_icp`, `icp_overrides`, `tool_limits`, `desired_lead_count`, `status`, counts, `pending_candidates`, `quality_report`, `agent_metadata`, timestamps. |
| `leads` | one row per company: `company_name`, `domain`, `qualification_status`, `confidence`, `fit_reasons`, `concerns`, `source_urls`, `source_summary`, `discovery_data`. `unique(run_id, domain)` prevents duplicates. |
| `outreach_drafts` | 3 steps per lead (`sequence_step` 1–3), `subject`, `body`, `personalization_note`, `linkedin_message`, `review_status` (`draft`/`reviewed`/`approved`/`rejected`). `unique(lead_id, sequence_step)`. |
| `tool_calls` | one row per tool invocation: `tool_name`, `purpose`, `input_summary`, `result_summary`, `status`, `error_message`, `duration_ms`. This is the tool-call evidence trail. |
| `run_events` | human-readable activity timeline. |

See `docs/architecture.md` for the status machine and
`server/agent/tools.ts` for the tool-to-record mapping.

## Row Level Security

RLS is the real authorization boundary; API routes use a **cookie-bound** client
(`server/user-db.ts`) so Postgres enforces access, while the agent worker uses
the **service-role** key (`server/db.ts`) and is never exposed to the browser.

Key policies (`..._rls_policies.sql`):

- `profiles`: a user can read their own row or (if admin) all rows. Self-update
  may change `full_name` but the `with check` clause forbids changing `role`
  (no self-promotion). Admins may update any profile.
- `research_runs`: select/update where `user_id = auth.uid()` or admin; insert
  must set `user_id = auth.uid()`.
- `leads`, `tool_calls`, `run_events`: readable by the run owner or an admin.
- `outreach_drafts`: read/update by the run owner or admin.

Grants are deliberately narrow:

- `authenticated` gets `select` on `leads`, `tool_calls`, `run_events`, and
  `select, update` on `outreach_drafts`. There is **no** authenticated `insert`
  grant on those tables — only the service role writes agent output.
- `anon` is revoked from all application tables.

RBAC (viewer/researcher/admin) is layered on top of RLS in the API routes:
mutating endpoints call `requireRole("researcher")` and admin routes call
`requireRole("admin")`.

## Data you should see after a run

For grading, a completed run should show:

- one `research_runs` row with `refined_icp`, `tool_limits`, `status` and
  `quality_report`
- `leads` rows with status, confidence, fit reasons, concerns, source URLs and
  source summary
- `tool_calls` rows proving Apify discovery and Firecrawl/fallback scraping ran,
  with the enforced caps visible in `input_summary`/`result_summary`
- `outreach_drafts` rows (3 per qualified lead) with `review_status`
