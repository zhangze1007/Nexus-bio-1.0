/**
 * ML Metabolic Engineering — Module Index
 *
 * Public API barrel file for enzyme activity prediction, metabolic flux
 * estimation, and model interpretability.
 *
 * Also provides BRENDA-compatible data loading (CSV/TSV), dataset building,
 * and end-to-end pipeline orchestration.
 *
 * Sub-modules:
 *   types.ts            — core data types (Dataset, TrainingSample, ModelMetrics, etc.)
 *   features.ts         — amino acid composition, dipeptide frequency, physicochemical features
 *   models.ts           — Linear, Ridge, Lasso, DecisionTree, RandomForest
 *   training.ts         — train/test split, cross-validation, grid search, model selection
 *   evaluation.ts       — regression/classification metrics, residual analysis, confusion matrix
 *   interpretability.ts — feature importance (linear coefficients, tree impurity, permutation)
 *
 * Reference: Ma et al. (2020) Nat Mach Intell 2:236-245
 * Reference: Schomburg et al. (2013) Nucleic Acids Res 41:D764 (BRENDA)
 */

// ── Re-exports ───────────────────────────────────────────────────────────────

export * from "./evaluation";
// features.ts: export everything except trainTestSplit (training.ts has the
// canonical version with stratify/seed support).
export { buildDataset, extractFeatures, getFeatureNames } from "./features";
export * from "./interpretability";
export * from "./models";
export * from "./training";
export * from "./types";

// ── Imports for pipeline functions ───────────────────────────────────────────

import { buildDataset, extractFeatures, getFeatureNames } from "./features";
import { getLinearImportances, getTreeImportances } from "./interpretability";
import type { MLModel } from "./models";
import { createModel } from "./models";
import { computeAllMetrics, crossValidate, trainTestSplit } from "./training";
import type { Dataset, FeatureImportance, ModelMetrics, ModelType } from "./types";

// ── CSV/TSV Data Loader ─────────────────────────────────────────────────────

/**
 * Parse BRENDA-format enzyme data from CSV or TSV content.
 *
 * Each row represents one enzyme entry. The function extracts a protein
 * sequence and a numeric activity value from configurable columns.
 * Rows with missing or unparseable values are skipped by default.
 *
 * @param csvContent - Raw CSV or TSV text content
 * @param options - Parsing options
 * @param options.delimiter - Column separator: ',' (default) or '\t'
 * @param options.hasHeader - Whether the first row is a header (default: true)
 * @param options.sequenceColumn - 0-based index of the sequence column (default: 0)
 * @param options.activityColumn - 0-based index of the activity column (default: 1)
 * @param options.skipRows - Number of data rows to skip after the header (default: 0)
 * @returns Array of { sequence, activity, metadata } objects
 *
 * @example
 * const csv = 'sequence,activity,organism\\nMKALI,1.5,E.coli\\nGAVL,0.8,Yeast';
 * const data = loadEnzymeDataFromCSV(csv);
 * // [{ sequence: 'MKALI', activity: 1.5, metadata: { organism: 'E.coli' } }, ...]
 */
export function loadEnzymeDataFromCSV(
  csvContent: string,
  options?: {
    delimiter?: "," | "\t";
    hasHeader?: boolean;
    sequenceColumn?: number;
    activityColumn?: number;
    skipRows?: number;
  },
): Array<{ sequence: string; activity: number; metadata?: Record<string, unknown> }> {
  const delimiter = options?.delimiter ?? ",";
  const hasHeader = options?.hasHeader ?? true;
  const seqCol = options?.sequenceColumn ?? 0;
  const actCol = options?.activityColumn ?? 1;
  const skipRows = options?.skipRows ?? 0;

  // Split into lines, trim, remove empty
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  // Detect delimiter from first line if not explicitly set
  let effectiveDelimiter = delimiter;
  if (options?.delimiter === undefined) {
    const firstLine = lines[0];
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    if (tabCount > commaCount) effectiveDelimiter = "\t";
  }

  let startIndex = 0;
  let headerFields: string[] = [];

  if (hasHeader) {
    headerFields = parseLine(lines[0], effectiveDelimiter);
    startIndex = 1;
  }

  startIndex += skipRows;

  const result: Array<{ sequence: string; activity: number; metadata?: Record<string, unknown> }> = [];

  for (let i = startIndex; i < lines.length; i++) {
    const fields = parseLine(lines[i], effectiveDelimiter);

    // Skip rows that don't have enough columns
    if (fields.length <= Math.max(seqCol, actCol)) continue;

    const sequence = fields[seqCol]?.trim() ?? "";
    const activityStr = fields[actCol]?.trim() ?? "";

    // Skip rows with missing sequence or activity
    if (!sequence || !activityStr) continue;

    const activity = parseFloat(activityStr);
    if (!isFinite(activity)) continue;

    // Build metadata from remaining columns
    const metadata: Record<string, unknown> = {};
    if (hasHeader) {
      for (let j = 0; j < fields.length; j++) {
        if (j === seqCol || j === actCol) continue;
        const key = headerFields[j] ?? `col_${j}`;
        const val = fields[j]?.trim();
        if (val !== undefined && val !== "") {
          metadata[key] = isNaN(Number(val)) ? val : Number(val);
        }
      }
    }

    result.push({
      sequence,
      activity,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });
  }

  return result;
}

