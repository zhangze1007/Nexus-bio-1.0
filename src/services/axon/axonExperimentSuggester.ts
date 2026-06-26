/**
 * axonExperimentSuggester — follow-up experiment suggestions.
 *
 * After a tool run completes, the suggester analyzes the result and
 * proposes follow-up experiments. Suggestions are:
 *   - Specific: each references a tool + concrete inputs
 *   - Rationale: every suggestion explains why it follows from the result
 *   - Prioritized: high/medium/low based on scientific impact
 *   - Context-aware: uses workbench state for relevance
 *
 * Non-goals:
 *   - No LLM calls (deterministic heuristics)
 *   - No execution — just suggestions for the user to approve
 *   - No side effects — pure function
 */

import type { WorkbenchCopilotContext } from "../axonContext";

export interface ExperimentSuggestion {
  title: string;
  description: string;
  tool: string;
  suggestedInputs: Record<string, unknown>;
  rationale: string;
  priority: "high" | "medium" | "low";
}

interface SuggestionRule {
  /** Tool that produced the result. */
  sourceTool: string;
  /** Condition to check on the result. */
  condition: (result: unknown, context: WorkbenchCopilotContext) => boolean;
  /** Generate suggestions from the result. */
  suggest: (
    result: unknown,
    context: WorkbenchCopilotContext,
  ) => ExperimentSuggestion[];
}

/**
 * Suggestion rules map tool outputs to follow-up experiment proposals.
 * Each rule can produce multiple suggestions.
 */
