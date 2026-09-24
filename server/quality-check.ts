import "server-only";

import { getRun, listLeads, listOutreach } from "@/server/db";
import type { OutreachRow } from "@/server/db";
import { evaluateQuality } from "@/server/quality";
import type { QualityReport } from "@/server/types";

export { evaluateQuality } from "@/server/quality";
export type { QualityInput } from "@/server/quality";

/** Loads the current run state and evaluates it. */
export async function runQualityCheck(runId: string, extraNotes: string[] = []): Promise<QualityReport> {
  const run = await getRun(runId);
  const target = run?.desired_lead_count ?? 10;
  const leads = await listLeads(runId, undefined, { limit: 500 });
  const outreachByLead = new Map<string, OutreachRow[]>();
  for (const lead of leads) {
    outreachByLead.set(lead.id, await listOutreach(lead.id));
  }
  return evaluateQuality({
    leads,
    outreachByLead,
    pendingCandidates: run?.pending_candidates ?? [],
    target,
    notes: extraNotes,
  });
}