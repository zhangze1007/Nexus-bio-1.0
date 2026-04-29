import type { ClaimSurface, ValidityTier } from '../protocol/nexusTrustRuntime';

export const CETHX_THERMODYNAMICS_ROUTE_DECISION = 'demo-only-reference-boundary' as const;

export type CethxThermodynamicsBoundaryStatus = 'demo-only-reference';

export interface CethxThermodynamicsBoundary {
  toolId: 'cethx';
  status: CethxThermodynamicsBoundaryStatus;
  validityTier: ValidityTier;
  hasConditionAwareBackend: boolean;
  backendName: null;
  payloadAllowed: boolean;
  formalClaimSurfacesBlocked: readonly ClaimSurface[];
  assumptionIds: readonly string[];
  missingCapabilities: readonly string[];
  label: string;
  explanation: string;
}

export const CETHX_FORMAL_THERMODYNAMICS_SURFACES_BLOCKED: readonly ClaimSurface[] = [
  'export',
  'recommendation',
  'protocol',
  'external-handoff',
];

export const CETHX_THERMODYNAMICS_BOUNDARY: CethxThermodynamicsBoundary = {
  toolId: 'cethx',
  status: 'demo-only-reference',
  validityTier: 'demo',
  hasConditionAwareBackend: false,
  backendName: null,
  payloadAllowed: true,
  formalClaimSurfacesBlocked: CETHX_FORMAL_THERMODYNAMICS_SURFACES_BLOCKED,
  assumptionIds: [
    'cethx.thermodynamics_demo_only',
    'cethx.missing_condition_aware_backend',
    'cethx.uncertainty_not_calculated',
    'cethx.uniform_ph_factor',
    'cethx.linear_temperature_only',
    'cethx.no_ionic_strength_correction',
    'cethx.lehninger_lookup',
    'cethx.atp_yields_hardcoded',
  ],
  missingCapabilities: [
    'reaction-specific condition transform',
    'ionic-strength and pMg correction',
    'uncertainty estimate',
    'compound identifier mapping',
    'thermodynamics backend provenance',
  ],
  label: 'CETHX demo thermodynamics explainer',
  explanation:
    'CETHX currently displays Lehninger/NIST reference delta G values for workflow exploration; it is not a condition-aware thermodynamics backend.',
};

export function getCethxThermodynamicsBoundary(): CethxThermodynamicsBoundary {
  return CETHX_THERMODYNAMICS_BOUNDARY;
}

export function isCethxFormalThermodynamicsSurfaceBlocked(surface: ClaimSurface): boolean {
  return CETHX_FORMAL_THERMODYNAMICS_SURFACES_BLOCKED.includes(surface);
}
