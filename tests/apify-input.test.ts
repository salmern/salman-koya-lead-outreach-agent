import { describe, expect, it } from "vitest";

import { buildActorInput } from "@/server/services/apify-input";

/**
 * Discovery actor-input build rules (scenario 3 extension — zero-result / config bug).
 * The input template must never pin geography for every run, and the result cap
 * must always survive no matter what the template tries to set.
 */
describe("buildActorInput (Apify actor input merge)", () => {
  it("writes the search query and the capped limit to the configured fields", () => {
    const input = buildActorInput({
      template: {},
      searchField: "searchQuery",
      limitsField: "maxItems",
      searchQuery: "D2C e-commerce UK",
      maxResults: 2,
      limitAliases: ["resultsPerSearch", "num"],
    });
    expect(input.searchQuery).toBe("D2C e-commerce UK");
    expect(input.maxItems).toBe(2);
    expect(input.resultsPerSearch).toBe(2);
    expect(input.num).toBe(2);
  });

  it("forces known limit aliases even when the template tries to raise them", () => {
    const input = buildActorInput({
      template: { maxItems: 1000, resultsPerSearch: 500 },
      searchField: "searchQuery",
      limitsField: "maxItems",
      searchQuery: "e-com",
      maxResults: 2,
      limitAliases: ["maxItems", "resultsPerSearch", "num"],
    });
    expect(input.maxItems).toBe(2);
    expect(input.resultsPerSearch).toBe(2);
    expect(input.num).toBe(2);
  });

  it("derived ICP locations override a stale template geo (e.g. US pin for a UK objective)", () => {
    const input = buildActorInput({
      template: { scraperMode: "short", locations: ["United States"] },
      searchField: "searchQuery",
      limitsField: "maxItems",
      searchQuery: "uk",
      maxResults: 2,
      icpLocations: ["United Kingdom"],
      icpIsGlobal: false,
    });
    expect(input.locations).toEqual(["United Kingdom"]);
    expect(input.scraperMode).toBe("short");
  });

  it("a global ICP sends no location filter at all", () => {
    const input = buildActorInput({
      template: { locations: ["United States"] },
      searchField: "searchQuery",
      limitsField: "maxItems",
      searchQuery: "saas",
      maxResults: 2,
      icpLocations: [],
      icpIsGlobal: true,
    });
    expect("locations" in input).toBe(false);
  });

  it("an empty ICP geography never pins a location", () => {
    const input = buildActorInput({
      template: {},
      searchField: "searchQuery",
      limitsField: "maxItems",
      searchQuery: "saas",
      maxResults: 2,
    });
    expect("locations" in input).toBe(false);
  });

  it("agent-supplied locations win over ICP-derived ones", () => {
    const input = buildActorInput({
      template: { locations: ["United States"] },
      searchField: "searchQuery",
      limitsField: "maxItems",
      searchQuery: "x",
      maxResults: 2,
      icpLocations: ["United Kingdom"],
      icpIsGlobal: false,
      overrideLocations: ["Germany"],
    });
    expect(input.locations).toEqual(["Germany"]);
  });

  it("companySize and industryIds are only passed when the agent supplies them", () => {
    const bare = buildActorInput({
      template: { companySize: ["B"], industryIds: ["96"] },
      searchField: "searchQuery",
      limitsField: "maxItems",
      searchQuery: "x",
      maxResults: 2,
    });
    expect("companySize" in bare).toBe(false);
    expect("industryIds" in bare).toBe(false);

    const withOverrides = buildActorInput({
      template: {},
      searchField: "searchQuery",
      limitsField: "maxItems",
      searchQuery: "x",
      maxResults: 2,
      overrideCompanySize: ["B"],
      overrideIndustryIds: ["96"],
    });
    expect(withOverrides.companySize).toEqual(["B"]);
    expect(withOverrides.industryIds).toEqual(["96"]);
  });

  it("preserves unrelated operational template fields", () => {
    const input = buildActorInput({
      template: { scraperMode: "full", startPage: 1, takePages: 2 },
      searchField: "searchQuery",
      limitsField: "maxItems",
      searchQuery: "x",
      maxResults: 2,
      icpLocations: ["United Kingdom"],
      icpIsGlobal: false,
    });
    expect(input.scraperMode).toBe("full");
    expect(input.startPage).toBe(1);
    expect(input.takePages).toBe(2);
  });
});