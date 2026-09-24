# Setup

## Prerequisites

- Node.js 20+ (built and tested on Node 24)
- A Supabase project (Postgres + Auth)
- An Anthropic API key (Claude Agent SDK)
- An Apify account — use the **Koya team** account's API token
- (Optional but recommended) A Firecrawl API key

## 1. Install

```bash
npm install
```

## 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`. Minimum to run the app UI and auth:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Add these to actually run the agent end to end:

```
ANTHROPIC_API_KEY=
APIFY_API_TOKEN=          # Koya TEAM token, not personal
APIFY_ACTOR_ID=           # a pay-per-event search actor (see docs/apify-setup.md)
FIRECRAWL_API_KEY=        # optional — a bounded fetch fallback is used without it
```

See `.env.example` for limits and optional actor-adapter knobs. **Never commit
`.env.local`.**

> Without `ANTHROPIC_API_KEY`, Phase A uses a clearly-labelled deterministic ICP
> fallback and Phase B refuses to run. No leads are ever fabricated.

## 3. Create the database schema

Run the SQL migrations in `supabase/migrations/` in order, either via the
Supabase SQL editor or the Supabase CLI:

```bash
supabase db push        # if you use the Supabase CLI
```

- `20260921000000_initial_schema.sql` — tables, enums, triggers, indexes
- `20260921000001_rls_policies.sql` — Row Level Security + grants

Verify the schema is present:

```bash
npm run migrate:check
```

See `docs/supabase-setup.md` for details.

## 4. Create the first admin

Sign up once in the running app, then promote that user to `admin`:

```bash
npm run create-admin -- you@example.com
```

(The `scripts/create-admin.ts` script uses the service-role key.)

### Optional: demo accounts

The login page shows one-click **demo account** buttons (admin / researcher /
viewer) that fill the credentials for the instructor. Create them with:

```bash
npm run seed:demo
```

This is idempotent — it creates or resets the three `*.@koya.demo` users and
their roles. Demo credentials are public by design (see `lib/demo-users.ts`);
they only access demo data.

## 5. Run

```bash
npm run dev            # development (http://localhost:3000)
```

For the background worker to process research runs, the app must be served by a
long-lived Node process:

```bash
npm run build
npm run start
```

## 6. Use it

1. Sign in and open **New run**.
2. Enter the qualification objective and the desired number of leads (e.g.
   *"Find 10 US B2B SaaS companies with 10–100 employees that may need AI
   automation support."*).
3. The app refines the objective into an ICP. Review it; edit fields if needed.
4. Click **Confirm & start research**. The worker runs discovery → research →
   qualification → drafting → quality check.
5. Open the run to see leads, evidence, tool calls/activity, drafts and the
   quality report. Approve or edit each outreach draft (never auto-sent).
6. Export the **sample pack** (CSV/JSON) from the run.

## Quality checks (local)

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Notes on this environment

No live credentials were available while building, so the Supabase/Apify/
Firecrawl/Anthropic integrations are implemented against their documented APIs
and unit-tested at the logic layer, but were **not** exercised against the live
services here. Configure real keys to run live.
