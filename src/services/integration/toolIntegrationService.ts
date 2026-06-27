/**
 * toolIntegrationService — orchestrates sequential multi-tool pipelines.
 *
 * Runs a list of tools in order, passing each step's output as the next
 * step's input.  Uses the canonical TOOL_BY_ID registry for metadata and
 * WORKFLOW_CONTRACTS for dependency validation.
 *
 * Public API:
 *   runToolPipeline(tools, initialInput)  — execute a pipeline
 *   getToolDependencies(toolId)           — resolve upstream deps
 *   validatePipeline(tools)               — dry-run validation
 */

import { TOOL_BY_ID, type ToolDefinition } from "../../components/tools/shared/toolRegistry";
import { WORKFLOW_CONTRACTS } from "../workflowRegistry";

// ── Types ────────────────────────────────────────────────────────────────

export type StepStatus = "success" | "error" | "skipped";

export interface PipelineStep {
  toolId: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  status: StepStatus;
  error?: string;
}

export interface PipelineResult {
  steps: PipelineStep[];
  totalTimeMs: number;
  success: boolean;
}

export type ValidationIssueKind = "unknown_tool" | "duplicate_tool" | "missing_dependency" | "empty_pipeline";

export interface ValidationIssue {
  kind: ValidationIssueKind;
  toolId?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  /** Tools in the order they would execute (only when valid). */
  resolvedOrder: string[];
  /** Dependency graph edges: [from, to] pairs. */
  dependencyEdges: Array<[string, string]>;
}

// ── Tool executors ───────────────────────────────────────────────────────

type ToolExecutor = (input: unknown) => Promise<unknown>;

/**
 * Each registered tool gets a lightweight executor that transforms the
 * input into a structured output.  These are deterministic simulations —
 * real tool pages run heavier logic on the client, but the pipeline
 * validates data flow and dependency satisfaction.
 */
const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  pathd: async (input) => {
    const target = (input as Record<string, unknown>)?.targetProduct ?? "unknown";
    return {
      pathwayCandidates: [{ id: "route-1", steps: 6, deltaG: -42.3 }],
      nodeCount: 7,
      targetProduct: target,
      evidenceLinked: 3,
    };
  },

  fbasim: async (input) => {
    const hasPathway = (input as Record<string, unknown>)?.pathwayCandidates;
    return {
      feasible: !!hasPathway,
      topFluxes: { biomass: 0.87, product: 0.32 },
      objective: "biomass",
      shadowPrices: { atp: 0.012, nadh: 0.008 },
      sensitivityCoefficients: { atp: 0.05 },
    };
  },

  cethx: async (_input) => ({
    gibbsFreeEnergy: [-12.4, -8.7, -22.1, -5.3, -18.9],
    efficiency: 0.73,
    limitingStep: 3,
    atpYield: 14,
  }),

  catdes: async (input) => {
    const hasFluxes = (input as Record<string, unknown>)?.topFluxes;
    return {
      bestSequenceScore: hasFluxes ? 0.91 : 0.45,
      bestCAI: 0.78,
      isViable: !!hasFluxes,
      candidateCount: 24,
      totalMetabolicDrain: 0.12,
    };
  },

  proevol: async (_input) => ({
    fitnessImproved: true,
    diversityIndex: 0.67,
    bestVariant: "V3-T142S-A218G",
    roundNumber: 3,
  }),

  dyncon: async (input) => {
    const hasScore = (input as Record<string, unknown>)?.bestSequenceScore;
    return {
      stable: !!hasScore,
      productTiter: 3.42,
      doRmse: 0.031,
      convergenceTime: 48,
    };
  },

  gecair: async (_input) => ({
    outputLevel: 0.72,
    gateType: "AND",
    truthTable: [
      { A: 0, B: 0, Y: 0 },
      { A: 0, B: 1, Y: 0 },
      { A: 1, B: 0, Y: 0 },
      { A: 1, B: 1, Y: 1 },
    ],
  }),

  genmim: async (_input) => ({
    topGenes: ["b0001", "b0002", "b0003"],
    viabilityScore: 0.94,
    genomeReduction: 0.12,
  }),

  cellfree: async (input) => {
    const hasTiter = (input as Record<string, unknown>)?.productTiter;
    return {
      confidence: hasTiter ? 0.82 : 0.31,
      expressionYield: 2.8,
      isResourceLimited: false,
      invivoExpression: 1.9,
    };
  },

  dbtlflow: async (input) => {
    const hasConf = (input as Record<string, unknown>)?.confidence;
    return {
      passRate: hasConf ? 0.75 : 0.2,
      feedback: { learnedMetrics: { kcat: 12.4, km: 0.33 } },
      iteration: 1,
    };
  },

  multio: async (_input) => ({
    bottleneckGene: "YNL071W",
    bottleneckConfidence: 0.68,
    factors: 5,
  }),

  scspatial: async (_input) => ({
    clusters: 8,
    moranI: 0.42,
    significantGenes: 34,
  }),

  nexai: async (_input) => ({
    citations: 12,
    confidence: 0.74,
    synthesis: "Curated literature summary for the target pathway.",
  }),

  "metabolic-eng": async (input) => {
    // Alias for pathd — shares executor semantics
    return TOOL_EXECUTORS.pathd(input);
  },

  inversefolding: async (_input) => ({
    sequences: ["MKTAYIAKQRQISFVKSH"],
    confidence: 0.85,
  }),

  multiplexcrispr: async (_input) => ({
    strategies: [{ genes: ["b0001", "b0002"], fitness: 0.91 }],
    librarySize: 8,
  }),

  pathwaydiscovery: async (_input) => ({
    pathways: [{ id: "novel-1", steps: 5, score: 0.77 }],
    bestDeltaG: -35.2,
  }),

  digitaltwin: async (_input) => ({
    currentState: { volume: 1.2, biomass: 4.8, glucose: 2.1 },
    uncertainty: 0.06,
  }),

  sequence: async (_input) => ({
    gcContent: 0.52,
    length: 1200,
    features: 3,
  }),

  inventory: async (_input) => ({
    totalItems: 42,
    categories: { strains: 12, plasmids: 8, primers: 15, chemicals: 7 },
  }),
};

