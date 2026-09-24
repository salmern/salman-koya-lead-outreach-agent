# Reflection Sheet — Week 5: AI Lead Research and Outreach Agent

## Q1: In a business setting, what clarifying questions would you ask when assigned this project?

1. What is the specific definition of a "qualified lead" for this campaign — does it mean a company that fits the ICP, or one that has already expressed interest, and who makes that call?
2. What is the acceptable cost per Apify run, and what is the total budget ceiling before someone needs to approve a new spend? The cohort budget was $5 per person and exceeded without a clear enforcement mechanism.
3. Who is the intended reviewer of the output — the researcher who ran the agent, a sales manager, or the founder? The review workflow design depends entirely on this.
4. What is the expected cadence of runs — is this a one-time batch, a weekly process, or on-demand? This determines whether the in-process background worker is acceptable or whether a proper queue is needed.
5. What happens to a lead after it leaves this system? Does it go into a CRM, a spreadsheet, or an email tool? Understanding the downstream workflow determines what the export format should contain and which fields are mandatory.
6. Are there any companies or domains that must never appear in the results, either for legal, competitive, or relationship reasons? A blocklist feature would need to be scoped if so.
7. What counts as success for this project — 10 qualified leads per run, a response rate from outreach, or a conversion to a sales meeting? Without a measurable outcome, the quality gate target is arbitrary.

---

## Q2: What was the most significant challenge you faced, and what was its root cause?

The most significant challenge was that discovered candidates arrived with no resolvable website domain, which caused the entire pipeline to stall after discovery.

Root cause: The Apify actor was configured in `scraperMode: "short"` in the environment file. Short mode returns only LinkedIn identity fields (name, slug, industry, location) and does not include the company's real website URL. The `scrape_company_website` tool enforces a domain authorization gate — it only accepts domains that belong to discovered candidates. With all candidates having `company_domain: ""`, no scraping could proceed, no evidence could be gathered, and no leads could be qualified.

The symptom (0 websites resolved, agent skipping qualification) looked like a logic bug but the actual cause was a one-word misconfiguration in the env file. Four related code bugs compounded the problem:

- `server/agent/discovery.ts` had its `const COUNTRY_ALIASES` declaration truncated by a previous agent, causing a syntax error that prevented the module from loading.
- `applyCandidateResolution` was imported in `tools.ts` but never implemented in `apify-mapping.ts`.
- `config.resolutionMaxCandidates` was referenced in `tools.ts` but never added to `server/config.ts`, causing `NaN` in the resolution limit calculation.
- `env.counters.resolutions` was accessed in `tools.ts` but not declared in the `ToolEnv` interface, so the resolution pass condition always evaluated to `false`.

All four were fixed systematically. The lesson: configuration and interface contracts must be verified end-to-end before building agent logic on top of them.

---

## Q3: If you were to start this project again, what is the one thing you would do differently?

Build the actor input validation and integration test for `toCandidates` on day one, before writing any agent logic.

The entire pipeline depends on the shape of the Apify response. Every downstream feature — domain resolution, scraping authorization, deduplication, qualification — assumes that `company_domain` is populated for full-mode records. Testing the mapping layer in isolation (which the final `apify-mapping.test.ts` does) would have caught the short-mode/full-mode distinction before any agent code was written, and would have made the env configuration bug immediately visible rather than only discoverable during a live run.

In practice: write the data-layer contract tests first. Then build the agent tools that depend on that contract. This sequence prevents silent failures where the agent produces plausible-looking output that is actually operating on empty data.

---

## Q4: What edge cases did you account for, and how?

**Candidate has no resolvable website**
Stored with `company_domain: ""`. Resolution pass attempts to fill it via a full-mode Apify run. If still empty, the candidate stays unresolved. Quality gate surfaces these in `unresolved_candidates`. `scrape_company_website` rejects requests for unresolved candidates. Nothing is fabricated.

**Malformed or schema-invalid agent output**
Handled by Zod schemas and semantic completeness checks. Each validation function returns `{ ok: false, errors }` on failure. The tool converts this into a readable error the agent can act on. Agent retries within the tool-call budget.

**Duplicate company in the same run**
DB unique constraint on `(run_id, domain)` prevents duplicate rows. `mergeCandidates` deduplicates by canonical domain, LinkedIn slug, or normalized name before any DB write. Quality gate counts remaining duplicates.

**Email addresses in outreach**
`findEmailLike()` called server-side on all outreach content before any DB write. `redactEmails()` applied to all scraped content before it reaches the agent. Quality gate also scans all stored drafts.

**Unsupported or generic claims in outreach**
`findUnsupportedClaims()` checks for phrases like "loved what you're building", "world-class". Detected phrases cause the quality gate to fail `safety_passed`.

**Prompt injection in scraped content**
`detectInjection()` scans scraped markdown for patterns like "ignore previous instructions". Injections are logged as `SOURCE_INJECTION_DETECTED` events. Tool output explicitly labels all scraped content as DATA.

**API timeout from Apify**
240-second polling cap with auto-abort of the Apify run on timeout. Error returned with the run ID so the user can inspect the Apify Console.

**Agent exceeds tool-call budget**
`consumeBudget()` decrements a per-run counter on every tool call. Once exhausted, every further tool call returns a hard-stop message and logs a "skipped" tool_call record. The agent cannot bypass this.

**Supabase connection failure**
DB errors propagated as thrown exceptions. API layer maps these to 500 responses. Run worker catches unhandled errors, writes `status: "failed"` and `error_message` to the run record.

**Unauthorized access**
`requireUser()` / `requireRole()` on every mutating route. Postgres RLS policies on all tables using `SECURITY DEFINER` functions enforce ownership independently of the application layer.

**Outreach review_status DB constraint violation**
The code sent `"edited"` but the DB constraint only allows `('draft', 'reviewed', 'approved', 'rejected')`. Fixed by renaming the value to `"reviewed"` throughout the API route, UI component, and tests.

---

## Q5: Which Claude model did you use, and why?

**Model used:** `claude-sonnet-4-5-20250929`

**Alternative considered:** `claude-haiku-3-5` (fast, cheap, lower reasoning capability)

**Trade-off analysis:**

The agent performs four distinct tasks: ICP refinement, discovery query generation, website content analysis and qualification reasoning, and outreach copywriting. Each requires multi-step reasoning over source material that varies significantly in quality and length.

Sonnet 4.5 was chosen because:

- ICP refinement requires interpreting ambiguous natural-language objectives, separating hard filters from soft preferences, and producing a structured JSON object. Haiku produces vague or inconsistently structured ICPs that fail schema validation more often.
- Lead qualification requires reading up to 9,000 characters of scraped website content and producing an evidence-backed decision with source citations. Haiku produces low-confidence, evidence-thin qualifications that the quality gate rejects as incomplete.
- Outreach drafting requires personalizing copy to specific company context without inventing facts. Haiku drafts more frequently trigger the unsupported-claims validator or produce placeholder-heavy copy.

The cost trade-off is real. Sonnet costs approximately 10-15x more per token than Haiku. For a pipeline processing 10-20 companies per run with scrape content at each step, Sonnet adds roughly $0.50-$2.00 per run. This is acceptable given that the output has significant downstream business value and the quality gate catches bad output before it reaches a human reviewer.

A hybrid approach would be defensible for cost reduction: use Haiku for simple structured steps (discovery query generation) and Sonnet only for judgment-intensive steps (qualification, outreach). This was not implemented but is the logical next optimization.
