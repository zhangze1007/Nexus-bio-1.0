/**
 * e_coli_core — the real, published E. coli core metabolic model
 *
 * Source: Orth, J.D., Fleming, R.M.T. & Palsson, B.O. (2010) "Reconstruction
 * and Use of Microbial Metabolic Networks: the Core Escherichia coli
 * Metabolic Model as an Educational Guide." EcoSal Plus. Loaded via
 * COBRApy's bundled `textbook` sample model (`cobra.io.load_model("textbook")`,
 * COBRApy 0.31.1) and machine-exported by
 * scripts/gen_ecoli_core_data.py -- see that script for full provenance,
 * including how subsystem labels were cross-referenced against the BiGG
 * Models database. DO NOT hand-edit this file; edit the generator instead
 * and re-run it.
 *
 * COBRApy-verified optimum at default bounds (glucose uptake 10, O2
 * unconstrained): growth = 0.8739 h⁻¹ (real E. coli caps out ~0.87-0.90 h⁻¹
 * on glucose minimal media -- this replaces a prior hand-curated subset whose
 * mis-calibrated biomass reaction solved to a biologically impossible 2.05 h⁻¹).
 *
 * 96 reactions (95 from e_coli_core + 1 synthetic
 * backward-compat "PRODUCT" reaction, see PRODUCT_REACTION in the generator),
 * 72 metabolites.
 *
 * Three reaction ids are normalized from e_coli_core's native spelling so
 * src/server/fbaEngine.ts `solveExpandedFBA` keeps working unmodified:
 *   biomass reaction   "Biomass_Ecoli_core" -> "BIOMASS"
 *   glucose exchange    "EX_glc__D_e"        -> "EX_glc_e"
 *   oxygen exchange      "EX_o2_e"            -> "EX_o2_e" (already matched)
 * Every other reaction id and every metabolite id is exactly what COBRApy
 * reports (BiGG naming convention, compartment-suffixed: _c cytoplasm,
 * _e extracellular).
 */

export type Subsystem =
  | "Glycolysis"
  | "PPP"
  | "TCA"
  | "OxPhos"
  | "Anaplerosis"
  | "Pyruvate"
  | "Glutamate"
  | "Exchange"
  | "Transport"
  | "Biosynthesis"
  | "Energy";

export interface IJO1366Reaction {
  id: string;
  name: string;
  subsystem: Subsystem;
  lb: number;
  ub: number;
  /** Stoichiometry: metaboliteId → coefficient (negative = consumed, positive = produced) */
  stoichiometry: Record<string, number>;
  /**
   * Gene-Protein-Reaction boolean rule from BiGG / e_coli_core.
   * AND = protein complex (all genes required), OR = isozymes (any gene sufficient).
   * Empty/absent = reaction is always active (no gene dependency).
   */
  gpr?: string;
}

