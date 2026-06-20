/**
 * Genome-Scale Model (GEM) Reconstruction Engine
 *
 * Builds a metabolic model from genome annotations by:
 *   1. Parsing gene annotations (EC numbers, gene names)
 *   2. Mapping to metabolic reactions via KEGG/BRENDA
 *   3. Building stoichiometric matrix
 *   4. Identifying essential genes via FBA
 *
 * Reference: Thiele & Palsson (2010) Nature Protocols 5:9-13
 *
 * @scientific_provenance
 *   ALGORITHM: Annotation → reaction mapping → stoichiometric matrix
 *   KNOWN_LIMITATIONS:
 *     - Uses KEGG reaction database (not organism-specific)
 *     - No gap-filling or biomass reaction optimization
 *     - No thermodynamic constraints
 *     - Simplified gene-protein-reaction (GPR) rules
 */

import { IJO1366_REACTIONS, IJO1366_METABOLITES } from '../data/iJO1366Subset';

// ── Types ──────────────────────────────────────────────────────────────────

export interface GeneAnnotation {
  geneId: string;
  ecNumber?: string;
  geneName: string;
  organism: string;
}

export interface Reaction {
  id: string;
  name: string;
  ecNumber: string;
  stoichiometry: Record<string, number>;
  lb: number;
  ub: number;
  subsystem: string;
  gpr: string;  // gene-protein-reaction rule
}

export interface Metabolite {
  id: string;
  name: string;
  formula: string;
  compartment: string;
}

export interface GEMReconstruction {
  reactions: Reaction[];
  metabolites: Metabolite[];
  genes: string[];
  biomassReaction: string | null;
  stats: {
    nReactions: number;
    nMetabolites: number;
    nGenes: number;
    nExchange: number;
    nTransport: number;
  };
}

// ── EC Number → Reaction Mapping ────────────────────────────────────────────

/**
 * Map EC numbers to metabolic reactions using KEGG-style mappings.
 * Simplified: uses a hardcoded mapping for common EC numbers.
 */
const EC_REACTION_MAP: Record<string, Array<{
  reactionId: string;
  name: string;
  stoichiometry: Record<string, number>;
  subsystem: string;
}>> = {
  '2.7.1.1': [{ reactionId: 'HEX1', name: 'Hexokinase', stoichiometry: { 'glc__D_c': -1, 'atp_c': -1, 'g6p_c': 1, 'adp_c': 1 }, subsystem: 'Glycolysis' }],
  '5.3.1.9': [{ reactionId: 'PGI', name: 'Glucose-6-phosphate isomerase', stoichiometry: { 'g6p_c': -1, 'f6p_c': 1 }, subsystem: 'Glycolysis' }],
  '2.7.1.11': [{ reactionId: 'PFK', name: 'Phosphofructokinase', stoichiometry: { 'f6p_c': -1, 'atp_c': -1, 'fdp_c': 1, 'adp_c': 1 }, subsystem: 'Glycolysis' }],
  '4.1.2.13': [{ reactionId: 'FBA', name: 'Fructose-bisphosphate aldolase', stoichiometry: { 'fdp_c': -1, 'dhap_c': 1, 'g3p_c': 1 }, subsystem: 'Glycolysis' }],
  '1.2.1.12': [{ reactionId: 'GAPD', name: 'Glyceraldehyde-3-phosphate dehydrogenase', stoichiometry: { 'g3p_c': -1, 'nad_c': -1, 'pi_c': -1, '13dpg_c': 1, 'nadh_c': 1 }, subsystem: 'Glycolysis' }],
  '2.7.2.3': [{ reactionId: 'PGK', name: 'Phosphoglycerate kinase', stoichiometry: { '13dpg_c': -1, 'adp_c': -1, '3pg_c': 1, 'atp_c': 1 }, subsystem: 'Glycolysis' }],
  '4.2.1.11': [{ reactionId: 'ENO', name: 'Enolase', stoichiometry: { '2pg_c': -1, 'h2o_c': 1, 'pep_c': 1 }, subsystem: 'Glycolysis' }],
  '2.7.1.40': [{ reactionId: 'PYK', name: 'Pyruvate kinase', stoichiometry: { 'pep_c': -1, 'adp_c': -1, 'pyr_c': 1, 'atp_c': 1 }, subsystem: 'Glycolysis' }],
  '1.1.1.27': [{ reactionId: 'LDH', name: 'Lactate dehydrogenase', stoichiometry: { 'pyr_c': -1, 'nadh_c': -1, 'lac__D_c': 1, 'nad_c': 1 }, subsystem: 'Fermentation' }],
  '4.1.1.1': [{ reactionId: 'PDC', name: 'Pyruvate decarboxylase', stoichiometry: { 'pyr_c': -1, 'co2_c': 1, 'acald_c': 1 }, subsystem: 'Fermentation' }],
  '1.2.1.3': [{ reactionId: 'ALDD2x', name: 'Aldehyde dehydrogenase', stoichiometry: { 'acald_c': -1, 'nad_c': -1, 'h2o_c': -1, 'ac_c': 1, 'nadh_c': 1 }, subsystem: 'Fermentation' }],
};

