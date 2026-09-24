# Loom Video Script — Week 5: AI Lead Research and Outreach Agent
# Total runtime: ~5 minutes 30 seconds

---

## SLIDE 1 — Title + Problem Statement (30 seconds)

**Narration:**
"Hi, I'm [Name]. This is my Week 5 project: an AI Lead Research and Outreach Agent built for Koya Talent.

Koya connects early-stage founders with AI automation assistants. Their outbound process was entirely manual. A person would define a target persona, search LinkedIn for companies, check each one for fit, visit their website for context, and write cold outreach from scratch. That took hours per campaign and did not scale.

This application automates that research pipeline. A user enters a qualification objective, the agent finds companies, qualifies them with evidence, and produces review-ready outreach drafts. No outreach is ever sent automatically — a human reviews and approves everything first."

---

## SLIDE 2 — Architecture and Workflow Overview (45 seconds)

**Narration:**
"Here is the actual path a run takes.

Step 1: the user submits a qualification objective. Step 2: Claude Sonnet refines it into a structured ICP — target company type, geography, headcount, hard filters, soft preferences.

Step 3: the user reviews and confirms the ICP. This is a hard gate. Nothing runs until a human approves it.

Step 4: the run is queued. A background worker picks it up. Step 5: the agent calls the discover_companies tool, which triggers an Apify actor. Result count and cost are logged. Step 6: for each promising candidate, the agent calls scrape_company_website using Firecrawl. Step 7: the agent qualifies each company and writes a lead record to Supabase. Step 8: for each qualified lead, the agent drafts a 3-step email sequence. Step 9: the deterministic quality gate runs.

Finally: the human reviews leads and outreach drafts, approves or edits them, and exports a sample pack."

---

## SLIDE 3 — Key Features and Business Value (45 seconds)

**Narration:**
"Three features that matter for a real deployment.

First: the ICP refinement step. The agent does not guess what you want. It produces a structured criteria object that you can edit before anything runs. Hard filters stay hard — they are enforced at the tool level, not just in the prompt.

Second: the quality gate is deterministic. It does not rely on the model's self-assessment. It reads the actual database records and checks that each qualified lead has a confidence score, source URLs, a source summary, and three outreach steps.

Third: the safety layer is non-negotiable. Scraped website content is treated as untrusted data. The system detects prompt injection attempts, redacts email addresses before they reach the agent, and blocks outreach copy that contains email addresses or unsupported claims.

The trade-off I made: I used Claude Sonnet instead of Haiku. Sonnet costs more per run but produces qualification reasoning and outreach copy that passes the evidence and safety checks at a much higher rate."

---

## LIVE DEMO — Happy Path End-to-End (3 minutes)

**0:00 — Start a new run**
"I'll click New research run. I'm entering a specific objective: 'Find US-based B2B SaaS companies with 10 to 100 employees whose operations team is handling repetitive manual workflows that could be automated with an AI assistant.' I'll set the target to 10 leads and hit Refine ICP."

**0:20 — Review the ICP**
"The agent has produced the ICP. I can see the hard filters — 'Located in United States', 'Must be B2B', 'Headcount 10-100 employees' — are correctly separated from the soft preferences. I'll confirm it and start the research."

**0:40 — Watch the run in progress**
"The run is now in the Discovering stage. I can see the audit trail on the right updating in real time. The agent has called get_run_context, then discover_companies. You can see the Apify actor ID and the number of results returned. The cost in USD is logged."

**1:00 — Scraping**
"Now the agent is calling scrape_company_website for the most promising candidates. Each scrape call shows the domain, the page title, and how many characters were returned."

**1:20 — Qualification**
"The agent is now qualifying leads. Each qualify_lead call shows the company name, the status — qualified, not_qualified, or needs_review — and the confidence score."

**1:40 — Outreach drafting**
"For each qualified lead, draft_outreach is called. Three steps are written to the outreach_drafts table in Supabase."

**2:00 — Quality gate**
"The check_lead_list_quality tool ran. The quality report shows the qualified count, safety check passed, and evidence check status."

**2:15 — Reviewing a lead**
"I'll open a qualified lead. I can see the fit reasons, the evidence summary, the source URLs. On the right, the 3-step outreach sequence. I'll approve email 1. I'll edit email 2 to remove a placeholder. I'll save — it is now marked as Reviewed."

**2:40 — Supabase records**
"I'll switch to Supabase. You can see the leads table with the run_id, domain, qualification_status, confidence, source_urls as a JSON array, and the timestamps. The outreach_drafts table shows 3 rows per qualified lead with the review_status changing as I approved them."

**2:55 — Export**
"Finally, I'll export a sample pack. This is a Markdown document containing the qualification objective, the refined ICP, the quality report, and for each qualified lead — the source summary, fit reasons, and the full 3-step email sequence."

---

## SLIDE 4 — Limitations and Next Steps (30 seconds)

**Narration:**
"What is still manual: ICP confirmation, lead review, outreach approval, and sharing the final list.

What is not implemented: CRM integration, email sending, LinkedIn outreach, personal email discovery — deliberately, by design.

The biggest dependency is the Apify team account. If that token expires or budget runs out, discovery returns zero results.

Next steps I would prioritize: a hybrid model approach using Haiku for simple steps and Sonnet only for reasoning-heavy ones, a proper async queue instead of the in-process polling worker, and a way to retry discovery with a different search query from the UI without starting a new run from scratch."

---

## END CARD (5 seconds)

"Thanks for watching. The repository, application link, and all supporting documentation are in the submission."
