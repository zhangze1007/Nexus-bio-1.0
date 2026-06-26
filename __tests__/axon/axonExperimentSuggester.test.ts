/** @jest-environment node */
/**
 * axonExperimentSuggester.test.ts — follow-up experiment suggestions.
 *
 * Covers:
 *   - PATHD results suggest FBA and thermodynamics
 *   - FBASIM results suggest catalyst design
 *   - CATDES results suggest dynamic control
 *   - DYNCON results suggest cell-free or retune
 *   - CELLFREE results suggest DBTL
 *   - Suggestion prioritization (high first)
 *   - Empty results for unknown tools
 *   - Summary function
 */
import {
  suggestNextExperiments,
  summariseSuggestion,
  type ExperimentSuggestion,
} from "../../src/services/axon/axonExperimentSuggester";
import type { WorkbenchCopilotContext } from "../../src/services/axonContext";

function emptyContext(): WorkbenchCopilotContext {
  return {
    hasContext: false,
    targetProduct: null,
    evidenceTotal: 0,
    evidenceSelected: 0,
    nextToolIds: [],
    currentToolId: null,
    workflowStatus: null,
    workflowCurrentToolId: null,
    workflowNextRecommendedNode: null,
    workflowHumanGateRequired: false,
    workflowIsDemoOnly: false,
    summaryOneLine: "No active workbench context",
    promptAugmentation: "",
  };
}

function ctxWithTarget(target: string): WorkbenchCopilotContext {
  return { ...emptyContext(), hasContext: true, targetProduct: target };
}

