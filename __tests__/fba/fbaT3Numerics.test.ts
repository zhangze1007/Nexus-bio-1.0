/**
 * FBA T3 — numerics & performance.
 *
 *  - Degeneracy / alternative optima: the LP objective value is unique and
 *    correct even when the flux distribution that attains it is NOT unique.
 *  - Performance budget: solveAuthorityFBA stays well under the roadmap ceiling
 *    (solveAuthorityFBA < 5s).
 */
import { solveAuthorityFBA } from "../../src/server/fbaEngine";
import { type LPModel, solveLP } from "../../src/server/highsSolver";

/**
 * Two parallel unit-yield routes v1, v2 carry substrate S to product P:
 *   S balance:  u - v1 - v2 = 0      (uptake u produces S)
 *   P balance:  v1 + v2 - e = 0      (export e drains P)
 * maximize e, with u ≤ 10. The optimum objective e* = 10 is unique, but the
 * (v1, v2) split is a classic degenerate/alternative-optima face.
 */
function degenerateModel(v1ub = 10, v2ub = 10): LPModel {
  return {
    name: "degenerate",
    sense: "maximize",
    objective: [{ name: "e", coef: 1 }],
    constraints: [
      { name: "S_balance", vars: [{ name: "u", coef: 1 }, { name: "v1", coef: -1 }, { name: "v2", coef: -1 }], lb: 0, ub: 0 },
      { name: "P_balance", vars: [{ name: "v1", coef: 1 }, { name: "v2", coef: 1 }, { name: "e", coef: -1 }], lb: 0, ub: 0 },
    ],
    bounds: [
      { name: "u", lb: 0, ub: 10 },
      { name: "v1", lb: 0, ub: v1ub },
      { name: "v2", lb: 0, ub: v2ub },
      { name: "e", lb: 0, ub: 1000 },
    ],
  };
}

describe("FBA T3 — degeneracy / alternative optima", () => {
  it("objective value is unique and correct while the flux distribution is not", async () => {
    const base = await solveLP(degenerateModel());
    // Restrict to two different optimal faces by capping one route at zero.
    const noV1 = await solveLP(degenerateModel(0, 10));
    const noV2 = await solveLP(degenerateModel(10, 0));

    for (const s of [base, noV1, noV2]) expect(s.status).toBe("optimal");

    // Objective is invariant across the alternative optima (unique optimum e* = 10).
    expect(base.objectiveValue).toBeCloseTo(10, 6);
    expect(noV1.objectiveValue).toBeCloseTo(base.objectiveValue, 6);
    expect(noV2.objectiveValue).toBeCloseTo(base.objectiveValue, 6);

    // ...but the flux distribution attaining it is genuinely non-unique:
    //   noV1 forces v1 = 0  (all flux through v2)
    //   noV2 forces v2 = 0  (all flux through v1)
    expect(noV1.primals.v1).toBeCloseTo(0, 6);
    expect(noV1.primals.v2).toBeCloseTo(10, 6);
    expect(noV2.primals.v1).toBeCloseTo(10, 6);
    expect(noV2.primals.v2).toBeCloseTo(0, 6);
    // Same objective, different internal fluxes → alternative optima confirmed.
    expect(noV1.primals.v1).not.toBeCloseTo(noV2.primals.v1, 6);
  });

  it("is deterministic on the degenerate model (same objective and vertex twice)", async () => {
    const a = await solveLP(degenerateModel());
    const b = await solveLP(degenerateModel());
    expect(a.objectiveValue).toBe(b.objectiveValue);
    expect(a.primals.v1).toBe(b.primals.v1);
    expect(a.primals.v2).toBe(b.primals.v2);
  });
});

describe("FBA T3 — performance budget", () => {
  it("solveAuthorityFBA stays under the roadmap 5s budget", async () => {
    const req = { species: "ecoli", objective: "biomass", glucoseUptake: 10, oxygenUptake: 20 } as const;
    // Warm up: the first solve pays the one-time HiGHS WASM load cost.
    await solveAuthorityFBA(req);

    const t0 = performance.now();
    const result = await solveAuthorityFBA(req);
    const elapsedMs = performance.now() - t0;

    expect(result.feasible).toBe(true);
    // Roadmap budget: solveAuthorityFBA < 5s (measured ~ms). Generous ceiling so
    // the assertion is not flaky on slow CI while still catching a regression.
    expect(elapsedMs).toBeLessThan(5000);
  });
});
