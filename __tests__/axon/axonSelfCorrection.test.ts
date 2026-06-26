/** @jest-environment node */
/**
 * axonSelfCorrection.test.ts — error correction logic.
 *
 * Covers:
 *   - Known error patterns produce meaningful corrections
 *   - Max correction attempts enforced (3)
 *   - Correction changes inputs (isCorrectionMeaningful)
 *   - Generic fallback correction for unrecognized errors
 *   - Null return when no correction possible
 *   - Correction summary
 */
import {
  attemptCorrection,
  isCorrectionMeaningful,
  summariseCorrections,
  MAX_CORRECTION_ATTEMPTS,
  type CorrectionAttempt,
} from "../../src/services/axon/axonSelfCorrection";
import type { DAGTask } from "../../src/services/axon/axonDAGPlanner";
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

function makeTask(overrides: Partial<DAGTask> = {}): DAGTask {
  return {
    id: "task-1",
    tool: "pathd",
    inputs: { targetProduct: "test" },
    dependsOn: [],
    status: "failed",
    ...overrides,
  };
}

describe("attemptCorrection", () => {
  it("returns null when max attempts exceeded", () => {
    const task = makeTask();
    const result = attemptCorrection(
      task,
      "some error",
      emptyContext(),
      MAX_CORRECTION_ATTEMPTS,
    );
    expect(result).toBeNull();
  });

  it("corrects empty target product error", () => {
    const task = makeTask({
      inputs: { targetProduct: "" },
    });
    const result = attemptCorrection(
      task,
      "target product empty or missing",
      ctxWithTarget("artemisinin"),
    );
    expect(result).not.toBeNull();
    expect(result!.suggestedInput.targetProduct).toBe("artemisinin");
    expect(result!.attempt).toBe(1);
    expect(result!.reason).toContain("Empty target product");
  });

  it("falls back to 'artemisinin' when no context target", () => {
    const task = makeTask({ inputs: { targetProduct: "" } });
    const result = attemptCorrection(
      task,
      "target product not found",
      emptyContext(),
    );
    expect(result).not.toBeNull();
    expect(result!.suggestedInput.targetProduct).toBe("artemisinin");
  });

  it("corrects infeasible FBA error by loosening constraints", () => {
    const task = makeTask({
      tool: "fbasim",
      inputs: { species: "ecoli", knockouts: ["geneA", "geneB"] },
    });
    const result = attemptCorrection(
      task,
      "LP solver returned infeasible",
      emptyContext(),
    );
    expect(result).not.toBeNull();
    expect(result!.suggestedInput.knockouts).toEqual([]);
    expect(typeof result!.suggestedInput.glucoseUptake).toBe("number");
    expect(result!.reason).toContain("infeasible");
  });

  it("corrects empty result error", () => {
    const task = makeTask();
    const result = attemptCorrection(
      task,
      "no result returned from backend",
      emptyContext(),
    );
    expect(result).not.toBeNull();
    expect(result!.reason).toContain("Empty result");
  });

  it("corrects rate limit error", () => {
    const task = makeTask();
    const result = attemptCorrection(
      task,
      "HTTP 429 rate limit exceeded",
      emptyContext(),
    );
    expect(result).not.toBeNull();
    expect(result!.suggestedInput.maxResults).toBe(5);
  });

  it("corrects invalid parameters error by cleaning inputs", () => {
    const task = makeTask({
      inputs: { targetProduct: "artemisinin", extra: "data", foo: 123 },
    });
    const result = attemptCorrection(
      task,
      "invalid parameter: bad request",
      emptyContext(),
    );
    expect(result).not.toBeNull();
    // Should strip non-essential fields
    expect(result!.suggestedInput.extra).toBeUndefined();
    expect(result!.suggestedInput.foo).toBeUndefined();
    expect(result!.suggestedInput.targetProduct).toBe("artemisinin");
  });

  it("corrects binding affinity error", () => {
    const task = makeTask({
      tool: "catdes",
      inputs: { sequence: "MKFL" },
    });
    const result = attemptCorrection(
      task,
      "binding affinity too low",
      emptyContext(),
    );
    expect(result).not.toBeNull();
    expect(result!.suggestedInput.minAffinity).toBe(0);
    expect(result!.suggestedInput.expandLibrary).toBe(true);
  });

  it("corrects essential gene / lethal knockout error", () => {
    const task = makeTask({
      tool: "genmim",
      inputs: { maxKnockouts: 10 },
    });
    const result = attemptCorrection(
      task,
      "essential gene knockout detected",
      emptyContext(),
    );
    expect(result).not.toBeNull();
    expect(typeof result!.suggestedInput.maxKnockouts).toBe("number");
    expect(result!.suggestedInput.maxKnockouts).toBeLessThan(10);
  });

  it("provides generic fallback for unrecognized errors", () => {
    const task = makeTask();
    const result = attemptCorrection(
      task,
      "something completely unknown happened",
      emptyContext(),
    );
    expect(result).not.toBeNull();
    expect(result!.attempt).toBe(1);
    expect(result!.reason).toContain("generic retry");
  });

  it("returns null for generic fallback on attempt 3+", () => {
    const task = makeTask();
    // Attempt 1 and 2 use generic fallback
    const r1 = attemptCorrection(task, "unknown error A", emptyContext(), 0);
    expect(r1).not.toBeNull();
    const r2 = attemptCorrection(task, "unknown error B", emptyContext(), 1);
    expect(r2).not.toBeNull();
    // Attempt 3: max reached
    const r3 = attemptCorrection(task, "unknown error C", emptyContext(), 2);
    expect(r3).toBeNull();
  });

  it("increments attempt number correctly", () => {
    const task = makeTask();
    const r1 = attemptCorrection(task, "infeasible", emptyContext(), 0);
    expect(r1!.attempt).toBe(1);
    const r2 = attemptCorrection(task, "infeasible", emptyContext(), 1);
    expect(r2!.attempt).toBe(2);
    const r3 = attemptCorrection(task, "infeasible", emptyContext(), 2);
    expect(r3!.attempt).toBe(3);
  });

  it("preserves original input in correction", () => {
    const task = makeTask({
      inputs: { species: "yeast", objective: "product" },
    });
    const result = attemptCorrection(
      task,
      "infeasible",
      emptyContext(),
    );
    expect(result!.originalInput).toEqual({
      species: "yeast",
      objective: "product",
    });
  });
});

