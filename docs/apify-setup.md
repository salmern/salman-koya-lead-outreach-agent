# Apify setup (company discovery only)

Apify is used **only** to discover candidate companies. Website research uses
Firecrawl (see below). The agent never receives an uncapped Apify input.

## 1. Use the team account

- Accept the Koya Apify invite, then switch to the **team account** in the Apify
  Console (account button, top-left) before creating a token.
- Copy the **team** account's API token into `APIFY_API_TOKEN`.

A run started from a personal account is not covered by the cohort budget.

## 2. Choose a pay-per-event actor

Pick an actor that charges **per result** (pay-per-event). Do **not** enable a
rental actor — those bill a flat monthly fee immediately.

Before running anything:

- Read the actor's pricing page and confirm per-result billing.
- Confirm the input fields the actor expects.

Put the actor id in `APIFY_ACTOR_ID` (e.g. `username/actor-name`).

## 3. Hard caps (non-negotiable)

`server/services/apify.ts` enforces every cap itself:

- `runCompanyDiscovery()` is always called with `requestedMaxResults` and
  `runLimit`, both derived from `effectiveLimits()` (server-clamped).
- The limit is written into the actor input using
  `APIFY_ACTOR_MAX_RESULTS_KEY` (default `maxResults`).
- The run is polled with a timeout (`MAX_APIFY_WAIT_SECS`, default 240s).
- The candidate pool is deduped and hard-capped by `mergeCandidates()`.

The model cannot raise these limits; it may only ask for fewer results.

## 4. Adapt the actor input

Because the exact actor is chosen by the team, the input shape is adapted with
env vars:

| Env | Meaning | Default |
| --- | --- | --- |
| `APIFY_ACTOR_INPUT` | JSON object merged into the actor input for **operational** fields only (see below) | `{}` |
| `APIFY_ACTOR_SEARCH_FIELD` | Field that receives the search query | `query` |
| `APIFY_ACTOR_MAX_RESULTS_KEY` | Field that receives the result cap | `maxResults` |
| `MAX_APIFY_WAIT_SECS` | Max seconds to wait for the run | `240` |
| `MAX_DISCOVERY_ATTEMPTS` | Max bounded discovery runs per research phase | `3` |

Example `.env.local`:

```
APIFY_API_TOKEN=apify_api_...
APIFY_ACTOR_ID=some-team/search-actor
APIFY_ACTOR_SEARCH_FIELD=searchString
APIFY_ACTOR_MAX_RESULTS_KEY=maxItems
APIFY_ACTOR_INPUT={"scraperMode":"short","startPage":1,"takePages":1}
```

### Filter precedence (geography is never pinned)

The user's objective — via the confirmed ICP — is authoritative for discovery
criteria:

- **`locations`**: the confirmed ICP geography is derived into actor location
  filters (`server/agent/discovery.ts`). A location set in `APIFY_ACTOR_INPUT`
  **never** overrides it. If the ICP is global/remote/empty, no `locations` field
  is sent. Region-level terms (e.g. "Europe") are region labels only — they stay
  in the search query, not in a hard location filter.
- **`companySize` / `industryIds`**: only sent when the agent explicitly passes
  actor-native values it can stand behind; the template never pins them.
- **Result cap**: `APIFY_ACTOR_MAX_RESULTS_KEY` **and** the aliases
  (`maxItems`, `resultsPerSearch`, `num`) are all forced to the server-capped
  value, so a template cannot smuggle a higher limit.

Example: a D2C UK/Europe run must **not** ship a stale
`{"locations":["United States"]}` template — that pins every run to the US and
silently returns 0 results for any other geography.

### Record mapping (observed from finished runs)

`scraperMode: "short"` records look like this (verified against real datasets):

```
id, universalName, linkedinUrl, name, industry,
location: { linkedinText: "United States" },
followers, summary, logo, _meta
```

`scraperMode: "full"` adds `website` (may be null), `employeeCountRange`
/ `employeeCount`, `description`, `locations[]`, `industries[]`, `tagline`,
`foundedOn`, `followerCount`, `specialities`.

`server/services/apify-mapping.ts` maps them as:

| Internal field | Source | Short mode | Full mode |
| --- | --- | --- | --- |
| `company_name` | `name` | ✅ | ✅ |
| `company_domain` | `website` → canonical host | **empty** | website domain |
| `linkedin_url` | `linkedinUrl` → else `url` if LinkedIn host | LinkedIn URL | LinkedIn URL |
| `location` | `location.linkedinText` / `locations[]` | ✅ | ✅ |
| `industry` | `industry` / `industries[]` | ✅ | ✅ |
| `source_context` | `summary` / `description` / `tagline` | ✅ (truncated snippet) | ✅ |
| `employees` | `employees` / `employeeCount` / `companySize` | ❌ **absent** | ✅ |

Two rules here are non-negotiable:

- **A LinkedIn identifier is never a website domain.** Short-mode records have no
  `website` field, so `company_domain` stays empty — it is NOT filled with
  `linkedin-<slug>`. The LinkedIn company page lives in `linkedin_url` as a
  separate identity. `scrape_company_website` and `qualify_lead` only accept a
  resolved real website domain, which also prevents scraping/auth-walled or
  invented domains.
- **Nothing is fabricated.** Records with neither a name nor any identity are
  skipped by the mapper; candidates whose website cannot be resolved stay
  candidates and are surfaced at the final quality gate
  (`unresolved_candidates`).

### Website-resolution step (bounded, automatic)

Short mode returns no website, but the agent can qualify on employees only via
full mode. To bridge this automatically **the first time a discovery call
leaves candidates without a `company_domain`**, the server runs ONE additional
full-mode Apify pass with the same search query, capped at
`MIN(MAX_RESOLUTION_CANDIDATES, missing domains, run candidate limit)` and
matches results by LinkedIn slug (then name). Matched candidates get their
real website domain (when the full-mode record has one), employee count,
location, industries and description filled in. `MAX_RESOLUTION_CANDIDATES`
defaults to 8 and is server-capped at 25; at most one resolution pass runs per
discovery call (`env.counters.resolutions`).

Full-mode records whose `website` is `null` (the actor can return that) simply
leave the candidate unresolved — the domain is never invented and never derived
from the LinkedIn name.

## 5. Bounded discovery retries

If a discovery run returns **0 results**, the agent may retry with adjusted
criteria while attempts remain (`MAX_DISCOVERY_ATTEMPTS`, max 5, default 3).
Each attempt is a new capped run, still consumes a tool call, respects the
candidate limit, and logs a `DISCOVERY_RETRY` event. The agent never fabricates
companies; when attempts are exhausted it reports the empty result through the
quality gate.

## 6. Test small, then scale

Start with a low `MAX_CANDIDATES_PER_RUN` (e.g. 2), inspect the actual cost in
the Apify Console (**Run → Usage**), then raise it. The `usageTotalUsd` reported
by the API is stored in `research_runs.agent_metadata.apify_usage_usd` and shown
in the run activity feed.

## Failure behaviour

If the actor does not succeed (`status !== succeeded`), the tool throws with the
actor id, run id, status and error message, logs a tool-call `error`, and the run
ends in `needs_review`/`failed` — it never invents leads.
