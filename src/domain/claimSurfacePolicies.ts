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

const CETHX_POLICY_RATIONALES: Partial<Record<ClaimSurface, string>> = {
  payload:
    'CETHX demo thermodynamics may remain visible as exploratory reference-table context, but it is not a condition-aware thermodynamics backend.',
  export:
    'CETHX exports must not carry demo reference delta G values as formal thermodynamic feasibility claims; formal export use requires at least partial validity and provenance.',
  recommendation:
    'CETHX recommendations require at least partial validity and provenance because demo reference thermodynamics lacks uncertainty, pH/ionic-strength/pMg transforms, and backend provenance.',
  protocol:
    'CETHX protocol-like use blocks demo thermodynamics because no condition-aware backend, uncertainty, or compound mapping currently supports operational thermodynamic claims.',
  'external-handoff':
    'CETHX external handoff blocks demo thermodynamics because reference-table values without uncertainty or backend provenance must not leave Nexus-Bio as formal feasibility evidence.',
};

const MULTIO_POLICY_RATIONALES: Partial<Record<ClaimSurface, string>> = {
  payload:
    'MultiO demo outputs may remain visible as exploratory deterministic integration, but they are not Bayesian, GP, MOFA, VAE, or reference-model-backed inference.',
  export:
    'MultiO exports must not carry demo deterministic projections as formal multi-omics inference; formal export use requires at least partial validity, provenance, and a real model boundary.',
  recommendation:
    'MultiO recommendations require at least partial validity and provenance because demo deterministic integration lacks posterior uncertainty and a reference-model backend.',
  protocol:
    'MultiO protocol-like use blocks demo output because no Bayesian/GP/MOFA/VAE backend, posterior uncertainty, or causal perturbation model currently supports operational claims.',
  'external-handoff':
    'MultiO external handoff blocks demo output because local deterministic projections must not leave Nexus-Bio as formal probabilistic or reference-model evidence.',
};

function policyRationale(toolId: ToolId, surface: ClaimSurface, fallback: string): string {
  if (toolId === 'cethx') return CETHX_POLICY_RATIONALES[surface] ?? fallback;
  if (toolId === 'multio') return MULTIO_POLICY_RATIONALES[surface] ?? fallback;
  return fallback;
}

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
    rationale: policyRationale(toolId, surface, template.rationale),
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
