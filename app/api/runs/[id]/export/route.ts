import { apiError, handle } from "@/server/api";
import { requireUser } from "@/server/auth";
import type { LeadRow, OutreachRow } from "@/server/db";
import {
  getRunForViewer,
  listEventsForViewer,
  listLeadsForViewer,
  listOutreachForViewer,
  listToolCallsForViewer,
} from "@/server/user-db";
import { buildSamplePack, leadsToCsv, runToJson, type RunBundle } from "@/server/export";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "run";
}

export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const format = new URL(request.url).searchParams.get("format") ?? "json";

    const run = await getRunForViewer(id);
    if (!run) return apiError("Run not found.", 404);

    const [leads, toolCalls, events] = await Promise.all([
      listLeadsForViewer(id),
      listToolCallsForViewer(id),
      listEventsForViewer(id),
    ]);
    const outreach = await listOutreachForViewer(leads.map((l: LeadRow) => l.id));
    const outreachByLead = new Map<string, OutreachRow[]>();
    for (const draft of outreach) {
      const list = outreachByLead.get(draft.lead_id) ?? [];
      list.push(draft);
      outreachByLead.set(draft.lead_id, list);
    }

    const bundle: RunBundle = { run, leads, outreachByLead, toolCalls, events, qualityReport: run.quality_report };

    const base = safeFilename(run.original_objective);

    if (format === "csv") {
      return new Response(leadsToCsv(bundle), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="koya-leads-${base}.csv"`,
        },
      });
    }
    if (format === "sample-pack") {
      return new Response(buildSamplePack(bundle), {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="koya-sample-pack-${base}.md"`,
        },
      });
    }
    if (format === "json") {
      return new Response(runToJson(bundle), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="koya-run-${base}.json"`,
        },
      });
    }
    return apiError(`Unsupported export format "${format}". Use csv, json or sample-pack.`, 400);
  });
}