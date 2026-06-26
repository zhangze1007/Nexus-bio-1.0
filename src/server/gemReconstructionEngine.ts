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
 *     - Full GPR boolean parser with probability knockout model
 */

import { IJO1366_METABOLITES, IJO1366_REACTIONS } from "../data/iJO1366Subset";

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
  gpr: string; // gene-protein-reaction rule
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
 * Map EC numbers to metabolic reactions with iJO1366 stoichiometry.
 * Covers 8 subsystems: glycolysis, TCA, PPP, amino acids, nucleotides,
 * fatty acids, cofactors, and transport reactions.
 */
const EC_REACTION_MAP: Record<
  string,
  Array<{
    reactionId: string;
    name: string;
    stoichiometry: Record<string, number>;
    subsystem: string;
    reversible: boolean;
    lb: number;
    ub: number;
  }>
> = {
  // ════════════════════════════════════════════════════════════════════════════
  // GLYCOLYSIS (10 reactions)
  // ════════════════════════════════════════════════════════════════════════════
  "2.7.1.1": [
    {
      reactionId: "HEX1",
      name: "Hexokinase (D-glucose)",
      stoichiometry: { glc__D_c: -1, atp_c: -1, g6p_c: 1, adp_c: 1, h_c: 1 },
      subsystem: "Glycolysis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "5.3.1.9": [
    {
      reactionId: "PGI",
      name: "Glucose-6-phosphate isomerase",
      stoichiometry: { g6p_c: -1, f6p_c: 1 },
      subsystem: "Glycolysis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "2.7.1.11": [
    {
      reactionId: "PFK",
      name: "Phosphofructokinase",
      stoichiometry: { atp_c: -1, f6p_c: -1, adp_c: 1, fdp_c: 1, h_c: 1 },
      subsystem: "Glycolysis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "4.1.2.13": [
    {
      reactionId: "FBA",
      name: "Fructose-bisphosphate aldolase",
      stoichiometry: { fdp_c: -1, dhap_c: 1, g3p_c: 1 },
      subsystem: "Glycolysis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "5.3.1.1": [
    {
      reactionId: "TPI",
      name: "Triose-phosphate isomerase",
      stoichiometry: { dhap_c: -1, g3p_c: 1 },
      subsystem: "Glycolysis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "1.2.1.12": [
    {
      reactionId: "GAPD",
      name: "Glyceraldehyde-3-phosphate dehydrogenase",
      stoichiometry: { g3p_c: -1, nad_c: -1, pi_c: -1, "13dpg_c": 1, nadh_c: 1, h_c: 1 },
      subsystem: "Glycolysis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "2.7.2.3": [
    {
      reactionId: "PGK",
      name: "Phosphoglycerate kinase",
      stoichiometry: { "13dpg_c": -1, adp_c: -1, "3pg_c": 1, atp_c: 1 },
      subsystem: "Glycolysis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "5.4.2.12": [
    {
      reactionId: "PGM",
      name: "Phosphoglycerate mutase",
      stoichiometry: { "3pg_c": -1, "2pg_c": 1 },
      subsystem: "Glycolysis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "4.2.1.11": [
    {
      reactionId: "ENO",
      name: "Enolase",
      stoichiometry: { "2pg_c": -1, h2o_c: 1, pep_c: 1 },
      subsystem: "Glycolysis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "2.7.1.40": [
    {
      reactionId: "PYK",
      name: "Pyruvate kinase",
      stoichiometry: { adp_c: -1, pep_c: -1, h_c: -1, atp_c: 1, pyr_c: 1 },
      subsystem: "Glycolysis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],

  // ════════════════════════════════════════════════════════════════════════════
  // TCA CYCLE (8 reactions)
  // ════════════════════════════════════════════════════════════════════════════
  "2.3.3.1": [
    {
      reactionId: "CS",
      name: "Citrate synthase",
      stoichiometry: { accoa_c: -1, h2o_c: -1, oaa_c: -1, cit_c: 1, coa_c: 1, h_c: 1 },
      subsystem: "TCA Cycle",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "4.2.1.3": [
    {
      reactionId: "ACONT",
      name: "Aconitase",
      stoichiometry: { cit_c: -1, icit_c: 1, h2o_c: 1 },
      subsystem: "TCA Cycle",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "1.1.1.41": [
    {
      reactionId: "ICDHyr",
      name: "Isocitrate dehydrogenase (NADP+)",
      stoichiometry: { icit_c: -1, nadp_c: -1, akg_c: 1, co2_c: 1, nadph_c: 1 },
      subsystem: "TCA Cycle",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "1.2.4.2": [
    {
      reactionId: "AKGDH",
      name: "2-Oxoglutarate dehydrogenase",
      stoichiometry: { akg_c: -1, coa_c: -1, nad_c: -1, succoa_c: 1, co2_c: 1, nadh_c: 1 },
      subsystem: "TCA Cycle",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "6.2.1.5": [
    {
      reactionId: "SUCOAS",
      name: "Succinyl-CoA synthetase (ADP-forming)",
      stoichiometry: { atp_c: -1, coa_c: -1, succ_c: -1, adp_c: 1, pi_c: 1, succoa_c: 1 },
      subsystem: "TCA Cycle",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "1.3.5.1": [
    {
      reactionId: "FRD",
      name: "Fumarate reductase",
      stoichiometry: { fum_c: -1, q8h2_c: -1, succ_c: 1, q8_c: 1 },
      subsystem: "TCA Cycle",
      reversible: false,
      lb: -1000,
      ub: 1000,
    },
  ],
  "4.2.1.2": [
    {
      reactionId: "FUM",
      name: "Fumarase",
      stoichiometry: { fum_c: -1, h2o_c: -1, mal__L_c: 1 },
      subsystem: "TCA Cycle",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "1.1.1.37": [
    {
      reactionId: "MDH",
      name: "Malate dehydrogenase",
      stoichiometry: { mal__L_c: -1, nad_c: -1, oaa_c: 1, nadh_c: 1, h_c: 1 },
      subsystem: "TCA Cycle",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],

  // ════════════════════════════════════════════════════════════════════════════
  // PENTOSE PHOSPHATE PATHWAY (7 reactions)
  // ════════════════════════════════════════════════════════════════════════════
  "1.1.1.49": [
    {
      reactionId: "G6PDH",
      name: "Glucose-6-phosphate 1-dehydrogenase",
      stoichiometry: { g6p_c: -1, nadp_c: -1, "6pgl_c": 1, nadph_c: 1, h_c: 1 },
      subsystem: "Pentose Phosphate",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "3.1.1.31": [
    {
      reactionId: "PGL",
      name: "6-Phosphogluconolactonase",
      stoichiometry: { "6pgl_c": -1, h2o_c: -1, "6pgc_c": 1, h_c: 1 },
      subsystem: "Pentose Phosphate",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "1.1.1.44": [
    {
      reactionId: "GND",
      name: "Phosphogluconate dehydrogenase",
      stoichiometry: { "6pgc_c": -1, nadp_c: -1, ru5p__D_c: 1, co2_c: 1, nadph_c: 1 },
      subsystem: "Pentose Phosphate",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "5.1.3.1": [
    {
      reactionId: "RPE",
      name: "Ribulose 5-phosphate 3-epimerase",
      stoichiometry: { ru5p__D_c: -1, xu5p__D_c: 1 },
      subsystem: "Pentose Phosphate",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "5.3.1.6": [
    {
      reactionId: "RPI",
      name: "Ribose-5-phosphate isomerase",
      stoichiometry: { ru5p__D_c: -1, r5p_c: 1 },
      subsystem: "Pentose Phosphate",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "2.2.1.1": [
    {
      reactionId: "TKT",
      name: "Transketolase",
      stoichiometry: { r5p_c: -1, xu5p__D_c: -1, g3p_c: 1, s7p_c: 1 },
      subsystem: "Pentose Phosphate",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "2.2.1.2": [
    {
      reactionId: "TALA",
      name: "Transaldolase",
      stoichiometry: { s7p_c: -1, g3p_c: -1, f6p_c: 1, e4p_c: 1 },
      subsystem: "Pentose Phosphate",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],

  // ════════════════════════════════════════════════════════════════════════════
  // AMINO ACID BIOSYNTHESIS (20 reactions)
  // ════════════════════════════════════════════════════════════════════════════
  "2.6.1.2": [
    {
      reactionId: "ALATA_L",
      name: "Alanine transaminase",
      stoichiometry: { ala__L_c: -1, akg_c: -1, pyr_c: 1, glu__L_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "6.3.5.4": [
    {
      reactionId: "ASNS1",
      name: "Asparagine synthetase (glutamine-hydrolyzing)",
      stoichiometry: { asp__L_c: -1, gln__L_c: -1, atp_c: -1, asn__L_c: -1, glu__L_c: 1, amp_c: 1, ppi_c: 1, h_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "1.4.1.14": [
    {
      reactionId: "GLUSy",
      name: "Glutamate synthase (NADH)",
      stoichiometry: { akg_c: -1, gln__L_c: -1, nadph_c: -1, h_c: -1, glu__L_c: 2, nadp_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "6.3.1.2": [
    {
      reactionId: "GLNS",
      name: "Glutamine synthetase",
      stoichiometry: { glu__L_c: -1, nh4_c: -1, atp_c: -1, gln__L_c: 1, adp_c: 1, pi_c: 1, h_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "2.1.2.1": [
    {
      reactionId: "GHMT2r",
      name: "Glycine hydroxymethyltransferase",
      stoichiometry: { ser__L_c: -1, thf_c: -1, gly_c: 1, mlthf_c: 1, h2o_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "4.3.1.3": [
    {
      reactionId: "HSDy",
      name: "Homoserine dehydrogenase (NADPH)",
      stoichiometry: { aspsa_c: -1, nadph_c: -1, h_c: -1, hom__L_c: 1, nadp_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "2.7.1.39": [
    {
      reactionId: "HSK",
      name: "Homoserine kinase",
      stoichiometry: { hom__L_c: -1, atp_c: -1, phom_c: 1, adp_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "4.2.3.1": [
    {
      reactionId: "THRS",
      name: "Threonine synthase",
      stoichiometry: { phom_c: -1, h2o_c: -1, thr__L_c: 1, pi_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "4.1.1.48": [
    {
      reactionId: "IGPS",
      name: "Indole-3-glycer-phosphate synthase",
      stoichiometry: { gar_c: -1, e4p_c: -1, gln__L_c: -1, h2o_c: -1, "3ig3p_c": -1, glu__L_c: 1, h_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "2.6.1.57": [
    {
      reactionId: "TYRTA",
      name: "Tyrosine transaminase",
      stoichiometry: { tyr__L_c: -1, akg_c: -1, "34hpp_c": 1, glu__L_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "4.2.1.20": [
    {
      reactionId: "TRPS",
      name: "Tryptophan synthase",
      stoichiometry: { ser__L_c: -1, indole_c: -1, trp__L_c: 1, h2o_c: 1, pyr_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "5.4.99.5": [
    {
      reactionId: "CHORM",
      name: "Chorismate mutase",
      stoichiometry: { chor_c: -1, pphn_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "4.1.3.27": [
    {
      reactionId: "ANS",
      name: "Anthranilate synthase",
      stoichiometry: { chor_c: -1, gln__L_c: -1, h2o_c: -1, anth_c: 1, pyr_c: 1, glu__L_c: 1, h_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "1.1.1.23": [
    {
      reactionId: "HISTD",
      name: "Histidinol dehydrogenase",
      stoichiometry: { hisp_c: -1, h2o_c: -1, nad_c: -2, his__L_c: 1, nadh_c: 2, h_c: 3 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "5.3.1.16": [
    {
      reactionId: "PRPPS",
      name: "Phosphoribosylpyrophosphate synthetase",
      stoichiometry: { r5p_c: -1, atp_c: -1, prpp_c: 1, amp_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "2.7.2.4": [
    {
      reactionId: "ASPK",
      name: "Aspartate kinase",
      stoichiometry: { asp__L_c: -1, atp_c: -1, "4pasp_c": 1, adp_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "1.2.1.11": [
    {
      reactionId: "ASAD",
      name: "Aspartate-semialdehyde dehydrogenase",
      stoichiometry: { "4pasp_c": -1, nadph_c: -1, h_c: -1, aspsa_c: 1, nadp_c: 1, pi_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "4.1.1.20": [
    {
      reactionId: "DAPDC",
      name: "Diaminopimelate decarboxylase",
      stoichiometry: { "26dap__M_c": -1, h_c: -1, lys__L_c: 1, co2_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "2.6.1.44": [
    {
      reactionId: "ALATA_L2",
      name: "Alanine transaminase (glyoxylate)",
      stoichiometry: { ala__L_c: -1, glyox_c: -1, pyr_c: 1, gly_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "2.6.1.42": [
    {
      reactionId: "BCAT",
      name: "Branched-chain amino acid transaminase",
      stoichiometry: { val__L_c: -1, akg_c: -1, "3mob_c": 1, glu__L_c: 1 },
      subsystem: "Amino Acid Biosynthesis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],

  // ════════════════════════════════════════════════════════════════════════════
  // NUCLEOTIDE BIOSYNTHESIS (12 reactions)
  // ════════════════════════════════════════════════════════════════════════════
  "6.3.4.13": [
    {
      reactionId: "PRAGSr",
      name: "Phosphoribosylamine glycine ligase",
      stoichiometry: { gly_c: -1, prpp_c: -1, atp_c: -1, gar_c: 1, adp_c: 1, pi_c: 1 },
      subsystem: "Nucleotide Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "6.3.3.1": [
    {
      reactionId: "PRFGS",
      name: "Phosphoribosylformylglycinamidine synthase",
      stoichiometry: { fgam_c: -1, gln__L_c: -1, atp_c: -1, h2o_c: -1, fpram_c: 1, glu__L_c: 1, adp_c: 1, pi_c: 1 },
      subsystem: "Nucleotide Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "6.3.2.6": [
    {
      reactionId: "PRPPS2",
      name: "Phosphoribosylaminoimidazole carboxylase",
      stoichiometry: { air_c: -1, co2_c: -1, atp_c: -1, h2o_c: -1, cair_c: 1, adp_c: 1, pi_c: 1 },
      subsystem: "Nucleotide Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "6.3.4.4": [
    {
      reactionId: "ADSS",
      name: "Adenylosuccinate synthase",
      stoichiometry: { imp_c: -1, asp__L_c: -1, gtp_c: -1, dcamp_c: 1, gdp_c: 1, pi_c: 1 },
      subsystem: "Nucleotide Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "4.3.2.2": [
    {
      reactionId: "ADSL1r",
      name: "Adenylosuccinate lyase",
      stoichiometry: { dcamp_c: -1, amp_c: 1, fum_c: 1 },
      subsystem: "Nucleotide Biosynthesis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "2.4.2.14": [
    {
      reactionId: "PRPPS3",
      name: "Amidophosphoribosyltransferase",
      stoichiometry: { prpp_c: -1, gln__L_c: -1, h2o_c: -1, pram_c: 1, glu__L_c: 1, ppi_c: 1 },
      subsystem: "Nucleotide Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "6.3.5.2": [
    {
      reactionId: "GMPS",
      name: "GMP synthase",
      stoichiometry: { xmp_c: -1, gln__L_c: -1, atp_c: -1, h2o_c: -1, gmp_c: 1, glu__L_c: 1, amp_c: 1, ppi_c: 1 },
      subsystem: "Nucleotide Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "2.7.4.6": [
    {
      reactionId: "NDPK1",
      name: "Nucleoside-diphosphate kinase (ATP:dGDP)",
      stoichiometry: { atp_c: -1, gdp_c: -1, adp_c: 1, gtp_c: 1 },
      subsystem: "Nucleotide Biosynthesis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "6.3.4.2": [
    {
      reactionId: "CTPS",
      name: "CTP synthase",
      stoichiometry: { utp_c: -1, gln__L_c: -1, atp_c: -1, h2o_c: -1, ctp_c: 1, glu__L_c: 1, adp_c: 1, pi_c: 1 },
      subsystem: "Nucleotide Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "2.4.2.9": [
    {
      reactionId: "UPRT",
      name: "Uracil phosphoribosyltransferase",
      stoichiometry: { ura_c: -1, prpp_c: -1, ump_c: 1, ppi_c: 1 },
      subsystem: "Nucleotide Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "1.3.5.2": [
    {
      reactionId: "DHORD",
      name: "Dihydroorotate dehydrogenase",
      stoichiometry: { dhor__S_c: -1, q8_c: -1, orot_c: 1, q8h2_c: 1 },
      subsystem: "Nucleotide Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "4.1.1.23": [
    {
      reactionId: "OMPDC",
      name: "Orotidine-5-phosphate decarboxylase",
      stoichiometry: { orot5p_c: -1, h_c: -1, ump_c: 1, co2_c: 1 },
      subsystem: "Nucleotide Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],

  // ════════════════════════════════════════════════════════════════════════════
  // FATTY ACID BIOSYNTHESIS (8 reactions)
  // ════════════════════════════════════════════════════════════════════════════
  "6.4.1.2": [
    {
      reactionId: "ACCOAC",
      name: "Acetyl-CoA carboxylase",
      stoichiometry: { accoa_c: -1, atp_c: -1, hco3_c: -1, malcoa_c: 1, adp_c: 1, pi_c: 1, h_c: 1 },
      subsystem: "Fatty Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "2.3.1.39": [
    {
      reactionId: "MALS",
      name: "Malonyl-CoA-ACP transacylase",
      stoichiometry: { malcoa_c: -1, ACP_c: -1, malACP_c: 1, coa_c: 1 },
      subsystem: "Fatty Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "2.3.1.41": [
    {
      reactionId: "KAS1",
      name: "3-Oxoacyl-ACP synthase (acetyl-CoA)",
      stoichiometry: { acACP_c: -1, malACP_c: -1, ACP_c: -1, actACP_c: 1, co2_c: 1 },
      subsystem: "Fatty Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "2.3.1.179": [
    {
      reactionId: "KAS2",
      name: "3-Oxoacyl-ACP synthase (malonyl-ACP)",
      stoichiometry: { butACP_c: -1, malACP_c: -1, ACP_c: -1, "3ocACP_c": 1, co2_c: 1 },
      subsystem: "Fatty Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "1.1.1.100": [
    {
      reactionId: "G3PD",
      name: "Glycerol-3-phosphate dehydrogenase (NADP+)",
      stoichiometry: { dhap_c: -1, nadph_c: -1, h_c: -1, glyc3p_c: 1, nadp_c: 1 },
      subsystem: "Fatty Acid Biosynthesis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
    {
      reactionId: "FABG",
      name: "3-Oxoacyl-ACP reductase",
      stoichiometry: { actACP_c: -1, nadph_c: -1, h_c: -1, "3haACP_c": 1, nadp_c: 1 },
      subsystem: "Fatty Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "2.3.1.15": [
    {
      reactionId: "GPDD",
      name: "Glycerol-3-phosphate acyltransferase",
      stoichiometry: { glyc3p_c: -1, ACP_c: -1, "1ag3p_c": 1, h_c: 1 },
      subsystem: "Fatty Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "4.2.1.59": [
    {
      reactionId: "FABZ",
      name: "3-Hydroxyacyl-ACP dehydratase",
      stoichiometry: { "3haACP_c": -1, b2coa_c: 1, h2o_c: 1 },
      subsystem: "Fatty Acid Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],

  // ════════════════════════════════════════════════════════════════════════════
  // COFACTOR BIOSYNTHESIS (10 reactions)
  // ════════════════════════════════════════════════════════════════════════════
  "6.3.1.5": [
    {
      reactionId: "NADS",
      name: "NAD synthetase (glutamine-hydrolyzing)",
      stoichiometry: { dhnad_c: -1, gln__L_c: -1, atp_c: -1, h2o_c: -1, nad_c: 1, glu__L_c: 1, amp_c: 1, ppi_c: 1 },
      subsystem: "Cofactor Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "6.3.5.3": [
    {
      reactionId: "FMNS",
      name: "FMN synthetase",
      stoichiometry: { ribflv_c: -1, atp_c: -1, fmn_c: 1, amp_c: 1, ppi_c: 1 },
      subsystem: "Cofactor Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "2.7.1.25": [
    {
      reactionId: "ADK",
      name: "Adenylate kinase",
      stoichiometry: { amp_c: -1, atp_c: -1, adp_c: 2 },
      subsystem: "Cofactor Biosynthesis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "2.7.4.3": [
    {
      reactionId: "ADK3",
      name: "Adenylate kinase (GTP)",
      stoichiometry: { amp_c: -1, gtp_c: -1, adp_c: 1, gdp_c: 1 },
      subsystem: "Cofactor Biosynthesis",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "6.3.2.1": [
    {
      reactionId: "PANTS",
      name: "Pantothenate synthetase",
      stoichiometry: { pant__R_c: -1, ala__L_c: -1, atp_c: -1, pnto__R_c: 1, amp_c: 1, ppi_c: 1 },
      subsystem: "Cofactor Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "2.7.7.3": [
    {
      reactionId: "PPNCL2",
      name: "Pantetheine-phosphate adenylyltransferase",
      stoichiometry: { pan4p_c: -1, ctp_c: -1, dpcoa_c: 1, ppi_c: 1 },
      subsystem: "Cofactor Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "4.1.1.15": [
    {
      reactionId: "GLUTRS",
      name: "Glutamate decarboxylase",
      stoichiometry: { glu__L_c: -1, h_c: -1, "4abut_c": 1, co2_c: 1 },
      subsystem: "Cofactor Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "2.7.6.3": [
    {
      reactionId: "HETZK",
      name: "2-Amino-4-hydroxy-6-hydroxymethyl-dihydropteridine pyrophosphokinase",
      stoichiometry: { ahdt_c: -1, atp_c: -1, dhpmp_c: 1, adp_c: 1 },
      subsystem: "Cofactor Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "2.5.1.6": [
    {
      reactionId: "METS",
      name: "Methionine synthase",
      stoichiometry: { hcys__L_c: -1, mlthf_c: -1, met__L_c: 1, thf_c: 1 },
      subsystem: "Cofactor Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "2.1.1.13": [
    {
      reactionId: "MTHFR",
      name: "Methylenetetrahydrofolate reductase (NADPH)",
      stoichiometry: { mlthf_c: -1, nadph_c: -1, h_c: -1, mthf_c: 1, nadp_c: 1 },
      subsystem: "Cofactor Biosynthesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],

  // ════════════════════════════════════════════════════════════════════════════
  // TRANSPORT REACTIONS (15 reactions)
  // ════════════════════════════════════════════════════════════════════════════
  "2.7.1.69": [
    {
      reactionId: "GLCptspp",
      name: "Glucose PTS transport (periplasm)",
      stoichiometry: { glc__D_p: -1, pep_c: -1, g6p_c: 1, pyr_c: 1 },
      subsystem: "Transport",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "7.5.2.1": [
    {
      reactionId: "GLCabcpp",
      name: "Glucose ABC transport (periplasm)",
      stoichiometry: { glc__D_p: -1, atp_c: -1, h2o_c: -1, glc__D_c: 1, adp_c: 1, pi_c: 1, h_c: 1 },
      subsystem: "Transport",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "7.2.2.1": [
    {
      reactionId: "NH4t",
      name: "Ammonium transport",
      stoichiometry: { nh4_e: -1, nh4_c: 1 },
      subsystem: "Transport",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "7.3.2.1": [
    {
      reactionId: "PItex",
      name: "Phosphate transport (periplasm)",
      stoichiometry: { pi_p: -1, h_p: -1, pi_c: 1, h_c: 1 },
      subsystem: "Transport",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "7.3.2.3": [
    {
      reactionId: "SO4t",
      name: "Sulfate transport",
      stoichiometry: { so4_e: -1, so4_c: 1 },
      subsystem: "Transport",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "7.2.2.2": [
    {
      reactionId: "Kt",
      name: "Potassium transport",
      stoichiometry: { k_e: -1, k_c: 1 },
      subsystem: "Transport",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "7.2.2.3": [
    {
      reactionId: "FE2t",
      name: "Iron(II) transport",
      stoichiometry: { fe2_e: -1, fe2_c: 1 },
      subsystem: "Transport",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "7.2.2.4": [
    {
      reactionId: "ZN2t",
      name: "Zinc transport",
      stoichiometry: { zn2_e: -1, zn2_c: 1 },
      subsystem: "Transport",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "7.4.2.1": [
    {
      reactionId: "ACt2rpp",
      name: "Acetate reversible transport (periplasm)",
      stoichiometry: { ac_p: -1, h_p: -1, ac_c: 1, h_c: 1 },
      subsystem: "Transport",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "7.4.2.2": [
    {
      reactionId: "SUCCt2rpp",
      name: "Succinate transport (periplasm)",
      stoichiometry: { succ_p: -1, h_p: -1, succ_c: 1, h_c: 1 },
      subsystem: "Transport",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "7.4.2.3": [
    {
      reactionId: "MALt2rpp",
      name: "L-Malate transport (periplasm)",
      stoichiometry: { mal__L_p: -1, h_p: -1, mal__L_c: 1, h_c: 1 },
      subsystem: "Transport",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "7.4.2.4": [
    {
      reactionId: "PYRt2rpp",
      name: "Pyruvate transport (periplasm)",
      stoichiometry: { pyr_p: -1, h_p: -1, pyr_c: 1, h_c: 1 },
      subsystem: "Transport",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "7.4.2.5": [
    {
      reactionId: "FORt2rpp",
      name: "Formate transport (periplasm)",
      stoichiometry: { for_p: -1, h_p: -1, for_c: 1, h_c: 1 },
      subsystem: "Transport",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "7.4.2.6": [
    {
      reactionId: "LACZtpp",
      name: "D-Lactate transport (periplasm)",
      stoichiometry: { lac__D_p: -1, h_p: -1, lac__D_c: 1, h_c: 1 },
      subsystem: "Transport",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "7.4.2.7": [
    {
      reactionId: "O2t",
      name: "Oxygen transport",
      stoichiometry: { o2_e: -1, o2_c: 1 },
      subsystem: "Transport",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],

  // ════════════════════════════════════════════════════════════════════════════
  // FERMENTATION (5 reactions)
  // ════════════════════════════════════════════════════════════════════════════
  "1.1.1.27": [
    {
      reactionId: "LDH_D",
      name: "D-Lactate dehydrogenase",
      stoichiometry: { pyr_c: -1, nadh_c: -1, h_c: -1, lac__D_c: 1, nad_c: 1 },
      subsystem: "Fermentation",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "4.1.1.1": [
    {
      reactionId: "PDC",
      name: "Pyruvate decarboxylase",
      stoichiometry: { pyr_c: -1, h_c: -1, acald_c: 1, co2_c: 1 },
      subsystem: "Fermentation",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "1.2.1.3": [
    {
      reactionId: "ALDD2x",
      name: "Aldehyde dehydrogenase (acetaldehyde, NAD+)",
      stoichiometry: { acald_c: -1, h2o_c: -1, nad_c: -1, ac_c: 1, nadh_c: 1, h_c: 1 },
      subsystem: "Fermentation",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "1.1.1.1": [
    {
      reactionId: "ALCD2x",
      name: "Alcohol dehydrogenase (ethanol)",
      stoichiometry: { acald_c: -1, nadh_c: -1, h_c: -1, etoh_c: 1, nad_c: 1 },
      subsystem: "Fermentation",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],
  "4.1.1.5": [
    {
      reactionId: "ACLS",
      name: "Acetolactate synthase",
      stoichiometry: { pyr_c: -2, h_c: -1, alac__S_c: 1, co2_c: 1 },
      subsystem: "Fermentation",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "1.1.1.40": [
    {
      reactionId: "ME2",
      name: "Malic enzyme (NADP+)",
      stoichiometry: { mal__L_c: -1, nadp_c: -1, pyr_c: 1, co2_c: 1, nadph_c: 1 },
      subsystem: "Fermentation",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "1.2.1.10": [
    {
      reactionId: "ACALD",
      name: "Acetaldehyde dehydrogenase (acetylating)",
      stoichiometry: { acald_c: -1, coa_c: -1, nad_c: -1, accoa_c: 1, nadh_c: 1, h_c: 1 },
      subsystem: "Fermentation",
      reversible: true,
      lb: -1000,
      ub: 1000,
    },
  ],

  // ════════════════════════════════════════════════════════════════════════════
  // GLUCONEOGENESIS (2 reactions)
  // ════════════════════════════════════════════════════════════════════════════
  "3.1.3.11": [
    {
      reactionId: "FBP",
      name: "Fructose-bisphosphatase",
      stoichiometry: { fdp_c: -1, h2o_c: -1, f6p_c: 1, pi_c: 1 },
      subsystem: "Gluconeogenesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "4.1.1.32": [
    {
      reactionId: "PPCK",
      name: "Phosphoenolpyruvate carboxykinase",
      stoichiometry: { oaa_c: -1, atp_c: -1, pep_c: 1, adp_c: 1, co2_c: 1 },
      subsystem: "Gluconeogenesis",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],

  // ════════════════════════════════════════════════════════════════════════════
  // GLYOXYLATE SHUNT (2 reactions)
  // ════════════════════════════════════════════════════════════════════════════
  "4.1.3.1": [
    {
      reactionId: "ICL",
      name: "Isocitrate lyase",
      stoichiometry: { icit_c: -1, succ_c: 1, glyox_c: 1 },
      subsystem: "Glyoxylate Shunt",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
  "2.3.3.9": [
    {
      reactionId: "MS",
      name: "Malate synthase",
      stoichiometry: { accoa_c: -1, glyox_c: -1, h2o_c: -1, coa_c: -1, mal__L_c: 1, h_c: 1 },
      subsystem: "Glyoxylate Shunt",
      reversible: false,
      lb: 0,
      ub: 1000,
    },
  ],
};

// ── Gene → Reaction Mapping ────────────────────────────────────────────────

/**
 * Map KEGG compound IDs to BiGG-compatible internal metabolite IDs.
 *
 * Covers the most common metabolites from glycolysis, TCA, PPP,
 * amino acid biosynthesis, nucleotide biosynthesis, and cofactor pools.
 * Unknown compounds fall back to a `kegg_CXXXXX_c` convention.
 *
 * Reference: BiGG Models database (bigg.ucsd.edu)
 */
const KEGG_TO_BIGG_METABOLITE: Record<string, string> = {
  // ── Core carbon ──
  C00022: "pyr_c",
  C00024: "accoa_c",
  C00036: "oaa_c",
  C00026: "akg_c",
  C00042: "succ_c",
  C00122: "fum_c",
  C00149: "mal__L_c",
  C00033: "ac_c",
  C00074: "pep_c",
  C00158: "cit_c",
  C00051: "icit_c",
  C00091: "succoa_c",
  C00010: "coa_c",
  C00083: "malcoa_c",
  C00668: "g6p_c",
  C00085: "f6p_c",
  C00354: "fdp_c",
  C00118: "g3p_c",
  C00111: "dhap_c",
  C00236: "13dpg_c",
  C00197: "3pg_c",
  C00631: "2pg_c",
  C00031: "glc__D_c",
  C00084: "acald_c",
  C00469: "etoh_c",
  C00156: "for_c",
  C00186: "lac__D_c",
  C00041: "ala__L_c",
  C00025: "glu__L_c",
  C00064: "gln__L_c",
  C00049: "asp__L_c",
  C00037: "gly_c",
  C00065: "ser__L_c",
  C00183: "val__L_c",
  C00123: "leu__L_c",
  C00407: "ile__L_c",
  C00079: "phe__L_c",
  C00082: "tyr__L_c",
  C00078: "trp__L_c",
  C00134: "his__L_c",
  C00047: "lys__L_c",
  C00073: "met__L_c",
  C00062: "arg__L_c",
  C00148: "pro__L_c",
  C00089: "thr__L_c",
  C00152: "asn__L_c",
  C00097: "cys__L_c",
  // ── Cofactors / redox carriers ──
  C00002: "atp_c",
  C00008: "adp_c",
  C00020: "amp_c",
  C00003: "nad_c",
  C00004: "nadh_c",
  C00005: "nadph_c",
  C00006: "nadp_c",
  C00009: "pi_c",
  C00001: "h2o_c",
  C00011: "co2_c",
  C00007: "o2_c",
  C00288: "h_c",
  C00014: "nh4_c",
  C00016: "fad_c",
  C00018: "pydx5p_c",
  C00120: "btn_c",
  // ── Pentose phosphate ──
  C00199: "ru5p__D_c",
  C00117: "r5p_c",
  C00279: "e4p_c",
  C00231: "s7p_c",
  C05382: "xu5p__D_c",
  // ── Mevalonate / terpenoid ──
  C01144: "mev__R_c",
  C00353: "frdp_c",
  C00235: "dmpp_c",
  C00129: "ipdp_c",
  C00448: "grdp_c",
  // ── Nucleotides ──
  C00035: "gtp_c",
  C00063: "ctp_c",
  C00060: "utp_c",
  C00044: "gtp_c",
  C00054: "gdp_c",
};

/**
 * Parse a KEGG reaction flat-file entry into the internal Reaction format.
 *
 * KEGG equations use KEGG compound IDs (e.g. C00022) and arrows:
 *   <=> (reversible), => (forward), <= (backward)
 *
 * Metabolite IDs are mapped to BiGG-compatible names via KEGG_TO_BIGG_METABOLITE.
 * Unknown compounds use a `kegg_CXXXXX_c` fallback.
 *
 * Reference: https://www.kegg.jp/kegg/rest/weblink.html
 */
function parseKEGGReaction(
  keggEntry: { entry: string; name: string; definition: string; equation: string; enzymes: string },
  gene: GeneAnnotation,
): Reaction | null {
  if (!keggEntry.equation) return null;

  const eq = keggEntry.equation;

  // Determine reversibility from arrow type
  let reversible = true;
  let arrow = "<=>";
  if (eq.includes("<=>")) {
    reversible = true;
    arrow = "<=>";
  } else if (eq.includes("=>")) {
    reversible = false;
    arrow = "=>";
  } else if (eq.includes("<=")) {
    reversible = false;
    arrow = "<=";
  }

  const sides = eq.split(arrow);
  if (sides.length !== 2) return null;

  const stoichiometry: Record<string, number> = {};

  /**
   * Parse one side of a KEGG equation into { metaboliteId → coefficient }.
   * Examples: "2 C00022", "C00001", "n C00002"
   */
  function parseSide(compounds: string, sign: number): void {
    const parts = compounds
      .split("+")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const part of parts) {
      const match = part.match(/^(?:(\d+|n)\s+)?(C\d{5})$/);
      if (!match) continue;
      const coeffStr = match[1];
      const keggId = match[2];
      // "n" or missing coefficient → 1
      const coeff = coeffStr && coeffStr !== "n" ? parseInt(coeffStr, 10) : 1;
      const metId = KEGG_TO_BIGG_METABOLITE[keggId] ?? `kegg_${keggId.toLowerCase()}_c`;
      stoichiometry[metId] = (stoichiometry[metId] ?? 0) + sign * coeff;
    }
  }

  // Left side = reactants (consumed → negative)
  parseSide(sides[0], -1);
  // Right side = products (produced → positive)
  parseSide(sides[1], +1);

  if (Object.keys(stoichiometry).length === 0) return null;

  const reactionId = keggEntry.entry || `KEGG_${gene.ecNumber?.replace(/\./g, "_") ?? "unknown"}`;

  return {
    id: reactionId,
    name: keggEntry.name || keggEntry.definition || reactionId,
    ecNumber: gene.ecNumber ?? "",
    stoichiometry,
    lb: reversible ? -1000 : arrow === "<=" ? -1000 : 0,
    ub: reversible ? 1000 : arrow === "<=" ? 0 : 1000,
    subsystem: "KEGG",
    gpr: gene.geneId,
  };
}

/**
 * Map gene annotations to metabolic reactions.
 *
 * First attempts to match against the static EC_REACTION_MAP (~100 reactions).
 * When an EC number is not found, falls back to the KEGG API to resolve the
 * reaction equation and build an internal Reaction entry.
 *
 * @async because the KEGG fallback issues network requests.
 */
export async function mapGenesToReactions(annotations: GeneAnnotation[]): Promise<Reaction[]> {
  const reactions: Reaction[] = [];
  const seen = new Set<string>();

  for (const gene of annotations) {
    if (!gene.ecNumber) continue;

    const mappedReactions = EC_REACTION_MAP[gene.ecNumber];

    if (mappedReactions) {
      // Static map hit — use directly
      for (const rxn of mappedReactions) {
        if (seen.has(rxn.reactionId)) continue;
        seen.add(rxn.reactionId);

        reactions.push({
          id: rxn.reactionId,
          name: rxn.name,
          ecNumber: gene.ecNumber,
          stoichiometry: rxn.stoichiometry,
          lb: rxn.lb,
          ub: rxn.ub,
          subsystem: rxn.subsystem,
          gpr: gene.geneId,
        });
      }
    } else {
      // KEGG API fallback for unknown EC numbers
      try {
        const res = await fetch(`/api/kegg?reaction=${encodeURIComponent(gene.ecNumber)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.data && data.data.length > 0) {
            const keggEntry = data.data[0];
            const reaction = parseKEGGReaction(keggEntry, gene);
            if (reaction && !seen.has(reaction.id)) {
              seen.add(reaction.id);
              reactions.push(reaction);
            }
          }
        }
      } catch {
        // Network failure — silently skip (will show as gap in model)
      }
    }
  }

  return reactions;
}

// ── Gene-Protein-Reaction (GPR) Rules ──────────────────────────────────────

/**
 * GPR abstract syntax tree node.
 * Represents boolean expressions like "(geneA AND geneB) OR geneC".
 *
 * Reference: Thiele & Palsson (2010) Nature Protocols 5:9-13
 */
export interface GPRNode {
  type: "and" | "or" | "gene";
  genes: string[];
  children: GPRNode[];
}

/**
 * Parse a GPR boolean expression into an AST.
 *
 * Supports: AND, OR, parentheses, gene IDs
 * Example: "(b0001 AND b0002) OR b0003"
 *
 * Grammar:
 *   expr → term (OR term)*
 *   term → factor (AND factor)*
 *   factor → gene | (expr)
 */
export function parseGPR(expression: string): GPRNode {
  const tokens = tokenizeGPR(expression.trim());
  let pos = 0;

  function peek(): string | undefined {
    return tokens[pos];
  }
  function consume(): string {
    return tokens[pos++];
  }

  function parseExpr(): GPRNode {
    let left = parseTerm();
    while (peek() === "OR") {
      consume(); // consume OR
      const right = parseTerm();
      // Flatten: merge OR children
      const leftChildren = left.type === "or" ? left.children : [left];
      const rightChildren = right.type === "or" ? right.children : [right];
      const allGenes = [...leftChildren, ...rightChildren].flatMap((c) => c.genes);
      left = { type: "or", genes: [...new Set(allGenes)], children: [...leftChildren, ...rightChildren] };
    }
    return left;
  }

  function parseTerm(): GPRNode {
    let left = parseFactor();
    while (peek() === "AND") {
      consume(); // consume AND
      const right = parseFactor();
      // Flatten: merge AND children
      const leftChildren = left.type === "and" ? left.children : [left];
      const rightChildren = right.type === "and" ? right.children : [right];
      const allGenes = [...leftChildren, ...rightChildren].flatMap((c) => c.genes);
      left = { type: "and", genes: [...new Set(allGenes)], children: [...leftChildren, ...rightChildren] };
    }
    return left;
  }

  function parseFactor(): GPRNode {
    if (peek() === "(") {
      consume(); // consume (
      const node = parseExpr();
      if (peek() === ")") consume(); // consume )
      return node;
    }
    // Gene ID
    const gene = consume();
    return { type: "gene", genes: [gene], children: [] };
  }

  const result = parseExpr();
  return result;
}

function tokenizeGPR(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    if (expr[i] === " ") {
      i++;
      continue;
    }
    if (expr[i] === "(" || expr[i] === ")") {
      tokens.push(expr[i]);
      i++;
      continue;
    }
    // Read word
    let word = "";
    while (i < expr.length && expr[i] !== " " && expr[i] !== "(" && expr[i] !== ")") {
      word += expr[i];
      i++;
    }
    if (word) tokens.push(word);
  }
  return tokens;
}

/**
 * Compute the probability that a GPR rule is active after gene knockouts.
 *
 * For OR (isozymes): P(active) = 1 - ∏(1 - p_i)
 *   → at least one isozyme must be active
 * For AND (protein complex): P(active) = ∏(p_i)
 *   → all subunits must be active
 * For gene: P = 0 if knocked out, 1 otherwise
 *
 * Reference: Thiele & Palsson (2010) Nature Protocols 5:9-13
 */
export function computeKnockoutProbability(gpr: GPRNode, knockedOut: Set<string>): number {
  if (gpr.type === "gene") {
    return knockedOut.has(gpr.genes[0]) ? 0 : 1;
  }

  const childProbs = gpr.children.map((c) => computeKnockoutProbability(c, knockedOut));

  if (gpr.type === "or") {
    // P(OR) = 1 - ∏(1 - p_i)
    return 1 - childProbs.reduce((prod, p) => prod * (1 - p), 1);
  }

  if (gpr.type === "and") {
    // P(AND) = ∏(p_i)
    return childProbs.reduce((prod, p) => prod * p, 1);
  }

  return 0;
}

/**
 * Evaluate a GPR rule (deterministic version).
 * Returns true if the rule is satisfied.
 */
export function evaluateGPR(gpr: GPRNode, activeGenes: Set<string>): boolean {
  if (gpr.type === "gene") return activeGenes.has(gpr.genes[0]);
  if (gpr.type === "or") return gpr.children.some((c) => evaluateGPR(c, activeGenes));
  if (gpr.type === "and") return gpr.children.every((c) => evaluateGPR(c, activeGenes));
  return false;
}

// ── Biomass Reaction (iJO1366 composition) ──────────────────────────────────

/**
 * Biomass composition data from iJO1366 (E. coli K-12 MG1655).
 * Reference: Orth et al. (2011) Mol Syst Biol 7:535
 *
 * Amino acid fractions (mmol/gDW): Table S1 of Orth 2011
 * Nucleotide fractions: iJO1366 biomass reaction
 * Lipid/cofactor fractions: iJO1366 biomass reaction
 * ATP maintenance: 7.536 mmol/gDW/h (iJO1366 ATPM)
 */
const BIOMASS_AMINO_ACIDS: Record<string, number> = {
  ala__L_c: 0.5137,
  arg__L_c: 0.2958,
  asn__L_c: 0.241,
  asp__L_c: 0.241,
  cys__L_c: 0.0951,
  glu__L_c: 0.266,
  gln__L_c: 0.266,
  gly_c: 0.603,
  his__L_c: 0.0951,
  ile__L_c: 0.2958,
  leu__L_c: 0.4437,
  lys__L_c: 0.3458,
  met__L_c: 0.1538,
  phe__L_c: 0.1818,
  pro__L_c: 0.227,
  ser__L_c: 0.227,
  thr__L_c: 0.266,
  trp__L_c: 0.0556,
  tyr__L_c: 0.1435,
  val__L_c: 0.4236,
};

const BIOMASS_NUCLEOTIDES: Record<string, number> = {
  atp_c: -59.81,
  gtp_c: -21.82,
  ctp_c: -15.49,
  utp_c: -15.49,
  datp_c: -0.0263,
  dgtp_c: -0.0263,
  dctp_c: -0.0263,
  dttp_c: -0.0263,
};

const BIOMASS_LIPIDS: Record<string, number> = {
  pe160_c: -0.073,
  pe161_c: -0.088,
  pg160_c: -0.025,
  pg161_c: -0.03,
  clpn160_c: -0.006,
  clpn161_c: -0.008,
};

const BIOMASS_COFACTORS: Record<string, number> = {
  nad_c: -0.00165,
  nadp_c: -0.000448,
  fad_c: -0.00032,
  coa_c: -0.000526,
  thf_c: -0.000098,
  pydx5p_c: -0.00007,
  ribflv_c: -0.00006,
  thmpp_c: -0.00005,
  btn_c: -0.00003,
  lipopb_c: -0.00002,
};

/**
 * Generate biomass reaction with full iJO1366 composition.
 *
 * Includes: amino acids (20), rNTPs (4), dNTPs (4), lipids (6),
 * cofactors (10), and ATP maintenance (7.536 mmol/gDW/h).
 *
 * Reference: Orth et al. (2011) Mol Syst Biol 7:535
 */
export function generateBiomassReaction(metabolites: Metabolite[]): Reaction {
  const stoichiometry: Record<string, number> = {};

  // Amino acids (consumed → negative)
  for (const [met, coeff] of Object.entries(BIOMASS_AMINO_ACIDS)) {
    stoichiometry[met] = -coeff;
  }

  // Nucleotides (rNTPs for RNA, dNTPs for DNA)
  for (const [met, coeff] of Object.entries(BIOMASS_NUCLEOTIDES)) {
    stoichiometry[met] = coeff;
  }

  // Lipids (phosphatidylethanolamine, phosphatidylglycerol, cardiolipin)
  for (const [met, coeff] of Object.entries(BIOMASS_LIPIDS)) {
    stoichiometry[met] = coeff;
  }

  // Cofactors (NAD, NADP, FAD, CoA, THF, pyridoxal-5-phosphate, riboflavin, thiamine, biotin, lipoate)
  for (const [met, coeff] of Object.entries(BIOMASS_COFACTORS)) {
    stoichiometry[met] = coeff;
  }

  // ATP maintenance: 7.536 mmol/gDW/h
  stoichiometry["atp_c"] = (stoichiometry["atp_c"] || 0) - 7.536;
  stoichiometry["h2o_c"] = -7.536;
  stoichiometry["adp_c"] = 7.536;
  stoichiometry["pi_c"] = 7.536;
  stoichiometry["h_c"] = 7.536;

  // Add metabolites from input that match biomass precursors
  for (const met of metabolites) {
    if (stoichiometry[met.id] === undefined) {
      // Check if this metabolite is a known biomass precursor
      const knownPrecursors = ["g6p_c", "f6p_c", "g3p_c", "pyr_c", "accoa_c", "oaa_c", "akg_c"];
      if (knownPrecursors.includes(met.id)) {
        stoichiometry[met.id] = -0.01; // small contribution
      }
    }
  }

  stoichiometry["biomass_c"] = 1;

  return {
    id: "BIOMASS",
    name: "Biomass synthesis (iJO1366)",
    ecNumber: "",
    stoichiometry,
    lb: 0,
    ub: 1000,
    subsystem: "Biomass",
    gpr: "",
  };
}

// ── Exchange Reactions ──────────────────────────────────────────────────────

function generateExchangeReactions(): Reaction[] {
  const exchanges = [
    { id: "EX_glc__D_e", substrate: "glc__D_e", name: "D-Glucose exchange" },
    { id: "EX_o2_e", substrate: "o2_e", name: "Oxygen exchange" },
    { id: "EX_co2_e", substrate: "co2_e", name: "CO2 exchange" },
    { id: "EX_h2o_e", substrate: "h2o_e", name: "Water exchange" },
    { id: "EX_nh4_e", substrate: "nh4_e", name: "Ammonium exchange" },
    { id: "EX_pi_e", substrate: "pi_e", name: "Phosphate exchange" },
    { id: "EX_so4_e", substrate: "so4_e", name: "Sulfate exchange" },
  ];

  return exchanges.map((ex) => ({
    id: ex.id,
    name: ex.name,
    ecNumber: "",
    stoichiometry: { [ex.substrate]: -1 },
    lb: -10,
    ub: 1000,
    subsystem: "Exchange",
    gpr: "",
  }));
}

// ── Main Reconstruction ─────────────────────────────────────────────────────

/**
 * Reconstruct a genome-scale model from gene annotations.
 */
export async function reconstructGEM(annotations: GeneAnnotation[]): Promise<GEMReconstruction> {
  // Step 1: Map genes to reactions (async — may query KEGG API for unknown EC numbers)
  const geneReactions = await mapGenesToReactions(annotations);

  // Step 2: Add exchange reactions
  const exchangeReactions = generateExchangeReactions();

  // Step 3: Collect all metabolites
  const metaboliteSet = new Set<string>();
  for (const rxn of [...geneReactions, ...exchangeReactions]) {
    for (const met of Object.keys(rxn.stoichiometry)) {
      metaboliteSet.add(met);
    }
  }

  const metabolites: Metabolite[] = Array.from(metaboliteSet).map((id) => ({
    id,
    name: id.replace(/_[a-z]$/, ""),
    formula: "",
    compartment: id.split("_").pop() ?? "c",
  }));

  // Step 4: Add biomass reaction
  const biomassReaction = generateBiomassReaction(metabolites);

  // Step 5: Collect all genes
  const genes = annotations.map((a) => a.geneId);

  const allReactions = [...geneReactions, ...exchangeReactions, biomassReaction];

  return {
    reactions: allReactions,
    metabolites,
    genes,
    biomassReaction: "BIOMASS",
    stats: {
      nReactions: allReactions.length,
      nMetabolites: metabolites.length,
      nGenes: genes.length,
      nExchange: exchangeReactions.length,
      nTransport: 0,
    },
  };
}

// ── Gap Detection ──────────────────────────────────────────────────────────

/**
 * Detect metabolic gaps (orphan metabolites and dead-end reactions).
 *
 * Orphan metabolites: produced but not consumed (or vice versa)
 * Dead-end reactions: cannot carry flux in FBA
 *
 * Reference: Thiele & Palsson (2010) Nature Protocols 5:9-13
 */
export function detectGaps(model: GEMReconstruction): {
  orphanProducers: string[]; // metabolites produced but not consumed
  orphanConsumers: string[]; // metabolites consumed but not produced
  deadEndReactions: string[]; // reactions that cannot carry flux
} {
  const produced = new Set<string>();
  const consumed = new Set<string>();

  for (const rxn of model.reactions) {
    for (const [met, coeff] of Object.entries(rxn.stoichiometry)) {
      if (met === "biomass_c") continue;
      if (coeff > 0) produced.add(met);
      if (coeff < 0) consumed.add(met);
    }
  }

  const orphanProducers = new Set([...produced].filter((m) => !consumed.has(m) && !m.endsWith("_e")));
  const orphanConsumers = new Set([...consumed].filter((m) => !produced.has(m) && !m.endsWith("_e")));

  // Dead-end: reactions where all products are orphan producers or all substrates are orphan consumers
  const deadEndReactions: string[] = [];
  for (const rxn of model.reactions) {
    const products = Object.entries(rxn.stoichiometry)
      .filter(([_, c]) => c > 0)
      .map(([m]) => m);
    const substrates = Object.entries(rxn.stoichiometry)
      .filter(([_, c]) => c < 0)
      .map(([m]) => m);
    if (products.length > 0 && products.every((m) => orphanProducers.has(m))) {
      deadEndReactions.push(rxn.id);
    }
    if (substrates.length > 0 && substrates.every((m) => orphanConsumers.has(m))) {
      deadEndReactions.push(rxn.id);
    }
  }

  return { orphanProducers: [...orphanProducers], orphanConsumers: [...orphanConsumers], deadEndReactions };
}

// ── Essential Gene Analysis ────────────────────────────────────────────────

/**
 * Result of essentiality analysis for a single gene.
 */
export interface EssentialityResult {
  geneId: string;
  essential: boolean;
  growthWithout: number; // growth rate when knocked out (fraction of WT)
  affectedReactions: string[]; // reactions disabled by this knockout
}

/**
 * Epistasis interaction between two genes.
 */
export interface EpistasisResult {
  geneA: string;
  geneB: string;
  singleA: number; // growth with only A knocked out
  singleB: number; // growth with only B knocked out
  double: number; // growth with both knocked out
  epistasis: number; // ε = double - singleA - singleB + WT
  type: "synergistic" | "antagonistic" | "synthetic_lethal" | "neutral";
}

/**
 * Find essential genes by single-gene knockout FBA.
 *
 * For each gene: knock out associated reactions, compute growth rate.
 * Essential if growth < 1% of wild-type.
 *
 * Reference: Joyce et al. (2006) Genome Biol 7:R65 (Keio collection)
 */
export function findEssentialGenes(model: GEMReconstruction): EssentialityResult[] {
  const results: EssentialityResult[] = [];

  // Build stoichiometric matrix for FBA
  const metaboliteIds = [...new Set(model.reactions.flatMap((r) => Object.keys(r.stoichiometry)))];
  const metIdx = new Map(metaboliteIds.map((m, i) => [m, i]));
  const nMets = metaboliteIds.length;
  const nRxns = model.reactions.length;

  // Build S matrix (m×n)
  const S: number[][] = Array.from({ length: nMets }, () => new Array(nRxns).fill(0));
  for (let j = 0; j < nRxns; j++) {
    for (const [met, coeff] of Object.entries(model.reactions[j].stoichiometry)) {
      const i = metIdx.get(met);
      if (i !== undefined) S[i][j] = coeff;
    }
  }

  // Find biomass reaction index
  const biomassIdx = model.reactions.findIndex((r) => r.id === "BIOMASS");

  // Compute wild-type growth via FBA
  const wtGrowth = solveFBA(S, model.reactions, biomassIdx, nMets, nRxns);

  // If solver failed (NaN), mark all genes as essential with 0 growth
  if (isNaN(wtGrowth)) {
    return model.genes.map((geneId) => ({
      geneId,
      essential: true,
      growthWithout: 0,
      affectedReactions: [],
    }));
  }

  for (const geneId of model.genes) {
    // Find reactions associated with this gene via GPR
    const affectedReactions: string[] = [];
    for (const rxn of model.reactions) {
      if (rxn.gpr) {
        // Use word-boundary matching to avoid partial gene ID matches
        // e.g., "lac" should NOT match "lacI" or "lacZ"
        const geneRegex = new RegExp(`\\b${geneId}\\b`);
        if (geneRegex.test(rxn.gpr)) {
          const gpr = parseGPR(rxn.gpr);
          const prob = computeKnockoutProbability(gpr, new Set([geneId]));
          if (prob < 0.01) {
            affectedReactions.push(rxn.id);
          }
        }
      }
    }

    // Knockout: set affected reaction bounds to 0, re-solve FBA
    const knockoutRxns = new Set(affectedReactions);
    const growthWithout = solveFBAWithKnockout(S, model.reactions, biomassIdx, nMets, nRxns, knockoutRxns);

    // Essential if growth drops below 1% of wild-type
    // If wtGrowth is 0, all genes are considered essential (model can't grow)
    const essential = wtGrowth > 0 ? (isNaN(growthWithout) ? true : growthWithout < 0.01 * wtGrowth) : true;
    const growthFraction =
      wtGrowth > 0 ? (isNaN(growthWithout) ? 0 : Math.round((growthWithout / wtGrowth) * 1000) / 1000) : 0;

    results.push({
      geneId,
      essential,
      growthWithout: growthFraction,
      affectedReactions,
    });
  }

  return results;
}

/**
 * Solve FBA using the existing simplexLP solver.
 * Returns optimal biomass flux.
 */
function solveFBA(S: number[][], reactions: Reaction[], biomassIdx: number, nMets: number, nRxns: number): number {
  if (biomassIdx < 0) return 0;

  try {
    const { solveSimplexLP } = require("./simplexLP");
    const c = new Array(nRxns).fill(0);
    c[biomassIdx] = 1;

    const lb = reactions.map((r) => r.lb);
    const ub = reactions.map((r) => r.ub);

    const result = solveSimplexLP({
      c,
      A: S,
      b: new Array(nMets).fill(0),
      lb,
      ub,
      maximize: true,
    });

    return result.status === "optimal" ? result.objective : 0;
  } catch (e) {
    console.warn("[GEM] FBA solver error:", e instanceof Error ? e.message : e);
    return NaN; // Sentinel: caller should check for NaN
  }
}

/**
 * Solve FBA with specific reactions knocked out (bounds set to 0).
 */
function solveFBAWithKnockout(
  S: number[][],
  reactions: Reaction[],
  biomassIdx: number,
  nMets: number,
  nRxns: number,
  knockoutRxns: Set<string>,
): number {
  if (biomassIdx < 0) return 0;

  try {
    const { solveSimplexLP } = require("./simplexLP");
    const c = new Array(nRxns).fill(0);
    c[biomassIdx] = 1;

    const lb = reactions.map((r) => (knockoutRxns.has(r.id) ? 0 : r.lb));
    const ub = reactions.map((r) => (knockoutRxns.has(r.id) ? 0 : r.ub));

    const result = solveSimplexLP({
      c,
      A: S,
      b: new Array(nMets).fill(0),
      lb,
      ub,
      maximize: true,
    });

    return result.status === "optimal" ? result.objective : 0;
  } catch (e) {
    console.warn("[GEM] FBA knockout solver error:", e instanceof Error ? e.message : e);
    return NaN; // Sentinel: caller should check for NaN
  }
}

/**
 * Compute double-knockout epistasis matrix.
 *
 * ε_ij = f(Δi,Δj) - f(Δi) - f(Δj) + f(∅)
 *
 * ε > 0: synergistic (better than expected)
 * ε < 0: antagonistic (worse than expected)
 * ε ≈ -f(Δi): synthetic lethal
 *
 * Reference: Segre et al. (2005) Nat Genet 37:77-83
 */
export function computeEpistasis(model: GEMReconstruction, genePairs: Array<[string, string]>): EpistasisResult[] {
  const essentiality = findEssentialGenes(model);
  const geneMap = new Map(essentiality.map((e) => [e.geneId, e]));

  // Build FBA infrastructure once
  const metaboliteIds = [...new Set(model.reactions.flatMap((r) => Object.keys(r.stoichiometry)))];
  const metIdx = new Map(metaboliteIds.map((m, i) => [m, i]));
  const nMets = metaboliteIds.length;
  const nRxns = model.reactions.length;
  const S: number[][] = Array.from({ length: nMets }, () => new Array(nRxns).fill(0));
  for (let j = 0; j < nRxns; j++) {
    for (const [met, coeff] of Object.entries(model.reactions[j].stoichiometry)) {
      const i = metIdx.get(met);
      if (i !== undefined) S[i][j] = coeff;
    }
  }
  const biomassIdx = model.reactions.findIndex((r) => r.id === "BIOMASS");
  const wtGrowth = solveFBA(S, model.reactions, biomassIdx, nMets, nRxns);

  return genePairs.map(([geneA, geneB]) => {
    const singleA = geneMap.get(geneA)?.growthWithout ?? 1;
    const singleB = geneMap.get(geneB)?.growthWithout ?? 1;

    // Double knockout: combine affected reactions from both genes
    const affectedA = geneMap.get(geneA)?.affectedReactions ?? [];
    const affectedB = geneMap.get(geneB)?.affectedReactions ?? [];
    const allAffected = new Set([...affectedA, ...affectedB]);
    const doubleGrowth = solveFBAWithKnockout(S, model.reactions, biomassIdx, nMets, nRxns, allAffected);

    // If solver failed (NaN), return neutral epistasis with 0 double growth
    if (isNaN(wtGrowth) || isNaN(doubleGrowth)) {
      return { geneA, geneB, singleA, singleB, double: 0, epistasis: 0, type: "neutral" as const };
    }

    const double = wtGrowth > 0 ? doubleGrowth / wtGrowth : 0;
    const epistasis = Math.round((double - singleA - singleB + 1) * 1000) / 1000;

    let type: EpistasisResult["type"] = "neutral";
    if (epistasis > 0.05) type = "synergistic";
    else if (epistasis < -0.05 && double < 0.01) type = "synthetic_lethal";
    else if (epistasis < -0.05) type = "antagonistic";

    return { geneA, geneB, singleA, singleB, double: Math.round(double * 1000) / 1000, epistasis, type };
  });
}
