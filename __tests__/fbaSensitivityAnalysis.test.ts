import { solveLP, type LPModel } from "../src/server/highsSolver";
import {
  runSensitivityAnalysis,
  runMetabolicControlAnalysis,
  type ParameterRange,
} from "../src/services/fba/fbaSensitivityAnalysis";

/**
 * Linear 3-reaction pathway with v1 as the bottleneck:
 *
 *   A --[v1]--> B --[v2]--> C --[v3]--> D
 *
 * Mass-balance: v1 = v2 = v3
 * Bounds: v1 <= 5, v2 <= 10, v3 <= 10
 * Objective: maximise v3
 *
 * Optimal: v1 = v2 = v3 = 5, objective = 5
 * v1 is the sole bottleneck; perturbing v2 or v3 bounds has no effect.
 */
function buildBottleneckModel(): LPModel {
  return {
    name: "test_linear",
    sense: "maximize",
    objective: [{ name: "v3", coef: 1 }],
    constraints: [
      {
        name: "B_balance",
        vars: [
          { name: "v1", coef: 1 },
          { name: "v2", coef: -1 },
        ],
        lb: 0,
        ub: 0,
      },
      {
        name: "C_balance",
        vars: [
          { name: "v2", coef: 1 },
          { name: "v3", coef: -1 },
        ],
        lb: 0,
        ub: 0,
      },
    ],
    bounds: [
      { name: "v1", lb: 0, ub: 5 },
      { name: "v2", lb: 0, ub: 10 },
      { name: "v3", lb: 0, ub: 10 },
    ],
  };
}

/**
 * Branching network:
 *
 *   A --[v1]--> B --[v2]--> C        (path 1)
 *            \--[v3]--> D --[v4]--> C  (path 2)
 *   C --[v5]--> E  (objective)
 *
 * Mass-balance:
 *   B: v1 - v2 - v3 = 0
 *   C: v2 + v4 - v5 = 0
 *   D: v3 - v4 = 0
 *
 * Bounds: v1<=10, v2<=6, v3<=8, v4<=8, v5<=15
 * Optimal: v1=10, v2=3, v3=7, v4=7, v5=10
 *
 * v1 is the bottleneck (v5 = v1 via mass balance).
 * v2 has slack (bound=6, flux=3).
 */