describe("suggestNextExperiments", () => {
  it("suggests FBA after successful PATHD with nodes", () => {
    const suggestions = suggestNextExperiments(
      { tool: "pathd", result: { nodeCount: 7 } },
      emptyContext(),
    );
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    const fbaSuggestion = suggestions.find((s) => s.tool === "fbasim");
    expect(fbaSuggestion).toBeDefined();
    expect(fbaSuggestion!.priority).toBe("high");
  });

  it("suggests thermodynamics for larger pathways", () => {
    const suggestions = suggestNextExperiments(
      { tool: "pathd", result: { nodeCount: 5 } },
      emptyContext(),
    );
    const cethx = suggestions.find((s) => s.tool === "cethx");
    expect(cethx).toBeDefined();
    expect(cethx!.priority).toBe("medium");
  });

  it("does not suggest thermodynamics for tiny pathways", () => {
    const suggestions = suggestNextExperiments(
      { tool: "pathd", result: { nodeCount: 2 } },
      emptyContext(),
    );
    const cethx = suggestions.find((s) => s.tool === "cethx");
    expect(cethx).toBeUndefined();
  });

  it("suggests catalyst design after FBASIM", () => {
    const suggestions = suggestNextExperiments(
      { tool: "fbasim", result: { objectiveValue: 0.8 } },
      emptyContext(),
    );
    const catdes = suggestions.find((s) => s.tool === "catdes");
    expect(catdes).toBeDefined();
    expect(catdes!.priority).toBe("high");
  });

  it("suggests knockout strategy for low FBA objective", () => {
    const suggestions = suggestNextExperiments(
      { tool: "fbasim", result: { objectiveValue: 0.3 } },
      emptyContext(),
    );
    const knockout = suggestions.find(
      (s) => s.title.includes("knockout") || s.title.includes("Knockout"),
    );
    expect(knockout).toBeDefined();
  });

  it("suggests genome minimization after FBASIM", () => {
    const suggestions = suggestNextExperiments(
      { tool: "fbasim", result: { objectiveValue: 0.8 } },
      emptyContext(),
    );
    const genmim = suggestions.find((s) => s.tool === "genmim");
    expect(genmim).toBeDefined();
    expect(genmim!.priority).toBe("low");
  });

  it("suggests dynamic control after CATDES", () => {
    const suggestions = suggestNextExperiments(
      { tool: "catdes", result: { bestSequenceScore: 0.9 } },
      emptyContext(),
    );
    const dyncon = suggestions.find((s) => s.tool === "dyncon");
    expect(dyncon).toBeDefined();
    expect(dyncon!.priority).toBe("high");
  });

  it("suggests evolution for low catalyst score", () => {
    const suggestions = suggestNextExperiments(
      { tool: "catdes", result: { bestSequenceScore: 0.4 } },
      emptyContext(),
    );
    const proevol = suggestions.find((s) => s.tool === "proevol");
    expect(proevol).toBeDefined();
    expect(proevol!.priority).toBe("high");
  });

  it("suggests cell-free after stable DYNCON", () => {
    const suggestions = suggestNextExperiments(
      { tool: "dyncon", result: { stable: true } },
      emptyContext(),
    );
    const cellfree = suggestions.find((s) => s.tool === "cellfree");
    expect(cellfree).toBeDefined();
    expect(cellfree!.priority).toBe("high");
  });

  it("suggests retune after unstable DYNCON", () => {
    const suggestions = suggestNextExperiments(
      { tool: "dyncon", result: { stable: false } },
      emptyContext(),
    );
    const retune = suggestions.find(
      (s) => s.title.includes("Retune") || s.title.includes("retune"),
    );
    expect(retune).toBeDefined();
    expect(retune!.priority).toBe("high");
  });

  it("suggests DBTL after CELLFREE", () => {
    const suggestions = suggestNextExperiments(
      { tool: "cellfree", result: { confidence: 0.8 } },
      emptyContext(),
    );
    const dbtl = suggestions.find((s) => s.tool === "dbtlflow");
    expect(dbtl).toBeDefined();
    expect(dbtl!.priority).toBe("high");
  });

  it("suggests multi-omics for low cell-free confidence", () => {
    const suggestions = suggestNextExperiments(
      { tool: "cellfree", result: { confidence: 0.3 } },
      emptyContext(),
    );
    const multio = suggestions.find((s) => s.tool === "multio");
    expect(multio).toBeDefined();
  });

  it("suggests gene circuit after GENMIM", () => {
    const suggestions = suggestNextExperiments(
      { tool: "genmim", result: { genesRemoved: 5 } },
      emptyContext(),
    );
    const gecair = suggestions.find((s) => s.tool === "gecair");
    expect(gecair).toBeDefined();
    expect(gecair!.priority).toBe("high");
  });

  it("suggests dynamic control after GECAIR", () => {
    const suggestions = suggestNextExperiments(
      { tool: "gecair", result: { outputLevel: 0.7 } },
      emptyContext(),
    );
    const dyncon = suggestions.find((s) => s.tool === "dyncon");
    expect(dyncon).toBeDefined();
  });

  it("suggests pathway design after CETHX with context target", () => {
    const suggestions = suggestNextExperiments(
      { tool: "cethx", result: { efficiency: 0.6 } },
      ctxWithTarget("artemisinin"),
    );
    const pathd = suggestions.find((s) => s.tool === "pathd");
    expect(pathd).toBeDefined();
    expect(pathd!.priority).toBe("high");
  });

  it("suggests alternative pathways for low thermodynamic efficiency", () => {
    const suggestions = suggestNextExperiments(
      { tool: "cethx", result: { efficiency: 0.2 } },
      emptyContext(),
    );
    const alt = suggestions.find(
      (s) => s.title.includes("alternative") || s.title.includes("Alternative"),
    );
    expect(alt).toBeDefined();
  });

  it("suggests iteration after DBTLflow", () => {
    const suggestions = suggestNextExperiments(
      { tool: "dbtlflow", result: { passRate: 0.5 } },
      emptyContext(),
    );
    const iterate = suggestions.find(
      (s) => s.title.includes("Iterate") || s.title.includes("iterate"),
    );
    expect(iterate).toBeDefined();
    expect(iterate!.priority).toBe("high");
  });

  it("suggests spatial analysis for high DBTL pass rate", () => {
    const suggestions = suggestNextExperiments(
      { tool: "dbtlflow", result: { passRate: 0.9 } },
      emptyContext(),
    );
    const spatial = suggestions.find((s) => s.tool === "scspatial");
    expect(spatial).toBeDefined();
  });

  it("returns empty for unknown tools", () => {
    const suggestions = suggestNextExperiments(
      { tool: "unknown_tool", result: {} },
      emptyContext(),
    );
    expect(suggestions).toEqual([]);
  });

  it("sorts suggestions by priority (high first)", () => {
    const suggestions = suggestNextExperiments(
      { tool: "fbasim", result: { objectiveValue: 0.3 } },
      emptyContext(),
    );
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < suggestions.length - 1; i++) {
      const order: Record<string, number> = {
        high: 0,
        medium: 1,
        low: 2,
      };
      expect(order[suggestions[i].priority]).toBeLessThanOrEqual(
        order[suggestions[i + 1].priority],
      );
    }
  });

  it("each suggestion has required fields", () => {
    const suggestions = suggestNextExperiments(
      { tool: "pathd", result: { nodeCount: 7 } },
      emptyContext(),
    );
    for (const s of suggestions) {
      expect(s.title).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.tool).toBeTruthy();
      expect(s.suggestedInputs).toBeDefined();
      expect(s.rationale).toBeTruthy();
      expect(["high", "medium", "low"]).toContain(s.priority);
    }
  });

  it("suggestions reference specific tools and inputs", () => {
    const suggestions = suggestNextExperiments(
      { tool: "pathd", result: { nodeCount: 7 } },
      emptyContext(),
    );
    for (const s of suggestions) {
      // Every suggestion must have a concrete tool
      expect(s.tool.length).toBeGreaterThan(0);
      // suggestedInputs must be an object (can be empty)
      expect(typeof s.suggestedInputs).toBe("object");
    }
  });
});

describe("summariseSuggestion", () => {
  it("formats high priority suggestion", () => {
    const suggestion: ExperimentSuggestion = {
      title: "Run FBA",
      description: "test",
      tool: "fbasim",
      suggestedInputs: {},
      rationale: "test",
      priority: "high",
    };
    expect(summariseSuggestion(suggestion)).toBe("[HIGH] Run FBA → fbasim");
  });

  it("formats low priority suggestion", () => {
    const suggestion: ExperimentSuggestion = {
      title: "Genome minimization",
      description: "test",
      tool: "genmim",
      suggestedInputs: {},
      rationale: "test",
      priority: "low",
    };
    expect(summariseSuggestion(suggestion)).toBe(
      "[LOW] Genome minimization → genmim",
    );
  });
});
