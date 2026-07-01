/**
 * ProEvol Sequence→Fitness ML Surrogate
 *
 * Wires the `src/modules/ml` toolkit (amino-acid composition / physicochemical
 * features + Linear/Ridge/Lasso/DecisionTree/RandomForest + cross-validation +
 * interpretability) into ProEvol as a real feature: it trains a supervised
 * surrogate that maps a variant's full protein sequence to its measured
 * fitness, so a campaign's screened variants can be used to PREDICT the fitness
 * of unscreened sequences and to surface which sequence features drive activity.
 *
 * This is the go-forward home of the ML module (integrity audit T3-2). The
 * feature is reproducible: the train/test split is seeded and the RandomForest
 * bootstrap/feature-subset sampling is seeded (see models.ts).
 *
 * NOTE: this is a service + API-layer feature. Surfacing it inside the locked
 * ProEvolPage.tsx (FORBIDDEN) requires the project's review protocol.
 *
 * Reference: Ma et al. (2020) Nat Mach Intell 2:236-245 (ML for enzyme fn)
 */

import {
  buildDataset,
  createModel,
  crossValidate,
  computeAllMetrics,
  extractFeatures,
  getFeatureNames,
  getLinearImportances,
  getTreeImportances,
  trainTestSplit,
  type FeatureImportance,
  type MLModel,
  type ModelMetrics,
  type ModelType,
} from "../modules/ml";
import type { ProEvolArtifact, ProEvolMutation, ProEvolVariant } from "../domain/proevolArtifact";

/** Which phenotype field the fitness label was drawn from. */
export type FitnessLabelSource = "measuredActivity" | "compositeScore" | "predictedActivity";

export interface ProEvolMLTrainingData {
  sequence: string;
  activity: number;
  variantId: string;
  labelSource: FitnessLabelSource;
}

export interface ProEvolFitnessModel {
  model: MLModel;
  modelType: ModelType;
  labelSource: FitnessLabelSource;
  nSamples: number;
  nTrain: number;
  nTest: number;
  trainMetrics: ModelMetrics;
  testMetrics: ModelMetrics;
  crossValidationMetrics: ModelMetrics;
  featureImportances: FeatureImportance[];
}

/**
 * Reconstruct a variant's full amino-acid sequence from the wild-type sequence
 * and its list of point mutations. Mutation positions are 1-indexed (standard
 * "F123Y" notation). Out-of-range mutations are skipped defensively.
 */
export function reconstructVariantSequence(startingSequence: string, mutations: ProEvolMutation[]): string {
  const seq = startingSequence.toUpperCase().split("");
  for (const m of mutations) {
    const idx = m.position - 1;
    if (idx >= 0 && idx < seq.length) {
      seq[idx] = m.to.toUpperCase();
    }
  }
  return seq.join("");
}

/** Read a numeric fitness label for a variant from the chosen source. */
function variantLabel(v: ProEvolVariant, source: FitnessLabelSource): number | undefined {
  if (source === "measuredActivity") return v.phenotype.measuredActivity;
  if (source === "compositeScore") return v.compositeScore;
  return v.phenotype.predictedActivity;
}

/**
 * Choose the label source with the most coverage across variants, preferring
 * real measured activity over engine composites over predictions.
 */
function chooseLabelSource(variants: ProEvolVariant[]): FitnessLabelSource {
  const count = (s: FitnessLabelSource) => variants.filter((v) => Number.isFinite(variantLabel(v, s))).length;
  const measured = count("measuredActivity");
  const composite = count("compositeScore");
  const predicted = count("predictedActivity");
  // Prefer measured if it covers at least half the variants; else the best-covered source.
  if (measured >= variants.length / 2 && measured > 0) return "measuredActivity";
  if (composite >= measured && composite >= predicted && composite > 0) return "compositeScore";
  if (measured >= predicted && measured > 0) return "measuredActivity";
  return "predictedActivity";
}

/**
 * Build labeled (sequence → fitness) training data from a ProEvol artifact.
 */
export function buildProEvolFitnessData(
  artifact: ProEvolArtifact,
  labelSource?: FitnessLabelSource,
): ProEvolMLTrainingData[] {
  const source = labelSource ?? chooseLabelSource(artifact.variants);
  const wt = artifact.meta.startingSequence ?? "";
  const data: ProEvolMLTrainingData[] = [];
  for (const v of artifact.variants) {
    const label = variantLabel(v, source);
    if (!Number.isFinite(label)) continue;
    const sequence = reconstructVariantSequence(wt, v.mutations);
    if (sequence.length === 0) continue;
    data.push({ sequence, activity: label as number, variantId: v.id, labelSource: source });
  }
  return data;
}

export interface TrainProEvolOptions {
  modelType?: ModelType;
  testFraction?: number;
  /** CV folds (default 5, auto-reduced if too few samples). */
  k?: number;
  seed?: number;
  labelSource?: FitnessLabelSource;
  /** Minimum labeled variants required to train (default 8). */
  minSamples?: number;
}

/**
 * Train a sequence→fitness surrogate for a ProEvol campaign.
 *
 * Returns null when there are too few labeled variants to train/evaluate
 * honestly (rather than fabricating a model on trivial data).
 */
export function trainProEvolFitnessModel(
  artifact: ProEvolArtifact,
  options: TrainProEvolOptions = {},
): ProEvolFitnessModel | null {
  const modelType = options.modelType ?? "ridge";
  const testFraction = options.testFraction ?? 0.25;
  const seed = options.seed ?? 42;
  const minSamples = options.minSamples ?? 8;

  const data = buildProEvolFitnessData(artifact, options.labelSource);
  if (data.length < minSamples) return null;

  const labelSource = data[0].labelSource;
  const dataset = buildDataset(data);
  const featureNames = getFeatureNames();

  // Seeded split → reproducible train/test partition.
  const { train, test } = trainTestSplit(dataset, testFraction, false, seed);
  if (train.samples.length === 0 || test.samples.length === 0) return null;

  const model = createModel(modelType, { seed });
  const trainX = train.samples.map((s) => s.features);
  const trainY = train.samples.map((s) => s.label);
  model.fit(trainX, trainY);

  const trainMetrics = computeAllMetrics(trainY, model.predict(trainX));
  const testX = test.samples.map((s) => s.features);
  const testY = test.samples.map((s) => s.label);
  const testMetrics = computeAllMetrics(testY, model.predict(testX));

  // Cross-validate on the full dataset (fold count bounded by sample size).
  const k = Math.max(2, Math.min(options.k ?? 5, Math.floor(data.length / 2)));
  const fullX = dataset.samples.map((s) => s.features);
  const fullY = dataset.samples.map((s) => s.label);
  const cvModel = createModel(modelType, { seed });
  const { meanMetrics: crossValidationMetrics } = crossValidate(cvModel, fullX, fullY, k);

  const featureImportances =
    modelType === "decision_tree" || modelType === "random_forest"
      ? getTreeImportances(model, featureNames)
      : getLinearImportances(model, featureNames);

  return {
    model,
    modelType,
    labelSource,
    nSamples: data.length,
    nTrain: train.samples.length,
    nTest: test.samples.length,
    trainMetrics,
    testMetrics,
    crossValidationMetrics,
    featureImportances,
  };
}

/**
 * Predict fitness for arbitrary sequences using a trained surrogate.
 */
export function predictVariantFitness(fit: ProEvolFitnessModel, sequences: string[]): number[] {
  const X = sequences.map((s) => extractFeatures(s));
  return fit.model.predict(X);
}
