/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import {
  computePublicBenchmarkModeSummary,
  computePublicBenchmarkReport,
  publicBenchmarkResultsToCsv,
  publicBenchmarkSummariesToCsv,
  RAW_PUBLIC_BENCHMARK_CSV_HEADER,
  SUMMARY_PUBLIC_BENCHMARK_CSV_HEADER,
} from '../src/services/publicBenchmarkMetrics';
import { evaluateBenchmarkCasesForModes } from '../src/services/publicBenchmarkEvaluator';
import {
  parseBenchmarkCaseFile,
  parseExpectedLabelsCsv,
} from '../src/services/trustMetricsReport';
import type {
  BenchmarkMode,
  PublicBenchmarkCaseResult,
  PublicBenchmarkReport,
} from '../src/types/publicBenchmark';
import type {
  TrustBenchmarkExpectedLabel,
  TrustBenchmarkMetricCase,
} from '../src/types/trustMetrics';

const repoRoot = path.resolve(__dirname, '..');
const caseDir = path.join(repoRoot, 'benchmarks', 'trust-runtime-cases');
const labelsPath = path.join(repoRoot, 'benchmarks', 'expected_labels.csv');
const publicBenchmarkReportDir = path.join(repoRoot, 'reports', 'public-benchmark');

function result(overrides: Partial<PublicBenchmarkCaseResult> = {}): PublicBenchmarkCaseResult {
  return {
    caseId: overrides.caseId ?? 'PB-001',
    category: overrides.category ?? 'truthful-partial',
    toolId: overrides.toolId ?? 'pathd',
    surface: overrides.surface ?? 'export',
    knownBad: overrides.knownBad ?? false,
    mode: overrides.mode ?? 'runtime-gating',
    expectedStatus: overrides.expectedStatus ?? 'ok',
    actualStatus: overrides.actualStatus ?? 'ok',
    ...(overrides.expectedBlockCode ? { expectedBlockCode: overrides.expectedBlockCode } : {}),
    ...(overrides.actualBlockCode ? { actualBlockCode: overrides.actualBlockCode } : {}),
    unsafePropagation: overrides.unsafePropagation ?? false,
    falseTrust: overrides.falseTrust ?? false,
    falseBlock: overrides.falseBlock ?? false,
    demoLeakage: overrides.demoLeakage ?? false,
    missingProvenanceLeakage: overrides.missingProvenanceLeakage ?? false,
    ...(overrides.timeToSafeDecisionMs !== undefined
      ? { timeToSafeDecisionMs: overrides.timeToSafeDecisionMs }
      : {}),
    ...(overrides.reviewerCalibrationScore !== undefined
      ? { reviewerCalibrationScore: overrides.reviewerCalibrationScore }
      : {}),
    ...(overrides.notes ? { notes: overrides.notes } : {}),
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

describe('public benchmark metrics', () => {
  it('computes summary rates from raw results', () => {
    const results = [
      result({
        caseId: 'PB-UNSAFE',
        mode: 'no-gating',
        expectedStatus: 'blocked',
        actualStatus: 'ok',
        unsafePropagation: true,
        falseTrust: true,
        surface: 'export',
      }),
      result({
        caseId: 'PB-OK',
        mode: 'no-gating',
        expectedStatus: 'ok',
        actualStatus: 'ok',
      }),
      result({
        caseId: 'PB-KNOWN',
        mode: 'no-gating',
        expectedStatus: 'blocked',
        actualStatus: 'ok',
        knownBad: true,
        falseTrust: true,
        unsafePropagation: true,
        surface: 'recommendation',
      }),
    ];

    const summary = computePublicBenchmarkModeSummary(results, 'no-gating');

    expect(summary.totalCases).toBe(3);
    expect(summary.unsafePropagationRate).toBe(1);
    expect(summary.falseTrustRate).toBe(1);
    expect(summary.falseBlockRate).toBe(0);
    expect(summary.unsafeExportPreventionRate).toBe(0);
    expect(summary.knownBadPreventionRate).toBe(0);
    expect(summary.reviewerCalibrationScore).toBeNull();
    expect(summary.meanTimeToSafeDecisionMs).toBeNull();
  });

  it('keeps runtime mode metrics computed rather than hardcoded as perfect', () => {
    const summary = computePublicBenchmarkModeSummary([
      result({
        caseId: 'PB-RUNTIME-LEAK',
        mode: 'runtime-gating',
        expectedStatus: 'blocked',
        actualStatus: 'ok',
        unsafePropagation: true,
        falseTrust: true,
        surface: 'protocol',
      }),
    ], 'runtime-gating');

    expect(summary.unsafePropagationRate).toBe(1);
    expect(summary.unsafeExportPreventionRate).toBe(0);
  });

  it('reports all three modes with corpus-sized totals', () => {
    const cases = loadCases();
    const labels = loadLabels();
    const allResults = evaluateBenchmarkCasesForModes(cases, labels);
    const report = computePublicBenchmarkReport(allResults, {
      generatedAt: '2026-04-30T00:00:00.000Z',
      runLabel: 'local-dev',
      rawResultsPath: 'reports/public-benchmark/raw-results.json',
      summaryPath: 'reports/public-benchmark/summary.json',
      methodsNotePath: 'docs/public-benchmark-methods.md',
    });
    const modes = new Map<BenchmarkMode, number>(
      report.modes.map((modeSummary) => [modeSummary.mode, modeSummary.totalCases]),
    );

    expect(report.schemaVersion).toBe('public-benchmark-v1');
    expect(report.totalCases).toBe(cases.length);
    expect(report.modes.map((modeSummary) => modeSummary.mode)).toEqual([
      'no-gating',
      'badge-only',
      'runtime-gating',
    ]);
    expect(modes.get('no-gating')).toBe(cases.length);
    expect(modes.get('badge-only')).toBe(cases.length);
    expect(modes.get('runtime-gating')).toBe(cases.length);
  });

  it('keeps raw and summary CSV output shapes stable', () => {
    const results = [
      result({ mode: 'no-gating', expectedBlockCode: 'PROVENANCE_REQUIRED' }),
      result({ caseId: 'PB-002', mode: 'runtime-gating', actualStatus: 'blocked' }),
    ];
    const summary = computePublicBenchmarkModeSummary(results, 'runtime-gating');
    const rawCsv = publicBenchmarkResultsToCsv(results);
    const summaryCsv = publicBenchmarkSummariesToCsv([summary]);

    expect(rawCsv.split(/\r?\n/)[0]).toBe(RAW_PUBLIC_BENCHMARK_CSV_HEADER.join(','));
    expect(summaryCsv.split(/\r?\n/)[0]).toBe(SUMMARY_PUBLIC_BENCHMARK_CSV_HEADER.join(','));
  });

  it('keeps generated report files parseable', () => {
    const rawJson: unknown = JSON.parse(
      fs.readFileSync(path.join(publicBenchmarkReportDir, 'raw-results.json'), 'utf8'),
    );
    const summaryJson: unknown = JSON.parse(
      fs.readFileSync(path.join(publicBenchmarkReportDir, 'summary.json'), 'utf8'),
    );
    const reportJson: unknown = JSON.parse(
      fs.readFileSync(path.join(publicBenchmarkReportDir, 'report.json'), 'utf8'),
    );

    expect(Array.isArray(rawJson)).toBe(true);
    expect(Array.isArray(summaryJson)).toBe(true);
    expect(isRecord(reportJson)).toBe(true);
    if (!isRecord(reportJson)) return;

    const report = reportJson as Partial<PublicBenchmarkReport>;
    expect(report.schemaVersion).toBe('public-benchmark-v1');
    expect(report.runLabel).toBe('local-dev');
    expect(report.totalCases).toBe(loadCases().length);
    expect(Object.prototype.hasOwnProperty.call(reportJson, 'wetLabValidation')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(reportJson, 'scientificValidation')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(reportJson, 'externalValidation')).toBe(false);
  });
});
