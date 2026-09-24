# Architecture

## What this is

A Next.js (App Router) web app where a signed-in user turns a lead-qualification
objective into a review-ready qualified lead list and outreach drafts. The agent
runtime is the **Claude Agent SDK**. Company discovery uses **Apify only**.
Website research uses **Firecrawl** (with a bounded, public-only fetch fallback).
All records live in **Supabase**.

The agent **never** finds personal email addresses, validates emails, or sends
anything. Outreach is always a draft a human must approve.

## High-level flow

```
Browser (React)
  │  create run (objective + desired count)
  ▼
POST /api/runs ───────────────► research_runs (status=draft)
  │
  │  POST /api/runs/:id/refine
  ▼
Phase A: runRefinePhase (Claude Agent SDK, inline request)
  │  tool: mcp__koya_icp__refine_icp
  ▼
research_runs.refined_icp  +  status=awaiting_confirmation
  │
  │  user reviews / edits ICP, then POST /api/runs/:id/start
  ▼
status=queued ──► background worker (in-process poller)
  │
  ▼
Phase B: runResearchPhase (Claude Agent SDK)
  │  tools: mcp__koya_research__{get_run_context,
  │          discover_companies, scrape_company_website,
  │          qualify_lead, draft_outreach, check_lead_list_quality}
  ▼
leads + outreach_drafts + tool_calls + run_events
  │
  ▼
runQualityCheck (deterministic) ──► research_runs.quality_report
  │
  ▼
status = completed | needs_review | failed | cancelled
```

## Why two phases

ICP refinement is the one decision a human should confirm before money is spent
on the paid Apify account. Phase A ends at `awaiting_confirmation`; discovery
only happens after the user explicitly confirms the ICP (and may edit it first).
This also means a vague objective is forced through a concrete, reviewable ICP
before any tool spend.

## Run statuses

```
draft ─► refining ─► awaiting_confirmation ─► queued
  └──────────────► discovering ─► researching
        └──────► qualifying ─► drafting ─► quality_check
              └──► completed | needs_review | failed | cancelled
```

`processRun` sets the **final** status deterministically:

- aborted (user cancelled) → `cancelled`
- `quality_report.structural_ok && safety_passed && qualified > 0` → `completed`
- otherwise → `needs_review`

The model's own opinion of list quality is never trusted; `check_lead_list_quality`
runs the same deterministic gate used by the worker.

## Hard limits (model cannot override)

Limits are resolved per run by `effectiveLimits()` in `server/config.ts`:

1. Start from server env defaults (`MAX_CANDIDATES_PER_RUN`, …).
2. Apply the run's `tool_limits` overrides.
3. Clamp every value to a server-side maximum (`serverMaxima`).

A run can only make limits **stricter**, never higher. On top of that:

- The candidate cap is enforced by `mergeCandidates()` (dedupe + hard stop).
- Apify is called with the same cap in `server/services/apify.ts`.
- `scrape_company_website` refuses once `maxWebsites` is reached and only
  accepts domains from the discovered candidate pool.
- Every tool call is counted against `maxToolCalls`; the SDK run is capped by
  `maxAgentTurns`.

## Key modules

| Path | Responsibility |
| --- | --- |
| `server/config.ts` | Server-only config, integration checks, `effectiveLimits` |
| `server/auth.ts` | Roles, session user, `requireUser` / `requireRole` |
| `server/db.ts` | Service-role typed data access (worker + privileged routes) |
| `server/user-db.ts` | Cookie-bound (RLS-scoped) data access for the app UI |
| `server/agent/tools.ts` | MCP tool servers and limits enforcement |
| `server/agent/{prompts,runner,validation,safety,discovery}.ts` | Agent phases |
| `server/agent/fallback-icp.ts` | Labelled non-AI ICP fallback |
| `server/services/apify.ts` | Company discovery (capped, team token) |
| `server/services/scraper.ts` | Firecrawl + SSRF-guarded fallback fetch |
| `server/quality.ts` | Pure deterministic quality gate (`evaluateQuality`) |
| `server/quality-check.ts` | Loads state and applies the gate |
| `server/run-worker.ts` | In-process polling worker + stuck-run recovery |
| `instrumentation.ts` | Boots the worker on server start |

## Runtime requirements

The research phase runs in an **in-process worker** started from
`instrumentation.ts`. It needs a long-lived Node process (`npm run start`, a
custom server, or a container). On serverless platforms the worker is not
started; set `DISABLE_RUN_WORKER=true` and run the worker separately, or use a
platform with background processing. `recoverStuckRuns()` marks runs left
mid-flight by a restart as `failed` after 15 minutes so nothing hangs forever.

## Deliberate non-goals

No billing, orgs, queues, microservices, or streaming. UI updates by polling
`GET /api/runs/:id`. This keeps the surface area reviewable.
