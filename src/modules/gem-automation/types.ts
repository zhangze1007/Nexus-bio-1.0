/**
 * GEM Automation Module Types
 *
 * Automated genome-scale metabolic model reconstruction.
 *
 * Reference: Thiele & Palsson (2010) Nature Protocols 5:9-13
 * Reference: Henry et al. (2010) BMC Bioinformatics 11:213 (ModelSEED)
 */

export interface GEMInput {
  /** Genome annotations */
  annotations: Array<{
    geneId: string;
    ecNumber?: string;
    geneName: string;
    organism: string;
  }>;
  /** Target organism */
  organism: string;
  /** Include gap-filling */
  gapFill?: boolean;
  /** Include biomass reaction */
  includeBiomass?: boolean;
}

export interface GEMOutput {
  /** Reconstructed model */
  model: {
    reactions: Array<{
      id: string;
      name: string;
      ecNumber: string;
      stoichiometry: Record<string, number>;
      reversible: boolean;
      subsystem: string;
    }>;
    metabolites: Array<{
      id: string;
      name: string;
      formula: string;
    }>;
    biomassReaction: string | null;
  };
  /** Gap-filling results */
  gapFilling: {
    addedReactions: string[];
    addedMetabolites: string[];
    reason: string[];
  };
  /** Essential genes */
  essentialGenes: Array<{
    geneId: string;
    reason: string;
  }>;
  /** Model statistics */
  stats: {
    nReactions: number;
    nMetabolites: number;
    nGenes: number;
    nGapFilled: number;
    nEssential: number;
  };
  /** Design notes */
  designNotes: string[];
}