const SUGGESTION_RULES: SuggestionRule[] = [
  // After PATHD: suggest FBA and thermodynamic analysis
  {
    sourceTool: "pathd",
    condition: (result, _ctx) => {
      const r = result as Record<string, unknown>;
      return (
        typeof r?.nodeCount === "number" &&
        (r.nodeCount as number) > 0
      );
    },
    suggest: (result, context) => {
      const r = result as Record<string, unknown>;
      const nodeCount = r?.nodeCount as number ?? 0;
      const suggestions: ExperimentSuggestion[] = [];

      suggestions.push({
        title: "Run flux-balance analysis",
        description: `Compute steady-state fluxes for the ${nodeCount}-node pathway to identify bottlenecks and maximum theoretical yield`,
        tool: "fbasim",
        suggestedInputs: {
          species: "ecoli",
          objective: context.targetProduct ? "product" : "biomass",
        },
        rationale:
          "FBA validates the pathway's flux feasibility and identifies rate-limiting steps",
        priority: "high",
      });

      if (nodeCount >= 3) {
        suggestions.push({
          title: "Check thermodynamic feasibility",
          description:
            "Compute delta-G cascade to verify each step is thermodynamically favorable",
          tool: "cethx",
          suggestedInputs: {},
          rationale:
            "Thermodynamic analysis catches energetically infeasible steps before investing in catalyst design",
          priority: "medium",
        });
      }

      return suggestions;
    },
  },

  // After FBASIM: suggest catalyst design for bottlenecks
  {
    sourceTool: "fbasim",
    condition: (result, _ctx) => {
      const r = result as Record<string, unknown>;
      return typeof r?.objectiveValue === "number";
    },
    suggest: (result, context) => {
      const r = result as Record<string, unknown>;
      const suggestions: ExperimentSuggestion[] = [];
      const objValue = r?.objectiveValue as number ?? 0;

      suggestions.push({
        title: "Design catalysts for bottlenecks",
        description: `Use FBA bottleneck data to design enzyme catalysts that improve the objective value (${objValue.toFixed(3)})`,
        tool: "catdes",
        suggestedInputs: {},
        rationale:
          "FBA identified flux bottlenecks; catalyst design targets these rate-limiting steps",
        priority: "high",
      });

      if (objValue < 0.5) {
        suggestions.push({
          title: "Try knockout strategy",
          description:
            "Low objective value suggests competing pathways; try gene knockouts to redirect flux",
          tool: "fbasim",
          suggestedInputs: {
            species: "ecoli",
            objective: context.targetProduct ? "product" : "biomass",
            knockouts: ["EX_ac_e"], // common competing byproduct
          },
          rationale:
            "Low objective value indicates flux leakage; knockouts may redirect carbon to the target",
          priority: "medium",
        });
      }

      suggestions.push({
        title: "Minimize genome for chassis",
        description:
          "Remove non-essential genes to create a streamlined chassis for production",
        tool: "genmim",
        suggestedInputs: {},
        rationale:
          "A minimal chassis reduces metabolic burden and improves product yield",
        priority: "low",
      });

      return suggestions;
    },
  },

  // After CATDES: suggest protein evolution and dynamic control
  {
    sourceTool: "catdes",
    condition: (result, _ctx) => {
      const r = result as Record<string, unknown>;
      return typeof r?.bestSequenceScore === "number";
    },
    suggest: (result, _context) => {
      const r = result as Record<string, unknown>;
      const score = r?.bestSequenceScore as number ?? 0;
      const suggestions: ExperimentSuggestion[] = [];

      suggestions.push({
        title: "Set up dynamic control",
        description:
          "Design a feedback controller to maintain optimal expression of the designed catalyst",
        tool: "dyncon",
        suggestedInputs: {},
        rationale:
          "Dynamic control stabilizes production and prevents metabolic imbalance",
        priority: "high",
      });

      if (score < 0.7) {
        suggestions.push({
          title: "Directed evolution campaign",
          description: `Sequence score (${score.toFixed(2)}) is below optimal; run a directed evolution campaign to improve activity`,
          tool: "proevol",
          suggestedInputs: {},
          rationale:
            "Moderate catalyst score indicates room for improvement through iterative evolution",
          priority: "high",
        });
      }

      suggestions.push({
        title: "Cell-free prototype",
        description:
          "Test the designed catalyst in a cell-free system before in-vivo implementation",
        tool: "cellfree",
        suggestedInputs: {},
        rationale:
          "Cell-free testing provides rapid validation without full cell engineering",
        priority: "medium",
      });

      return suggestions;
    },
  },

  // After DYNCON: suggest cell-free validation
  {
    sourceTool: "dyncon",
    condition: (result, _ctx) => {
      const r = result as Record<string, unknown>;
      return typeof r?.stable === "boolean";
    },
    suggest: (result, _context) => {
      const r = result as Record<string, unknown>;
      const stable = r?.stable as boolean;
      const suggestions: ExperimentSuggestion[] = [];

      if (stable) {
        suggestions.push({
          title: "Cell-free prototyping",
          description:
            "Controller is stable; proceed to cell-free validation of the full system",
          tool: "cellfree",
          suggestedInputs: {},
          rationale:
            "Stable controller validates proceed to cell-free testing",
          priority: "high",
        });
      } else {
        suggestions.push({
          title: "Retune controller parameters",
          description:
            "Controller is unstable; adjust PID gains and setpoint",
          tool: "dyncon",
          suggestedInputs: { retune: true },
          rationale:
            "Unstable controller must be fixed before proceeding to physical experiments",
          priority: "high",
        });
      }

      return suggestions;
    },
  },

  // After CELLFREE: suggest DBTL cycle
  {
    sourceTool: "cellfree",
    condition: (result, _ctx) => {
      const r = result as Record<string, unknown>;
      return typeof r?.confidence === "number";
    },
    suggest: (result, _context) => {
      const r = result as Record<string, unknown>;
      const confidence = r?.confidence as number ?? 0;
      const suggestions: ExperimentSuggestion[] = [];

      suggestions.push({
        title: "Start DBTL iteration",
        description: `Cell-free confidence is ${(confidence * 100).toFixed(0)}%; begin the design-build-test-learn cycle`,
        tool: "dbtlflow",
        suggestedInputs: {},
        rationale:
          "Cell-free results provide the baseline for the first DBTL iteration",
        priority: "high",
      });

      if (confidence < 0.5) {
        suggestions.push({
          title: "Multi-omics analysis",
          description:
            "Low confidence suggests complex interactions; use multi-omics to identify hidden factors",
          tool: "multio",
          suggestedInputs: {},
          rationale:
            "Low cell-free confidence may indicate unmodeled interactions that omics can reveal",
          priority: "medium",
        });
      }

      return suggestions;
    },
  },

  // After PROEVOL: suggest catalyst redesign
  {
    sourceTool: "proevol",
    condition: (result, _ctx) => {
      const r = result as Record<string, unknown>;
      return typeof r?.diversityIndex === "number";
    },
    suggest: (result, _context) => {
      const r = result as Record<string, unknown>;
      const diversity = r?.diversityIndex as number ?? 0;
      const suggestions: ExperimentSuggestion[] = [];

      suggestions.push({
        title: "Redesign catalyst with evolved sequences",
        description:
          "Use the top evolved variant as input for a new catalyst design cycle",
        tool: "catdes",
        suggestedInputs: {},
        rationale:
          "Evolved sequences provide a better starting point for catalyst optimization",
        priority: "high",
      });

      if (diversity > 0.8) {
        suggestions.push({
          title: "Cell-free screening of variants",
          description:
            "High sequence diversity; screen top variants in cell-free to identify leads",
          tool: "cellfree",
          suggestedInputs: {},
          rationale:
            "High diversity campaign has many candidates; cell-free screening narrows the field",
          priority: "medium",
        });
      }

      return suggestions;
    },
  },

  // After GENMIM: suggest gene circuit design
  {
    sourceTool: "genmim",
    condition: (_result, _ctx) => true,
    suggest: (_result, _context) => {
      return [
        {
          title: "Design gene circuit",
          description:
            "Design a gene circuit for the minimized chassis to control production",
          tool: "gecair",
          suggestedInputs: {},
          rationale:
            "A minimal chassis is the ideal foundation for a precisely designed gene circuit",
          priority: "high",
        },
        {
          title: "Re-run FBA on minimized genome",
          description:
            "Verify flux feasibility with the reduced genome configuration",
          tool: "fbasim",
          suggestedInputs: {},
          rationale:
            "Gene removals may alter flux distribution; FBA confirms feasibility",
          priority: "medium",
        },
      ];
    },
  },

  // After GECAIR: suggest dynamic control
  {
    sourceTool: "gecair",
    condition: (_result, _ctx) => true,
    suggest: (_result, _context) => {
      return [
        {
          title: "Set up dynamic control",
          description:
            "Connect the gene circuit to a dynamic controller for real-time regulation",
          tool: "dyncon",
          suggestedInputs: {},
          rationale:
            "Gene circuit output levels inform the controller bandwidth and setpoint",
          priority: "high",
        },
      ];
    },
  },

  // After CETHX: suggest pathway design or catalyst design
  {
    sourceTool: "cethx",
    condition: (result, _ctx) => {
      const r = result as Record<string, unknown>;
      return typeof r?.efficiency === "number";
    },
    suggest: (result, context) => {
      const r = result as Record<string, unknown>;
      const efficiency = r?.efficiency as number ?? 0;
      const suggestions: ExperimentSuggestion[] = [];

      if (context.targetProduct) {
        suggestions.push({
          title: "Design pathway with thermodynamic constraints",
          description:
            "Use thermodynamic analysis to guide pathway design toward favorable reactions",
          tool: "pathd",
          suggestedInputs: { targetProduct: context.targetProduct },
          rationale:
            "Thermodynamic data provides feasibility constraints for pathway design",
          priority: "high",
        });
      }

      if (efficiency < 0.5) {
        suggestions.push({
          title: "Explore alternative pathways",
          description:
            "Low thermodynamic efficiency suggests the current route may be unfavorable",
          tool: "pathd",
          suggestedInputs: { searchMode: "alternative" },
          rationale:
            "Poor thermodynamics indicates the need for alternative biosynthetic routes",
          priority: "medium",
        });
      }

      return suggestions;
    },
  },

  // After DBTLflow: suggest next iteration or spatial analysis
  {
    sourceTool: "dbtlflow",
    condition: (result, _ctx) => {
      const r = result as Record<string, unknown>;
      return typeof r?.passRate === "number";
    },
    suggest: (result, _context) => {
      const r = result as Record<string, unknown>;
      const passRate = r?.passRate as number ?? 0;
      const suggestions: ExperimentSuggestion[] = [];

      suggestions.push({
        title: "Iterate design cycle",
        description: `Pass rate is ${(passRate * 100).toFixed(0)}%; use learned metrics to refine the design`,
        tool: "pathd",
        suggestedInputs: { iteration: "next" },
        rationale:
          "DBTL learned metrics should feed back into the next pathway design iteration",
        priority: "high",
      });

      if (passRate > 0.7) {
        suggestions.push({
          title: "Multi-omics deep analysis",
          description:
            "High pass rate; analyze the system with multi-omics for deeper understanding",
          tool: "multio",
          suggestedInputs: {},
          rationale:
            "Successful iterations provide rich data for multi-omics integration",
          priority: "medium",
        });

        suggestions.push({
          title: "Spatial transcriptomics",
          description:
            "Map gene expression spatially to understand cell-to-cell variation",
          tool: "scspatial",
          suggestedInputs: {},
          rationale:
            "Spatial data reveals heterogeneity that bulk measurements miss",
          priority: "low",
        });
      }

      return suggestions;
    },
  },
];

/**
 * Suggest follow-up experiments based on a tool result.
 *
 * @param toolResult — The tool that ran and its result
 * @param projectContext — Current workbench state
 * @returns Array of prioritized experiment suggestions
 */
export function suggestNextExperiments(
  toolResult: { tool: string; result: unknown },
  projectContext: WorkbenchCopilotContext,
): ExperimentSuggestion[] {
  const suggestions: ExperimentSuggestion[] = [];

  for (const rule of SUGGESTION_RULES) {
    if (rule.sourceTool !== toolResult.tool) continue;
    if (!rule.condition(toolResult.result, projectContext)) continue;
    suggestions.push(...rule.suggest(toolResult.result, projectContext));
  }

  // Sort by priority (high first)
  const priorityOrder: Record<string, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  suggestions.sort(
    (a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99),
  );

  return suggestions;
}

/**
 * Get a summary line for a suggestion.
 */
export function summariseSuggestion(suggestion: ExperimentSuggestion): string {
  const priority = suggestion.priority.toUpperCase();
  return `[${priority}] ${suggestion.title} → ${suggestion.tool}`;
}