function buildBranchingModel(): LPModel {
  return {
    name: "test_branch",
    sense: "maximize",
    objective: [{ name: "v5", coef: 1 }],
    constraints: [
      {
        name: "B_balance",
        vars: [
          { name: "v1", coef: 1 },
          { name: "v2", coef: -1 },
          { name: "v3", coef: -1 },
        ],
        lb: 0,
        ub: 0,
      },
      {
        name: "C_balance",
        vars: [
          { name: "v2", coef: 1 },
          { name: "v4", coef: 1 },
          { name: "v5", coef: -1 },
        ],
        lb: 0,
        ub: 0,
      },
      {
        name: "D_balance",
        vars: [
          { name: "v3", coef: 1 },
          { name: "v4", coef: -1 },
        ],
        lb: 0,
        ub: 0,
      },
    ],
    bounds: [
      { name: "v1", lb: 0, ub: 10 },
      { name: "v2", lb: 0, ub: 6 },
      { name: "v3", lb: 0, ub: 8 },
      { name: "v4", lb: 0, ub: 8 },
      { name: "v5", lb: 0, ub: 15 },
    ],
  };
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  1. Sensitivity Analysis — basic sweep                                  */
/* ═══════════════════════════════════════════════════════════════════════ */

describe("Sensitivity Analysis — basic sweep", () => {
  test("sweep of v1 upper bound returns correct number of points", async () => {
    const model = buildBottleneckModel();
    const ranges: ParameterRange[] = [{ parameterId: "v1", min: 0, max: 10, steps: 6 }];
    const results = await runSensitivityAnalysis(model, "v3", ranges);

    expect(results).toHaveLength(1);
    expect(results[0].fluxResponse).toHaveLength(6);
    expect(results[0].parameterValues).toHaveLength(6);
    expect(results[0].objectiveValues).toHaveLength(6);
  });

  test("objective increases monotonically with bottleneck bound", async () => {
    const model = buildBottleneckModel();
    const ranges: ParameterRange[] = [{ parameterId: "v1", min: 1, max: 10, steps: 10 }];
    const results = await runSensitivityAnalysis(model, "v3", ranges);
    const objVals = results[0].objectiveValues;

    for (let i = 1; i < objVals.length; i++) {
      expect(objVals[i]).toBeGreaterThanOrEqual(objVals[i - 1] - 1e-6);
    }
  });

  test("elasticity is approximately 1 for the bottleneck reaction", async () => {
    const model = buildBottleneckModel();
    // v1 is the sole bottleneck (ub=5, v2/v3 ub=10).
    // Sweeping v1 from 5 to 10, v3 = min(v1_ub, 10, 10) = v1_ub → elasticity = 1
    const ranges: ParameterRange[] = [{ parameterId: "v1", min: 5, max: 10, steps: 3 }];
    const results = await runSensitivityAnalysis(model, "v3", ranges);

    expect(results[0].elasticity).toBeCloseTo(1, 1);
  });

  test("elasticity is 0 when parameter does not constrain the objective", async () => {
    // Branching model: v1=10 is the bottleneck, v2 has slack (flux=3, ub=6).
    // Sweeping v2 ub from 5 to 10 should not change v5=10.
    const branch = buildBranchingModel();
    const ranges: ParameterRange[] = [{ parameterId: "v2", min: 5, max: 10, steps: 4 }];
    const results = await runSensitivityAnalysis(branch, "v5", ranges);

    expect(results[0].elasticity).toBeCloseTo(0, 1);
  });

  test("parameter values span the requested range", async () => {
    const model = buildBottleneckModel();
    const ranges: ParameterRange[] = [{ parameterId: "v1", min: 2, max: 8, steps: 7 }];
    const results = await runSensitivityAnalysis(model, "v3", ranges);
    const params = results[0].parameterValues;

    expect(params[0]).toBeCloseTo(2, 4);
    expect(params[params.length - 1]).toBeCloseTo(8, 4);
  });

  test("reference objective matches direct LP solve", async () => {
    const model = buildBottleneckModel();
    const direct = await solveLP(withObjective(model, "v3"));
    const ranges: ParameterRange[] = [{ parameterId: "v1", min: 5, max: 10, steps: 3 }];
    const results = await runSensitivityAnalysis(model, "v3", ranges);

    expect(results[0].referenceObjective).toBeCloseTo(direct.objectiveValue, 4);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  2. Sensitivity Analysis — multiple parameters                          */
/* ═══════════════════════════════════════════════════════════════════════ */

describe("Sensitivity Analysis — multiple parameters", () => {
  test("sweeping two parameters returns two result sets", async () => {
    const model = buildBottleneckModel();
    const ranges: ParameterRange[] = [
      { parameterId: "v1", min: 0, max: 5, steps: 5 },
      { parameterId: "v2", min: 5, max: 10, steps: 5 },
    ];
    const results = await runSensitivityAnalysis(model, "v3", ranges);

    expect(results).toHaveLength(2);
    expect(results[0].parameter).toBe("v1");
    expect(results[1].parameter).toBe("v2");
  });

  test("zero upper bound yields zero objective", async () => {
    const model = buildBottleneckModel();
    const ranges: ParameterRange[] = [{ parameterId: "v1", min: 0, max: 0, steps: 1 }];
    const results = await runSensitivityAnalysis(model, "v3", ranges);

    expect(results[0].objectiveValues[0]).toBeCloseTo(0, 4);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  3. Metabolic Control Analysis                                          */
/* ═══════════════════════════════════════════════════════════════════════ */

describe("Metabolic Control Analysis", () => {
  test("flux control coefficients are computed for all bound reactions", async () => {
    const model = buildBottleneckModel();
    const result = await runMetabolicControlAnalysis(model);

    expect(result.fluxControlCoefficients).toBeDefined();
    expect(Object.keys(result.fluxControlCoefficients)).toContain("v1");
    expect(Object.keys(result.fluxControlCoefficients)).toContain("v2");
    expect(Object.keys(result.fluxControlCoefficients)).toContain("v3");
  });

  test("flux control coefficients sum to approximately 1 (summation theorem)", async () => {
    const model = buildBottleneckModel();
    const result = await runMetabolicControlAnalysis(model);

    // In the bottleneck model: v1 is the sole constraint (C=1), v2/v3 have slack (C=0).
    // Sum = 1, satisfying the Kacser & Burns summation theorem.
    expect(result.fluxControlSum).toBeCloseTo(1, 1);
  });

  test("bottleneck reaction has flux control coefficient of 1", async () => {
    const model = buildBottleneckModel();
    const result = await runMetabolicControlAnalysis(model);

    // v1 is the sole bottleneck — perturbing its bound changes the objective.
    // FBA-level MCA: C^J_v1 = 1, C^J_v2 = C^J_v3 = 0.
    expect(result.fluxControlCoefficients["v1"]).toBeCloseTo(1, 1);
    expect(result.fluxControlCoefficients["v2"]).toBeCloseTo(0, 1);
    expect(result.fluxControlCoefficients["v3"]).toBeCloseTo(0, 1);
  });

  test("elasticity coefficients are computed for reaction pairs", async () => {
    const model = buildBottleneckModel();
    const result = await runMetabolicControlAnalysis(model);

    expect(result.elasticityCoefficients.length).toBeGreaterThan(0);

    // Should contain self-elasticity entries (diagonal)
    const selfElasticity = result.elasticityCoefficients.find(
      (e) => e.reactionId === "v1" && e.targetReactionId === "v1",
    );
    expect(selfElasticity).toBeDefined();
    // Self-elasticity of the bottleneck is 1 (flux scales with bound)
    expect(selfElasticity!.value).toBeCloseTo(1, 1);
  });

  test("concentration control coefficients are keyed by constraint names", async () => {
    const model = buildBottleneckModel();
    const result = await runMetabolicControlAnalysis(model);

    expect(result.concentrationControlCoefficients).toBeDefined();
    expect(Object.keys(result.concentrationControlCoefficients)).toContain("v1");
    const v1CCC = result.concentrationControlCoefficients["v1"];
    expect(Object.keys(v1CCC)).toContain("B_balance");
    expect(Object.keys(v1CCC)).toContain("C_balance");
  });

  test("reference fluxes match direct LP solve", async () => {
    const model = buildBottleneckModel();
    const direct = await solveLP(model);
    const result = await runMetabolicControlAnalysis(model);

    expect(result.referenceObjective).toBeCloseTo(direct.objectiveValue, 4);
    expect(result.referenceFluxes["v1"]).toBeCloseTo(direct.primals["v1"] ?? 0, 4);
    expect(result.referenceFluxes["v2"]).toBeCloseTo(direct.primals["v2"] ?? 0, 4);
    expect(result.referenceFluxes["v3"]).toBeCloseTo(direct.primals["v3"] ?? 0, 4);
  });

  test("branching model — flux control concentrates on the bottleneck", async () => {
    const model = buildBranchingModel();
    const result = await runMetabolicControlAnalysis(model);

    // v1 is the global bottleneck (v5 = v1 via mass balance).
    // v2 has slack (flux=3, bound=6) → C^J_v2 ≈ 0.
    const v1CC = result.fluxControlCoefficients["v1"] ?? 0;
    const v2CC = result.fluxControlCoefficients["v2"] ?? 0;

    expect(v1CC).toBeGreaterThan(v2CC);
    expect(v1CC).toBeCloseTo(1, 1);
  });

  test("analysed reactions list includes reactions with non-zero flux or bound", async () => {
    const model = buildBottleneckModel();
    const result = await runMetabolicControlAnalysis(model);

    expect(result.analysedReactions).toContain("v1");
    expect(result.analysedReactions).toContain("v2");
    expect(result.analysedReactions).toContain("v3");
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Helpers (duplicated from source for test isolation)                     */
/* ═══════════════════════════════════════════════════════════════════════ */

function withObjective(model: LPModel, reactionId: string): LPModel {
  return {
    ...model,
    objective: [{ name: reactionId, coef: 1 }],
    constraints: model.constraints.map((c) => ({
      ...c,
      vars: c.vars.map((v) => ({ ...v })),
    })),
    bounds: (model.bounds ?? []).map((b) => ({ ...b })),
  };
}
