/**
 * sharedComponents.tsx — Shared types, constants, and tab configuration
 * for FBASim sub-components.
 */

import { THEME } from "../../../theme";
import type { ProvenanceEntry } from "../../../types/assumptions";
import type { ToolTab } from "../shared/ToolTabBar";

// ── Strain Design Types ─────────────────────────────────────────────────

export interface FSEOFBasalState {
  growthRate?: number;
  productFlux?: number;
}

export interface FSEOFReactionData {
  reactionId: string;
  fluxAtMin: number;
  fluxAtMax: number;
  monotonicity: number;
}

export interface FSEOFResultType {
  basalState?: FSEOFBasalState;
  wildType?: FSEOFBasalState;
  targets: FSEOFReactionData[];
}

export interface OptKnockKnockout {
  knockouts: string[];
  growthRate: number;
  productFlux: number;
}

export interface OptKnockResultType {
  wildType?: FSEOFBasalState;
  strategies: OptKnockKnockout[];
}

export interface PipelineParetoDesign {
  growthRate: number;
  productFlux: number;
  growthFractionOfWT: number;
  strategy: { knockouts: string[]; description: string };
}

export interface PipelineResult {
  paretoFront: PipelineParetoDesign[];
  bestDesign: PipelineParetoDesign;
  evaluations: Array<{ growthRate: number; productFlux: number; feasible: boolean }>;
}

// ── Tab Configuration ───────────────────────────────────────────────────

export const FBA_TABS: ToolTab[] = [
  { id: "flux", label: "Flux Map", accent: THEME.SKY },
  { id: "fva", label: "FVA", accent: THEME.LILAC },
  { id: "gpr", label: "GPR KO", accent: THEME.CORAL },
  { id: "knockout", label: "Knockout", accent: THEME.CORAL },
  { id: "strain", label: "Strain Design", accent: THEME.MINT },
  { id: "shadows", label: "Sensitivity", accent: THEME.LILAC },
  { id: "community", label: "Community", accent: THEME.MINT },
  { id: "consortium", label: "Consortium", accent: THEME.LILAC },
  { id: "custom", label: "Custom Model", accent: THEME.APRICOT },
];

// ── Re-exports for convenience ──────────────────────────────────────────

export type { ProvenanceEntry };
