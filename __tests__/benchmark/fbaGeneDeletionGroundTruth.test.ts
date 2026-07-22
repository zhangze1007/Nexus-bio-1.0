/**
 * CC-2 reference benchmark (Phase 1, T2): the repo's FBA gene-deletion must
 * reproduce COBRApy `single_gene_deletion` on the identical e_coli_core model.
 *
 * Ground truth (committed under benchmarks/reference/fba/):
 *   - e_coli_core.model.json          — the model (with gene_reaction_rules)
 *   - e_coli_core.gene_deletion.json  — COBRApy wild-type growth + per-gene KO
 *                                       growth + the 7 essential genes.
 *
 * Primary gates:
 *   - wild-type growth within ±1% of 0.873922
 *   - the computed essential-gene set is EXACTLY COBRApy's 7 (Jaccard reported,
 *     then set-equality required)
 * Auxiliary: per-gene essentiality classification agrees for every gene.
 *
 * Honesty: the 1e-6 essentiality threshold and the fixture are fixed. A mismatch
 * is a real finding about GPR parsing / KO logic / the solver — never papered
 * over by widening the threshold or editing the fixture.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type CobraModelWithGenes, runSingleGeneDeletion } from "../../src/services/benchmark/cobraGeneDeletion";
import { type ReferenceCase, runReferenceCase } from "../../src/services/benchmark/referenceRunner";

interface ExpectedGD {
  source: string;
  wild_type_growth: number;
  essential_threshold: number;
  n_essential: number;
  essential_genes: string[];
  per_gene_growth: Record<string, { growth: number; essential: boolean }>;
}

const REF_DIR = join(__dirname, "..", "..", "benchmarks", "reference", "fba");
const model = JSON.parse(readFileSync(join(REF_DIR, "e_coli_core.model.json"), "utf8")) as CobraModelWithGenes;
const expected = JSON.parse(readFileSync(join(REF_DIR, "e_coli_core.gene_deletion.json"), "utf8")) as ExpectedGD;

describe("CC-2 benchmark — e_coli_core single-gene deletion vs COBRApy", () => {
  let result: Awaited<ReturnType<typeof runSingleGeneDeletion>>;

  beforeAll(async () => {
    result = await runSingleGeneDeletion(model, expected.essential_threshold);
  }, 180000);

  it("reproduces the COBRApy wild-type growth within 1%", () => {
    const c: ReferenceCase<number, number> = {
      id: "gene_deletion.wildtype",
      input: result.wildTypeGrowth,
      expected: expected.wild_type_growth,
      tolerance: 0.01,
      metric: "rel",
      source: expected.source,
    };
    const [rep] = runReferenceCase((x) => x, c);
    // eslint-disable-next-line no-console
    console.info(
      `[T2-GD] wild-type growth observed=${rep.observed.toFixed(6)} expected=${rep.expected} relErr=${(rep.error * 100).toFixed(3)}%`,
    );
    expect(rep.ok).toBe(true);
  });

  it("computes an essential-gene set exactly equal to COBRApy's 7", () => {
    const mine = result.essentialGenes.slice().sort();
    const exp = expected.essential_genes.slice().sort();

    const mineSet = new Set(mine);
    const expSet = new Set(exp);
    const intersection = mine.filter((g) => expSet.has(g));
    const union = new Set([...mine, ...exp]);
    const jaccard = intersection.length / union.size;

    // eslint-disable-next-line no-console
    console.info(`[T2-GD] essential mine=[${mine.join(",")}] expected=[${exp.join(",")}] Jaccard=${jaccard.toFixed(3)}`);

    // Report Jaccard through the reference runner, then require exact equality.
    const [rep] = runReferenceCase((x) => x, {
      id: "gene_deletion.jaccard",
      input: jaccard,
      expected: 1,
      tolerance: 0,
      metric: "abs",
      source: expected.source,
    });
    expect(rep.ok).toBe(true); // Jaccard == 1 ⇒ identical sets
    expect(mine).toEqual(exp); // exact set equality
    expect(mineSet.size).toBe(expected.n_essential);
  });

  it("agrees with COBRApy on essentiality for every gene", () => {
    let maxGrowthDiff = 0;
    const mismatches: string[] = [];
    for (const [gene, exp] of Object.entries(expected.per_gene_growth)) {
      const mineGrowth = result.perGeneGrowth[gene];
      if (mineGrowth === undefined) {
        mismatches.push(`${gene}(missing)`);
        continue;
      }
      const mineEssential = mineGrowth < expected.essential_threshold;
      if (mineEssential !== exp.essential) mismatches.push(gene);
      maxGrowthDiff = Math.max(maxGrowthDiff, Math.abs(mineGrowth - exp.growth));
    }
    // eslint-disable-next-line no-console
    console.info(
      `[T2-GD] per-gene classification mismatches=${mismatches.length} maxKO-growth|Δ|=${maxGrowthDiff.toFixed(5)} (informational)`,
    );
    expect(mismatches).toEqual([]);
  });
});
