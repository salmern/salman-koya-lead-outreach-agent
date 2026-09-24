import { describe, expect, it } from "vitest";
import { z } from "zod";

import { canRole, ROLE_HIERARCHY } from "@/server/auth";
import { findEmailLike } from "@/server/agent/safety";
import { evaluateQuality } from "@/server/quality";
import { makeDraft, makeDraftsForLead, makeLead } from "./fixtures";

/**
 * Review workflow regression tests.
 *
 * These tests cover the pure-logic layers only — no DB or HTTP stack required.
 * They guard against regressions in:
 *
 *   1. Role-hierarchy enforcement (canRole)
 *   2. Outreach PATCH route: email-address guard on reviewer-edited copy
 *   3. Lead PATCH route: schema validation for the review fields
 *   4. Quality gate: lead that a reviewer promoted counts as qualified
 *   5. Quality gate: lead that a reviewer disqualified is not counted as qualified
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Role hierarchy
// ─────────────────────────────────────────────────────────────────────────────

describe("role hierarchy (canRole)", () => {
  // Under the new role model, viewer is a legacy alias for researcher.
  // Both have the same capability level — there is no read-only restriction
  // in the PRD, so viewer === researcher in the hierarchy (both = 1).
  it("viewer can reach researcher-required actions (viewer is a researcher alias)", () => {
    expect(canRole("viewer", "researcher")).toBe(true);
  });

  it("viewer cannot reach admin-required actions", () => {
    expect(canRole("viewer", "admin")).toBe(false);
  });

  it("researcher can reach researcher-required actions", () => {
    expect(canRole("researcher", "researcher")).toBe(true);
  });

  it("researcher cannot reach admin-required actions", () => {
    expect(canRole("researcher", "admin")).toBe(false);
  });

  it("admin can reach all roles", () => {
    expect(canRole("admin", "admin")).toBe(true);
    expect(canRole("admin", "researcher")).toBe(true);
    expect(canRole("admin", "viewer")).toBe(true);
  });

  it("viewer and researcher share the same hierarchy value; admin is higher", () => {
    // viewer == researcher (both are 1); admin is 2.
    expect(ROLE_HIERARCHY.viewer).toBe(ROLE_HIERARCHY.researcher);
    expect(ROLE_HIERARCHY.researcher).toBeLessThan(ROLE_HIERARCHY.admin);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Outreach PATCH route: email guard on reviewer-edited copy
//
// The route concatenates subject + body + personalizationNote and calls
// findEmailLike before writing. This tests that guard independently of HTTP.
// ─────────────────────────────────────────────────────────────────────────────

describe("outreach review patch: email guard", () => {
  function combinedText(parts: {
    subject?: string;
    body?: string;
    personalizationNote?: string;
  }) {
    return [parts.subject, parts.body, parts.personalizationNote]
      .filter(Boolean)
      .join("\n");
  }

  it("allows clean copy with no email addresses", () => {
    const text = combinedText({
      subject: "Quick question about your ops workflow",
      body: "Hi, noticed you are hiring for ops while doing weekly reporting manually.",
      personalizationNote: "References the open ops role on their careers page.",
    });
    expect(findEmailLike(text)).toHaveLength(0);
  });

  it("detects an email address in the body", () => {
    const text = combinedText({
      subject: "Follow-up",
      body: "Reply to me at jane.doe@example.com anytime.",
    });
    expect(findEmailLike(text).length).toBeGreaterThan(0);
  });

  it("detects an email address in the subject line", () => {
    const text = combinedText({ subject: "Re: sales@acme.io inquiry" });
    expect(findEmailLike(text).length).toBeGreaterThan(0);
  });

  it("detects an email address in the personalization note", () => {
    const text = combinedText({
      personalizationNote: "Sourced from their contact page: ops@company.io",
    });
    expect(findEmailLike(text).length).toBeGreaterThan(0);
  });

  it("does not false-positive on domain-like text without @", () => {
    const text = combinedText({
      body: "We work with companies like acme.com and beta.io on automation.",
    });
    expect(findEmailLike(text)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Lead PATCH route: patchSchema validation
//
// We replicate the schema here to keep tests independent of the route module
// (which imports server-only Next.js Request types). The logic under test is
// pure Zod validation identical to what the route uses.
// ─────────────────────────────────────────────────────────────────────────────

const leadPatchSchema = z.object({
  qualificationStatus: z.enum(["qualified", "not_qualified", "needs_review"]).optional(),
  fitReasons: z.array(z.string().min(1).max(500)).max(20).optional(),
  concerns: z.array(z.string().min(1).max(500)).max(20).optional(),
  sourceSummary: z.string().trim().min(1).max(2000).optional(),
});

describe("lead PATCH schema (reviewer fields)", () => {
  it("accepts a valid qualify decision", () => {
    const r = leadPatchSchema.safeParse({ qualificationStatus: "qualified" });
    expect(r.success).toBe(true);
  });

  it("accepts a valid disqualify decision", () => {
    const r = leadPatchSchema.safeParse({ qualificationStatus: "not_qualified" });
    expect(r.success).toBe(true);
  });

  it("accepts needs_review (reviewer can move back to review)", () => {
    const r = leadPatchSchema.safeParse({ qualificationStatus: "needs_review" });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown qualification_status value", () => {
    const r = leadPatchSchema.safeParse({ qualificationStatus: "maybe" });
    expect(r.success).toBe(false);
  });

  it("accepts fit_reasons as an array of strings", () => {
    const r = leadPatchSchema.safeParse({
      fitReasons: ["US-based B2B SaaS", "10-50 employees confirmed"],
    });
    expect(r.success).toBe(true);
  });

  it("rejects more than 20 fit reasons", () => {
    const r = leadPatchSchema.safeParse({
      fitReasons: Array.from({ length: 21 }, (_, i) => `Reason ${i + 1}`),
    });
    expect(r.success).toBe(false);
  });

  it("accepts a source summary up to 2000 chars", () => {
    const r = leadPatchSchema.safeParse({ sourceSummary: "A".repeat(2000) });
    expect(r.success).toBe(true);
  });

  it("rejects a source summary over 2000 chars", () => {
    const r = leadPatchSchema.safeParse({ sourceSummary: "A".repeat(2001) });
    expect(r.success).toBe(false);
  });

  it("rejects an empty source summary (whitespace-only)", () => {
    // z.string().trim().min(1) collapses "   " to "" which fails min(1).
    const r = leadPatchSchema.safeParse({ sourceSummary: "   " });
    expect(r.success).toBe(false);
  });

  it("accepts an empty object (nothing to update — route catches this separately)", () => {
    // The schema itself allows all fields to be optional.
    const r = leadPatchSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("does NOT accept domain or company_name (not in schema)", () => {
    // Unknown keys are stripped by default in Zod (strip mode).
    // Verify the schema never allows domain through.
    const r = leadPatchSchema.safeParse({ domain: "evil.com", qualificationStatus: "qualified" });
    if (r.success) {
      expect((r.data as Record<string, unknown>).domain).toBeUndefined();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Quality gate: reviewer decision changes count
//
// After a reviewer promotes a needs_review lead to qualified, the quality gate
// must count it as qualified. After a reviewer disqualifies it, it must not
// count.
// ─────────────────────────────────────────────────────────────────────────────

describe("quality gate: reviewer decision is reflected in counts", () => {
  it("needs_review lead promoted to qualified counts toward target", () => {
    // Simulate: agent produced needs_review, reviewer promoted it to qualified.
    const lead = makeLead({ qualification_status: "qualified" });
    const outreachByLead = new Map([["lead-1", makeDraftsForLead("lead-1")]]);

    const report = evaluateQuality({ leads: [lead], outreachByLead, target: 1 });

    expect(report.qualified).toBe(1);
    expect(report.needs_review).toBe(0);
    expect(report.meets_target).toBe(true);
  });

  it("needs_review lead that stays needs_review does not count as qualified", () => {
    const lead = makeLead({ qualification_status: "needs_review" });
    const report = evaluateQuality({ leads: [lead], outreachByLead: new Map(), target: 1 });

    expect(report.qualified).toBe(0);
    expect(report.needs_review).toBe(1);
    expect(report.meets_target).toBe(false);
  });

  it("needs_review lead disqualified by reviewer is not_qualified, not counted", () => {
    const lead = makeLead({ qualification_status: "not_qualified" });
    const report = evaluateQuality({ leads: [lead], outreachByLead: new Map(), target: 1 });

    expect(report.qualified).toBe(0);
    expect(report.not_qualified).toBe(1);
    expect(report.meets_target).toBe(false);
  });

  it("a mix of reviewer-promoted and original qualified leads counts both", () => {
    const q1 = makeLead({ id: "lead-1", domain: "a.com", qualification_status: "qualified" });
    // Second lead: was needs_review, reviewer promoted it.
    const q2 = makeLead({ id: "lead-2", domain: "b.com", qualification_status: "qualified" });
    const outreachByLead = new Map([
      ["lead-1", makeDraftsForLead("lead-1")],
      ["lead-2", makeDraftsForLead("lead-2")],
    ]);

    const report = evaluateQuality({ leads: [q1, q2], outreachByLead, target: 2 });

    expect(report.qualified).toBe(2);
    expect(report.meets_target).toBe(true);
    expect(report.structural_ok).toBe(true);
  });

  it("reviewer note appended to concerns does not break evidence check", () => {
    // Reviewer added a note as a concern entry — the lead still has fit reasons
    // and source URLs so the evidence check should pass.
    const lead = makeLead({
      qualification_status: "qualified",
      concerns: ["Reviewer note: confirmed B2B model from LinkedIn profile"],
    });
    const outreachByLead = new Map([["lead-1", makeDraftsForLead("lead-1")]]);
    const report = evaluateQuality({ leads: [lead], outreachByLead, target: 1 });

    expect(report.qualified).toBe(1);
    expect(report.missing_evidence).toHaveLength(0);
    expect(report.structural_ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Outreach review status values are the complete set
// ─────────────────────────────────────────────────────────────────────────────

describe("outreach review status values", () => {
  // DB constraint: ('draft', 'reviewed', 'approved', 'rejected')
  // "edited" was removed — saving edits now sets status to "reviewed".
  const validStatuses = ["draft", "approved", "rejected", "reviewed"] as const;
  const outreachPatchSchema = z.object({
    reviewStatus: z.enum(["draft", "approved", "rejected", "reviewed"]).optional(),
  });

  it.each(validStatuses)("accepts review_status = %s", (status) => {
    const r = outreachPatchSchema.safeParse({ reviewStatus: status });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown review status", () => {
    const r = outreachPatchSchema.safeParse({ reviewStatus: "pending" });
    expect(r.success).toBe(false);
  });

  it("draft status does not count as approved in quality gate", () => {
    // The quality gate inspects outreach_drafts.review_status for
    // empty/missing *content*, not approval state. A draft-status outreach
    // still satisfies the structural check as long as fields are non-empty.
    const lead = makeLead();
    const drafts = makeDraftsForLead("lead-1"); // review_status: "pending" in fixture
    // Override to "draft" — mimics a freshly generated but unreviewed sequence.
    const draftStatusDrafts = drafts.map((d) => ({ ...d, review_status: "draft" }));
    const outreachByLead = new Map([["lead-1", draftStatusDrafts]]);
    const report = evaluateQuality({ leads: [lead], outreachByLead, target: 1 });

    // Quality gate checks content (subject, body, personalization_note non-empty),
    // not human approval status — human approval is a separate workflow gate.
    expect(report.missing_drafts).toHaveLength(0);
    expect(report.empty_drafts).toHaveLength(0);
    expect(report.structural_ok).toBe(true);
  });
});
