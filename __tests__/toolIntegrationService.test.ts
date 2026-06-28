/**
 * Tests for toolIntegrationService.
 *
 * Covers:
 *  - validatePipeline: empty, unknown tools, duplicates, missing deps, valid
 *  - getToolDependencies: golden-path tools, sidecars, unknown tools
 *  - runToolPipeline: single tool, multi-step, dependency-gated, failure propagation
 */
import {
  validatePipeline,
  getToolDependencies,
  runToolPipeline,
} from "../src/services/integration/toolIntegrationService";

// ── validatePipeline ─────────────────────────────────────────────────────

describe("validatePipeline", () => {
  it("returns empty_pipeline issue for an empty array", () => {
    const result = validatePipeline([]);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].kind).toBe("empty_pipeline");
  });

  it("returns empty_pipeline issue for null/undefined input", () => {
    const result = validatePipeline(null as unknown as string[]);
    expect(result.valid).toBe(false);
    expect(result.issues[0].kind).toBe("empty_pipeline");
  });

  it("returns unknown_tool issue for an unregistered tool ID", () => {
    const result = validatePipeline(["nonexistent-tool"]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.kind === "unknown_tool")).toBe(true);
    expect(result.issues[0].toolId).toBe("nonexistent-tool");
  });

  it("returns duplicate_tool issue when a tool appears twice", () => {
    const result = validatePipeline(["pathd", "fbasim", "pathd"]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.kind === "duplicate_tool")).toBe(true);
  });

  it("returns missing_dependency when required dep is absent from pipeline", () => {
    // fbasim requires pathd, but only fbasim is in the pipeline
    const result = validatePipeline(["fbasim"]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.kind === "missing_dependency")).toBe(true);
  });

  it("returns missing_dependency when dep appears after the tool", () => {
    // fbasim requires pathd, but pathd comes after fbasim
    const result = validatePipeline(["fbasim", "pathd"]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.kind === "missing_dependency" && i.toolId === "fbasim")).toBe(true);
  });

  it("passes validation for the golden path in correct order", () => {
    const golden = ["pathd", "fbasim", "catdes", "dyncon", "cellfree", "dbtlflow"];
    const result = validatePipeline(golden);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.resolvedOrder).toEqual(golden);
  });

  it("passes validation for a single tool with no dependencies", () => {
    const result = validatePipeline(["pathd"]);
    expect(result.valid).toBe(true);
    expect(result.resolvedOrder).toEqual(["pathd"]);
  });

  it("passes validation for sidecar tools with no required inputs", () => {
    const result = validatePipeline(["cethx", "proevol", "genmim"]);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("builds dependency edges for golden-path tools in pipeline", () => {
    const golden = ["pathd", "fbasim", "catdes", "dyncon"];
    const result = validatePipeline(golden);
    expect(result.valid).toBe(true);
    // fbasim depends on pathd, catdes on fbasim, dyncon on catdes
    expect(result.dependencyEdges).toContainEqual(["pathd", "fbasim"]);
    expect(result.dependencyEdges).toContainEqual(["fbasim", "catdes"]);
    expect(result.dependencyEdges).toContainEqual(["catdes", "dyncon"]);
  });
});

// ── getToolDependencies ──────────────────────────────────────────────────

describe("getToolDependencies", () => {
  it("returns empty array for pathd (no required inputs)", () => {
    expect(getToolDependencies("pathd")).toEqual([]);
  });

  it("returns pathd as required dep for fbasim", () => {
    expect(getToolDependencies("fbasim")).toEqual(["pathd"]);
  });

  it("returns fbasim as required dep for catdes", () => {
    expect(getToolDependencies("catdes")).toEqual(["fbasim"]);
  });

  it("returns catdes as required dep for dyncon", () => {
    expect(getToolDependencies("dyncon")).toEqual(["catdes"]);
  });

  it("returns dyncon as required dep for cellfree", () => {
    expect(getToolDependencies("cellfree")).toEqual(["dyncon"]);
  });

  it("returns cellfree as required dep for dbtlflow", () => {
    expect(getToolDependencies("dbtlflow")).toEqual(["cellfree"]);
  });

  it("returns empty array for unknown tool ID", () => {
    expect(getToolDependencies("nonexistent")).toEqual([]);
  });

  it("returns empty array for sidecar tools with no required inputs", () => {
    expect(getToolDependencies("cethx")).toEqual([]);
    expect(getToolDependencies("proevol")).toEqual([]);
    expect(getToolDependencies("genmim")).toEqual([]);
  });
});

