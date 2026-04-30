import type { ClaimSurface, GateStatus } from '../protocol/nexusTrustRuntime';
import { evaluateClaimSurfacePolicy } from './trustPolicyEngine';
import type { HumanGateStatus } from './trustPolicyEngine';
import type {
  TrustBenchmarkCaseFile,
  TrustBenchmarkExpectedLabel,
  TrustBenchmarkHumanGateStatus,
  TrustBenchmarkMetricCase,
  TrustFalsificationMetrics,
  TrustMetricCounts,
  TrustMetricMismatch,
  TrustMetricStatus,
  TrustMetricsHistoryEntry,
} from '../types/trustMetrics';

export const TRUST_METRICS_LIMITATIONS = [
  'Local trust-runtime benchmark output only.',
  'Does not validate wet-lab outcomes.',
  'Does not guarantee scientific model correctness.',
  'No third-party benchmark claim is made.',
  'Does not certify regulatory or safety readiness.',
] as const;

export const REQUIRED_KNOWN_BAD_RISK_TAGS = [
  'community-fba-fake-exchange',
  'cethx-fake-dg-real-feasibility',
  'stringly-dbtl-loopback',
  'draft-dbtl-protocol-export',
  'demo-multio-external-handoff',
  'missing-provenance-export',
  'demo-cellfree-protocol-artifact',
  'nexai-missing-evidence-recommendation',
] as const;

interface BuildTrustMetricsReportInput {
  cases: TrustBenchmarkMetricCase[];
  expectedLabels: TrustBenchmarkExpectedLabel[];
  generatedAt: string;
  runLabel?: string;
  corpusVersion?: string;
}

interface EvaluatedTrustBenchmarkCase {
  testCase: TrustBenchmarkMetricCase;
  expectedLabel: TrustBenchmarkExpectedLabel | undefined;
  actualStatus: TrustMetricStatus;
  actualBlockCode: string | undefined;
}

