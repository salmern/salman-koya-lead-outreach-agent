import "server-only";

import type { RunLimits } from "@/server/types";

/**
 * Shared per-run environment passed to every tool handler. The budget is the
 * hard tool-call cap — the model cannot raise it. `consume()` returns false
 * once the cap is exceeded and the tool must refuse.
 */
export interface ToolBudget {
  count: number;
  max: number;
}

export interface ToolEnv {
  runId: string;
  limits: RunLimits;
  budget: ToolBudget;
  counters: {
    discoveries: number;
    websites: number;
    resolutions: number;
  };
  /** Normalized search queries already used this run (distinct-query guard). */
  discoveryQueries: string[];
  runStartTime: number;
}

export function consumeBudget(env: { budget: ToolBudget }): boolean {
  if (env.budget.count >= env.budget.max) return false;
  env.budget.count += 1;
  return true;
}