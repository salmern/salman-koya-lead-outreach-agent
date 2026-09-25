import "server-only";

import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

import { config, effectiveLimits, isExternalIntegrationConfigured } from "@/server/config";
import { getRun, setRunStatus, updateRun } from "@/server/db";
import { refineSystemPrompt, researchSystemPrompt } from "@/server/agent/prompts";
import { fallbackRefineIcp } from "@/server/agent/fallback-icp";
import {
  REFINE_TOOL_NAMES,
  RESEARCH_TOOL_NAMES,
  SKILL_NAMES,
  createRefineToolServer,
  createResearchToolServer,
} from "@/server/agent/tools";
import type { ToolEnv } from "@/server/agent/env";
import { logEvent } from "@/server/agent/logging";
import type { RefinedIcp } from "@/server/types";

const sdkEnv: Record<string, string | undefined> = {
  ...process.env,
  ANTHROPIC_API_KEY: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
  CLAUDE_AGENT_SDK_CLIENT_APP: "koya-lead-agent/1.0.0",
};

export interface AgentOutcome {
  subtype: string;
  isError: boolean;
  resultText: string;
  totalCostUsd: number;
  numTurns: number;
  aborted: boolean;
  errorMessages: string[];
}

function emptyOutcome(overrides: Partial<AgentOutcome> = {}): AgentOutcome {
  return {
    subtype: "unknown",
    isError: false,
    resultText: "",
    totalCostUsd: 0,
    numTurns: 0,
    aborted: false,
    errorMessages: [],
    ...overrides,
  };
}

function buildEnv(runId: string, limits: ToolEnv["limits"], maxToolCalls: number): ToolEnv {
  return {
    runId,
    limits,
    budget: { count: 0, max: maxToolCalls },
    counters: { discoveries: 0, websites: 0, resolutions: 0 },
    discoveryQueries: [],
    runStartTime: Date.now(),
  };
}

