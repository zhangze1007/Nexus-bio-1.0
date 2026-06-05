import { buildFBASeed, buildDynConSeed } from '../src/components/tools/shared/workbenchDataflow';
import type { DBTLWorkbenchPayload, WorkbenchToolPayloadMap } from '../src/store/workbenchPayloads';
import type { LearnedDeltaPack } from '../src/types/learnedDelta';

function makeDbtlPayload(
  resultOverrides: Partial<DBTLWorkbenchPayload['result']> = {},
): DBTLWorkbenchPayload {
  return {
    validity: 'partial',
    toolId: 'dbtlflow',
    targetProduct: 'artemisinin',
    proposedPhase: 'Learn',
    draftHypothesis: 'Retune route',
    measuredResult: 12,
    unit: 'mg/L',
    passed: false,
    feedbackSource: 'committed',
    feedbackIterationId: 1,
    result: {
      bestIteration: 1,
      improvementRate: 0.1,
      passRate: 60,
      latestPhase: 'Learn',
      ...resultOverrides,
    },
    updatedAt: Date.UTC(2026, 3, 29),
  };
}

function makeDeltaPack(overrides: Partial<LearnedDeltaPack> = {}): LearnedDeltaPack {
  return {
    schemaVersion: 'learned-delta-pack-v1',
    deltaPackId: 'ldp-workbench-001',
    iteration: 1,
    sourceDbtlRunId: 'dbtlflow:iteration:1',
    sourceExperimentRecordIds: ['er-workbench-001'],
    sourceProvenanceIds: ['provenance:dbtlflow:workbench'],
    targetToolIds: ['fbasim'],
    changedBounds: {},
    changedPriors: {
      'fbasim.glucoseUptake': { before: 9, after: 14, unit: 'mmol/gDW/h' },
    },
    changedWeights: {},
    learnedMetrics: { drainPercent: 45 },
    classification: 'conservative',
    humanGateStatus: 'approved',
    createdAt: '2026-04-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('workbench dataflow DBTL feedback', () => {
  it('keeps typed DBTL feedback as audit data without applying it as a delta', () => {
    const dbtl = makeDbtlPayload({
      feedback: {
        learnedMetrics: { drainPercent: 45 },
        sources: [
          {
            derivedFromToolId: 'catdes',
            derivedAt: '2026-04-29T00:00:00.000Z',
          },
        ],
        schemaVersion: 'dbtl-feedback-v1',
      },
      learnedParameters: ['drain 5%'],
    });

    expect(buildFBASeed(null, null, dbtl).objective).toBe('biomass');
  });

  it('does not regex-parse legacy learnedParameters while reseeding FBA', () => {
    const legacyDbtl = makeDbtlPayload({
      learnedParameters: ['drain 95%', 'DO RMSE 0.5'],
    });

    expect(buildFBASeed(null, null, legacyDbtl).objective).toBe('biomass');
  });

  it('keeps old legacy DBTL payloads from crashing seed builders', () => {
    const legacyDbtl = makeDbtlPayload({
      learnedParameters: ['CFPS confidence 99%'],
    });

    expect(() => buildFBASeed(null, null, legacyDbtl)).not.toThrow();
  });

  it('ignores pending and rejected delta packs while reseeding FBA', () => {
    const pending = makeDbtlPayload({
      learnedDeltaPacks: [makeDeltaPack({ humanGateStatus: 'pending' })],
    });
    const rejected = makeDbtlPayload({
      learnedDeltaPacks: [makeDeltaPack({ humanGateStatus: 'rejected' })],
    });

    expect(buildFBASeed(null, null, pending).glucoseUptake).not.toBe(14);
    expect(buildFBASeed(null, null, rejected).glucoseUptake).not.toBe(14);
  });

  it('applies approved deltas only to matching target tools', () => {
    const dbtl = makeDbtlPayload({
      learnedDeltaPacks: [makeDeltaPack()],
    });

    expect(buildFBASeed(null, null, dbtl).glucoseUptake).toBe(14);
  });

  it('skips unknown delta fields and nonmatching target tools safely', () => {
    const dbtl = makeDbtlPayload({
      learnedDeltaPacks: [
        makeDeltaPack({
          targetToolIds: ['dyncon'],
          changedPriors: {
            'fbasim.glucoseUptake': { before: 9, after: 14 },
            'dyncon.unknown': { before: 1, after: 2 },
          },
        }),
      ],
    });

    expect(buildFBASeed(null, null, dbtl).glucoseUptake).not.toBe(14);
    expect(() => buildDynConSeed(null, null, null, dbtl)).not.toThrow();
  });
});
