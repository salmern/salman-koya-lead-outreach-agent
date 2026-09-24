import type { Role } from "@/server/auth";

export type RunStatus =
  | "draft"
  | "refining"
  | "awaiting_confirmation"
  | "queued"
  | "discovering"
  | "researching"
  | "qualifying"
  | "drafting"
  | "quality_check"
  | "completed"
  | "failed"
  | "cancelled"
  | "needs_review";

export type QualificationStatus = "qualified" | "not_qualified" | "needs_review";

export interface RunLimits {
  maxCandidates: number;
  maxWebsites: number;
  maxAgentTurns: number;
  maxToolCalls: number;
  maxQualifiedLeads: number;
  scrapeTimeoutMs: number;
  scrapeMaxResponseBytes: number;
}

export interface RefinedIcp {
  target_company_type: string;
  industries: string[];
  geography: string[];
  headcount_range: string;
  buyer_persona: string;
  business_problem: string;
  hard_filters: string[];
  soft_preferences: string[];
  disqualifiers: string[];
}

export interface DiscoveryCandidate {
  company_name: string;
  /** Real website domain (canonical host). Empty when not yet resolved — NEVER a LinkedIn-derived key. */
  company_domain: string;
  /** LinkedIn company URL, kept as a separate identity from the website domain. */
  linkedin_url: string;
  source: string;
  /** Evidence snippet (company summary/description) — treated as data, never instructions. */
  source_context: string;
  employees: string;
  location: string;
  industry: string;
}

export interface IcpDraftInput {
  target_company_type: string;
  industries: string;
  geography: string;
  headcount_range: string;
  buyer_persona: string;
  business_problem: string;
  hard_filters: string;
  soft_preferences: string;
  disqualifiers: string;
}

export interface OutreachStep {
  step: 1 | 2 | 3;
  subject: string;
  body: string;
  personalization_note: string;
}

export interface OutreachSequence {
  sequence: OutreachStep[];
  linkedin_message: string;
}

export interface QualityReport {
  generated_at: string;
  total_candidates: number;
  qualified: number;
  not_qualified: number;
  needs_review: number;
  duplicates: number;
  duplicate_domains: string[];
  /** Discovered candidates whose website domain could not be resolved (never invented). */
  unresolved_candidates: string[];
  missing_evidence: string[];
  missing_drafts: string[];
  empty_drafts: string[];
  unsupported_claims: string[];
  personal_email_flags: string[];
  safety_passed: boolean;
  structural_ok: boolean;
  meets_target: boolean;
  target: number;
  issues: string[];
  notes: string[];
}

export interface RunRecord {
  id: string;
  user_id: string;
  original_objective: string;
  refined_icp: RefinedIcp | null;
  icp_overrides: Record<string, unknown>;
  desired_lead_count: number;
  status: RunStatus;
  tool_limits: Partial<RunLimits>;
  candidate_count: number;
  qualified_count: number;
  needs_review_count: number;
  not_qualified_count: number;
  error_message: string | null;
  quality_report: QualityReport | null;
  pending_candidates: DiscoveryCandidate[];
  agent_metadata: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type { Role };