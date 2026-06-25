/**
 * Biosafety Module Types
 *
 * Input/output types for the biosafety assessment engine.
 *
 * Reference: WHO Laboratory Biosafety Manual (2020)
 * Reference: NIH Guidelines for Research Involving Recombinant DNA (2019)
 */

export type BiosafetyPurpose = "research" | "production" | "therapy" | "environmental";
export type HostOrganism = "ecoli" | "yeast" | "human" | "other";
export type BiosafetyMode = "research" | "production";

export interface BiosafetyInput {
  /** DNA sequence to screen */
  dnaSequence: string;
  /** Protein sequence (optional) */
  proteinSequence?: string;
  /** Host organism */
  host: HostOrganism;
  /** Purpose of the construct */
  purpose: BiosafetyPurpose;
  /** Mode: research or production */
  mode: BiosafetyMode;
  /** User-defined risk tolerance (0-1, lower = more strict) */
  riskTolerance?: number;
}

export interface SequenceMatch {
  /** Database source */
  source: string;
  /** Matched sequence name */
  matchName: string;
  /** Match score (0-1) */
  score: number;
  /** Match region in query */
  queryRegion: [number, number];
  /** Match region in database */
  dbRegion: [number, number];
  /** E-value or significance */
  significance: number;
  /** Comment */
  comment?: string;
}

export interface ContainmentStrategy {
  /** Strategy type */
  type: "auxotrophic" | "inducible_survival" | "compartmentalization" | "safe_host" | "research_only";
  /** Description */
  description: string;
  /** Confidence (0-1) */
  confidence: number;
  /** Reference */
  reference?: string;
}

export interface BiosafetyOutput {
  /** Risk assessment */
  risk: {
    level: "low" | "moderate" | "elevated" | "high" | "blocked";
    score: number;
    reason: string;
    triggerRule: string;
  };
  /** Sequence similarity matches */
  matches: SequenceMatch[];
  /** Recommended containment strategies */
  containment: ContainmentStrategy[];
  /** Whether this construct can proceed */
  canProceed: boolean;
  /** Whether human review is required */
  requiresHumanReview: boolean;
  /** Evidence list */
  evidence: Array<{
    source: string;
    type: "database" | "literature" | "predicted";
    title: string;
    url?: string;
  }>;
  /** Design notes */
  designNotes: string[];
}
