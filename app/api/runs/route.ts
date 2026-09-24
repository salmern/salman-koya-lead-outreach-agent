import { z } from "zod";

import { apiError, handle, json, readJson } from "@/server/api";
import { requireRole, requireUser } from "@/server/auth";
import { addEvent } from "@/server/db";
import { createRunForViewer, listRunsForViewer } from "@/server/user-db";
import { config } from "@/server/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const runs = await listRunsForViewer();
    return json({ runs, role: user.role });
  });
}

const limitOverride = z.number().int().min(1).optional();

const createRunSchema = z.object({
  objective: z.string().trim().min(20, "Describe the qualification objective in at least 20 characters.").max(4000),
  overrides: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
  desiredLeadCount: z.number().int().min(1).max(40).optional(),
  limits: z
    .object({
      maxCandidates: limitOverride,
      maxWebsites: limitOverride,
      maxAgentTurns: limitOverride,
      maxToolCalls: limitOverride,
      maxQualifiedLeads: limitOverride,
    })
    .optional(),
});

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireRole("researcher");
    const body = createRunSchema.parse(await readJson(request));

    const desiredLeadCount = Math.min(
      body.desiredLeadCount ?? config.limits.maxQualifiedLeads,
      config.limits.maxQualifiedLeads,
    );

    const overrides: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body.overrides ?? {})) {
      const text = Array.isArray(value) ? value.filter(Boolean).join(", ") : value;
      if (text.trim()) overrides[key] = text.trim();
    }

    const run = await createRunForViewer({
      user_id: user.id,
      original_objective: body.objective,
      icp_overrides: overrides,
      desired_lead_count: desiredLeadCount,
      tool_limits: body.limits ?? {},
    });

    if (!run) {
      return apiError("Could not create the run. Check that the database migrations have been applied.", 500);
    }

    await addEvent(run.id, "RUN_CREATED", "Run created with a qualification objective.", {
      desired_lead_count: desiredLeadCount,
    }).catch(() => {});

    return json({ run }, { status: 201 });
  });
}