/** @jest-environment node */
import {
  isLearnedDeltaPack,
  validateLearnedDeltaPack,
} from '../src/validation/learnedDeltaValidator';
import type { LearnedDeltaPack } from '../src/types/learnedDelta';

function validPack(overrides: Partial<LearnedDeltaPack> = {}): LearnedDeltaPack {
  return {
    schemaVersion: 'learned-delta-pack-v1',
    deltaPackId: 'ldp-test-001',
    iteration: 4,
    sourceDbtlRunId: 'dbtlflow:iteration:4',
    sourceExperimentRecordIds: ['er-sim-001'],
    sourceProvenanceIds: ['provenance:dbtlflow:tool-run:test'],
    targetToolIds: ['fbasim'],
    changedBounds: {},
    changedPriors: {
      'fbasim.glucoseUptake': {
        before: 9,
        after: 10,
        unit: 'mmol/gDW/h',
        rationale: 'Typed test value for validator coverage.',
      },
    },
    changedWeights: {},
    learnedMetrics: { yieldChangePercent: 4.2 },
    classification: 'conservative',
    humanGateStatus: 'approved',
    createdAt: '2026-04-30T00:00:00.000Z',
    ...overrides,
  };
}

function issueCodes(value: unknown): string[] {
  return validateLearnedDeltaPack(value).issues.map((issue) => issue.code);
}

describe('LearnedDeltaPack validator', () => {
  it('accepts valid pending, approved, and rejected delta packs as typed records', () => {
    expect(validateLearnedDeltaPack(validPack({ humanGateStatus: 'pending' })).ok).toBe(true);
    expect(validateLearnedDeltaPack(validPack({ humanGateStatus: 'approved' })).ok).toBe(true);
    expect(validateLearnedDeltaPack(validPack({ humanGateStatus: 'rejected' })).ok).toBe(true);
    expect(isLearnedDeltaPack(validPack({ humanGateStatus: 'pending' }))).toBe(true);
  });

  it('rejects missing DBTL source', () => {
    const result = validateLearnedDeltaPack(validPack({ sourceDbtlRunId: '' }));
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'sourceDbtlRunId', code: 'MISSING_DBTL_SOURCE', severity: 'error' }),
    ]));
  });

  it('rejects empty experiment sources and target tool ids', () => {
    const result = validateLearnedDeltaPack(validPack({
      sourceExperimentRecordIds: [],
      targetToolIds: [],
    }));
    expect(result.ok).toBe(false);
    expect(issueCodes(validPack({ sourceExperimentRecordIds: [] }))).toContain('MISSING_EXPERIMENT_SOURCE');
    expect(issueCodes(validPack({ targetToolIds: [] }))).toContain('EMPTY_TARGET_TOOLS');
  });

  it('rejects invalid dates and invalid enum values', () => {
    const result = validateLearnedDeltaPack({
      ...validPack(),
      createdAt: 'not-a-date',
      classification: 'unbounded',
      humanGateStatus: 'not-required',
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'createdAt', code: 'INVALID_DATE' }),
      expect.objectContaining({ field: 'classification', code: 'MISSING_REQUIRED_FIELD' }),
      expect.objectContaining({ field: 'humanGateStatus', code: 'MISSING_REQUIRED_FIELD' }),
    ]));
  });

  it('rejects non-finite numeric deltas', () => {
    const result = validateLearnedDeltaPack(validPack({
      changedPriors: {
        'fbasim.glucoseUptake': {
          before: 9,
          after: Number.NaN,
        },
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'changedPriors.fbasim.glucoseUptake.after', code: 'INVALID_DELTA_VALUE' }),
    ]));
  });

  it('rejects bound deltas where lower is above upper', () => {
    const result = validateLearnedDeltaPack(validPack({
      changedBounds: {
        'fbasim.glucoseUptake': {
          before: [4, 20],
          after: [12, 8],
        },
      },
    }));

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'changedBounds.fbasim.glucoseUptake.after', code: 'INVALID_DELTA_VALUE' }),
    ]));
  });

  it('warns when provenance is absent and when review is not approved', () => {
    const result = validateLearnedDeltaPack(validPack({
      sourceProvenanceIds: [],
      humanGateStatus: 'pending',
    }));

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'sourceProvenanceIds', code: 'EMPTY_SOURCE', severity: 'warning' }),
      expect.objectContaining({ field: 'humanGateStatus', code: 'UNAPPROVED_DELTA', severity: 'warning' }),
    ]));
  });
});
