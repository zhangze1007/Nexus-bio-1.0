import type { ClaimSurface } from "../protocol/nexusTrustRuntime";
import type { BenchmarkDecisionStatus, BenchmarkMode, PublicBenchmarkCaseResult } from "../types/publicBenchmark";
import { BENCHMARK_MODES } from "../types/publicBenchmark";
import type { TrustBenchmarkExpectedLabel, TrustBenchmarkMetricCase } from "../types/trustMetrics";
import { parseBenchmarkCaseFile } from "./trustMetricsReport";
import { evaluateClaimSurfacePolicy, type HumanGateStatus } from "./trustPolicyEngine";

export const FORMAL_PUBLIC_BENCHMARK_SURFACES: readonly ClaimSurface[] = [
  "export",
  "recommendation",
  "protocol",
  "external-handoff",
] as const;

function parseSingleBenchmarkCase(benchmarkCase: unknown): TrustBenchmarkMetricCase {
  const parsed = parseBenchmarkCaseFile({ cases: [benchmarkCase] }, "publicBenchmarkCase");
  return parsed.cases[0];
}

function isFormalSurface(surface: ClaimSurface): boolean {
  return FORMAL_PUBLIC_BENCHMARK_SURFACES.includes(surface);
}

function humanGateStatus(testCase: TrustBenchmarkMetricCase): HumanGateStatus {
  const explicit = testCase.input.humanGateStatus;
  if (explicit) return explicit;
  if (!testCase.input.humanGateRequired) return "not-required";
  return testCase.input.humanGateSatisfied ? "approved" : "pending";
}

function provenanceIds(testCase: TrustBenchmarkMetricCase): string[] {
  return testCase.input.hasProvenance ? [`${testCase.caseId}:provenance`] : [];
}

function evidenceIds(testCase: TrustBenchmarkMetricCase): string[] {
  return testCase.input.evidenceState === "present" ? [`${testCase.caseId}:evidence`] : [];
}

function expectedBlockCode(
  testCase: TrustBenchmarkMetricCase,
  expectedLabel?: TrustBenchmarkExpectedLabel,
): string | undefined {
  return expectedLabel?.expectedBlockCode ?? testCase.expected.blockCode ?? undefined;
}

function expectedStatus(
  testCase: TrustBenchmarkMetricCase,
  expectedLabel?: TrustBenchmarkExpectedLabel,
): BenchmarkDecisionStatus {
  return expectedLabel?.expectedStatus ?? testCase.expected.status;
}

function hasDemoSignal(testCase: TrustBenchmarkMetricCase): boolean {
  return (
    testCase.input.validityTier === "demo" ||
    testCase.category.includes("demo") ||
    testCase.riskTags.some((tag) => tag.includes("demo"))
  );
}

function hasMissingProvenanceSignal(
  testCase: TrustBenchmarkMetricCase,
  expectedBlockCodeValue: string | undefined,
  actualBlockCode: string | undefined,
): boolean {
  return (
    !testCase.input.hasProvenance ||
    testCase.riskTags.some((tag) => tag.includes("missing-provenance")) ||
    expectedBlockCodeValue === "PROVENANCE_REQUIRED" ||
    actualBlockCode === "PROVENANCE_REQUIRED"
  );
}

function baselineNotes(mode: BenchmarkMode): string {
  if (mode === "no-gating") {
    return "No-governance baseline: every output is allowed through; trust labels and gate decisions do not enforce claim-surface use.";
  }

  return "Badge-only baseline: validity, provenance, and assumption labels may be visible, but they do not enforce claim-surface use.";
}

function evaluateRuntimeDecision(testCase: TrustBenchmarkMetricCase): {
  actualStatus: BenchmarkDecisionStatus;
  actualBlockCode: string | undefined;
  notes: string;
} {
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
    actualStatus: decision.status,
    actualBlockCode: decision.blockCode,
    notes: `Runtime-gating baseline: ${decision.reason}`,
  };
}