const STATUSES: TrustMetricStatus[] = ['ok', 'blocked', 'gated', 'demoOnly'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isTrustMetricStatus(value: string): value is TrustMetricStatus {
  return STATUSES.includes(value as TrustMetricStatus);
}

function isClaimSurface(value: string): value is ClaimSurface {
  return ['payload', 'export', 'recommendation', 'protocol', 'external-handoff'].includes(value);
}

function isGateStatus(value: string): value is GateStatus {
  return isTrustMetricStatus(value);
}

function emptyCounts(): TrustMetricCounts {
  return {
    totalCases: 0,
    ok: 0,
    blocked: 0,
    gated: 0,
    demoOnly: 0,
  };
}

function incrementCounts(counts: TrustMetricCounts, status: TrustMetricStatus): void {
  counts.totalCases += 1;
  counts[status] += 1;
}

function roundedRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function humanGateStatus(testCase: TrustBenchmarkMetricCase): HumanGateStatus {
  const explicit = testCase.input.humanGateStatus;
  if (explicit) return explicit;
  if (!testCase.input.humanGateRequired) return 'not-required';
  return testCase.input.humanGateSatisfied ? 'approved' : 'pending';
}

function provenanceIds(testCase: TrustBenchmarkMetricCase): string[] {
  return testCase.input.hasProvenance ? [`${testCase.caseId}:provenance`] : [];
}

function evidenceIds(testCase: TrustBenchmarkMetricCase): string[] {
  return testCase.input.evidenceState === 'present' ? [`${testCase.caseId}:evidence`] : [];
}

function isFormalSurface(surface: ClaimSurface): boolean {
  return surface !== 'payload';
}

function isMissingProvenanceCase(evaluated: EvaluatedTrustBenchmarkCase): boolean {
  return (
    !evaluated.testCase.input.hasProvenance
    || evaluated.testCase.riskTags.some((tag) => tag.includes('missing-provenance'))
    || evaluated.testCase.expected.blockCode === 'PROVENANCE_REQUIRED'
    || evaluated.expectedLabel?.expectedBlockCode === 'PROVENANCE_REQUIRED'
    || evaluated.actualBlockCode === 'PROVENANCE_REQUIRED'
  );
}

function labelMap(labels: TrustBenchmarkExpectedLabel[]): Map<string, TrustBenchmarkExpectedLabel> {
  return new Map(labels.map((label) => [label.caseId, label]));
}

function evaluateCases(
  cases: TrustBenchmarkMetricCase[],
  expectedLabels: TrustBenchmarkExpectedLabel[],
): EvaluatedTrustBenchmarkCase[] {
  const labelsById = labelMap(expectedLabels);
  return cases.map((testCase) => {
    const decision = evaluateClaimSurfacePolicy({
      toolId: testCase.toolId,
      surface: testCase.surface,
      validityTier: testCase.input.validityTier,
      isDraft: testCase.input.isDraft,
      provenanceIds: provenanceIds(testCase),
      evidenceIds: evidenceIds(testCase),
      assumptionIds: testCase.riskTags,
      requiresHumanGate: testCase.input.humanGateRequired,
      humanGateStatus: humanGateStatus(testCase),
    });

    return {
      testCase,
      expectedLabel: labelsById.get(testCase.caseId),
      actualStatus: decision.status,
      actualBlockCode: decision.blockCode,
    };
  });
}

function buildBreakdown(
  evaluatedCases: EvaluatedTrustBenchmarkCase[],
  pickKey: (item: EvaluatedTrustBenchmarkCase) => string,
): Record<string, TrustMetricCounts> {
  const result: Record<string, TrustMetricCounts> = {};
  for (const item of evaluatedCases) {
    const key = pickKey(item);
    result[key] ??= emptyCounts();
    incrementCounts(result[key], item.actualStatus);
  }
  return result;
}

function mismatchReason(
  expectedStatus: TrustMetricStatus,
  actualStatus: TrustMetricStatus,
  expectedBlockCode: string | undefined,
  actualBlockCode: string | undefined,
): string {
  const reasons: string[] = [];
  if (expectedStatus !== actualStatus) {
    reasons.push(`status ${actualStatus} did not match expected ${expectedStatus}`);
  }
  if (expectedBlockCode !== actualBlockCode) {
    reasons.push(
      `blockCode ${actualBlockCode ?? '<empty>'} did not match expected ${expectedBlockCode ?? '<empty>'}`,
    );
  }
  return reasons.join('; ');
}

function buildMismatches(evaluatedCases: EvaluatedTrustBenchmarkCase[]): TrustMetricMismatch[] {
  const mismatches: TrustMetricMismatch[] = [];

  for (const item of evaluatedCases) {
    const expectedStatus = item.expectedLabel?.expectedStatus ?? item.testCase.expected.status;
    const expectedBlockCode = item.expectedLabel?.expectedBlockCode ?? item.testCase.expected.blockCode;
    const expectedBlockCodeValue = expectedBlockCode ?? undefined;

    if (expectedStatus === item.actualStatus && expectedBlockCodeValue === item.actualBlockCode) {
      continue;
    }

    mismatches.push({
      caseId: item.testCase.caseId,
      category: item.testCase.category,
      toolId: item.testCase.toolId,
      surface: item.testCase.surface,
      expectedStatus,
      actualStatus: item.actualStatus,
      ...(expectedBlockCodeValue ? { expectedBlockCode: expectedBlockCodeValue } : {}),
      ...(item.actualBlockCode ? { actualBlockCode: item.actualBlockCode } : {}),
      reason: mismatchReason(
        expectedStatus,
        item.actualStatus,
        expectedBlockCodeValue,
        item.actualBlockCode,
      ),
    });
  }

  return mismatches;
}

function requiredKnownBadCoverage(cases: TrustBenchmarkMetricCase[]) {
  const represented = new Set(
    cases
      .filter((testCase) => testCase.knownBad)
      .flatMap((testCase) => testCase.riskTags),
  );
  const representedTags = REQUIRED_KNOWN_BAD_RISK_TAGS.filter((tag) => represented.has(tag));
  const missingTags = REQUIRED_KNOWN_BAD_RISK_TAGS.filter((tag) => !represented.has(tag));

  return {
    requiredTags: [...REQUIRED_KNOWN_BAD_RISK_TAGS],
    representedTags,
    missingTags,
  };
}

export function buildTrustMetricsReport(
  input: BuildTrustMetricsReportInput,
): TrustFalsificationMetrics {
  const evaluatedCases = evaluateCases(input.cases, input.expectedLabels);
  const totalCases = evaluatedCases.length;
  const statusCounts = emptyCounts();
  for (const item of evaluatedCases) incrementCounts(statusCounts, item.actualStatus);

  const expectedOkCases = evaluatedCases.filter((item) => {
    const expectedStatus = item.expectedLabel?.expectedStatus ?? item.testCase.expected.status;
    return expectedStatus === 'ok';
  });
  const expectedOkActualBlocks = expectedOkCases.filter((item) => item.actualStatus === 'blocked');

  const unsafeFormalCases = evaluatedCases.filter((item) => {
    const expectedStatus = item.expectedLabel?.expectedStatus ?? item.testCase.expected.status;
    return isFormalSurface(item.testCase.surface) && expectedStatus !== 'ok';
  });
  const preventedUnsafeFormalCases = unsafeFormalCases.filter((item) => item.actualStatus !== 'ok');
  const leakedUnsafeFormalCases = unsafeFormalCases.filter((item) => item.actualStatus === 'ok');

  const demoFormalCases = evaluatedCases.filter(
    (item) => item.testCase.input.validityTier === 'demo' && isFormalSurface(item.testCase.surface),
  );
  const demoLeaks = demoFormalCases.filter((item) => item.actualStatus === 'ok');

  const missingProvenanceCases = evaluatedCases.filter(isMissingProvenanceCase);
  const provenanceRequiredBlocks = evaluatedCases.filter(
    (item) => item.actualBlockCode === 'PROVENANCE_REQUIRED',
  );

  const knownBadCases = evaluatedCases.filter((item) => item.testCase.knownBad);
  const preventedKnownBadCases = knownBadCases.filter((item) => item.actualStatus !== 'ok');
  const leakedKnownBadCases = knownBadCases.filter((item) => item.actualStatus === 'ok');
  const knownBadCoverage = requiredKnownBadCoverage(input.cases);

  return {
    schemaVersion: 'trust-metrics-v1',
    generatedAt: input.generatedAt,
    runLabel: input.runLabel ?? 'local-dev',
    reportScope: 'local-trust-runtime-benchmark',
    ...(input.corpusVersion ? { corpusVersion: input.corpusVersion } : {}),
    totalCases,
    statusCounts,
    blockRate: roundedRate(statusCounts.blocked, totalCases),
    gateRate: roundedRate(statusCounts.gated, totalCases),
    demoOnlyRate: roundedRate(statusCounts.demoOnly, totalCases),
    missingProvenanceRate: roundedRate(missingProvenanceCases.length, totalCases),
    unsafeExportPreventionRate: roundedRate(
      preventedUnsafeFormalCases.length,
      unsafeFormalCases.length,
    ),
    demoLeakageRate: roundedRate(demoLeaks.length, demoFormalCases.length),
    falseBlockRate: roundedRate(expectedOkActualBlocks.length, expectedOkCases.length),
    knownBadCoverageRate: roundedRate(
      knownBadCoverage.representedTags.length,
      knownBadCoverage.requiredTags.length,
    ),
    mismatches: buildMismatches(evaluatedCases),
    categoryBreakdown: buildBreakdown(evaluatedCases, (item) => item.testCase.category),
    surfaceBreakdown: buildBreakdown(evaluatedCases, (item) => item.testCase.surface),
    knownBadSummary: {
      totalKnownBadCases: knownBadCases.length,
      preventedKnownBadCases: preventedKnownBadCases.length,
      leakedKnownBadCases: leakedKnownBadCases.length,
    },
    knownBadCoverage,
    progressionSummary: {
      expectedOkCases: expectedOkCases.length,
      successfulProgressions: expectedOkCases.filter((item) => item.actualStatus === 'ok').length,
      falseBlockedCases: expectedOkActualBlocks.length,
    },
    preventionSummary: {
      unsafeFormalSurfaceCases: unsafeFormalCases.length,
      preventedUnsafeFormalSurfaceCases: preventedUnsafeFormalCases.length,
      leakedUnsafeFormalSurfaceCases: leakedUnsafeFormalCases.length,
    },
    missingProvenanceSummary: {
      detectedCases: missingProvenanceCases.length,
      provenanceRequiredBlocks: provenanceRequiredBlocks.length,
    },
    limitations: [...TRUST_METRICS_LIMITATIONS],
  };
}

export function toTrustMetricsHistoryEntry(
  report: TrustFalsificationMetrics,
): TrustMetricsHistoryEntry {
  return {
    generatedAt: report.generatedAt,
    runLabel: report.runLabel,
    ...(report.corpusVersion ? { corpusVersion: report.corpusVersion } : {}),
    totalCases: report.totalCases,
    blockRate: report.blockRate,
    falseBlockRate: report.falseBlockRate,
    unsafeExportPreventionRate: report.unsafeExportPreventionRate,
    demoLeakageRate: report.demoLeakageRate,
    missingProvenanceRate: report.missingProvenanceRate,
    mismatchCount: report.mismatches.length,
  };
}

export function parseExpectedLabelsCsv(csv: string): TrustBenchmarkExpectedLabel[] {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const expectedHeader = 'caseId,expectedStatus,expectedBlockCode,category,toolId,surface,knownBad';
  if (header !== expectedHeader) {
    throw new Error(`expected_labels.csv header must be ${expectedHeader}`);
  }

  return lines.filter(Boolean).map((line, index) => {
    const parts = line.split(',');
    if (parts.length !== 7) {
      throw new Error(`expected_labels.csv:${index + 2}: expected 7 columns`);
    }
    const [
      caseId,
      expectedStatus,
      expectedBlockCode,
      category,
      toolId,
      surface,
      knownBad,
    ] = parts;

    if (!isGateStatus(expectedStatus)) {
      throw new Error(`${caseId}: expectedStatus ${expectedStatus} is not a gate status`);
    }
    if (!isClaimSurface(surface)) {
      throw new Error(`${caseId}: surface ${surface} is not a claim surface`);
    }
    if (knownBad !== 'true' && knownBad !== 'false') {
      throw new Error(`${caseId}: knownBad must be true or false`);
    }

    return {
      caseId,
      expectedStatus,
      expectedBlockCode: expectedBlockCode || null,
      category,
      toolId,
      surface,
      knownBad: knownBad === 'true',
    };
  });
}

function parseHumanGateStatus(value: unknown, context: string): TrustBenchmarkHumanGateStatus | undefined {
  if (value === undefined) return undefined;
  if (
    value === 'not-required'
    || value === 'pending'
    || value === 'approved'
    || value === 'rejected'
  ) {
    return value;
  }
  throw new Error(`${context}.humanGateStatus is not allowed`);
}

function parseBenchmarkCase(value: unknown, context: string): TrustBenchmarkMetricCase {
  if (!isRecord(value)) throw new Error(`${context}: case must be an object`);
  if (!isRecord(value.input)) throw new Error(`${context}.input must be an object`);
  if (!isRecord(value.expected)) throw new Error(`${context}.expected must be an object`);
  if (!isStringArray(value.riskTags)) throw new Error(`${context}.riskTags must be string[]`);

  const caseId = value.caseId;
  const title = value.title;
  const category = value.category;
  const toolId = value.toolId;
  const surface = value.surface;
  const claim = value.claim;
  const knownBad = value.knownBad;

  if (typeof caseId !== 'string') throw new Error(`${context}.caseId must be a string`);
  if (typeof title !== 'string') throw new Error(`${context}.title must be a string`);
  if (typeof category !== 'string') throw new Error(`${context}.category must be a string`);
  if (typeof toolId !== 'string') throw new Error(`${context}.toolId must be a string`);
  if (typeof surface !== 'string' || !isClaimSurface(surface)) {
    throw new Error(`${context}.surface must be a claim surface`);
  }
  if (typeof claim !== 'string') throw new Error(`${context}.claim must be a string`);
  if (typeof knownBad !== 'boolean') throw new Error(`${context}.knownBad must be a boolean`);

  const input = value.input;
  const validityTier = input.validityTier;
  const evidenceState = input.evidenceState;
  const uncertaintyState = input.uncertaintyState;
  const hasProvenance = input.hasProvenance;
  const isDraft = input.isDraft;
  const humanGateRequired = input.humanGateRequired;
  const humanGateSatisfied = input.humanGateSatisfied;
  const notes = input.notes;

  if (validityTier !== 'real' && validityTier !== 'partial' && validityTier !== 'demo') {
    throw new Error(`${context}.input.validityTier is not allowed`);
  }
  if (evidenceState !== 'present' && evidenceState !== 'missing' && evidenceState !== 'not-required') {
    throw new Error(`${context}.input.evidenceState is not allowed`);
  }
  if (
    uncertaintyState !== 'bounded'
    && uncertaintyState !== 'unresolved'
    && uncertaintyState !== 'not-applicable'
  ) {
    throw new Error(`${context}.input.uncertaintyState is not allowed`);
  }
  if (typeof hasProvenance !== 'boolean') throw new Error(`${context}.input.hasProvenance must be boolean`);
  if (typeof isDraft !== 'boolean') throw new Error(`${context}.input.isDraft must be boolean`);
  if (typeof humanGateRequired !== 'boolean') {
    throw new Error(`${context}.input.humanGateRequired must be boolean`);
  }
  if (typeof humanGateSatisfied !== 'boolean') {
    throw new Error(`${context}.input.humanGateSatisfied must be boolean`);
  }
  if (typeof notes !== 'string') throw new Error(`${context}.input.notes must be a string`);

  const expectedStatus = value.expected.status;
  const expectedBlockCode = value.expected.blockCode;
  const rationale = value.expected.rationale;
  if (typeof expectedStatus !== 'string' || !isGateStatus(expectedStatus)) {
    throw new Error(`${context}.expected.status is not a gate status`);
  }
  let blockCode: string | null;
  if (expectedBlockCode === null) {
    blockCode = null;
  } else if (typeof expectedBlockCode === 'string') {
    blockCode = expectedBlockCode;
  } else {
    throw new Error(`${context}.expected.blockCode must be string or null`);
  }
  if (typeof rationale !== 'string') throw new Error(`${context}.expected.rationale must be a string`);

  return {
    caseId,
    title,
    category,
    toolId,
    surface,
    claim,
    input: {
      validityTier,
      hasProvenance,
      evidenceState,
      uncertaintyState,
      isDraft,
      humanGateRequired,
      humanGateSatisfied,
      humanGateStatus: parseHumanGateStatus(input.humanGateStatus, `${context}.input`),
      notes,
    },
    expected: {
      status: expectedStatus,
      blockCode,
      rationale,
    },
    riskTags: value.riskTags,
    knownBad,
  };
}

export function parseBenchmarkCaseFile(value: unknown, context: string): TrustBenchmarkCaseFile {
  if (!isRecord(value)) throw new Error(`${context}: root must be an object`);
  if (!Array.isArray(value.cases)) throw new Error(`${context}.cases must be an array`);
  return {
    cases: value.cases.map((testCase, index) => parseBenchmarkCase(testCase, `${context}.cases[${index}]`)),
  };
}
