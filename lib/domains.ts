import { normalizeDomain } from "@/lib/utils";

/**
 * Pure domain / identity helpers shared by the mapping, dedupe, scrape
 * authorization and lead-matching code paths.
 *
 * The rule behind them: a company's WEB DOMAIN is a real, dotted website host
 * (e.g. `acme.com`) and is never derived from its LinkedIn identifier. A
 * LinkedIn company page is a separate piece of identity carried in
 * `linkedin_url`, never disguised as a website.
 */

/** Canonical bare host from a URL or bare domain. Strips scheme, path, query, fragment and a leading `www.`. Empty when unparseable or not a real host (no dot). */
export function canonicalDomain(input: string | null | undefined): string {
  if (!input) return "";
  let value = input.trim();
  if (!value) return "";
  let host = "";
  try {
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`;
    host = new URL(value).hostname;
  } catch {
    host = value.split("/")[0] ?? "";
  }
  const normalized = normalizeDomain(host);
  return normalized.includes(".") ? normalized : "";
}

/** Extracts the company slug from a LinkedIn company URL, or "" when absent. */
export function linkedinCompanySlugFromUrl(url: string | null | undefined): string {
  if (!url) return "";
  const match = /linkedin\.com\/[^/]*company\/([^/?#]+)/i.exec(url);
  const raw = match?.[1] ?? "";
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export interface IdentityCandidate {
  company_domain?: string;
  linkedin_url?: string;
  company_name?: string;
}

/**
 * Stable key used to decide whether two candidates are the same company.
 * Priority: canonical website domain > LinkedIn slug > normalized name.
 * Never falls back to a LinkedIn vocabulary as a domain.
 */
export function candidateIdentityKey(candidate: IdentityCandidate): string {
  const domain = canonicalDomain(candidate.company_domain);
  if (domain) return `d:${domain}`;
  const slug = linkedinCompanySlugFromUrl(candidate.linkedin_url);
  if (slug) return `l:${slug.toLowerCase()}`;
  const name = (candidate.company_name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return name ? `n:${name}` : "";
}