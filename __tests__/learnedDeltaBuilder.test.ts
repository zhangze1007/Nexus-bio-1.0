/** @jest-environment node */
import { buildLearnedDeltaPack } from '../src/services/learnedDeltaBuilder';

describe('LearnedDeltaPack builder', () => {
  it('defaults humanGateStatus to pending and creates empty change records', () => {
    const pack = buildLearnedDeltaPack({
      deltaPackId: 'ldp-builder-001',
      iteration: 5,
      sourceDbtlRunId: 'dbtlflow:iteration:5',
      sourceExperimentRecordIds: ['er-builder-001'],
      targetToolIds: ['fbasim'],
      learnedMetrics: { yieldChangePercent: 2.5 },
      createdAt: '2026-04-30T00:00:00.000Z',
    });

    expect(pack.humanGateStatus).toBe('pending');
    expect(pack.changedBounds).toEqual({});
    expect(pack.changedPriors).toEqual({});
    expect(pack.changedWeights).toEqual({});
  });

  it('does not invent experiment or provenance ids', () => {
    const pack = buildLearnedDeltaPack({
      deltaPackId: 'ldp-builder-002',
      iteration: 5,
      sourceDbtlRunId: 'dbtlflow:iteration:5',
      sourceExperimentRecordIds: [],
      targetToolIds: ['fbasim'],
      learnedMetrics: {},
      createdAt: '2026-04-30T00:00:00.000Z',
    });

    expect(pack.sourceExperimentRecordIds).toEqual([]);
    expect(pack.sourceProvenanceIds).toEqual([]);
  });

  it('does not infer numeric deltas from legacy text notes', () => {
    const pack = buildLearnedDeltaPack({
      deltaPackId: 'ldp-builder-003',
      iteration: 5,
      sourceDbtlRunId: 'dbtlflow:iteration:5',
      sourceExperimentRecordIds: ['er-builder-003'],
      targetToolIds: ['fbasim'],
      learnedMetrics: {},
      createdAt: '2026-04-30T00:00:00.000Z',
      notes: 'legacy learnedParameters said drain 99% and oxygen 100',
    });

    expect(pack.changedPriors).toEqual({});
    expect(pack.notes).toContain('legacy learnedParameters');
  });

  it('preserves explicit typed change maps without auto-approval', () => {
    const pack = buildLearnedDeltaPack({
      deltaPackId: 'ldp-builder-004',
      iteration: 5,
      sourceDbtlRunId: 'dbtlflow:iteration:5',
      sourceExperimentRecordIds: ['er-builder-004'],
      sourceProvenanceIds: ['provenance:dbtlflow:builder'],
      targetToolIds: ['dyncon'],
      changedPriors: {
        'dyncon.controller.kp': { before: 1.2, after: 1.4 },
      },
      learnedMetrics: { doRmse: 0.03 },
      classification: 'restorative',
      createdAt: '2026-04-30T00:00:00.000Z',
    });

    expect(pack.changedPriors['dyncon.controller.kp']).toEqual({ before: 1.2, after: 1.4 });
    expect(pack.humanGateStatus).toBe('pending');
  });
});
