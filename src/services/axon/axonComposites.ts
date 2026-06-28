/**
 * axonComposites — pre-built multi-tool workflows for the Axon agent.
 *
 * Composites are named DAG templates that map high-level research intents
 * to ordered tool sequences. They are consumed by planDAG() when the goal
 * matches a composite's trigger phrase.
 *
 * Design rules:
 *   - Every composite references only tools from the workflow registry
 *   - Dependencies between tools are explicit (dependsOn)
 *   - Composites are data, not code — no side effects
 *   - Each composite has a human-readable name and description
 */

import type { ToolId } from "../../domain/workflowContract";

export interface CompositeWorkflow {
  name: string;
  description: string;
  tools: ToolId[];
  /** Map each tool to the tools it depends on within this composite. */
  dependencies: Partial<Record<ToolId, ToolId[]>>;
  /** Keywords that trigger this composite when found in a goal. */
  triggers: string[];
}

export const COMPOSITES: Record<string, CompositeWorkflow> = {
  designAndSimulate: {
    name: "Design & Simulate",
    description: "Design a pathway, simulate with FBA, and check thermodynamics",
    tools: ["pathd", "fbasim", "cethx"],
    dependencies: {
      pathd: [],
      fbasim: ["pathd"],
      cethx: ["pathd"],
    },
    triggers: [
      "design and simulate",
      "design & simulate",
      "pathway and flux",
      "pathway with fba",
      "design then simulate",
    ],
  },

  designAndEvolve: {
    name: "Design & Evolve",
    description: "Design an enzyme, then evolve for improved activity",
    tools: ["catdes", "proevol"],
    dependencies: {
      catdes: [],
      proevol: ["catdes"],
    },
    triggers: [
      "design and evolve",
      "design & evolve",
      "enzyme evolution",
      "catalyst evolution",
      "evolve enzyme",
      "directed evolution",
    ],
  },

  fullDBTL: {
    name: "Full DBTL Cycle",
    description:
      "Complete design-build-test-learn cycle: pathway design through FBA, catalyst design, chassis engineering, gene circuit, dynamic control, and validation",
    tools: ["pathd", "fbasim", "catdes", "genmim", "gecair", "dyncon", "cellfree", "dbtlflow"],
    dependencies: {
      pathd: [],
      fbasim: ["pathd"],
      catdes: ["fbasim"],
      genmim: ["fbasim"],
      gecair: ["genmim"],
      dyncon: ["catdes"],
      cellfree: ["dyncon"],
      dbtlflow: ["cellfree"],
    },
    triggers: [
      "full dbtl",
      "complete dbtl",
      "dbtl cycle",
      "design build test learn",
      "full cycle",
      "end to end",
      "end-to-end",
    ],
  },

  optimizeAndControl: {
    name: "Optimize & Control",
    description: "Design a catalyst, set up dynamic control, and validate with cell-free",
    tools: ["catdes", "dyncon", "cellfree"],
    dependencies: {
      catdes: [],
      dyncon: ["catdes"],
      cellfree: ["dyncon"],
    },
    triggers: ["optimize and control", "optimize & control", "catalyst and control", "enzyme control"],
  },

  analyzeAndDesign: {
    name: "Analyze & Design",
    description: "Check thermodynamics, then design a pathway informed by the analysis",
    tools: ["cethx", "pathd"],
    dependencies: {
      cethx: [],
      pathd: ["cethx"],
    },
    triggers: ["analyze and design", "thermodynamics then design", "check thermodynamics first"],
  },

  chassisEngineering: {
    name: "Chassis Engineering",
    description: "Minimize the genome, then design a gene circuit for the optimized chassis",
    tools: ["genmim", "gecair"],
    dependencies: {
      genmim: [],
      gecair: ["genmim"],
    },
    triggers: [
      "chassis engineering",
      "chassis design",
      "minimize and circuit",
      "genome minimization",
      "minimal chassis",
    ],
  },
};

/**
 * Find a composite workflow that matches the given goal text.
 * Returns null if no composite matches.
 */
export function matchComposite(goal: string): CompositeWorkflow | null {
  const lower = goal.toLowerCase().trim();
  for (const composite of Object.values(COMPOSITES)) {
    if (composite.triggers.some((trigger) => lower.includes(trigger))) {
      return composite;
    }
  }
  return null;
}

/**
 * Get all composite names for display purposes.
 */
export function listCompositeNames(): string[] {
  return Object.values(COMPOSITES).map((c) => c.name);
}

/**
 * Validate that all tools in a composite exist in the workflow registry.
 * Returns an array of invalid tool ids (empty if all valid).
 */
export function validateCompositeTools(composite: CompositeWorkflow): string[] {
  const validToolIds = new Set([
    "pathd",
    "metabolic-eng",
    "fbasim",
    "cethx",
    "catdes",
    "proevol",
    "dyncon",
    "gecair",
    "genmim",
    "cellfree",
    "dbtlflow",
    "multio",
    "scspatial",
    "nexai",
    "inversefolding",
    "multiplexcrispr",
    "pathwaydiscovery",
    "digitaltwin",
    "sequence",
    "inventory",
  ]);
  return composite.tools.filter((tool) => !validToolIds.has(tool));
}

/**
 * Validate that all dependencies in a composite reference valid tools.
 * Returns an array of error strings (empty if all valid).
 */
export function validateCompositeDependencies(composite: CompositeWorkflow): string[] {
  const errors: string[] = [];
  const toolSet = new Set(composite.tools);

  for (const [tool, deps] of Object.entries(composite.dependencies)) {
    if (!toolSet.has(tool as ToolId)) {
      errors.push(`Dependency entry for "${tool}" which is not in the tools list`);
    }
    for (const dep of deps ?? []) {
      if (!toolSet.has(dep)) {
        errors.push(`Tool "${tool}" depends on "${dep}" which is not in the tools list`);
      }
    }
  }

  return errors;
}
