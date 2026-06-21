/**
 * Structure Prediction Module Types
 *
 * Supports multi-chain protein complex prediction via ESMFold/AlphaFold.
 *
 * Reference: Jumper et al. (2021) Nature 596:583 (AlphaFold2)
 * Reference: Abramson et al. (2024) Nature 630:493 (AlphaFold3)
 * Reference: Lin et al. (2023) Science 379:1123 (ESMFold)
 */

export type PredictionMode = 'single_chain' | 'multi_chain' | 'protein_dna' | 'protein_rna';
export type PredictionSource = 'esmfold' | 'alphafold' | 'local';

export interface ProteinChain {
  /** Chain identifier (A, B, C, ...) */
  id: string;
  /** Amino acid sequence */
  sequence: string;
  /** Chain type */
  type: 'protein' | 'dna' | 'rna';
  /** Optional description */
  description?: string;
}

export interface StructureInput {
  /** Chains to predict */
  chains: ProteinChain[];
  /** Prediction mode */
  mode: PredictionMode;
  /** Prediction source */
  source: PredictionSource;
  /** Whether to predict complex structure (vs individual chains) */
  predictComplex: boolean;
}

export interface InterfaceResidue {
  /** Residue index */
  index: number;
  /** Residue name */
  residue: string;
  /** Chain ID */
  chain: string;
  /** Interface partner chain */
  partnerChain: string;
  /** Contact distance (Å) */
  distance: number;
  /** Contact type */
  type: 'hydrogen_bond' | 'salt_bridge' | 'hydrophobic' | 'van_der_waals';
  /** Confidence (0-1) */
  confidence: number;
}

export interface ChainResult {
  /** Chain ID */
  chainId: string;
  /** Predicted structure (PDB format) */
  pdb: string;
  /** Per-residue pLDDT confidence scores */
  plddt: number[];
  /** Average pLDDT */
  avgPLDDT: number;
  /** pTM score (predicted TM-score) */
  ptm: number;
}

export interface InterfacePrediction {
  /** Pairwise chain predictions */
  chainPairs: Array<{
    chainA: string;
    chainB: string;
    similarity: number;
    contactProbability: number;
    predictedInterface: boolean;
  }>;
  /** Overall prediction confidence (0-1) */
  overallConfidence: number;
}

export interface StructureResult {
  /** Individual chain results */
  chains: ChainResult[];
  /** Complex structure (if predictComplex=true) */
  complexPdb?: string;
  /** Interface residues */
  interfaceResidues: InterfaceResidue[];
  /** Complex confidence metrics */
  complexMetrics: {
    /** ipTM: interface predicted TM-score */
    iptm: number;
    /** pTM: predicted TM-score */
    ptm: number;
    /** Overall confidence */
    confidence: number;
  };
  /** Prediction source used */
  source: PredictionSource;
  /** Evidence sources */
  evidence: Array<{
    source: string;
    type: 'database' | 'literature' | 'predicted';
    title: string;
  }>;
  /** Design notes */
  designNotes: string[];
}
