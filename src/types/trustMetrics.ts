import type { ClaimSurface, GateStatus, ValidityTier } from '../protocol/nexusTrustRuntime';

export type TrustMetricStatus = 'ok' | 'blocked' | 'gated' | 'demoOnly';

export type TrustMetricRunLabel = 'local-dev' | string;

export type TrustBenchmarkEvidenceState = 'present' | 'missing' | 'not-required';

export type TrustBenchmarkUncertaintyState = 'bounded' | 'unresolved' | 'not-applicable';

export type TrustBenchmarkHumanGateStatus = 'not-required' | 'pending' | 'approved' | 'rejected';

export interface TrustMetricCounts {
  totalCases: number;
  ok: number;
  blocked: number;
  gated: number;
  demoOnly: number;
}

export interface TrustMetricMismatch {
  caseId: string;
  category: string;
  toolId: string;
  surface: string;
  expectedStatus: TrustMetricStatus;
  actualStatus: TrustMetricStatus;
  expectedBlockCode?: string;
  actualBlockCode?: string;
  reason: string;
}

export interface TrustMetricKnownBadSummary {
  totalKnownBadCases: number;
  preventedKnownBadCases: number;
  leakedKnownBadCases: number;
}

export interface TrustMetricKnownBadCoverage {
  requiredTags: string[];
  representedTags: string[];
  missingTags: string[];
}

export interface TrustMetricProgressionSummary {
  expectedOkCases: number;
  successfulProgressions: number;
  falseBlockedCases: number;
}

export interface TrustMetricPreventionSummary {
  unsafeFormalSurfaceCases: number;
  preventedUnsafeFormalSurfaceCases: number;
  leakedUnsafeFormalSurfaceCases: number;
}

export interface TrustMetricMissingProvenanceSummary {
  detectedCases: number;
  provenanceRequiredBlocks: number;
}

export interface TrustFalsificationMetrics {
  schemaVersion: 'trust-metrics-v1';
  generatedAt: string;
  runLabel: TrustMetricRunLabel;
  reportScope: 'local-trust-runtime-benchmark';
  corpusVersion?: string;
  totalCases: number;
  statusCounts: TrustMetricCounts;
  blockRate: number;
  gateRate: number;
  demoOnlyRate: number;
  missingProvenanceRate: number;
  unsafeExportPreventionRate: number;
  demoLeakageRate: number;
  falseBlockRate: number;
  knownBadCoverageRate: number;
  mismatches: TrustMetricMismatch[];
  categoryBreakdown: Record<string, TrustMetricCounts>;
  surfaceBreakdown: Record<string, TrustMetricCounts>;
  knownBadSummary: TrustMetricKnownBadSummary;
  knownBadCoverage: TrustMetricKnownBadCoverage;
  progressionSummary: TrustMetricProgressionSummary;
  preventionSummary: TrustMetricPreventionSummary;
  missingProvenanceSummary: TrustMetricMissingProvenanceSummary;
  limitations: string[];
}

export interface TrustMetricsHistoryEntry {
  generatedAt: string;
  runLabel: string;
  corpusVersion?: string;
  totalCases: number;
  blockRate: number;
  falseBlockRate: number;
  unsafeExportPreventionRate: number;
  demoLeakageRate: number;
  missingProvenanceRate: number;
  mismatchCount: number;
}

export interface TrustBenchmarkMetricInput {
  validityTier: ValidityTier;
  hasProvenance: boolean;
  evidenceState: TrustBenchmarkEvidenceState;
  uncertaintyState: TrustBenchmarkUncertaintyState;
  isDraft: boolean;
  humanGateRequired: boolean;
  humanGateSatisfied: boolean;
  humanGateStatus?: TrustBenchmarkHumanGateStatus;
  notes: string;
}

export interface TrustBenchmarkExpectedLabel {
  caseId: string;
  expectedStatus: GateStatus;
  expectedBlockCode: string | null;
  category: string;
  toolId: string;
  surface: ClaimSurface;
  knownBad: boolean;
}

export interface TrustBenchmarkMetricCase {
  caseId: string;
  title: string;
  category: string;
  toolId: string;
  surface: ClaimSurface;
  claim: string;
  input: TrustBenchmarkMetricInput;
  expected: {
    status: GateStatus;
    blockCode: string | null;
    rationale: string;
  };
  riskTags: string[];
  knownBad: boolean;
}

export interface TrustBenchmarkCaseFile {
  cases: TrustBenchmarkMetricCase[];
}
