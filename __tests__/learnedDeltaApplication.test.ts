/** @jest-environment node */
import {
  canApplyLearnedDeltaPack,
  filterApprovedLearnedDeltaPacks,
} from '../src/services/learnedDeltaApplication';
import type { LearnedDeltaPack } from '../src/types/learnedDelta';

function pack(overrides: Partial<LearnedDeltaPack> = {}): LearnedDeltaPack {
  return {
    schemaVersion: 'learned-delta-pack-v1',
    deltaPackId: 'ldp-application-001',
    iteration: 2,
    sourceDbtlRunId: 'dbtlflow:iteration:2',
    sourceExperimentRecordIds: ['er-sim-application'],
    sourceProvenanceIds: ['provenance:dbtlflow:tool-run:application'],
    targetToolIds: ['fbasim'],
    changedBounds: {},
    changedPriors: {
      'fbasim.oxygenUptake': { before: 8, after: 9, unit: 'mmol/gDW/h' },
    },
    changedWeights: {},
    learnedMetrics: { doRmse: 0.04 },
    classification: 'restorative',
    humanGateStatus: 'approved',
    createdAt: '2026-04-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('LearnedDeltaPack application policy', () => {
  it('allows only approved valid delta packs to apply', () => {
    const decision = canApplyLearnedDeltaPack(pack());
    expect(decision).toEqual({
      canApply: true,
      reason: 'LearnedDeltaPack ldp-application-001 is approved and valid.',
      appliedDeltaPackId: 'ldp-application-001',
    });
  });

  it('blocks pending and rejected delta packs', () => {
    expect(canApplyLearnedDeltaPack(pack({ humanGateStatus: 'pending' })).canApply).toBe(false);
    expect(canApplyLearnedDeltaPack(pack({ humanGateStatus: 'rejected' })).canApply).toBe(false);
  });

  it('blocks invalid delta packs and missing experiment sources', () => {
    expect(canApplyLearnedDeltaPack(pack({ createdAt: 'not-a-date' })).canApply).toBe(false);
    expect(canApplyLearnedDeltaPack(pack({ sourceExperimentRecordIds: [] })).canApply).toBe(false);
  });

  it('filters to only valid approved delta packs', () => {
    const approved = pack({ deltaPackId: 'ldp-approved' });
    const pending = pack({ deltaPackId: 'ldp-pending', humanGateStatus: 'pending' });
    const invalid = pack({ deltaPackId: 'ldp-invalid', sourceDbtlRunId: '' });

    expect(filterApprovedLearnedDeltaPacks([approved, pending, invalid, null]))
      .toEqual([approved]);
  });
});
