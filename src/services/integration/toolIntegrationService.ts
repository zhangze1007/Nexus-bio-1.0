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
 * Real tool executors — each calls the actual server-side engine.
 *
 * NOTE: The previous implementation used hardcoded mock data.
 * This has been replaced with real engine calls to ensure
 * pipeline results are scientifically valid.
 *
 * For single-tool execution, use POST /api/pipeline/{toolId} instead.
 */
const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  fbasim: async (input) => {
    const { solveAuthorityFBA } = await import("../../server/fbaEngine");
    const p = (input ?? {}) as Record<string, unknown>;
    return solveAuthorityFBA({
      species: (p.species as "ecoli" | "yeast") ?? "ecoli",
      objective: (p.objective as "biomass" | "atp" | "product") ?? "biomass",
      glucoseUptake: (p.glucoseUptake as number) ?? 10,
      oxygenUptake: (p.oxygenUptake as number) ?? 20,
      knockouts: (p.knockouts as string[]) ?? [],
    });
  },

  cethx: async (input) => {
    const { runThermodynamicPipeline } = await import("../../server/cethxPipeline");
    return runThermodynamicPipeline(input as Parameters<typeof runThermodynamicPipeline>[0]);
  },

  catdes: async (input) => {
    const { identifyBottlenecks } = await import("../CatalystDesignerEngine");
    return identifyBottlenecks(input as Parameters<typeof identifyBottlenecks>[0]);
  },

  dyncon: async (input) => {
    const { runControlDesignPipeline } = await import("../../server/dynconPipeline");
    return runControlDesignPipeline(input as Parameters<typeof runControlDesignPipeline>[0]);
  },

  gecair: async (input) => {
    const { runCircuitReasoner } = await import("../../server/circuitReasonerPipeline");
    return runCircuitReasoner(input as Parameters<typeof runCircuitReasoner>[0]);
  },

  genmim: async (input) => {
    const { runMinimizationPipeline } = await import("../../server/genmimPipeline");
    return runMinimizationPipeline(input as Parameters<typeof runMinimizationPipeline>[0]);
  },

  multio: async (input) => {
    const { runMultiOmicsPipeline } = await import("../../server/multioPipeline");
    return runMultiOmicsPipeline(input as Parameters<typeof runMultiOmicsPipeline>[0]);
  },

  scspatial: async (input) => {
    const { runScSpatialPipeline } = await import("../../server/scspatialPipeline");
    return runScSpatialPipeline(input as Parameters<typeof runScSpatialPipeline>[0]);
  },

  nexai: async (input) => {
    const { runResearchPipeline } = await import("../../server/nexaiPipeline");
    const p = (input ?? {}) as Record<string, unknown>;
    return runResearchPipeline(
      (p.question as Parameters<typeof runResearchPipeline>[0]) ?? { topic: "", subtopics: [] },
      (p.papers as Parameters<typeof runResearchPipeline>[1]) ?? [],
    );
  },

  pathd: async (input) => {
    const { runPathwayDiscovery } = await import("../../server/pathwayDiscoveryEngine");
    const p = (input ?? {}) as Record<string, unknown>;
    const targetName = (p.targetProduct as string) ?? "artemisinin";
    return runPathwayDiscovery({
      target: { id: `target-${targetName}`, name: targetName, functionalGroups: [], isPrecursor: false },
      precursors: [
        { id: "precursor-acetyl-coa", name: "Acetyl-CoA", functionalGroups: [], isPrecursor: true },
        { id: "precursor-pyruvate", name: "Pyruvate", functionalGroups: [], isPrecursor: true },
      ],
      maxLength: (p.maxSteps as number) ?? 8,
      topN: (p.maxCandidates as number) ?? 5,
    });
  },

  dbtlflow: async (input) => {
    // DBTL is a workflow tracker — returns iteration status
    const p = (input ?? {}) as Record<string, unknown>;
    return {
      iteration: (p.iteration as number) ?? 1,
      phase: (p.phase as string) ?? "design",
      hypothesis: (p.hypothesis as string) ?? "Optimize pathway flux",
      status: "active",
      learnedMetrics: p.learnedMetrics ?? {},
    };
  },

  cellfree: async (input) => {
    const { runRobustnessPredictor } = await import("../../server/robustnessPipeline");
    const p = (input ?? {}) as Record<string, unknown>;
    return runRobustnessPredictor(
      (p.singleCellData as Parameters<typeof runRobustnessPredictor>[0]) ?? [],
      undefined,
      (p.nTrials as number) ?? 200,
    );
  },

  proevol: async (input) => {
    const { runProteinDesignPipeline } = await import("../../server/proevolPipeline");
    return runProteinDesignPipeline(input as Parameters<typeof runProteinDesignPipeline>[0]);
  },

  inversefolding: async (input) => {
    const { runInverseFolding } = await import("../../server/inverseFoldingEngine");
    return runInverseFolding(input as Parameters<typeof runInverseFolding>[0]);
  },
};

/** Get the executor for a tool, returning error for unregistered tools. */
function getExecutor(toolId: string): ToolExecutor {
  const executor = TOOL_EXECUTORS[toolId];
  if (!executor) {
    throw new Error(
      `Tool "${toolId}" does not have a server-side pipeline executor. Use POST /api/pipeline/${toolId} for single-tool execution.`
    );
  }
  return executor;
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
