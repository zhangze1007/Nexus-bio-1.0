/**
 * Metabolic Fluxomics Integration Types
 *
 * Integrates 13C Metabolic Flux Analysis (MFA) with transcriptomics
 * data for joint flux-expression analysis.
 *
 * Reference: Zamboni (2011) Annu Rev Biochem 80:291
 * Reference: Antoniewicz (2015) Metab Eng 29:217
 */

export interface FluxomicsInput {
  /** MFA flux estimates */
  fluxEstimates: Array<{
    reactionId: string;
    flux: number;
    confidence: number;
  }>;
  /** Gene expression data (optional) */
  geneExpression?: Record<string, number>;
  /** Metabolite concentrations (optional) */
  metaboliteConcentrations?: Record<string, number>;
  /** Growth rate */
  growthRate: number;
}

export interface FluxExpressionCorrelation {
  reactionId: string;
  geneId: string;
  flux: number;
  expression: number;
  correlation: number; // -1 to 1
  pValue: number;
  significant: boolean;
}

export interface BottleneckReaction {
  reactionId: string;
  flux: number;
  maxCapacity: number;
  utilization: number; // flux/maxCapacity (0-1)
  expressionLevel: number;
  isBottleneck: boolean;
  recommendation: string;
}

export interface FluxomicsResult {
  /** Flux-expression correlations */
  correlations: FluxExpressionCorrelation[];
  /** Bottleneck reactions */
  bottlenecks: BottleneckReaction[];
  /** Metabolic efficiency metrics */
  efficiency: {
    carbonEfficiency: number;
    oxygenEfficiency: number;
    atpEfficiency: number;
  };
  /** Design notes */
  designNotes: string[];
}
