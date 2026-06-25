import type { ClaimSurface, ValidityTier } from "../protocol/nexusTrustRuntime";

export const COMMUNITY_FBA_ROUTE_DECISION = "joint-community-lp" as const;

export type FbaMode = "single" | "community";

export type FbaModeBoundaryStatus = "supported-single-species-lp" | "supported-joint-community-lp";

export interface FbaModeBoundary {
  mode: FbaMode;
  status: FbaModeBoundaryStatus;
  toolId: "fbasim" | "fbasim-community";
  validityTier: ValidityTier;
  payloadAllowed: boolean;
  formalClaimSurfacesBlocked: readonly ClaimSurface[];
  assumptionIds: readonly string[];
  label: string;
  explanation: string;
}

export const COMMUNITY_FBA_FORMAL_SURFACES_BLOCKED: readonly ClaimSurface[] = ["external-handoff"];

export const FBASIM_SINGLE_BOUNDARY: FbaModeBoundary = {
  mode: "single",
  status: "supported-single-species-lp",
  toolId: "fbasim",
  validityTier: "partial",
  payloadAllowed: true,
  formalClaimSurfacesBlocked: [],
  assumptionIds: [
    "fbasim.steady_state",
    "fbasim.fixed_uptake_bounds",
    "fbasim.no_enzyme_capacity",
    "fbasim.toy_core_model",
  ],
  label: "Single-species FBA",
  explanation:
    "Single-species FBASim uses the existing partial-validity simplex LP path and remains separate from the community demo boundary.",
};

export const FBASIM_COMMUNITY_BOUNDARY: FbaModeBoundary = {
  mode: "community",
  status: "supported-joint-community-lp",
  toolId: "fbasim-community",
  validityTier: "partial",
  payloadAllowed: true,
  formalClaimSurfacesBlocked: COMMUNITY_FBA_FORMAL_SURFACES_BLOCKED,
  assumptionIds: [
    "fbasim-community.joint_lp_with_exchange_pools",
    "fbasim-community.toy_network_not_genome_scale",
    "fbasim-community.growth_rate_heuristic_scaling",
    "fbasim-community.inherits_single_assumptions",
  ],
  label: "Joint community LP",
  explanation:
    "Community mode uses a joint community LP with shared exchange metabolite pool constraints and weighted community biomass objective.",
};

export function getFbaModeBoundary(mode: FbaMode): FbaModeBoundary {
  return mode === "community" ? FBASIM_COMMUNITY_BOUNDARY : FBASIM_SINGLE_BOUNDARY;
}

export function isCommunityFbaFormalSurfaceBlocked(surface: ClaimSurface): boolean {
  return COMMUNITY_FBA_FORMAL_SURFACES_BLOCKED.includes(surface);
}
