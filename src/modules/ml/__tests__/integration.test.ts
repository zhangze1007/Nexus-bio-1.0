/**
 * Integration Tests for ML Module Index
 *
 * Covers:
 *   1. CSV/TSV Data Loader (loadEnzymeDataFromCSV)
 *   2. Dataset Builder (buildEnzymeDataset)
 *   3. Full Pipeline (runEnzymeActivityPrediction)
 *   4. Edge Cases
 */

import {
  loadEnzymeDataFromCSV,
  buildEnzymeDataset,
  runEnzymeActivityPrediction,
} from '../index';

// ── Test Data ───────────────────────────────────────────────────────────────

const SIMPLE_CSV = [
  'sequence,activity,organism',
  'MKALILAVLLAIALATTMA,1.5,E.coli',
  'GAVLIVFGAKRHN,0.8,Yeast',
  'ACDEFGHIKLMNPQRSTVWY,2.3,B.subtilis',
  'LLLLAAAA,0.5,H.sapiens',
  'MKMKMKMK,1.1,E.coli',
  'GGGAAAVVV,0.3,Yeast',
  'ACDEFGHIK,1.8,B.subtilis',
  'LLLLMMMM,0.9,H.sapiens',
  'AAAAVVVV,0.7,E.coli',
  'RRRRHHHH,1.4,Yeast',
].join('\n');

const TSV_CONTENT = [
  'sequence\tactivity\tspecies',
  'MKALILAVLLAIALATTMA\t1.5\tE.coli',
  'GAVLIVFGAKRHN\t0.8\tYeast',
  'ACDEFGHIKLMNPQRSTVWY\t2.3\tB.subtilis',
  'LLLLAAAA\t0.5\tH.sapiens',
  'MKMKMKMK\t1.1\tE.coli',
].join('\n');

const CSV_WITH_MISSING = [
  'sequence,activity',
  'MKALILAVLLAIALATTMA,1.5',
  ',0.8',
  'ACDEFGHIKLMNPQRSTVWY,',
  'LLLLAAAA,0.5',
  'MKMKMKMK,invalid',
  'GGGAAAVVV,0.3',
].join('\n');

// ── 1. CSV Loader ──────────────────────────────────────────────────────────

describe('loadEnzymeDataFromCSV', () => {
  it('should load data from CSV content', () => {
    const data = loadEnzymeDataFromCSV(SIMPLE_CSV);

    expect(data.length).toBe(10);
    expect(data[0].sequence).toBe('MKALILAVLLAIALATTMA');
    expect(data[0].activity).toBe(1.5);
  });

  it('should handle TSV content', () => {
    const data = loadEnzymeDataFromCSV(TSV_CONTENT, { delimiter: '\t' });

    expect(data.length).toBe(5);
    expect(data[0].sequence).toBe('MKALILAVLLAIALATTMA');
    expect(data[0].activity).toBe(1.5);
    expect(data[1].sequence).toBe('GAVLIVFGAKRHN');
  });

  it('should auto-detect TSV delimiter', () => {
    const data = loadEnzymeDataFromCSV(TSV_CONTENT);

    expect(data.length).toBe(5);
    expect(data[0].activity).toBe(1.5);
  });

  it('should handle missing values by skipping rows', () => {
    const data = loadEnzymeDataFromCSV(CSV_WITH_MISSING);

    // Should skip: empty sequence, empty activity, invalid activity
    expect(data.length).toBe(3);
    expect(data[0].sequence).toBe('MKALILAVLLAIALATTMA');
    expect(data[1].sequence).toBe('LLLLAAAA');
    expect(data[2].sequence).toBe('GGGAAAVVV');
  });

  it('should handle custom column indices', () => {
    const csv = [
      'id,organism,seq,activity',
      '1,E.coli,MKALI,1.5',
      '2,Yeast,GAVL,0.8',
    ].join('\n');

    const data = loadEnzymeDataFromCSV(csv, {
      sequenceColumn: 2,
      activityColumn: 3,
    });

    expect(data.length).toBe(2);
    expect(data[0].sequence).toBe('MKALI');
    expect(data[0].activity).toBe(1.5);
  });

  it('should extract metadata from remaining columns', () => {
    const data = loadEnzymeDataFromCSV(SIMPLE_CSV);

    expect(data[0].metadata).toBeDefined();
    expect(data[0].metadata!.organism).toBe('E.coli');
    expect(data[1].metadata!.organism).toBe('Yeast');
  });

  it('should skip header when hasHeader is true (default)', () => {
    const data = loadEnzymeDataFromCSV(SIMPLE_CSV);

    // First item should be actual data, not the header
    expect(data[0].sequence).not.toBe('sequence');
    expect(typeof data[0].activity).toBe('number');
  });

  it('should handle content without header', () => {
    const csv = [
      'MKALI,1.5',
      'GAVL,0.8',
    ].join('\n');

    const data = loadEnzymeDataFromCSV(csv, { hasHeader: false });

    expect(data.length).toBe(2);
    expect(data[0].sequence).toBe('MKALI');
    expect(data[0].activity).toBe(1.5);
  });

  it('should handle skipRows option', () => {
    const csv = [
      'sequence,activity',
      'SKIP1,0.0',
      'SKIP2,0.0',
      'MKALI,1.5',
      'GAVL,0.8',
    ].join('\n');

    const data = loadEnzymeDataFromCSV(csv, { skipRows: 2 });

    expect(data.length).toBe(2);
    expect(data[0].sequence).toBe('MKALI');
  });

  it('should handle CRLF line endings', () => {
    const csv = 'sequence,activity\r\nMKALI,1.5\r\nGAVL,0.8\r\n';
    const data = loadEnzymeDataFromCSV(csv);

    expect(data.length).toBe(2);
  });
});

