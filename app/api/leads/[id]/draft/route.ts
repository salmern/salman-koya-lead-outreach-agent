import { apiError, handle, json } from "@/server/api";
import { requireRole } from "@/server/auth";
import { config, isExternalIntegrationConfigured } from "@/server/config";
import { getLeadForViewer, listOutreachForViewer } from "@/server/user-db";
import { getRun, upsertOutreach } from "@/server/db";
import { logEvent } from "@/server/agent/logging";
import { validateOutreachOutput } from "@/server/agent/validation";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { SKILL_NAMES } from "@/server/agent/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/leads/:id/draft
 *
 * Generates a 3-step outreach sequence for a single qualified lead that has
 * no drafts yet (e.g. a lead that was manually promoted from needs_review
 * after the run completed).
 *
 * Runs a focused SDK agent session using the outbound-copywriting skill.
 * Does NOT re-run discovery or qualification.
 *
 * The generated output is validated by validateOutreachOutput (same check as
 * the main draft_outreach tool) before any DB write — ensuring safety rules
 * (no email addresses, no unsupported claims) are enforced here too.
 */
export async function POST(_request: Request, { params }: Params) {
  return handle(async () => {
    await requireRole("researcher");
    const { id } = await params;

    if (!isExternalIntegrationConfigured().anthropic) {
      return apiError("ANTHROPIC_API_KEY is not configured. Cannot generate outreach.", 400);
    }

    const lead = await getLeadForViewer(id);
    if (!lead) return apiError("Lead not found.", 404);
    if (lead.qualification_status !== "qualified") {
      return apiError("Outreach is only generated for qualified leads.", 409);
    }

    const existing = await listOutreachForViewer([lead.id]);
    if (existing.length >= 3) {
      return apiError("This lead already has outreach drafts.", 409);
    }

    const run = await getRun(lead.run_id);
    if (!run) return apiError("Run not found.", 404);

    const sdkEnv: Record<string, string | undefined> = {
      ...process.env,
      ANTHROPIC_API_KEY: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    };

    const prompt = `
You are writing outreach for one qualified lead. Use the outbound-copywriting skill.

Company: ${lead.company_name}
Domain: ${lead.domain}
Source summary: ${lead.source_summary ?? "(none recorded)"}
Fit reasons: ${lead.fit_reasons.join("; ")}

Write a 3-step cold email sequence. Return it as a JSON object exactly matching this schema:
{
  "sequence": [
    { "step": 1, "subject": "...", "body": "...", "personalization_note": "..." },
    { "step": 2, "subject": "...", "body": "...", "personalization_note": "..." },
    { "step": 3, "subject": "...", "body": "...", "personalization_note": "..." }
  ],
  "linkedin_message": "..."
}

Rules:
- Ground every claim in the source summary and fit reasons above.
- Do not invent facts about the company.
- Do not fabricate customer case studies, client results, or quantitative outcomes.
- Do not include email addresses.
- Plain text bodies only, no markdown.
- Keep each email to 3-5 sentences.
`.trim();

    let resultText = "";
    try {
      const iterator = query({
        prompt,
        options: {
          cwd: process.cwd(),
          systemPrompt:
            "You are an outbound copywriter. Use the outbound-copywriting skill. " +
            "Return only the JSON object requested. Never fabricate customer case studies or invent quantitative outcomes.",
          tools: [],
          skills: SKILL_NAMES,
          settingSources: ["project"],
          maxTurns: 4,
          ...(config.claudeModel ? { model: config.claudeModel } : {}),
          env: sdkEnv,
        },
      });

      for await (const message of iterator) {
        if (message.type === "result" && message.subtype === "success") {
          resultText = message.result;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return apiError(`Agent failed: ${msg}`, 500);
    }

    // Extract JSON from the result.
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return apiError("Agent did not return valid JSON outreach.", 500);
    }

    let rawParsed: unknown;
    try {
      rawParsed = JSON.parse(jsonMatch[0]);
    } catch {
      return apiError("Could not parse agent outreach output.", 500);
    }

    // Run the same validation as the main draft_outreach tool — this enforces
    // email-address blocking, unsupported-claim detection, and structural checks.
    const validation = validateOutreachOutput(rawParsed);
    if (!validation.ok) {
      return apiError(
        `Generated outreach failed safety validation: ${validation.errors.join("; ")}`,
        422,
      );
    }

    const seq = validation.value.sequence;
    for (const step of seq.sequence) {
      await upsertOutreach(lead.id, {
        sequence_step: step.step as 1 | 2 | 3,
        subject: step.subject,
        body: step.body,
        personalization_note: step.personalization_note,
        linkedin_message: step.step === 1 ? (seq.linkedin_message || null) : null,
      });
    }

    await logEvent(
      lead.run_id,
      "OUTREACH_DRAFTED",
      `Outreach generated for ${lead.company_name} via manual trigger.`,
      { lead_id: lead.id },
    );

    const drafts = await listOutreachForViewer([lead.id]);
    return json({ drafts });
  });
}
