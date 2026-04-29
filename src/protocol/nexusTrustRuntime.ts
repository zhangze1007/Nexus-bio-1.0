export const VALIDITY_TIERS = ['real', 'partial', 'demo'] as const;

export type ValidityTier = (typeof VALIDITY_TIERS)[number];

export const CLAIM_SURFACES = [
  'payload',
  'export',
  'recommendation',
  'protocol',
  'external-handoff',
] as const;

export type ClaimSurface = (typeof CLAIM_SURFACES)[number];

export const GATE_STATUSES = ['ok', 'blocked', 'gated', 'demoOnly'] as const;

export type GateStatus = (typeof GATE_STATUSES)[number];

export type AssumptionStatus = 'active' | 'resolved' | 'violated' | 'unknown';

export type EvidenceType =
  | 'literature'
  | 'dataset'
  | 'user-input'
  | 'simulation'
  | 'experiment'
  | 'manual-review';

export type ProvenanceActivityType = 'tool-run' | 'human-gate' | 'export' | 'import' | 'review';

export type ViolationSeverity = 'warning' | 'blocking';

export type GateOverridePath = 'human-review' | 'not-allowed';

export interface ToolAssumption {
  assumptionId: string;
  toolId: string;
  statement: string;
  validityTier: ValidityTier;
  status: AssumptionStatus;
  knownLimitations: string[];
  evidenceIds: string[];
}

export interface Evidence {
  evidenceId: string;
  evidenceType: EvidenceType;
  title: string;
  source?: string;
  doi?: string;
  url?: string;
  notes?: string;
}

export interface ProvenanceEntry {
  provenanceId: string;
  toolId: string;
  activityType: ProvenanceActivityType;
  startedAt: string;
  completedAt?: string;
  inputAssumptionIds: string[];
  outputAssumptionIds: string[];
  evidenceIds: string[];
  upstreamProvenanceIds: string[];
  actor?: string;
}

export interface AssumptionViolation {
  violationId: string;
  assumptionId: string;
  detectedAt: string;
  severity: ViolationSeverity;
  message: string;
  affectedSurfaces: ClaimSurface[];
}

export interface WorkflowContract {
  contractId: string;
  fromToolId: string;
  toToolId?: string;
  allowedSurfaces: ClaimSurface[];
  minimumValidityTier: ValidityTier;
  requiresProvenance: boolean;
  requiresHumanGate?: boolean;
}

export interface GateDecision {
  status: GateStatus;
  blockCode?: string;
  reason: string;
  allowedSurfaces: ClaimSurface[];
  blockedSurfaces: ClaimSurface[];
  overridePath?: GateOverridePath;
}
