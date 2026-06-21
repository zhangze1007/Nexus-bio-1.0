/**
 * Unified Biological Evidence Type
 *
 * All biological outputs in Nexus-Bio must carry evidence metadata.
 * This ensures traceability and distinguishes predicted/simulated data
 * from experimentally validated results.
 *
 * Reference: SBOL3 standard for biological design representation
 */

export type EvidenceSourceType =
  | 'literature'      // Published peer-reviewed paper
  | 'database'        // Curated database (BRENDA, KEGG, UniProt)
  | 'predicted'       // ML/computational prediction
  | 'simulated'       // In-silico simulation (ODE, FBA, etc.)
  | 'experimental'    // Wet-lab measurement
  | 'manual';         // Expert curation

export type EvidenceConfidence = 'high' | 'medium' | 'low' | 'uncertain';

export interface BioEvidence {
  /** Unique evidence ID */
  id: string;
  /** Data source name (e.g., 'BRENDA', 'KEGG', 'ESM-2') */
  source: string;
  /** Source type classification */
  sourceType: EvidenceSourceType;
  /** Human-readable title */
  title: string;
  /** DOI or URL for verification */
  doi?: string;
  url?: string;
  /** PMID for PubMed references */
  pmid?: string;
  /** Organism context */
  organism?: string;
  /** Confidence level */
  confidence: EvidenceConfidence;
  /** Timestamp of evidence creation */
  timestamp: number;
  /** Additional notes */
  notes?: string;
  /** Whether this evidence has been independently validated */
  isValidated: boolean;
  /** Validation method (e.g., 'literature cross-reference', 'experimental replicate') */
  validationMethod?: string;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Create a literature evidence entry.
 */
export function literatureEvidence(
  title: string,
  doi: string,
  organism?: string,
): BioEvidence {
  return {
    id: `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    source: doi.split('/')[0] || 'unknown',
    sourceType: 'literature',
    title,
    doi,
    organism,
    confidence: 'high',
    timestamp: Date.now(),
    isValidated: true,
    validationMethod: 'peer-reviewed publication',
  };
}

/**
 * Create a database evidence entry.
 */
export function databaseEvidence(
  source: string,
  title: string,
  url?: string,
): BioEvidence {
  return {
    id: `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    source,
    sourceType: 'database',
    title,
    url,
    confidence: 'high',
    timestamp: Date.now(),
    isValidated: true,
    validationMethod: 'curated database entry',
  };
}

/**
 * Create a prediction evidence entry.
 */
export function predictionEvidence(
  source: string,
  title: string,
  confidence: EvidenceConfidence = 'medium',
): BioEvidence {
  return {
    id: `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    source,
    sourceType: 'predicted',
    title,
    confidence,
    timestamp: Date.now(),
    isValidated: false,
    notes: 'Predicted value — requires experimental validation',
  };
}

/**
 * Create a simulation evidence entry.
 */
export function simulationEvidence(
  source: string,
  title: string,
): BioEvidence {
  return {
    id: `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    source,
    sourceType: 'simulated',
    title,
    confidence: 'medium',
    timestamp: Date.now(),
    isValidated: false,
    notes: 'Simulated value — in-silico computation only',
  };
}
