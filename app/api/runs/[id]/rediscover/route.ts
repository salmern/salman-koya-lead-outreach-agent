import { z } from "zod";

import { apiError, handle, json, readJson } from "@/server/api";
import { requireRole } from "@/server/auth";
import { getRun, transitionRunStatus, updateRun } from "@/server/db";
import { getRunForViewer } from "@/server/user-db";
import { isExternalIntegrationConfigured } from "@/server/config";
import { logEvent } from "@/server/agent/logging";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  /**
   * The search query the agent should use on its first discovery attempt.
   * Stored as a hint in agent_metadata; the research prompt instructs the
   * agent to use it rather than deriving one from scratch.
   */
  searchQuery: z
    .string()
    .trim()
    .min(5, "Search query must be at least 5 characters.")
    .max(300, "Keep the search query under 300 characters."),
});

/**
 * POST /api/runs/:id/rediscover
 *
 * Re-queues a finished run for an additional discovery pass with a
 * user-supplied search query. Useful when the first run returned a
 * vendor-dominated pool and the user wants to try a different search angle.
 *
 * What this does:
 *   - Stores the new search query as a hint in agent_metadata.
 *   - Clears pending_candidates so the new search starts with a fresh pool
 *     (existing qualified leads in the leads table are NOT touched).
 *   - Transitions the run back to "queued" so the background worker picks
 *     it up and runs a full research phase with the hint query.
 *
 * Allowed from: completed, needs_review, failed
 * Not allowed: if the run is currently active (still processing)
 */
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    await requireRole("researcher");
    const { id } = await params;

    const run = await getRunForViewer(id);
    if (!run) return apiError("Run not found.", 404);

    const REDISCOVERABLE: string[] = ["completed", "needs_review", "failed"];
    if (!REDISCOVERABLE.includes(run.status)) {
      return apiError(
        `Cannot rediscover while the run is in status "${run.status}". ` +
          `Wait for it to finish first.`,
        409,
      );
    }

    const integrations = isExternalIntegrationConfigured();
    if (!integrations.anthropic) {
      return apiError("ANTHROPIC_API_KEY is not configured. Cannot run discovery.", 400);
    }
    if (!integrations.apify) {
      return apiError("APIFY_API_TOKEN and APIFY_ACTOR_ID must be configured.", 400);
    }

    // Parse body first so we fail fast on bad input before touching the DB.
    let parsedBody: { searchQuery: string };
    try {
      parsedBody = bodySchema.parse(await readJson(request));
    } catch (err) {
      if (err instanceof Error && "issues" in err) {
        const issues = (err as { issues: { message: string }[] }).issues;
        return apiError(`Invalid input: ${issues.map((i) => i.message).join("; ")}`, 422);
      }
      return apiError("Search query is required and must be between 5 and 300 characters.", 422);
    }

    // Store the hint and clear the candidate pool so the new search starts
    // fresh. Leads already written to the leads table are preserved.
    await updateRun(id, {
      agent_metadata: {
        ...(run.agent_metadata ?? {}),
        rediscover_hint_query: parsedBody.searchQuery,
        rediscover_at: new Date().toISOString(),
      },
      pending_candidates: [],
      candidate_count: 0,
    });

    const claimed = await transitionRunStatus(id, REDISCOVERABLE, "queued");
    if (!claimed) {
      return apiError("Run could not be re-queued. Refresh and try again.", 409);
    }

    await logEvent(
      id,
      "REDISCOVER_QUEUED",
      `Re-queued for a new discovery pass. Hint query: "${parsedBody.searchQuery}"`,
      { hint_query: parsedBody.searchQuery },
    ).catch(() => {});

    return json({ run: await getRunForViewer(id) });
  });
}
