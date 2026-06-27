/**
 * Tests for src/services/ai/promptBuilder.ts
 *
 * Covers: buildAnalysisPrompt, buildPlanningPrompt, buildCorrectionPrompt.
 * Pure unit tests — no mocks, no network, no side effects.
 */

import {
  buildAnalysisPrompt,
  buildPlanningPrompt,
  buildCorrectionPrompt,
  type AnalysisContext,
  type PlanningTool,
  type CorrectionTask,
} from "../src/services/ai/promptBuilder";

// ---------------------------------------------------------------------------
// buildAnalysisPrompt
// ---------------------------------------------------------------------------

describe("buildAnalysisPrompt", () => {
  it("includes the Axon identity header", () => {
    const result = buildAnalysisPrompt("test input");
    expect(result).toContain("You are Axon");
    expect(result).toContain("Nexus-Bio");
  });

  it("includes the user input in a dedicated section", () => {
    const result = buildAnalysisPrompt("What is the ΔG of artemisinin?");
    expect(result).toContain("## User Request");
    expect(result).toContain("What is the ΔG of artemisinin?");
  });

  it("includes scientific rigor rules", () => {
    const result = buildAnalysisPrompt("test");
    expect(result).toContain("Never fabricate");
    expect(result).toContain("ΔG values");
  });

  it("includes the full tool catalog when no active tool is specified", () => {
    const result = buildAnalysisPrompt("test");
    expect(result).toContain("## Available Tools");
    expect(result).toContain("**pathd**");
    expect(result).toContain("**fbasim**");
    expect(result).toContain("**cethx**");
    expect(result).toContain("**catdes**");
  });

  it("highlights the active tool and lists others separately", () => {
    const context: AnalysisContext = { activeTool: "fbasim" };
    const result = buildAnalysisPrompt("run FBA", context);
    expect(result).toContain("## Active Tool");
    expect(result).toContain("**fbasim**");
    expect(result).toContain("## Other Available Tools");
    expect(result).toContain("**pathd**");
  });

  it("includes pathway context when provided", () => {
    const context: AnalysisContext = {
      pathwayContext: "Artemisinin biosynthesis from acetyl-CoA",
    };
    const result = buildAnalysisPrompt("test", context);
    expect(result).toContain("## Active Pathway");
    expect(result).toContain("Artemisinin biosynthesis from acetyl-CoA");
  });

  it("includes project brief when provided", () => {
    const context: AnalysisContext = {
      projectBrief: "Optimizing terpenoid production in S. cerevisiae",
    };
    const result = buildAnalysisPrompt("test", context);
    expect(result).toContain("## Current Project");
    expect(result).toContain("Optimizing terpenoid production");
  });

  it("includes recent experiments when provided", () => {
    const context: AnalysisContext = {
      recentExperiments: ["FBA on artemisinin pathway", "ΔG cascade for mevalonate"],
    };
    const result = buildAnalysisPrompt("test", context);
    expect(result).toContain("## Recent Experiments");
    expect(result).toContain("- FBA on artemisinin pathway");
  });

  it("includes conversation summary when provided", () => {
    const context: AnalysisContext = {
      conversationSummary: "User asked about bottleneck enzymes in the pathway.",
    };
    const result = buildAnalysisPrompt("test", context);
    expect(result).toContain("## Conversation History");
    expect(result).toContain("bottleneck enzymes");
  });

  it("includes tool call instructions only when activeTool is set", () => {
    const withTool = buildAnalysisPrompt("test", { activeTool: "cethx" });
    const withoutTool = buildAnalysisPrompt("test");
    expect(withTool).toContain("## Tool Calling");
    expect(withoutTool).not.toContain("## Tool Calling");
  });

  it("defaults to prose output format", () => {
    const result = buildAnalysisPrompt("test");
    expect(result).toContain("## Output Format");
    expect(result).toContain("structured prose");
    expect(result).toContain("Next Steps");
  });

  it("uses json output format when specified", () => {
    const context: AnalysisContext = { outputFormat: "json" };
    const result = buildAnalysisPrompt("test", context);
    expect(result).toContain("strict JSON");
    expect(result).toContain('"evidence"');
  });

  it("handles all context fields simultaneously", () => {
    const context: AnalysisContext = {
      activeTool: "catdes",
      pathwayContext: "artemisinin pathway",
      recentExperiments: ["experiment 1", "experiment 2"],
      projectBrief: "terpenoid project",
      conversationSummary: "previous discussion",
      outputFormat: "json",
    };
    const result = buildAnalysisPrompt("full context test", context);
    expect(result).toContain("## Active Tool");
    expect(result).toContain("## Active Pathway");
    expect(result).toContain("## Current Project");
    expect(result).toContain("## Recent Experiments");
    expect(result).toContain("## Conversation History");
    expect(result).toContain("strict JSON");
  });
});

// ---------------------------------------------------------------------------
// buildPlanningPrompt
// ---------------------------------------------------------------------------

