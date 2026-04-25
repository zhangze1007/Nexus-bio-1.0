import {
  meetsValidityFloor,
  type EvidenceSourceKind,
  type ToolContract,
  type ValidityFloor,
} from '../domain/workflowContract';
import type { WorkflowToolStatus } from './workflowStateMachine';

export interface WorkflowContractEvaluation {
  status: WorkflowToolStatus;
  validityOk: boolean;
  confidenceOk: boolean;
  uncertaintyOk: boolean;
  evidenceOk: boolean;
  isSimulated: boolean;
  missingOutputPaths: string[];
  missingEvidenceKinds: EvidenceSourceKind[];
  reasonCodes: string[];
  reason: string;
}

export interface WorkflowContractEvaluationOptions {
  evidence?: Array<{ sourceKind?: EvidenceSourceKind | string }>;
  projectIsDemo?: boolean;
}

function readPath(value: unknown, path: string): unknown {
  let cursor = value;
  for (const key of path.split('.')) {
    if (!cursor || typeof cursor !== 'object' || !(key in cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}

function numericPolicyValue(payload: unknown, sourceField: string | null): number | null {
  if (!sourceField) return null;
  const value = readPath(payload, sourceField);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return null;
}

function inferSimulation(payload: unknown, projectIsDemo: boolean): boolean {
  if (projectIsDemo) return true;
  if (!payload || typeof payload !== 'object') return true;
  const record = payload as Record<string, unknown>;
  if (record.validity === 'demo') return true;
  const result = record.result;
  if (result && typeof result === 'object') {
    const mode = (result as Record<string, unknown>).mode;
    if (mode === 'mock' || mode === 'idle') return true;
  }
  return false;
}

function reason(parts: string[]) {
  return parts.join('; ');
}

export function evaluateToolContract(
  contract: ToolContract,
  payload: unknown,
  options: WorkflowContractEvaluationOptions = {},
): WorkflowContractEvaluation {
  const validity =
    payload && typeof payload === 'object'
      ? ((payload as { validity?: ValidityFloor }).validity ?? null)
      : null;
  const confidence = numericPolicyValue(payload, contract.confidencePolicy.sourceField);
  const uncertainty = numericPolicyValue(payload, contract.uncertaintyPolicy.sourceField);
  const missingOutputPaths = contract.outputArtifacts
    .filter((ref) => ref.required)
    .filter((ref) => !isPresent(readPath(payload, ref.payloadPath)))
    .map((ref) => ref.payloadPath);
  const validityOk =
    validity !== null && meetsValidityFloor(validity, contract.validityBaseline.floor);
  const confidenceOk =
    contract.confidencePolicy.minToAdvance === null ||
    (confidence !== null && confidence >= contract.confidencePolicy.minToAdvance);
  const uncertaintyOk =
    !contract.uncertaintyPolicy.unboundedIsGate || uncertainty !== null;
  const evidence = options.evidence ?? [];
  const haveKinds = new Set(
    evidence
      .map((item) => item.sourceKind)
      .filter((kind): kind is EvidenceSourceKind =>
        kind === 'literature' || kind === 'analysis' || kind === 'tool' || kind === 'system',
      ),
  );
  const missingEvidenceKinds = contract.evidenceRequired.kinds.filter((kind) => !haveKinds.has(kind));
  const evidenceOk =
    evidence.length >= contract.evidenceRequired.minItems && missingEvidenceKinds.length === 0;
  const isSimulated = inferSimulation(payload, Boolean(options.projectIsDemo));
  const reasonCodes: string[] = [];
  const reasons: string[] = [];

  if (missingOutputPaths.length) {
    reasonCodes.push('REQUIRED_OUTPUTS_MISSING');
    reasons.push(`required outputs missing: ${missingOutputPaths.join(', ')}`);
  }
  if (!validityOk) {
    reasonCodes.push('VALIDITY_BELOW_FLOOR');
    reasons.push(
      validity
        ? `validity ${validity} below floor ${contract.validityBaseline.floor}`
        : `validity missing; floor ${contract.validityBaseline.floor}`,
    );
  }
  if (!confidenceOk) {
    reasonCodes.push('CONFIDENCE_BELOW_FLOOR');
    reasons.push(`confidence below ${contract.confidencePolicy.minToAdvance}`);
  }
  if (!uncertaintyOk) {
    reasonCodes.push('UNCERTAINTY_UNBOUNDED');
    reasons.push('uncertainty gate unresolved');
  }
  if (!evidenceOk) {
    reasonCodes.push('EVIDENCE_MISSING');
    reasons.push(
      `evidence ${evidence.length}/${contract.evidenceRequired.minItems}${
        missingEvidenceKinds.length ? `; missing ${missingEvidenceKinds.join(', ')}` : ''
      }`,
    );
  }
  if (isSimulated) {
    reasonCodes.push('SIMULATED_OUTPUT');
    reasons.push('payload is demo/simulated');
  }

  return {
    status: {
      validity,
      confidence,
      uncertainty,
      hasRequiredOutputs: missingOutputPaths.length === 0,
      missingOutputPaths,
      isSimulated,
    },
    validityOk,
    confidenceOk,
    uncertaintyOk,
    evidenceOk,
    isSimulated,
    missingOutputPaths,
    missingEvidenceKinds,
    reasonCodes,
    reason: reason(reasons),
  };
}

