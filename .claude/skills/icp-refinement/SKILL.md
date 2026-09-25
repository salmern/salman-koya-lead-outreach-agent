---
name: icp-refinement
description: Turn a vague lead-qualification objective into a concrete Ideal Customer Profile (ICP) before any company discovery begins. Use at the START of a research run to define target company type, industry, geography, headcount, buyer persona, business problem, hard filters, soft preferences, and disqualifiers from the user's objective.
---

# ICP Refinement Guide

Use this guide to turn a vague qualification objective into concrete ICP criteria before the agent searches for companies.

## Goal

The agent should understand who counts as a good-fit company before it spends tool calls on discovery and scraping.

## Minimum Criteria To Clarify

- Target company type
- Industry or niche
- Geography
- Company size or headcount range
- Relevant buyer or operator persona
- Business problem the company may have
- Hard disqualifiers
- Soft preferences

## Hard Filters vs Soft Preferences

Hard filters MUST be true for a lead to qualify. They come from explicit, specific constraints in the objective.

Examples:

- Country must be United States
- Company must be B2B
- Headcount must be between 10 and 100

Soft preferences IMPROVE fit but must NOT automatically disqualify a company. They are contextual signals, not thresholds.

Examples:

- Recently hiring operations roles
- Uses tools that may connect to automation workflows
- Publishes content about scaling operations

Rules for separating them:

- If the user says "US, B2B, 10–100 employees", those are hard filters (explicit constraints).
- If the user merely mentions e.g. "companies hiring operations roles", treat it as a soft preference unless they made it a requirement.
- Do not silently upgrade soft preferences into hard filters.
- Do not silently downgrade explicit hard filters into soft preferences.

## Output Format

Produce a single ICP object exactly matching this schema before searching:

```json
{
  "target_company_type": "",
  "industries": [],
  "geography": [],
  "headcount_range": "",
  "buyer_persona": "",
  "business_problem": "",
  "hard_filters": [],
  "soft_preferences": [],
  "disqualifiers": []
}
```

### Field guidance

- `target_company_type`: e.g. "B2B SaaS company", "agency", "ecommerce brand".
- `industries`: list, e.g. ["B2B software", "logistics", "health tech"].

  IMPORTANT — semantic distinction: `industries` describes the vertical or domain that the
  TARGET COMPANY operates in or serves, NOT the product category they sell. For example:
  - A company that sells software to logistics businesses → industries: ["logistics"]
  - A company that needs internal HR automation → industries: ["HR", "human resources"]
  - A company in healthcare that needs ops automation → industries: ["healthcare"]

  Do NOT store the SOLUTION category here. If the objective mentions "HR tech" as an example
  of WHERE companies might need automation, the industry is "HR" or "human resources" — not
  "HR tech software" or "HR technology". Storing product-category labels like "HR tech" or
  "sales enablement software" in industries[] causes the discovery agent to search for vendors
  of that software rather than potential buyers.
- `geography`: list of countries/regions, e.g. ["United States"].
- `headcount_range`: human-readable range, e.g. "10–100 employees".
- `buyer_persona`: title/role of the person to pitch, e.g. "Founder / COO / Head of Operations".
- `business_problem`: the operational problem the persona may have, e.g. "repetitive manual workflows, support load, slow ops".
- `hard_filters`: boolean conditions a company must satisfy.
- `soft_preferences`: positive signals that improve fit but are not required.
- `disqualifiers`: conditions that rule a company out, e.g. "enterprise-only", "publicly traded mega-corp", "non-English website".

## Rules

- Do not treat every user preference as a hard filter.
- Ask for clarification if the objective is too vague to search.
- Preserve specific constraints the user gives.
- Keep the ICP narrow enough to search, but not so narrow that the agent cannot find leads.
- Persist the refined ICP before discovery begins.
- If the objective is ambiguous, choose the safest documented refinement and surface it to the user for confirmation before expensive discovery.