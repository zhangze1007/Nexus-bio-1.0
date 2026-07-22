/**
 * CC-2 reference benchmark (protein cluster, T2): the repo's BLOSUM62 matrices —
 * the data primitive under the ddG linear model and sequence design — must be
 * byte-exact against the authoritative Henikoff & Henikoff (1992) matrix.
 *
 * Ground truth: benchmarks/reference/protein/blosum62.json (biopython
 * Bio.Align.substitution_matrices BLOSUM62), integer-exact (tolerance.exact).
 *
 * Every repo copy is checked cell-by-cell. A mismatch is a real transcription
 * bug that pollutes every BLOSUM62 score / ΔΔG / design decision — it is fixed
 * in the repo (never by editing the fixture or relaxing to "approximate").
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type ReferenceCase, runReferenceCase } from "../../src/services/benchmark/referenceRunner";
import { BLOSUM62_RAW as CATDES_SHARED_B62 } from "../../src/components/tools/catdes/catdesShared";
import { BLOSUM62_RAW as CAT_ENGINE_B62 } from "../../src/services/CatalystDesignerEngine";
import { BLOSUM62 as PROEVOL_B62 } from "../../src/services/ProEvolCampaignEngine";
import { BLOSUM62 as INVERSE_FOLDING_B62 } from "../../src/server/inverseFoldingEngine";

interface Blosum62Fixture {
  source: string;
  alphabet: string[];
  matrix: Record<string, Record<string, number>>;
  anchors: Record<string, number>;
  tolerance: { exact: boolean };
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "benchmarks", "reference", "protein", "blosum62.json"), "utf8"),
) as Blosum62Fixture;

// All three repo matrices store columns in this order (verified from source).
const REPO_COL_ORDER = "ACDEFGHIKLMNPQRSTVWY";

/** Accessor for a Record<AA, number[]> matrix (row keyed by AA, cols positional). */
const recordAccess =
  (m: Record<string, number[]>) =>
  (rowAA: string, colAA: string): number =>
    m[rowAA]?.[REPO_COL_ORDER.indexOf(colAA)] ?? Number.NaN;

/** Accessor for a number[][] matrix (both row and col positional). */
const gridAccess =
  (m: number[][]) =>
  (rowAA: string, colAA: string): number =>
    m[REPO_COL_ORDER.indexOf(rowAA)]?.[REPO_COL_ORDER.indexOf(colAA)] ?? Number.NaN;

/** Accessor for a nested Record<AA, Record<AA, number>> matrix (both keyed by AA). */
const nestedAccess =
  (m: Record<string, Record<string, number>>) =>
  (rowAA: string, colAA: string): number =>
    m[rowAA]?.[colAA] ?? Number.NaN;

const MATRICES: Array<{ name: string; get: (r: string, c: string) => number }> = [
  { name: "CatalystDesignerEngine.BLOSUM62_RAW (ddG + sequence design)", get: recordAccess(CAT_ENGINE_B62) },
  { name: "catdes/catdesShared.BLOSUM62_RAW (catalyst designer UI)", get: recordAccess(CATDES_SHARED_B62) },
  { name: "inverseFoldingEngine.BLOSUM62 (sequence design)", get: gridAccess(INVERSE_FOLDING_B62) },
  { name: "ProEvolCampaignEngine.BLOSUM62 (evolutionary scoring)", get: nestedAccess(PROEVOL_B62) },
];

describe("CC-2 benchmark — BLOSUM62 data primitive vs Henikoff 1992 (exact)", () => {
  it("fixture is the full 20×20 standard matrix", () => {
    expect(fixture.alphabet).toHaveLength(20);
    expect(fixture.tolerance.exact).toBe(true);
    // Well-known anchors, as a sanity check on the fixture itself.
    expect(fixture.matrix.W.W).toBe(11);
    expect(fixture.matrix.C.C).toBe(9);
    expect(fixture.matrix.A.A).toBe(4);
  });

  it.each(MATRICES)("$name matches the authoritative matrix exactly", ({ name, get }) => {
    const observed: number[] = [];
    const expected: number[] = [];
    const mismatches: string[] = [];

    for (const rowAA of fixture.alphabet) {
      for (const colAA of fixture.alphabet) {
        const obs = get(rowAA, colAA);
        const exp = fixture.matrix[rowAA][colAA];
        observed.push(obs);
        expected.push(exp);
        if (obs !== exp) mismatches.push(`${rowAA}-${colAA}: repo=${obs} expected=${exp}`);
      }
    }

    if (mismatches.length > 0) {
      // eslint-disable-next-line no-console
      console.info(`[T2-BLOSUM] ${name}: ${mismatches.length} mismatched cell(s): ${mismatches.join("; ")}`);
    }

    const c: ReferenceCase<number[], number[]> = {
      id: `blosum62.${name}`,
      input: observed,
      expected,
      tolerance: 0, // integer-exact — never approximate
      metric: "abs",
      source: fixture.source,
    };
    const reports = runReferenceCase((xs: number[]) => xs, c);
    for (const r of reports) expect(r.ok).toBe(true);
  });
});