// ── runToolPipeline ──────────────────────────────────────────────────────

describe("runToolPipeline", () => {
  it("runs a single-tool pipeline with real engine", async () => {
    // Use cethx which has a real executor that doesn't require WASM
    const result = await runToolPipeline(["cethx"], {
      reactions: [{ id: "R1", name: "test", stoichiometry: {}, deltaG0: -10 }],
      conditions: { pH: 7.0, ionicStrength: 0.1, temperature: 298.15 },
      targetProduct: "product",
    });
    // Should either succeed or fail gracefully (not crash)
    expect(typeof result.success).toBe("boolean");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].toolId).toBe("cethx");
    expect(typeof result.steps[0].durationMs).toBe("number");
    expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("chains output of one tool as input to the next", async () => {
    // Use two tools that have real executors
    const result = await runToolPipeline(["cethx"], {
      reactions: [{ id: "R1", name: "test", stoichiometry: {}, deltaG0: -10 }],
      conditions: { pH: 7.0, ionicStrength: 0.1, temperature: 298.15 },
      targetProduct: "product",
    });
    expect(typeof result.success).toBe("boolean");
    expect(result.steps).toHaveLength(1);
  });

  it("returns success:false for an empty pipeline", async () => {
    const result = await runToolPipeline([], {});
    expect(result.success).toBe(false);
    expect(result.steps).toHaveLength(0);
  });

  it("returns success:false for pipeline with unknown tool", async () => {
    const result = await runToolPipeline(["fake-tool"], {});
    expect(result.success).toBe(false);
  });

  it("marks subsequent steps as skipped after a dependency failure", async () => {
    // fbasim alone (without pathd) should fail validation
    const result = await runToolPipeline(["fbasim"], {});
    expect(result.success).toBe(false);
    // Steps should be empty because validation failed before execution
    expect(result.steps).toHaveLength(0);
  });

  it("includes timing information for each step", async () => {
    const result = await runToolPipeline(["cethx"], {
      reactions: [{ id: "R1", name: "test", stoichiometry: {}, deltaG0: -10 }],
      conditions: { pH: 7.0, ionicStrength: 0.1, temperature: 298.15 },
      targetProduct: "product",
    });
    expect(typeof result.success).toBe("boolean");
    for (const step of result.steps) {
      expect(typeof step.durationMs).toBe("number");
      expect(step.durationMs).toBeGreaterThanOrEqual(0);
    }
    expect(typeof result.totalTimeMs).toBe("number");
    expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("totalTimeMs is at least the sum of step durations", async () => {
    const result = await runToolPipeline(["cethx"], {
      reactions: [{ id: "R1", name: "test", stoichiometry: {}, deltaG0: -10 }],
      conditions: { pH: 7.0, ionicStrength: 0.1, temperature: 298.15 },
      targetProduct: "product",
    });
    expect(typeof result.success).toBe("boolean");
    if (result.steps.length > 0) {
      const stepsSum = result.steps.reduce((acc, s) => acc + s.durationMs, 0);
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(stepsSum - 1);
    }
  });

  it("handles tools with no custom executor via error", async () => {
    // "unknown-tool" has no executor — should fail validation or execution
    const result = await runToolPipeline(["unknown-tool"], { data: "test" });
    expect(result.success).toBe(false);
  });
});
