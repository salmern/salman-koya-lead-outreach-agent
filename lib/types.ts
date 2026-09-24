import type { QualityReport, RefinedIcp, RunRecord } from "@/server/types";

export interface Lead {
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
  discovery_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OutreachDraft {
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

export interface ToolCall {
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

export interface RunEvent {
  id: string;
  run_id: string;
  event_type: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RunBundle {
  run: RunRecord;
  leads: Lead[];
  outreach: Record<string, OutreachDraft[]>;
  toolCalls: ToolCall[];
  events: RunEvent[];
}

export interface SessionResponse {
  user: { id: string; email: string; role: string; fullName: string | null } | null;
  integrations: { supabase: boolean; anthropic: boolean; apify: boolean; firecrawl: boolean };
}

export type { QualityReport, RefinedIcp, RunRecord };
