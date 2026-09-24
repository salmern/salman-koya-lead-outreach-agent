import { describe, expect, it } from "vitest";

import {
  canonicalDomain,
  candidateIdentityKey,
  linkedinCompanySlugFromUrl,
} from "@/lib/domains";

describe("canonicalDomain", () => {
  it("strips scheme, www, path, query and fragment", () => {
    expect(canonicalDomain("https://www.Acme.com/about?ref=x#top")).toBe("acme.com");
    expect(canonicalDomain("http://acme.com/pricing")).toBe("acme.com");
  });

  it("accepts a bare domain", () => {
    expect(canonicalDomain("bankofthewest.com")).toBe("bankofthewest.com");
    expect(canonicalDomain("ACME.com")).toBe("acme.com");
  });

  it("keeps non-www subdomains as part of the canonical host", () => {
    expect(canonicalDomain("https://careers.acme.com/jobs")).toBe("careers.acme.com");
  });

  it("returns empty for empty, garbage or dot-less inputs (never a fake domain)", () => {
    expect(canonicalDomain("")).toBe("");
    expect(canonicalDomain("https://")).toBe("");
    expect(canonicalDomain("second-talent")).toBe("");
    expect(canonicalDomain(null)).toBe("");
    expect(canonicalDomain(undefined)).toBe("");
  });
});

describe("linkedinCompanySlugFromUrl", () => {
  it("extracts the company slug", () => {
    expect(linkedinCompanySlugFromUrl("https://www.linkedin.com/company/bank-of-the-west/")).toBe(
      "bank-of-the-west",
    );
    expect(linkedinCompanySlugFromUrl("linkedin.com/company/acme")).toBe("acme");
  });

  it("returns empty for non-LinkedIn URLs", () => {
    expect(linkedinCompanySlugFromUrl("https://www.acme.com/about")).toBe("");
    expect(linkedinCompanySlugFromUrl("")).toBe("");
  });
});

describe("candidateIdentityKey", () => {
  it("prefers the canonical website domain over the LinkedIn slug", () => {
    const c = {
      company_domain: "https://acme.com",
      linkedin_url: "https://www.linkedin.com/company/acme/",
      company_name: "Acme",
    };
    expect(candidateIdentityKey(c)).toBe("d:acme.com");
  });

  it("falls back to the LinkedIn slug when there is no website domain", () => {
    const c = {
      company_domain: "",
      linkedin_url: "https://www.linkedin.com/company/Bank-of-the-West/",
      company_name: "Bank of the West",
    };
    expect(candidateIdentityKey(c)).toBe("l:bank-of-the-west");
  });

  it("falls back to the normalized name when no identity is available", () => {
    expect(candidateIdentityKey({ company_domain: "", linkedin_url: "", company_name: "  Acme   Inc " })).toBe(
      "n:acme inc",
    );
    expect(candidateIdentityKey({})).toBe("");
  });
});