import { describe, expect, it } from "vitest";

import { validateOutreachOutput } from "@/server/agent/validation";
import { normalizeOutreachBody } from "@/server/agent/safety";

/**
 * Scenario 6 — Outreach drafting.
 * Drafts are grounded in the lead's source context and are rejected if they
 * contain email addresses, generic/unsupported praise, or fewer than three
 * steps. Markdown decoration is stripped before storage.
 */
function step(stepNumber: 1 | 2 | 3, overrides: Record<string, unknown> = {}) {
  return {
    step: stepNumber,
    subject: `Quick question about your ops workflow (${stepNumber})`,
    body:
      "Hi there, I noticed your team is hiring for an operations role while still handling weekly reporting manually. We help teams like yours automate that repetitive work with an AI assistant, without adding headcount. Would a short call be useful?",
    personalization_note: "References the open operations role and manual reporting on their site.",
    ...overrides,
  };
}

function sequence(overrides: Record<string, unknown> = {}) {
  return {
    sequence: [step(1), step(2), step(3)],
    linkedin_message: "Hi, quick note about automating your operations reporting workflows.",
    ...overrides,
  };
}

describe("outreach drafting contract (scenario 6)", () => {
  it("accepts a grounded 3-step sequence", () => {
    const result = validateOutreachOutput(sequence());
    expect(result.ok).toBe(true);
  });

  it("rejects a sequence that is not exactly three steps", () => {
    const result = validateOutreachOutput(sequence({ sequence: [step(1), step(2)] }));
    expect(result.ok).toBe(false);
  });

  it("never allows an email address in the copy", () => {
    const bad = sequence();
    bad.sequence = [step(1, { body: `${step(1).body} Email me at jane@acme.com.` }), step(2), step(3)];
    const result = validateOutreachOutput(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("email");
  });

  it("rejects unsupported or generic claims", () => {
    const bad = sequence();
    bad.sequence = [
      step(1, { personalization_note: "Love your cutting-edge world-class product." }),
      step(2),
      step(3),
    ];
    const result = validateOutreachOutput(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ").toLowerCase()).toContain("unsupported");
  });

  it("rejects personalization notes that cite no evidence", () => {
    const result = validateOutreachOutput(
      sequence({ sequence: [step(1, { personalization_note: "Nice." }), step(2), step(3)] }),
    );
    expect(result.ok).toBe(false);
  });

  it("strips markdown decoration from stored copy", () => {
    const normalized = normalizeOutreachBody("**Hi**, here is a point.\n\n- first\n- second");
    expect(normalized).not.toContain("**");
    expect(normalized).not.toContain("- ");
    expect(normalized).toContain("first");
    expect(normalized).toContain("second");
  });
});
