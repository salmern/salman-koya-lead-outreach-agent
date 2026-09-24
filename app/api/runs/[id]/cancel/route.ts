import { apiError, handle, json } from "@/server/api";
import { requireRole } from "@/server/auth";
import { transitionRunStatus } from "@/server/db";
import { getRunForViewer } from "@/server/user-db";
import { logEvent } from "@/server/agent/logging";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const CANCELLABLE = [
  "awaiting_confirmation",
  "queued",
  "discovering",
  "researching",
  "qualifying",
  "drafting",
  "quality_check",
];

export async function POST(_request: Request, { params }: Params) {
  return handle(async () => {
    await requireRole("researcher");
    const { id } = await params;

    const run = await getRunForViewer(id);
    if (!run) return apiError("Run not found.", 404);

    const claimed = await transitionRunStatus(id, CANCELLABLE, "cancelled");
    if (!claimed) {
      return apiError(`A run in status "${run.status}" cannot be cancelled.`, 409);
    }

    // A running worker notices the "cancelled" status and aborts the agent.
    await logEvent(id, "RUN_CANCELLED", "Run cancelled by the user.").catch(() => {});
    return json({ run: await getRunForViewer(id) });
  });
}