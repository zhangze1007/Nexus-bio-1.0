/**
 * Protein Prediction Types
 *
 * Unified type definitions for protein structure prediction across
 * AlphaFold2, AlphaFold3/ColabFold, and ESMFold backends.
 *
 * Confidence scores follow the AlphaFold convention:
 * - pTM: Template modeling score (global quality, 0-1)
 * - ipTM: Interface pTM for multi-chain complexes (0-1)
 * - pLDDT: Per-residue local distance difference test (0-100)
 *
 * Reference: Jumper et al. (2021) Nature 596:583 (AlphaFold2)
 * Reference: Abramson et al. (2024) Nature 630:493 (AlphaFold3)
 */

/** Confidence scores returned by structure prediction models. */
export interface ConfidenceScores {
  /** Template modeling score — global model quality (0-1) */
  pTM: number;
  /**
   * Interface pTM — quality of chain-chain interfaces (0-1).
   * Null for monomer predictions.
   */
  ipTM: number | null;
  /** Per-residue pLDDT scores (0-100, extracted from B-factor column) */
  pLDDT: number[];
  /** Mean pLDDT across all residues */
  meanPLDDT: number;
}

/** Metadata about the prediction run. */
export interface PredictionMetadata {
  /** Which model produced the structure */
  model: "alphafold2" | "alphafold3" | "colabfold" | "esmfold" | "local_heuristic";
  /** Chain identifiers in the output PDB */
  chainIds: string[];
  /** Input sequence(s) — single string for monomers, array for complexes */
  sequence: string | string[];
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Which API endpoint was called */
  source?: string;
  /** Wall-clock prediction time in ms */
  durationMs?: number;
}

/** Unified protein structure prediction result. */
export interface ProteinPrediction {
  /** PDB-format structure text */
  pdb: string;
  /** Confidence assessment */
  confidence: ConfidenceScores;
  /** Prediction metadata */
  metadata: PredictionMetadata;
}

/** Request for structure prediction. */
export interface ProteinPredictionRequest {
  /** Single sequence (monomer) or multiple sequences (complex) */
  sequences: string[];
  /** Chain IDs — auto-generated as A, B, C, ... if omitted */
  chainIds?: string[];
  /**
   * Model preference:
   * - 'auto': route based on chain count (default)
   * - 'alphafold2': single-chain via EBI
   * - 'alphafold3' / 'colabfold': multi-chain via ColabFold
   * - 'esmfold': fast single-sequence fold
   */
  model?: "auto" | "alphafold2" | "alphafold3" | "colabfold" | "esmfold";
  /** Use template structures if available (AlphaFold only) */
  useTemplates?: boolean;
}

/** Quality classification for confidence interpretation. */
export type QualityLevel = "high" | "medium" | "low" | "very_low";

/** Analysis of prediction confidence with human-readable interpretation. */
export interface ConfidenceAnalysis {
  /** Overall quality classification */
  overallQuality: QualityLevel;
  /** Global template modeling score */
  pTM: number;
  /** Interface pTM (null for monomers) */
  ipTM: number | null;
  /** Mean per-residue confidence */
  meanPLDDT: number;
  /** Raw per-residue pLDDT values */
  perResidueConfidence: number[];
  /** Contiguous regions with pLDDT < 70 (low confidence) */
  lowConfidenceRegions: Array<{ start: number; end: number }>;
  /** Human-readable quality interpretation */
  interpretation: string;
}
