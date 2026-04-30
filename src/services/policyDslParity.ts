import trustPolicyDocument from '../../policy/trust-policy-v1.json';
import type { ClaimSurface, ValidityTier } from '../protocol/nexusTrustRuntime';
import {
  evaluateClaimSurfacePolicy,
  type HumanGateStatus,
} from './trustPolicyEngine';
import {
  evaluatePolicyDsl,
  type PolicyDslEvaluationInput,
} from './policyDslEvaluator';

export interface PolicyDslParityResult {
  caseId: string;
  runtimeStatus: string;
  dslStatus: string;
  runtimeBlockCode?: string;
  dslBlockCode?: string;
  matches: boolean;
}

interface ParsedParityInput {
  caseId: string;
  input: PolicyDslEvaluationInput;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function booleanField(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function isHumanGateStatus(value: unknown): value is HumanGateStatus {
  return (
    value === 'not-required'
    || value === 'pending'
    || value === 'approved'
    || value === 'rejected'
  );
}

function benchmarkHumanGateStatus(input: Record<string, unknown>): HumanGateStatus {
  if (isHumanGateStatus(input.humanGateStatus)) return input.humanGateStatus;
  if (input.humanGateRequired !== true) return 'not-required';
  return input.humanGateSatisfied === true ? 'approved' : 'pending';
}

function directHumanGateStatus(input: Record<string, unknown>): HumanGateStatus | undefined {
  return isHumanGateStatus(input.humanGateStatus) ? input.humanGateStatus : undefined;
}

function benchmarkProvenanceIds(caseId: string, input: Record<string, unknown>): string[] {
  return input.hasProvenance === true ? [`${caseId}:provenance`] : [];
}

function benchmarkEvidenceIds(caseId: string, input: Record<string, unknown>): string[] {
  return input.evidenceState === 'present' ? [`${caseId}:evidence`] : [];
}

function parsedInputFromBenchmarkCase(
  value: Record<string, unknown>,
  index: number,
): ParsedParityInput | null {
  if (!isRecord(value.input)) return null;

  const caseId = stringField(value.caseId) ?? `case-${index + 1}`;
  const toolId = stringField(value.toolId);
  const surface = stringField(value.surface);

  if (!toolId || !surface) return null;

  return {
    caseId,
    input: {
      toolId,
      surface: surface as ClaimSurface,
      ...(typeof value.input.validityTier === 'string'
        ? { validityTier: value.input.validityTier as ValidityTier }
        : {}),
      isDraft: value.input.isDraft === true,
      provenanceIds: benchmarkProvenanceIds(caseId, value.input),
      evidenceIds: benchmarkEvidenceIds(caseId, value.input),
      assumptionIds: stringArray(value.riskTags),
      requiresHumanGate: value.input.humanGateRequired === true,
      humanGateStatus: benchmarkHumanGateStatus(value.input),
    },
  };
}

function parsedInputFromDirectCase(
  value: Record<string, unknown>,
  index: number,
): ParsedParityInput | null {
  const toolId = stringField(value.toolId);
  const surface = stringField(value.surface);

  if (!toolId || !surface) return null;

  const caseId = stringField(value.caseId) ?? `case-${index + 1}`;
  const humanGateStatus = directHumanGateStatus(value);

  return {
    caseId,
    input: {
      toolId,
      surface: surface as ClaimSurface,
      ...(typeof value.validityTier === 'string'
        ? { validityTier: value.validityTier as ValidityTier }
        : {}),
      ...(booleanField(value.isDraft) !== undefined ? { isDraft: booleanField(value.isDraft) } : {}),
      provenanceIds: stringArray(value.provenanceIds),
      evidenceIds: stringArray(value.evidenceIds),
      assumptionIds: stringArray(value.assumptionIds),
      ...(booleanField(value.requiresHumanGate) !== undefined
        ? { requiresHumanGate: booleanField(value.requiresHumanGate) }
        : {}),
      ...(humanGateStatus ? { humanGateStatus } : {}),
    },
  };
}

function parsedParityInput(value: unknown, index: number): ParsedParityInput | null {
  if (!isRecord(value)) return null;
  return parsedInputFromBenchmarkCase(value, index) ?? parsedInputFromDirectCase(value, index);
}

function blockCodeForCompare(value: string | undefined): string {
  return value ?? '';
}

export function comparePolicyDslWithRuntimeEngine(
  inputCases: unknown[],
  policy: unknown = trustPolicyDocument,
): PolicyDslParityResult[] {
  return inputCases.map((inputCase, index) => {
    const parsed = parsedParityInput(inputCase, index);

    if (!parsed) {
      return {
        caseId: `case-${index + 1}`,
        runtimeStatus: 'invalid-input',
        dslStatus: 'invalid-input',
        matches: false,
      };
    }

    const runtimeDecision = evaluateClaimSurfacePolicy(parsed.input);
    const dslDecision = evaluatePolicyDsl(policy, parsed.input);
    const matches = (
      runtimeDecision.status === dslDecision.status
      && blockCodeForCompare(runtimeDecision.blockCode) === blockCodeForCompare(dslDecision.blockCode)
    );

    return {
      caseId: parsed.caseId,
      runtimeStatus: runtimeDecision.status,
      dslStatus: dslDecision.status,
      ...(runtimeDecision.blockCode ? { runtimeBlockCode: runtimeDecision.blockCode } : {}),
      ...(dslDecision.blockCode ? { dslBlockCode: dslDecision.blockCode } : {}),
      matches,
    };
  });
}