// ── Glycolysis / Gluconeogenesis ───────────────────────
const GLYCOLYSIS: IJO1366Reaction[] = [
  {
    id: "ENO",
    name: "enolase",
    subsystem: "Glycolysis",
    lb: -1000,
    ub: 1000,
    stoichiometry: { "2pg_c": -1, h2o_c: 1, pep_c: 1 },
    gpr: "b2779",
  },
  {
    id: "FBA",
    name: "fructose-bisphosphate aldolase",
    subsystem: "Glycolysis",
    lb: -1000,
    ub: 1000,
    stoichiometry: { fdp_c: -1, dhap_c: 1, g3p_c: 1 },
    gpr: "b1773 OR b2097 OR b2925",
  },
  {
    id: "FBP",
    name: "fructose-bisphosphatase",
    subsystem: "Glycolysis",
    lb: 0,
    ub: 1000,
    stoichiometry: { fdp_c: -1, h2o_c: -1, f6p_c: 1, pi_c: 1 },
    gpr: "b3925 OR b4232",
  },
  {
    id: "GAPD",
    name: "glyceraldehyde-3-phosphate dehydrogenase",
    subsystem: "Glycolysis",
    lb: -1000,
    ub: 1000,
    stoichiometry: { g3p_c: -1, nad_c: -1, pi_c: -1, "13dpg_c": 1, h_c: 1, nadh_c: 1 },
    gpr: "b1779",
  },
  {
    id: "PDH",
    name: "pyruvate dehydrogenase",
    subsystem: "Glycolysis",
    lb: 0,
    ub: 1000,
    stoichiometry: { coa_c: -1, nad_c: -1, pyr_c: -1, accoa_c: 1, co2_c: 1, nadh_c: 1 },
    gpr: "b0115 AND b0114 AND b0116",
  },
  {
    id: "PFK",
    name: "phosphofructokinase",
    subsystem: "Glycolysis",
    lb: 0,
    ub: 1000,
    stoichiometry: { atp_c: -1, f6p_c: -1, adp_c: 1, fdp_c: 1, h_c: 1 },
    gpr: "b3916 OR b1723",
  },
  {
    id: "PGI",
    name: "glucose-6-phosphate isomerase",
    subsystem: "Glycolysis",
    lb: -1000,
    ub: 1000,
    stoichiometry: { g6p_c: -1, f6p_c: 1 },
    gpr: "b4025",
  },
  {
    id: "PGK",
    name: "phosphoglycerate kinase",
    subsystem: "Glycolysis",
    lb: -1000,
    ub: 1000,
    stoichiometry: { "3pg_c": -1, atp_c: -1, "13dpg_c": 1, adp_c: 1 },
    gpr: "b2926",
  },
  {
    id: "PGM",
    name: "phosphoglycerate mutase",
    subsystem: "Glycolysis",
    lb: -1000,
    ub: 1000,
    stoichiometry: { "2pg_c": -1, "3pg_c": 1 },
    gpr: "b4395 OR b3612 OR b0755",
  },
  {
    id: "PPS",
    name: "phosphoenolpyruvate synthase",
    subsystem: "Glycolysis",
    lb: 0,
    ub: 1000,
    stoichiometry: { atp_c: -1, h2o_c: -1, pyr_c: -1, amp_c: 1, h_c: 2, pep_c: 1, pi_c: 1 },
    gpr: "b1702",
  },
  {
    id: "PYK",
    name: "pyruvate kinase",
    subsystem: "Glycolysis",
    lb: 0,
    ub: 1000,
    stoichiometry: { adp_c: -1, h_c: -1, pep_c: -1, atp_c: 1, pyr_c: 1 },
    gpr: "b1854 OR b1676",
  },
  {
    id: "TPI",
    name: "triose-phosphate isomerase",
    subsystem: "Glycolysis",
    lb: -1000,
    ub: 1000,
    stoichiometry: { dhap_c: -1, g3p_c: 1 },
    gpr: "b3919",
  },
];

// ── Pentose Phosphate Pathway ──────────────────────────
const PPP: IJO1366Reaction[] = [
  {
    id: "G6PDH2r",
    name: "glucose 6-phosphate dehydrogenase",
    subsystem: "PPP",
    lb: -1000,
    ub: 1000,
    stoichiometry: { g6p_c: -1, nadp_c: -1, "6pgl_c": 1, h_c: 1, nadph_c: 1 },
    gpr: "b1852",
  },
  {
    id: "GND",
    name: "phosphogluconate dehydrogenase",
    subsystem: "PPP",
    lb: 0,
    ub: 1000,
    stoichiometry: { "6pgc_c": -1, nadp_c: -1, co2_c: 1, nadph_c: 1, ru5p__D_c: 1 },
    gpr: "b2029",
  },
  {
    id: "PGL",
    name: "6-phosphogluconolactonase",
    subsystem: "PPP",
    lb: 0,
    ub: 1000,
    stoichiometry: { "6pgl_c": -1, h2o_c: -1, "6pgc_c": 1, h_c: 1 },
    gpr: "b0767",
  },
  {
    id: "RPE",
    name: "ribulose 5-phosphate 3-epimerase",
    subsystem: "PPP",
    lb: -1000,
    ub: 1000,
    stoichiometry: { ru5p__D_c: -1, xu5p__D_c: 1 },
    gpr: "b3386 OR b4301",
  },
  {
    id: "RPI",
    name: "ribose-5-phosphate isomerase",
    subsystem: "PPP",
    lb: -1000,
    ub: 1000,
    stoichiometry: { r5p_c: -1, ru5p__D_c: 1 },
    gpr: "b2914 OR b4090",
  },
  {
    id: "TALA",
    name: "transaldolase",
    subsystem: "PPP",
    lb: -1000,
    ub: 1000,
    stoichiometry: { g3p_c: -1, s7p_c: -1, e4p_c: 1, f6p_c: 1 },
    gpr: "b2464 OR b0008",
  },
  {
    id: "TKT1",
    name: "transketolase",
    subsystem: "PPP",
    lb: -1000,
    ub: 1000,
    stoichiometry: { r5p_c: -1, xu5p__D_c: -1, g3p_c: 1, s7p_c: 1 },
    gpr: "b2935 OR b2465",
  },
  {
    id: "TKT2",
    name: "transketolase",
    subsystem: "PPP",
    lb: -1000,
    ub: 1000,
    stoichiometry: { e4p_c: -1, xu5p__D_c: -1, f6p_c: 1, g3p_c: 1 },
    gpr: "b2935 OR b2465",
  },
];

