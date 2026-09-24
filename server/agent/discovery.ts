import { canonicalDomain, candidateIdentityKey, linkedinCompanySlugFromUrl } from "@/lib/domains";
import type { DiscoveryCandidate } from "@/server/types";

const COUNTRY_ALIASES: Record<string, string> = {
  us: "United States",
  usa: "United States",
  "u.s": "United States",
  "u.s.a": "United States",
  "united states": "United States",
  uk: "United Kingdom",
  gb: "United Kingdom",
  "great britain": "United Kingdom",
  "united kingdom": "United Kingdom",
  uae: "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
  holland: "Netherlands",
};

// Region-level terms are NOT valid LinkedIn location filters and are never sent
// as a hard location pin (they stay in the search query instead).
const REGION_ONLY_RE =
  /^(global|worldwide|international|anywhere|everywhere|remote|europe|eu|european union|asia|apac|east asia|south east asia|north america|south america|latin america|emea|africa|middle east|mena|all countries)$/i;

const MAX_DERIVED_LOCATIONS = 12;

export interface DerivedDiscoveryLocations {
  /** Concrete country/location filters to send to the actor (empty when global). */
  locations: string[];
  /** True when the ICP geography is global/remote/empty, so no location pin is sent. */
  isGlobal: boolean;
}

/**
 * Derives actor location filters from the refined ICP geography. The user's
 * objective (via the confirmed ICP) is authoritative: a static template geo can
 * never override it, and a global ICP never pins any location.
 */
export function deriveDiscoveryLocations(
  geography: string[] | null | undefined,
): DerivedDiscoveryLocations {
  const entries = (geography ?? []).map((g) => g.trim()).filter(Boolean);
  if (entries.length === 0) return { locations: [], isGlobal: true };

  const locations: string[] = [];
  let sawConcrete = false;
  for (const raw of entries) {
    if (REGION_ONLY_RE.test(raw)) continue;
    sawConcrete = true;
    const mapped = COUNTRY_ALIASES[raw.toLowerCase()] ?? raw;
    if (!locations.includes(mapped)) locations.push(mapped);
    if (locations.length >= MAX_DERIVED_LOCATIONS) break;
  }

  if (!sawConcrete) return { locations: [], isGlobal: true };
  return { locations, isGlobal: false };
}

/**
 * Merges newly discovered candidates into the existing pool and never exceeds
 * the run's hard candidate limit. Pure and side-effect free so the limit
 * behaviour is unit-testable.
 *
 * Duplicate identity priority (candidateIdentityKey): canonical website domain
 * > LinkedIn slug > normalized name. When an incoming candidate matches an
 * existing one it ENRICHES it instead of adding a second row — this is how a
 * later full-mode record supplies the website domain for a short-mode
 * candidate that lacked one, without ever storing a LinkedIn identifier as a
 * domain.
 */
export function mergeCandidates(
  existing: DiscoveryCandidate[],
  incoming: DiscoveryCandidate[],
  limit: number,
): DiscoveryCandidate[] {
  const merged = [...existing];

  // Identity lookups for the existing pool: exact identity key, then
  // secondary matches (canonical domain, LinkedIn slug, normalized name).
  const byKey = new Map<string, number>();
  const byDomain = new Map<string, number>();
  const bySlug = new Map<string, number>();
  const byName = new Map<string, number>();
  merged.forEach((candidate, i) => {
    const key = candidateIdentityKey(candidate);
    if (key && !byKey.has(key)) byKey.set(key, i);
    const domain = canonicalDomain(candidate.company_domain);
    if (domain && !byDomain.has(domain)) byDomain.set(domain, i);
    const slug = linkedinCompanySlugFromUrl(candidate.linkedin_url);
    if (slug && !bySlug.has(slug.toLowerCase())) bySlug.set(slug.toLowerCase(), i);
    const name = nameNormalized(candidate.company_name);
    if (name && !byName.has(name)) byName.set(name, i);
  });

  for (const candidate of incoming) {
    if (merged.length >= limit) break;
    const key = candidateIdentityKey(candidate);
    if (!key) continue;

    // Match priority: exact identity key > canonical website domain > LinkedIn
    // slug > normalized name. This is what lets a full-mode record (which now
    // carries a website domain) enrich a short-mode candidate that only had a
    // LinkedIn slug — instead of creating a duplicate.
    let slot = byKey.get(key);
    if (slot == null && candidate.company_domain) {
      slot = byDomain.get(canonicalDomain(candidate.company_domain));
    }
    if (slot == null) {
      const slug = linkedinCompanySlugFromUrl(candidate.linkedin_url);
      if (slug) slot = bySlug.get(slug.toLowerCase());
    }
    if (slot == null) {
      const name = nameNormalized(candidate.company_name);
      if (name) slot = byName.get(name);
    }

    if (slot != null && slot >= 0 && slot < merged.length) {
      merged[slot] = enrichCandidate(merged[slot], candidate);
      rebind(merged[slot], slot, byKey, byDomain, bySlug, byName);
      continue;
    }

    merged.push(candidate);
    rebind(candidate, merged.length - 1, byKey, byDomain, bySlug, byName);
  }
  return merged;
}

function nameNormalized(name: string): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Points every identity index of `candidate` at `slot`. */
function rebind(
  candidate: DiscoveryCandidate,
  slot: number,
  byKey: Map<string, number>,
  byDomain: Map<string, number>,
  bySlug: Map<string, number>,
  byName: Map<string, number>,
): void {
  const key = candidateIdentityKey(candidate);
  if (key && !byKey.has(key)) byKey.set(key, slot);
  const domain = canonicalDomain(candidate.company_domain);
  if (domain && !byDomain.has(domain)) byDomain.set(domain, slot);
  const slug = linkedinCompanySlugFromUrl(candidate.linkedin_url);
  if (slug && !bySlug.has(slug.toLowerCase())) bySlug.set(slug.toLowerCase(), slot);
  const name = nameNormalized(candidate.company_name);
  if (name && !byName.has(name)) byName.set(name, slot);
}

/** Fills empty fields on the existing candidate with the richer incoming one. */
function enrichCandidate(
  existing: DiscoveryCandidate,
  incoming: DiscoveryCandidate,
): DiscoveryCandidate {
  return {
    company_name: existing.company_name || incoming.company_name,
    company_domain: existing.company_domain || incoming.company_domain,
    linkedin_url: existing.linkedin_url || incoming.linkedin_url,
    source: existing.source || incoming.source,
    source_context: existing.source_context || incoming.source_context,
    employees: existing.employees || incoming.employees,
    location: existing.location || incoming.location,
    industry: existing.industry || incoming.industry,
  };
}