import type { LeadRow, OutreachRow, RunEventRow, ToolCallRow } from "@/server/db";
import type { QualityReport, RunRecord } from "@/server/types";

export interface RunBundle {
  run: RunRecord;
  leads: LeadRow[];
  outreachByLead: Map<string, OutreachRow[]>;
  toolCalls: ToolCallRow[];
  events: RunEventRow[];
  qualityReport: QualityReport | null;
}

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join(" | ") : value == null ? "" : String(value);
  const escaped = text.replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${escaped}"` : escaped;
}

const CSV_HEADERS = [
  "run_id",
  "company_name",
  "domain",
  "qualification_status",
  "confidence",
  "fit_reasons",
  "concerns",
  "source_urls",
  "source_summary",
  "email_1_subject",
  "email_1_body",
  "email_1_personalization",
  "email_2_subject",
  "email_2_body",
  "email_2_personalization",
  "email_3_subject",
  "email_3_body",
  "email_3_personalization",
  "linkedin_message",
];

export function leadsToCsv(bundle: RunBundle): string {
  const rows = [CSV_HEADERS.join(",")];
  for (const lead of bundle.leads) {
    const drafts = bundle.outreachByLead.get(lead.id) ?? [];
    const byStep = new Map(drafts.map((d) => [d.sequence_step, d]));
    const step = (n: number, field: keyof OutreachRow) => byStep.get(n)?.[field] ?? "";
    rows.push(
      [
        bundle.run.id,
        lead.company_name,
        lead.domain,
        lead.qualification_status,
        lead.confidence ?? "",
        lead.fit_reasons,
        lead.concerns,
        lead.source_urls,
        lead.source_summary ?? "",
        step(1, "subject"),
        step(1, "body"),
        step(1, "personalization_note"),
        step(2, "subject"),
        step(2, "body"),
        step(2, "personalization_note"),
        step(3, "subject"),
        step(3, "body"),
        step(3, "personalization_note"),
        drafts.find((d) => d.sequence_step === 1)?.linkedin_message ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return rows.join("\n");
}

export function runToJson(bundle: RunBundle): string {
  return JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      run: bundle.run,
      quality_report: bundle.qualityReport,
      leads: bundle.leads.map((lead) => ({
        ...lead,
        outreach: bundle.outreachByLead.get(lead.id) ?? [],
      })),
      tool_calls: bundle.toolCalls.map((call) => ({
        tool_name: call.tool_name,
        purpose: call.purpose,
        status: call.status,
        input_summary: call.input_summary,
        result_summary: call.result_summary,
        error_message: call.error_message,
        duration_ms: call.duration_ms,
        created_at: call.created_at,
      })),
      events: bundle.events.map((event) => ({
        event_type: event.event_type,
        message: event.message,
        created_at: event.created_at,
      })),
    },
    null,
    2,
  );
}

function bulletList(items: string[] | undefined, fallback = "_None recorded._"): string {
  if (!items || items.length === 0) return fallback;
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildSamplePack(bundle: RunBundle): string {
  const { run, leads, qualityReport } = bundle;
  const icp = run.refined_icp;
  const qualified = leads.filter((l) => l.qualification_status === "qualified");
  const needsReview = leads.filter((l) => l.qualification_status === "needs_review");
  const notQualified = leads.filter((l) => l.qualification_status === "not_qualified");

  const lines: string[] = [];
  lines.push(`# ${run.original_objective.slice(0, 100)}`);
  lines.push("");
  lines.push("_AI Lead Research and Outreach Agent — sample pack (human review required)._");
  lines.push("");
  lines.push(`- Run ID: \`${run.id}\``);
  lines.push(`- Status: ${run.status}`);
  lines.push(`- Desired leads: ${run.desired_lead_count}`);
  lines.push(`- Qualified: ${qualified.length} · Needs review: ${needsReview.length} · Not qualified: ${notQualified.length}`);
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push("");

  lines.push("## Qualification objective");
  lines.push(run.original_objective);
  lines.push("");

  if (icp) {
    lines.push("## Refined ICP (confirmed)");
    lines.push(`- Company type: ${icp.target_company_type}`);
    lines.push(`- Industries: ${icp.industries.join(", ") || "—"}`);
    lines.push(`- Geography: ${icp.geography.join(", ") || "—"}`);
    lines.push(`- Headcount: ${icp.headcount_range}`);
    lines.push(`- Buyer persona: ${icp.buyer_persona}`);
    lines.push(`- Business problem: ${icp.business_problem}`);
    lines.push("- Hard filters:");
    lines.push(bulletList(icp.hard_filters));
    lines.push("- Soft preferences:");
    lines.push(bulletList(icp.soft_preferences));
    lines.push("- Disqualifiers:");
    lines.push(bulletList(icp.disqualifiers));
    lines.push("");
  }

  if (qualityReport) {
    lines.push("## Quality report");
    lines.push(`- Structural check passed: ${qualityReport.structural_ok}`);
    lines.push(`- Safety check passed: ${qualityReport.safety_passed}`);
    lines.push(`- Meets target: ${qualityReport.meets_target}`);
    lines.push(`- Duplicate domains: ${qualityReport.duplicates}`);
    if (qualityReport.issues.length) {
      lines.push("- Issues:");
      lines.push(bulletList(qualityReport.issues));
    }
    lines.push("");
  }

  lines.push("## Qualified leads & outreach drafts");
  lines.push("");
  if (qualified.length === 0) {
    lines.push("_No companies met every hard filter. No companies were fabricated._");
    lines.push("");
  }
  for (const lead of qualified) {
    const drafts = (bundle.outreachByLead.get(lead.id) ?? []).sort((a, b) => a.sequence_step - b.sequence_step);
    lines.push(`### ${lead.company_name} — ${lead.domain}`);
    lines.push(`- Confidence: ${lead.confidence ?? "—"}`);
    lines.push(`- Sources: ${lead.source_urls.join(", ") || "—"}`);
    lines.push("- Fit reasons:");
    lines.push(bulletList(lead.fit_reasons));
    lines.push("- Concerns:");
    lines.push(bulletList(lead.concerns));
    lines.push(`- Source summary: ${lead.source_summary ?? "—"}`);
    lines.push("");
    for (const draft of drafts) {
      lines.push(`#### Email ${draft.sequence_step} — ${draft.subject}`);
      lines.push(`_Personalization note: ${draft.personalization_note}_`);
      lines.push("");
      lines.push("```text");
      lines.push(draft.body);
      lines.push("```");
      lines.push("");
      if (draft.sequence_step === 1 && draft.linkedin_message) {
        lines.push("**LinkedIn message:**");
        lines.push("```text");
        lines.push(draft.linkedin_message);
        lines.push("```");
        lines.push("");
      }
    }
    lines.push("---");
    lines.push("");
  }

  if (needsReview.length) {
    lines.push("## Leads needing review (not sent, not counted as qualified)");
    for (const lead of needsReview) {
      lines.push(`- **${lead.company_name}** (${lead.domain}) — ${lead.concerns.join("; ") || "insufficient evidence"}`);
    }
    lines.push("");
  }
  if (notQualified.length) {
    lines.push("## Not qualified (excluded by hard filters)");
    for (const lead of notQualified) {
      lines.push(`- ${lead.company_name} (${lead.domain}) — ${lead.concerns.join("; ") || "did not meet hard filters"}`);
    }
    lines.push("");
  }

  lines.push("## Audit trail (tool calls)");
  if (bundle.toolCalls.length === 0) {
    lines.push("_No tool calls recorded._");
  } else {
    for (const call of bundle.toolCalls) {
      lines.push(`- ${call.created_at} — ${call.tool_name} [${call.status}] ${call.result_summary}`);
    }
  }
  lines.push("");
  lines.push("> Outreach was drafted for human review only. Nothing was sent. No personal email addresses were collected.");
  return lines.join("\n");
}