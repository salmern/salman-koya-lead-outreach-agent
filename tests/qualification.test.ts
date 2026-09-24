import { describe, expect, it } from "vitest";

import { validateQualificationOutput } from "@/server/agent/validation";

/**
 * Scenario 5 — Lead qualification.
 * A lead record can only be marked "qualified" when it carries the required
 * evidence: a confidence score, fit reasons, source URLs, and a substantive
 * source summary. Missing evidence is rejected, so nothing is stored as
 * qualified on the model's say-so alone.
 */
const validQualified = {
  company_name: "Acme Automation",
  company_domain: "acme.com",
  qualification_status: "qualified" as const,
  confidence: 0.82,
  fit_reasons: ["US B2B SaaS", "About 40 employees", "Ops team doing manual reporting"],
  concerns: ["No public pricing page"],
  source_urls: ["https://acme.com/about", "https://acme.com/careers"],
  source_summary:
    "Acme Automation is a US-based B2B SaaS company with roughly 40 employees and an operations team handling manual customer onboarding and weekly reporting.",
};

describe("lead qualification evidence contract (scenario 5)", () => {
  it("accepts a qualified lead with full evidence", () => {
    const result = validateQualificationOutput(validQualified);
    expect(result.ok).toBe(true);
  });

  it("rejects a qualified lead with no fit reasons", () => {
    const result = validateQualificationOutput({ ...validQualified, fit_reasons: [] });
    expect(result.ok).toBe(false);
  });

  it("rejects a qualified lead with no source URLs", () => {
    const result = validateQualificationOutput({ ...validQualified, source_urls: [] });
    expect(result.ok).toBe(false);
  });

  it("rejects a qualified lead with a thin source summary", () => {
    const result = validateQualificationOutput({ ...validQualified, source_summary: "Looks good." });
    expect(result.ok).toBe(false);
  });

  it("rejects a qualified lead below the confidence floor", () => {
    const result = validateQualificationOutput({ ...validQualified, confidence: 0.2 });
    expect(result.ok).toBe(false);
  });

  it("requires a bare company domain, not a URL or email", () => {
    expect(validateQualificationOutput({ ...validQualified, company_domain: "https://acme.com" }).ok).toBe(false);
    expect(validateQualificationOutput({ ...validQualified, company_domain: "hi@acme.com" }).ok).toBe(false);
  });

  it("allows a not_qualified lead but still requires a confidence score", () => {
    const result = validateQualificationOutput({
      ...validQualified,
      qualification_status: "not_qualified",
      confidence: 0.1,
      fit_reasons: [],
      source_summary: "Consumer-only mobile app with no business operations to automate.",
    });
    expect(result.ok).toBe(true);
  });
});