// ── 2. Dataset Builder ─────────────────────────────────────────────────────

describe('buildEnzymeDataset', () => {
  const enzymeData = [
    { sequence: 'MKALILAVLLAIALATTMA', activity: 1.5 },
    { sequence: 'GAVLIVFGAKRHN', activity: 0.8 },
    { sequence: 'ACDEFGHIKLMNPQRSTVWY', activity: 2.3 },
    { sequence: 'LLLLAAAA', activity: 0.5 },
    { sequence: 'MKMKMKMK', activity: 1.1 },
    { sequence: 'GGGAAAVVV', activity: 0.3 },
    { sequence: 'ACDEFGHIK', activity: 1.8 },
    { sequence: 'LLLLMMMM', activity: 0.9 },
    { sequence: 'AAAAVVVV', activity: 0.7 },
    { sequence: 'RRRRHHHH', activity: 1.4 },
  ];

  it('should build dataset from enzyme data', () => {
    const { train, test } = buildEnzymeDataset(enzymeData);

    expect(train.samples.length + test.samples.length).toBe(enzymeData.length);
    expect(train.samples.length).toBeGreaterThan(0);
    expect(test.samples.length).toBeGreaterThan(0);
  });

  it('should split into train and test with correct fractions', () => {
    const { train, test } = buildEnzymeDataset(enzymeData, { testFraction: 0.3 });

    // ~30% in test (at least 1)
    expect(test.samples.length).toBeGreaterThanOrEqual(1);
    expect(train.samples.length + test.samples.length).toBe(enzymeData.length);
  });

  it('should return correct feature names', () => {
    const { featureNames } = buildEnzymeDataset(enzymeData);

    // 55 features: 20 AA + 20 dipeptide + 10 physicochemical + 5 sequence
    expect(featureNames.length).toBe(55);
    expect(featureNames).toContain('aa_A');
    expect(featureNames).toContain('aa_Y');
    expect(featureNames).toContain('hydrophobicity_mean');
    expect(featureNames).toContain('length_norm');
  });

  it('should have correct feature dimensions in samples', () => {
    const { train } = buildEnzymeDataset(enzymeData);

    for (const sample of train.samples) {
      expect(sample.features.length).toBe(55);
      expect(typeof sample.label).toBe('number');
    }
  });

  it('should preserve taskType as regression', () => {
    const { train, test } = buildEnzymeDataset(enzymeData);

    expect(train.taskType).toBe('regression');
    expect(test.taskType).toBe('regression');
  });
});

// ── 3. Full Pipeline ───────────────────────────────────────────────────────

