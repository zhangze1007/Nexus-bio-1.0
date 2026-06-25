/**
 * Tiered Executor — Layer 2-3 of NEXAI Cognitive Kernel
 *
 * Executes queries based on the routing decision from cognitiveRouter.
 * Each tier has different cost/quality tradeoffs:
 *
 *   Tier 0: Cache → return cached response ($0, <10ms)
 *   Tier 1: Solver direct → call pipeline, template response ($0, 100-500ms)
 *   Tier 2: Solver + LLM explain → solver + small LLM call ($0.0003, 1-3s)
 *   Tier 3: LLM reasoning → full LLM call ($0.001, 3-8s)
 *
 * The executor also handles self-correction: if the LLM makes numerical
 * claims that contradict solver output, it injects corrections.
 */

import type { AxonAdapterContext } from "./AxonOrchestrator";
import type { CachedResponse, RoutingDecision } from "./cognitiveRouter";
import { formatSolverResult, routeQuery, setCachedResponse } from "./cognitiveRouter";

// ── Executor Result ────────────────────────────────────────────────────────

export interface ExecutorResult {
  text: string;
  tier: string;
  solverCalls: Array<{ solver: string; description: string }>;
  confidence: number;
  cached: boolean;
  costEstimate: number; // USD
  latencyMs: number;
  correctionApplied: boolean;
}

// ── Pipeline Executor Map ──────────────────────────────────────────────────

type PipelineExecutor = (input: unknown) => Promise<unknown>;

const pipelineExecutors = new Map<string, PipelineExecutor>();

async function getPipelineExecutor(pipeline: string): Promise<PipelineExecutor | null> {
  if (pipelineExecutors.has(pipeline)) return pipelineExecutors.get(pipeline)!;

  let executor: PipelineExecutor | null = null;

  switch (pipeline) {
    case "fbaStrainPipeline": {
      const mod = await import("../server/fbaStrainPipeline");
      executor = (input) => mod.runStrainDesignPipeline(input as Parameters<typeof mod.runStrainDesignPipeline>[0]);
      break;
    }
    case "identifyBottlenecks": {
      const mod = await import("./CatalystDesignerEngine");
      executor = (input) =>
        Promise.resolve(mod.identifyBottlenecks(input as Parameters<typeof mod.identifyBottlenecks>[0]));
      break;
    }
    case "proevolPipeline": {
      const mod = await import("../server/proevolPipeline");
      executor = (input) =>
        Promise.resolve(mod.runProteinDesignPipeline(input as Parameters<typeof mod.runProteinDesignPipeline>[0]));
      break;
    }
    case "robustnessPipeline": {
      const mod = await import("../server/robustnessPipeline");
      executor = (input) =>
        Promise.resolve(
          mod.runRobustnessPredictor(
            ((input as Record<string, unknown>)?.singleCellData as Parameters<typeof mod.runRobustnessPredictor>[0]) ??
              [],
            undefined,
            ((input as Record<string, unknown>)?.nTrials as number) ?? 200,
          ),
        );
      break;
    }
    case "circuitReasonerPipeline": {
      const mod = await import("../server/circuitReasonerPipeline");
      executor = (input) =>
        Promise.resolve(mod.runCircuitReasoner(input as Parameters<typeof mod.runCircuitReasoner>[0]));
      break;
    }
    case "cethxPipeline": {
      const mod = await import("../server/cethxPipeline");
      executor = (input) =>
        Promise.resolve(mod.runThermodynamicPipeline(input as Parameters<typeof mod.runThermodynamicPipeline>[0]));
      break;
    }
    case "dynconPipeline": {
      const mod = await import("../server/dynconPipeline");
      executor = (input) =>
        Promise.resolve(mod.runControlDesignPipeline(input as Parameters<typeof mod.runControlDesignPipeline>[0]));
      break;
    }
    case "scspatialPipeline": {
      const mod = await import("../server/scspatialPipeline");
      executor = (input) =>
        Promise.resolve(mod.runScSpatialPipeline(input as Parameters<typeof mod.runScSpatialPipeline>[0]));
      break;
    }
    case "multioPipeline": {
      const mod = await import("../server/multioPipeline");
      executor = (input) =>
        Promise.resolve(mod.runMultiOmicsPipeline(input as Parameters<typeof mod.runMultiOmicsPipeline>[0]));
      break;
    }
    case "genmimPipeline": {
      const mod = await import("../server/genmimPipeline");
      executor = (input) => mod.runMinimizationPipeline(input as Parameters<typeof mod.runMinimizationPipeline>[0]);
      break;
    }
    case "nexaiPipeline": {
      const mod = await import("../server/nexaiPipeline");
      executor = (input) => {
        const p = input as Record<string, unknown>;
        return Promise.resolve(
          mod.runResearchPipeline(
            (p?.question as Parameters<typeof mod.runResearchPipeline>[0]) ?? { topic: "", subtopics: [] },
            (p?.papers as Parameters<typeof mod.runResearchPipeline>[1]) ?? [],
          ),
        );
      };
      break;
    }
  }

  if (executor) pipelineExecutors.set(pipeline, executor);
  return executor;
}

