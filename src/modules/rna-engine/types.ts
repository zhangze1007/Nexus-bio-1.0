/**
 * RNA Engineering Module Types
 *
 * Supports:
 *   1. Ribozyme design (hammerhead, hairpin, HDV)
 *   2. Aptamer design (SELEX-inspired)
 *   3. Toehold switch optimization
 *   4. siRNA/shRNA design with off-target scoring
 *
 * Reference: Scott et al. (2013) Nature 500:310 (hammerhead ribozyme)
 * Reference: Green et al. (2014) Cell 159:925-939 (toehold switches)
 * Reference: Tuerk & Gold (1990) Science 249:505 (SELEX)
 */

export type RNADesignType = "ribozyme" | "aptamer" | "toehold" | "sirna" | "shrna";
export type RibozymeType = "hammerhead" | "hairpin" | "hdv" | "glmS";

export interface RNADesignInput {
  /** Design type */
  type: RNADesignType;
  /** Target sequence (mRNA for ribozymes/siRNA, ligand for aptamers) */
  targetSequence: string;
  /** Ribozyme type (if type=ribozyme) */
  ribozymeType?: RibozymeType;
  /** Target organism */
  host: "ecoli" | "yeast" | "human";
  /** Length constraint */
  maxLength?: number;
}

export interface RNADesignResult {
  /** Design type */
  type: RNADesignType;
  /** Designed RNA sequence */
  sequence: string;
  /** Predicted activity (0-1) */
  predictedActivity: number;
  /** Off-target score (0-1, lower = safer) */
  offTargetScore: number;
  /** Thermodynamic stability (ΔG in kcal/mol) */
  deltaG: number;
  /** Target site position (for ribozymes/siRNA) */
  targetPosition?: number;
  /** Evidence sources */
  evidence: Array<{
    source: string;
    type: "literature" | "database" | "predicted";
    title: string;
  }>;
  /** Design notes */
  designNotes: string[];
}