describe("isCorrectionMeaningful", () => {
  it("returns true when inputs differ", () => {
    const correction: CorrectionAttempt = {
      originalInput: { a: 1 },
      suggestedInput: { a: 2 },
      reason: "test",
      attempt: 1,
    };
    expect(isCorrectionMeaningful(correction)).toBe(true);
  });

  it("returns false when inputs are identical", () => {
    const correction: CorrectionAttempt = {
      originalInput: { a: 1 },
      suggestedInput: { a: 1 },
      reason: "test",
      attempt: 1,
    };
    expect(isCorrectionMeaningful(correction)).toBe(false);
  });
});

describe("summariseCorrections", () => {
  it("returns 'No correction attempts' for empty array", () => {
    expect(summariseCorrections([])).toBe("No correction attempts");
  });

  it("summarises a single attempt", () => {
    const attempts: CorrectionAttempt[] = [
      {
        originalInput: {},
        suggestedInput: {},
        reason: "Loosened constraints",
        attempt: 1,
      },
    ];
    expect(summariseCorrections(attempts)).toBe(
      "Attempt 1: Loosened constraints",
    );
  });

  it("summarises multiple attempts", () => {
    const attempts: CorrectionAttempt[] = [
      {
        originalInput: {},
        suggestedInput: {},
        reason: "First fix",
        attempt: 1,
      },
      {
        originalInput: {},
        suggestedInput: {},
        reason: "Second fix",
        attempt: 2,
      },
    ];
    expect(summariseCorrections(attempts)).toBe(
      "Attempt 1: First fix; Attempt 2: Second fix",
    );
  });
});
