import { describe, expect, it } from "vitest";

import { fallbackRefineIcp } from "@/server/agent/fallback-icp";
import { validateIcpOutput } from "@/server/agent/validation";
import { icpFromDraftInput, refinedIcpSchema } from "@/server/schemas";

/**
 * Scenario 1 — Vaguer qualification objective.
 * Scenario 2 — Specific qualification objective preserves hard filters.
 * The refinement output is exercised through the deterministic fallback, which
 * is what runs when ANTHROPIC_API_KEY is absent. The agent's live output passes
 * through the same refinedIcpSchema + validateIcpOutput contract.
 */
describe("ICP refinement (scenarios 1 & 2)", () => {
  it("produces a complete, schema-valid ICP for a vague objective", () => {
    const icp = fallbackRefineIcp("Find some companies that might need AI automation help.");

    expect(refinedIcpSchema.safeParse(icp).success).toBe(true);
    expect(icp.target_company_type.length).toBeGreaterThan(0);
    expect(icp.buyer_persona.length).toBeGreaterThan(0);
    expect(icp.business_problem.length).toBeGreaterThan(0);
    expect(icp.geography).toEqual(["Global"]);
    expect(icp.hard_filters.length).toBeGreaterThan(0);
    // No hard filter was invented from a vague request.
    expect(icp.hard_filters.join(" ")).toContain("Headcount within 10-100 employees");
  });

  it("preserves the hard filters from a specific objective", () => {
    const icp = fallbackRefineIcp(
      "Find 10 US B2B SaaS companies with 10 to 100 employees that may need AI automation support.",
    );

    expect(icp.geography).toContain("United States");
    expect(icp.headcount_range).toBe("10-100 employees");
    expect(icp.industries).toContain("B2B SaaS");
    const hard = icp.hard_filters.join(" ").toLowerCase();
    expect(hard).toContain("united states");
    expect(hard).toContain("10-100 employees");
    expect(hard).toContain("b2b");
    expect(validateIcpOutput(icp).ok).toBe(true);
  });

  it("rejects an ICP whose soft preference verbatim duplicates a hard filter", () => {
    const icp = fallbackRefineIcp("Find US B2B SaaS companies with 10 to 100 employees");
    const result = validateIcpOutput({
      ...icp,
      hard_filters: ["Located in United States"],
      soft_preferences: ["located in united states"],
    });
    expect(result.ok).toBe(false);
  });

  it("splits the manual ICP form input into a valid ICP", () => {
    const icp = icpFromDraftInput({
      target_company_type: "B2B SaaS",
      industries: "SaaS, Fintech",
      geography: "United States\nCanada",
      headcount_range: "10-100 employees",
      buyer_persona: "COO",
      business_problem: "Manual ops",
      hard_filters: "US only, 10-100 employees",
      soft_preferences: "Hiring ops staff",
      disqualifiers: "B2C only",
    });
    expect(icp.industries).toEqual(["SaaS", "Fintech"]);
    expect(icp.geography).toEqual(["United States", "Canada"]);
    expect(icp.hard_filters).toEqual(["US only", "10-100 employees"]);
    expect(refinedIcpSchema.safeParse(icp).success).toBe(true);
  });
});
