import { apiError, handle, json } from "@/server/api";
import { requireRole } from "@/server/auth";
import { saveQualityReport } from "@/server/db";
import { getRunForViewer } from "@/server/user-db";
import { runQualityCheck } from "@/server/quality-check";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/runs/:id/quality
 *
 * Re-runs the deterministic quality gate against the current DB state and
 * persists the refreshed report + run counts. Useful when:
 *  - a reviewer made a qualification decision after run completion
 *  - rows were manually modified in Supabase
 *  - the displayed counts are known to be stale
 *
 * The run must be in a terminal state (completed / needs_review / failed) —
 * refreshing mid-run is not useful since counts are changing.
 */
export async function POST(_request: Request, { params }: Params) {
  return handle(async () => {
    await requireRole("researcher");
    const { id } = await params;

    const run = await getRunForViewer(id);
    if (!run) return apiError("Run not found.", 404);

    // Only allow refresh on terminal states — mid-run counts change every
    // few seconds and a manual refresh is misleading.
    const TERMINAL = ["completed", "needs_review", "failed", "cancelled"];
    if (!TERMINAL.includes(run.status)) {
      return apiError(
        `Quality report can only be refreshed after the run finishes (current status: ${run.status}).`,
        409,
      );
    }

    const report = await runQualityCheck(id);

    // Persist the refreshed report and choose a terminal status.
    // If the reviewer promoted enough leads to qualified, move to "completed";
    // otherwise keep/set to "needs_review".
    const status =
      report.structural_ok && report.safety_passed && report.qualified > 0
        ? "completed"
        : "needs_review";

    await saveQualityReport(id, report, status);

    const refreshed = await getRunForViewer(id);
    return json({ run: refreshed, report });
  });
}
