/**
 * ML Model Training Service
 *
 * Pure TypeScript linear regression with gradient descent.
 * Persists trained models to the ml_models table via @libsql/client.
 */

import { createHash } from "crypto";
import { sqlAll, sqlGet, sqlRun } from "../../server/libsqlDb";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TrainingDataRow {
  features: Record<string, number>;
  target: number;
}

export interface TrainingData {
  featureNames: string[];
  rows: TrainingDataRow[];
}

export interface TrainingConfig {
  name?: string;
  version?: string;
  learningRate?: number;
  epochs?: number;
  testSplit?: number;
  convergenceThreshold?: number;
}

export interface TrainingMetrics {
  r2: number;
  rmse: number;
  mae: number;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface TrainingResult {
  modelId: string;
  metrics: TrainingMetrics;
  trainingTimeMs: number;
  featureImportance: FeatureImportance[];
}

export interface EvaluationResult {
  modelId: string;
  metrics: TrainingMetrics;
  featureImportance: FeatureImportance[];
}

export interface ModelInfo {
  id: string;
  name: string;
  version: string;
  framework: string;
  filePath: string;
  metrics: TrainingMetrics | null;
  trainingDataHash: string;
  hyperparameters: Record<string, unknown>;
  createdAt: string;
  status: string;
}

// ── Schema ─────────────────────────────────────────────────────────────────

let schemaReady = false;

async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await sqlRun(`
    CREATE TABLE IF NOT EXISTS ml_models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      framework TEXT NOT NULL,
      file_path TEXT NOT NULL,
      metrics_json TEXT,
      training_data_hash TEXT NOT NULL,
      hyperparameters_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL
    )
  `);
  schemaReady = true;
}

// ── Feature Standardization ────────────────────────────────────────────────

interface StandardizeResult {
  standardized: number[][];
  means: number[];
  stds: number[];
}

function standardizeFeatures(features: number[][]): StandardizeResult {
  const n = features.length;
  const d = features[0]?.length ?? 0;
  const means = new Array<number>(d).fill(0);
  const stds = new Array<number>(d).fill(0);

  for (let j = 0; j < d; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += features[i][j];
    means[j] = sum / n;

    let sqDiffSum = 0;
    for (let i = 0; i < n; i++) sqDiffSum += (features[i][j] - means[j]) ** 2;
    stds[j] = Math.sqrt(sqDiffSum / n) || 1;
  }

  const standardized: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < d; j++) row.push((features[i][j] - means[j]) / stds[j]);
    standardized.push(row);
  }

  return { standardized, means, stds };
}

// ── Linear Algebra Helpers ─────────────────────────────────────────────────

function predict(features: number[][], weights: number[], intercept: number): number[] {
  return features.map((row) => {
    let sum = intercept;
    for (let j = 0; j < weights.length; j++) sum += row[j] * weights[j];
    return sum;
  });
}

function meanSquaredError(actual: number[], predicted: number[]): number {
  let sum = 0;
  for (let i = 0; i < actual.length; i++) sum += (actual[i] - predicted[i]) ** 2;
  return sum / actual.length;
}

function rSquared(actual: number[], predicted: number[]): number {
  const mean = actual.reduce((a, b) => a + b, 0) / actual.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < actual.length; i++) {
    ssRes += (actual[i] - predicted[i]) ** 2;
    ssTot += (actual[i] - mean) ** 2;
  }
  return ssTot === 0 ? 1 : 1 - ssRes / ssTot;
}

function computeMetrics(actual: number[], predicted: number[]): TrainingMetrics {
  const mse = meanSquaredError(actual, predicted);
  let mae = 0;
  for (let i = 0; i < actual.length; i++) mae += Math.abs(actual[i] - predicted[i]);
  mae /= actual.length;
  return { r2: rSquared(actual, predicted), rmse: Math.sqrt(mse), mae };
}

