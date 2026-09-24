import type { LeadRow, OutreachRow } from "@/server/db";

export function makeLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "lead-1",
    run_id: "run-1",
    company_name: "Acme Automation",
    domain: "acme.com",
    qualification_status: "qualified",
    confidence: 0.8,
    fit_reasons: ["B2B SaaS with 40 employees in the US"],
    concerns: [],
    source_urls: ["https://acme.com/about"],
    source_summary:
      "Acme Automation is a US-based B2B SaaS company with a small operations team handling manual onboarding and reporting workflows.",
    discovery_data: {},
    created_at: "2026-09-21T00:00:00.000Z",
    updated_at: "2026-09-21T00:00:00.000Z",
    ...overrides,
  };
}

export function makeDraft(step: number, overrides: Partial<OutreachRow> = {}): OutreachRow {
  return {
    id: `draft-${step}`,
    lead_id: "lead-1",
    sequence_step: step,
    subject: `Step ${step} subject line`,
    body:
      step === 1
        ? "Hi there, I noticed your team is hiring for an operations role while also managing manual reporting each week. We help companies like yours automate that kind of repetitive work with an AI assistant."
        : "Following up briefly. If automating onboarding and reporting is on your roadmap this quarter, I would be glad to share how similar teams approached it without adding headcount.",
    personalization_note: "References the open operations role and manual reporting workflows from their site.",
    linkedin_message: "Hi, quick note about automating your ops reporting workflows.",
    review_status: "pending",
    created_at: "2026-09-21T00:00:00.000Z",
    updated_at: "2026-09-21T00:00:00.000Z",
    ...overrides,
  };
}

export function makeDraftsForLead(leadId = "lead-1"): OutreachRow[] {
  return [1, 2, 3].map((step) => makeDraft(step, { id: `${leadId}-draft-${step}`, lead_id: leadId }));
}
