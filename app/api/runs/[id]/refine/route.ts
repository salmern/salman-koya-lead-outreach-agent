import { apiError, handle, json } from "@/server/api";
import { requireRole } from "@/server/auth";
import { transitionRunStatus, updateRun } from "@/server/db";
import { getRunForViewer } from "@/server/user-db";
import { runRefinePhase } from "@/server/agent/runner";
import { logEvent } from "@/server/agent/logging";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

/**
 * Phase A — refine the raw objective into an ICP (awaiting user confirmation).
 * Runs inline: it is short and the UI blocks on it.
 */
export async function POST(_request: Request, { params }: Params) {
  return handle(async () => {
    await requireRole("researcher");
    const { id } = await params;

    const existing = await getRunForViewer(id);
    if (!existing) return apiError("Run not found.", 404);
    if (!["draft", "awaiting_confirmation", "failed"].includes(existing.status)) {
      return apiError(`Cannot refine a run in status "${existing.status}".`, 409);
    }

    // Claim the transition so two clicks can't refine concurrently.
    const claimed = await transitionRunStatus(
      id,
      ["draft", "awaiting_confirmation", "failed"],
      "refining",
    );
    if (!claimed) return apiError("This run is already being refined.", 409);

    try {
      await runRefinePhase(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await updateRun(id, {
        status: "failed",
        error_message: `ICP refinement failed: ${message}`,
        completed_at: new Date().toISOString(),
      }).catch(() => {});
      throw err;
    }

    const run = await getRunForViewer(id);
    await logEvent(id, "ICP_REFINED", "ICP refinement completed; waiting for user confirmation.").catch(
      () => {},
    );

    return json({ run });
  });
}