// ── Citric Acid Cycle (TCA) ────────────────────────────
const TCA: IJO1366Reaction[] = [
  {
    id: "ACONTa",
    name: "aconitase (half-reaction A, Citrate hydro-lyase)",
    subsystem: "TCA",
    lb: -1000,
    ub: 1000,
    stoichiometry: { cit_c: -1, acon_C_c: 1, h2o_c: 1 },
    gpr: "b0118 OR b1276",
  },
  {
    id: "ACONTb",
    name: "aconitase (half-reaction B, Isocitrate hydro-lyase)",
    subsystem: "TCA",
    lb: -1000,
    ub: 1000,
    stoichiometry: { acon_C_c: -1, h2o_c: -1, icit_c: 1 },
    gpr: "b0118 OR b1276",
  },
  {
    id: "AKGDH",
    name: "2-Oxogluterate dehydrogenase",
    subsystem: "TCA",
    lb: 0,
    ub: 1000,
    stoichiometry: { akg_c: -1, coa_c: -1, nad_c: -1, co2_c: 1, nadh_c: 1, succoa_c: 1 },
    gpr: "b0726 AND b0116 AND b0727",
  },
  {
    id: "CS",
    name: "citrate synthase",
    subsystem: "TCA",
    lb: 0,
    ub: 1000,
    stoichiometry: { accoa_c: -1, h2o_c: -1, oaa_c: -1, cit_c: 1, coa_c: 1, h_c: 1 },
    gpr: "b0720",
  },
  {
    id: "FUM",
    name: "fumarase",
    subsystem: "TCA",
    lb: -1000,
    ub: 1000,
    stoichiometry: { fum_c: -1, h2o_c: -1, mal__L_c: 1 },
    gpr: "b4122 OR b1612 OR b1611",
  },
  {
    id: "ICDHyr",
    name: "isocitrate dehydrogenase (NADP)",
    subsystem: "TCA",
    lb: -1000,
    ub: 1000,
    stoichiometry: { icit_c: -1, nadp_c: -1, akg_c: 1, co2_c: 1, nadph_c: 1 },
    gpr: "b1136",
  },
  {
    id: "MDH",
    name: "malate dehydrogenase",
    subsystem: "TCA",
    lb: -1000,
    ub: 1000,
    stoichiometry: { mal__L_c: -1, nad_c: -1, h_c: 1, nadh_c: 1, oaa_c: 1 },
    gpr: "b3236",
  },
  {
    id: "SUCOAS",
    name: "succinyl-CoA synthetase (ADP-forming)",
    subsystem: "TCA",
    lb: -1000,
    ub: 1000,
    stoichiometry: { atp_c: -1, coa_c: -1, succ_c: -1, adp_c: 1, pi_c: 1, succoa_c: 1 },
    gpr: "b0728 AND b0729",
  },
];

