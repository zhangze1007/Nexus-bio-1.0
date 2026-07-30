import { GaussianProcess } from "../../server/gaussianProcess";
import type { FalsificationReport } from "../../types/falsification";
import { expectedImprovement, upperConfidenceBound } from "./acquisition";
import { type DesignPoint, type DesignSpace, encodePoint, sampleCandidates } from "./designSpace";

export interface DesignObservation {
  point: DesignPoint;
  observed: number;
}

export interface BatchSuggestion {
  /** Candidate points, ranked best-first by the acquisition function. */
  points: DesignPoint[];
  /** Why each point was chosen (explore vs exploit, residual boost). */
  rationale: string[];
  /** Acquisition score per point (higher = more informative). */
  expectedInfoGain: number[];
}

const POOL_MULTIPLIER = 60;
const MIN_POOL = 120;
const LENGTH_SCALE_GRID = [0.1, 0.2, 0.35, 0.5, 0.8];

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Aggregate recent falsification error into a non-negative exploration boost. */
function residualExploration(reports: FalsificationReport[]): number {
  if (reports.length === 0) return 0;
  return median(reports.map((r) => (Number.isFinite(r.medianRelError) ? Math.max(0, r.medianRelError) : 0)));
}

function encodeKey(space: DesignSpace, point: DesignPoint): string {
  return encodePoint(space, point)
    .map((v) => v.toFixed(4))
    .join(",");
}

/**
 * Suggest the next batch of experiments via GP-surrogate active learning.
 *
 * Fits the reused ProEvol GP (`server/gaussianProcess`) on the (design, observed)
 * history, samples a seeded candidate pool, scores each candidate by the chosen
 * acquisition function (EI or UCB), and returns the top `batchSize` ranked
 * best-first — with per-point rationale and expected info gain. The latest
 * falsification residuals widen exploration (they are consumed, not ignored).
 *
 * Fully deterministic for a fixed `seed`.
 */
export function suggestNextBatch(
  space: DesignSpace,
  history: DesignObservation[],
  recentReports: FalsificationReport[],
  opts: { batchSize: number; strategy: "ei" | "ucb"; seed: number },
): BatchSuggestion {
  const batchSize = Math.max(1, Math.floor(opts.batchSize));
  const poolSize = Math.max(MIN_POOL, batchSize * POOL_MULTIPLIER);
  const candidates = sampleCandidates(space, poolSize, opts.seed);
  const explore = residualExploration(recentReports);

  // No history → pure exploration over distinct candidates.
  if (history.length === 0) {
    const picked: DesignPoint[] = [];
    const seen = new Set<string>();
    for (const c of candidates) {
      if (picked.length >= batchSize) break;
      const key = encodeKey(space, c);
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(c);
    }
    return {
      points: picked,
      rationale: picked.map(() => "No prior observations — exploratory sample (uniform over the design space)."),
      expectedInfoGain: picked.map(() => 1),
    };
  }

  // Fit the GP surrogate on encoded history (hyperparameters via marginal likelihood).
  const X = history.map((h) => encodePoint(space, h.point));
  const y = history.map((h) => h.observed);
  const gp = new GaussianProcess({ kernel: "rbf", lengthScale: 0.3, signalVariance: 1, noiseVariance: 0.01 });
  gp.fitOptimized(X, y, "rbf", LENGTH_SCALE_GRID);
  const bestY = Math.max(...y);

  const preds = gp.predict(candidates.map((c) => encodePoint(space, c)));
  const scored = candidates.map((point, idx) => {
    const mean = preds[idx].mean;
    const sd = Math.sqrt(Math.max(preds[idx].variance, 0));
    let score: number;
    let mode: string;
    if (opts.strategy === "ucb") {
      const kappa = 2 * (1 + explore);
      score = upperConfidenceBound(mean, sd, kappa);
      mode = sd >= Math.abs(mean) ? "exploration" : "exploitation";
    } else {
      const xi = 0.01 + explore * 0.5;
      score = expectedImprovement(mean, sd, bestY, xi);
      mode = sd > 0 && score > 0 ? "exploration" : "exploitation";
    }
    return { point, mean, sd, score, mode, idx };
  });

  // Deterministic total order: score desc, then sd desc, then original index.
  scored.sort((a, b) => b.score - a.score || b.sd - a.sd || a.idx - b.idx);

  const points: DesignPoint[] = [];
  const rationale: string[] = [];
  const expectedInfoGain: number[] = [];
  const seen = new Set<string>();
  for (const s of scored) {
    if (points.length >= batchSize) break;
    const key = encodeKey(space, s.point);
    if (seen.has(key)) continue;
    seen.add(key);
    points.push(s.point);
    expectedInfoGain.push(s.score);
    const boost =
      explore > 0
        ? ` Exploration widened by recent falsification residuals (median relErr ${explore.toFixed(3)}).`
        : "";
    rationale.push(
      `${opts.strategy.toUpperCase()} score ${s.score.toFixed(4)}: predicted ${s.mean.toFixed(3)} ± ${s.sd.toFixed(3)} (${s.mode}).${boost}`,
    );
  }

  return { points, rationale, expectedInfoGain };
}
