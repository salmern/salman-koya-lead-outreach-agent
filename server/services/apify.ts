import "server-only";

import { ApifyClient, type ActorRun } from "apify-client";

import { config } from "@/server/config";
import type { DiscoveryCandidate } from "@/server/types";
import { deriveDiscoveryLocations } from "@/server/agent/discovery";
import { buildActorInput } from "@/server/services/apify-input";
import { toCandidates } from "@/server/services/apify-mapping";

/**
 * Apify is used ONLY for company discovery.
 *
 * Hard operating rules (see docs/apify-setup.md):
 *  - Uses the configured (team) API token.
 *  - Always sets a capped result limit — never runs uncapped.
 *  - The effective limit is the MIN of the requested value, the per-run limit,
 *    and the server maximum. The model cannot bypass this.
 *  - Structured filters are derived from the confirmed ICP geography (the user's
 *    objective is authoritative); a stale static `APIFY_ACTOR_INPUT` template
 *    can never pin the geography of every run.
 *  - Records the actor, run ID, limits, result count, status and usage.
 */

const POLL_INTERVAL_MS = 3_000;
const MAX_WAIT_SECS = 240;

export interface ApifyDiscoveryResult {
  actorId: string;
  runId: string | null;
  status: string;
  requestedMaxResults: number;
  effectiveMaxResults: number;
  resultCount: number;
  items: DiscoveryCandidate[];
  usageUsd: number | null;
  usage: Record<string, unknown>;
  errorMessage?: string;
}

export interface ApifyDiscoveryParams {
  searchQuery: string;
  requestedMaxResults: number;
  runLimit: number;
  /** Actor mode override ("short" | "full", default "full"). Full mode returns each
   *  company's real website + employee/location/industry fields in the same pass. */
  scraperMode?: "short" | "full";
  /** Refined ICP geography (raw strings from the run). Used to derive locations. */
  icpGeography?: string[];
  /** Agent-supplied actor-native filters — win over ICP-derived values. */
  filterOverrides?: {
    locations?: string[];
    companySize?: string[];
    industryIds?: string[];
  };
}

function envInt(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isNaN(v) ? fallback : v;
}

function readInputTemplate(): Record<string, unknown> {
  const raw = process.env.APIFY_ACTOR_INPUT;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Runs an Apify actor for company discovery. Enforces the result limit and a
 * bounded wait. Never throws on an expensive failure by itself — returns a
 * structured result with status/errorMessage so the caller decides.
 */
export async function runCompanyDiscovery(
  params: ApifyDiscoveryParams,
): Promise<ApifyDiscoveryResult> {
  const actorId = config.apifyActorId;
  const baseResult: ApifyDiscoveryResult = {
    actorId,
    runId: null,
    status: "not_started",
    requestedMaxResults: params.requestedMaxResults,
    effectiveMaxResults: 0,
    resultCount: 0,
    items: [],
    usageUsd: null,
    usage: {},
  };

  if (!config.apifyToken || !actorId) {
    return {
      ...baseResult,
      status: "error",
      errorMessage:
        "Apify is not configured. Set APIFY_API_TOKEN and APIFY_ACTOR_ID (team account) before running discovery.",
    };
  }

  // ---- Enforce the hard limit (model input can never exceed this) ----
  const effectiveMaxResults = Math.max(
    1,
    Math.min(params.requestedMaxResults, params.runLimit, config.serverMaxima.maxCandidates),
  );
  baseResult.effectiveMaxResults = effectiveMaxResults;

  const client = new ApifyClient({ token: config.apifyToken });

  const searchField = process.env.APIFY_ACTOR_SEARCH_FIELD ?? "query";
  const limitsField = process.env.APIFY_ACTOR_MAX_RESULTS_KEY ?? "maxResults";
  const derivedLocations = deriveDiscoveryLocations(params.icpGeography);
  const actorInput = buildActorInput({
    template: readInputTemplate(),
    searchField,
    limitsField,
    searchQuery: params.searchQuery,
    maxResults: effectiveMaxResults,
    scraperMode: params.scraperMode ?? "full",
    limitAliases: ["maxItems", "resultsPerSearch", "num"],
    icpLocations: derivedLocations.locations,
    icpIsGlobal: derivedLocations.isGlobal,
    overrideLocations: params.filterOverrides?.locations,
    overrideCompanySize: params.filterOverrides?.companySize,
    overrideIndustryIds: params.filterOverrides?.industryIds,
  });

  let startedRun: ActorRun;
  try {
    startedRun = await client.actor(actorId).start(actorInput);
  } catch (err) {
    return {
      ...baseResult,
      status: "error",
      errorMessage: `Failed to start Apify actor ${actorId}: ${errMessage(err)}`,
    };
  }

  const runId = startedRun.id;
  const startedAt = Date.now();

  // ---- Poll with a hard cap (configurable via MAX_APIFY_WAIT_SECS) ----
  const maxWaitMs = envInt("MAX_APIFY_WAIT_SECS", MAX_WAIT_SECS) * 1000;
  while (Date.now() - startedAt < maxWaitMs) {
    let runStatus: ActorRun | undefined;
    try {
      runStatus = await client.run(runId).get();
    } catch (err) {
      return {
        ...baseResult,
        runId,
        status: "error",
        errorMessage: `Failed to poll Apify run ${runId}: ${errMessage(err)}`,
      };
    }
    if (!runStatus) {
      return { ...baseResult, runId, status: "error", errorMessage: "Apify run disappeared." };
    }

    const status = runStatus.status ?? "UNKNOWN";
    if (status === "SUCCEEDED") {
      const datasetId = runStatus.defaultDatasetId;
      let items: Record<string, unknown>[] = [];
      if (datasetId) {
        try {
          const listed = await client.dataset(datasetId).listItems({ limit: effectiveMaxResults + 5 });
          items = (listed.items ?? []) as Record<string, unknown>[];
        } catch {
          items = [];
        }
      }
      return {
        ...baseResult,
        runId,
        status,
        resultCount: items.length,
        items: toCandidates(items).slice(0, effectiveMaxResults),
        usageUsd: typeof runStatus.usageTotalUsd === "number" ? runStatus.usageTotalUsd : null,
        usage: (runStatus.usage ?? {}) as Record<string, unknown>,
      };
    }

    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      return {
        ...baseResult,
        runId,
        status: status.toLowerCase(),
        resultCount: 0,
        items: [],
        usageUsd: typeof runStatus.usageTotalUsd === "number" ? runStatus.usageTotalUsd : null,
        usage: (runStatus.usage ?? {}) as Record<string, unknown>,
        errorMessage: `Apify run failed with status ${status}${runStatus.exitCode != null ? ` (exit ${runStatus.exitCode})` : ""}: ${runStatus.statusMessage ?? "no message"}`,
      };
    }

    await sleep(POLL_INTERVAL_MS);
  }

  // Timeout — advise aborting to stop spend.
  try {
    await client.run(runId).abort();
  } catch {
    // best effort
  }
  return {
    ...baseResult,
    runId,
    status: "timed-out",
    errorMessage:
      "Apify run exceeded the configured wait limit and was aborted. Inspect the run in the Apify Console.",
  };
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}