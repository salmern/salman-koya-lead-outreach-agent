import "server-only";

import { createClient } from "@/server/supabase";
import { mapRun, normalizeDomain, type LeadRow, type OutreachRow, type RunEventRow, type RunRow, type ToolCallRow } from "@/server/db";
import type { RunRecord } from "@/server/types";

/**
 * User-scoped data access. Every query here runs with the caller's auth cookie,
 * so Postgres Row Level Security is the real authorization boundary — a
 * non-owner simply sees no rows. Routes should use this layer (not the
 * service-role layer) for anything user-facing.
 */

export async function listRunsForViewer(): Promise<RunRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRun(row as unknown as RunRow));
}

export async function getRunForViewer(runId: string): Promise<RunRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRun(data as unknown as RunRow) : null;
}

export async function createRunForViewer(input: {
  user_id: string;
  original_objective: string;
  icp_overrides: Record<string, unknown>;
  desired_lead_count: number;
  tool_limits: Record<string, unknown>;
}): Promise<RunRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_runs")
    .insert({ ...input, status: "draft" })
    .select("*")
    .single();
  if (error) return null;
  return mapRun(data as unknown as RunRow);
}

export async function updateRunForViewer(
  runId: string,
  patch: Record<string, unknown>,
): Promise<RunRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_runs")
    .update(patch)
    .eq("id", runId)
    .select("*")
    .maybeSingle();
  if (error) return null;
  return data ? mapRun(data as unknown as RunRow) : null;
}

export async function listLeadsForViewer(runId: string): Promise<LeadRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LeadRow[];
}

export async function getLeadForViewer(leadId: string): Promise<LeadRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (error) return null;
  return data as unknown as LeadRow;
}

/**
 * Update human-review fields on a lead. Uses the caller's auth cookie so RLS
 * enforces ownership (only the run owner or an admin can update).
 * Throws on DB errors so the route returns a real error message.
 */
export async function updateLeadForViewer(
  leadId: string,
  patch: Record<string, unknown>,
): Promise<LeadRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update(patch)
    .eq("id", leadId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as LeadRow | null;
}

export async function listOutreachForViewer(leadIds: string[]): Promise<OutreachRow[]> {
  if (leadIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outreach_drafts")
    .select("*")
    .in("lead_id", leadIds)
    .order("sequence_step", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as OutreachRow[];
}

export async function updateOutreachForViewer(
  draftId: string,
  patch: Record<string, unknown>,
): Promise<OutreachRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outreach_drafts")
    .update(patch)
    .eq("id", draftId)
    .select("*")
    .maybeSingle();
  // Propagate DB errors so the route can return a meaningful message instead of
  // silently treating every failure as "not found".
  if (error) throw new Error(error.message);
  return data as unknown as OutreachRow | null;
}

export async function listToolCallsForViewer(runId: string): Promise<ToolCallRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tool_calls")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ToolCallRow[];
}

export async function listEventsForViewer(runId: string): Promise<RunEventRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("run_events")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RunEventRow[];
}

export { normalizeDomain };
export type { LeadRow, OutreachRow, RunEventRow, ToolCallRow, RunRow };