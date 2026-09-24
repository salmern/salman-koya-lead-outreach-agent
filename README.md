# Koya Lead Agent — Week 5

An AI lead research and outreach agent for Koya Talent. A user enters a
qualification objective; the agent refines the ICP, researches companies with
tools, qualifies the best fits into Supabase, and produces review-ready 3-step
outreach drafts.

The agent **does not** find personal email addresses, validate emails, or send
outreach. It produces a qualified lead list and drafts for human review.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Supabase** — Postgres, Auth, Row Level Security
- **Claude Agent SDK** — agent runtime, with five project skills and custom MCP tools
- **Apify** — company discovery only (team account, capped)
- **Firecrawl** — website research (with a bounded, public-only fetch fallback)
- Tailwind CSS + shadcn/ui

## Quick start

```bash
npm install
cp .env.example .env.local     # fill in Supabase + Anthropic (+ Apify/Firecrawl)
# apply supabase/migrations/*.sql, then:
npm run migrate:check
npm run dev
```

Promote your first user to admin after signing up:

```bash
npm run create-admin -- you@example.com
```

Seed the one-click demo accounts for the login page (admin / researcher /
viewer):

```bash
npm run seed:demo
```

Full instructions: [`docs/setup.md`](docs/setup.md).

## How it works

1. Create a run with an objective and a lead count.
2. **Phase A** refines the objective into a concrete ICP (with hard filters kept
   separate from soft preferences). You review and edit it.
3. **Phase B** (background worker) discovers companies via Apify, researches
   their websites, qualifies leads with evidence, and drafts 3-step sequences.
4. A **deterministic quality gate** decides whether the run is `completed` or
   `needs_review` — the model's own opinion is never trusted.
5. Review leads, evidence, tool calls and drafts; export a sample pack.

See [`docs/agent-workflow.md`](docs/agent-workflow.md) and
[`docs/architecture.md`](docs/architecture.md).

## Commands

```bash
npm run dev            # develop
npm run build          # production build
npm run start          # run (needed for the background worker)
npm run typecheck      # tsc --noEmit
npm run lint           # next lint
npm test               # vitest
npm run create-admin   # promote a user to admin
npm run migrate:check  # verify the Supabase schema
```

## Docs

- [`docs/setup.md`](docs/setup.md) — install, env, migrations, run
- [`docs/architecture.md`](docs/architecture.md) — phases, statuses, limits, modules
- [`docs/agent-workflow.md`](docs/agent-workflow.md) — tools, skills, quality gate
- [`docs/security.md`](docs/security.md) — RBAC, RLS, SSRF, injection, outreach safety
- [`docs/apify-setup.md`](docs/apify-setup.md) — discovery actor + caps
- [`docs/supabase-setup.md`](docs/supabase-setup.md) — schema + RLS
- [`docs/testing-evidence.md`](docs/testing-evidence.md) — scenario → test map
- [`docs/one-pager.md`](docs/one-pager.md) — one-page overview
- [`docs/reflection.md`](docs/reflection.md) — reflection
- [`docs/loom-demo-script.md`](docs/loom-demo-script.md) — demo script

## Project brief

The original brief and reference guides remain in the repo:

- [`PRD.md`](PRD.md) — the project brief
- `assets/*.md` — ICP refinement, lead qualification, outbound copywriting,
  lead-list quality, and outreach safety guides (source material for the skills
  in `.claude/skills/`).