// ── Oxidative Phosphorylation ──────────────────────────
const OXPHOS: IJO1366Reaction[] = [
  {
    id: "ADK1",
    name: "adenylate kinase",
    subsystem: "OxPhos",
    lb: -1000,
    ub: 1000,
    stoichiometry: { amp_c: -1, atp_c: -1, adp_c: 2 },
    gpr: "b0474",
  },
  {
    id: "ATPS4r",
    name: "ATP synthase (four protons for one ATP)",
    subsystem: "OxPhos",
    lb: -1000,
    ub: 1000,
    stoichiometry: { adp_c: -1, h_e: -4, pi_c: -1, atp_c: 1, h2o_c: 1, h_c: 3 },
    gpr: "(b3738 AND b3736 AND b3737 AND b3735 AND b3733 AND b3731 AND b3732 AND b3734) OR (b3734 AND b3732 AND b3731 AND b3733 AND b3735 AND b3737 AND b3736 AND b3738 AND b3739)",
  },
  {
    id: "CYTBD",
    name: "cytochrome oxidase bd (ubiquinol-8: 2 protons)",
    subsystem: "OxPhos",
    lb: 0,
    ub: 1000,
    stoichiometry: { h_c: -2, o2_c: -0.5, q8h2_c: -1, h2o_c: 1, h_e: 2, q8_c: 1 },
    gpr: "(b0978 AND b0979) OR (b0733 AND b0734)",
  },
  {
    id: "FRD7",
    name: "fumarate reductase",
    subsystem: "OxPhos",
    lb: 0,
    ub: 1000,
    stoichiometry: { fum_c: -1, q8h2_c: -1, q8_c: 1, succ_c: 1 },
    gpr: "b4153 AND b4151 AND b4152 AND b4154",
  },
  {
    id: "NADH16",
    name: "NADH dehydrogenase (ubiquinone-8 & 3 protons)",
    subsystem: "OxPhos",
    lb: 0,
    ub: 1000,
    stoichiometry: { h_c: -4, nadh_c: -1, q8_c: -1, h_e: 3, nad_c: 1, q8h2_c: 1 },
    gpr: "b2287 AND b2285 AND b2283 AND b2281 AND b2279 AND b2277 AND b2276 AND b2278 AND b2280 AND b2282 AND b2284 AND b2286 AND b2288",
  },
  {
    id: "NADTRHD",
    name: "NAD transhydrogenase",
    subsystem: "OxPhos",
    lb: 0,
    ub: 1000,
    stoichiometry: { nad_c: -1, nadph_c: -1, nadh_c: 1, nadp_c: 1 },
    gpr: "b3962 OR (b1602 AND b1603)",
  },
  {
    id: "SUCDi",
    name: "succinate dehydrogenase (irreversible)",
    subsystem: "OxPhos",
    lb: 0,
    ub: 1000,
    stoichiometry: { q8_c: -1, succ_c: -1, fum_c: 1, q8h2_c: 1 },
    gpr: "b0723 AND b0721 AND b0722 AND b0724",
  },
  {
    id: "THD2",
    name: "R NAD - P-transhydrogenase",
    subsystem: "OxPhos",
    lb: 0,
    ub: 1000,
    stoichiometry: { h_e: -2, nadh_c: -1, nadp_c: -1, h_c: 2, nad_c: 1, nadph_c: 1 },
    gpr: "b1602 AND b1603",
  },
];

// ── Anaplerotic Reactions ──────────────────────────────
const ANAPLEROSIS: IJO1366Reaction[] = [
  {
    id: "ICL",
    name: "Isocitrate lyase",
    subsystem: "Anaplerosis",
    lb: 0,
    ub: 1000,
    stoichiometry: { icit_c: -1, glx_c: 1, succ_c: 1 },
    gpr: "b4015",
  },
  {
    id: "MALS",
    name: "malate synthase",
    subsystem: "Anaplerosis",
    lb: 0,
    ub: 1000,
    stoichiometry: { accoa_c: -1, glx_c: -1, h2o_c: -1, coa_c: 1, h_c: 1, mal__L_c: 1 },
    gpr: "b4014 OR b2976",
  },
  {
    id: "ME1",
    name: "malic enzyme (NAD)",
    subsystem: "Anaplerosis",
    lb: 0,
    ub: 1000,
    stoichiometry: { mal__L_c: -1, nad_c: -1, co2_c: 1, nadh_c: 1, pyr_c: 1 },
    gpr: "b1479",
  },
  {
    id: "ME2",
    name: "malic enzyme (NADP)",
    subsystem: "Anaplerosis",
    lb: 0,
    ub: 1000,
    stoichiometry: { mal__L_c: -1, nadp_c: -1, co2_c: 1, nadph_c: 1, pyr_c: 1 },
    gpr: "b2463",
  },
  {
    id: "PPC",
    name: "phosphoenolpyruvate carboxylase",
    subsystem: "Anaplerosis",
    lb: 0,
    ub: 1000,
    stoichiometry: { co2_c: -1, h2o_c: -1, pep_c: -1, h_c: 1, oaa_c: 1, pi_c: 1 },
    gpr: "b3956",
  },
  {
    id: "PPCK",
    name: "phosphoenolpyruvate carboxykinase",
    subsystem: "Anaplerosis",
    lb: 0,
    ub: 1000,
    stoichiometry: { atp_c: -1, oaa_c: -1, adp_c: 1, co2_c: 1, pep_c: 1 },
    gpr: "b3403",
  },
];

