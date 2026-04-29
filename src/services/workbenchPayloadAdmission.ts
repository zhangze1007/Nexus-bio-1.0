import type { ClaimSurface, GateDecision, ValidityTier } from '../protocol/nexusTrustRuntime';
import {
  evaluateClaimSurfacePolicy,
  type HumanGateStatus,
} from './trustPolicyEngine';

export type WorkbenchPayloadAdmissionMode = 'observe' | 'enforce';

export interface WorkbenchPayloadAdmissionInput {
  toolId: string;
  surface?: ClaimSurface;
  payload: unknown;
  validityTier?: ValidityTier;
  isDraft?: boolean;
  provenanceIds?: string[];
  evidenceIds?: string[];
  assumptionIds?: string[];
  requiresHumanGate?: boolean;
  humanGateStatus?: HumanGateStatus;
  mode?: WorkbenchPayloadAdmissionMode;
}

export interface WorkbenchPayloadAdmissionDecision {
  decision: GateDecision;
  mode: WorkbenchPayloadAdmissionMode;
  shouldWritePayload: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidityTier(value: unknown): value is ValidityTier {
  return value === 'real' || value === 'partial' || value === 'demo';
}

function isHumanGateStatus(value: unknown): value is HumanGateStatus {
  return value === 'not-required' || value === 'pending' || value === 'approved' || value === 'rejected';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function provenanceRecordId(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const toolId = typeof value.toolId === 'string' ? value.toolId : null;
  const timestamp = typeof value.timestamp === 'number' && Number.isFinite(value.timestamp)
    ? value.timestamp
    : null;
  return toolId && timestamp !== null ? `${toolId}:${timestamp}` : null;
}

function evidenceIdsFromProvenance(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.evidence)) return [];
  return value.evidence
    .map((item) => isRecord(item) && typeof item.id === 'string' ? item.id : null)
    .filter((item): item is string => item !== null);
}

export function evaluateWorkbenchPayloadAdmission(
  input: WorkbenchPayloadAdmissionInput,
): WorkbenchPayloadAdmissionDecision {
  const surface = input.surface ?? 'payload';
  const mode = input.mode ?? 'observe';
  const decision = evaluateClaimSurfacePolicy({
    toolId: input.toolId,
    surface,
    validityTier: input.validityTier,
    isDraft: input.isDraft,
    provenanceIds: input.provenanceIds,
    evidenceIds: input.evidenceIds,
    assumptionIds: input.assumptionIds,
    requiresHumanGate: input.requiresHumanGate,
    humanGateStatus: input.humanGateStatus,
  });

  return {
    decision,
    mode,
    shouldWritePayload:
      mode === 'observe'
        ? true
        : decision.status === 'ok' || decision.status === 'demoOnly',
  };
}

export function inferAdmissionInputFromPayload(args: {
  toolId: string;
  payload: unknown;
  fallbackValidityTier?: ValidityTier;
}): Omit<WorkbenchPayloadAdmissionInput, 'mode'> {
  const record = isRecord(args.payload) ? args.payload : {};
  const provenance = record.runProvenance;
  const provenanceId = provenanceRecordId(provenance);
  const provenanceRecord = isRecord(provenance) ? provenance : {};
  const payloadValidity = isValidityTier(record.validity) ? record.validity : undefined;
  const provenanceValidity = isValidityTier(provenanceRecord.validityTier)
    ? provenanceRecord.validityTier
    : undefined;
  const humanGateStatus = isHumanGateStatus(record.humanGateStatus)
    ? record.humanGateStatus
    : typeof record.humanGateApproved === 'boolean'
      ? record.humanGateApproved ? 'approved' : 'pending'
      : undefined;
  const isDraft = typeof record.isDraft === 'boolean'
    ? record.isDraft
    : record.feedbackSource === 'draft';

  return {
    toolId: args.toolId,
    surface: 'payload',
    payload: args.payload,
    validityTier: payloadValidity ?? provenanceValidity ?? args.fallbackValidityTier,
    isDraft,
    provenanceIds: provenanceId ? [provenanceId] : [],
    evidenceIds: evidenceIdsFromProvenance(provenance),
    assumptionIds: [
      ...stringArray(provenanceRecord.inputAssumptions),
      ...stringArray(provenanceRecord.outputAssumptions),
    ],
    requiresHumanGate: typeof record.requiresHumanGate === 'boolean'
      ? record.requiresHumanGate
      : undefined,
    humanGateStatus,
  };
}
