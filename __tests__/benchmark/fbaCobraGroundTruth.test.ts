/**
 * CC-2 reference benchmark (Phase 1, T2-FBA): the repo's own LP solver must
 * reproduce COBRApy's FBA solution on the *identical* e_coli_core model.
 *
 * Ground truth is committed under `benchmarks/reference/fba/`:
 *   - e_coli_core.model.json  — the exact COBRA JSON model COBRApy solved
 *   - e_coli_core.core.json   — COBRApy's optimal biomass + key fluxes
 *
 * Primary gate  : biomass objective within ±1% of 0.873922 (roadmap "LP within 1%").
 * Auxiliary     : key exchange fluxes (EX_*, ATPM) within an absolute tolerance.
 * Informational : internal single-reaction fluxes are NOT pinned — alternative
 *                 optima make them non-unique — so they are only sanity-checked
 *                 for finiteness, never used as a pass/fail criterion.
 *
 * Honesty: the 1% tolerance is fixed by the reference fixture. A miss is a real
 * finding about the solver / model loader, never something to paper over by
 * widening the tolerance.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type CobraModel, runCobraFBA } from "../../src/services/benchmark/cobraModelAdapter";
import { type ReferenceCase, runReferenceCase } from "../../src/services/benchmark/referenceRunner";

interface ExpectedCore {
  model: string;
  source: string;
  status: string;
  biomass_flux: number;
  key_fluxes: Record<string, number>;
  tolerance: { biomass: number; flux_abs: number; note: string };
}

const REF_DIR = join(__dirname, "..", "..", "benchmarks", "reference", "fba");
const model = JSON.parse(readFileSync(join(REF_DIR, "e_coli_core.model.json"), "utf8")) as CobraModel;
const expected = JSON.parse(readFileSync(join(REF_DIR, "e_coli_core.core.json"), "utf8")) as ExpectedCore;

describe("CC-2 benchmark — e_coli_core FBA vs COBRApy ground truth", () => {
  it("reproduces the COBRApy biomass objective within 1% (PRIMARY gate)", async () => {
    const result = await runCobraFBA(model);
    expect(result.status).toBe("optimal");

    const biomassCase: ReferenceCase<number, number> = {
      id: "e_coli_core.biomass",
      input: result.objectiveValue,
      expected: expected.biomass_flux, // 0.873922
      tolerance: expected.tolerance.biomass, // 0.01 — the roadmap's 1%, fixed
      metric: "rel",
      source: expected.source,
    };
    const [report] = runReferenceCase((x) => x, biomassCase);

    // Transparency: surface the actual number regardless of pass/fail.
    // eslint-disable-next-line no-console
    console.info(
      `[T2-FBA] biomass observed=${report.observed.toFixed(6)} expected=${report.expected} relErr=${(report.error * 100).toFixed(3)}%`,
    );

    expect(report.ok).toBe(true);
    expect(report.error).toBeLessThanOrEqual(expected.tolerance.biomass);
  });

  it("reproduces the key exchange fluxes within tolerance (auxiliary)", async () => {
    const result = await runCobraFBA(model);
    // Exchange + maintenance fluxes are effectively unique at the aerobic
    // glucose optimum, so they are a meaningful auxiliary check.
    const ids = ["EX_glc__D_e", "EX_o2_e", "EX_co2_e", "ATPM"];
    const observed = ids.map((id) => result.fluxes[id] ?? Number.NaN);
    const expectedVals = ids.map((id) => expected.key_fluxes[id]);

    const fluxCase: ReferenceCase<number[], number[]> = {
      id: "e_coli_core.exchange",
      input: observed,
      expected: expectedVals,
      tolerance: expected.tolerance.flux_abs, // 0.5 absolute
      metric: "abs",
      source: expected.source,
    };
    const reports = runReferenceCase((xs: number[]) => xs, fluxCase);

    // eslint-disable-next-line no-console
    console.info(
      "[T2-FBA] exchange fluxes:",
      reports.map((r, i) => `${ids[i]}=${r.observed.toFixed(3)}(exp ${r.expected})`).join(" "),
    );

    for (const r of reports) {
      expect(r.ok).toBe(true);
    }
  });

  it("computes finite internal fluxes (informational only — not a failure criterion)", async () => {
    const result = await runCobraFBA(model);
    // Non-unique under alternative optima ⇒ compared for information, never pinned.
    const internalIds = ["PGK", "PYK", "CS", "PFK", "G6PDH2r", "PGI", "TPI"];

    // eslint-disable-next-line no-console
    console.info(
      "[T2-FBA] internal fluxes (informational):",
      internalIds.map((id) => `${id}=${(result.fluxes[id] ?? Number.NaN).toFixed(3)}(ref ${expected.key_fluxes[id]})`).join(" "),
    );

    for (const id of internalIds) {
      expect(Number.isFinite(result.fluxes[id] ?? Number.NaN)).toBe(true);
    }
  });
});
