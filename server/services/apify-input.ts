/**
 * Pure helpers for building the Apify actor input.
 *
 * Deliberately server-only-free so the merge and precedence logic is fully
 * unit-testable. The merge rules prevent a stale static config (e.g.
 * `APIFY_ACTOR_INPUT` with `locations: ["United States"]`) from pinning the
 * geography of every run:
 *
 *  - locations:   agent-provided override > ICP-derived > dropped (no geo pin).
 *  - companySize / industryIds: only ever set when the agent supplies
 *    actor-native values it can stand behind; the template never pins them.
 *  - result limits: the configured limit and every known alias are forced to
 *    the server-capped value, so the template cannot smuggle a bigger cap.
 */

export interface BuildActorInputParams {
  /** Static/operational actor fields from APIFY_ACTOR_INPUT (scraperMode, startPage, takePages, ...). */
  template: Record<string, unknown>;
  /** Actor field that receives the search query (APIFY_ACTOR_SEARCH_FIELD). */
  searchField: string;
  /** Actor field that receives the capped result limit (APIFY_ACTOR_MAX_RESULTS_KEY). */
  limitsField: string;
  searchQuery: string;
  /** Server-capped result limit — every limit field/alias is forced to this. */
  maxResults: number;
  /** Explicit actor mode override ("short" | "full"). Wins over the template. */
  scraperMode?: string;
  /** Extra known result-limit aliases (maxItems, resultsPerSearch, num, ...). */
  limitAliases?: string[];
  /** Locations derived from the confirmed ICP geography. */
  icpLocations?: string[];
  /** True when the ICP geography is global/remote/empty and must not pin a location. */
  icpIsGlobal?: boolean;
  /** Agent-supplied actor-native filters — they win over derived values. */
  overrideLocations?: string[];
  overrideCompanySize?: string[];
  overrideIndustryIds?: string[];
}

export function buildActorInput(params: BuildActorInputParams): Record<string, unknown> {
  const input = { ...params.template };

  if (params.scraperMode) input.scraperMode = params.scraperMode;

  input[params.searchField] = params.searchQuery;
  input[params.limitsField] = params.maxResults;
  for (const alias of params.limitAliases ?? []) {
    input[alias] = params.maxResults;
  }

  if (params.overrideLocations && params.overrideLocations.length > 0) {
    input.locations = params.overrideLocations;
  } else if (params.icpIsGlobal || !params.icpLocations || params.icpLocations.length === 0) {
    delete input.locations;
  } else {
    input.locations = params.icpLocations;
  }

  if (params.overrideCompanySize && params.overrideCompanySize.length > 0) {
    input.companySize = params.overrideCompanySize;
  } else {
    delete input.companySize;
  }

  if (params.overrideIndustryIds && params.overrideIndustryIds.length > 0) {
    input.industryIds = params.overrideIndustryIds;
  } else {
    delete input.industryIds;
  }

  return input;
}