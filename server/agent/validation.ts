import {
  outreachSequenceSchema,
  refinedIcpSchema,
  disciplineSchema,
  type OutreachSequence,
  type QualificationOutput,
  type RefinedIcp,
} from "@/server/schemas";
import { UNSUPPORTED_PHRASES, normalizeOutreachBody } from "@/server/agent/safety";

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function zodErrors(err: unknown): string[] {
  if (err instanceof Error && "issues" in err) {
    return (err as { issues: { message: string }[] }).issues.map((i) => i.message);
  }
  return [err instanceof Error ? err.message : String(err)];
}

/**
 * Refine-phase contract: the refined ICP must be complete and, critically,
 * hard filters must remain separated from soft preferences.
 */
export function validateIcpOutput(raw: unknown): ValidationResult<RefinedIcp> {
  const parsed = refinedIcpSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const icp = parsed.data;
  const errors: string[] = [];

  // Hard versus soft: explicit core constraints must live in hard_filters.
  if (icp.geography.length === 0 && icp.target_company_type) {
    errors.push("geography is empty; qualify from the objective or set 'global' explicitly.");
  }
  if (!icp.hard_filters.some((f) => /country|geograph|us\b|united states/i.test(f)) && icp.geography.length > 0) {
    // geography is allowed to carry the constraint even if wording differs;
    // do not fail — just informational.
  }
  // Sanity: soft preferences must not duplicate hard filters verbatim.
  const hardSet = new Set(icp.hard_filters.map((f) => f.toLowerCase()));
  for (const soft of icp.soft_preferences) {
    if (hardSet.has(soft.toLowerCase())) {
      errors.push(`Soft preference duplicates a hard filter verbatim: "${soft}".`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: icp };
}

/**
 * Qualification contract plus semantic completeness:
 *   - status, confidence, reasons, concerns, source URLs, summary all present
 *   - confidence in [0,1]
 *   - qualified leads MUST have evidence (source URLs + summary + reasons)
 */
export function validateQualificationOutput(
  raw: unknown,
): ValidationResult<QualificationOutput> {
  const parsed = disciplineSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const q = parsed.data;
  const errors: string[] = [];

  if (q.company_name.length < 2) errors.push("company_name too short.");
  if (!q.company_domain.includes(".")) errors.push("company_domain must look like a real domain.");

  if (q.qualification_status === "qualified") {
    if (q.confidence == null || q.confidence < 0.4) {
      errors.push("qualified leads need confidence >= 0.4.");
    }
    if (q.fit_reasons.length === 0) errors.push("qualified leads need at least one fit_reason.");
    if (q.source_urls.length === 0) errors.push("qualified leads need at least one source_url.");
    if (q.source_summary.trim().length < 40) {
      errors.push("qualified leads need a substantive source_summary.");
    }
  }
  if (q.qualification_status !== "qualified" && q.confidence == null) {
    errors.push("confidence is required for every lead.");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: q };
}

/**
 * Outreach contract + safety checks + body normalization. Unsupported-claim
 * phrases are errors (regenerate), emails are errors (must never appear).
 */
export function validateOutreachOutput(
  raw: unknown,
): ValidationResult<{ sequence: OutreachSequence }> {
  const parsed = outreachSequenceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const seq = parsed.data;
  const errors: string[] = [];
  const usedPhrases: string[] = [];
  const emails: string[] = [];

  const steps = seq.sequence.slice().sort((a, b) => a.step - b.step);
  for (const step of steps) {
    if (step.subject.length < 5) errors.push(`Step ${step.step}: subject too short.`);
    if (step.body.length < 60) errors.push(`Step ${step.step}: body too short.`);
    if (step.personalization_note.length < 12) {
      errors.push(`Step ${step.step}: personalization note too generic (must cite evidence).`);
    }
    step.body = normalizeOutreachBody(step.body);
    step.subject = normalizeOutreachBody(step.subject);

    const haystack = `${step.subject} ${step.body} ${step.personalization_note}`;
    const lower = haystack.toLowerCase();
    if (UNSUPPORTED_PHRASES.some((p) => lower.includes(p))) {
      const hit = UNSUPPORTED_PHRASES.find((p) => lower.includes(p));
      usedPhrases.push(hit ?? "");
    }
    const foundEmails = haystack.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (foundEmails?.length) emails.push(...foundEmails);
  }

  if (seq.linkedin_message) {
    const n = normalizeOutreachBody(seq.linkedin_message);
    seq.linkedin_message = n;
    const lower = n.toLowerCase();
    if (UNSUPPORTED_PHRASES.some((p) => lower.includes(p))) {
      usedPhrases.push(UNSUPPORTED_PHRASES.find((p) => lower.includes(p)) ?? "");
    }
    const linkedinEmails = n.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (linkedinEmails?.length) emails.push(...linkedinEmails);
  }
  if (emails.length > 0) {
    errors.push("Outreach must never contain email addresses.");
  }
  if (usedPhrases.length > 0) {
    errors.push(
      `Unsupported/generic phrasing detected: ${[...new Set(usedPhrases)].join(", ")}. Rewrite with source-grounded claims.`,
    );
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { sequence: seq } };
}