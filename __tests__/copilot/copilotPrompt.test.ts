/** @jest-environment node */
/**
 * copilotPrompt — prompt generation with context.
 */

import {
  buildSystemPrompt,
  COPILOT_TOOL_CATALOG,
} from "../../src/services/copilot/copilotPrompt";

describe("buildSystemPrompt", () => {
  it("includes the role header", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Nexus-Bio Copilot");
    expect(prompt).toContain("synthetic biology");
  });

  it("includes behavior rules", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Behavior Rules");
    expect(prompt).toContain("scientifically rigorous");
  });

  it("includes full tool catalog when no filter is given", () => {
    const prompt = buildSystemPrompt();
    for (const toolName of Object.keys(COPILOT_TOOL_CATALOG)) {
      expect(prompt).toContain(toolName);
    }
  });

  it("filters tool catalog when toolCatalog is provided", () => {
    const prompt = buildSystemPrompt({
      toolCatalog: ["fbasim", "cethx"],
    });
    expect(prompt).toContain("fbasim");
    expect(prompt).toContain("cethx");
    // pathd should not appear since it was not in the filter
    expect(prompt).not.toContain("pathd");
  });

  it("includes project brief when provided", () => {
    const prompt = buildSystemPrompt({
      projectBrief: "Artemisinin biosynthesis optimization",
    });
    expect(prompt).toContain("Current Project");
    expect(prompt).toContain("Artemisinin biosynthesis optimization");
  });

  it("includes pathway context when provided", () => {
    const prompt = buildSystemPrompt({
      pathwayContext: "acetyl_coa -> hmg_coa -> mevalonate -> fpp",
    });
    expect(prompt).toContain("Active Pathway");
    expect(prompt).toContain("acetyl_coa");
  });

  it("includes recent experiments when provided", () => {
    const prompt = buildSystemPrompt({
      recentExperiments: [
        "FBA on artemisinin pathway: max flux 2.3 mmol/gDW/h",
        "Knockout of gene X increased yield by 15%",
      ],
    });
    expect(prompt).toContain("Recent Experiments");
    expect(prompt).toContain("FBA on artemisinin");
    expect(prompt).toContain("Knockout of gene X");
  });

  it("includes conversation summary when provided", () => {
    const prompt = buildSystemPrompt({
      conversationSummary:
        "Previous conversation summary (5 messages):\n[user]: What is the bottleneck?",
    });
    expect(prompt).toContain("Conversation History");
    expect(prompt).toContain("summarized");
    expect(prompt).toContain("What is the bottleneck?");
  });

  it("includes tool call instructions", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Tool Calling");
    expect(prompt).toContain("tool_call");
    expect(prompt).toContain("```tool_call");
  });

  it("omits optional sections when not provided", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).not.toContain("Current Project");
    expect(prompt).not.toContain("Active Pathway");
    expect(prompt).not.toContain("Recent Experiments");
    expect(prompt).not.toContain("Conversation History");
  });

  it("builds a comprehensive prompt with all context", () => {
    const prompt = buildSystemPrompt({
      projectBrief: "Lycopene production in E. coli",
      pathwayContext: "glucose -> g6p -> ... -> lycopene",
      recentExperiments: ["FBA result: max yield 0.12 g/g"],
      conversationSummary: "User asked about FPP synthase.",
      toolCatalog: ["pathd", "fbasim", "catdes"],
    });

    // Should contain all sections
    expect(prompt).toContain("Nexus-Bio Copilot");
    expect(prompt).toContain("Lycopene production");
    expect(prompt).toContain("glucose -> g6p");
    expect(prompt).toContain("max yield 0.12");
    expect(prompt).toContain("FPP synthase");
    expect(prompt).toContain("pathd");
    expect(prompt).toContain("fbasim");
    expect(prompt).toContain("catdes");
    // Should NOT contain tools not in the filter
    expect(prompt).not.toContain("multio");
  });
});