// ── Pyruvate Metabolism ────────────────────────────────
const PYRUVATE: IJO1366Reaction[] = [
  {
    id: "ACALD",
    name: "acetaldehyde dehydrogenase (acetylating)",
    subsystem: "Pyruvate",
    lb: -1000,
    ub: 1000,
    stoichiometry: { acald_c: -1, coa_c: -1, nad_c: -1, accoa_c: 1, h_c: 1, nadh_c: 1 },
    gpr: "b0351 OR b1241",
  },
  {
    id: "ACKr",
    name: "acetate kinase",
    subsystem: "Pyruvate",
    lb: -1000,
    ub: 1000,
    stoichiometry: { ac_c: -1, atp_c: -1, actp_c: 1, adp_c: 1 },
    gpr: "b2296 OR b3115 OR b1849",
  },
  {
    id: "ALCD2x",
    name: "alcohol dehydrogenase (ethanol)",
    subsystem: "Pyruvate",
    lb: -1000,
    ub: 1000,
    stoichiometry: { etoh_c: -1, nad_c: -1, acald_c: 1, h_c: 1, nadh_c: 1 },
    gpr: "b1478 OR b0356 OR b1241",
  },
  {
    id: "LDH_D",
    name: "D-lactate dehydrogenase",
    subsystem: "Pyruvate",
    lb: -1000,
    ub: 1000,
    stoichiometry: { lac__D_c: -1, nad_c: -1, h_c: 1, nadh_c: 1, pyr_c: 1 },
    gpr: "b2133 OR b1380",
  },
  {
    id: "PFL",
    name: "pyruvate formate lyase",
    subsystem: "Pyruvate",
    lb: 0,
    ub: 1000,
    stoichiometry: { coa_c: -1, pyr_c: -1, accoa_c: 1, for_c: 1 },
    gpr: "(b0902 AND b3114) OR (b0903 AND b0902 AND b2579) OR (b0902 AND b0903) OR (b3951 AND b3952)",
  },
  {
    id: "PTAr",
    name: "phosphotransacetylase",
    subsystem: "Pyruvate",
    lb: -1000,
    ub: 1000,
    stoichiometry: { accoa_c: -1, pi_c: -1, actp_c: 1, coa_c: 1 },
    gpr: "b2297 OR b2458",
  },
];

// ── Glutamate / Nitrogen Assimilation ──────────────────
const GLUTAMATE: IJO1366Reaction[] = [
  {
    id: "GLNS",
    name: "glutamine synthetase",
    subsystem: "Glutamate",
    lb: 0,
    ub: 1000,
    stoichiometry: { atp_c: -1, glu__L_c: -1, nh4_c: -1, adp_c: 1, gln__L_c: 1, h_c: 1, pi_c: 1 },
    gpr: "b3870 OR b1297",
  },
  {
    id: "GLUDy",
    name: "glutamate dehydrogenase (NADP)",
    subsystem: "Glutamate",
    lb: -1000,
    ub: 1000,
    stoichiometry: { glu__L_c: -1, h2o_c: -1, nadp_c: -1, akg_c: 1, h_c: 1, nadph_c: 1, nh4_c: 1 },
    gpr: "b1761",
  },
  {
    id: "GLUN",
    name: "glutaminase",
    subsystem: "Glutamate",
    lb: 0,
    ub: 1000,
    stoichiometry: { gln__L_c: -1, h2o_c: -1, glu__L_c: 1, nh4_c: 1 },
    gpr: "b0485 OR b1812 OR b1524",
  },
  {
    id: "GLUSy",
    name: "glutamate synthase (NADPH)",
    subsystem: "Glutamate",
    lb: 0,
    ub: 1000,
    stoichiometry: { akg_c: -1, gln__L_c: -1, h_c: -1, nadph_c: -1, glu__L_c: 2, nadp_c: 1 },
    gpr: "b3212 AND b3213",
  },
];

