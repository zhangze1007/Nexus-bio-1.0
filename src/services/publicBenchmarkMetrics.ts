import type {
  BenchmarkMode,
  PublicBenchmarkCaseResult,
  PublicBenchmarkModeSummary,
  PublicBenchmarkReport,
} from '../types/publicBenchmark';
import { BENCHMARK_MODES } from '../types/publicBenchmark';

export const PUBLIC_BENCHMARK_LIMITATIONS = [
  'Local development benchmark output only.',
  'Does not validate wet-lab outcomes.',
  'Does not measure biological model accuracy or scientific truth.',
  'No external validation, third-party certification, or public release claim is made.',
  'No human reviewer calibration study has been run; reviewerCalibrationScore is not measured.',
  'Does not measure real user time-to-decision or statistical significance.',
] as const;

export const RAW_PUBLIC_BENCHMARK_CSV_HEADER = [
  'caseId',
  'category',
  'toolId',
  'surface',
  'knownBad',
  'mode',
  'expectedStatus',
  'actualStatus',
  'expectedBlockCode',
  'actualBlockCode',
  'unsafePropagation',
  'falseTrust',
  'falseBlock',
  'demoLeakage',
  'missingProvenanceLeakage',
  'notes',
] as const;

export const SUMMARY_PUBLIC_BENCHMARK_CSV_HEADER = [
  'mode',
  'totalCases',
  'unsafePropagationRate',
  'falseTrustRate',
  'falseBlockRate',
  'demoLeakageRate',
  'missingProvenanceLeakageRate',
  'unsafeExportPreventionRate',
  'knownBadPreventionRate',
  'reviewerCalibrationScore',
  'meanTimeToSafeDecisionMs',
] as const;

interface PublicBenchmarkReportOptions {
  generatedAt: string;
  runLabel: string;
  rawResultsPath: string;
  summaryPath: string;
  methodsNotePath: string;
}

function roundedRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function uniqueCaseCount(results: readonly PublicBenchmarkCaseResult[]): number {
  return new Set(results.map((result) => result.caseId)).size;
}

function isUnsafeFormalOpportunity(result: PublicBenchmarkCaseResult): boolean {
  return result.surface !== 'payload' && result.expectedStatus !== 'ok';
}

function isFalseTrustOpportunity(result: PublicBenchmarkCaseResult): boolean {
  return result.knownBad || result.expectedStatus !== 'ok';
}

function isFalseBlockOpportunity(result: PublicBenchmarkCaseResult): boolean {
  return result.expectedStatus === 'ok';
}

function isDemoLeakageOpportunity(result: PublicBenchmarkCaseResult): boolean {
  return result.demoLeakage || (
    result.actualStatus !== 'ok'
    && result.expectedStatus !== 'ok'
    && (
      result.expectedStatus === 'demoOnly'
      || result.category.includes('demo')
      || result.expectedBlockCode?.includes('DEMO') === true
      || result.actualBlockCode?.includes('DEMO') === true
      || result.notes?.toLowerCase().includes('demo') === true
    )
  );
}

function isMissingProvenanceOpportunity(result: PublicBenchmarkCaseResult): boolean {
  return result.missingProvenanceLeakage || (
    result.surface !== 'payload'
    && (
      result.expectedBlockCode === 'PROVENANCE_REQUIRED'
      || result.actualBlockCode === 'PROVENANCE_REQUIRED'
    )
  );
}

function isKnownBadPrevention(result: PublicBenchmarkCaseResult): boolean {
  return result.knownBad && result.actualStatus !== 'ok';
}

