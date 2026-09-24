import "server-only";

import { createAdminClient } from "@/server/supabase";
import { normalizeDomain } from "@/lib/utils";
import { canonicalDomain } from "@/lib/domains";
import type { DiscoveryCandidate, QualityReport, RunRecord } from "@/server/types";

type Json = Record<string, unknown>;

/**
 * Typed data-access layer used by the agent worker and API routes that need
 * privileged access. ALWAYS performed with the service-role client — the call
 * site must enforce authorization (RBAC) before calling these.
 */

export interface RunRow {
  id: string;
  user_id: string;
  original_objective: string;
  refined_icp: Record<string, unknown> | null;
  icp_overrides: Json;
  desired_lead_count: number;
  status: string;
  tool_limits: Json;
  candidate_count: number;
  qualified_count: number;
  needs_review_count: number;
  not_qualified_count: number;
  error_message: string | null;
  quality_report: Json | null;
  pending_candidates: Record<string, unknown>[];
  agent_metadata: Json;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadRow {
  id: string;
  run_id: string;
  company_name: string;
  domain: string;
  qualification_status: string;
  confidence: number | null;
  fit_reasons: string[];
  concerns: string[];
  source_urls: string[];
  source_summary: string | null;
  discovery_data: Json;
  created_at: string;
  updated_at: string;
}

export interface OutreachRow {
  id: string;
  lead_id: string;
  sequence_step: number;
  subject: string;
  body: string;
  personalization_note: string;
  linkedin_message: string | null;
  review_status: string;
  created_at: string;
  updated_at: string;
}

export interface ToolCallRow {
  id: string;
  run_id: string;
  lead_id: string | null;
  tool_name: string;
  purpose: string;
  input_summary: string;
  result_summary: string;
  status: string;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface RunEventRow {
  id: string;
  run_id: string;
  event_type: string;
  message: string;
  metadata: Json;
  created_at: string;
}

function admin() {
  return createAdminClient();
}

export function mapRun(row: RunRow): RunRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    original_objective: row.original_objective,
    refined_icp: (row.refined_icp as RunRecord["refined_icp"]) ?? null,
    icp_overrides: row.icp_overrides ?? {},
    desired_lead_count: row.desired_lead_count,
    status: row.status as RunRecord["status"],
    tool_limits: row.tool_limits as RunRecord["tool_limits"],
    candidate_count: row.candidate_count,
    qualified_count: row.qualified_count,
    needs_review_count: row.needs_review_count,
    not_qualified_count: row.not_qualified_count,
    error_message: row.error_message,
    quality_report: (row.quality_report as RunRecord["quality_report"]) ?? null,
    pending_candidates: (row.pending_candidates ?? []) as unknown as DiscoveryCandidate[],
    agent_metadata: row.agent_metadata ?? {},
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getRun(runId: string): Promise<RunRecord | null> {
  const { data, error } = await admin()
    .from("research_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (error || !data) return null;
  return mapRun(data as unknown as RunRow);
}

/** Lightweight status read used by the cancellation watcher. */
export async function getRunStatus(runId: string): Promise<string | null> {
  const { data, error } = await admin()
    .from("research_runs")
    .select("status")
    .eq("id", runId)
    .maybeSingle();
  if (error || !data) return null;
  return data.status as string;
}

/** Stuck runs from a previous process, used for crash recovery on boot. */
export async function listStuckRunIds(olderThanIso: string): Promise<string[]> {
  const { data, error } = await admin()
    .from("research_runs")
    .select("id")
    .in("status", ["refining", "discovering", "researching", "qualifying", "drafting", "quality_check"])
    .lt("updated_at", olderThanIso);
  if (error) return [];
  return (data ?? []).map((r) => r.id as string);
}

export async function updateRun(
  runId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin()
    .from("research_runs")
    .update(patch)
    .eq("id", runId);
  if (error) throw new Error(`updateRun failed: ${error.message}`);
}

export async function setRunStatus(runId: string, status: string): Promise<void> {  const patch: Record<string, unknown> = { status };
  if (status === "discovering" || status === "queued") {
    patch.started_at = new Date().toISOString();
  }
  if (["completed", "failed", "cancelled", "needs_review"].includes(status)) {
    patch.completed_at = new Date().toISOString();
  }
  await updateRun(runId, patch);
}

/** Runs the worker should pick up: queued (confirmed) only. */
export async function getQueuedRuns(): Promise<RunRecord[]> {
  const { data, error } = await admin()
    .from("research_runs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) return [];
  return (data ?? []).map((r) => mapRun(r as unknown as RunRow));
}

/**
 * Atomically moves a run from one of `from` statuses to `to`. Returns true only
 * if this caller won the transition, which prevents double-processing when a
 * tick overlaps.
 */
export async function transitionRunStatus(
  runId: string,
  from: string | string[],
  to: string,
): Promise<boolean> {
  const fromList = Array.isArray(from) ? from : [from];
  const patch: Record<string, unknown> = { status: to };
  if (to === "discovering") patch.started_at = new Date().toISOString();
  if (["completed", "failed", "cancelled", "needs_review"].includes(to)) {
    patch.completed_at = new Date().toISOString();
  }
  const { data, error } = await admin()
    .from("research_runs")
    .update(patch)
    .eq("id", runId)
    .in("status", fromList)
    .select("id");
  if (error) throw new Error(`transitionRunStatus failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export async function refreshRunCounts(runId: string): Promise<void> {
  const supabase = admin();
  const { data, error } = await supabase
    .from("leads")
    .select("qualification_status")
    .eq("run_id", runId);
  if (error) return;
  const counts = { qualified: 0, needs_review: 0, not_qualified: 0 };
  for (const lead of data ?? []) {
    const s = lead.qualification_status as keyof typeof counts;
    if (s in counts) counts[s] += 1;
  }
  await updateRun(runId, {
    qualified_count: counts.qualified,
    needs_review_count: counts.needs_review,
    not_qualified_count: counts.not_qualified,
    candidate_count: (await getRun(runId))?.pending_candidates.length ?? 0,
  });
}

export async function addEvent(
  runId: string,
  eventType: string,
  message: string,
  metadata: Json = {},
): Promise<void> {
  await admin()
    .from("run_events")
    .insert({ run_id: runId, event_type: eventType, message, metadata });
}

export async function listEvents(runId: string, limit = 200): Promise<RunEventRow[]> {
  const { data, error } = await admin()
    .from("run_events")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as unknown as RunEventRow[];
}

export async function addToolCall(row: {
  run_id: string;
  lead_id?: string | null;
  tool_name: string;
  purpose: string;
  input_summary: string;
  result_summary: string;
  status: string;
  error_message?: string | null;
  duration_ms?: number | null;
}): Promise<string | null> {
  const { data, error } = await admin()
    .from("tool_calls")
    .insert({
      run_id: row.run_id,
      lead_id: row.lead_id ?? null,
      tool_name: row.tool_name,
      purpose: row.purpose,
      input_summary: row.input_summary,
      result_summary: row.result_summary,
      status: row.status,
      error_message: row.error_message ?? null,
      duration_ms: row.duration_ms ?? null,
    })
    .select("id")
    .single();
  if (error) return null;
  return data?.id ?? null;
}

export async function listToolCalls(runId: string, limit = 500): Promise<ToolCallRow[]> {
  const { data, error } = await admin()
    .from("tool_calls")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as unknown as ToolCallRow[];
}

export async function listLeads(
  runId: string | null,
  status?: string,
  options: { limit?: number } = {},
): Promise<LeadRow[]> {
  const limit = options.limit ?? 500;
  let query = admin().from("leads").select("*");
  if (runId) query = query.eq("run_id", runId);
  if (status) query = query.eq("qualification_status", status);
  const { data, error } = await query.order("created_at", { ascending: true }).limit(limit);
  if (error) return [];
  return (data ?? []) as unknown as LeadRow[];
}

export async function getLead(leadId: string): Promise<LeadRow | null> {
  const { data, error } = await admin()
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as LeadRow;
}

export async function upsertLeadReferencingIcp(
  run: RunRecord,
  input: {
    company_name: string;
    company_domain: string;
    qualification_status: string;
    confidence: number;
    fit_reasons: string[];
    concerns: string[];
    source_urls: string[];
    source_summary: string;
  },
): Promise<LeadRow | null> {
  const candidate = run.pending_candidates?.find(
    (c) => c.company_domain && canonicalDomain(c.company_domain) === canonicalDomain(input.company_domain),
  );
  const domain = normalizeDomain(input.company_domain);
  const { data, error } = await admin()
    .from("leads")
    .upsert(
      {
        run_id: run.id,
        company_name: input.company_name,
        domain,
        qualification_status: input.qualification_status,
        confidence: input.confidence,
        fit_reasons: input.fit_reasons,
        concerns: input.concerns,
        source_urls: input.source_urls,
        source_summary: input.source_summary,
        discovery_data: candidate ?? {},
      },
      { onConflict: "run_id,domain" },
    )
    .select()
    .single();
  if (error) return null;
  return data as unknown as LeadRow;
}

export async function listOutreach(leadId: string): Promise<OutreachRow[]> {
  const { data, error } = await admin()
    .from("outreach_drafts")
    .select("*")
    .eq("lead_id", leadId)
    .order("sequence_step", { ascending: true });
  if (error) return [];
  return (data ?? []) as unknown as OutreachRow[];
}

export async function upsertOutreach(
  leadId: string,
  step: { sequence_step: number; subject: string; body: string; personalization_note: string; linkedin_message?: string | null },
): Promise<void> {
  const { error } = await admin()
    .from("outreach_drafts")
    .upsert({
      lead_id: leadId,
      sequence_step: step.sequence_step,
      subject: step.subject,
      body: step.body,
      personalization_note: step.personalization_note,
      linkedin_message: step.sequence_step === 1 ? (step.linkedin_message ?? null) : null,
    }, { onConflict: "lead_id,sequence_step" });
  if (error) throw new Error(`upsertOutreach failed: ${error.message}`);
}

export async function updateOutreach(
  draftId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin()
    .from("outreach_drafts")
    .update(patch)
    .eq("id", draftId);
  if (error) throw new Error(`updateOutreach failed: ${error.message}`);
}

export async function saveQualityReport(
  runId: string,
  report: QualityReport,
  status: "completed" | "needs_review",
): Promise<void> {
  await updateRun(runId, {
    quality_report: report as unknown as Json,
    status,
    completed_at: new Date().toISOString(),
  });
}

export { normalizeDomain };

/* ────────────────────────────────────────────────────────────────────────────
 * Admin-only profile management
 * ──────────────────────────────────────────────────────────────────────────── */

export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export async function listProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await admin()
    .from("profiles")
    .select("id, email, full_name, role, created_at, updated_at")
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as unknown as ProfileRow[];
}

export async function setUserRole(userId: string, role: string): Promise<ProfileRow | null> {
  const { data, error } = await admin()
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id, email, full_name, role, created_at, updated_at")
    .maybeSingle();
  if (error) return null;
  return data as unknown as ProfileRow | null;
}