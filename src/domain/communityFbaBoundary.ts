import type { ClaimSurface, ValidityTier } from '../protocol/nexusTrustRuntime';

export const COMMUNITY_FBA_ROUTE_DECISION = 'demo-only-illustrative-mode' as const;

export type FbaMode = 'single' | 'community';

export type FbaModeBoundaryStatus =
  | 'supported-single-species-lp'
  | 'demo-only-illustrative';

export interface FbaModeBoundary {
  mode: FbaMode;
  status: FbaModeBoundaryStatus;
  toolId: 'fbasim' | 'fbasim-community';
  validityTier: ValidityTier;
  payloadAllowed: boolean;
  formalClaimSurfacesBlocked: readonly ClaimSurface[];
  assumptionIds: readonly string[];
  label: string;
  explanation: string;
}

export const COMMUNITY_FBA_FORMAL_SURFACES_BLOCKED: readonly ClaimSurface[] = [
  'recommendation',
  'protocol',
  'external-handoff',
];

export const FBASIM_SINGLE_BOUNDARY: FbaModeBoundary = {
  mode: 'single',
  status: 'supported-single-species-lp',
  toolId: 'fbasim',
  validityTier: 'partial',
  payloadAllowed: true,
  formalClaimSurfacesBlocked: [],
  assumptionIds: [
    'fbasim.steady_state',
    'fbasim.fixed_uptake_bounds',
    'fbasim.no_enzyme_capacity',
    'fbasim.toy_core_model',
  ],
  label: 'Single-species FBA',
  explanation:
    'Single-species FBASim uses the existing partial-validity simplex LP path and remains separate from the community demo boundary.',
};

export const FBASIM_COMMUNITY_BOUNDARY: FbaModeBoundary = {
  mode: 'community',
  status: 'demo-only-illustrative',
  toolId: 'fbasim-community',
  validityTier: 'demo',
  payloadAllowed: true,
  formalClaimSurfacesBlocked: COMMUNITY_FBA_FORMAL_SURFACES_BLOCKED,
  assumptionIds: [
    'fbasim-community.community_not_joint_lp',
    'fbasim-community.no_cross_feeding_stoich',
    'fbasim-community.alpha_linear_blend',
    'fbasim-community.exchange_flux_no_meaning',
    'fbasim-community.inherits_single_assumptions',
  ],
  label: 'Two-species demo',
  explanation:
    'Community mode is an illustrative comparison of independent host solves with post-hoc exchange-like values; it is not a SteadyCom-like joint community LP.',
};

export function getFbaModeBoundary(mode: FbaMode): FbaModeBoundary {
  return mode === 'community' ? FBASIM_COMMUNITY_BOUNDARY : FBASIM_SINGLE_BOUNDARY;
}

export function isCommunityFbaFormalSurfaceBlocked(surface: ClaimSurface): boolean {
  return COMMUNITY_FBA_FORMAL_SURFACES_BLOCKED.includes(surface);
}
