/**
 * Cognitive Router — Layer 1 of NEXAI Cognitive Kernel
 *
 * Classifies every query into one of 4 execution tiers:
 *   Tier 0: CACHE HIT → return cached response (zero cost)
 *   Tier 1: SOLVER DIRECT → call pipeline solver, template response (zero LLM cost)
 *   Tier 2: SOLVER + LLM EXPLAIN → call solver, LLM explains result (low cost)
 *   Tier 3: LLM REASONING → full LLM call with context (standard cost)
 *
 * Also manages a response cache (5-min TTL) for repeated queries.
 */

import type { AxonTool } from "./AxonOrchestrator";

// ── Execution Tiers ────────────────────────────────────────────────────────

export type ExecutionTier = "cache" | "solver-direct" | "solver-explain" | "llm-reasoning";

export interface RoutingDecision {
  tier: ExecutionTier;
  solver?: AxonTool;
  pipeline?: string;
  reason: string;
  cacheHit: boolean;
  cachedResponse?: CachedResponse;
}

export interface CachedResponse {
  result: unknown;
  timestamp: number;
  tier: ExecutionTier;
  solverCalls?: Array<{ solver: string; description: string }>;
}

// ── Intent Classification ──────────────────────────────────────────────────

interface IntentPattern {
  keywords: string[];
  solver: AxonTool;
  pipeline: string;
  requiresExplanation: boolean;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // Computational intents → Tier 1 (solver direct)
  {
    keywords: ["growth rate", "growth_rate", "growthrate", "biomass", "flux balance", "FBA"],
    solver: "fbasim",
    pipeline: "fbaStrainPipeline",
    requiresExplanation: false,
  },
  {
    keywords: ["bottleneck", "rate-limiting", "rate limiting", "slowest step"],
    solver: "catdes",
    pipeline: "identifyBottlenecks",
    requiresExplanation: false,
  },
  {
    keywords: ["stability", "ddg", "ΔΔG", "delta-delta-g", "mutation effect"],
    solver: "proevol",
    pipeline: "proevolPipeline",
    requiresExplanation: false,
  },
  {
    keywords: ["robustness", "monte carlo", "sensitivity", "parameter variation"],
    solver: "cellfree",
    pipeline: "robustnessPipeline",
    requiresExplanation: false,
  },
  {
    keywords: ["circuit", "oscillator", "toggle switch", "repressilator", "hill function"],
    solver: "gecair",
    pipeline: "circuitReasonerPipeline",
    requiresExplanation: false,
  },
  {
    keywords: ["thermodynamic", "thermo", "ΔG", "delta g", "feasibility", "gibbs"],
    solver: "cethx",
    pipeline: "cethxPipeline",
    requiresExplanation: false,
  },
  {
    keywords: ["control", "PID", "MPC", "bioreactor", "setpoint", "controller"],
    solver: "dyncon",
    pipeline: "dynconPipeline",
    requiresExplanation: false,
  },
  {
    keywords: ["cluster", "spatial", "single-cell", "single cell", "transcriptomics"],
    solver: "scspatial",
    pipeline: "scspatialPipeline",
    requiresExplanation: false,
  },
  {
    keywords: ["multi-omics", "omics", "factor", "MOFA", "integration"],
    solver: "multio",
    pipeline: "multioPipeline",
    requiresExplanation: false,
  },
  {
    keywords: ["genome", "CRISPRi", "knockdown", "minimization", "essential gene"],
    solver: "genmim",
    pipeline: "genmimPipeline",
    requiresExplanation: false,
  },
  {
    keywords: ["cell-free", "cellfree", "TX-TL", "expression", "translation"],
    solver: "cellfree",
    pipeline: "robustnessPipeline",
    requiresExplanation: false,
  },

  // Explanation-required intents → Tier 2 (solver + LLM explain)
  {
    keywords: ["why", "explain", "reason", "cause", "because", "how does"],
    solver: "fbasim",
    pipeline: "fbaStrainPipeline",
    requiresExplanation: true,
  },
  {
    keywords: ["compare", "difference", "which is better", "trade-off", "tradeoff"],
    solver: "fbasim",
    pipeline: "fbaStrainPipeline",
    requiresExplanation: true,
  },

  // Research/literature intents → Tier 3 (LLM reasoning)
  {
    keywords: ["paper", "publication", "reference", "cite", "literature"],
    solver: "nexai",
    pipeline: "nexaiPipeline",
    requiresExplanation: true,
  },
];

// ── Explanation Detection ──────────────────────────────────────────────────

const EXPLANATION_KEYWORDS = [
  "why",
  "explain",
  "reason",
  "cause",
  "how does",
  "what makes",
  "compare",
  "difference",
  "trade-off",
  "tradeoff",
  "which",
  "recommend",
  "suggest",
  "should i",
  "what next",
  "advice",
  "interpret",
  "meaning",
  "implication",
  "significance",
];

function hasExplanationRequest(query: string): boolean {
  const lower = query.toLowerCase();
  return EXPLANATION_KEYWORDS.some((kw) => lower.includes(kw));
}

// ── Solver Detection ──────────────────────────────────────────────────────

function detectSolver(query: string): IntentPattern | null {
  const lower = query.toLowerCase();
  for (const pattern of INTENT_PATTERNS) {
    if (pattern.keywords.some((kw) => lower.includes(kw))) {
      return pattern;
    }
  }
  return null;
}

// ── Response Cache ─────────────────────────────────────────────────────────

