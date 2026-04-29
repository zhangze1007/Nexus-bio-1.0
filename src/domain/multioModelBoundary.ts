import type { ClaimSurface, ValidityTier } from '../protocol/nexusTrustRuntime';

export const MULTIO_MODEL_ROUTE_DECISION = 'deterministic-demo-boundary' as const;

export type MultiOModelBoundaryStatus = 'deterministic-demo-only';

export interface MultiOModelBoundary {
  toolId: 'multio';
  status: MultiOModelBoundaryStatus;
  validityTier: ValidityTier;
  hasReferenceModelBackend: boolean;
  backendName: null;
  posteriorUncertaintyAvailable: boolean;
  payloadAllowed: boolean;
  formalClaimSurfacesBlocked: readonly ClaimSurface[];
  assumptionIds: readonly string[];
  missingCapabilities: readonly string[];
  label: string;
  explanation: string;
}

export const MULTIO_FORMAL_MODEL_SURFACES_BLOCKED: readonly ClaimSurface[] = [
  'export',
  'recommendation',
  'protocol',
  'external-handoff',
];

export const MULTIO_MODEL_BOUNDARY: MultiOModelBoundary = {
  toolId: 'multio',
  status: 'deterministic-demo-only',
  validityTier: 'demo',
  hasReferenceModelBackend: false,
  backendName: null,
  posteriorUncertaintyAvailable: false,
  payloadAllowed: true,
  formalClaimSurfacesBlocked: MULTIO_FORMAL_MODEL_SURFACES_BLOCKED,
  assumptionIds: [
    'multio.deterministic_demo_only',
    'multio.no_reference_model',
    'multio.no_bayesian_gp_posterior',
    'multio.not_mofa_plus',
    'multio.not_vae',
    'multio.no_umap',
    'multio.deterministic_no_uncertainty',
    'multio.linear_perturbation',
  ],
  missingCapabilities: [
    'reference-model backend',
    'Bayesian or Gaussian-process inference',
    'MOFA-like variational factor model',
    'VAE-like learned posterior',
    'posterior variance or credible uncertainty',
    'causal perturbation-response model',
  ],
  label: 'MultiO deterministic demo integration',
  explanation:
    'MultiO currently runs deterministic local integration, factor-style decomposition, projection, and sensitivity sketches; it is not Bayesian, GP, MOFA, VAE, or reference-model backed.',
};

export function getMultiOModelBoundary(): MultiOModelBoundary {
  return MULTIO_MODEL_BOUNDARY;
}

export function isMultiOFormalModelSurfaceBlocked(surface: ClaimSurface): boolean {
  return MULTIO_FORMAL_MODEL_SURFACES_BLOCKED.includes(surface);
}
