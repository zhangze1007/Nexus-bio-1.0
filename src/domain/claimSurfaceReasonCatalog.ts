import type { ClaimSurfaceBlockCode } from './claimSurfacePolicy';

export interface ClaimSurfaceReason {
  blockCode: ClaimSurfaceBlockCode;
  title: string;
  explanation: string;
  suggestedAction: string;
}

export const CLAIM_SURFACE_REASON_CATALOG: Record<ClaimSurfaceBlockCode, ClaimSurfaceReason> = {
  MISSING_POLICY: {
    blockCode: 'MISSING_POLICY',
    title: 'No claim-surface policy is defined',
    explanation:
      'The runtime cannot find a declared policy for this tool and claim surface. Step 5 defines the catalog only; future enforcement should treat this as an explicit policy gap.',
    suggestedAction:
      'Add a policy entry for the tool and surface before allowing formal consumption.',
  },
  TIER_NOT_ALLOWED_FOR_SURFACE: {
    blockCode: 'TIER_NOT_ALLOWED_FOR_SURFACE',
    title: 'Validity tier is not allowed on this surface',
    explanation:
      'The output validity tier is below the threshold declared for this claim surface.',
    suggestedAction:
      'Use the output only on a less formal surface or replace it with partial or real evidence.',
  },
  PROVENANCE_REQUIRED: {
    blockCode: 'PROVENANCE_REQUIRED',
    title: 'Provenance is required',
    explanation:
      'This claim surface requires a provenance snapshot so consumers can trace the output back to inputs, assumptions, and evidence.',
    suggestedAction:
      'Re-run or publish the output with provenance before using it on this surface.',
  },
  HUMAN_GATE_REQUIRED: {
    blockCode: 'HUMAN_GATE_REQUIRED',
    title: 'Human review is required',
    explanation:
      'The policy marks this surface as requiring explicit human review before the output becomes a formal downstream claim.',
    suggestedAction:
      'Route the output through the future human-gate workflow before continuing.',
  },
  DRAFT_OUTPUT_NOT_EXPORTABLE: {
    blockCode: 'DRAFT_OUTPUT_NOT_EXPORTABLE',
    title: 'Draft output is not exportable',
    explanation:
      'Draft or uncommitted outputs should remain in the workbench and should not become exported artifacts.',
    suggestedAction:
      'Commit or finalize the output with provenance before exporting it.',
  },
  DEMO_OUTPUT_PROTOCOL_BLOCKED: {
    blockCode: 'DEMO_OUTPUT_PROTOCOL_BLOCKED',
    title: 'Demo output cannot generate protocol',
    explanation:
      'Demo-level outputs may be useful for learning, but cannot become protocol-like artifacts.',
    suggestedAction:
      'Use the output as exploratory context only or replace it with partial or real evidence.',
  },
  EXTERNAL_HANDOFF_BLOCKED: {
    blockCode: 'EXTERNAL_HANDOFF_BLOCKED',
    title: 'External handoff is blocked',
    explanation:
      'Outputs handed outside Nexus-Bio require at least partial validity plus provenance so external consumers do not receive unsupported claims.',
    suggestedAction:
      'Keep the output inside the workbench or replace it with provenance-backed partial or real evidence.',
  },
};

export function getClaimSurfaceReason(
  blockCode: ClaimSurfaceBlockCode,
): ClaimSurfaceReason {
  return CLAIM_SURFACE_REASON_CATALOG[blockCode];
}
