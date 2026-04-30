/** @jest-environment node */
import type { ClaimSurface, GateStatus, ValidityTier } from '../src/protocol/nexusTrustRuntime';
import {
  evaluateBenchmarkCasesForModes,
  evaluateCaseForBenchmarkMode,
} from '../src/services/publicBenchmarkEvaluator';
import { evaluateClaimSurfacePolicy } from '../src/services/trustPolicyEngine';
import type { TrustBenchmarkExpectedLabel, TrustBenchmarkMetricCase } from '../src/types/trustMetrics';

interface CaseOverrides {
  caseId?: string;
  title?: string;
  category?: string;
  toolId?: string;
  surface?: ClaimSurface;
  validityTier?: ValidityTier;
  hasProvenance?: boolean;
  evidenceState?: TrustBenchmarkMetricCase['input']['evidenceState'];
  uncertaintyState?: TrustBenchmarkMetricCase['input']['uncertaintyState'];
  isDraft?: boolean;
  humanGateRequired?: boolean;
  humanGateSatisfied?: boolean;
  expectedStatus?: GateStatus;
  expectedBlockCode?: string | null;
  riskTags?: string[];
  knownBad?: boolean;
}

function makeCase(overrides: CaseOverrides = {}): TrustBenchmarkMetricCase {
  return {
    caseId: overrides.caseId ?? 'PB-001',
    title: overrides.title ?? 'Public benchmark fixture',
    category: overrides.category ?? 'truthful-partial',
    toolId: overrides.toolId ?? 'pathd',
    surface: overrides.surface ?? 'payload',
    claim: 'Fixture claim for public benchmark testing.',
    input: {
      validityTier: overrides.validityTier ?? 'partial',
      hasProvenance: overrides.hasProvenance ?? true,
      evidenceState: overrides.evidenceState ?? 'present',
      uncertaintyState: overrides.uncertaintyState ?? 'bounded',
      isDraft: overrides.isDraft ?? false,
      humanGateRequired: overrides.humanGateRequired ?? false,
      humanGateSatisfied: overrides.humanGateSatisfied ?? false,
      notes: 'Fixture only.',
    },
    expected: {
      status: overrides.expectedStatus ?? 'ok',
      blockCode: overrides.expectedBlockCode ?? null,
      rationale: 'Fixture rationale.',
    },
    riskTags: overrides.riskTags ?? ['truthful-partial'],
    knownBad: overrides.knownBad ?? false,
  };
}

function labelFor(testCase: TrustBenchmarkMetricCase): TrustBenchmarkExpectedLabel {
  return {
    caseId: testCase.caseId,
    expectedStatus: testCase.expected.status,
    expectedBlockCode: testCase.expected.blockCode,
    category: testCase.category,
    toolId: testCase.toolId,
    surface: testCase.surface,
    knownBad: testCase.knownBad,
  };
}

