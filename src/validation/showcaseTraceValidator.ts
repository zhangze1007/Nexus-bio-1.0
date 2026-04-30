import {
  CLAIM_SURFACES,
  GATE_STATUSES,
  VALIDITY_TIERS,
  type ClaimSurface,
  type GateStatus,
  type ValidityTier,
} from '../protocol/nexusTrustRuntime';
import type {
  BlockedShowcaseTrace,
  ShowcaseTrace,
  ShowcaseTraceDocument,
  ShowcaseTraceStep,
} from '../types/showcaseTrace';

export interface ShowcaseTraceValidationIssue {
  field: string;
  message: string;
}

export interface ShowcaseTraceValidationResult {
  ok: boolean;
  issues: ShowcaseTraceValidationIssue[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isClaimSurface(value: unknown): value is ClaimSurface {
  return typeof value === 'string' && CLAIM_SURFACES.includes(value as ClaimSurface);
}

function isValidityTier(value: unknown): value is ValidityTier {
  return typeof value === 'string' && VALIDITY_TIERS.includes(value as ValidityTier);
}

function isGateStatus(value: unknown): value is GateStatus {
  return typeof value === 'string' && GATE_STATUSES.includes(value as GateStatus);
}

function pushIssue(
  issues: ShowcaseTraceValidationIssue[],
  field: string,
  message: string,
): void {
  issues.push({ field, message });
}

function validateStep(
  value: unknown,
  field: string,
  issues: ShowcaseTraceValidationIssue[],
): void {
  if (!isRecord(value)) {
    pushIssue(issues, field, 'step must be an object');
    return;
  }

  if (typeof value.stepId !== 'string' || value.stepId.length === 0) {
    pushIssue(issues, `${field}.stepId`, 'stepId is required');
  }
  if (typeof value.toolId !== 'string' || value.toolId.length === 0) {
    pushIssue(issues, `${field}.toolId`, 'toolId is required');
  }
  if (!isClaimSurface(value.surface)) {
    pushIssue(issues, `${field}.surface`, 'surface must be a known claim surface');
  }
  if (!isValidityTier(value.validityTier)) {
    pushIssue(issues, `${field}.validityTier`, 'validityTier must be real, partial, or demo');
  }
  if (!isStringArray(value.assumptionIds)) {
    pushIssue(issues, `${field}.assumptionIds`, 'assumptionIds must be an array of strings');
  }
  if (!isStringArray(value.evidenceIds)) {
    pushIssue(issues, `${field}.evidenceIds`, 'evidenceIds must be an array of strings');
  }
  if (!isStringArray(value.provenanceIds)) {
    pushIssue(issues, `${field}.provenanceIds`, 'provenanceIds must be an array of strings');
  }
  if (!isGateStatus(value.expectedGateStatus)) {
    pushIssue(issues, `${field}.expectedGateStatus`, 'expectedGateStatus must be a known gate status');
  }
  if (value.expectedBlockCode !== undefined && typeof value.expectedBlockCode !== 'string') {
    pushIssue(issues, `${field}.expectedBlockCode`, 'expectedBlockCode must be a string when present');
  }
}

function validateCommonFields(
  value: Record<string, unknown>,
  issues: ShowcaseTraceValidationIssue[],
): void {
  if (typeof value.showcaseId !== 'string' || value.showcaseId.length === 0) {
    pushIssue(issues, 'showcaseId', 'showcaseId is required');
  }
  if (typeof value.title !== 'string' || value.title.length === 0) {
    pushIssue(issues, 'title', 'title is required');
  }
  if (typeof value.claim !== 'string' || value.claim.length === 0) {
    pushIssue(issues, 'claim', 'claim is required');
  }
  if (!isStringArray(value.nonClaims) || value.nonClaims.length === 0) {
    pushIssue(issues, 'nonClaims', 'nonClaims must be a non-empty string array');
  }
}

export function validateShowcaseTraceDocument(
  value: unknown,
): ShowcaseTraceValidationResult {
  const issues: ShowcaseTraceValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [{ field: '<root>', message: 'showcase trace document must be an object' }],
    };
  }

  validateCommonFields(value, issues);

  if (Array.isArray(value.steps)) {
    if (value.steps.length === 0) {
      pushIssue(issues, 'steps', 'steps must not be empty');
    }
    value.steps.forEach((step, index) => validateStep(step, `steps[${index}]`, issues));
  } else if (value.blockedStep !== undefined) {
    validateStep(value.blockedStep, 'blockedStep', issues);
    if (typeof value.reason !== 'string' || value.reason.length === 0) {
      pushIssue(issues, 'reason', 'reason is required for blocked showcase traces');
    }
  } else {
    pushIssue(issues, 'steps', 'document must include steps or blockedStep');
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

function parseStep(value: unknown): ShowcaseTraceStep {
  if (!isRecord(value)) throw new Error('Invalid showcase trace step');
  if (
    typeof value.stepId !== 'string'
    || typeof value.toolId !== 'string'
    || !isClaimSurface(value.surface)
    || !isValidityTier(value.validityTier)
    || !isStringArray(value.assumptionIds)
    || !isStringArray(value.evidenceIds)
    || !isStringArray(value.provenanceIds)
    || !isGateStatus(value.expectedGateStatus)
  ) {
    throw new Error('Invalid showcase trace step');
  }

  return {
    stepId: value.stepId,
    toolId: value.toolId,
    surface: value.surface,
    validityTier: value.validityTier,
    assumptionIds: value.assumptionIds,
    evidenceIds: value.evidenceIds,
    provenanceIds: value.provenanceIds,
    expectedGateStatus: value.expectedGateStatus,
    ...(typeof value.expectedBlockCode === 'string' ? { expectedBlockCode: value.expectedBlockCode } : {}),
    ...(typeof value.note === 'string' ? { note: value.note } : {}),
  };
}

export function parseShowcaseTraceDocument(value: unknown): ShowcaseTraceDocument {
  const validation = validateShowcaseTraceDocument(value);
  if (!validation.ok || !isRecord(value)) {
    const message = validation.issues.map((issue) => `${issue.field}: ${issue.message}`).join('; ');
    throw new Error(`Invalid showcase trace document: ${message}`);
  }

  if (Array.isArray(value.steps)) {
    return {
      showcaseId: String(value.showcaseId),
      title: String(value.title),
      pathway: typeof value.pathway === 'string' ? value.pathway : 'unspecified',
      claim: String(value.claim),
      steps: value.steps.map(parseStep),
      nonClaims: value.nonClaims as string[],
    } satisfies ShowcaseTrace;
  }

  return {
    showcaseId: String(value.showcaseId),
    title: String(value.title),
    ...(typeof value.pathway === 'string' ? { pathway: value.pathway } : {}),
    claim: String(value.claim),
    blockedStep: parseStep(value.blockedStep),
    reason: String(value.reason),
    nonClaims: value.nonClaims as string[],
  } satisfies BlockedShowcaseTrace;
}

export function showcaseSteps(document: ShowcaseTraceDocument): ShowcaseTraceStep[] {
  return 'steps' in document ? document.steps : [document.blockedStep];
}
