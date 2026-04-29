import { buildFBASeed } from '../src/components/tools/shared/workbenchDataflow';
import type { WorkbenchToolPayloadMap } from '../src/store/workbenchPayloads';

function makeDbtlPayload(
  resultOverrides: Partial<WorkbenchToolPayloadMap['dbtlflow']['result']> = {},
): WorkbenchToolPayloadMap['dbtlflow'] {
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

describe('workbench dataflow DBTL feedback', () => {
  it('uses typed DBTL drain metrics when reseeding FBA', () => {
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

    expect(buildFBASeed(null, null, dbtl).objective).toBe('atp');
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
});
