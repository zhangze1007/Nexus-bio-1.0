/**
 * Stage 3 — variant-effect learning curve (platform TS side).
 *
 * Uses ONLY the reference-validated primitives:
 *   - RidgeRegression from src/modules/ml/models.ts  (= sklearn fit_intercept=True)
 *   - spearmanCorrelation from src/modules/ml/spearman.ts  (= scipy.stats.spearmanr)
 *
 * Input: local ESM-2 delta features.json (4996×480 + real DMS_score).
 * Protocol (pre-registered, no post-hoc moves):
 *   - Fixed hold-out of 1500 variants (seed-0 shuffle), NEVER used for training
 *     or alpha selection. Pool = the other 3496.
 *   - train size ∈ {50,100,200,500,1000}, 10 seeds each.
 *   - per (size,seed): sample train from pool; pick alpha on an inner 75/25
 *     split (Spearman on val) from a grid; refit on the full train with that
 *     alpha; predict the hold-out; Spearman(pred, real DMS).
 *   - floor baseline: permute the hold-out predictions (seeded) → Spearman ≈ 0.
 *   - report mean±std over seeds. Every number is reproducible from its seed.
 *
 * Run: npx tsx scripts/learningCurve.mts
 * (Standalone — deliberately NOT a jest test, so it never runs in CI and never
 *  loads the multi-MB features.json there.)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { RidgeRegression } from "../src/modules/ml/models";
import { spearmanCorrelation } from "../src/modules/ml/spearman";
import { makeRng, randInt, type Rng } from "../src/utils/rng";

// Input/output are overridable via argv (backward-compatible: no args = the
// original mean-pooled run). Lets the SAME protocol run on features_perpos.json.
const FEATURES = process.argv[2] ?? "C:/Users/HP/Downloads/Telegram Desktop/features.json";
const OUT = process.argv[3] ?? "C:/Users/HP/Downloads/Telegram Desktop/learning_curve_results.json";

const HOLDOUT = 1500;
const SIZES = [50, 100, 200, 500, 1000];
const SEEDS = 10;
const ALPHAS = [1, 10, 100, 1000, 10000];

const t0 = Date.now();
const f = JSON.parse(readFileSync(FEATURES, "utf8")) as { X: number[][]; y: number[]; dim: number; n: number };
const X = f.X;
const y = f.y;
const N = X.length;
console.log(`loaded features: n=${N} dim=${f.dim}  (holdout=${HOLDOUT}, pool=${N - HOLDOUT})`);

/** Fisher–Yates shuffle of 0..n-1 with a fixed seed. */
function shuffledIndices(seed: number, n: number): number[] {
  const rng = makeRng(seed);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    const tmp = idx[i];
    idx[i] = idx[j];
    idx[j] = tmp;
  }
  return idx;
}

/** k distinct indices sampled without replacement from `pool` using `rng`. */
function sampleWithoutReplacement(rng: Rng, pool: number[], k: number): number[] {
  const a = pool.slice();
  for (let i = 0; i < k; i++) {
    const j = i + randInt(rng, a.length - i);
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a.slice(0, k);
}

const gather = (idx: number[]): { X: number[][]; y: number[] } => ({ X: idx.map((i) => X[i]), y: idx.map((i) => y[i]) });

function fitPredict(trainIdx: number[], alpha: number, testX: number[][]): number[] {
  const g = gather(trainIdx);
  const model = new RidgeRegression(alpha);
  model.fit(g.X, g.y);
  return model.predict(testX);
}

// ── Fixed hold-out (never touched during training / alpha selection) ──────────
const globalOrder = shuffledIndices(0, N);
const holdoutIdx = globalOrder.slice(N - HOLDOUT);
const poolIdx = globalOrder.slice(0, N - HOLDOUT);
const holdoutSet = new Set(holdoutIdx);
const Xh = holdoutIdx.map((i) => X[i]);
const yh = holdoutIdx.map((i) => y[i]);

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const std = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length);
};

const results: Record<string, unknown> = {
  features: FEATURES,
  n: N,
  dim: f.dim,
  holdout: HOLDOUT,
  pool: poolIdx.length,
  seeds_per_size: SEEDS,
  alpha_grid: ALPHAS,
  holdout_seed: 0,
  by_size: {} as Record<number, unknown>,
};

let leakChecks = 0;

for (const size of SIZES) {
  const sup: number[] = [];
  const floor: number[] = [];
  const chosenAlpha: number[] = [];
  const seedLog: Array<{ seed: number; alpha: number; spearman: number; floor: number }> = [];

  for (let s = 0; s < SEEDS; s++) {
    const seed = size * 1000 + s; // recorded, reproducible
    const rng = makeRng(seed);
    const trainIdx = sampleWithoutReplacement(rng, poolIdx, size);

    // Anti-leakage assertion: no training index may be in the hold-out.
    for (const i of trainIdx) {
      if (holdoutSet.has(i)) throw new Error(`LEAK: train index ${i} is in hold-out (size=${size}, seed=${seed})`);
      leakChecks++;
    }

    // Alpha selection on an inner 75/25 split of the TRAIN sample only.
    const nInner = Math.max(2, Math.floor(size * 0.75));
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
    chosenAlpha.push(bestAlpha);

    // Refit on the FULL train sample with the selected alpha, score on hold-out.
    const hp = fitPredict(trainIdx, bestAlpha, Xh);
    const rho = spearmanCorrelation(hp, yh);
    sup.push(rho);

    // Floor: permute the hold-out predictions (seeded) — should be ≈ 0.
    const permOrder = shuffledIndices(9_000_000 + size * 100 + s, hp.length);
    const permuted = permOrder.map((k) => hp[k]);
    const fl = spearmanCorrelation(permuted, yh);
    floor.push(fl);

    seedLog.push({ seed, alpha: bestAlpha, spearman: Number(rho.toFixed(4)), floor: Number(fl.toFixed(4)) });
  }

  const alphaCounts: Record<number, number> = {};
  for (const a of chosenAlpha) alphaCounts[a] = (alphaCounts[a] ?? 0) + 1;

  (results.by_size as Record<number, unknown>)[size] = {
    supervised_mean: Number(mean(sup).toFixed(4)),
    supervised_std: Number(std(sup).toFixed(4)),
    floor_mean: Number(mean(floor).toFixed(4)),
    floor_std: Number(std(floor).toFixed(4)),
    alpha_counts: alphaCounts,
    seeds: seedLog,
  };

  console.log(
    `size=${String(size).padStart(4)}  Spearman=${mean(sup).toFixed(4)} ± ${std(sup).toFixed(4)}` +
      `   floor=${mean(floor).toFixed(4)} ± ${std(floor).toFixed(4)}   alpha=${JSON.stringify(alphaCounts)}`,
  );
}

results.leak_checks_passed = leakChecks;
writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log(`\nleak checks passed: ${leakChecks} (0 train indices ever in hold-out)`);
console.log(`elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s   wrote ${OUT}`);
