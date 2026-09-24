import { apiError, handle, json } from "@/server/api";
import { requireRole } from "@/server/auth";
import { transitionRunStatus } from "@/server/db";
import { getRunForViewer } from "@/server/user-db";
import { isExternalIntegrationConfigured } from "@/server/config";
import { logEvent } from "@/server/agent/logging";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Phase B — confirm the ICP and queue the research run for the worker. */
export async function POST(_request: Request, { params }: Params) {
  return handle(async () => {
    await requireRole("researcher");
    const { id } = await params;

    const run = await getRunForViewer(id);
    if (!run) return apiError("Run not found.", 404);
    if (run.status !== "awaiting_confirmation") {
      return apiError(`Confirm the ICP before starting (current status: ${run.status}).`, 409);
    }
    if (!run.refined_icp) return apiError("Refine the ICP before starting.", 409);

    const integrations = isExternalIntegrationConfigured();
    const missing: string[] = [];
    if (!integrations.anthropic) missing.push("ANTHROPIC_API_KEY");
    if (!integrations.apify) missing.push("APIFY_API_TOKEN + APIFY_ACTOR_ID");
    if (missing.length) {
      return apiError(
        `The research run cannot start until these are configured: ${missing.join(", ")}. See docs/setup.md.`,
        400,
      );
    }

    const claimed = await transitionRunStatus(id, "awaiting_confirmation", "queued");
    if (!claimed) return apiError("This run could not be queued. Refresh and try again.", 409);

    await logEvent(id, "RUN_QUEUED", "ICP confirmed by the user; research run queued.").catch(() => {});
    return json({ run: await getRunForViewer(id) });
  });
}