/**
 * Export the per-position variant-effect Ridge model (productization).
 *
 * Same learning-curve protocol as exportRidgeModel.mts, but on the per-position
 * feature (features_perpos.json). Reproduces size=1000 / seed=1000000 / alpha
 * (selected on an inner 75/25 val split) EXACTLY, then exports
 * benchmarks/models/blat_ecolx_perpos_ridge_v1.json.
 *
 * Feature = mutation-site residue-embedding delta (variant−WT at the mutated
 * position). The backend recomputes this per variant; the artifact therefore
 * only needs coef/intercept + wt_seq (copied from the ML-1 artifact) — no
 * wt_embedding (per-position embeds the WT residue at inference).
 *
 * Self-check: hold-out Spearman from the exported coef/intercept reproduces the
 * learning-curve run (size=1000/seed0 per-seed = 0.6756; 10-seed mean 0.663).
 *
 * Run: npx tsx scripts/exportPerposRidgeModel.mts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RidgeRegression } from "../src/modules/ml/models";
import { spearmanCorrelation } from "../src/modules/ml/spearman";
import { makeRng, randInt, type Rng } from "../src/utils/rng";

const FEATURES = "C:/Users/HP/Downloads/Telegram Desktop/features_perpos.json";
const HOLDOUT = 1500;
const TRAIN_SIZE = 1000;
const SEED = TRAIN_SIZE * 1000 + 0; // = 1000000
const ALPHAS = [1, 10, 100, 1000, 10000];
const HOLDOUT_SEED = 0;
const LEARNING_CURVE_SEED0 = 0.6756; // per-position size=1000 seed0 (4dp); 10-seed mean 0.6634

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(repoRoot, "benchmarks", "models", "blat_ecolx_perpos_ridge_v1.json");
const ML1_ARTIFACT = join(repoRoot, "benchmarks", "models", "blat_ecolx_ridge_v1.json");

const f = JSON.parse(readFileSync(FEATURES, "utf8")) as { X: number[][]; y: number[]; dim: number; n: number; feature: string };
const wtSeq = (JSON.parse(readFileSync(ML1_ARTIFACT, "utf8")) as { wt_seq: string }).wt_seq;
const X = f.X;
const y = f.y;
const N = X.length;

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
function sampleWithoutReplacement(rng: Rng, pool: number[], k: number): number[] {
  const a = pool.slice();
  for (let i = 0; i < k; i++) {
    const j = i + randInt(rng, a.length - i);
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a.slice(0, k);
}
const gather = (idx: number[]) => ({ X: idx.map((i) => X[i]), y: idx.map((i) => y[i]) });
function fitPredict(trainIdx: number[], alpha: number, testX: number[][]): number[] {
  const g = gather(trainIdx);
  const m = new RidgeRegression(alpha);
  m.fit(g.X, g.y);
  return m.predict(testX);
}
function extractLinear(model: RidgeRegression, dim: number): { intercept: number; coef: number[] } {
  const intercept = model.predict([new Array(dim).fill(0)])[0];
  const coef = Array.from({ length: dim }, (_, j) => {
    const e = new Array(dim).fill(0);
    e[j] = 1;
    return model.predict([e])[0] - intercept;
  });
  return { intercept, coef };
}

const globalOrder = shuffledIndices(HOLDOUT_SEED, N);
const holdoutIdx = globalOrder.slice(N - HOLDOUT);
const poolIdx = globalOrder.slice(0, N - HOLDOUT);
const Xh = holdoutIdx.map((i) => X[i]);
const yh = holdoutIdx.map((i) => y[i]);

const rng = makeRng(SEED);
const trainIdx = sampleWithoutReplacement(rng, poolIdx, TRAIN_SIZE);
const nInner = Math.max(2, Math.floor(TRAIN_SIZE * 0.75));
const inner = trainIdx.slice(0, nInner);
const val = trainIdx.slice(nInner);
let bestAlpha = ALPHAS[0];
let bestScore = Number.NEGATIVE_INFINITY;
for (const a of ALPHAS) {
  const vp = fitPredict(inner, a, val.map((i) => X[i]));
  const sc = spearmanCorrelation(vp, val.map((i) => y[i]));
  if (Number.isFinite(sc) && sc > bestScore) {
    bestScore = sc;
    bestAlpha = a;
  }
}

const g = gather(trainIdx);
const finalModel = new RidgeRegression(bestAlpha);
finalModel.fit(g.X, g.y);
const { intercept, coef } = extractLinear(finalModel, f.dim);

const holdoutPred = Xh.map((row) => row.reduce((s, v, j) => s + v * coef[j], intercept));
const holdoutSpearman = spearmanCorrelation(holdoutPred, yh);
const modelPred = finalModel.predict(Xh);
const predMaxDiff = Math.max(...holdoutPred.map((p, i) => Math.abs(p - modelPred[i])));

console.log(`feature: ${f.feature}   selected alpha: ${bestAlpha}   wt_seq len: ${wtSeq.length}`);
console.log(`hold-out Spearman (from exported coef/intercept): ${holdoutSpearman.toFixed(6)}`);
console.log(`learning-curve seed0 (4dp): ${LEARNING_CURVE_SEED0}   |Δ|=${Math.abs(holdoutSpearman - LEARNING_CURVE_SEED0).toFixed(6)}   (10-seed mean 0.6634)`);
console.log(`coef-extraction exactness vs model.predict(): max|Δ|=${predMaxDiff.toExponential(2)}`);

const artifact = {
  schema_version: "1.0",
  model_type: "ridge_variant_effect",
  feature: "perpos_delta",
  assay: "BLAT_ECOLX_Stiffler_2015",
  protein: "BLAT_ECOLX / TEM-1 beta-lactamase (E. coli)",
  data_source: "ProteinGym (HF OATML-Markslab/ProteinGym, snapshot 4075aa679683f3071d527283819637f3446ca488)",
  esm_model_id: "facebook/esm2_t12_35M_UR50D",
  feature_convention:
    "per-position delta: last_hidden_state(variant)[pos] - last_hidden_state(WT)[pos] at the mutated residue (pos = 1-indexed residue = token index, <cls> is token 0). Isolates the local single-mutation signal; NOT mean-pooled.",
  dim: f.dim,
  training: {
    protocol: "learning-curve reproduction (per-position feature)",
    train_size: TRAIN_SIZE,
    seed: SEED,
    holdout_size: HOLDOUT,
    holdout_seed: HOLDOUT_SEED,
    alpha_grid: ALPHAS,
    selected_alpha: bestAlpha,
    alpha_selection: "inner 75/25 split of the train sample, max val-Spearman (hold-out never touched)",
  },
  holdout_spearman: holdoutSpearman,
  learning_curve_spearman_seed0: LEARNING_CURVE_SEED0,
  learning_curve_spearman_mean: 0.6634,
  learning_curve_spearman_std: 0.0108,
  holdout_indices: holdoutIdx,
  intercept,
  coef,
  wt_seq: wtSeq,
  wt_note: "WT copied from blat_ecolx_ridge_v1.json (ML-1, verified). Backend embeds WT residues at load; no stored wt_embedding needed for the per-position path.",
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(artifact, null, 2));
console.log(`\nwrote ${OUT}  (coef len=${coef.length}, intercept=${intercept.toFixed(6)}, feature=perpos_delta)`);
