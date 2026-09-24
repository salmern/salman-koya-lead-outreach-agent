import { findEmailLike, findUnsupportedClaims } from "@/server/agent/safety";
import { normalizeDomain } from "@/lib/utils";
import type { LeadRow, OutreachRow } from "@/server/db";
import type { DiscoveryCandidate, QualityReport } from "@/server/types";

export interface QualityInput {
  leads: LeadRow[];
  outreachByLead: Map<string, OutreachRow[]>;
  /** Discovered candidates not yet turned into leads (used to surface unresolved websites). */
  pendingCandidates?: DiscoveryCandidate[];
  target: number;
  notes?: string[];
}

/**
 * Deterministic application-level quality gate. This does not rely on Claude
 * saying "looks good" — it inspects the stored records directly.
 *
 * Needs-review leads are never counted as qualified. Pure and side-effect free
 * so the structural/safety rules are unit-testable without a database.
 */
export function evaluateQuality(input: QualityInput): QualityReport {
  const { leads, outreachByLead, target } = input;

  const qualified = leads.filter((l) => l.qualification_status === "qualified");
  const notQualified = leads.filter((l) => l.qualification_status === "not_qualified");
  const needsReview = leads.filter((l) => l.qualification_status === "needs_review");

  const domainCounts = new Map<string, number>();
  for (const lead of leads) {
    const d = normalizeDomain(lead.domain);
    domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1);
  }
  const duplicateDomains = [...domainCounts.entries()].filter(([, c]) => c > 1).map(([d]) => d);

  const missingEvidence: string[] = [];
  const missingDrafts: string[] = [];
  const emptyDrafts: string[] = [];
  const unsupportedClaims: string[] = [];
  const personalEmailFlags: string[] = [];

  const unresolvedCandidates = (input.pendingCandidates ?? [])
    .filter((c) => !c.company_domain)
    .map((c) => `${c.company_name}${c.linkedin_url ? ` (${c.linkedin_url})` : ""}`);

  for (const lead of qualified) {
    const label = `${lead.company_name} (${lead.domain})`;

    if (!lead.company_name || !lead.domain) missingEvidence.push(`${label}: missing name/domain`);
    if (lead.confidence == null || lead.confidence < 0.4) {
      missingEvidence.push(`${label}: confidence missing or below 0.4`);
    }
    if (!lead.fit_reasons || lead.fit_reasons.length === 0) {
      missingEvidence.push(`${label}: no fit reasons`);
    }
    if (!lead.source_urls || lead.source_urls.length === 0) {
      missingEvidence.push(`${label}: no source URLs`);
    }
    if (!lead.source_summary || lead.source_summary.trim().length < 40) {
      missingEvidence.push(`${label}: source summary missing or too short`);
    }

    const drafts = outreachByLead.get(lead.id) ?? [];
    if (drafts.length < 3) {
      missingDrafts.push(`${label}: only ${drafts.length}/3 drafts`);
    }
    const seenSteps = new Set(drafts.map((d) => d.sequence_step));
    for (const step of [1, 2, 3]) {
      const draft = drafts.find((d) => d.sequence_step === step);
      if (!draft) continue;
      if (!draft.subject?.trim() || !draft.body?.trim() || !draft.personalization_note?.trim()) {
        emptyDrafts.push(`${label}: step ${step} has empty fields`);
      }
    }
    if (seenSteps.size !== drafts.length) {
      emptyDrafts.push(`${label}: duplicate sequence steps`);
    }

    const allText = drafts
      .map((d) => `${d.subject}\n${d.body}\n${d.personalization_note}\n${d.linkedin_message ?? ""}`)
      .join("\n");
    const emails = findEmailLike(allText);
    if (emails.length > 0) personalEmailFlags.push(`${label}: ${emails.length} email-like string(s)`);
    const claims = findUnsupportedClaims(allText);
    if (claims.length > 0) {
      unsupportedClaims.push(`${label}: ${[...new Set(claims)].join(", ")}`);
    }
  }

  // Also scan non-qualified leads' summaries for stored personal emails.
  for (const lead of needsReview) {
    const emails = findEmailLike(`${lead.source_summary ?? ""}`);
    if (emails.length > 0) personalEmailFlags.push(`${lead.company_name}: source summary contains email-like data`);
  }

  const safetyPassed = personalEmailFlags.length === 0 && unsupportedClaims.length === 0;

  const structuralOk =
    duplicateDomains.length === 0 &&
    missingEvidence.length === 0 &&
    missingDrafts.length === 0 &&
    emptyDrafts.length === 0 &&
    safetyPassed;

  const issues: string[] = [];
  if (duplicateDomains.length) issues.push(`${duplicateDomains.length} duplicate domain(s) in the run.`);
  if (missingEvidence.length) issues.push(`${missingEvidence.length} qualified lead(s) missing required evidence.`);
  if (missingDrafts.length) issues.push(`${missingDrafts.length} qualified lead(s) missing a 3-step sequence.`);
  if (emptyDrafts.length) issues.push(`${emptyDrafts.length} draft(s) with empty fields.`);
  if (unsupportedClaims.length) issues.push(`${unsupportedClaims.length} lead(s) contain unsupported/generic claims.`);
  if (personalEmailFlags.length) issues.push(`${personalEmailFlags.length} lead(s) flagged for email-like data.`);
  if (qualified.length < target) {
    issues.push(`${qualified.length} qualified of a target of ${target}; list may be shorter than requested.`);
  }

  const notes = [...(input.notes ?? [])];
  notes.unshift(
    qualified.length === 0
      ? "No companies were qualified. This can happen when the candidate pool did not contain ICP-fit companies. No companies were fabricated."
      : `${qualified.length} qualified lead(s), ${needsReview.length} needs review, ${notQualified.length} not qualified.`,
  );
  if (unresolvedCandidates.length > 0) {
    notes.push(
      `${unresolvedCandidates.length} discovered candidate(s) have no resolvable website and were left as candidates — nothing was fabricated: ${unresolvedCandidates.join("; ")}.`,
    );
  }

  return {
    generated_at: new Date().toISOString(),
    total_candidates: leads.length,
    qualified: qualified.length,
    not_qualified: notQualified.length,
    needs_review: needsReview.length,
    duplicates: duplicateDomains.length,
    duplicate_domains: duplicateDomains,
    unresolved_candidates: unresolvedCandidates,
    missing_evidence: missingEvidence,
    missing_drafts: missingDrafts,
    empty_drafts: emptyDrafts,
    unsupported_claims: unsupportedClaims,
    personal_email_flags: personalEmailFlags,
    safety_passed: safetyPassed,
    structural_ok: structuralOk,
    meets_target: qualified.length >= target,
    target,
    issues,
    notes,
  };
}