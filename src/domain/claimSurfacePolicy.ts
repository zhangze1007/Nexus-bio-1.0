import type { ClaimSurface, ValidityTier } from '../protocol/nexusTrustRuntime';

export const CLAIM_SURFACE_BLOCK_CODES = [
  'MISSING_POLICY',
  'TIER_NOT_ALLOWED_FOR_SURFACE',
  'PROVENANCE_REQUIRED',
  'HUMAN_GATE_REQUIRED',
  'DRAFT_OUTPUT_NOT_EXPORTABLE',
  'DEMO_OUTPUT_PROTOCOL_BLOCKED',
  'EXTERNAL_HANDOFF_BLOCKED',
] as const;

export type ClaimSurfaceBlockCode = (typeof CLAIM_SURFACE_BLOCK_CODES)[number];

export interface ClaimSurfacePolicy {
  policyId: string;
  toolId: string;
  surface: ClaimSurface;
  allowedTiers: ValidityTier[];
  requiresProvenance: boolean;
  requiresHumanGate?: boolean;
  denyIfDraft?: boolean;
  blockCode: ClaimSurfaceBlockCode;
  rationale: string;
}