// ── Gene → Reaction Mapping ────────────────────────────────────────────────

/**
 * Map gene annotations to metabolic reactions.
 */
export function mapGenesToReactions(annotations: GeneAnnotation[]): Reaction[] {
  const reactions: Reaction[] = [];
  const seen = new Set<string>();

  for (const gene of annotations) {
    if (!gene.ecNumber) continue;

    const mappedReactions = EC_REACTION_MAP[gene.ecNumber];
    if (!mappedReactions) continue;

    for (const rxn of mappedReactions) {
      if (seen.has(rxn.reactionId)) continue;
      seen.add(rxn.reactionId);

      reactions.push({
        id: rxn.reactionId,
        name: rxn.name,
        ecNumber: gene.ecNumber,
        stoichiometry: rxn.stoichiometry,
        lb: 0,
        ub: 1000,
        subsystem: rxn.subsystem,
        gpr: gene.geneId,
      });
    }
  }

  return reactions;
}

// ── Biomass Reaction ────────────────────────────────────────────────────────

/**
 * Generate a simplified biomass reaction.
 * Uses E. coli biomass composition as reference.
 */
export function generateBiomassReaction(metabolites: Metabolite[]): Reaction {
  // Simplified biomass: 1 ATP + 1 NADPH + amino acids → biomass
  const stoichiometry: Record<string, number> = {
    'atp_c': -50,
    'h2o_c': -50,
    'nadph_c': -20,
    'nadh_c': -10,
    'g6p_c': -1,
    'f6p_c': -1,
    'g3p_c': -1,
    'pyr_c': -2,
    'accoa_c': -1,
    'oaa_c': -1,
    'akg_c': -1,
    'biomass_c': 1,
  };

  return {
    id: 'BIOMASS',
    name: 'Biomass synthesis',
    ecNumber: '',
    stoichiometry,
    lb: 0,
    ub: 1000,
    subsystem: 'Biomass',
    gpr: '',
  };
}

// ── Exchange Reactions ──────────────────────────────────────────────────────

function generateExchangeReactions(): Reaction[] {
  const exchanges = [
    { id: 'EX_glc__D_e', substrate: 'glc__D_e', name: 'D-Glucose exchange' },
    { id: 'EX_o2_e', substrate: 'o2_e', name: 'Oxygen exchange' },
    { id: 'EX_co2_e', substrate: 'co2_e', name: 'CO2 exchange' },
    { id: 'EX_h2o_e', substrate: 'h2o_e', name: 'Water exchange' },
    { id: 'EX_nh4_e', substrate: 'nh4_e', name: 'Ammonium exchange' },
    { id: 'EX_pi_e', substrate: 'pi_e', name: 'Phosphate exchange' },
    { id: 'EX_so4_e', substrate: 'so4_e', name: 'Sulfate exchange' },
  ];

  return exchanges.map(ex => ({
    id: ex.id,
    name: ex.name,
    ecNumber: '',
    stoichiometry: { [ex.substrate]: -1 },
    lb: -10,
    ub: 1000,
    subsystem: 'Exchange',
    gpr: '',
  }));
}

// ── Main Reconstruction ─────────────────────────────────────────────────────

/**
 * Reconstruct a genome-scale model from gene annotations.
 */
export function reconstructGEM(annotations: GeneAnnotation[]): GEMReconstruction {
  // Step 1: Map genes to reactions
  const geneReactions = mapGenesToReactions(annotations);

  // Step 2: Add exchange reactions
  const exchangeReactions = generateExchangeReactions();

  // Step 3: Collect all metabolites
  const metaboliteSet = new Set<string>();
  for (const rxn of [...geneReactions, ...exchangeReactions]) {
    for (const met of Object.keys(rxn.stoichiometry)) {
      metaboliteSet.add(met);
    }
  }

  const metabolites: Metabolite[] = Array.from(metaboliteSet).map(id => ({
    id,
    name: id.replace(/_[a-z]$/, ''),
    formula: '',
    compartment: id.split('_').pop() ?? 'c',
  }));

  // Step 4: Add biomass reaction
  const biomassReaction = generateBiomassReaction(metabolites);

  // Step 5: Collect all genes
  const genes = annotations.map(a => a.geneId);

  const allReactions = [...geneReactions, ...exchangeReactions, biomassReaction];

  return {
    reactions: allReactions,
    metabolites,
    genes,
    biomassReaction: 'BIOMASS',
    stats: {
      nReactions: allReactions.length,
      nMetabolites: metabolites.length,
      nGenes: genes.length,
      nExchange: exchangeReactions.length,
      nTransport: 0,
    },
  };
}
