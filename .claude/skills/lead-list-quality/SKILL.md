---
name: lead-list-quality
description: Check the final qualified lead list for completeness, ICP fit, evidence quality, duplicates, outreach relevance, data completeness, and safety compliance before a run is finished. Use as the final quality gate at the end of a research run.
---

# Lead-List Quality Guide

Use this guide to check the quality of the final lead list before submission.

## Required Checks

- The list contains at most the configured number of qualified companies (target is usually 10 where possible).
- Each company has a name and domain.
- Each company has qualification reasoning (fit reasons).
- Each company has source context (source URLs + source summary).
- Each company has outreach drafts (3-step sequence).
- No personal email finding or email validation was attempted.
- Duplicate companies were removed (by normalized domain).
- Companies marked `needs_review` are not counted as qualified leads.

## Suggested Scorecard

| Dimension | What To Check |
| --- | --- |
| ICP Fit | The lead matches the hard filters in the qualification objective. |
| Evidence Quality | The qualification decision uses real source context. |
| Duplicate Rate | The same company does not appear more than once. |
| Outreach Relevance | The email sequence uses company-specific context. |
| Data Completeness | Required fields are present in Supabase. |
| Safety Compliance | The agent did not find emails, validate emails, or send outreach. |

## Pass Standard

The submitted list should include the target number (usually 10) of qualified companies that pass the core checks above.

If the agent cannot find enough qualified companies from the first candidate pool:

1. Search again within the configured tool-call limit if possible.
2. Otherwise return fewer qualified companies with a clear explanation of why.
3. NEVER fabricate companies to reach the target.

## Final Gate Report

Produce a plain-language quality summary that reports, for the run:

- total candidates discovered
- qualified count
- not-qualified count
- needs-review count
- duplicates found (0 expected)
- qualified leads missing required fields
- qualified leads missing outreach drafts
- safety concerns (none expected)

The final state must respect configured tool limits. If the deterministic application-level check finds issues, the lead(s) should be flagged for human review; do not silently publish them.