describe("buildPlanningPrompt", () => {
  const sampleTools: PlanningTool[] = [
    {
      id: "pathd",
      name: "Pathway Designer",
      description: "Design metabolic pathways",
      outputs: ["pathway graph", "bottleneck list"],
      available: true,
    },
    {
      id: "fbasim",
      name: "FBA Simulator",
      description: "Flux balance analysis",
      outputs: ["flux map", "growth rate"],
      available: true,
    },
    {
      id: "cethx",
      name: "Thermodynamics",
      description: "ΔG computation",
      outputs: ["ΔG cascade"],
      available: false,
    },
  ];

  it("includes the Axon identity header", () => {
    const result = buildPlanningPrompt("design pathway", sampleTools);
    expect(result).toContain("You are Axon");
  });

  it("includes the goal in a dedicated section", () => {
    const result = buildPlanningPrompt("design artemisinin pathway", sampleTools);
    expect(result).toContain("## Goal");
    expect(result).toContain("design artemisinin pathway");
  });

  it("includes planning rules", () => {
    const result = buildPlanningPrompt("test", sampleTools);
    expect(result).toContain("## Planning Rules");
    expect(result).toContain("5 steps maximum");
    expect(result).toContain("dependsOn");
  });

  it("lists all tools with their descriptions and outputs", () => {
    const result = buildPlanningPrompt("test", sampleTools);
    expect(result).toContain("**pathd**");
    expect(result).toContain("Design metabolic pathways");
    expect(result).toContain("pathway graph, bottleneck list");
    expect(result).toContain("**fbasim**");
    expect(result).toContain("Flux balance analysis");
  });

  it("marks unavailable tools with [UNAVAILABLE]", () => {
    const result = buildPlanningPrompt("test", sampleTools);
    expect(result).toContain("**cethx** [UNAVAILABLE]");
  });

  it("does not mark available tools as unavailable", () => {
    const result = buildPlanningPrompt("test", sampleTools);
    expect(result).not.toContain("**pathd** [UNAVAILABLE]");
    expect(result).not.toContain("**fbasim** [UNAVAILABLE]");
  });

  it("includes the required JSON output format", () => {
    const result = buildPlanningPrompt("test", sampleTools);
    expect(result).toContain("## Required Output Format");
    expect(result).toContain('"plan"');
    expect(result).toContain('"step"');
    expect(result).toContain('"tool"');
    expect(result).toContain('"objective"');
    expect(result).toContain('"dependsOn"');
    expect(result).toContain('"assumptions"');
    expect(result).toContain('"warnings"');
  });

  it("handles empty tools list", () => {
    const result = buildPlanningPrompt("test goal", []);
    expect(result).toContain("## Goal");
    expect(result).toContain("test goal");
    expect(result).toContain("## Available Tools");
  });
});

// ---------------------------------------------------------------------------
// buildCorrectionPrompt
// ---------------------------------------------------------------------------

describe("buildCorrectionPrompt", () => {
  const sampleTask: CorrectionTask = {
    tool: "fbasim",
    label: "Run FBA on artemisinin pathway",
    originalInput: {
      species: "ecoli",
      objective: "biomass",
      glucoseUptake: 10,
    },
  };

  it("includes the Axon identity header", () => {
    const result = buildCorrectionPrompt(sampleTask, "infeasible", {});
    expect(result).toContain("You are Axon");
  });

  it("includes the failed tool info with description", () => {
    const result = buildCorrectionPrompt(sampleTask, "error", {});
    expect(result).toContain("## Failed Tool");
    expect(result).toContain("**fbasim**");
    expect(result).toContain("Flux Balance Analysis");
  });

  it("includes the task description", () => {
    const result = buildCorrectionPrompt(sampleTask, "error", {});
    expect(result).toContain("## Task Description");
    expect(result).toContain("Run FBA on artemisinin pathway");
  });

  it("includes the error message", () => {
    const result = buildCorrectionPrompt(
      sampleTask,
      "Solver failed: infeasible LP",
      {},
    );
    expect(result).toContain("## Error Message");
    expect(result).toContain("Solver failed: infeasible LP");
  });

  it("includes the original parameters as JSON", () => {
    const params = { species: "ecoli", objective: "biomass", glucoseUptake: 10 };
    const result = buildCorrectionPrompt(sampleTask, "error", params);
    expect(result).toContain("## Original Parameters");
    expect(result).toContain('"species": "ecoli"');
    expect(result).toContain('"glucoseUptake": 10');
  });

  it("includes correction rules", () => {
    const result = buildCorrectionPrompt(sampleTask, "error", {});
    expect(result).toContain("## Correction Rules");
    expect(result).toContain("recoverable");
    expect(result).toContain("Never suggest the exact same parameters");
  });

  it("includes the required JSON output format with all fields", () => {
    const result = buildCorrectionPrompt(sampleTask, "error", {});
    expect(result).toContain("## Required Output Format");
    expect(result).toContain('"diagnosis"');
    expect(result).toContain('"recoverable"');
    expect(result).toContain('"suggestedParameters"');
    expect(result).toContain('"parameterChanges"');
    expect(result).toContain('"alternativeApproach"');
    expect(result).toContain('"confidence"');
  });

  it("serializes nested parameters correctly", () => {
    const nested = {
      knockouts: ["geneA", "geneB"],
      constraints: { oxygen: 20, glucose: 10 },
    };
    const result = buildCorrectionPrompt(sampleTask, "error", nested);
    expect(result).toContain('"geneA"');
    expect(result).toContain('"oxygen": 20');
  });

  it("handles unknown tools gracefully", () => {
    const unknownTask: CorrectionTask = {
      tool: "unknown-tool",
      label: "Mystery task",
      originalInput: {},
    };
    const result = buildCorrectionPrompt(unknownTask, "error", {});
    expect(result).toContain("**unknown-tool**");
    expect(result).toContain("Mystery task");
  });
});
