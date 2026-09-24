import { canonicalDomain, linkedinCompanySlugFromUrl } from "@/lib/domains";
import type { DiscoveryCandidate } from "@/server/types";

/**
 * Maps raw Apify dataset records into internal DiscoveryCandidates.
 *
 * Harvest's `harvestapi/linkedin-company-search` actor has two modes:
 *  - "short": id, universalName, linkedinUrl, name, industry,
 *              location: { linkedinText }, followers, summary, logo, _meta
 *              (NO website URL and NO company-size field).
 *  - "full":  as above plus website (may be null), employeeCount /
 *              employeeCountRange, description, locations[], industries[],
 *              tagline, foundedOn, followerCount, specialities.
 *
 * Discovery runs in full mode by default so `website` — the company's real
 * public website as recorded by Harvest/LinkedIn — arrives with the candidate.
 * Mapping rules (never break these):
 *  - company_domain is the REAL website host and is "" when the record has no
 *    website (including website: null). A LinkedIn identifier is NEVER stored
 *    as a website domain — the LinkedIn company page lives in linkedin_url.
 *  - records without a website stay candidates in "website_pending" state;
 *    they are never given an invented or guessed domain.
 *  - records with neither a website nor a LinkedIn identity are skipped —
 *    nothing is ever fabricated.
 */

export function firstString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const parts = value
      .map(firstString)
      .filter((s) => s && s !== "null" && s !== "undefined");
    return [...new Set(parts)].join(", ");
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["linkedinText", "text", "name", "title", "label", "value"]) {
      if (key in obj) {
        const inner = firstString(obj[key]);
        if (inner) return inner;
      }
    }
    for (const inner of Object.values(obj)) {
      const s = firstString(inner);
      if (s) return s;
    }
    return "";
  }
  return "";
}

/** Human-readable location from full-mode locations[] objects or plain values. */
export function locationText(value: unknown): string {
  const list: unknown[] = Array.isArray(value) ? value : value != null ? [value] : [];
  const isPlain = list.every((x) => typeof x === "string" || typeof x === "number");
  const parts: string[] = [];
  for (const loc of list) {
    if (!loc || typeof loc !== "object") {
      const s = firstString(loc);
      if (s) parts.push(s);
      continue;
    }
    const o = loc as Record<string, unknown>;
    const parsed = o.parsed as Record<string, unknown> | undefined;
    if (parsed && typeof parsed === "object") {
      const parsedText = firstString(parsed.text);
      if (parsedText) {
        parts.push(parsedText);
        continue;
      }
    }
    const combined = [firstString(o.city), firstString(o.country)].filter(Boolean).join(", ");
    if (combined) {
      parts.push(combined);
      continue;
    }
    const direct = firstString(loc);
    if (direct) parts.push(direct);
  }
  return [...new Set(parts)].join(isPlain ? ", " : "; ");
}

function isLinkedInHost(value: string): boolean {
  return canonicalDomain(value) === "linkedin.com";
}

/** LinkedIn company URL, falling back to a deterministic URL from universalName when the API omitted it. */
function resolveLinkedInUrl(item: Record<string, unknown>, website: string, websiteIsLinkedIn: boolean): string {
  const explicit = firstString(item.linkedinUrl || item.linkedin);
  if (explicit) return explicit;
  if (website && websiteIsLinkedIn) return website;
  const universalName = firstString(item.universalName);
  if (universalName && /^[\w.-]+$/.test(universalName)) {
    return `https://www.linkedin.com/company/${universalName}/`;
  }
  return "";
}

/**
 * Enriches existing candidates with website domains (and other fields) that
 * arrived in a full-mode Apify pass. This is a FILL-ONLY operation — it never
 * adds new candidates to the pool and never invents a domain.
 *
 * Match priority mirrors mergeCandidates in discovery.ts:
 *   canonical website domain > LinkedIn slug > normalized name.
 *
 * A full-mode record whose website field is null/empty is ignored for that
 * candidate — the candidate stays unresolved rather than receiving a blank domain.
 */
export function applyCandidateResolution(
  existing: DiscoveryCandidate[],
  fullModeItems: DiscoveryCandidate[],
): DiscoveryCandidate[] {
  if (existing.length === 0 || fullModeItems.length === 0) return existing;

  // Build lookup indexes over the full-mode items.
  const byDomain = new Map<string, DiscoveryCandidate>();
  const bySlug = new Map<string, DiscoveryCandidate>();
  const byName = new Map<string, DiscoveryCandidate>();
  for (const item of fullModeItems) {
    const domain = canonicalDomain(item.company_domain);
    if (domain && !byDomain.has(domain)) byDomain.set(domain, item);
    const slug = linkedinCompanySlugFromUrl(item.linkedin_url);
    if (slug && !bySlug.has(slug.toLowerCase())) bySlug.set(slug.toLowerCase(), item);
    const name = normalizeName(item.company_name);
    if (name && !byName.has(name)) byName.set(name, item);
  }

  return existing.map((candidate) => {
    // Already resolved — nothing to do.
    if (candidate.company_domain) return candidate;

    // Find the best matching full-mode record.
    let match: DiscoveryCandidate | undefined;

    const existingDomain = canonicalDomain(candidate.company_domain);
    if (existingDomain) match = byDomain.get(existingDomain);

    if (!match) {
      const slug = linkedinCompanySlugFromUrl(candidate.linkedin_url);
      if (slug) match = bySlug.get(slug.toLowerCase());
    }

    if (!match) {
      const name = normalizeName(candidate.company_name);
      if (name) match = byName.get(name);
    }

    if (!match) return candidate; // No match — never fabricate.

    // Only enrich with fields the full-mode record actually has.
    return {
      company_name: candidate.company_name || match.company_name,
      company_domain: match.company_domain || candidate.company_domain,
      linkedin_url: candidate.linkedin_url || match.linkedin_url,
      source: candidate.source || match.source,
      source_context: candidate.source_context || match.source_context,
      employees: candidate.employees || match.employees,
      location: candidate.location || match.location,
      industry: candidate.industry || match.industry,
    };
  });
}

function normalizeName(name: string): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function toCandidates(items: Record<string, unknown>[]): DiscoveryCandidate[] {
  const candidates: DiscoveryCandidate[] = [];
  for (const item of items) {
    const website = firstString(item.website || item.websiteUrl || item.url || item.link);
    const websiteIsLinkedIn = website !== "" && isLinkedInHost(website);
    const websiteCandidate = website && !isLinkedInHost(website) ? website : "";

    const company_domain = websiteCandidate ? canonicalDomain(websiteCandidate) : "";
    const linkedin_url = resolveLinkedInUrl(item, website, websiteIsLinkedIn);

    const company_name = firstString(item.companyName || item.title || item.name);
    if (!company_name || (!company_domain && !linkedin_url)) continue;

    candidates.push({
      company_name,
      company_domain,
      linkedin_url,
      source: "apify",
      source_context: firstString(
        item.summary || item.description || item.tagline || item.text || item.snippet,
      ),
      employees: firstString(
        item.employeeCountRange || item.employeeCount || item.employees || item.companySize,
      ),
      location: locationText(item.locations || item.location),
      industry: firstString(item.industries || item.industry),
    });
  }
  return candidates;
}