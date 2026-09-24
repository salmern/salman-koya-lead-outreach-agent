# One-Pager: AI Lead Research and Outreach Agent

**Project name:** Koya Lead Agent
**Owner:** [Your Name]
**Last updated:** September 2026
**Status:** Live

---

## 1. PURPOSE

**Problem it solves**
Koya Talent's outbound sales process was entirely manual. A person defined the target persona, searched for companies, checked each company for fit, reviewed websites for context, and wrote cold outreach from scratch. This took hours per campaign and did not scale.

**Who uses it**
A researcher (or founder) who needs a qualified lead list and review-ready outreach drafts. An admin who manages team access. No sales or CRM integration exists yet.

**What success looks like**
A completed run produces a minimum of 10 qualified companies with evidence-backed reasoning, source URLs, a source summary, and a 3-step cold email sequence per lead — all reviewed and approved by a human before any outreach leaves the system.

---

## 2. WORKFLOW

```
1. Researcher submits a qualification objective
2. Agent (Claude Sonnet) refines it into a structured ICP
3. Human reviews and confirms the ICP  <-- hard gate
4. Run queued
5. Agent calls discover_companies (Apify, capped)
6. Agent calls scrape_company_website (Firecrawl, capped)
7. Agent calls qualify_lead for each researched company
8. Agent calls draft_outreach for each qualified lead
9. Agent calls check_lead_list_quality (deterministic gate)
10. Run marked Completed or Incomplete
11. Human reviews leads, evidence, and outreach drafts  <-- hard gate
12. Human approves or edits each email step
13. Export: CSV, JSON, or Markdown sample pack
```

Human decisions occur at step 3 (ICP confirmation), step 11 (lead review), and step 12 (outreach approval). Nothing is sent automatically.

---

## 3. CONTROLS

**Approval gates**
ICP must be confirmed by a human before discovery runs. Outreach drafts have an explicit review_status field (draft / reviewed / approved / rejected). No outreach is sent by the system under any circumstances.

**Permissions**
Two active roles: Researcher (full workflow), Admin (researcher + user management). Enforced server-side via `requireRole()` on every mutating API route and Postgres RLS policies on all tables.

**Validation rules**
ICP: Zod schema + hard/soft filter separation enforced. Qualification: confidence >= 0.4, fit_reasons non-empty, source URLs required for qualified leads. Outreach: email addresses blocked, unsupported claims blocked, minimum body length enforced. All validation happens server-side before any DB write.

**Retries and idempotency**
Discovery: up to 3 Apify attempts per run. Upsert on `(run_id, domain)` prevents duplicate leads. Tool-call budget (default 50) is hard-capped per run and cannot be raised by the model.

**Grounding**
Every qualification decision must cite real source URLs from the discovered candidate. Every outreach step must reference evidence from the stored source context. The quality gate checks this deterministically — it does not rely on the model's self-assessment.

**Failure states**

| State | What happens |
|---|---|
| ICP refinement fails | Run moves to `failed`; error_message stored; user can retry |
| Apify returns 0 results | Up to 3 retries with adjusted queries; after 3, run continues without candidates |
| Website blocked or unreachable | Lead marked `needs_review`; scrape failure logged in run_events |
| Agent exceeds tool-call budget | Tools return hard-stop message; run completes with what was found |
| DB write fails | Error thrown and propagated to API; run marked `failed` if in worker |
| Run interrupted (server restart) | `recoverStuckRuns()` marks stuck runs `failed` on next boot |

---

## 4. ARTEFACTS

- **Application:** [deployed URL — paste here]
- **Repository:** [GitHub URL — paste here]
- **Supabase dashboard:** [Supabase project URL — paste here]
- **Lead list:** Exported CSV or Markdown sample pack from the application (`/api/runs/[id]/export?format=csv` or `?format=sample-pack`)
- **Outreach samples:** Markdown sample pack includes qualification objective, ICP, quality report, and 3-step sequences per qualified lead
- **Tool-call evidence:** JSON export (`/api/runs/[id]/export?format=json`) includes full tool_calls array with input_summary, result_summary, status, duration_ms, and created_at for every agent action

This document was last updated in September 2026 by [Your Name].

---

## 5. LIMITATIONS

**Still manual**
ICP confirmation before discovery. Lead qualification decisions for needs_review leads. Outreach approval before use. Export and sharing of the final lead list.

**Mocked or not implemented**
No email validation or deliverability check (by design — PRD forbids it). No personal email discovery. No CRM integration. No automated sending capability.

**Delayed or async**
The research phase runs in a background worker that polls every 5 seconds. On serverless deployments the worker must run separately. The UI polls every 4 seconds — no real-time push.

**Unsupported**
Multi-user collaboration on the same run. Run scheduling or recurring campaigns. Direct LinkedIn outreach. Custom actor configurations per run (actor ID is fixed in env).

**Third-party dependencies**

| Provider | Used for | Risk if unavailable |
|---|---|---|
| Anthropic / Claude | ICP refinement and all agent reasoning | Run fails at start; deterministic fallback ICP only |
| Apify (team account) | Company discovery | No candidates discovered; run reports 0 results |
| Firecrawl | Website research | Falls back to plain HTTPS fetch; less structured output |
| Supabase | All data storage and auth | Application cannot run; no data persisted |

---

## 6. HOW TO OPERATE

**What to click first**
Log in as a researcher. Click New research run. Write a specific objective (include geography, company type, size range, and business model). Submit.

**What to check before running**
Confirm the refined ICP looks correct. Hard filters (geography, size, business model) must be in the Hard filters section, not Soft preferences. Edit if needed. Click Confirm & start research.

**What to approve**
After the run completes, open each qualified lead, read the evidence, and approve or edit each outreach step. Rejected steps must be edited. Click Refresh on the quality report after making decisions to update the run status.

**What to retry if it fails**
If the run shows status Failed, check the error message and the audit trail. Common causes: Apify token expired, Firecrawl key exhausted (falls back automatically), or agent ran out of tool calls.

**What to investigate if something breaks**

| Symptom | Likely cause | Action |
|---|---|---|
| Run stays in Discovering for more than 10 minutes | Apify actor hung | Open Apify Console, check the run, abort if still running |
| 0 candidates discovered | Search query too narrow, or wrong Apify token | Try a simpler query; verify APIFY_API_TOKEN is from the team account |
| Outreach save returns 422 | Email address found in draft copy | Edit the draft to remove the email |
| Run marked Failed on boot | Worker recovered a stuck run from a previous process restart | Start a new run; the interrupted run cannot be resumed |
| Quality report counts are stale | Lead status changed after run completed | Click Refresh on the quality report card |

---

## APPENDIX

**Glossary**

- **ICP** — Ideal Customer Profile. A structured object describing target company type, geography, headcount, buyer persona, hard filters, soft preferences, and disqualifiers.
- **Hard filter** — A condition a company must meet to be qualified. Failure = not_qualified.
- **Soft preference** — A positive signal that improves fit but does not disqualify.
- **needs_review** — A lead the agent could not fully verify against all hard filters. Requires a human decision before it is counted as qualified.
- **Quality gate** — A deterministic application-level check run after the agent completes. Does not rely on the model's self-assessment.
- **run_events** — A human-readable timeline of every agent action and system event for a run, stored in Supabase.

**Contact for questions:** [Your email or Slack handle]
