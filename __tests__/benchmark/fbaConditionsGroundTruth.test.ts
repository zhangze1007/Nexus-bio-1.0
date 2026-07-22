/**
 * CC-2 reference benchmark (Phase 1, T2): the repo's FBA must reproduce COBRApy
 * biomass across multiple media conditions on the identical e_coli_core model.
 *
 * Ground truth (committed under benchmarks/reference/fba/):
 *   - e_coli_core.model.json       — the model
 *   - e_coli_core.conditions.json  — per-condition reaction-bound `changes` +
 *     COBRApy biomass: aerobic_glucose 0.873922, anaerobic_glucose 0.211663,
 *     acetate_aerobic 0.173339, glucose_limited_5 0.415598.
 *
 * Each condition applies its `changes` as `[lb, ub]` overrides (a medium change)
 * via the adapter's bound-override, then solves biomass. Gate: each condition's
 * biomass within ±1% of the fixture value. This exercises the "change exchange
 * bounds → re-solve" path directly (bounds applied by exact reaction id, never a
 * name-substring heuristic).
 *
 * Honesty: the 1% tolerance and the fixture are fixed. A miss is a real finding
 * about the bound override / exchange handling / solver — never widened away.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type BoundOverrides, type CobraModel, runCobraFBA } from "../../src/services/benchmark/cobraModelAdapter";
import { type ReferenceCase, runReferenceCase } from "../../src/services/benchmark/referenceRunner";

interface ConditionsFixture {
  source: string;
  tolerance: { biomass_rel: number };
  conditions: Record<string, { changes: BoundOverrides; biomass: number }>;
}

const REF_DIR = join(__dirname, "..", "..", "benchmarks", "reference", "fba");
const model = JSON.parse(readFileSync(join(REF_DIR, "e_coli_core.model.json"), "utf8")) as CobraModel;
const fixture = JSON.parse(readFileSync(join(REF_DIR, "e_coli_core.conditions.json"), "utf8")) as ConditionsFixture;

describe("CC-2 benchmark — e_coli_core FBA across media conditions vs COBRApy", () => {
  const conditionNames = Object.keys(fixture.conditions);

  it("covers all four committed conditions", () => {
    expect(conditionNames).toEqual(
      expect.arrayContaining(["aerobic_glucose", "anaerobic_glucose", "acetate_aerobic", "glucose_limited_5"]),
    );
  });

  it.each(conditionNames)("reproduces COBRApy biomass within 1%% for condition '%s'", async (name) => {
    const cond = fixture.conditions[name];
    const result = await runCobraFBA(model, cond.changes);
    expect(result.status).toBe("optimal");

    const c: ReferenceCase<number, number> = {
      id: `conditions.${name}`,
      input: result.objectiveValue,
      expected: cond.biomass,
      tolerance: fixture.tolerance.biomass_rel, // 0.01, the roadmap's 1%
      metric: "rel",
      source: fixture.source,
    };
    const [rep] = runReferenceCase((x) => x, c);

    // eslint-disable-next-line no-console
    console.info(
      `[T2-COND] ${name}: observed=${rep.observed.toFixed(6)} expected=${rep.expected} relErr=${(rep.error * 100).toFixed(3)}% changes=${JSON.stringify(cond.changes)}`,
    );

    expect(rep.ok).toBe(true);
  });
});