/**
 * Parse a single CSV/TSV line, handling quoted fields.
 */
function parseLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);

  return fields;
}

// ── Dataset Builder ─────────────────────────────────────────────────────────

/**
 * Build a train/test dataset from enzyme data objects.
 *
 * Extracts features using `extractFeatures` (55 features per sequence),
 * builds a Dataset, and splits into train/test sets.
 *
 * @param data - Array of { sequence, activity, metadata } objects
 * @param options - Split options
 * @param options.testFraction - Fraction for test set (default: 0.2)
 * @param options.stratify - Whether to stratify the split (default: false)
 * @returns Object with train Dataset, test Dataset, and feature names
 *
 * @example
 * const data = loadEnzymeDataFromCSV(csvContent);
 * const { train, test, featureNames } = buildEnzymeDataset(data);
 */
export function buildEnzymeDataset(
  data: Array<{ sequence: string; activity: number; metadata?: Record<string, unknown> }>,
  options?: {
    testFraction?: number;
    stratify?: boolean;
  },
): { train: Dataset; test: Dataset; featureNames: string[] } {
  const testFraction = options?.testFraction ?? 0.2;
  const stratify = options?.stratify ?? false;

  const dataset = buildDataset(data);
  const featureNames = getFeatureNames();

  const { train, test } = trainTestSplit(dataset, testFraction, stratify);

  return { train, test, featureNames };
}

// ── Full Pipeline ───────────────────────────────────────────────────────────

/**
 * Run an end-to-end enzyme activity prediction pipeline.
 *
 * Steps:
 *   1. Load data from CSV/TSV content
 *   2. Build train/test dataset
 *   3. Train the specified model
 *   4. Evaluate on train and test sets
 *   5. Compute feature importances
 *   6. Cross-validate
 *
 * @param csvContent - Raw CSV or TSV content
 * @param modelType - Model type to train ('linear', 'ridge', 'lasso', 'decision_tree', 'random_forest')
 * @param options - Pipeline options
 * @param options.delimiter - CSV delimiter (default: ',')
 * @param options.testFraction - Test set fraction (default: 0.2)
 * @param options.k - Number of CV folds (default: 5)
 * @returns Object with trained model, metrics, feature importances, and CV results
 *
 * @example
 * const result = runEnzymeActivityPrediction(csvContent, 'random_forest', { k: 10 });
 * console.log(result.testMetrics.r2);
 */
export function runEnzymeActivityPrediction(
  csvContent: string,
  modelType: ModelType,
  options?: {
    delimiter?: "," | "\t";
    testFraction?: number;
    k?: number;
  },
): {
  model: MLModel;
  trainMetrics: ModelMetrics;
  testMetrics: ModelMetrics;
  featureImportances: FeatureImportance[];
  crossValidationMetrics: ModelMetrics;
} {
  const testFraction = options?.testFraction ?? 0.2;
  const k = options?.k ?? 5;

  // 1. Load data
  const rawData = loadEnzymeDataFromCSV(csvContent, {
    delimiter: options?.delimiter,
  });

  // 2. Build dataset
  const { train, test, featureNames } = buildEnzymeDataset(rawData, {
    testFraction,
  });

  // 3. Train model
  const model = createModel(modelType);
  const trainX = train.samples.map((s) => s.features);
  const trainY = train.samples.map((s) => s.label);
  model.fit(trainX, trainY);

  // 4. Evaluate on train and test
  const trainPreds = model.predict(trainX);
  const trainMetrics = computeAllMetrics(trainY, trainPreds);

  const testX = test.samples.map((s) => s.features);
  const testY = test.samples.map((s) => s.label);
  const testPreds = model.predict(testX);
  const testMetrics = computeAllMetrics(testY, testPreds);

  // 5. Feature importances
  let featureImportances: FeatureImportance[];
  if (modelType === "decision_tree" || modelType === "random_forest") {
    featureImportances = getTreeImportances(model, featureNames);
  } else {
    featureImportances = getLinearImportances(model, featureNames);
  }

  // 6. Cross-validate on full dataset
  const fullDataset = buildDataset(rawData);
  const fullX = fullDataset.samples.map((s) => s.features);
  const fullY = fullDataset.samples.map((s) => s.label);
  const cvModel = createModel(modelType);
  const { meanMetrics: crossValidationMetrics } = crossValidate(cvModel, fullX, fullY, k);

  return {
    model,
    trainMetrics,
    testMetrics,
    featureImportances,
    crossValidationMetrics,
  };
}
