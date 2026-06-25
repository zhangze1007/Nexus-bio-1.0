import type { ClaimSurface, ValidityTier } from "../protocol/nexusTrustRuntime";

export const CETHX_THERMODYNAMICS_ROUTE_DECISION = "alberty-transform-real" as const;

export type CethxThermodynamicsBoundaryStatus = "alberty-transform-real";

export interface CethxThermodynamicsBoundary {
  toolId: "cethx";
  status: CethxThermodynamicsBoundaryStatus;
  validityTier: ValidityTier;
  hasConditionAwareBackend: boolean;
  backendName: string;
  payloadAllowed: boolean;
  formalClaimSurfacesBlocked: readonly ClaimSurface[];
  assumptionIds: readonly string[];
  missingCapabilities: readonly string[];
  label: string;
  explanation: string;
}

export const CETHX_FORMAL_THERMODYNAMICS_SURFACES_BLOCKED: readonly ClaimSurface[] = [];

export const CETHX_THERMODYNAMICS_BOUNDARY: CethxThermodynamicsBoundary = {
  toolId: "cethx",
  status: "alberty-transform-real",
  validityTier: "real",
  hasConditionAwareBackend: true,
  backendName: "calcTransformedGibbs (thermoEngine)",
  payloadAllowed: true,
  formalClaimSurfacesBlocked: CETHX_FORMAL_THERMODYNAMICS_SURFACES_BLOCKED,
  assumptionIds: [
    "cethx.alberty_transform_local",
    "cethx.group_contribution_reference",
    "cethx.condition_aware_ph_ionic",
    "cethx.uncertainty_estimated",
    "cethx.lehninger_reference_dg0",
    "cethx.atp_yields_hardcoded",
    "cethx.proton_stoich_estimated",
  ],
  missingCapabilities: [
    "measured pKa-based proton stoichiometry",
    "pMg/magnesium binding correction",
    "compound identifier mapping",
    "eQuilibrator ComponentContribution backend",
  ],
  label: "CETHX Alberty-transformed thermodynamics",
  explanation:
    "CETHX applies the Alberty transform (Alberty 2003) to Lehninger reference ΔG° values using calcTransformedGibbs from thermoEngine. Condition-aware ΔG′ at user-specified pH, temperature, and ionic strength. eQuilibrator 3 API integration when available. TFA with group contribution method.",
};

export function getCethxThermodynamicsBoundary(): CethxThermodynamicsBoundary {
  return CETHX_THERMODYNAMICS_BOUNDARY;
}

export function isCethxFormalThermodynamicsSurfaceBlocked(surface: ClaimSurface): boolean {
  return CETHX_FORMAL_THERMODYNAMICS_SURFACES_BLOCKED.includes(surface);
}
