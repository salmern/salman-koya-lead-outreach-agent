# Security

## Threat model

The risky inputs are (a) the user's objective, (b) scraped website content, and
(c) the model's own outputs. The design keeps all three from directly causing
harm or spend.

## Roles and authorization

- Roles: `admin`, `researcher`, `viewer` (`server/auth.ts`).
- `middleware.ts` refreshes the Supabase session and gates protected routes.
- Mutating API routes call `requireRole("researcher")`; admin routes call
  `requireRole("admin")`.
- **RLS is the real boundary.** App reads/writes go through a cookie-bound
  client (`server/user-db.ts`), so even a bug in route logic can't read another
  user's data. Agent output is written by the service-role client only.
- Self-promotion is blocked twice: the `profiles_update_self` RLS policy keeps
  `role` unchanged, and `PATCH /api/admin/users` refuses to change the caller's
  own role.

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `APIFY_API_TOKEN` and
  `FIRECRAWL_API_KEY` are server-only (`server/config.ts` imports
  `server-only`). They never reach client bundles.
- `.env.example` ships placeholders; `.env.local` is git-ignored. No secrets are
  logged; the settings page only shows *configured / not set*.

## Hard spend limits

- `effectiveLimits()` clamps every per-run override to server maxima.
- Apify input always includes the result cap; the run has a timeout.
- Tool-call and website-scrape counters are enforced in `executeTool()` and the
  scrape tool; duplicate discovery calls are rejected.
- The model can lower limits but never raise them.

## Prompt injection / untrusted content

- Scraped text is always delivered as data with a clear wrapper; injection
  markers trigger a warning + `SOURCE_INJECTION_DETECTED` event
  (`server/agent/safety.ts`).
- The system prompt states website text must never be treated as instructions
  and cannot change limits, override the objective, expose secrets, or send
  outreach.
- The agent has no network/built-in tools beyond the defined MCP tools
  (`tools: []`), so a hijacked page cannot reach anything else.

## SSRF and scraping safety

`server/services/scraper.ts` only allows:

- `https:` URLs,
- public hostnames (no `localhost`, `.local`, `.internal`, `.lan`,
  `.onion`, …),
- no embedded credentials,
- hosts whose DNS resolves only to public addresses (rebinding guard),
- bounded response size (`SCRAPE_MAX_RESPONSE_BYTES`) and timeout
  (`SCRAPE_TIMEOUT_MS`), with redirects followed manually and re-validated.

Scraped text is passed through `redactEmails()` before storage.

## Outreach safety

- Email addresses are rejected everywhere in outreach (`validateOutreachOutput`
  scans subject, body, personalization note and the LinkedIn message; the
  `PATCH /api/outreach/:id` route also rejects email-like edits).
- Unsupported/generic phrases must be rewritten before a draft is stored.
- Outreach is **draft-only**: `review_status` starts at `draft`; nothing in the
  codebase can send email.
- Personal email discovery and validation are out of scope entirely.

## Data integrity

- `leads.unique(run_id, domain)` and `outreach_drafts.unique(lead_id,
  sequence_step)` prevent duplicates at the database level.
- Qualified leads require evidence (confidence ≥ 0.4, fit reasons, source URLs,
  summary ≥ 40 chars); the DB stores only `qualified` / `not_qualified` /
  `needs_review` — discovery candidates live in `research_runs.pending_candidates`.
- On failure the run is marked `failed`/`needs_review`; no leads are fabricated.