// ── LLM Caller ─────────────────────────────────────────────────────────────

interface LLMCallResult {
  text: string;
  provider: string;
  tokensUsed: number;
}

async function callLLM(
  query: string,
  context: string,
  solverResult: unknown | null,
  signal?: AbortSignal,
): Promise<LLMCallResult> {
  const body: Record<string, unknown> = {
    query: solverResult
      ? `${query}\n\n[Solver result for context]:\n${JSON.stringify(solverResult, null, 2).substring(0, 2000)}`
      : query,
  };
  if (context) body.context = context;

  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`LLM API returned ${response.status}`);
  }

  const data = await response.json();
  return {
    text: data.text ?? data.answer ?? "",
    provider: data.provider ?? "unknown",
    tokensUsed: data.tokensUsed ?? 0,
  };
}

// ── Self-Correction ────────────────────────────────────────────────────────

/**
 * Check if the LLM response contains numerical claims that contradict
 * the solver output. If so, inject a correction note.
 */
function applySelfCorrection(
  llmText: string,
  solverResult: unknown,
  solverName: string,
): { text: string; corrected: boolean } {
  if (!solverResult || typeof solverResult !== "object") {
    return { text: llmText, corrected: false };
  }

  const r = solverResult as Record<string, unknown>;
  const corrections: string[] = [];

  // Check growth rate claims
  if (r.growthRate !== undefined && typeof r.growthRate === "number") {
    const claimMatch = llmText.match(/growth\s+rate\s+(?:of\s+|is\s+)?(?:approximately\s+|~)?(\d+\.?\d*)/i);
    if (claimMatch) {
      const claimed = parseFloat(claimMatch[1]);
      const actual = r.growthRate as number;
      if (Math.abs(claimed - actual) / Math.max(actual, 0.001) > 0.1) {
        corrections.push(`Growth rate: solver computed ${actual} h⁻¹, not ${claimed} h⁻¹`);
      }
    }
  }

  // Check ΔΔG claims
  if (r.ddG !== undefined && typeof r.ddG === "number") {
    const claimMatch = llmText.match(/ΔΔG\s+(?:of\s+|is\s+)?(?:approximately\s+|~)?(-?\d+\.?\d*)/i);
    if (claimMatch) {
      const claimed = parseFloat(claimMatch[1]);
      const actual = r.ddG as number;
      if (Math.abs(claimed - actual) > 0.5) {
        corrections.push(`ΔΔG: solver computed ${actual} kcal/mol, not ${claimed} kcal/mol`);
      }
    }
  }

  if (corrections.length === 0) {
    return { text: llmText, corrected: false };
  }

  const correctionNote = `\n\n> **Numerical correction** (${solverName}): ${corrections.join("; ")}`;
  return { text: llmText + correctionNote, corrected: true };
}

// ── Main Executor ──────────────────────────────────────────────────────────

/**
 * Execute a query through the tiered execution system.
 *
 * @param query - User's natural language query
 * @param workbenchContext - Serialized workbench state
 * @param signal - Abort signal
 * @returns Executor result with text, tier, cost, and confidence
 */