function measuredNumbers(values: Array<number | null | undefined>): number[] {
  return values.filter((value): value is number => typeof value === 'number');
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

export function computePublicBenchmarkModeSummary(
  results: PublicBenchmarkCaseResult[],
  mode: BenchmarkMode,
): PublicBenchmarkModeSummary {
  const modeResults = results.filter((result) => result.mode === mode);
  const unsafeFormalOpportunities = modeResults.filter(isUnsafeFormalOpportunity);
  const falseTrustOpportunities = modeResults.filter(isFalseTrustOpportunity);
  const falseBlockOpportunities = modeResults.filter(isFalseBlockOpportunity);
  const demoLeakageOpportunities = modeResults.filter(isDemoLeakageOpportunity);
  const missingProvenanceOpportunities = modeResults.filter(isMissingProvenanceOpportunity);
  const knownBadCases = modeResults.filter((result) => result.knownBad);
  const measuredTime = measuredNumbers(
    modeResults.map((result) => result.timeToSafeDecisionMs),
  );
  const measuredReviewerScores = measuredNumbers(
    modeResults.map((result) => result.reviewerCalibrationScore),
  );

  return {
    mode,
    totalCases: modeResults.length,
    unsafePropagationRate: roundedRate(
      modeResults.filter((result) => result.unsafePropagation).length,
      unsafeFormalOpportunities.length,
    ),
    falseTrustRate: roundedRate(
      modeResults.filter((result) => result.falseTrust).length,
      falseTrustOpportunities.length,
    ),
    falseBlockRate: roundedRate(
      modeResults.filter((result) => result.falseBlock).length,
      falseBlockOpportunities.length,
    ),
    demoLeakageRate: roundedRate(
      modeResults.filter((result) => result.demoLeakage).length,
      demoLeakageOpportunities.length,
    ),
    missingProvenanceLeakageRate: roundedRate(
      modeResults.filter((result) => result.missingProvenanceLeakage).length,
      missingProvenanceOpportunities.length,
    ),
    unsafeExportPreventionRate: roundedRate(
      unsafeFormalOpportunities.filter((result) => !result.unsafePropagation).length,
      unsafeFormalOpportunities.length,
    ),
    knownBadPreventionRate: roundedRate(
      knownBadCases.filter(isKnownBadPrevention).length,
      knownBadCases.length,
    ),
    reviewerCalibrationScore: mean(measuredReviewerScores),
    meanTimeToSafeDecisionMs: mean(measuredTime),
  };
}

export function computePublicBenchmarkReport(
  allResults: PublicBenchmarkCaseResult[],
  options: PublicBenchmarkReportOptions,
): PublicBenchmarkReport {
  return {
    schemaVersion: 'public-benchmark-v1',
    generatedAt: options.generatedAt,
    runLabel: options.runLabel,
    totalCases: uniqueCaseCount(allResults),
    modes: BENCHMARK_MODES.map((mode) => computePublicBenchmarkModeSummary(allResults, mode)),
    rawResultsPath: options.rawResultsPath,
    summaryPath: options.summaryPath,
    methodsNotePath: options.methodsNotePath,
    limitations: [...PUBLIC_BENCHMARK_LIMITATIONS],
  };
}

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function publicBenchmarkResultsToCsv(
  results: readonly PublicBenchmarkCaseResult[],
): string {
  const rows = results.map((result) => [
    result.caseId,
    result.category,
    result.toolId,
    result.surface,
    result.knownBad,
    result.mode,
    result.expectedStatus,
    result.actualStatus,
    result.expectedBlockCode,
    result.actualBlockCode,
    result.unsafePropagation,
    result.falseTrust,
    result.falseBlock,
    result.demoLeakage,
    result.missingProvenanceLeakage,
    result.notes,
  ].map(csvCell).join(','));

  return [
    RAW_PUBLIC_BENCHMARK_CSV_HEADER.join(','),
    ...rows,
  ].join('\n').concat('\n');
}

export function publicBenchmarkSummariesToCsv(
  summaries: readonly PublicBenchmarkModeSummary[],
): string {
  const rows = summaries.map((summary) => [
    summary.mode,
    summary.totalCases,
    summary.unsafePropagationRate,
    summary.falseTrustRate,
    summary.falseBlockRate,
    summary.demoLeakageRate,
    summary.missingProvenanceLeakageRate,
    summary.unsafeExportPreventionRate,
    summary.knownBadPreventionRate,
    summary.reviewerCalibrationScore,
    summary.meanTimeToSafeDecisionMs,
  ].map(csvCell).join(','));

  return [
    SUMMARY_PUBLIC_BENCHMARK_CSV_HEADER.join(','),
    ...rows,
  ].join('\n').concat('\n');
}
