import type { ProvenanceEntry } from '../types/assumptions';
import type { WorkbenchPayloadBase } from '../store/workbenchPayloads';
import { TOOL_ASSUMPTIONS } from '../components/tools/shared/toolAssumptions';
import { TOOL_VALIDITY, type ValidityLevel } from '../components/tools/shared/toolValidity';

export type RuntimeGatingSeverity = 'allow' | 'warn' | 'block';

export interface RuntimeGatingDecision {
  allowed: boolean;
  severity: RuntimeGatingSeverity;
  reason: string;
  blockingAssumptionIds: string[];
  sourceValidity: ValidityLevel | 'unknown';
  targetValidity: ValidityLevel | 'unknown';
  sourceToolId: string | null;
  targetToolId: string;
}

export interface PayloadTrustState {
  trusted: boolean;
  reason: string;
  sourceToolId: string | null;
  sourceValidity: ValidityLevel | 'unknown';
  provenance: ProvenanceEntry | null;
  outputAssumptionIds: string[];
  blockingAssumptionIds: string[];
  warningAssumptionIds: string[];
}

type RuntimePayload = Partial<WorkbenchPayloadBase> & {
  toolId?: string;
};

const SUB_TOOL_VALIDITY: Record<string, ValidityLevel> = {
  'fbasim-single': 'partial',
  'fbasim-community': 'demo',
};

const ASSUMPTION_BY_ID = Object.values(TOOL_ASSUMPTIONS)
  .flat()
  .reduce<Record<string, { severity: 'info' | 'warning' | 'blocking' }>>((acc, assumption) => {
    acc[assumption.id] = { severity: assumption.severity };
    return acc;
  }, {});

function resolveToolValidity(toolId?: string | null): ValidityLevel | 'unknown' {
  if (!toolId) return 'unknown';
  return SUB_TOOL_VALIDITY[toolId] ?? TOOL_VALIDITY[toolId]?.level ?? 'unknown';
}

function resolveSourceValidity(payload: RuntimePayload): ValidityLevel | 'unknown' {
  return payload.runProvenance?.validityTier ?? payload.validity ?? resolveToolValidity(payload.toolId);
}

function assumptionIdsBySeverity(ids: string[], severity: 'warning' | 'blocking') {
  return ids.filter((id) => ASSUMPTION_BY_ID[id]?.severity === severity);
}

export function collectBlockingAssumptions(payload: RuntimePayload | null | undefined): string[] {
  const ids = payload?.runProvenance?.outputAssumptions ?? [];
  return assumptionIdsBySeverity(ids, 'blocking');
}

export function getPayloadTrustState(payload: RuntimePayload | null | undefined): PayloadTrustState {
  if (!payload) {
    return {
      trusted: false,
      reason: 'No source payload is available.',
      sourceToolId: null,
      sourceValidity: 'unknown',
      provenance: null,
      outputAssumptionIds: [],
      blockingAssumptionIds: [],
      warningAssumptionIds: [],
    };
  }

  const provenance = payload.runProvenance ?? null;
  const outputAssumptionIds = provenance?.outputAssumptions ?? [];
  const sourceToolId = provenance?.toolId ?? payload.toolId ?? null;
  const sourceValidity = resolveSourceValidity(payload);
  const blockingAssumptionIds = assumptionIdsBySeverity(outputAssumptionIds, 'blocking');
  const warningAssumptionIds = assumptionIdsBySeverity(outputAssumptionIds, 'warning');

  if (!provenance) {
    return {
      trusted: false,
      reason: 'Source payload has no runProvenance snapshot.',
      sourceToolId,
      sourceValidity,
      provenance: null,
      outputAssumptionIds,
      blockingAssumptionIds,
      warningAssumptionIds,
    };
  }

  return {
    trusted: true,
    reason: 'Source payload includes runProvenance.',
    sourceToolId,
    sourceValidity,
    provenance,
    outputAssumptionIds,
    blockingAssumptionIds,
    warningAssumptionIds,
  };
}

export function canPassToDownstream(
  sourcePayload: RuntimePayload | null | undefined,
  targetToolId: string,
): RuntimeGatingDecision {
  const trustState = getPayloadTrustState(sourcePayload);
  const targetValidity = resolveToolValidity(targetToolId);
  const sourceValidity = trustState.sourceValidity;
  const targetIsDemo = targetValidity === 'demo';
  const targetIsPartialOrReal = targetValidity === 'partial' || targetValidity === 'real';

  if (!trustState.trusted) {
    return {
      allowed: false,
      severity: 'block',
      reason: `${trustState.reason} Runtime provenance is required before ${targetToolId.toUpperCase()} can consume this output.`,
      blockingAssumptionIds: trustState.blockingAssumptionIds,
      sourceValidity,
      targetValidity,
      sourceToolId: trustState.sourceToolId,
      targetToolId,
    };
  }

  if (sourceValidity === 'demo' && targetIsDemo) {
    return {
      allowed: true,
      severity: 'warn',
      reason: 'Demo-only chain allowed. Outputs must remain labelled as demonstration data and must not be used as evidence.',
      blockingAssumptionIds: trustState.blockingAssumptionIds,
      sourceValidity,
      targetValidity,
      sourceToolId: trustState.sourceToolId,
      targetToolId,
    };
  }

  if (sourceValidity === 'demo' && targetIsPartialOrReal) {
    return {
      allowed: false,
      severity: 'block',
      reason: `Demo output cannot feed ${targetValidity} downstream inference.`,
      blockingAssumptionIds: trustState.blockingAssumptionIds,
      sourceValidity,
      targetValidity,
      sourceToolId: trustState.sourceToolId,
      targetToolId,
    };
  }

  if (targetValidity === 'real' && trustState.blockingAssumptionIds.length > 0) {
    return {
      allowed: false,
      severity: 'block',
      reason: 'Blocking assumptions prevent this output from being treated as real evidence.',
      blockingAssumptionIds: trustState.blockingAssumptionIds,
      sourceValidity,
      targetValidity,
      sourceToolId: trustState.sourceToolId,
      targetToolId,
    };
  }

  if (targetValidity === 'partial' && trustState.blockingAssumptionIds.length > 0) {
    return {
      allowed: false,
      severity: 'block',
      reason: 'Blocking assumptions prevent this output from feeding partial downstream inference.',
      blockingAssumptionIds: trustState.blockingAssumptionIds,
      sourceValidity,
      targetValidity,
      sourceToolId: trustState.sourceToolId,
      targetToolId,
    };
  }

  if (trustState.warningAssumptionIds.length > 0 || sourceValidity === 'partial' || targetValidity === 'partial') {
    return {
      allowed: true,
      severity: 'warn',
      reason: 'Allowed with caution. Runtime provenance is present, but warning assumptions or partial-tier limits remain.',
      blockingAssumptionIds: trustState.blockingAssumptionIds,
      sourceValidity,
      targetValidity,
      sourceToolId: trustState.sourceToolId,
      targetToolId,
    };
  }

  return {
    allowed: true,
    severity: 'allow',
    reason: 'Allowed. Runtime provenance is present and no blocking assumptions are attached.',
    blockingAssumptionIds: [],
    sourceValidity,
    targetValidity,
    sourceToolId: trustState.sourceToolId,
    targetToolId,
  };
}

export function explainGatingDecision(sourcePayload: RuntimePayload | null | undefined, targetToolId: string): string {
  return canPassToDownstream(sourcePayload, targetToolId).reason;
}
