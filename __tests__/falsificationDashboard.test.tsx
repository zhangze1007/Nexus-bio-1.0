import { render, screen } from '@testing-library/react';
import { TrustMetricsDashboard } from '../src/components/reports/TrustMetricsDashboard';
import type { TrustFalsificationMetrics } from '../src/types/trustMetrics';

const fixtureReport: TrustFalsificationMetrics = {
  schemaVersion: 'trust-metrics-v1',
  generatedAt: '2026-04-30T00:00:00.000Z',
  runLabel: 'local-dev',
  reportScope: 'local-trust-runtime-benchmark',
  corpusVersion: 'test-corpus',
  totalCases: 4,
  statusCounts: {
    totalCases: 4,
    ok: 1,
    blocked: 2,
    gated: 1,
    demoOnly: 0,
  },
  blockRate: 0.5,
  gateRate: 0.25,
  demoOnlyRate: 0,
  missingProvenanceRate: 0.25,
  unsafeExportPreventionRate: 1,
  demoLeakageRate: 0,
  falseBlockRate: 0,
  knownBadCoverageRate: 1,
  mismatches: [{
    caseId: 'TRB-999',
    category: 'fixture',
    toolId: 'pathd',
    surface: 'export',
    expectedStatus: 'ok',
    actualStatus: 'blocked',
    actualBlockCode: 'PROVENANCE_REQUIRED',
    reason: 'fixture mismatch',
  }],
  categoryBreakdown: {
    fixture: {
      totalCases: 4,
      ok: 1,
      blocked: 2,
      gated: 1,
      demoOnly: 0,
    },
  },
  surfaceBreakdown: {
    export: {
      totalCases: 4,
      ok: 1,
      blocked: 2,
      gated: 1,
      demoOnly: 0,
    },
  },
  knownBadSummary: {
    totalKnownBadCases: 1,
    preventedKnownBadCases: 1,
    leakedKnownBadCases: 0,
  },
  knownBadCoverage: {
    requiredTags: ['fixture-known-bad'],
    representedTags: ['fixture-known-bad'],
    missingTags: [],
  },
  progressionSummary: {
    expectedOkCases: 1,
    successfulProgressions: 1,
    falseBlockedCases: 0,
  },
  preventionSummary: {
    unsafeFormalSurfaceCases: 3,
    preventedUnsafeFormalSurfaceCases: 3,
    leakedUnsafeFormalSurfaceCases: 0,
  },
  missingProvenanceSummary: {
    detectedCases: 1,
    provenanceRequiredBlocks: 1,
  },
  limitations: [
    'Local trust-runtime benchmark output only.',
    'Does not validate wet-lab outcomes.',
    'Does not guarantee scientific model correctness.',
    'No third-party benchmark claim is made.',
    'Does not certify regulatory or safety readiness.',
  ],
};

describe('TrustMetricsDashboard', () => {
  it('renders falsification metrics, progression, blocking, mismatches, and local scope', () => {
    render(<TrustMetricsDashboard report={fixtureReport} />);

    expect(screen.getByText('Falsification Dashboard')).toBeTruthy();
    expect(screen.getByText('Block Rate')).toBeTruthy();
    expect(screen.getByText('50.0%')).toBeTruthy();
    expect(screen.getByText('Unsafe Export Prevention Rate')).toBeTruthy();
    expect(screen.getByText('Successful Progression')).toBeTruthy();
    expect(screen.getByText('Successful Blocking')).toBeTruthy();
    expect(screen.getByText('TRB-999')).toBeTruthy();
    expect(screen.getByText(/PROVENANCE_REQUIRED/)).toBeTruthy();
    expect(screen.getByText('Local trust-runtime benchmark output only.')).toBeTruthy();
    expect(screen.getByText('No third-party benchmark claim is made.')).toBeTruthy();
  });
});