function evaluateParsedCaseForBenchmarkMode(
  testCase: TrustBenchmarkMetricCase,
  mode: BenchmarkMode,
  expectedLabel?: TrustBenchmarkExpectedLabel,
): PublicBenchmarkCaseResult {
  const expectedStatusValue = expectedStatus(testCase, expectedLabel);
  const expectedBlockCodeValue = expectedBlockCode(testCase, expectedLabel);

  const modeDecision =
    mode === "runtime-gating"
      ? evaluateRuntimeDecision(testCase)
      : {
          actualStatus: "ok" as BenchmarkDecisionStatus,
          actualBlockCode: undefined,
          notes: baselineNotes(mode),
        };

  const formalSurface = isFormalSurface(testCase.surface);
  const unsafeExpected = expectedStatusValue !== "ok";
  const demoSignal = hasDemoSignal(testCase);
  const missingProvenanceSignal = hasMissingProvenanceSignal(
    testCase,
    expectedBlockCodeValue,
    modeDecision.actualBlockCode,
  );

  const unsafePropagation = formalSurface && unsafeExpected && modeDecision.actualStatus === "ok";
  const falseTrust = modeDecision.actualStatus === "ok" && (testCase.knownBad || unsafeExpected);
  const falseBlock = expectedStatusValue === "ok" && modeDecision.actualStatus === "blocked";
  const demoLeakage = demoSignal && modeDecision.actualStatus === "ok" && (formalSurface || unsafeExpected);
  const missingProvenanceLeakage = formalSurface && missingProvenanceSignal && modeDecision.actualStatus === "ok";

  return {
    caseId: testCase.caseId,
    category: testCase.category,
    toolId: testCase.toolId,
    surface: testCase.surface,
    knownBad: testCase.knownBad,
    mode,
    expectedStatus: expectedStatusValue,
    actualStatus: modeDecision.actualStatus,
    ...(expectedBlockCodeValue ? { expectedBlockCode: expectedBlockCodeValue } : {}),
    ...(modeDecision.actualBlockCode ? { actualBlockCode: modeDecision.actualBlockCode } : {}),
    unsafePropagation,
    falseTrust,
    falseBlock,
    demoLeakage,
    missingProvenanceLeakage,
    notes: modeDecision.notes,
  };
}

function labelMap(expectedLabels: readonly TrustBenchmarkExpectedLabel[]): Map<string, TrustBenchmarkExpectedLabel> {
  const labels = new Map<string, TrustBenchmarkExpectedLabel>();
  for (const label of expectedLabels) {
    if (labels.has(label.caseId)) {
      throw new Error(`Duplicate expected label for ${label.caseId}`);
    }
    labels.set(label.caseId, label);
  }
  return labels;
}

function blockCodeForComparison(value: string | null | undefined): string {
  return value ?? "";
}

export function validateExpectedLabelsForBenchmarkCases(
  cases: readonly TrustBenchmarkMetricCase[],
  expectedLabels: readonly TrustBenchmarkExpectedLabel[],
): void {
  const labelsById = labelMap(expectedLabels);
  const caseIds = new Set(cases.map((testCase) => testCase.caseId));
  const errors: string[] = [];

  for (const testCase of cases) {
    const label = labelsById.get(testCase.caseId);
    if (!label) {
      errors.push(`${testCase.caseId}: missing expected label`);
      continue;
    }

    if (label.expectedStatus !== testCase.expected.status) {
      errors.push(`${testCase.caseId}: expectedStatus CSV/JSON mismatch`);
    }
    if (blockCodeForComparison(label.expectedBlockCode) !== blockCodeForComparison(testCase.expected.blockCode)) {
      errors.push(`${testCase.caseId}: expectedBlockCode CSV/JSON mismatch`);
    }
    if (label.category !== testCase.category) {
      errors.push(`${testCase.caseId}: category CSV/JSON mismatch`);
    }
    if (label.toolId !== testCase.toolId) {
      errors.push(`${testCase.caseId}: toolId CSV/JSON mismatch`);
    }
    if (label.surface !== testCase.surface) {
      errors.push(`${testCase.caseId}: surface CSV/JSON mismatch`);
    }
    if (label.knownBad !== testCase.knownBad) {
      errors.push(`${testCase.caseId}: knownBad CSV/JSON mismatch`);
    }
  }

  for (const label of expectedLabels) {
    if (!caseIds.has(label.caseId)) {
      errors.push(`${label.caseId}: expected label has no JSON case`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Public benchmark expected label validation failed:\n${errors.join("\n")}`);
  }
}

export function evaluateCaseForBenchmarkMode(benchmarkCase: unknown, mode: BenchmarkMode): PublicBenchmarkCaseResult {
  return evaluateParsedCaseForBenchmarkMode(parseSingleBenchmarkCase(benchmarkCase), mode);
}

export function evaluateBenchmarkCasesForModes(
  benchmarkCases: readonly unknown[],
  expectedLabels: readonly TrustBenchmarkExpectedLabel[],
  modes: readonly BenchmarkMode[] = BENCHMARK_MODES,
): PublicBenchmarkCaseResult[] {
  const cases = benchmarkCases.map(parseSingleBenchmarkCase);
  validateExpectedLabelsForBenchmarkCases(cases, expectedLabels);
  const labelsById = labelMap(expectedLabels);

  return cases.flatMap((testCase) =>
    modes.map((mode) => evaluateParsedCaseForBenchmarkMode(testCase, mode, labelsById.get(testCase.caseId))),
  );
}
