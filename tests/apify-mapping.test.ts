import { describe, expect, it } from "vitest";

import { applyCandidateResolution, toCandidates } from "@/server/services/apify-mapping";
import { discoveryCandidateSchema } from "@/server/schemas";
import type { DiscoveryCandidate } from "@/server/types";

/**
 * Scenario 3 extension — Harvest `linkedin-company-search` short vs full mode.
 *
 * The contract regression under test: a LinkedIn identifier must never be
 * stored as the company's website domain, and short-mode records (no `website`,
 * no `employees`) must survive as candidates so a bounded full-mode resolution
 * pass can fill the real domain later. Nothing is ever fabricated.
 */

// Field shape observed directly from finished runs (short mode):
// id, universalName, linkedinUrl, name, industry, location:{linkedinText},
// followers, summary, logo, _meta
function shortModeItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "89719195",
    universalName: "second-talent",
    linkedinUrl: "https://www.linkedin.com/company/second-talent/",
    name: "Second Talent",
    industry: "Human Resources Services",
    location: { linkedinText: "United States" },
    followers: "71K followers",
    summary: "Hiring remote engineers is a trust problem.",
    logo: "https://media.licdn.com/dms/image/company-logo",
    _meta: { pagination: { totalResultCount: 1 } },
    ...overrides,
  };
}

describe("toCandidates (Harvest short-mode records)", () => {
  it("maps a short-mode record to one candidate: no website domain, LinkedIn identity only", () => {
    const candidates = toCandidates([shortModeItem()]);
    expect(candidates).toHaveLength(1);
    const c = candidates[0];
    expect(c.company_name).toBe("Second Talent");
    expect(c.company_domain).toBe("");
    expect(c.linkedin_url).toBe("https://www.linkedin.com/company/second-talent/");
    expect(c.industry).toBe("Human Resources Services");
    expect(c.location).toBe("United States");
    expect(c.employees).toBe("");
    expect(discoveryCandidateSchema.safeParse(c).success).toBe(true);
  });

  it("never stores a LinkedIn identifier as company_domain for two distinct records", () => {
    const a = shortModeItem({ id: "89719195", universalName: "second-talent" });
    const b = shortModeItem({
      id: "71522821",
      universalName: "exceptionly",
      name: "Exceptionly",
      linkedinUrl: "https://www.linkedin.com/company/exceptionly/",
    });
    const candidates = toCandidates([a, b]);
    expect(candidates).toHaveLength(2);
    expect(candidates.every((c) => c.company_domain === "")).toBe(true);
    expect(candidates.some((c) => c.company_domain?.startsWith("linkedin-"))).toBe(false);
    expect(new Set(candidates.map((c) => c.linkedin_url)).size).toBe(2);
  });

  it("derives the real website domain from full-mode website and keeps the LinkedIn URL", () => {
    const candidates = toCandidates([
      shortModeItem({
        universalName: "acme",
        name: "Acme",
        website: "https://www.acme.com/about",
      }),
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].company_domain).toBe("acme.com");
    expect(candidates[0].linkedin_url).toBe("https://www.linkedin.com/company/second-talent/");
  });

  it("maps company size from full-mode employee fields (string or number)", () => {
    const withRange = toCandidates([shortModeItem({ employeeCountRange: ["51", "200"] })]);
    expect(withRange[0].employees).toBe("51, 200");
    const withCount = toCandidates([shortModeItem({ employeeCount: 120 })]);
    expect(withCount[0].employees).toBe("120");
  });

  it("treats a linkedin-url present in url/link as a LinkedIn identity, not a web domain", () => {
    const candidates = toCandidates([
      shortModeItem({
        linkedinUrl: "",
        url: "https://www.linkedin.com/company/pubgenius/",
        universalName: "pubgenius",
      }),
    ]);
    expect(candidates[0].company_domain).toBe("");
    expect(candidates[0].linkedin_url).toBe("https://www.linkedin.com/company/pubgenius/");
  });

  it("handles a plain-string location and array locations", () => {
    const stringLoc = toCandidates([shortModeItem({ location: "Delaware City, Delaware" })]);
    expect(stringLoc[0].location).toBe("Delaware City, Delaware");
    const arrayLoc = toCandidates([shortModeItem({ location: ["Canada", "US"] })]);
    expect(arrayLoc[0].location).toBe("Canada, US");
  });

  it("reads full-mode locations[] objects via parsed.text", () => {
    const candidates = toCandidates([
      shortModeItem({
        locations: [
          { parsed: { text: "San Francisco Bay Area", country: "US", city: "San Francisco" } },
          { country: "UK", city: "London" },
        ],
      }),
    ]);
    expect(candidates[0].location).toBe("San Francisco Bay Area; London, UK");
  });

  it("skips records with only a name (no website, no LinkedIn identity) — no fabrication", () => {
    const candidates = toCandidates([{ name: "Ghost" }]);
    expect(candidates).toHaveLength(0);
  });

  it("still maps generic url/link-only records and stays schema-valid", () => {
    const candidates = toCandidates([{ title: "Acme Ltd", url: "//acme.com", industry: "Software" }]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].company_domain).toBe("acme.com");
    expect(candidates[0].linkedin_url).toBe("");
    const parsed = discoveryCandidateSchema.safeParse(candidates[0]);
    expect(parsed.success).toBe(true);
  });
});

