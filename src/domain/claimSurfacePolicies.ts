import { CLAIM_SURFACES, type ClaimSurface, type ValidityTier } from '../protocol/nexusTrustRuntime';
import { TOOL_IDS, type ToolId } from './workflowContract';
import type { ClaimSurfaceBlockCode, ClaimSurfacePolicy } from './claimSurfacePolicy';

const ALL_VALIDITY_TIERS: ValidityTier[] = ['real', 'partial', 'demo'];
const FORMAL_CLAIM_TIERS: ValidityTier[] = ['real', 'partial'];

type SurfacePolicyTemplate = {
  allowedTiers: ValidityTier[];
  requiresProvenance: boolean;
  requiresHumanGate?: boolean;
  denyIfDraft?: boolean;
  blockCode: ClaimSurfaceBlockCode;
  rationale: string;
};

const SURFACE_POLICY_TEMPLATES: Record<ClaimSurface, SurfacePolicyTemplate> = {
  payload: {
    allowedTiers: ALL_VALIDITY_TIERS,
    requiresProvenance: false,
    blockCode: 'TIER_NOT_ALLOWED_FOR_SURFACE',
    rationale:
      'Workbench payloads may remain visible for exploration, including demo-tier outputs, as long as formal claim surfaces stay gated separately.',
  },
  export: {
    allowedTiers: FORMAL_CLAIM_TIERS,
    requiresProvenance: true,
    denyIfDraft: true,
    blockCode: 'DRAFT_OUTPUT_NOT_EXPORTABLE',
    rationale:
      'Exports leave the immediate tool view and should carry at least partial validity, provenance, and a finalized output state.',
  },
  recommendation: {
    allowedTiers: FORMAL_CLAIM_TIERS,
    requiresProvenance: true,
    blockCode: 'TIER_NOT_ALLOWED_FOR_SURFACE',
    rationale:
      'Recommendations influence future work and should be backed by at least partial validity plus traceable provenance.',
  },
  protocol: {
    allowedTiers: FORMAL_CLAIM_TIERS,
    requiresProvenance: true,
    requiresHumanGate: true,
    denyIfDraft: true,
    blockCode: 'DEMO_OUTPUT_PROTOCOL_BLOCKED',
    rationale:
      'Protocol-like artifacts can imply operational lab action, so demo-tier outputs are excluded and human review is declared for future enforcement.',
  },
  'external-handoff': {
    allowedTiers: FORMAL_CLAIM_TIERS,
    requiresProvenance: true,
    requiresHumanGate: true,
    blockCode: 'EXTERNAL_HANDOFF_BLOCKED',
    rationale:
      'External handoffs move claims outside Nexus-Bio and therefore require at least partial validity, provenance, and declared human review.',
  },
};

function buildClaimSurfacePolicy(
  toolId: ToolId,
  surface: ClaimSurface,
): ClaimSurfacePolicy {
  const template = SURFACE_POLICY_TEMPLATES[surface];
  return {
    policyId: `claim-surface:${toolId}:${surface}:v1`,
    toolId,
    surface,
    allowedTiers: [...template.allowedTiers],
    requiresProvenance: template.requiresProvenance,
    ...(template.requiresHumanGate !== undefined ? { requiresHumanGate: template.requiresHumanGate } : {}),
    ...(template.denyIfDraft !== undefined ? { denyIfDraft: template.denyIfDraft } : {}),
    blockCode: template.blockCode,
    rationale: template.rationale,
  };
}

export const CLAIM_SURFACE_POLICIES: ClaimSurfacePolicy[] = TOOL_IDS.flatMap((toolId) =>
  CLAIM_SURFACES.map((surface) => buildClaimSurfacePolicy(toolId, surface)),
);

const POLICY_BY_TOOL_AND_SURFACE = new Map(
  CLAIM_SURFACE_POLICIES.map((policy) => [
    `${policy.toolId}:${policy.surface}`,
    policy,
  ]),
);

export function getClaimSurfacePolicy(
  toolId: string,
  surface: ClaimSurface,
): ClaimSurfacePolicy | undefined {
  return POLICY_BY_TOOL_AND_SURFACE.get(`${toolId}:${surface}`);
}

export function listClaimSurfacePoliciesForTool(
  toolId: string,
): ClaimSurfacePolicy[] {
  return CLAIM_SURFACE_POLICIES.filter((policy) => policy.toolId === toolId);
}
