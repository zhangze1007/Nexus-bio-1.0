import type {
  ClaimSurface,
  GateDecision,
  GateOverridePath,
  GateStatus,
  ValidityTier,
} from '../protocol/nexusTrustRuntime';
import { getClaimSurfacePolicy } from '../domain/claimSurfacePolicies';
import type { ClaimSurfaceBlockCode } from '../domain/claimSurfacePolicy';

export type HumanGateStatus = 'not-required' | 'pending' | 'approved' | 'rejected';

export interface EvaluateClaimSurfacePolicyInput {
  toolId: string;
  surface: ClaimSurface;
  validityTier?: ValidityTier;
  isDraft?: boolean;
  provenanceIds?: string[];
  evidenceIds?: string[];
  assumptionIds?: string[];
  requiresHumanGate?: boolean;
  humanGateStatus?: HumanGateStatus;
}

interface DecisionArgs {
  status: GateStatus;
  surface: ClaimSurface;
  reason: string;
  blockCode?: ClaimSurfaceBlockCode;
  overridePath?: GateOverridePath;
}

function hasItems(items: string[] | undefined): boolean {
  return Array.isArray(items) && items.length > 0;
}

function decision(args: DecisionArgs): GateDecision {
  const surfaceList = [args.surface];
  const isAllowed = args.status === 'ok' || args.status === 'demoOnly';

  return {
    status: args.status,
    ...(args.blockCode ? { blockCode: args.blockCode } : {}),
    reason: args.reason,
    allowedSurfaces: isAllowed ? surfaceList : [],
    blockedSurfaces: isAllowed ? [] : surfaceList,
    ...(args.overridePath ? { overridePath: args.overridePath } : {}),
  };
}

function tierBlockCode(
  validityTier: ValidityTier,
  surface: ClaimSurface,
): ClaimSurfaceBlockCode {
  if (validityTier === 'demo' && surface === 'protocol') return 'DEMO_OUTPUT_PROTOCOL_BLOCKED';
  if (validityTier === 'demo' && surface === 'external-handoff') return 'EXTERNAL_HANDOFF_BLOCKED';
  return 'TIER_NOT_ALLOWED_FOR_SURFACE';
}

export function evaluateClaimSurfacePolicy(
  input: EvaluateClaimSurfacePolicyInput,
): GateDecision {
  const policy = getClaimSurfacePolicy(input.toolId, input.surface);

  if (!policy) {
    return decision({
      status: 'blocked',
      surface: input.surface,
      blockCode: 'MISSING_POLICY',
      reason: `No claim-surface policy is defined for ${input.toolId} on ${input.surface}.`,
      overridePath: 'not-allowed',
    });
  }

  if (!input.validityTier) {
    return decision({
      status: 'blocked',
      surface: input.surface,
      blockCode: 'TIER_NOT_ALLOWED_FOR_SURFACE',
      reason:
        `A validity tier is required before ${input.toolId} output can be evaluated for ${input.surface}.`,
      overridePath: 'not-allowed',
    });
  }

  if (input.isDraft === true && policy.denyIfDraft === true) {
    return decision({
      status: 'blocked',
      surface: input.surface,
      blockCode: 'DRAFT_OUTPUT_NOT_EXPORTABLE',
      reason:
        `${input.toolId} output is still draft and ${input.surface} requires a finalized artifact.`,
      overridePath: 'human-review',
    });
  }

  if (!policy.allowedTiers.includes(input.validityTier)) {
    const blockCode = tierBlockCode(input.validityTier, input.surface);
    return decision({
      status: 'blocked',
      surface: input.surface,
      blockCode,
      reason:
        `${input.validityTier} output from ${input.toolId} is not allowed on ${input.surface}.`,
      overridePath: 'not-allowed',
    });
  }

  if (policy.requiresProvenance && !hasItems(input.provenanceIds)) {
    return decision({
      status: 'blocked',
      surface: input.surface,
      blockCode: 'PROVENANCE_REQUIRED',
      reason:
        `${input.surface} consumption for ${input.toolId} requires provenance before the claim can be used.`,
      overridePath: 'human-review',
    });
  }

  const humanGateRequired = policy.requiresHumanGate === true || input.requiresHumanGate === true;
  const humanGateStatus = input.humanGateStatus ?? (humanGateRequired ? 'pending' : 'not-required');

  if (humanGateRequired && humanGateStatus !== 'approved') {
    if (humanGateStatus === 'rejected') {
      return decision({
        status: 'blocked',
        surface: input.surface,
        blockCode: 'HUMAN_GATE_REQUIRED',
        reason:
          `Human review rejected ${input.toolId} output for ${input.surface}.`,
        overridePath: 'not-allowed',
      });
    }

    return decision({
      status: 'gated',
      surface: input.surface,
      blockCode: 'HUMAN_GATE_REQUIRED',
      reason:
        `${input.surface} consumption for ${input.toolId} requires approved human review.`,
      overridePath: 'human-review',
    });
  }

  if (input.validityTier === 'demo') {
    return decision({
      status: 'demoOnly',
      surface: input.surface,
      reason:
        `${input.toolId} output is allowed on ${input.surface} only as demo or exploratory context.`,
    });
  }

  return decision({
    status: 'ok',
    surface: input.surface,
    reason:
      `${input.toolId} output satisfies the ${input.surface} claim-surface policy.`,
  });
}