describe("applyCandidateResolution (full-mode website fill)", () => {
  function shortCandidate(overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
    return {
      company_name: "Second Talent",
      company_domain: "",
      linkedin_url: "https://www.linkedin.com/company/second-talent/",
      source: "apify",
      source_context: "Hiring remote engineers is a trust problem.",
      employees: "",
      location: "United States",
      industry: "",
      ...overrides,
    };
  }

  it("fills the empty website domain + employees from the matched full-mode record (by slug)", () => {
    const candidates = [shortCandidate()];
    const full = toCandidates([
      {
        name: "Second Talent",
        universalName: "second-talent",
        linkedinUrl: "https://www.linkedin.com/company/second-talent/",
        website: "https://secondtalent.com",
        employeeCountRange: ["51", "200"],
        industry: "Recruiting",
        description: "Full description.",
      },
    ]);
    const enriched = applyCandidateResolution(candidates, full);
    expect(enriched[0].company_domain).toBe("secondtalent.com");
    expect(enriched[0].employees).toBe("51, 200");
    expect(enriched[0].industry).toBe("Recruiting");
    expect(enriched[0].linkedin_url).toBe("https://www.linkedin.com/company/second-talent/");
  });

  it("matches by normalized name when the candidate has no LinkedIn URL", () => {
    const candidates = [shortCandidate({ company_domain: "", linkedin_url: "", company_name: "Acme Ltd" })];
    const full = toCandidates([
      { title: "ACME LTD", website: "https://acme.com", linkedinUrl: "https://www.linkedin.com/company/acme-ltd/" },
    ]);
    const enriched = applyCandidateResolution(candidates, full);
    expect(enriched[0].company_domain).toBe("acme.com");
  });

  it("keeps a candidate unchanged when nothing matches (never invents a domain)", () => {
    const candidates = [shortCandidate({ company_name: "Unresolvable Corp" })];
    const full = toCandidates([{ name: "Something Else", website: "https://else.com" }]);
    const enriched = applyCandidateResolution(candidates, full);
    expect(enriched[0].company_domain).toBe("");
  });

  it("keeps a candidate unresolved when the full-mode website is null", () => {
    const candidates = [shortCandidate()];
    const full = toCandidates([{ name: "Second Talent", universalName: "second-talent", website: null }]);
    const enriched = applyCandidateResolution(candidates, full);
    expect(enriched[0].company_domain).toBe(""); // website:null is not treated as evidence
  });
});