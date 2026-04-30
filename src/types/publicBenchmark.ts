import type { ClaimSurface } from '../protocol/nexusTrustRuntime';

export const BENCHMARK_MODES = [
  'no-gating',
  'badge-only',
  'runtime-gating',
] as const;

export type BenchmarkMode = (typeof BENCHMARK_MODES)[number];

export type BenchmarkDecisionStatus =
  | 'ok'
  | 'blocked'
  | 'gated'
  | 'demoOnly';

export interface PublicBenchmarkCaseResult {
  caseId: string;
  category: string;
  toolId: string;
  surface: ClaimSurface;
  knownBad: boolean;
  mode: BenchmarkMode;
  expectedStatus: BenchmarkDecisionStatus;
  actualStatus: BenchmarkDecisionStatus;
  expectedBlockCode?: string;
  actualBlockCode?: string;
  unsafePropagation: boolean;
  falseTrust: boolean;
  falseBlock: boolean;
  demoLeakage: boolean;
  missingProvenanceLeakage: boolean;
  timeToSafeDecisionMs?: number | null;
  reviewerCalibrationScore?: number | null;
  notes?: string;
}

export interface PublicBenchmarkModeSummary {
  mode: BenchmarkMode;
  totalCases: number;
  unsafePropagationRate: number;
  falseTrustRate: number;
  falseBlockRate: number;
  demoLeakageRate: number;
  missingProvenanceLeakageRate: number;
  unsafeExportPreventionRate: number;
  knownBadPreventionRate: number;
  meanTimeToSafeDecisionMs?: number | null;
  reviewerCalibrationScore?: number | null;
}

export interface PublicBenchmarkReport {
  schemaVersion: 'public-benchmark-v1';
  generatedAt: string;
  runLabel: string;
  totalCases: number;
  modes: PublicBenchmarkModeSummary[];
  rawResultsPath: string;
  summaryPath: string;
  methodsNotePath: string;
  limitations: string[];
}