// ── Membrane Transport (incl. inorganic ion transport) ─
const TRANSPORT: IJO1366Reaction[] = [
  {
    id: "ACALDt",
    name: "R acetaldehyde reversible - transport",
    subsystem: "Transport",
    lb: -1000,
    ub: 1000,
    stoichiometry: { acald_e: -1, acald_c: 1 },
    gpr: "s0001",
  },
  {
    id: "ACt2r",
    name: "R acetate reversible transport via proton - symport",
    subsystem: "Transport",
    lb: -1000,
    ub: 1000,
    stoichiometry: { ac_e: -1, h_e: -1, ac_c: 1, h_c: 1 },
  },
  {
    id: "AKGt2r",
    name: "R 2 oxoglutarate reversible transport via - symport",
    subsystem: "Transport",
    lb: -1000,
    ub: 1000,
    stoichiometry: { akg_e: -1, h_e: -1, akg_c: 1, h_c: 1 },
    gpr: "b2587",
  },
  {
    id: "CO2t",
    name: "R CO2 transporter via - diffusion",
    subsystem: "Transport",
    lb: -1000,
    ub: 1000,
    stoichiometry: { co2_e: -1, co2_c: 1 },
    gpr: "s0001",
  },
  {
    id: "D_LACt2",
    name: "R D lactate transport via proton - symport",
    subsystem: "Transport",
    lb: -1000,
    ub: 1000,
    stoichiometry: { h_e: -1, lac__D_e: -1, h_c: 1, lac__D_c: 1 },
    gpr: "b2975 OR b3603",
  },
  {
    id: "ETOHt2r",
    name: "ETOHt2r",
    subsystem: "Transport",
    lb: -1000,
    ub: 1000,
    stoichiometry: { etoh_e: -1, h_e: -1, etoh_c: 1, h_c: 1 },
  },
  {
    id: "FORt2",
    name: "formate transport in via proton symport",
    subsystem: "Transport",
    lb: 0,
    ub: 1000,
    stoichiometry: { for_e: -1, h_e: -1, for_c: 1, h_c: 1 },
    gpr: "b0904 OR b2492",
  },
  {
    id: "FORti",
    name: "formate transport via diffusion",
    subsystem: "Transport",
    lb: 0,
    ub: 1000,
    stoichiometry: { for_c: -1, for_e: 1 },
    gpr: "b0904 OR b2492",
  },
  {
    id: "FRUpts2",
    name: "R Fructose transport via PEPPyr PTS-f6p - generating",
    subsystem: "Transport",
    lb: 0,
    ub: 1000,
    stoichiometry: { fru_e: -1, pep_c: -1, f6p_c: 1, pyr_c: 1 },
    gpr: "b2415 AND b1818 AND b1817 AND b1819 AND b2416",
  },
  {
    id: "FUMt2_2",
    name: "R Fumarate transport via proton symport-2 - H",
    subsystem: "Transport",
    lb: 0,
    ub: 1000,
    stoichiometry: { fum_e: -1, h_e: -2, fum_c: 1, h_c: 2 },
    gpr: "b3528",
  },
  {
    id: "GLCpts",
    name: "D-glucose transport via PEP:Pyr PTS",
    subsystem: "Transport",
    lb: 0,
    ub: 1000,
    stoichiometry: { glc__D_e: -1, pep_c: -1, g6p_c: 1, pyr_c: 1 },
    gpr: "(b2415 AND b1818 AND b1817 AND b1819 AND b2416) OR (b2415 AND b2417 AND b1101 AND b2416) OR (b2415 AND b2417 AND b1621 AND b2416)",
  },
  {
    id: "GLNabc",
    name: "GLNabc",
    subsystem: "Transport",
    lb: 0,
    ub: 1000,
    stoichiometry: { atp_c: -1, gln__L_e: -1, h2o_c: -1, adp_c: 1, gln__L_c: 1, h_c: 1, pi_c: 1 },
    gpr: "b0810 AND b0811 AND b0809",
  },
  {
    id: "GLUt2r",
    name: "R L glutamate transport via proton - symport-reversible",
    subsystem: "Transport",
    lb: -1000,
    ub: 1000,
    stoichiometry: { glu__L_e: -1, h_e: -1, glu__L_c: 1, h_c: 1 },
    gpr: "b4077",
  },
  {
    id: "H2Ot",
    name: "R H2O transport via - diffusion",
    subsystem: "Transport",
    lb: -1000,
    ub: 1000,
    stoichiometry: { h2o_e: -1, h2o_c: 1 },
    gpr: "b0875 OR s0001",
  },
  {
    id: "MALt2_2",
    name: "R Malate transport via proton symport-2 - H",
    subsystem: "Transport",
    lb: 0,
    ub: 1000,
    stoichiometry: { h_e: -2, mal__L_e: -1, h_c: 2, mal__L_c: 1 },
    gpr: "b3528",
  },
  {
    id: "NH4t",
    name: "R ammonia reversible - transport",
    subsystem: "Transport",
    lb: -1000,
    ub: 1000,
    stoichiometry: { nh4_e: -1, nh4_c: 1 },
    gpr: "s0001 OR b0451",
  },
  {
    id: "O2t",
    name: "R o2 - transport-diffusion",
    subsystem: "Transport",
    lb: -1000,
    ub: 1000,
    stoichiometry: { o2_e: -1, o2_c: 1 },
    gpr: "s0001",
  },
  {
    id: "PIt2r",
    name: "R phosphate reversible transport via - symport",
    subsystem: "Transport",
    lb: -1000,
    ub: 1000,
    stoichiometry: { h_e: -1, pi_e: -1, h_c: 1, pi_c: 1 },
    gpr: "b2987 OR b3493",
  },
  {
    id: "PYRt2",
    name: "R pyruvate transport in via proton - symport",
    subsystem: "Transport",
    lb: -1000,
    ub: 1000,
    stoichiometry: { h_e: -1, pyr_e: -1, h_c: 1, pyr_c: 1 },
  },
  {
    id: "SUCCt2_2",
    name: "R succinate transport via proton symport-2 - H",
    subsystem: "Transport",
    lb: 0,
    ub: 1000,
    stoichiometry: { h_e: -2, succ_e: -1, h_c: 2, succ_c: 1 },
    gpr: "b3528",
  },
  {
    id: "SUCCt3",
    name: "succinate transport out via proton antiport",
    subsystem: "Transport",
    lb: 0,
    ub: 1000,
    stoichiometry: { h_e: -1, succ_c: -1, h_c: 1, succ_e: 1 },
  },
];

