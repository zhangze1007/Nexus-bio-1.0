import type { ClaimSurface, GateStatus, ValidityTier } from '../protocol/nexusTrustRuntime';

export interface ShowcaseTraceStep {
  stepId: string;
  toolId: string;
  surface: ClaimSurface;
  validityTier: ValidityTier;
  assumptionIds: string[];
  evidenceIds: string[];
  provenanceIds: string[];
  expectedGateStatus: GateStatus;
  expectedBlockCode?: string;
  note?: string;
}

export interface ShowcaseTrace {
  showcaseId: string;
  title: string;
  pathway: string;
  claim: string;
  steps: ShowcaseTraceStep[];
  nonClaims: string[];
}

export interface BlockedShowcaseTrace {
  showcaseId: string;
  title: string;
  pathway?: string;
  claim: string;
  blockedStep: ShowcaseTraceStep;
  reason: string;
  nonClaims: string[];
}

export type ShowcaseTraceDocument = ShowcaseTrace | BlockedShowcaseTrace;