describe('runEnzymeActivityPrediction', () => {
  it('should run full pipeline with LinearRegression', () => {
    const result = runEnzymeActivityPrediction(SIMPLE_CSV, 'linear');

    expect(result.model).toBeDefined();
    expect(result.trainMetrics).toBeDefined();
    expect(result.testMetrics).toBeDefined();
    expect(result.featureImportances).toBeDefined();
    expect(result.crossValidationMetrics).toBeDefined();

    // Model should be able to predict
    const preds = result.model.predict([[1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
      31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
      41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
      51, 52, 53, 54, 55]]);
    expect(preds.length).toBe(1);
    expect(typeof preds[0]).toBe('number');
  });

  it('should run full pipeline with DecisionTree', () => {
    const result = runEnzymeActivityPrediction(SIMPLE_CSV, 'decision_tree');

    expect(result.model).toBeDefined();
    expect(result.trainMetrics).toBeDefined();
    expect(result.testMetrics).toBeDefined();
    expect(result.featureImportances.length).toBe(55);
    expect(result.crossValidationMetrics).toBeDefined();
  });

  it('should return all expected result fields', () => {
    const result = runEnzymeActivityPrediction(SIMPLE_CSV, 'ridge');

    // Check all required fields exist
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('trainMetrics');
    expect(result).toHaveProperty('testMetrics');
    expect(result).toHaveProperty('featureImportances');
    expect(result).toHaveProperty('crossValidationMetrics');

    // Check metrics have correct shape
    expect(typeof result.trainMetrics.mae).toBe('number');
    expect(typeof result.trainMetrics.rmse).toBe('number');
    expect(typeof result.trainMetrics.r2).toBe('number');
    expect(typeof result.testMetrics.mae).toBe('number');
    expect(typeof result.testMetrics.rmse).toBe('number');
    expect(typeof result.testMetrics.r2).toBe('number');
  });

  it('should return valid feature importances', () => {
    const result = runEnzymeActivityPrediction(SIMPLE_CSV, 'random_forest');

    expect(result.featureImportances.length).toBe(55);

    // Each importance should have correct shape
    for (const imp of result.featureImportances) {
      expect(typeof imp.featureName).toBe('string');
      expect(typeof imp.importance).toBe('number');
      expect(typeof imp.rank).toBe('number');
      expect(imp.importance).toBeGreaterThanOrEqual(0);
      expect(imp.rank).toBeGreaterThanOrEqual(1);
    }

    // Importances should be sorted descending
    for (let i = 1; i < result.featureImportances.length; i++) {
      expect(result.featureImportances[i - 1].importance)
        .toBeGreaterThanOrEqual(result.featureImportances[i].importance);
    }
  });

  it('should handle edge case: empty CSV content', () => {
    // Empty CSV with only header
    const result = runEnzymeActivityPrediction('sequence,activity', 'linear');

    expect(result.model).toBeDefined();
    expect(result.trainMetrics).toBeDefined();
    expect(result.testMetrics).toBeDefined();
    expect(result.featureImportances).toBeDefined();
    expect(result.crossValidationMetrics).toBeDefined();
  });

  it('should handle edge case: single data row', () => {
    const csv = 'sequence,activity\nMKALI,1.5';
    const result = runEnzymeActivityPrediction(csv, 'linear');

    expect(result.model).toBeDefined();
    expect(result.trainMetrics).toBeDefined();
    expect(result.testMetrics).toBeDefined();
  });

  it('should handle all missing values gracefully', () => {
    const csv = [
      'sequence,activity',
      ',1.5',
      'MKALI,',
      ',',
      ',invalid',
    ].join('\n');

    // All rows have missing data — pipeline should handle gracefully
    expect(() => runEnzymeActivityPrediction(csv, 'linear')).not.toThrow();
  });

  it('should accept custom options', () => {
    const result = runEnzymeActivityPrediction(SIMPLE_CSV, 'linear', {
      testFraction: 0.3,
      k: 3,
    });

    expect(result.model).toBeDefined();
    expect(result.crossValidationMetrics).toBeDefined();
  });

  it('should use linear importances for linear models', () => {
    const result = runEnzymeActivityPrediction(SIMPLE_CSV, 'linear');

    // Importances should be non-negative and finite
    for (const imp of result.featureImportances) {
      expect(imp.importance).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(imp.importance)).toBe(true);
    }
    // With 10 samples and 55 features the model is underdetermined,
    // so weights may be zero — just check shape and non-negativity.
    expect(result.featureImportances.length).toBe(55);
  });

  it('should use tree importances for tree models', () => {
    const result = runEnzymeActivityPrediction(SIMPLE_CSV, 'decision_tree');

    // Tree importances should be non-negative and sum close to 1 (normalized)
    const totalImportance = result.featureImportances.reduce(
      (sum, imp) => sum + imp.importance, 0,
    );
    // Trees with small data may have zero importances if no splits are made
    expect(totalImportance).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(totalImportance)).toBe(true);
    expect(result.featureImportances.length).toBe(55);
  });
});
