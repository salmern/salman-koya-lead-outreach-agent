import { z } from "zod";

import { apiError, handle, json, readJson } from "@/server/api";
import { requireUser, requireRole } from "@/server/auth";
import { refinedIcpSchema } from "@/server/schemas";
import type { LeadRow } from "@/server/db";
import {
  getRunForViewer,
  listEventsForViewer,
  listLeadsForViewer,
  listOutreachForViewer,
  listToolCallsForViewer,
  updateRunForViewer,
} from "@/server/user-db";
import { logEvent } from "@/server/agent/logging";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const run = await getRunForViewer(id);
    if (!run) return apiError("Run not found.", 404);

    const [leads, toolCalls, events] = await Promise.all([
      listLeadsForViewer(id),
      listToolCallsForViewer(id),
      listEventsForViewer(id),
    ]);
    const outreach = await listOutreachForViewer(leads.map((l: LeadRow) => l.id));

    const outreachByLead = new Map<string, typeof outreach>();
    for (const draft of outreach) {
      const list = outreachByLead.get(draft.lead_id) ?? [];
      list.push(draft);
      outreachByLead.set(draft.lead_id, list);
    }

    return json({
      run,
      leads,
      outreach: Object.fromEntries(outreachByLead),
      toolCalls,
      events,
    });
  });
}

const patchSchema = z.object({
  refinedIcp: refinedIcpSchema.optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    await requireRole("researcher");
    const { id } = await params;
    const existing = await getRunForViewer(id);
    if (!existing) return apiError("Run not found.", 404);
    if (!["draft", "awaiting_confirmation"].includes(existing.status)) {
      return apiError("The ICP can only be edited before the research run starts.", 409);
    }

    const body = patchSchema.parse(await readJson(request));
    const patch: Record<string, unknown> = {};
    if (body.refinedIcp) patch.refined_icp = body.refinedIcp;

    const run = await updateRunForViewer(id, patch);
    if (!run) return apiError("Update failed.", 500);

    if (body.refinedIcp) {
      await logEvent(id, "ICP_EDITED", "The user edited the ICP before confirming.").catch(() => {});
    }
    return json({ run });
  });
}