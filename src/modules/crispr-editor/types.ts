/**
 * CRISPR Editor Module Types
 *
 * Supports three editing modes:
 *   1. Standard Cas9 cleavage
 *   2. Base editing (C→T, A→G)
 *   3. Prime editing (arbitrary substitutions, insertions, deletions)
 *
 * Reference: Komor et al. (2016) Nature 533:421-424 (base editing)
 * Reference: Anzalone et al. (2019) Nature 576:149-157 (prime editing)
 */

export type EditingMode = "cas9" | "base_editing" | "prime_editing";
export type BaseEditorType = "BE3" | "BE4" | "ABE";
export type PrimeEditorType = "PE2" | "PE4";

export interface CRISPRInput {
  /** Target DNA sequence (coding strand, 5'→3') */
  targetSequence: string;
  /** Target position (0-indexed) for the edit */
  targetPosition: number;
  /** Desired edit type */
  editType: "substitution" | "insertion" | "deletion";
  /** For substitution: desired base change */
  desiredChange?: { from: string; to: string };
  /** For insertion: sequence to insert */
  insertion?: string;
  /** For deletion: number of bases to delete */
  deletionLength?: number;
  /** Editing mode */
  mode: EditingMode;
  /** Base editor type (if mode=base_editing) */
  baseEditor?: BaseEditorType;
  /** Prime editor type (if mode=prime_editing) */
  primeEditor?: PrimeEditorType;
  /** Host organism */
  host: "ecoli" | "yeast" | "human";
  /** High-fidelity mode */
  highFidelity?: boolean;
}

export interface GuideDesign {
  /** Guide RNA sequence (20 nt for Cas9) */
  sequence: string;
  /** PAM sequence */
  pam: string;
  /** Position in target */
  position: number;
  /** On-target score (0-1) */
  onTargetScore: number;
  /** Off-target sites */
  offTargetSites: Array<{
    position: number;
    mismatches: number;
    score: number;
  }>;
  /** Editing window (positions where edit is most efficient) */
  editingWindow: [number, number];
  /** Whether target position falls in editing window */
  targetInWindow: boolean;
}

export interface EditingResult {
  /** Mode used */
  mode: EditingMode;
  /** Guide RNA designs */
  guides: GuideDesign[];
  /** Predicted edit type */
  predictedEdit: string;
  /** Predicted efficiency (0-1) */
  predictedEfficiency: number;
  /** Off-target risk score (0-1) */
  offTargetRisk: number;
  /** Whether this design is acceptable */
  isAcceptable: boolean;
  /** Rejection reason (if not acceptable) */
  rejectionReason?: string;
  /** Evidence sources */
  evidence: Array<{
    source: string;
    type: "literature" | "database" | "predicted";
    title: string;
  }>;
  /** Design notes */
  designNotes: string[];
}