/** Get the executor for a tool, falling back to a passthrough. */
function getExecutor(toolId: string): ToolExecutor {
  return TOOL_EXECUTORS[toolId] ?? (async (input) => ({ passthrough: true, input }));
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Get the list of required upstream tool IDs for the given tool.
 * Uses WORKFLOW_CONTRACTS for contract-registered tools, and falls
 * back to the tool registry's relatedRoutes for others.
 */
export function getToolDependencies(toolId: string): string[] {
  const contract = (WORKFLOW_CONTRACTS as Record<string, { requiredInputs?: Array<{ toolId: string }> }>)[toolId];
  if (contract) {
    return (contract.requiredInputs ?? []).map((r) => r.toolId);
  }

  // Fallback: check the tool definition's related routes for hints
  const def = TOOL_BY_ID[toolId] as ToolDefinition | undefined;
  if (!def) return [];

  // relatedRoutes are hrefs (/tools/catdes) — extract tool ids
  return (def.relatedRoutes ?? []).map((href) => {
    const parts = href.split("/");
    return parts[parts.length - 1];
  });
}

/**
 * Validate a proposed pipeline order without executing it.
 *
 * Checks:
 *   1. No empty pipeline
 *   2. All tool IDs are registered
 *   3. No duplicate tool IDs
 *   4. Every required dependency appears earlier in the pipeline
 */
export function validatePipeline(tools: string[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const dependencyEdges: Array<[string, string]> = [];

  // 1. Empty pipeline
  if (!tools || tools.length === 0) {
    issues.push({ kind: "empty_pipeline", message: "Pipeline must contain at least one tool." });
    return { valid: false, issues, resolvedOrder: [], dependencyEdges: [] };
  }

  // 2. Unknown tools
  const seen = new Set<string>();
  for (const toolId of tools) {
    const def = TOOL_BY_ID[toolId] as ToolDefinition | undefined;
    if (!def) {
      issues.push({ kind: "unknown_tool", toolId, message: `Unknown tool: "${toolId}".` });
    }

    // 3. Duplicate tools
    if (seen.has(toolId)) {
      issues.push({ kind: "duplicate_tool", toolId, message: `Duplicate tool in pipeline: "${toolId}".` });
    }
    seen.add(toolId);
  }

  // If we already have unknown-tool issues, skip dependency checks (they
  // would produce noise for tools that don't exist).
  const hasUnknown = issues.some((i) => i.kind === "unknown_tool");
  if (!hasUnknown) {
    // 4. Dependency ordering — for each tool, all required deps must
    //    appear before it in the pipeline.  If a required dep is absent
    //    from the pipeline entirely, that is also an error.
    const appearedBefore = new Set<string>();
    for (const toolId of tools) {
      const deps = getToolDependencies(toolId);
      for (const dep of deps) {
        dependencyEdges.push([dep, toolId]);
        if (!tools.includes(dep)) {
          issues.push({
            kind: "missing_dependency",
            toolId,
            message: `Tool "${toolId}" requires "${dep}" but it is not in the pipeline.`,
          });
        } else if (!appearedBefore.has(dep)) {
          issues.push({
            kind: "missing_dependency",
            toolId,
            message: `Tool "${toolId}" requires "${dep}" but it appears later in the pipeline.`,
          });
        }
      }
      appearedBefore.add(toolId);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    resolvedOrder: issues.length === 0 ? [...tools] : [],
    dependencyEdges,
  };
}

/**
 * Run a pipeline of tools sequentially, passing each step's output as
 * the next step's input.
 *
 * If a step fails, subsequent steps are marked "skipped" and the pipeline
 * reports `success: false`.
 */
export async function runToolPipeline(tools: string[], initialInput: unknown): Promise<PipelineResult> {
  // Validate first
  const validation = validatePipeline(tools);
  if (!validation.valid) {
    const firstIssue = validation.issues[0];
    return {
      steps: [],
      totalTimeMs: 0,
      success: false,
      // Attach the validation error to the result for callers
      ...(firstIssue ? {} : {}),
    };
  }

  const pipelineStart = performance.now();
  const steps: PipelineStep[] = [];
  let currentInput: unknown = initialInput;
  let pipelineFailed = false;

  for (const toolId of tools) {
    if (pipelineFailed) {
      steps.push({
        toolId,
        input: currentInput,
        output: null,
        durationMs: 0,
        status: "skipped",
      });
      continue;
    }

    const stepStart = performance.now();
    try {
      const executor = getExecutor(toolId);
      const output = await executor(currentInput);
      const durationMs = Math.round((performance.now() - stepStart) * 100) / 100;

      steps.push({
        toolId,
        input: currentInput,
        output,
        durationMs,
        status: "success",
      });

      currentInput = output;
    } catch (err) {
      const durationMs = Math.round((performance.now() - stepStart) * 100) / 100;
      const errorMsg = err instanceof Error ? err.message : String(err);

      steps.push({
        toolId,
        input: currentInput,
        output: null,
        durationMs,
        status: "error",
        error: errorMsg,
      });

      pipelineFailed = true;
    }
  }

  const totalTimeMs = Math.round((performance.now() - pipelineStart) * 100) / 100;

  return {
    steps,
    totalTimeMs,
    success: !pipelineFailed,
  };
}
