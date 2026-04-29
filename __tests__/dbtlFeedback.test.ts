import { normalizeDBTLLearnedFeedback } from '../src/migrations/migrateDbtlFeedback';
import type { DBTLLearnedFeedback } from '../src/types/dbtlFeedback';

describe('DBTL learned feedback migration', () => {
  it('returns existing typed feedback unchanged', () => {
    const feedback: DBTLLearnedFeedback = {
      learnedMetrics: { drainPercent: 42, doRmse: 0.07 },
      sources: [
        {
          derivedFromToolId: 'dbtlflow',
          derivedAt: '2026-04-29T00:00:00.000Z',
          provenanceEntryId: 'dbtlflow:1',
        },
      ],
      schemaVersion: 'dbtl-feedback-v1',
    };

    expect(normalizeDBTLLearnedFeedback({ feedback })).toBe(feedback);
  });

  it('converts legacy learnedParameters strings to legacyText with empty metrics', () => {
    const feedback = normalizeDBTLLearnedFeedback({
      legacyLearnedParameters: ['drain 87.4%', 'DO RMSE 0.123'],
      derivedFromToolId: 'dbtlflow',
      provenanceEntryId: 'dbtlflow:123',
      now: '2026-04-29T00:00:00.000Z',
    });

    expect(feedback.schemaVersion).toBe('dbtl-feedback-v1');
    expect(feedback.learnedMetrics).toEqual({});
    expect(feedback.legacyText).toEqual(['drain 87.4%', 'DO RMSE 0.123']);
    expect(feedback.sources).toEqual([
      {
        derivedFromToolId: 'dbtlflow',
        derivedAt: '2026-04-29T00:00:00.000Z',
        provenanceEntryId: 'dbtlflow:123',
        notes: 'Legacy DBTL feedback normalized without numeric text parsing.',
      },
    ]);
  });

  it('does not parse numeric values from legacy strings', () => {
    const feedback = normalizeDBTLLearnedFeedback({
      legacyLearnedParameters: ['CFPS confidence 99%', 'binding Kd 0.01 uM'],
      derivedFromToolId: 'dbtlflow',
      now: '2026-04-29T00:00:00.000Z',
    });

    expect(feedback.learnedMetrics).toEqual({});
    expect(feedback.legacyText).toEqual(['CFPS confidence 99%', 'binding Kd 0.01 uM']);
  });
});
