import { z } from "zod";

import type { IcpDraftInput } from "@/server/types";

/**
 * Machine-readable contracts for every Claude output. Nothing produced by the
 * model is trusted without passing one of these schemas plus the semantic
 * completeness checks in server/agent/validation.ts.
 */

export const refinedIcpSchema = z.object({
  target_company_type: z.string().min(1, "target_company_type is required"),
  industries: z.array(z.string().min(1)).default([]),
  geography: z.array(z.string().min(1)).default([]),
  headcount_range: z.string().min(1, "headcount_range is required"),
  buyer_persona: z.string().min(1, "buyer_persona is required"),
  business_problem: z.string().min(1, "business_problem is required"),
  hard_filters: z.array(z.string().min(1)).default([]),
  soft_preferences: z.array(z.string().min(1)).default([]),
  disqualifiers: z.array(z.string().min(1)).default([]),
});

export type RefinedIcp = z.infer<typeof refinedIcpSchema>;

export const disciplineSchema = z.object({
  company_name: z.string().min(1, "company_name is required"),
  company_domain: z
    .string()
    .min(1, "company_domain is required")
    .refine((d) => !/[\/\s@]/.test(d), {
      message: "company_domain must be a bare domain, not a URL or email",
    }),
  qualification_status: z.enum(["qualified", "not_qualified", "needs_review"]),
  confidence: z
    .number()
    .min(0, "confidence must be >= 0")
    .max(1, "confidence must be <= 1"),
  fit_reasons: z.array(z.string().min(1)).default([]),
  concerns: z.array(z.string().min(1)).default([]),
  source_urls: z.array(z.url()).default([]),
  source_summary: z.string().min(1, "source_summary is required"),
});

export type QualificationOutput = z.infer<typeof disciplineSchema>;

export const outreachStepSchema = z.object({
  step: z.literal(1).or(z.literal(2)).or(z.literal(3)),
  subject: z.string().min(1, "subject is required"),
  body: z.string().min(1, "body is required"),
  personalization_note: z.string().min(1, "personalization_note is required"),
});

export const outreachSequenceSchema = z.object({
  sequence: z.array(outreachStepSchema).length(3, "exactly three email steps required"),
  linkedin_message: z.string().default(""),
});

export type OutreachSequence = z.infer<typeof outreachSequenceSchema>;

export const discoveryCandidateSchema = z.object({
  company_name: z.string().min(1),
  company_domain: z.string().default(""),
  linkedin_url: z.string().default(""),
  source: z.string().default("apify"),
  source_context: z.string().default(""),
  employees: z.string().default(""),
  location: z.string().default(""),
  industry: z.string().default(""),
});

export type DiscoveryCandidate = z.infer<typeof discoveryCandidateSchema>;

export const icpDraftInputSchema = z.object({
  target_company_type: z.string().max(200),
  industries: z.string().max(1000),
  geography: z.string().max(500),
  headcount_range: z.string().max(200),
  buyer_persona: z.string().max(300),
  business_problem: z.string().max(1000),
  hard_filters: z.string().max(2000),
  soft_preferences: z.string().max(2000),
  disqualifiers: z.string().max(2000),
});

/** User-facing form for ICP refinement (comma/newline separated strings). */
export function icpFromDraftInput(input: IcpDraftInput): RefinedIcp {
  const split = (s: string) =>
    s
      .split(/[,\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
  return {
    target_company_type: input.target_company_type.trim(),
    industries: split(input.industries),
    geography: split(input.geography),
    headcount_range: input.headcount_range.trim(),
    buyer_persona: input.buyer_persona.trim(),
    business_problem: input.business_problem.trim(),
    hard_filters: split(input.hard_filters),
    soft_preferences: split(input.soft_preferences),
    disqualifiers: split(input.disqualifiers),
  };
}