function featureImportanceFromWeights(featureNames: string[], weights: number[]): FeatureImportance[] {
  const absWeights = weights.map(Math.abs);
  const total = absWeights.reduce((a, b) => a + b, 0);
  return featureNames.map((name, i) => ({
    feature: name,
    importance: total === 0 ? 1 / featureNames.length : absWeights[i] / total,
  }));
}

// ── Gradient Descent ───────────────────────────────────────────────────────

interface GradientDescentResult {
  weights: number[];
  intercept: number;
  trainingHistory: number[];
}

function gradientDescent(
  features: number[][],
  targets: number[],
  learningRate: number,
  epochs: number,
  convergenceThreshold: number,
): GradientDescentResult {
  const n = features.length;
  const d = features[0]?.length ?? 0;
  const weights = new Array<number>(d).fill(0);
  let intercept = 0;
  const history: number[] = [];

  for (let epoch = 0; epoch < epochs; epoch++) {
    const predictions = predict(features, weights, intercept);
    const loss = meanSquaredError(targets, predictions);
    history.push(loss);

    // Check convergence
    if (epoch > 0 && Math.abs(history[epoch - 1] - loss) < convergenceThreshold) break;

    // Compute gradients
    const weightGradients = new Array<number>(d).fill(0);
    let interceptGradient = 0;

    for (let i = 0; i < n; i++) {
      const error = predictions[i] - targets[i];
      interceptGradient += error;
      for (let j = 0; j < d; j++) {
        weightGradients[j] += error * features[i][j];
      }
    }

    // Update parameters
    intercept -= (learningRate * interceptGradient) / n;
    for (let j = 0; j < d; j++) {
      weights[j] -= (learningRate * weightGradients[j]) / n;
    }
  }

  return { weights, intercept, trainingHistory: history };
}

// ── Data Hashing ───────────────────────────────────────────────────────────

function hashTrainingData(data: TrainingData): string {
  const payload = JSON.stringify({ featureNames: data.featureNames, rows: data.rows });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

// ── Train / Evaluate / List ────────────────────────────────────────────────

/**
 * Train a linear regression model using gradient descent.
 *
 * @throws {Error} if trainingData is empty or has inconsistent dimensions.
 */
export async function trainModel(trainingData: TrainingData, config: TrainingConfig = {}): Promise<TrainingResult> {
  // ── Validate ──
  if (trainingData.rows.length === 0) {
    throw new Error("Training data is empty");
  }
  if (trainingData.featureNames.length === 0) {
    throw new Error("featureNames must not be empty");
  }
  for (const row of trainingData.rows) {
    const keys = Object.keys(row.features);
    if (keys.length !== trainingData.featureNames.length) {
      throw new Error(`Feature count mismatch: expected ${trainingData.featureNames.length}, got ${keys.length}`);
    }
  }

  // ── Config defaults ──
  const lr = config.learningRate ?? 0.01;
  const epochs = config.epochs ?? 1000;
  const testSplit = config.testSplit ?? 0.2;
  const convergenceThreshold = config.convergenceThreshold ?? 1e-8;

  // ── Prepare matrices ──
  const featureNames = trainingData.featureNames;
  const allFeatures = trainingData.rows.map((r) => featureNames.map((f) => r.features[f]));
  const allTargets = trainingData.rows.map((r) => r.target);

  // ── Train/test split ──
  const testCount = Math.max(1, Math.floor(allFeatures.length * testSplit));
  const trainCount = allFeatures.length - testCount;

  const trainFeatures = allFeatures.slice(0, trainCount);
  const trainTargets = allTargets.slice(0, trainCount);
  const testFeatures = allFeatures.slice(trainCount);
  const testTargets = allTargets.slice(trainCount);

  // ── Standardize and train ──
  const startTime = performance.now();
  const { standardized, means, stds } = standardizeFeatures(trainFeatures);
  const { weights, intercept, trainingHistory } = gradientDescent(
    standardized,
    trainTargets,
    lr,
    epochs,
    convergenceThreshold,
  );
  const endTime = performance.now();

  // ── Evaluate on test set ──
  const standardizedTest = testFeatures.map((row) => row.map((val, j) => (val - means[j]) / stds[j]));
  const predictions = predict(standardizedTest, weights, intercept);
  const metrics = computeMetrics(testTargets, predictions);
  const importance = featureImportanceFromWeights(featureNames, weights);

  // ── Persist ──
  const modelId = `lr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; // rng-ok: model artifact id, not a compute path
  const dataHash = hashTrainingData(trainingData);
  const hyperparameters = { learningRate: lr, epochs, testSplit, convergenceThreshold };

  await ensureSchema();
  await sqlRun(
    `INSERT INTO ml_models
      (id, name, version, framework, file_path, metrics_json, training_data_hash, hyperparameters_json, created_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      modelId,
      config.name ?? "linear-regression",
      config.version ?? "1.0.0",
      "typescript-linear-regression",
      `models/${modelId}.json`,
      JSON.stringify({ ...metrics, weights, intercept, means, stds, featureNames, trainingHistory }),
      dataHash,
      JSON.stringify(hyperparameters),
      new Date().toISOString(),
      "trained",
    ],
  );

  // ── Verify ──
  const saved = await sqlGet("SELECT id FROM ml_models WHERE id = ?", [modelId]);
  if (!saved) throw new Error("Failed to persist model");

  return { modelId, metrics, trainingTimeMs: endTime - startTime, featureImportance: importance };
}