describe('public benchmark evaluator', () => {
  it('allows every case through in no-gating mode', () => {
    const testCase = makeCase({
      caseId: 'PB-NO-GATE',
      surface: 'export',
      hasProvenance: false,
      expectedStatus: 'blocked',
      expectedBlockCode: 'PROVENANCE_REQUIRED',
      riskTags: ['missing-provenance-export'],
    });

    const result = evaluateCaseForBenchmarkMode(testCase, 'no-gating');

    expect(result.actualStatus).toBe('ok');
    expect(result.actualBlockCode).toBeUndefined();
    expect(result.unsafePropagation).toBe(true);
    expect(result.falseTrust).toBe(true);
  });

  it('allows every case through in badge-only mode while preserving warning notes', () => {
    const testCase = makeCase({
      caseId: 'PB-BADGE',
      surface: 'protocol',
      validityTier: 'demo',
      expectedStatus: 'blocked',
      expectedBlockCode: 'DEMO_OUTPUT_PROTOCOL_BLOCKED',
      riskTags: ['unsafe-demo'],
    });

    const result = evaluateCaseForBenchmarkMode(testCase, 'badge-only');

    expect(result.actualStatus).toBe('ok');
    expect(result.notes).toContain('Badge-only baseline');
    expect(result.demoLeakage).toBe(true);
  });

  it('matches runtime-gating decisions to the existing policy engine', () => {
    const testCase = makeCase({
      caseId: 'PB-RUNTIME',
      surface: 'export',
      hasProvenance: false,
      expectedStatus: 'blocked',
      expectedBlockCode: 'PROVENANCE_REQUIRED',
      riskTags: ['missing-provenance-export'],
    });

    const result = evaluateCaseForBenchmarkMode(testCase, 'runtime-gating');
    const decision = evaluateClaimSurfacePolicy({
      toolId: testCase.toolId,
      surface: testCase.surface,
      validityTier: testCase.input.validityTier,
      isDraft: testCase.input.isDraft,
      provenanceIds: [],
      evidenceIds: [`${testCase.caseId}:evidence`],
      assumptionIds: testCase.riskTags,
      requiresHumanGate: testCase.input.humanGateRequired,
      humanGateStatus: 'not-required',
    });

    expect(result.actualStatus).toBe(decision.status);
    expect(result.actualBlockCode).toBe(decision.blockCode);
    expect(result.actualStatus).toBe('blocked');
    expect(result.actualBlockCode).toBe('PROVENANCE_REQUIRED');
  });

  it('marks known-bad blocked-by-runtime cases as unsafe only in allow-through baselines', () => {
    const testCase = makeCase({
      caseId: 'PB-KNOWN-BAD',
      category: 'known-bad-case',
      toolId: 'multio',
      surface: 'external-handoff',
      validityTier: 'demo',
      expectedStatus: 'blocked',
      expectedBlockCode: 'EXTERNAL_HANDOFF_BLOCKED',
      riskTags: ['known-bad', 'demo-multio-external-handoff'],
      knownBad: true,
      humanGateRequired: true,
      humanGateSatisfied: true,
    });

    const noGating = evaluateCaseForBenchmarkMode(testCase, 'no-gating');
    const runtime = evaluateCaseForBenchmarkMode(testCase, 'runtime-gating');

    expect(noGating.unsafePropagation).toBe(true);
    expect(noGating.falseTrust).toBe(true);
    expect(runtime.actualStatus).toBe('blocked');
    expect(runtime.unsafePropagation).toBe(false);
    expect(runtime.falseTrust).toBe(false);
  });

  it('counts demo leakage when demo formal-surface cases are allowed', () => {
    const testCase = makeCase({
      caseId: 'PB-DEMO',
      category: 'unsafe-demo',
      toolId: 'cellfree',
      surface: 'protocol',
      validityTier: 'demo',
      expectedStatus: 'blocked',
      expectedBlockCode: 'DEMO_OUTPUT_PROTOCOL_BLOCKED',
      riskTags: ['unsafe-demo', 'cellfree-demo'],
      humanGateRequired: true,
      humanGateSatisfied: true,
    });

    const noGating = evaluateCaseForBenchmarkMode(testCase, 'no-gating');
    const badgeOnly = evaluateCaseForBenchmarkMode(testCase, 'badge-only');

    expect(noGating.demoLeakage).toBe(true);
    expect(badgeOnly.demoLeakage).toBe(true);
  });

  it('counts missing provenance leakage when missing provenance reaches a formal surface', () => {
    const testCase = makeCase({
      caseId: 'PB-MISSING-PROV',
      surface: 'recommendation',
      hasProvenance: false,
      expectedStatus: 'blocked',
      expectedBlockCode: 'PROVENANCE_REQUIRED',
      riskTags: ['missing-provenance'],
    });

    const result = evaluateCaseForBenchmarkMode(testCase, 'badge-only');

    expect(result.missingProvenanceLeakage).toBe(true);
  });

  it('detects false blocks when an expected-ok case is blocked by runtime', () => {
    const testCase = makeCase({
      caseId: 'PB-FALSE-BLOCK',
      surface: 'export',
      hasProvenance: false,
      expectedStatus: 'ok',
      expectedBlockCode: null,
      riskTags: ['truthful-partial'],
    });

    const result = evaluateCaseForBenchmarkMode(testCase, 'runtime-gating');

    expect(result.actualStatus).toBe('blocked');
    expect(result.falseBlock).toBe(true);
  });

  it('does not fabricate reviewer calibration or time-to-decision values', () => {
    const result = evaluateCaseForBenchmarkMode(makeCase(), 'runtime-gating');

    expect(result.reviewerCalibrationScore).toBeUndefined();
    expect(result.timeToSafeDecisionMs).toBeUndefined();
  });

  it('validates expected labels before batch evaluation', () => {
    const testCase = makeCase({ caseId: 'PB-LABEL' });
    const badLabel = {
      ...labelFor(testCase),
      expectedStatus: 'blocked' as const,
    };

    expect(() => evaluateBenchmarkCasesForModes([testCase], [badLabel]))
      .toThrow('expectedStatus CSV/JSON mismatch');
  });
});