// ── Extracellular Exchange Reactions ───────────────────
const EXCHANGE: IJO1366Reaction[] = [
  {
    id: "EX_ac_e",
    name: "Acetate exchange",
    subsystem: "Exchange",
    lb: 0,
    ub: 1000,
    stoichiometry: { ac_e: -1 },
  },
  {
    id: "EX_acald_e",
    name: "Acetaldehyde exchange",
    subsystem: "Exchange",
    lb: 0,
    ub: 1000,
    stoichiometry: { acald_e: -1 },
  },
  {
    id: "EX_akg_e",
    name: "2-Oxoglutarate exchange",
    subsystem: "Exchange",
    lb: 0,
    ub: 1000,
    stoichiometry: { akg_e: -1 },
  },
  {
    id: "EX_co2_e",
    name: "CO2 exchange",
    subsystem: "Exchange",
    lb: -1000,
    ub: 1000,
    stoichiometry: { co2_e: -1 },
  },
  {
    id: "EX_etoh_e",
    name: "Ethanol exchange",
    subsystem: "Exchange",
    lb: 0,
    ub: 1000,
    stoichiometry: { etoh_e: -1 },
  },
  {
    id: "EX_for_e",
    name: "Formate exchange",
    subsystem: "Exchange",
    lb: 0,
    ub: 1000,
    stoichiometry: { for_e: -1 },
  },
  {
    id: "EX_fru_e",
    name: "D-Fructose exchange",
    subsystem: "Exchange",
    lb: 0,
    ub: 1000,
    stoichiometry: { fru_e: -1 },
  },
  {
    id: "EX_fum_e",
    name: "Fumarate exchange",
    subsystem: "Exchange",
    lb: 0,
    ub: 1000,
    stoichiometry: { fum_e: -1 },
  },
  {
    id: "EX_glc_e",
    name: "D-Glucose exchange",
    subsystem: "Exchange",
    lb: -10,
    ub: 1000,
    stoichiometry: { glc__D_e: -1 },
  },
  {
    id: "EX_gln__L_e",
    name: "L-Glutamine exchange",
    subsystem: "Exchange",
    lb: 0,
    ub: 1000,
    stoichiometry: { gln__L_e: -1 },
  },
  {
    id: "EX_glu__L_e",
    name: "L-Glutamate exchange",
    subsystem: "Exchange",
    lb: 0,
    ub: 1000,
    stoichiometry: { glu__L_e: -1 },
  },
  {
    id: "EX_h2o_e",
    name: "H2O exchange",
    subsystem: "Exchange",
    lb: -1000,
    ub: 1000,
    stoichiometry: { h2o_e: -1 },
  },
  {
    id: "EX_h_e",
    name: "H+ exchange",
    subsystem: "Exchange",
    lb: -1000,
    ub: 1000,
    stoichiometry: { h_e: -1 },
  },
  {
    id: "EX_lac__D_e",
    name: "D-lactate exchange",
    subsystem: "Exchange",
    lb: 0,
    ub: 1000,
    stoichiometry: { lac__D_e: -1 },
  },
  {
    id: "EX_mal__L_e",
    name: "L-Malate exchange",
    subsystem: "Exchange",
    lb: 0,
    ub: 1000,
    stoichiometry: { mal__L_e: -1 },
  },
  {
    id: "EX_nh4_e",
    name: "Ammonia exchange",
    subsystem: "Exchange",
    lb: -1000,
    ub: 1000,
    stoichiometry: { nh4_e: -1 },
  },
  {
    id: "EX_o2_e",
    name: "O2 exchange",
    subsystem: "Exchange",
    lb: -1000,
    ub: 1000,
    stoichiometry: { o2_e: -1 },
  },
  {
    id: "EX_pi_e",
    name: "Phosphate exchange",
    subsystem: "Exchange",
    lb: -1000,
    ub: 1000,
    stoichiometry: { pi_e: -1 },
  },
  {
    id: "EX_pyr_e",
    name: "Pyruvate exchange",
    subsystem: "Exchange",
    lb: 0,
    ub: 1000,
    stoichiometry: { pyr_e: -1 },
  },
  {
    id: "EX_succ_e",
    name: "Succinate exchange",
    subsystem: "Exchange",
    lb: 0,
    ub: 1000,
    stoichiometry: { succ_e: -1 },
  },
];