/**
 * Evaluate a previously trained model against new test data.
 *
 * @throws {Error} if modelId is not found or feature dimensions do not match.
 */
export async function evaluateModel(modelId: string, testData: TrainingData): Promise<EvaluationResult> {
  await ensureSchema();

  const row = await sqlGet("SELECT * FROM ml_models WHERE id = ?", [modelId]);
  if (!row) throw new Error(`Model not found: ${modelId}`);

  const storedMetrics = JSON.parse(row.metrics_json as string);
  const featureNames = storedMetrics.featureNames as string[];
  const weights = storedMetrics.weights as number[];
  const intercept = storedMetrics.intercept as number;
  const means = storedMetrics.means as number[];
  const stds = storedMetrics.stds as number[];

  if (testData.featureNames.length !== featureNames.length) {
    throw new Error(
      `Feature count mismatch: model expects ${featureNames.length}, got ${testData.featureNames.length}`,
    );
  }

  // ── Build feature matrix and standardize ──
  const features = testData.rows.map((r) => featureNames.map((f) => r.features[f]));
  const targets = testData.rows.map((r) => r.target);
  const standardized = features.map((row) => row.map((val, j) => (val - means[j]) / stds[j]));

  const predictions = predict(standardized, weights, intercept);
  const metrics = computeMetrics(targets, predictions);
  const importance = featureImportanceFromWeights(featureNames, weights);

  return { modelId, metrics, featureImportance: importance };
}

/**
 * List all trained models from the database.
 */
export async function listModels(): Promise<ModelInfo[]> {
  await ensureSchema();

  const rows = await sqlAll("SELECT * FROM ml_models ORDER BY created_at DESC");

  return rows.map((row) => {
    const metricsRaw = row.metrics_json as string | null;
    const m = metricsRaw ? JSON.parse(metricsRaw) : null;
    return {
      id: row.id as string,
      name: row.name as string,
      version: row.version as string,
      framework: row.framework as string,
      filePath: row.file_path as string,
      metrics: m ? { r2: m.r2, rmse: m.rmse, mae: m.mae } : null,
      trainingDataHash: row.training_data_hash as string,
      hyperparameters: JSON.parse(row.hyperparameters_json as string) as Record<string, unknown>,
      createdAt: row.created_at as string,
      status: row.status as string,
    };
  });
}
