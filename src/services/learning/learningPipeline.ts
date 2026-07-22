import type { ValidationThreshold } from "../../types/acceptanceCriteria";
import type { ExperimentRecordV1 } from "../../types/experimentRecord";
import type { FalsificationReport } from "../../types/falsification";
import type { PredictionRecordV1 } from "../../types/predictionRecord";
import { compareToFalsification } from "../falsification/compare";
import { matchPredictionsToExperiments } from "../falsification/matchRecords";
import { proposeDeltaFromFalsification } from "../falsification/toLearnedDelta";
import { filterLearnableRecords } from "../instruments/qcGate";
import type { BuildLearnedDeltaPackInput } from "../learnedDeltaBuilder";

export interface LearningResult {
  reports: FalsificationReport[];
  proposal: BuildLearnedDeltaPackInput | null;
  /** How many experiment records the QC learn gate dropped before pairing. */
  gatedOut: number;
}

/**
 * Evidence → proposal pipeline. P1-3's learn gate runs UPSTREAM of P0-2 pairing,
 * so `failed-control` / `manual-review-required` / `missing-unit` records never
 * reach falsification or learning. Deterministic; the returned proposal is still
 * human-gate pending (it is not applied here).
 */
export function runLearningFromEvidence(
  predictions: PredictionRecordV1[],
  experiments: ExperimentRecordV1[],
  opts: {
    sourceDbtlRunId: string;
    iteration: number;
    damping?: number;
    resolveCriteria?: (experiment: ExperimentRecordV1) => ValidationThreshold | undefined;
  },
): LearningResult {
  const learnable = filterLearnableRecords(experiments);
  const gatedOut = experiments.length - learnable.length;
  const pairs = matchPredictionsToExperiments(predictions, learnable);
  const reports = pairs.map((pair) => compareToFalsification(pair, opts.resolveCriteria?.(pair.experiment)));
  const proposal = proposeDeltaFromFalsification(reports, {
    sourceDbtlRunId: opts.sourceDbtlRunId,
    iteration: opts.iteration,
    ...(opts.damping !== undefined ? { damping: opts.damping } : {}),
  });
  return { reports, proposal, gatedOut };
}