// ── Biomass & Product Reactions ────────────────────────
const BIOSYNTHESIS: IJO1366Reaction[] = [
  {
    id: "BIOMASS",
    name: "Biomass Objective Function with GAM",
    subsystem: "Biosynthesis",
    lb: 0,
    ub: 1000,
    stoichiometry: {
      "3pg_c": -1.496,
      accoa_c: -3.7478,
      atp_c: -59.81,
      e4p_c: -0.361,
      f6p_c: -0.0709,
      g3p_c: -0.129,
      g6p_c: -0.205,
      gln__L_c: -0.2557,
      glu__L_c: -4.9414,
      h2o_c: -59.81,
      nad_c: -3.547,
      nadph_c: -13.0279,
      oaa_c: -1.7867,
      pep_c: -0.5191,
      pyr_c: -2.8328,
      r5p_c: -0.8977,
      adp_c: 59.81,
      akg_c: 4.1182,
      coa_c: 3.7478,
      h_c: 59.81,
      nadh_c: 3.547,
      nadp_c: 13.0279,
      pi_c: 59.81,
    },
  },
  {
    id: "PRODUCT",
    name: "Target product reaction (synthetic; not part of e_coli_core)",
    subsystem: "Biosynthesis",
    lb: 0,
    ub: 100,
    stoichiometry: { accoa_c: -3, nadph_c: -2, atp_c: -1, adp_c: 1, nadp_c: 2, coa_c: 3, co2_c: 0.5 },
  },
];

// ── ATP Maintenance ────────────────────────────────────
const ENERGY: IJO1366Reaction[] = [
  {
    id: "ATPM",
    name: "ATP maintenance requirement",
    subsystem: "Energy",
    lb: 8.39,
    ub: 1000,
    stoichiometry: { atp_c: -1, h2o_c: -1, adp_c: 1, h_c: 1, pi_c: 1 },
  },
];

// ── Assemble full network ────────────────────────────────────────────
export const IJO1366_REACTIONS: IJO1366Reaction[] = [
  ...GLYCOLYSIS,
  ...PPP,
  ...TCA,
  ...OXPHOS,
  ...ANAPLEROSIS,
  ...PYRUVATE,
  ...GLUTAMATE,
  ...TRANSPORT,
  ...EXCHANGE,
  ...BIOSYNTHESIS,
  ...ENERGY,
];

/** All unique metabolite IDs in the model. */
export const IJO1366_METABOLITES: string[] = (() => {
  const ids = new Set<string>();
  for (const rxn of IJO1366_REACTIONS) {
    for (const met of Object.keys(rxn.stoichiometry)) {
      ids.add(met);
    }
  }
  return Array.from(ids).sort();
})();

/** Quick stats for display. */
export const IJO1366_STATS = {
  reactions: IJO1366_REACTIONS.length,
  metabolites: IJO1366_METABOLITES.length,
  source:
    "e_coli_core (Orth, Fleming & Palsson 2010); COBRApy textbook model; growth 0.8739 h\u207b\u00b9 verified against COBRApy optimize()",
} as const;

/**
 * Map of reaction ID → GPR rule string for all reactions that have one.
 * Ready to pass to getKnockoutReactions() from fbaGPR.ts.
 */
export const IJO1366_GPR_RULES: Record<string, string> = (() => {
  const rules: Record<string, string> = {};
  for (const rxn of IJO1366_REACTIONS) {
    if (rxn.gpr) {
      rules[rxn.id] = rxn.gpr;
    }
  }
  return rules;
})();
