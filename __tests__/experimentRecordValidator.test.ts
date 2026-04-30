/** @jest-environment node */
import {
  isExperimentRecordV1,
  validateExperimentRecordV1,
} from '../src/validation/experimentRecordValidator';
import type { ExperimentRecordV1 } from '../src/types/experimentRecord';

function validRecord(overrides: Partial<ExperimentRecordV1> = {}): ExperimentRecordV1 {
  return {
    schemaVersion: 'experiment-record-v1',
    recordId: 'er-test-001',
    batchId: 'batch-a',
    sampleId: 'sample-a1',
    constructId: 'construct-a',
    assayType: 'product-titer',
    sourceType: 'imported-csv',
    measurementUnit: 'mg/L',
    instrument: 'instrument-example',
    operator: 'operator-example',
    startedAt: '2026-04-01T10:00:00.000Z',
    completedAt: '2026-04-01T12:00:00.000Z',
    timepoints: [{ timeHours: 2, value: 42, unit: 'mg/L', replicateId: 'rep-a' }],
    qcFlags: ['passed'],
    ...overrides,
  };
}

function issueCodes(record: unknown): string[] {
  return validateExperimentRecordV1(record).issues.map((issue) => issue.code);
}

describe('ExperimentRecordV1 validator', () => {
  it('accepts valid wet-lab-like and simulated assay records', () => {
    expect(validateExperimentRecordV1(validRecord({ sourceType: 'wet-lab' })).ok).toBe(true);
    expect(validateExperimentRecordV1(validRecord({ sourceType: 'simulated-assay' })).ok).toBe(true);
    expect(isExperimentRecordV1(validRecord())).toBe(true);
  });

  it('rejects missing measurementUnit and unit-less timepoints', () => {
    const result = validateExperimentRecordV1(validRecord({
      measurementUnit: '',
      timepoints: [{ timeHours: 1, value: 10, unit: '' }],
    }));

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'measurementUnit', code: 'EMPTY_STRING', severity: 'error' }),
      expect.objectContaining({ field: 'timepoints[0].unit', code: 'MISSING_UNIT', severity: 'error' }),
    ]));
  });

  it('rejects records with no timepoints', () => {
    expect(issueCodes(validRecord({ timepoints: [] }))).toContain('NO_TIMEPOINTS');
    expect(validateExperimentRecordV1(validRecord({ timepoints: [] })).ok).toBe(false);
  });

  it('rejects missing batch, sample, and construct context', () => {
    const result = validateExperimentRecordV1(validRecord({
      batchId: '',
      sampleId: '',
      constructId: '',
    }));

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'batchId', code: 'EMPTY_STRING' }),
      expect.objectContaining({ field: 'sampleId', code: 'EMPTY_STRING' }),
      expect.objectContaining({ field: 'constructId', code: 'EMPTY_STRING' }),
    ]));
  });

  it('rejects invalid dates and non-numeric timepoint values', () => {
    const result = validateExperimentRecordV1(validRecord({
      startedAt: 'not-a-date',
      timepoints: [{ timeHours: Number.NaN, value: Number.POSITIVE_INFINITY, unit: 'mg/L' }],
    }));

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'startedAt', code: 'INVALID_DATE' }),
      expect.objectContaining({ field: 'timepoints[0].timeHours', code: 'INVALID_TIMEPOINT' }),
      expect.objectContaining({ field: 'timepoints[0].value', code: 'INVALID_TIMEPOINT' }),
    ]));
  });

  it('rejects negative timepoints and unit mismatches', () => {
    const result = validateExperimentRecordV1(validRecord({
      timepoints: [{ timeHours: -1, value: 3, unit: 'RFU' }],
    }));

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'timepoints[0].timeHours', code: 'INVALID_TIMEPOINT' }),
      expect.objectContaining({ field: 'timepoints[0].unit', code: 'UNIT_MISMATCH' }),
    ]));
  });

  it('warns for completedAt before startedAt and manual-review QC without making the record invalid', () => {
    const result = validateExperimentRecordV1(validRecord({
      completedAt: '2026-04-01T09:00:00.000Z',
      qcFlags: ['manual-review-required'],
      timepoints: [{ timeHours: 1, value: 10, unit: 'mg/L', qcFlags: ['manual-review-required'] }],
    }));

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'completedAt', code: 'INVALID_DATE', severity: 'warning' }),
      expect.objectContaining({ field: 'qcFlags', code: 'QC_REVIEW_REQUIRED', severity: 'warning' }),
      expect.objectContaining({ field: 'timepoints[0].qcFlags', code: 'QC_REVIEW_REQUIRED', severity: 'warning' }),
    ]));
  });
});