export async function executeQuery(
  query: string,
  workbenchContext?: string,
  signal?: AbortSignal,
): Promise<ExecutorResult> {
  const startTime = Date.now();

  // Route the query
  const decision = routeQuery(query, workbenchContext);

  // Tier 0: Cache hit
  if (decision.tier === "cache" && decision.cachedResponse) {
    return {
      text: formatCachedResponse(decision.cachedResponse),
      tier: "cache",
      solverCalls: decision.cachedResponse.solverCalls ?? [],
      confidence: 0.9,
      cached: true,
      costEstimate: 0,
      latencyMs: Date.now() - startTime,
      correctionApplied: false,
    };
  }

  // Tier 1: Solver direct
  if (decision.tier === "solver-direct" && decision.pipeline) {
    const executor = await getPipelineExecutor(decision.pipeline);
    if (executor) {
      try {
        const result = await executor({});
        const text = formatSolverResult(decision.solver ?? decision.pipeline, result);
        const solverCalls =
          ((result as Record<string, unknown>)?.allSolverCalls as Array<{ solver: string; description: string }>) ?? [];

        // Cache the result
        const cacheKey = hashQueryForCache(query, workbenchContext);
        setCachedResponse(cacheKey, { result, timestamp: Date.now(), tier: "solver-direct", solverCalls });

        return {
          text,
          tier: "solver-direct",
          solverCalls,
          confidence: 0.85,
          cached: false,
          costEstimate: 0,
          latencyMs: Date.now() - startTime,
          correctionApplied: false,
        };
      } catch (err) {
        // Solver failed — fall through to LLM
        console.warn(`[TieredExecutor] Solver ${decision.pipeline} failed:`, err);
      }
    }
  }

  // Tier 2: Solver + LLM explain
  if (decision.tier === "solver-explain" && decision.pipeline) {
    const executor = await getPipelineExecutor(decision.pipeline);
    let solverResult: unknown = null;
    let solverCalls: Array<{ solver: string; description: string }> = [];

    if (executor) {
      try {
        solverResult = await executor({});
        solverCalls =
          ((solverResult as Record<string, unknown>)?.allSolverCalls as Array<{
            solver: string;
            description: string;
          }>) ?? [];
      } catch (solverErr) {
        console.warn(
          "[TieredExecutor] Solver failed in explain tier, proceeding with LLM only:",
          solverErr instanceof Error ? solverErr.message : solverErr,
        );
      }
    }

    try {
      const llm = await callLLM(query, workbenchContext ?? "", solverResult, signal);
      const { text, corrected } = applySelfCorrection(llm.text, solverResult, decision.solver ?? decision.pipeline);

      // Cache
      const cacheKey = hashQueryForCache(query, workbenchContext);
      setCachedResponse(cacheKey, {
        result: { text, solverResult },
        timestamp: Date.now(),
        tier: "solver-explain",
        solverCalls,
      });

      return {
        text,
        tier: "solver-explain",
        solverCalls,
        confidence: 0.75,
        cached: false,
        costEstimate: 0.0003,
        latencyMs: Date.now() - startTime,
        correctionApplied: corrected,
      };
    } catch {
      // LLM failed — return solver result only
      if (solverResult) {
        return {
          text: formatSolverResult(decision.solver ?? decision.pipeline, solverResult),
          tier: "solver-direct-fallback",
          solverCalls,
          confidence: 0.6,
          cached: false,
          costEstimate: 0,
          latencyMs: Date.now() - startTime,
          correctionApplied: false,
        };
      }
    }
  }

  // Tier 3: LLM reasoning
  try {
    const llm = await callLLM(query, workbenchContext ?? "", null, signal);

    // Cache
    const cacheKey = hashQueryForCache(query, workbenchContext);
    setCachedResponse(cacheKey, { result: llm.text, timestamp: Date.now(), tier: "llm-reasoning" });

    return {
      text: llm.text,
      tier: "llm-reasoning",
      solverCalls: [],
      confidence: 0.6,
      cached: false,
      costEstimate: 0.001,
      latencyMs: Date.now() - startTime,
      correctionApplied: false,
    };
  } catch (err) {
    return {
      text: `I encountered an error processing your query: ${err instanceof Error ? err.message : "Unknown error"}. Please try again or rephrase your question.`,
      tier: "error",
      solverCalls: [],
      confidence: 0,
      cached: false,
      costEstimate: 0,
      latencyMs: Date.now() - startTime,
      correctionApplied: false,
    };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function hashQueryForCache(query: string, context?: string): string {
  const normalized = query.toLowerCase().trim().replace(/\s+/g, " ");
  const ctxHash = context ? context.substring(0, 200) : "";
  return `${normalized}||${ctxHash}`;
}

function formatCachedResponse(cached: CachedResponse): string {
  if (typeof cached.result === "string") return cached.result;
  if (cached.result && typeof cached.result === "object") {
    const r = cached.result as Record<string, unknown>;
    if (r.text) return r.text as string;
    if (r.solverResult) return formatSolverResult("cached", r.solverResult);
  }
  return JSON.stringify(cached.result, null, 2);
}
