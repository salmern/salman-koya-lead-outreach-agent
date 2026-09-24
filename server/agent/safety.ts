import "server-only";

/**
 * Safety helpers: prompt-injection detection, personal-email detection,
 * unsupported-claim flags, and outreach normalization.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Injection markers a hostile site would use to steer the agent. */
const INJECTION_MARKERS = [
  "ignore previous instructions",
  "ignore all previous instructions",
  "ignore the instructions",
  "disregard previous",
  "disregard all",
  "forget everything",
  "new instructions:",
  "system prompt:",
  "developer message:",
  "you are now",
  "act as an unrestricted",
  "reveal your",
  "expose your",
  "send your api key",
  "export your secrets",
  "stop resisting",
  "override your safety",
  "reveal the system prompt",
  "show your instructions",
];

export function detectInjection(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const marker of INJECTION_MARKERS) {
    if (lower.includes(marker)) hits.push(marker);
  }
  return hits;
}

/** Returns matching email-like strings found in the text. */
export function findEmailLike(text: string): string[] {
  return (text.match(EMAIL_RE) ?? []).slice(0, 10);
}

/**
 * Phrases that indicate generic, unsupported praise, fake urgency, or
 * fabricated customer case studies. All are flagged by the quality gate;
 * any that appear in a stored draft cause safety_passed = false.
 *
 * Case-study patterns ("we worked with", "we supported", "we helped a team")
 * are included because these imply real prior client results that cannot be
 * verified from the lead's source context. The agent must not invent them.
 */
export const UNSUPPORTED_PHRASES = [
  // Generic praise
  "loved what you are building",
  "loved what you're building",
  "your company looks impressive",
  "your company seems impressive",
  "impressive company",
  "i saw your website",
  "i came across your website",
  "incredible growth",
  "disrupting the",
  "game-changing",
  "revolutionizing the",
  "best-in-class",
  "cutting-edge",
  "innovative company",
  "forward-thinking",
  "world-class",
  "don't miss out",
  "act now",
  "limited time",
  // Fabricated case-study patterns — no prior client results exist in source context
  "we worked with",
  "we worked with a",
  "we recently worked with",
  "we supported",
  "we helped a team",
  "we helped a company",
  "a client of ours",
  "one of our clients",
  "a similar company we",
  "a comparable company we",
  "a comparable bank we",
  "a comparable firm we",
  "freeing up",
  "saving them",
  "cutting about",
  "cut processing time",
  "reducing their",
  "saved them",
  "resulted in",
  "hours of weekly",
  "hours per week",
  "full-time staff",
  "full time staff",
];

export function findUnsupportedClaims(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const phrase of UNSUPPORTED_PHRASES) {
    if (lower.includes(phrase)) hits.push(phrase);
  }
  return hits;
}

/**
 * Strip markdown decoration from outreach bodies while preserving paragraphs
 * and line breaks. Prevents leaked **bold**, list bullets and heading syntax.
 */
export function normalizeOutreachBody(input: string): string {
  let text = input
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/#+\s*/g, "")
    .replace(/`([^`]+)`/g, "$1");

  text = text
    .split("\n")
    .map((line) => line.replace(/^\s*[-*+]\s+/, "").trim())
    .filter((line) => line.length > 0)
    .join("\n\n");

  return text.trim();
}

export function truncateForSummary(text: string, max = 600): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function safeString(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 2000);
  if (value == null) return "";
  return JSON.stringify(value).slice(0, 2000);
}