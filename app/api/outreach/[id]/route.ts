import { z } from "zod";

import { apiError, handle, json, readJson } from "@/server/api";
import { requireRole } from "@/server/auth";
import { findEmailLike } from "@/server/agent/safety";
import { updateOutreachForViewer } from "@/server/user-db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  reviewStatus: z.enum(["draft", "approved", "rejected", "reviewed"]).optional(),
  subject: z.string().trim().min(1).max(300).optional(),
  body: z.string().trim().min(1).max(5000).optional(),
  personalizationNote: z.string().trim().min(1).max(1000).optional(),
  linkedinMessage: z.string().trim().max(1000).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    await requireRole("researcher");
    const { id } = await params;
    const body = patchSchema.parse(await readJson(request));

    const combined = [body.subject, body.body, body.personalizationNote, body.linkedinMessage]
      .filter(Boolean)
      .join("\n");
    const emails = findEmailLike(combined);
    if (emails.length > 0) {
      return apiError("Drafts must never contain email addresses.", 422);
    }

    const patch: Record<string, unknown> = {};
    if (body.reviewStatus) patch.review_status = body.reviewStatus;
    if (body.subject) patch.subject = body.subject;
    if (body.body) patch.body = body.body;
    if (body.personalizationNote) patch.personalization_note = body.personalizationNote;
    if (body.linkedinMessage !== undefined) patch.linkedin_message = body.linkedinMessage;
    if (Object.keys(patch).length === 0) return apiError("Nothing to update.", 400);

    const updated = await updateOutreachForViewer(id, patch);
    if (!updated) return apiError("Draft not found.", 404);
    return json({ outreach: updated });
  });
}