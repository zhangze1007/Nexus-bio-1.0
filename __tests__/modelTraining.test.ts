/**
 * Tests for modelTraining.ts — Pure TypeScript linear regression training,
 * evaluation, and model listing via libsql persistence.
 */

import {
  trainModel,
  evaluateModel,
  listModels,
  type TrainingData,
  type TrainingConfig,
} from "../src/services/ml/modelTraining";
import { sqlRun, sqlAll, closeLibsqlClient } from "../src/server/libsqlDb";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Generate y = 2*x1 + 3*x2 + 1 + noise */
function makeLinearData(n: number, noise = 0): TrainingData {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const x1 = Math.random() * 10;
    const x2 = Math.random() * 10;
    const y = 2 * x1 + 3 * x2 + 1 + (Math.random() - 0.5) * noise;
    rows.push({ features: { x1, x2 }, target: y });
  }
  return { featureNames: ["x1", "x2"], rows };
}

/** Perfect linear data: y = 5*x + 2 (no noise, single feature) */
function makePerfectData(n: number): TrainingData {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const x = i;
    rows.push({ features: { x }, target: 5 * x + 2 });
  }
  return { featureNames: ["x"], rows };
}

const TEST_MODEL_PREFIX = `test-${Date.now()}`;

async function cleanup(): Promise<void> {
  await sqlRun("DELETE FROM ml_models WHERE id LIKE ?", [`${TEST_MODEL_PREFIX}%`]).catch(
    () => {},
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("modelTraining", () => {
  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    closeLibsqlClient();
  });

  // ── trainModel ─────────────────────────────────────────────────────────

  test("trainModel returns correct result structure", async () => {
    const data = makeLinearData(50);
    const result = await trainModel(data, {
      name: `${TEST_MODEL_PREFIX}-struct`,
      epochs: 200,
    });

    expect(result).toHaveProperty("modelId");
    expect(result).toHaveProperty("metrics");
    expect(result).toHaveProperty("trainingTimeMs");
    expect(result).toHaveProperty("featureImportance");

    expect(typeof result.modelId).toBe("string");
    expect(result.modelId.length).toBeGreaterThan(0);
    expect(result.trainingTimeMs).toBeGreaterThanOrEqual(0);

    expect(result.metrics).toHaveProperty("r2");
    expect(result.metrics).toHaveProperty("rmse");
    expect(result.metrics).toHaveProperty("mae");
    expect(typeof result.metrics.r2).toBe("number");
    expect(typeof result.metrics.rmse).toBe("number");
    expect(typeof result.metrics.mae).toBe("number");

    expect(Array.isArray(result.featureImportance)).toBe(true);
    expect(result.featureImportance).toHaveLength(2);
    expect(result.featureImportance[0]).toHaveProperty("feature");
    expect(result.featureImportance[0]).toHaveProperty("importance");
  });

  test("trainModel with perfect linear data achieves high R²", async () => {
    const data = makePerfectData(100);
    const result = await trainModel(data, {
      name: `${TEST_MODEL_PREFIX}-perfect`,
      epochs: 1000,
      learningRate: 0.01,
    });

    expect(result.metrics.r2).toBeGreaterThan(0.95);
    expect(result.metrics.rmse).toBeLessThan(5);
  });

  test("trainModel feature importance sums to approximately 1", async () => {
    const data = makeLinearData(60);
    const result = await trainModel(data, {
      name: `${TEST_MODEL_PREFIX}-importance`,
      epochs: 200,
    });

    const total = result.featureImportance.reduce((s, fi) => s + fi.importance, 0);
    expect(total).toBeCloseTo(1, 5);
    for (const fi of result.featureImportance) {
      expect(fi.importance).toBeGreaterThanOrEqual(0);
      expect(fi.importance).toBeLessThanOrEqual(1);
    }
  });

  test("trainModel persists model to database", async () => {
    const data = makeLinearData(40);
    const result = await trainModel(data, {
      name: `${TEST_MODEL_PREFIX}-persist`,
      epochs: 100,
    });

    const row = await sqlAll("SELECT * FROM ml_models WHERE id = ?", [result.modelId]);
    expect(row).toHaveLength(1);
    expect(row[0].name).toBe(`${TEST_MODEL_PREFIX}-persist`);
    expect(row[0].framework).toBe("typescript-linear-regression");
    expect(row[0].status).toBe("trained");
    expect(typeof row[0].metrics_json).toBe("string");
    expect(typeof row[0].hyperparameters_json).toBe("string");
    expect(typeof row[0].training_data_hash).toBe("string");
    expect(typeof row[0].created_at).toBe("string");
  });

  test("trainModel throws on empty training data", async () => {
    const data: TrainingData = { featureNames: ["x"], rows: [] };
    await expect(trainModel(data)).rejects.toThrow("Training data is empty");
  });

  test("trainModel throws on empty featureNames", async () => {
    const data: TrainingData = {
      featureNames: [],
      rows: [{ features: { x: 1 }, target: 2 }],
    };
    await expect(trainModel(data)).rejects.toThrow("featureNames must not be empty");
  });

  test("trainModel throws on feature count mismatch", async () => {
    const data: TrainingData = {
      featureNames: ["x", "y"],
      rows: [{ features: { x: 1 }, target: 2 }], // only 1 feature, expected 2
    };
    await expect(trainModel(data)).rejects.toThrow("Feature count mismatch");
  });

  test("trainModel with custom config parameters", async () => {
    const data = makeLinearData(50);
    const config: TrainingConfig = {
      name: `${TEST_MODEL_PREFIX}-custom`,
      version: "2.0.0",
      learningRate: 0.005,
      epochs: 500,
      testSplit: 0.3,
      convergenceThreshold: 1e-10,
    };
    const result = await trainModel(data, config);

    expect(result.modelId).toBeTruthy();
    expect(result.metrics.r2).toBeDefined();
    expect(result.trainingTimeMs).toBeGreaterThanOrEqual(0);

    // Verify stored hyperparameters
    const row = await sqlAll("SELECT hyperparameters_json FROM ml_models WHERE id = ?", [
      result.modelId,
    ]);
    const hp = JSON.parse(row[0].hyperparameters_json as string);
    expect(hp.learningRate).toBe(0.005);
    expect(hp.epochs).toBe(500);
    expect(hp.testSplit).toBe(0.3);
    expect(hp.convergenceThreshold).toBe(1e-10);
  });

  // ── evaluateModel ──────────────────────────────────────────────────────

  test("evaluateModel evaluates a trained model on new data", async () => {
    const trainData = makePerfectData(80);
    const trainResult = await trainModel(trainData, {
      name: `${TEST_MODEL_PREFIX}-eval`,
      epochs: 500,
    });

    // New test data from the same distribution
    const testRows = [];
    for (let i = 100; i < 110; i++) {
      testRows.push({ features: { x: i }, target: 5 * i + 2 });
    }
    const testData: TrainingData = { featureNames: ["x"], rows: testRows };

    const evalResult = await evaluateModel(trainResult.modelId, testData);

    expect(evalResult.modelId).toBe(trainResult.modelId);
    expect(evalResult.metrics.r2).toBeGreaterThan(0.9);
    expect(evalResult.metrics.rmse).toBeLessThan(10);
    expect(evalResult.metrics.mae).toBeLessThan(10);
    expect(evalResult.featureImportance).toHaveLength(1);
    expect(evalResult.featureImportance[0].feature).toBe("x");
  });

  test("evaluateModel throws for nonexistent model", async () => {
    const testData = makeLinearData(10);
    await expect(evaluateModel("nonexistent-id", testData)).rejects.toThrow(
      "Model not found: nonexistent-id",
    );
  });

  test("evaluateModel throws for feature count mismatch", async () => {
    const trainData = makeLinearData(50);
    const trainResult = await trainModel(trainData, {
      name: `${TEST_MODEL_PREFIX}-mismatch`,
      epochs: 100,
    });

    // Test data has 3 features but model was trained on 2
    const testData: TrainingData = {
      featureNames: ["a", "b", "c"],
      rows: [{ features: { a: 1, b: 2, c: 3 }, target: 6 }],
    };

    await expect(evaluateModel(trainResult.modelId, testData)).rejects.toThrow(
      "Feature count mismatch",
    );
  });

  // ── listModels ─────────────────────────────────────────────────────────

  test("listModels returns trained models", async () => {
    const data = makeLinearData(30);
    const result = await trainModel(data, {
      name: `${TEST_MODEL_PREFIX}-list`,
      epochs: 50,
    });

    const models = await listModels();
    expect(models.length).toBeGreaterThanOrEqual(1);

    const found = models.find((m) => m.id === result.modelId);
    expect(found).toBeDefined();
    expect(found!.name).toBe(`${TEST_MODEL_PREFIX}-list`);
    expect(found!.framework).toBe("typescript-linear-regression");
    expect(found!.status).toBe("trained");
    expect(found!.metrics).not.toBeNull();
    expect(found!.metrics!.r2).toBeDefined();
    expect(found!.metrics!.rmse).toBeDefined();
    expect(found!.metrics!.mae).toBeDefined();
    expect(found!.trainingDataHash).toBeTruthy();
    expect(found!.hyperparameters).toBeDefined();
    expect(found!.createdAt).toBeTruthy();
    expect(found!.version).toBe("1.0.0");
  });

  test("listModels returns empty array when no models exist after cleanup", async () => {
    // Clean all test models, then list
    await cleanup();
    const models = await listModels();
    // There may be non-test models, but our test models should be gone
    const testModels = models.filter((m) => m.id.startsWith(TEST_MODEL_PREFIX));
    expect(testModels).toHaveLength(0);
  });

  test("trainingDataHash is deterministic for same input", async () => {
    const data = makePerfectData(20);
    // Use fixed data so hash is deterministic
    const fixed: TrainingData = {
      featureNames: ["x"],
      rows: [
        { features: { x: 1 }, target: 7 },
        { features: { x: 2 }, target: 12 },
        { features: { x: 3 }, target: 17 },
      ],
    };

    const r1 = await trainModel(fixed, { name: `${TEST_MODEL_PREFIX}-hash1`, epochs: 50 });
    const r2 = await trainModel(fixed, { name: `${TEST_MODEL_PREFIX}-hash2`, epochs: 50 });

    // Both should have the same training data hash
    const m1 = await sqlAll("SELECT training_data_hash FROM ml_models WHERE id = ?", [
      r1.modelId,
    ]);
    const m2 = await sqlAll("SELECT training_data_hash FROM ml_models WHERE id = ?", [
      r2.modelId,
    ]);
    expect(m1[0].training_data_hash).toBe(m2[0].training_data_hash);
  });
});
