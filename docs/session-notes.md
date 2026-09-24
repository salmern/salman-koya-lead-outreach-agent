# Session notes (2026-09-21) — continue tomorrow

Where we are: **build is complete and green** (`npm run typecheck`, `npm run lint`,
`npm test` → 34 passing, `npm run build` ✓).

## What exists
- Full Next.js app: auth + RBAC (admin / researcher / viewer), run creation,
  ICP refinement w/ confirm, background research worker, lead/outreach review,
  export, settings, admin users page.
- Claude Agent SDK runtime + 5 skills (from `assets/*.md`) + MCP tools
  (`server/agent/tools.ts`).
- Supabase migrations (schema + RLS), service-role vs user-scoped data layer.
- Apify (capped discovery) + Firecrawl/bounded-fetch scraping, SSRF + injection +
  email-redaction safety, deterministic quality gate.
- Docs in `docs/`, demo users (`npm run seed:demo`), admin lift
  (`npm run create-admin`).
- `.env.local` now exists with real Supabase values (service role key set).

## Things fixed this week
- Outreach email check now scans whole copy; `truncateMarkdown` honors byte cap;
  instrumentation build fixed (NEXT_RUNTIME branch); seed script loads `.env.local`.
- Login page: "Explore with a demo account" cards (admin/researcher/viewer),
  placed below the sign-up link, no "seeded via" text.

## Next steps (todo for tomorrow)
1. Run `npm run seed:demo` (creates the 3 demo users) — confirm it works against
   the live Supabase project.
2. Add `ANTHROPIC_API_KEY` + team **Apify** token/actor → sanity-range a run.
3. Do the PRD testing scenarios 1–7 live; fill the testing-evidence table.
4. Produce the real 10-lead sample pack (export feature exists).
5. Deploy + get a public URL.
6. Record the Loom video (script: `docs/loom-demo-script.md`).

## Warnings / constraints
- Apify is a shared paid team account — use team token, capped actor, per-result
  billing, test with 2 results first.
- No fabricated leads: if a run can't gather evidence it ends
  `needs_review`/`failed` on purpose.
- Worker requires long-lived Node server (`npm run start`), not serverless.
- Outreach is draft-only; no email sending anywhere.