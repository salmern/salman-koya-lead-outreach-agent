import "server-only";

/**
 * Server-only runtime configuration.
 *
 * Secrets are read here on the server and never imported into client code.
 * All limits are clamped to safe server-side maxima so a bad model/bad request
 * cannot exceed them.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) return "";
  return value.trim();
}

function int(name: string, fallback: number, max: number, min = 1): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  if (Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(value, max));
}

const SERVER_MAX_CANDIDATES = 50;
const SERVER_MAX_WEBSITES = 30;
const SERVER_MAX_AGENT_TURNS = 120;
const SERVER_MAX_TOOL_CALLS = 200;
const SERVER_MAX_QUALIFIED_LEADS = 40;

// Total candidate budget for the run (the hard cap on the stored candidate pool).
const MAX_CANDIDATES = int("MAX_CANDIDATES_PER_RUN", 20, SERVER_MAX_CANDIDATES);
// How many results a single discovery search (one actor run) may request. This is
// deliberately separate from the total budget so the pool can be built up over
// several bounded searches. Defaults to at most 10 per search.
const MAX_BATCH = int("MAX_DISCOVERY_BATCH", Math.min(10, MAX_CANDIDATES), 25);

export const config = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  claudeModel: required("CLAUDE_MODEL") || undefined,
  apifyToken: required("APIFY_API_TOKEN"),
  apifyActorId: required("APIFY_ACTOR_ID"),
  firecrawlApiKey: required("FIRECRAWL_API_KEY"),
  limits: {
    maxCandidates: MAX_CANDIDATES,
    maxWebsites: int("MAX_WEBSITES_PER_RUN", 20, SERVER_MAX_WEBSITES),
    maxAgentTurns: int("MAX_AGENT_TURNS", 30, SERVER_MAX_AGENT_TURNS),
    maxToolCalls: int("MAX_TOOL_CALLS", 50, SERVER_MAX_TOOL_CALLS),
    maxQualifiedLeads: int(
      "MAX_QUALIFIED_LEADS",
      10,
      SERVER_MAX_QUALIFIED_LEADS,
    ),
    scrapeTimeoutMs: int("SCRAPE_TIMEOUT_MS", 25_000, 120_000),
    scrapeMaxResponseBytes: int(
      "SCRAPE_MAX_RESPONSE_BYTES",
      524_288,
      2_000_000,
    ),
  },
  // Bounded discovery (spend guard, not a per-run tool limit). Each attempt is a
  // new (capped) Apify run and still consumes a tool call.
  discoveryMaxAttempts: int("MAX_DISCOVERY_ATTEMPTS", 3, 5),
  // Results requested per discovery search (one actor run). A new search may be
  // run while the candidate pool is below the budget, so the cap on any single
  // search is independent of the total candidate budget.
  discoveryBatchSize: MAX_BATCH,
  // Website-resolution pass: at most one full-mode Apify run per discovery call,
  // resolving websites for at most this many short-mode candidates (never invented).
  resolutionMaxCandidates: int("MAX_RESOLUTION_CANDIDATES", 8, 25),
  // Actor mode used by company discovery. Full mode returns each company's real
  // website + employee/location/industry fields, so verified domains arrive with
  // the candidate. "short" is supported but leaves candidates website_pending.
  discoveryScraperMode: (process.env.APIFY_SCRAPER_MODE ?? "").toLowerCase() === "short" ? "short" : "full",
  serverMaxima: {
    maxCandidates: SERVER_MAX_CANDIDATES,
    maxWebsites: SERVER_MAX_WEBSITES,
    maxAgentTurns: SERVER_MAX_AGENT_TURNS,
    maxToolCalls: SERVER_MAX_TOOL_CALLS,
    maxQualifiedLeads: SERVER_MAX_QUALIFIED_LEADS,
  },
};

export function isExternalIntegrationConfigured(): {
  supabase: boolean;
  anthropic: boolean;
  apify: boolean;
  firecrawl: boolean;
} {
  return {
    supabase: Boolean(config.supabaseUrl && config.supabaseAnonKey),
    anthropic: Boolean(config.anthropicApiKey),
    apify: Boolean(config.apifyToken && config.apifyActorId),
    firecrawl: Boolean(config.firecrawlApiKey),
  };
}

type LimitKey = keyof typeof config.limits;

/**
 * Merges a run's optional per-run overrides with the server-configured
 * defaults, clamping every value to the server-enforced maxima. A run can only
 * make limits *stricter*, never higher.
 */
export function effectiveLimits(overrides: Partial<Record<LimitKey, number>> | null | undefined) {
  const result = { ...config.limits };
  if (!overrides) return result;
  for (const key of Object.keys(result) as LimitKey[]) {
    const override = overrides[key];
    if (typeof override !== "number" || Number.isNaN(override)) continue;
    const ceiling =
      key in config.serverMaxima
        ? config.serverMaxima[key as keyof typeof config.serverMaxima]
        : key === "scrapeTimeoutMs"
          ? 120_000
          : 2_000_000;
    result[key] = Math.max(1, Math.min(override, ceiling));
  }
  return result;
}