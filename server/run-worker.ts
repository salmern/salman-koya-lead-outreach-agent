import "server-only";

import { isExternalIntegrationConfigured } from "@/server/config";
import {
  getQueuedRuns,
  getRunStatus,
  listStuckRunIds,
  transitionRunStatus,
  updateRun,
} from "@/server/db";
import { runResearchPhase } from "@/server/agent/runner";
import { runQualityCheck } from "@/server/quality-check";
import { logEvent } from "@/server/agent/logging";

const POLL_INTERVAL_MS = 5_000;
const CANCEL_POLL_MS = 3_000;
const STUCK_AFTER_MS = 15 * 60 * 1_000;

let interval: ReturnType<typeof setInterval> | null = null;
let ticking = false;
const activeRuns = new Set<string>();

/**
 * Watches a running job for a user-requested cancellation and aborts the agent.
 */
function watchForCancellation(runId: string, controller: AbortController): () => void {
  const id = setInterval(async () => {
    try {
      const status = await getRunStatus(runId);
      if (status === "cancelled") controller.abort();
    } catch {
      // transient DB error — try again next tick
    }
  }, CANCEL_POLL_MS);
  return () => clearInterval(id);
}

/**
 * Processes a single queued run end-to-end: research agent, deterministic
 * quality gate, final status. Safe to call concurrently — the conditional
 * status transition guarantees only one caller processes a given run.
 */
export async function processRun(runId: string): Promise<void> {
  if (activeRuns.has(runId)) return;
  activeRuns.add(runId);

  try {
    const claimed = await transitionRunStatus(runId, "queued", "discovering");
    if (!claimed) return;

    const controller = new AbortController();
    const stopWatching = watchForCancellation(runId, controller);

    let outcome;
    try {
      outcome = await runResearchPhase(runId, { signal: controller.signal });
    } finally {
      stopWatching();
    }

    const extraNotes: string[] = [];
    if (outcome.isError && !outcome.aborted) {
      extraNotes.push(
        `Agent stopped early (${outcome.subtype})${outcome.errorMessages.length ? `: ${outcome.errorMessages.join("; ")}` : ""}.`,
      );
    }
    const report = await runQualityCheck(runId, extraNotes);

    let status: "completed" | "needs_review" | "cancelled";
    if (outcome.aborted) {
      status = "cancelled";
    } else if (report.structural_ok && report.safety_passed && report.qualified > 0) {
      status = "completed";
    } else {
      status = "needs_review";
    }

    await updateRun(runId, {
      quality_report: report,
      status,
      completed_at: new Date().toISOString(),
    });
    await logEvent(
      runId,
      "RUN_FINISHED",
      `Run ${status}: ${report.qualified} qualified lead(s), ${report.needs_review} needs review.`,
      { status, qualified: report.qualified },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEvent(runId, "RUN_FAILED", `Run failed: ${message}`).catch(() => {});
    await updateRun(runId, {
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString(),
    }).catch(() => {});
  } finally {
    activeRuns.delete(runId);
  }
}

/** Marks runs left mid-flight by a previous process as failed. */
export async function recoverStuckRuns(): Promise<void> {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString();
  const stuck = await listStuckRunIds(cutoff);
  for (const runId of stuck) {
    if (activeRuns.has(runId)) continue;
    await updateRun(runId, {
      status: "failed",
      error_message: "Run was interrupted (process restart) and marked failed. Start a new run.",
      completed_at: new Date().toISOString(),
    }).catch(() => {});
    await logEvent(runId, "RUN_RECOVERED", "Stuck run marked failed after process restart.").catch(() => {});
  }
}

/** One worker tick: pick up queued runs and process them in order. */
export async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const queued = await getQueuedRuns();
    for (const run of queued) {
      await processRun(run.id);
    }
  } catch (err) {
    console.error("[run-worker] tick failed:", err instanceof Error ? err.message : err);
  } finally {
    ticking = false;
  }
}

/**
 * Starts the in-process polling worker. Requires a long-lived Node server
 * (`next start` / a custom server) — see docs/architecture.md. Serverless
 * deployments must run the worker separately.
 */
export function startRunWorker(): void {
  if (interval) return;
  if (process.env.DISABLE_RUN_WORKER === "true") {
    console.info("[run-worker] disabled via DISABLE_RUN_WORKER.");
    return;
  }
  if (!isExternalIntegrationConfigured().supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "[run-worker] Supabase is not configured; the background worker is disabled. Runs will stay queued.",
    );
    return;
  }

  console.info(`[run-worker] started (poll every ${POLL_INTERVAL_MS}ms).`);
  void recoverStuckRuns();
  interval = setInterval(() => {
    void tick();
  }, POLL_INTERVAL_MS);
}

export function stopRunWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}