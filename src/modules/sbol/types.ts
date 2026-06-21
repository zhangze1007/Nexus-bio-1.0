/**
 * SBOL Data Standard Types
 *
 * Implements SBOL3 (Synthetic Biology Open Language) for standardized
 * representation of biological parts, devices, and systems.
 *
 * Reference: SBOL3 Specification: https://sbolstandard.org/3.0/
 * Reference: Galdzicki et al. (2014) Nat Biotechnol 32:545 (SBOL2)
 */

export type SBOLRole =
  | 'promoter' | 'ribosome_binding_site' | 'coding_sequence' | 'terminator'
  | 'gene' | 'mRNA' | 'protein' | 'small_molecule'
  | 'reporter' | 'resistance_marker' | 'replication_origin'
  | 'operator' | 'enhancer' | 'insulator';

export type SBOLSequenceType = 'DNA' | 'RNA' | 'protein' | 'small_molecule';

export interface SBOLSequence {
  /** Unique URI */
  uri: string;
  /** Sequence elements */
  elements: string;
  /** Sequence type */
  type: SBOLSequenceType;
  /** Encoding */
  encoding: 'iupac_dna' | 'iupac_rna' | 'iupac_protein' | 'smiles';
}

export interface SBOLComponent {
  /** Unique URI */
  uri: string;
  /** Display name */
  name: string;
  /** Role in the system */
  role: SBOLRole;
  /** Sequence */
  sequence?: SBOLSequence;
  /** Sub-components (for composite parts) */
  subComponents?: SBOLComponent[];
  /** Metadata */
  metadata?: {
    organism?: string;
    source?: string;
    citation?: string;
    notes?: string;
  };
}

export interface SBOLDesign {
  /** Unique URI */
  uri: string;
  /** Display name */
  name: string;
  /** Components in the design */
  components: SBOLComponent[];
  /** Target host organism */
  host: string;
  /** Design purpose */
  purpose: string;
}

/**
 * Convert a Nexus-Bio construct to SBOL3 representation.
 */
export function toSBOL3(construct: {
  name: string;
  promoter: string;
  rbs: string;
  cds: string;
  terminator: string;
  host: string;
}): SBOLDesign {
  return {
    uri: `https://nexus-bio.com/design/${Date.now()}`,
    name: construct.name,
    components: [
      { uri: `https://nexus-bio.com/part/promoter_${Date.now()}`, name: 'Promoter', role: 'promoter', sequence: { uri: `https://nexus-bio.com/seq/promo_${Date.now()}`, elements: construct.promoter, type: 'DNA', encoding: 'iupac_dna' } },
      { uri: `https://nexus-bio.com/part/rbs_${Date.now()}`, name: 'RBS', role: 'ribosome_binding_site', sequence: { uri: `https://nexus-bio.com/seq/rbs_${Date.now()}`, elements: construct.rbs, type: 'RNA', encoding: 'iupac_rna' } },
      { uri: `https://nexus-bio.com/part/cds_${Date.now()}`, name: 'CDS', role: 'coding_sequence', sequence: { uri: `https://nexus-bio.com/seq/cds_${Date.now()}`, elements: construct.cds, type: 'DNA', encoding: 'iupac_dna' } },
      { uri: `https://nexus-bio.com/part/term_${Date.now()}`, name: 'Terminator', role: 'terminator', sequence: { uri: `https://nexus-bio.com/seq/term_${Date.now()}`, elements: construct.terminator, type: 'DNA', encoding: 'iupac_dna' } },
    ],
    host: construct.host,
    purpose: 'expression',
  };
}

/**
 * Export SBOL design as JSON-LD (SBOL3 standard format).
 */
export function exportSBOL3JSON(design: SBOLDesign): string {
  return JSON.stringify({
    '@context': 'https://sbolstandard.org/3.0/context.jsonld',
    type: 'Design',
    uri: design.uri,
    displayId: design.name,
    components: design.components.map(c => ({
      type: 'Component',
      uri: c.uri,
      displayId: c.name,
      roles: [c.role],
      sequences: c.sequence ? [{
        type: 'Sequence',
        uri: c.sequence.uri,
        elements: c.sequence.elements,
        encoding: c.sequence.encoding,
      }] : [],
    })),
  }, null, 2);
}
