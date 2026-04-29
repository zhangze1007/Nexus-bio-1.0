/** @jest-environment node */
import {
  getProvenanceChainDiagnostics,
} from '../src/services/provenanceMiddleware';

describe('provenance chain diagnostics', () => {
  it('reports local chain length and missing upstream provenance ids', () => {
    const diagnostics = getProvenanceChainDiagnostics({
      runProvenance: [
        {
          toolId: 'pathd',
          timestamp: 1,
          inputAssumptions: [],
          outputAssumptions: [],
          evidence: [],
          validityTier: 'partial',
          upstreamProvenance: [],
        },
        {
          toolId: 'catdes',
          timestamp: 2,
          inputAssumptions: [],
          outputAssumptions: [],
          evidence: [],
          validityTier: 'partial',
          upstreamProvenance: ['pathd:1', 'missing-upstream:9'],
        },
      ],
    });

    expect(diagnostics).toEqual({
      provenanceIds: ['pathd:1', 'catdes:2'],
      chainLength: 2,
      missingUpstreamProvenanceIds: ['missing-upstream:9'],
      hasMissingUpstream: true,
    });
  });

  it('supports protocol-level provenance entries with provenanceId fields', () => {
    const diagnostics = getProvenanceChainDiagnostics({
      runProvenance: [
        {
          provenanceId: 'provenance:pathd:tool-run:abc',
          toolId: 'pathd',
          activityType: 'tool-run',
          surface: 'payload',
          startedAt: '2026-04-29T00:00:00.000Z',
          completedAt: '2026-04-29T00:00:01.000Z',
          inputAssumptionIds: [],
          outputAssumptionIds: [],
          evidenceIds: [],
          upstreamProvenanceIds: [],
        },
        {
          provenanceId: 'provenance:dyncon:tool-run:def',
          toolId: 'dyncon',
          activityType: 'tool-run',
          surface: 'payload',
          startedAt: '2026-04-29T00:00:02.000Z',
          completedAt: '2026-04-29T00:00:03.000Z',
          inputAssumptionIds: [],
          outputAssumptionIds: [],
          evidenceIds: [],
          upstreamProvenanceIds: ['provenance:pathd:tool-run:abc'],
        },
      ],
    });

    expect(diagnostics.provenanceIds).toEqual([
      'provenance:pathd:tool-run:abc',
      'provenance:dyncon:tool-run:def',
    ]);
    expect(diagnostics.chainLength).toBe(2);
    expect(diagnostics.missingUpstreamProvenanceIds).toEqual([]);
    expect(diagnostics.hasMissingUpstream).toBe(false);
  });

  it('does not crash on legacy payloads without runProvenance', () => {
    expect(getProvenanceChainDiagnostics({ toolId: 'pathd', result: {} })).toEqual({
      provenanceIds: [],
      chainLength: 0,
      missingUpstreamProvenanceIds: [],
      hasMissingUpstream: false,
    });
  });
});