async function consume(
  iterator: AsyncGenerator<SDKMessage, void>,
  runId: string,
  abortController: AbortController,
  onResult: (outcome: AgentOutcome) => void,
): Promise<AgentOutcome> {
  let outcome = emptyOutcome();
  let sawResult = false;

  for await (const message of iterator) {
    if (message.type === "assistant") {
      const text = (message.message.content as Array<{ type: string; text?: string }>)
        .filter((block) => block.type === "text" && block.text)
        .map((block) => block.text)
        .join("\n")
        .trim();
      if (text) {
        await logEvent(runId, "AGENT_PROGRESS", text.slice(0, 400), {}).catch(() => {});
      }
    }

    if (message.type === "result") {
      sawResult = true;
      const isError = message.subtype !== "success";
      outcome = {
        subtype: message.subtype,
        isError,
        resultText: message.subtype === "success" ? message.result : "",
        totalCostUsd: message.total_cost_usd ?? 0,
        numTurns: message.num_turns ?? 0,
        aborted: false,
        errorMessages: isError ? (message.errors ?? []) : [],
      };
      onResult(outcome);
    }
  }

  if (!sawResult) {
    outcome = emptyOutcome({ subtype: "no_result", isError: true, errorMessages: ["Agent produced no result message."] });
  }
  if (abortController.signal.aborted) {
    outcome.aborted = true;
  }
  return outcome;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Phase A — ICP refinement
 * ──────────────────────────────────────────────────────────────────────────── */

export async function runRefinePhase(runId: string): Promise<AgentOutcome> {
  const run = await getRun(runId);
  if (!run) throw new Error("Run not found.");

  await updateRun(runId, { status: "refining" });

  // Without an Anthropic key we refuse to pretend AI ran. A clearly-labelled
  // deterministic refinement is used instead so the workflow stays honest.
  if (!isExternalIntegrationConfigured().anthropic) {
    const icp = fallbackRefineIcp(run.original_objective, run.icp_overrides ?? {});
    await updateRun(runId, {
      refined_icp: icp,
      status: "awaiting_confirmation",
      agent_metadata: { ...(run.agent_metadata ?? {}), icp_fallback: true, icp_source: "deterministic-fallback" },
    });
    await logEvent(
      runId,
      "ICP_REFINEMENT_FALLBACK",
      "ANTHROPIC_API_KEY not configured — used deterministic (non-AI) ICP refinement. Review the ICP carefully.",
    );
    return emptyOutcome({ subtype: "fallback", resultText: JSON.stringify(icp) });
  }

  const env = buildEnv(runId, effectiveLimits(run.tool_limits), Math.min(effectiveLimits(run.tool_limits).maxToolCalls, 5));
  const abortController = new AbortController();

  try {
    const iterator = query({
      prompt: "Refine the qualification objective into a final ICP and call the refine_icp tool exactly once.",
      options: {
        cwd: process.cwd(),
        systemPrompt: refineSystemPrompt(run.original_objective, run.icp_overrides ?? {}),
        mcpServers: { koya_icp: createRefineToolServer(env) },
        allowedTools: REFINE_TOOL_NAMES,
        tools: [],
        skills: SKILL_NAMES,
        settingSources: ["project"],
        maxTurns: Math.min(effectiveLimits(run.tool_limits).maxAgentTurns, 8),
        ...(config.claudeModel ? { model: config.claudeModel } : {}),
        abortController,
        env: sdkEnv,
      },
    });
    const outcome = await consume(iterator, runId, abortController, () => {});
    if (outcome.isError && !outcome.aborted) {
      throw new Error(outcome.errorMessages.join("; ") || `Agent stopped: ${outcome.subtype}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Do not leave the run stuck in "refining".
    await logEvent(runId, "AGENT_ERROR", `ICP refinement agent failed: ${message}`);
    throw err;
  }

  const refreshed = await getRun(runId);
  if (!refreshed?.refined_icp) {
    const icp = fallbackRefineIcp(run.original_objective, run.icp_overrides ?? {});
    await updateRun(runId, {
      refined_icp: icp,
      status: "awaiting_confirmation",
      agent_metadata: { ...(refreshed?.agent_metadata ?? {}), icp_fallback: true, icp_source: "deterministic-fallback" },
    });
    await logEvent(runId, "ICP_REFINEMENT_FALLBACK", "Agent did not persist an ICP — used deterministic fallback. Review carefully.");
    return emptyOutcome({ subtype: "fallback", resultText: JSON.stringify(icp) });
  }

  await updateRun(runId, { status: "awaiting_confirmation" });
  return emptyOutcome({ subtype: "success", resultText: JSON.stringify(refreshed.refined_icp) });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Phase B — research, qualification, outreach drafting
 * ──────────────────────────────────────────────────────────────────────────── */

export interface ResearchRunOptions {
  signal?: AbortSignal;
  onProgress?: (outcome: AgentOutcome) => void;
}

export async function runResearchPhase(runId: string, options: ResearchRunOptions = {}): Promise<AgentOutcome> {
  const run = await getRun(runId);
  if (!run) throw new Error("Run not found.");
  if (!run.refined_icp) throw new Error("Cannot research before the ICP is refined and confirmed.");
  if (!isExternalIntegrationConfigured().anthropic) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. The research agent cannot run without it. No leads were fabricated.",
    );
  }

  const limits = effectiveLimits(run.tool_limits);
  const env = buildEnv(runId, limits, limits.maxToolCalls);
  const abortController = new AbortController();
  if (options.signal) {
    if (options.signal.aborted) abortController.abort();
    else options.signal.addEventListener("abort", () => abortController.abort(), { once: true });
  }

  await setRunStatus(runId, "discovering");
  await logEvent(runId, "AGENT_STARTED", "Research agent started.");

  try {
    const iterator = query({
      prompt: run.agent_metadata?.rediscover_hint_query
        ? `Begin the research workflow now. For your first discover_companies call, use this search query: "${run.agent_metadata.rediscover_hint_query}". This query was provided by the user to find a better-fitting candidate pool. Follow the required workflow exactly after that.`
        : "Begin the research workflow now. Follow the required workflow exactly and stop at the configured limits.",
      options: {
        cwd: process.cwd(),
        systemPrompt: researchSystemPrompt({
          objective: run.original_objective,
          icp: run.refined_icp as RefinedIcp,
          limits,
          desiredLeadCount: run.desired_lead_count,
        }),
        mcpServers: { koya_research: createResearchToolServer(env) },
        allowedTools: RESEARCH_TOOL_NAMES,
        tools: [],
        skills: SKILL_NAMES,
        settingSources: ["project"],
        maxTurns: limits.maxAgentTurns,
        ...(config.claudeModel ? { model: config.claudeModel } : {}),
        abortController,
        env: sdkEnv,
      },
    });

    const outcome = await consume(iterator, runId, abortController, (o) => options.onProgress?.(o));

    // Merge into the CURRENT metadata (tools persist discovery/apify run ids into
    // agent_metadata during the run; the stale snapshot from start would wipe them).
    const current = await getRun(runId);
    await updateRun(runId, {
      agent_metadata: {
        ...(current?.agent_metadata ?? {}),
        agent_cost_usd_estimate: outcome.totalCostUsd,
        agent_turns: outcome.numTurns,
        agent_subtype: outcome.subtype,
        tool_calls_used: env.budget.count,
        websites_scraped: env.counters.websites,
      },
    });

    return outcome;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEvent(runId, "AGENT_ERROR", `Research agent error: ${message}`);
    throw err;
  }
}