const responseCache = new Map<string, CachedResponse>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function hashQuery(query: string, context?: string): string {
  // Simple hash: normalize + combine with context
  const normalized = query.toLowerCase().trim().replace(/\s+/g, " ");
  const ctxHash = context ? context.substring(0, 200) : "";
  return `${normalized}||${ctxHash}`;
}

function getCachedResponse(key: string): CachedResponse | null {
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return cached;
}

export function setCachedResponse(key: string, response: CachedResponse): void {
  // Cap cache size at 100 entries
  if (responseCache.size > 100) {
    const oldest = responseCache.keys().next().value;
    if (oldest) responseCache.delete(oldest);
  }
  responseCache.set(key, { ...response, timestamp: Date.now() });
}

export function clearResponseCache(): void {
  responseCache.clear();
}

// ── Router ────────────────────────────────────────────────────────────────

/**
 * Route a query to the appropriate execution tier.
 *
 * @param query - User's natural language query
 * @param workbenchContext - Optional serialized workbench state for cache key
 * @returns Routing decision with tier, solver, and cached response if available
 */
export function routeQuery(query: string, workbenchContext?: string): RoutingDecision {
  const cacheKey = hashQuery(query, workbenchContext);

  // Tier 0: Cache hit
  const cached = getCachedResponse(cacheKey);
  if (cached) {
    return {
      tier: "cache",
      reason: "Identical query within cache TTL",
      cacheHit: true,
      cachedResponse: cached,
    };
  }

  // Detect intent
  const intent = detectSolver(query);
  const needsExplanation = hasExplanationRequest(query);

  // Tier 1: Solver direct (computational question, no explanation needed)
  if (intent && !intent.requiresExplanation && !needsExplanation) {
    return {
      tier: "solver-direct",
      solver: intent.solver,
      pipeline: intent.pipeline,
      reason: `Computational query → ${intent.pipeline} solver`,
      cacheHit: false,
    };
  }

  // Tier 2: Solver + LLM explain (computational question, explanation needed)
  if (intent && (intent.requiresExplanation || needsExplanation)) {
    return {
      tier: "solver-explain",
      solver: intent.solver,
      pipeline: intent.pipeline,
      reason: `Computational query with explanation → ${intent.pipeline} + LLM`,
      cacheHit: false,
    };
  }

  // Tier 3: LLM reasoning (open-ended, no specific solver)
  return {
    tier: "llm-reasoning",
    reason: "Open-ended query → full LLM reasoning",
    cacheHit: false,
  };
}

/**
 * Format a solver result as a template-based response (Tier 1).
 * No LLM call — just structured data presentation.
 */
export function formatSolverResult(solver: string, result: unknown): string {
  const r = result as Record<string, unknown>;

  switch (solver) {
    case "fbasim":
      if (r.growthRate !== undefined) {
        return `**FBA Result**\n- Growth rate: ${r.growthRate} h⁻¹\n- ATP yield: ${r.atpYield}\n- Carbon efficiency: ${r.carbonEfficiency}%\n- Feasible: ${r.feasible ? "Yes" : "No"}`;
      }
      break;
    case "catdes":
      if (r.topBottleneck) {
        const bn = r.topBottleneck as Record<string, unknown>;
        return `**Bottleneck Analysis**\n- Primary bottleneck: ${bn.enzymeName}\n- Score: ${bn.score}\n- Recommendation: ${bn.recommendation}`;
      }
      break;
    case "proevol":
      if (r.bestDesign) {
        const bd = r.bestDesign as Record<string, unknown>;
        return `**Protein Design**\n- Best design score: ${(bd.scores as Record<string, number>)?.composite}\n- Mutations: ${(bd.mutations as Array<{ position: number; wt: string; mut: string }>)?.length}`;
      }
      break;
    case "cellfree":
      if (r.robustness) {
        const rob = r.robustness as Record<string, unknown>;
        return `**Robustness Score**\n- Overall: ${rob.overallRobustness}\n- Yield robustness: ${(rob.yieldRobustness as Record<string, number>)?.score}\n- Timing robustness: ${(rob.timingRobustness as Record<string, number>)?.score}`;
      }
      break;
    case "gecair":
      if (r.judge) {
        const j = r.judge as Record<string, unknown>;
        return `**Circuit Analysis**\n- Recommended sensitivity: ${j.recommendedSensitivity}\n- Growth burden: ${j.recommendedBurden}\n- Stable: ${j.recommendedStable ? "Yes" : "No"}`;
      }
      break;
    case "cethx":
      if (r.overallFeasible !== undefined) {
        return `**Thermodynamic Analysis**\n- Overall feasible: ${r.overallFeasible ? "Yes" : "No"}\n- ΔG total: ${r.overallDeltaG} kJ/mol\n- Bottleneck steps: ${(r.bottleneckSteps as string[])?.join(", ") ?? "None"}`;
      }
      break;
    case "dyncon":
      if (r.performance) {
        const p = r.performance as Record<string, number>;
        return `**Control Performance**\n- Settling time: ${p.settlingTime} min\n- Overshoot: ${p.overshoot}%\n- Steady-state error: ${p.steadyStateError}\n- Stable: ${p.isStable ? "Yes" : "No"}`;
      }
      break;
  }

  // Generic fallback
  return `**Solver result** (${solver})\n\`\`\`json\n${JSON.stringify(result, null, 2).substring(0, 500)}\n\`\`\``;
}
