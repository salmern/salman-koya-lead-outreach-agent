import { z } from "zod";

import { apiError, handle, json, readJson } from "@/server/api";
import { requireRole, requireUser } from "@/server/auth";
import { refreshRunCounts } from "@/server/db";
import { getLeadForViewer, listOutreachForViewer, updateLeadForViewer } from "@/server/user-db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/leads/:id
 * Any authenticated user can read a lead they have access to (RLS enforced).
 */
export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const lead = await getLeadForViewer(id);
    if (!lead) return apiError("Lead not found.", 404);
    const outreach = await listOutreachForViewer([lead.id]);
    return json({ lead, outreach });
  });
}

/**
 * PATCH /api/leads/:id
 * Researcher or admin can update the human-review fields of a lead:
 *   - qualification_status: may promote needs_review → qualified | not_qualified
 *   - fit_reasons, concerns, source_summary: reviewer annotations
 *
 * Company identity (domain, company_name) and agent-scored confidence are
 * intentionally excluded — reviewers annotate; they do not re-score.
 *
 * After a status change the run's aggregate counts are refreshed so the
 * dashboard and quality report stay consistent.
 */
const patchSchema = z.object({
  qualificationStatus: z
    .enum(["qualified", "not_qualified", "needs_review"])
    .optional()
    .describe("Reviewer decision. Promotes or demotes the qualification status."),
  fitReasons: z
    .array(z.string().min(1).max(500))
    .max(20)
    .optional()
    .describe("Reviewer-supplied fit reasons (replaces agent list)."),
  concerns: z
    .array(z.string().min(1).max(500))
    .max(20)
    .optional()
    .describe("Reviewer-supplied concerns (replaces agent list)."),
  sourceSummary: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .optional()
    .describe("Reviewer annotation on the source evidence."),
});

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    await requireRole("researcher");
    const { id } = await params;

    const existing = await getLeadForViewer(id);
    if (!existing) return apiError("Lead not found.", 404);

    const body = patchSchema.parse(await readJson(request));

    const patch: Record<string, unknown> = {};
    if (body.qualificationStatus !== undefined) {
      patch.qualification_status = body.qualificationStatus;
    }
    if (body.fitReasons !== undefined) patch.fit_reasons = body.fitReasons;
    if (body.concerns !== undefined) patch.concerns = body.concerns;
    if (body.sourceSummary !== undefined) patch.source_summary = body.sourceSummary;

    if (Object.keys(patch).length === 0) return apiError("Nothing to update.", 400);

    const updated = await updateLeadForViewer(id, patch);
    if (!updated) return apiError("Lead not found or update failed.", 404);

    // Keep run aggregate counts (qualified_count, needs_review_count, etc.) in sync
    // so the dashboard and quality report reflect the reviewer's decision immediately.
    await refreshRunCounts(updated.run_id);

    return json({ lead: updated });
  });
}
