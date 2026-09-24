import { describe, expect, it } from "vitest";

import { evaluateQuality } from "@/server/quality";
import { makeDraft, makeDraftsForLead, makeLead } from "./fixtures";

/**
 * Scenario 7 — Supabase-record reviewability, enforced deterministically.
 * The quality gate inspects the stored lead + outreach records (never the
 * model's own summary) and fails the run when evidence, drafts, uniqueness, or
 * safety rules are missing.
 */
describe("lead-list quality gate (scenario 7)", () => {
  it("passes a complete, evidence-backed run", () => {
    const leads = [makeLead()];
    const outreachByLead = new Map([["lead-1", makeDraftsForLead("lead-1")]]);
    const report = evaluateQuality({ leads, outreachByLead, target: 1 });

    expect(report.qualified).toBe(1);
    expect(report.structural_ok).toBe(true);
    expect(report.safety_passed).toBe(true);
    expect(report.meets_target).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it("flags duplicate domains across the run", () => {
    const leads = [
      makeLead({ id: "lead-1", domain: "acme.com" }),
      makeLead({ id: "lead-2", domain: "www.acme.com", company_name: "Acme Twice" }),
    ];
    const outreachByLead = new Map([
      ["lead-1", makeDraftsForLead("lead-1")],
      ["lead-2", makeDraftsForLead("lead-2")],
    ]);
    const report = evaluateQuality({ leads, outreachByLead, target: 2 });

    expect(report.duplicates).toBe(1);
    expect(report.structural_ok).toBe(false);
  });

  it("flags a qualified lead with no outreach drafts", () => {
    const report = evaluateQuality({ leads: [makeLead()], outreachByLead: new Map(), target: 1 });
    expect(report.missing_drafts).toHaveLength(1);
    expect(report.structural_ok).toBe(false);
  });

  it("flags a qualified lead with missing evidence", () => {
    const leads = [makeLead({ source_urls: [], fit_reasons: [], source_summary: "Too short." })];
    const outreachByLead = new Map([["lead-1", makeDraftsForLead("lead-1")]]);
    const report = evaluateQuality({ leads, outreachByLead, target: 1 });

    expect(report.missing_evidence.length).toBeGreaterThanOrEqual(3);
    expect(report.structural_ok).toBe(false);
  });

  it("never counts needs_review leads as qualified", () => {
    const leads = [makeLead({ qualification_status: "needs_review" })];
    const report = evaluateQuality({ leads, outreachByLead: new Map(), target: 1 });
    expect(report.qualified).toBe(0);
    expect(report.needs_review).toBe(1);
    expect(report.meets_target).toBe(false);
  });

  it("fails safety when draft copy contains an email address", () => {
    const drafts = makeDraftsForLead("lead-1");
    drafts[0] = makeDraft(1, { lead_id: "lead-1", id: "d1", body: `${drafts[0].body} Reach jane@acme.com.` });
    const outreachByLead = new Map([["lead-1", drafts]]);
    const report = evaluateQuality({ leads: [makeLead()], outreachByLead, target: 1 });

    expect(report.safety_passed).toBe(false);
    expect(report.personal_email_flags).toHaveLength(1);
  });

  it("fails safety when draft copy uses unsupported claims", () => {
    const drafts = makeDraftsForLead("lead-1");
    drafts[1] = makeDraft(2, { lead_id: "lead-1", id: "d2", personalization_note: "Your game-changing, world-class team." });
    const outreachByLead = new Map([["lead-1", drafts]]);
    const report = evaluateQuality({ leads: [makeLead()], outreachByLead, target: 1 });

    expect(report.safety_passed).toBe(false);
    expect(report.unsupported_claims).toHaveLength(1);
  });

  it("surfaces discovered candidates with no resolvable website instead of dropping them", () => {
    const report = evaluateQuality({
      leads: [makeLead()],
      outreachByLead: new Map([["lead-1", makeDraftsForLead("lead-1")]]),
      target: 1,
      pendingCandidates: [
        {
          company_name: "Bank of the West",
          company_domain: "",
          linkedin_url: "https://www.linkedin.com/company/bank-of-the-west/",
          source: "apify",
          source_context: "Regional bank.",
          employees: "",
          location: "United States",
          industry: "Banking",
        },
        {
          company_name: "Resolved LLC",
          company_domain: "resolved.com",
          linkedin_url: "",
          source: "apify",
          source_context: "",
          employees: "",
          location: "",
          industry: "",
        },
      ],
    });

    expect(report.unresolved_candidates).toEqual([
      "Bank of the West (https://www.linkedin.com/company/bank-of-the-west/)",
    ]);
    expect(report.structural_ok).toBe(true);
    expect(report.notes.some((n) => n.includes("left as candidates"))).toBe(true);
  });
});
