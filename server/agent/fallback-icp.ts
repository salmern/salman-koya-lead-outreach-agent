import "server-only";

import { refinedIcpSchema } from "@/server/schemas";
import type { RefinedIcp } from "@/server/types";

const GEOGRAPHY = [
  "united states",
  "usa",
  "us",
  "canada",
  "united kingdom",
  "uk",
  "europe",
  "eu",
  "germany",
  "france",
  "netherlands",
  "australia",
  "singapore",
  "india",
  "uae",
  "global",
  "remote",
];

const HEADCOUNT = [
  /\b(\d{1,4})\s*[-–to]+\s*(\d{1,4})\s*(?:employees|people|staff|headcount)?\b/i,
  /\b(\d{1,3})\s*\+?\s*(?:employees|people|staff|headcount)\b/i,
];

const INDUSTRY_HINTS: Record<string, string> = {
  saas: "B2B SaaS",
  software: "Software",
  agency: "Agency / consultancy",
  fintech: "Fintech",
  healthtech: "Health tech",
  "e-commerce": "E-commerce",
  ecommerce: "E-commerce",
  marketplace: "Marketplace",
  logistics: "Logistics",
  legal: "Legal services",
  accounting: "Accounting / finance services",
  recruiting: "Recruiting / staffing",
  real: "Real estate",
  manufacturing: "Manufacturing",
  construction: "Construction",
  education: "Education",
  nonprofit: "Non-profit",
  "media": "Media",
  "professional services": "Professional services",
};

/**
 * Deterministic ICP refinement used ONLY when the Anthropic integration is not
 * configured. It is explicitly labelled as a non-AI fallback everywhere it is
 * surfaced, so it is never mistaken for agent output.
 */
export function fallbackRefineIcp(objective: string, overrides: Record<string, unknown> = {}): RefinedIcp {
  const text = objective.toLowerCase();

  const geography = GEOGRAPHY.filter((g) => new RegExp(`\\b${g}\\b`, "i").test(text)).map((g) =>
    g === "us" || g === "usa" ? "United States" : g.replace(/\b\w/g, (c) => c.toUpperCase()),
  );

  let headcountRange = "10-100 employees";
  for (const re of HEADCOUNT) {
    const m = text.match(re);
    if (m) {
      headcountRange = m[2] ? `${m[1]}-${m[2]} employees` : `${m[1]}+ employees`;
      break;
    }
  }

  const industries = [
    ...new Set(
      Object.entries(INDUSTRY_HINTS)
        .filter(([key]) => text.includes(key))
        .map(([, label]) => label),
    ),
  ];

  const companyType =
    industries[0] ?? (/b2b|business-to-business/.test(text) ? "B2B company" : "Small to mid-sized company");

  const overrideRecord = Object.fromEntries(
    Object.entries(overrides).filter(([, v]) => v !== undefined && v !== null && `${v}`.trim() !== ""),
  );
  const overrideText = Object.values(overrideRecord)
    .map((v) => (Array.isArray(v) ? v.join(", ") : String(v)))
    .join(" ")
    .toLowerCase();

  const hardFilters = [
    ...(geography.length ? [`Located in ${geography.join(" / ")}`] : ["Geography not explicitly constrained"]),
    `Headcount within ${headcountRange}`,
    /b2b|business|company|startup/.test(`${text} ${overrideText}`)
      ? "Sells to businesses (B2B)"
      : "Operating business with a public website",
  ];

  const softPreferences = [
    "Publishes a public website describing its services and team",
    "Shows signals of repetitive operational work (manual workflows, hiring for ops roles)",
    "Actively growing or hiring",
  ];

  return refinedIcpSchema.parse({
    target_company_type: companyType,
    industries: industries.length ? industries : ["Business services"],
    geography: geography.length ? geography : ["Global"],
    headcount_range: headcountRange,
    buyer_persona:
      "Founder, COO, or operations lead responsible for repetitive operational workflows",
    business_problem:
      "Repetitive operational tasks (data entry, research, scheduling, reporting) consume team time that could be automated with AI assistants",
    hard_filters: hardFilters,
    soft_preferences: softPreferences,
    disqualifiers: [
      "Consumer-only (B2C) product with no business operations",
      "Enterprise (1000+ employees) where Koya's service is out of scope",
      "No publicly accessible website or discoverable public information",
    ],
  });
}