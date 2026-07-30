/**
 * Zero-shot ESM masked-marginal Spearman for the cross-protein reproduction test.
 *
 * Reads a features_perpos_*.json produced by perpos_crossprotein.py (which carries
 * a per-variant `zeroshot` array) and reports the zero-shot Spearman vs DMS on the
 * FULL assay and on the SAME 1500-sample hold-out that learningCurve.mts uses
 * (identical seed-0 Fisher–Yates via the validated makeRng), so the supervised
 * learning curve and this zero-shot control are on the same hold-out.
 *
 * Reuses only the validated primitives (spearmanCorrelation, makeRng); no model
 * code is touched. Run: npx tsx scripts/crossProteinZeroshot.mts "<features_perpos.json>"
 */
import { readFileSync } from "node:fs";
import { spearmanCorrelation } from "../src/modules/ml/spearman";
import { makeRng, randInt } from "../src/utils/rng";

const FEATURES = process.argv[2];
if (!FEATURES) throw new Error("usage: crossProteinZeroshot.mts <features_perpos.json>");
const HOLDOUT = 1500; // identical to learningCurve.mts

const f = JSON.parse(readFileSync(FEATURES, "utf8")) as { y: number[]; zeroshot: number[]; n: number; dms: string };
const y = f.y;
const zs = f.zeroshot;
const N = y.length;
if (!Array.isArray(zs) || zs.length !== N) throw new Error("zeroshot array missing or wrong length");

// Same fixed hold-out as learningCurve.mts: seed-0 Fisher–Yates, last HOLDOUT rows.
function shuffledIndices(seed: number, n: number): number[] {
  const rng = makeRng(seed);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    const t = idx[i];
    idx[i] = idx[j];
    idx[j] = t;
  }
  return idx;
}
const holdoutIdx = shuffledIndices(0, N).slice(N - HOLDOUT);

const zsFull = spearmanCorrelation(zs, y);
const zsHold = spearmanCorrelation(
  holdoutIdx.map((i) => zs[i]),
  holdoutIdx.map((i) => y[i]),
);

console.log(`assay: ${f.dms}   n=${N}   holdout=${HOLDOUT}`);
console.log(`ZERO-SHOT Spearman (ESM masked-marginal vs DMS), full assay = ${zsFull.toFixed(4)}`);
console.log(`ZERO-SHOT Spearman, SAME 1500 hold-out                     = ${zsHold.toFixed(4)}`);
