/**
 * CC-2 reference benchmark (Phase 1, T2 — genome scale): the repo's FBA must
 * reproduce COBRApy on the genome-scale iJO1366 model (2583 reactions), and the
 * adapter + LP solver must handle that scale within a sane time budget.
 *
 * Ground truth (committed under benchmarks/reference/fba/):
 *   - iJO1366.model.json  — the genome-scale COBRA JSON model
 *   - iJO1366.core.json   — COBRApy optimal biomass 0.982372 + key exchange fluxes
 *
 * Gates:
 *   (a) correctness — biomass within ±1%; key exchange fluxes within flux_abs 0.5
 *   (b) scale       — the adapter/solver ingest 2583 reactions without crashing
 *   (c) performance — a single solve stays under a measured, sane budget
 *
 * Honesty: the tolerances and fixture are fixed. A genome-scale miss, crash, or
 * pathological slowdown is exactly the weakness this tier is meant to expose —
 * reported with real numbers, never hidden by widening tolerance.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type CobraModel, runCobraFBA } from "../../src/services/benchmark/cobraModelAdapter";
import { type ReferenceCase, runReferenceCase } from "../../src/services/benchmark/referenceRunner";

interface ExpectedCore {
  source: string;
  n_reactions: number;
  n_metabolites: number;
  biomass_flux: number;
  key_fluxes: Record<string, number>;
  tolerance: { biomass_rel: number; flux_abs: number };
}

const REF_DIR = join(__dirname, "..", "..", "benchmarks", "reference", "fba");
const model = JSON.parse(readFileSync(join(REF_DIR, "iJO1366.model.json"), "utf8")) as CobraModel;
const expected = JSON.parse(readFileSync(join(REF_DIR, "iJO1366.core.json"), "utf8")) as ExpectedCore;

// Sane single-solve budget for a ~2600-variable LP through the HiGHS WASM path.
// Measured ~188 ms in isolation; 8 s leaves >40× headroom for parallel full-suite
// contention and CI jitter while still catching a real scale regression (an
// O(n²) build or a broken solve would take minutes / crash, not seconds).
const SOLVE_BUDGET_MS = 8000;

describe("CC-2 benchmark — genome-scale iJO1366 FBA vs COBRApy", () => {
  let result: Awaited<ReturnType<typeof runCobraFBA>>;
  let solveMs = 0;

  beforeAll(async () => {
    // Warm up the HiGHS WASM (one-time load), then time a clean solve.
    await runCobraFBA(model);
    const t0 = performance.now();
    result = await runCobraFBA(model);
    solveMs = performance.now() - t0;
    // eslint-disable-next-line no-console
    console.info(
      `[T2-iJO1366] status=${result.status} rxns=${Object.keys(result.fluxes).length} biomass=${result.objectiveValue.toFixed(6)} solveMs=${solveMs.toFixed(1)}`,
    );
  }, 120000);

  it("(b) scale: ingests the full 2583-reaction model and solves to optimality", () => {
    expect(model.reactions.length).toBe(expected.n_reactions);
    expect(model.metabolites.length).toBe(expected.n_metabolites);
    expect(result.status).toBe("optimal");
    // Every reaction produced a flux ⇒ nothing was silently dropped.
    expect(Object.keys(result.fluxes).length).toBe(expected.n_reactions);
  });

  it("(a) correctness: reproduces the COBRApy biomass within 1%", () => {
    const c: ReferenceCase<number, number> = {
      id: "iJO1366.biomass",
      input: result.objectiveValue,
      expected: expected.biomass_flux, // 0.982372
      tolerance: expected.tolerance.biomass_rel,
      metric: "rel",
      source: expected.source,
    };
    const [rep] = runReferenceCase((x) => x, c);
    // eslint-disable-next-line no-console
    console.info(
      `[T2-iJO1366] biomass observed=${rep.observed.toFixed(6)} expected=${rep.expected} relErr=${(rep.error * 100).toFixed(3)}%`,
    );
    expect(rep.ok).toBe(true);
  });

  it("(a) correctness: reproduces the key exchange fluxes within tolerance", () => {
    const ids = Object.keys(expected.key_fluxes);
    const observed = ids.map((id) => result.fluxes[id] ?? Number.NaN);
    const expectedVals = ids.map((id) => expected.key_fluxes[id]);

    const c: ReferenceCase<number[], number[]> = {
      id: "iJO1366.key_fluxes",
      input: observed,
      expected: expectedVals,
      tolerance: expected.tolerance.flux_abs, // 0.5 absolute
      metric: "abs",
      source: expected.source,
    };
    const reports = runReferenceCase((xs: number[]) => xs, c);
    // eslint-disable-next-line no-console
    console.info(
      "[T2-iJO1366] key fluxes:",
      reports.map((r, i) => `${ids[i]}=${r.observed.toFixed(3)}(exp ${r.expected})`).join(" "),
    );
    for (const r of reports) expect(r.ok).toBe(true);
  });

  it("(c) performance: a single solve stays within the sane budget", () => {
    // eslint-disable-next-line no-console
    console.info(`[T2-iJO1366] single-solve time = ${solveMs.toFixed(1)} ms (budget ${SOLVE_BUDGET_MS} ms)`);
    expect(solveMs).toBeLessThan(SOLVE_BUDGET_MS);
  });
});
