/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import {
  buildTrustMetricsReport,
  parseBenchmarkCaseFile,
  parseExpectedLabelsCsv,
} from '../src/services/trustMetricsReport';
import type {
  TrustBenchmarkExpectedLabel,
  TrustBenchmarkMetricCase,
  TrustFalsificationMetrics,
} from '../src/types/trustMetrics';

const repoRoot = path.resolve(__dirname, '..');
const caseDir = path.join(repoRoot, 'benchmarks', 'trust-runtime-cases');
const labelsPath = path.join(repoRoot, 'benchmarks', 'expected_labels.csv');
const latestReportPath = path.join(repoRoot, 'reports', 'trust-metrics', 'latest.json');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadCases(): TrustBenchmarkMetricCase[] {
  return fs.readdirSync(caseDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .flatMap((file) => {
      const fullPath = path.join(caseDir, file);
      const parsed: unknown = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      return parseBenchmarkCaseFile(parsed, path.relative(repoRoot, fullPath)).cases;
    });
}

function loadLabels(): TrustBenchmarkExpectedLabel[] {
  return parseExpectedLabelsCsv(fs.readFileSync(labelsPath, 'utf8'));
}

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function buildReport(
  cases: TrustBenchmarkMetricCase[] = loadCases(),
  labels: TrustBenchmarkExpectedLabel[] = loadLabels(),
): TrustFalsificationMetrics {
  return buildTrustMetricsReport({
    cases,
    expectedLabels: labels,
    generatedAt: '2026-04-30T00:00:00.000Z',
    runLabel: 'local-dev',
    corpusVersion: 'test-corpus',
  });
}

describe('trust metrics report', () => {
  it('computes metrics from the actual benchmark corpus and evaluator output', () => {
    const cases = loadCases();
    const report = buildReport(cases);

    expect(report.schemaVersion).toBe('trust-metrics-v1');
    expect(report.totalCases).toBe(cases.length);
    expect(report.statusCounts.totalCases).toBe(cases.length);
    expect(
      report.statusCounts.ok
      + report.statusCounts.blocked
      + report.statusCounts.gated
      + report.statusCounts.demoOnly,
    ).toBe(cases.length);
    expect(report.blockRate).toBe(rate(report.statusCounts.blocked, cases.length));
    expect(report.gateRate).toBe(rate(report.statusCounts.gated, cases.length));
    expect(report.demoOnlyRate).toBe(rate(report.statusCounts.demoOnly, cases.length));
    expect(report.unsafeExportPreventionRate).toBe(1);
    expect(report.demoLeakageRate).toBe(0);
    expect(report.mismatches).toEqual([]);
  });

  it('represents evaluator mismatches honestly', () => {
    const mismatchedCase: TrustBenchmarkMetricCase = {
      caseId: 'TRB-999',
      title: 'Forced mismatch fixture',
      category: 'missing-evidence',
      toolId: 'pathd',
      surface: 'export',
      claim: 'Fixture expects ok despite missing provenance.',
      input: {
        validityTier: 'partial',
        hasProvenance: false,
        evidenceState: 'present',
        uncertaintyState: 'bounded',
        isDraft: false,
        humanGateRequired: false,
        humanGateSatisfied: false,
        notes: 'Fixture only.',
      },
      expected: {
        status: 'ok',
        blockCode: null,
        rationale: 'Fixture intentionally mismatches the evaluator.',
      },
      riskTags: ['missing-provenance-export'],
      knownBad: false,
    };
    const labels: TrustBenchmarkExpectedLabel[] = [{
      caseId: mismatchedCase.caseId,
      expectedStatus: 'ok',
      expectedBlockCode: null,
      category: mismatchedCase.category,
      toolId: mismatchedCase.toolId,
      surface: mismatchedCase.surface,
      knownBad: mismatchedCase.knownBad,
    }];

    const report = buildReport([mismatchedCase], labels);

    expect(report.mismatches).toHaveLength(1);
    expect(report.mismatches[0]).toMatchObject({
      caseId: 'TRB-999',
      expectedStatus: 'ok',
      actualStatus: 'blocked',
      actualBlockCode: 'PROVENANCE_REQUIRED',
    });
  });

  it('computes missing provenance and known-bad summaries from case fields and decisions', () => {
    const report = buildReport();

    expect(report.missingProvenanceSummary.detectedCases).toBeGreaterThan(0);
    expect(report.missingProvenanceSummary.provenanceRequiredBlocks).toBeGreaterThan(0);
    expect(report.knownBadSummary.totalKnownBadCases).toBeGreaterThan(0);
    expect(report.knownBadSummary.leakedKnownBadCases).toBe(0);
    expect(report.knownBadCoverage.missingTags).toEqual([]);
    expect(report.knownBadCoverageRate).toBe(1);
  });

  it('keeps latest.json machine-readable and scoped to local benchmark output', () => {
    const parsed: unknown = JSON.parse(fs.readFileSync(latestReportPath, 'utf8'));
    expect(isRecord(parsed)).toBe(true);
    if (!isRecord(parsed)) return;

    expect(parsed.schemaVersion).toBe('trust-metrics-v1');
    expect(parsed.reportScope).toBe('local-trust-runtime-benchmark');
    expect(parsed.runLabel).toBe('local-dev');
    expect(parsed.totalCases).toBe(loadCases().length);
    expect(Array.isArray(parsed.mismatches)).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(parsed, 'externalValidation')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(parsed, 'scientificValidation')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(parsed, 'wetLabValidation')).toBe(false);
  });
});
