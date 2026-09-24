import { describe, expect, it } from "vitest";

import { deriveDiscoveryLocations, mergeCandidates } from "@/server/agent/discovery";
import { discoveryCandidateSchema } from "@/server/schemas";
import type { DiscoveryCandidate } from "@/server/types";

/**
 * Scenario 3 — Company discovery.
 * The agent must respect the lead-count limit; the limit is enforced by the
 * tool (mergeCandidates) rather than trusted to the model. Apify itself is
 * called with the same cap inside server/services/apify.ts.
 *
 * De-duplication identity priority: canonical website domain > LinkedIn slug >
 * normalized name. A later richer record ENRICHES an existing candidate instead
 * of creating a duplicate — this is how a full-mode record supplies the website
 * domain for a short-mode candidate.
 */
function candidate(
  company_domain: string,
  name = company_domain,
  overrides: Partial<DiscoveryCandidate> = {},
): DiscoveryCandidate {
  return {
    company_name: name,
    company_domain,
    linkedin_url: "",
    source: "apify",
    source_context: "",
    employees: "",
    location: "",
    industry: "",
    ...overrides,
  };
}

function linkedinCandidate(slug: string, name: string): DiscoveryCandidate {
  return candidate("", name, { linkedin_url: `https://www.linkedin.com/company/${slug}/` });
}

describe("company discovery limit + de-duplication (scenario 3)", () => {
  it("never returns more candidates than the run limit", () => {
    const merged = mergeCandidates([], [candidate("a.com"), candidate("b.com"), candidate("c.com")], 2);
    expect(merged).toHaveLength(2);
    expect(merged.map((c) => c.company_domain)).toEqual(["a.com", "b.com"]);
  });

  it("respects the limit when merging into an existing pool", () => {
    const merged = mergeCandidates([candidate("a.com")], [candidate("b.com"), candidate("c.com")], 2);
    expect(merged).toHaveLength(2);
  });

  it("de-duplicates by canonical website domain (scheme, www, path, query)", () => {
    const merged = mergeCandidates(
      [candidate("https://www.Acme.com/", "Acme")],
      [candidate("acme.com", "Acme Online"), candidate("ACME.com/pricing?ref=x", "Acme Pricing"), candidate("other.com")],
      10,
    );
    expect(merged).toHaveLength(2);
    expect(merged.map((c) => c.company_domain)).toEqual(["https://www.Acme.com/", "other.com"]);
  });

  it("enriches an existing LinkedIn-only candidate with the full-mode website instead of duplicating", () => {
    const short = linkedinCandidate("second-talent", "Second Talent");
    const full = candidate("secondtalent.com", "Second Talent", {
      linkedin_url: "https://www.linkedin.com/company/second-talent/",
      employees: "51-200",
    });
    const merged = mergeCandidates([short], [full], 10);
    expect(merged).toHaveLength(1);
    expect(merged[0].company_domain).toBe("secondtalent.com");
    expect(merged[0].employees).toBe("51-200");
  });

  it("de-duplicates two LinkedIn-only candidates sharing the same slug", () => {
    const merged = mergeCandidates(
      [linkedinCandidate("acme", "Acme")],
      [linkedinCandidate("acme", "ACME")],
      10,
    );
    expect(merged).toHaveLength(1);
  });

  it("de-duplicates by normalized name when neither domain nor LinkedIn URL is known", () => {
    const a = candidate("", "Acme Inc");
    const b = candidate("", "acme inc");
    const merged = mergeCandidates([a], [b], 10);
    expect(merged).toHaveLength(1);
  });

  it("ignores incoming candidates with no usable identity (no fabrication)", () => {
    const ghost = candidate("", "");
    const ok = candidate("https://ok.com/", "Ok");
    const merged = mergeCandidates([], [ghost, ok], 10);
    expect(merged).toHaveLength(1);
  });

  it("accepts the candidate shape used by the discovery tool", () => {
    const parsed = discoveryCandidateSchema.safeParse(candidate("acme.com"));
    expect(parsed.success).toBe(true);
  });
});

describe("deriveDiscoveryLocations (ICP geography -> actor location filters)", () => {
  it("maps a UK/Europe ICP to a concrete UK filter and skips the region level", () => {
    const derived = deriveDiscoveryLocations(["United Kingdom", "Europe"]);
    expect(derived.locations).toEqual(["United Kingdom"]);
    expect(derived.isGlobal).toBe(false);
  });

  it("maps common country aliases to canonical LinkedIn-style names", () => {
    const derived = deriveDiscoveryLocations(["US", "UK", "uae"]);
    expect(derived.locations).toEqual(["United States", "United Kingdom", "United Arab Emirates"]);
    expect(derived.isGlobal).toBe(false);
  });

  it("passes through unrecognised concrete countries verbatim", () => {
    const derived = deriveDiscoveryLocations(["Germany", "Nigeria"]);
    expect(derived.locations).toEqual(["Germany", "Nigeria"]);
    expect(derived.isGlobal).toBe(false);
  });

  it("treats a global/remote ICP as unconstrained (no location pin)", () => {
    expect(deriveDiscoveryLocations(["Global"]).isGlobal).toBe(true);
    expect(deriveDiscoveryLocations(["Remote", "Anywhere"]).isGlobal).toBe(true);
    expect(deriveDiscoveryLocations(["EU"]).locations).toEqual([]);
  });

  it("treats an empty or missing geography as global", () => {
    expect(deriveDiscoveryLocations(undefined).isGlobal).toBe(true);
    expect(deriveDiscoveryLocations([]).isGlobal).toBe(true);
    expect(deriveDiscoveryLocations([]).locations).toEqual([]);
  });

  it("de-duplicates and caps the derived location list", () => {
    const many = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? "Germany" : `Country ${i}`));
    const derived = deriveDiscoveryLocations(many);
    expect(new Set(derived.locations).size).toBe(derived.locations.length);
    expect(derived.locations.length).toBeLessThanOrEqual(12);
  });
});