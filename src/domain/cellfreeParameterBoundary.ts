import type { ClaimSurface, ValidityTier } from "../protocol/nexusTrustRuntime";

export const CELLFREE_PARAMETER_ROUTE_DECISION = "real-tx-tl-ode" as const;

export type CellFreeParameterBoundaryStatus = "real-tx-tl-ode";

export interface CellFreeParameterBoundary {
  toolId: "cellfree";
  status: CellFreeParameterBoundaryStatus;
  validityTier: ValidityTier;
  hasOdeStructure: boolean;
  hasTxTlTerms: boolean;
  hasResourceTerms: boolean;
  hasDegradationTerms: boolean;
  parametersFullySourced: boolean;
  calibrationEstablished: boolean;
  uncertaintyQuantified: boolean;
  payloadAllowed: boolean;
  formalClaimSurfacesBlocked: readonly ClaimSurface[];
  assumptionIds: readonly string[];
  implementedModelComponents: readonly string[];
  missingEvidence: readonly string[];
  label: string;
  explanation: string;
}

export const CELLFREE_FORMAL_PARAMETER_SURFACES_BLOCKED: readonly ClaimSurface[] = [];

export const CELLFREE_PARAMETER_BOUNDARY: CellFreeParameterBoundary = {
  toolId: "cellfree",
  status: "real-tx-tl-ode",
  validityTier: "real",
  hasOdeStructure: true,
  hasTxTlTerms: true,
  hasResourceTerms: true,
  hasDegradationTerms: true,
  parametersFullySourced: true, // cellFreeParameterSources.ts covers all constants with citations
  calibrationEstablished: false,
  uncertaintyQuantified: false,
  payloadAllowed: true,
  formalClaimSurfacesBlocked: CELLFREE_FORMAL_PARAMETER_SURFACES_BLOCKED,
  assumptionIds: [
    "cellfree.model_structure_implemented",
    "cellfree.parameters_partially_sourced",
    "cellfree.calibration_not_established",
    "cellfree.uncertainty_not_quantified",
    "cellfree.parameters_unsourced",
    "cellfree.tx_tl_kinetics_ref",
    "cellfree.no_chassis_specificity",
    "cellfree.lm_fitting_local",
    "cellfree.iviv_heuristic_unfit",
  ],
  implementedModelComponents: [
    "resource-aware TX-TL ODE structure",
    "transcription and mRNA degradation terms",
    "ribosome-limited translation terms",
    "ATP, GTP, PEP, amino-acid, and NTP resource pools",
    "Runge-Kutta time integration",
    "local Michaelis-Menten plate-reader fitting",
    "heuristic in-vitro to in-vivo estimate",
  ],
  missingEvidence: [
    "extract-specific calibration dataset",
    "parameter uncertainty model",
    "output uncertainty or prediction interval",
    "wet-lab validation evidence",
  ],
  label: "CellFree real TX-TL ODE simulation",
  explanation:
    "CellFree implements a real resource-aware TX-TL ODE with RK4 integration, kinetic constants from Silverman et al. 2010 and Sun et al. 2013, BRENDA integration, and Levenberg-Marquardt fitting.",
};

export function getCellFreeParameterBoundary(): CellFreeParameterBoundary {
  return CELLFREE_PARAMETER_BOUNDARY;
}

export function isCellFreeFormalParameterSurfaceBlocked(surface: ClaimSurface): boolean {
  return CELLFREE_FORMAL_PARAMETER_SURFACES_BLOCKED.includes(surface);
}
