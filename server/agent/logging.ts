import "server-only";

import { addEvent, addToolCall } from "@/server/db";
import { truncateForSummary } from "@/server/agent/safety";

export interface ToolLogInput {
  runId: string;
  leadId?: string | null;
  toolName: string;
  purpose: string;
  inputSummary: string;
  resultSummary: string;
  status: "success" | "error" | "cancelled" | "skipped";
  errorMessage?: string | null;
  durationMs: number;
}

/**
 * Persists a tool call and an optional timeline event. Summaries are truncated
 * and secrets are never included by callers.
 */
export async function logToolCall(input: ToolLogInput): Promise<void> {
  await addToolCall({
    run_id: input.runId,
    lead_id: input.leadId ?? null,
    tool_name: input.toolName,
    purpose: input.purpose,
    input_summary: truncateForSummary(input.inputSummary, 500),
    result_summary: truncateForSummary(input.resultSummary, 800),
    status: input.status,
    error_message: input.errorMessage ? truncateForSummary(input.errorMessage, 500) : null,
    duration_ms: Math.round(input.durationMs),
  });
}

export async function logEvent(
  runId: string,
  eventType: string,
  message: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await addEvent(runId, eventType, message, metadata);
}