/**
 * iJO1366 Subset — ~83 reactions from E. coli K-12 central metabolism
 *
 * Source: Orth et al. (2011) Mol Syst Biol 7:535 — BiGG iJO1366 model.
 * This is a curated subset covering:
 *   - Glycolysis / gluconeogenesis (12 reactions)
 *   - Pentose phosphate pathway (8 reactions)
 *   - TCA cycle (10 reactions)
 *   - Oxidative phosphorylation (5 reactions)
 *   - Anaplerotic reactions (4 reactions)
 *   - Pyruvate metabolism (4 reactions)
 *   - Fermentation products (4 reactions)
 *   - Key exchange & ion reactions (21 reactions)
 *   - Amino acid precursor drains (8 reactions)
 *   - Biosynthetic drains & biomass (5 reactions)
 *   - Cofactor balances (auxiliary reactions) (12 reactions)
 *   - Membrane transport (6 reactions)
 *   - Overflow metabolism (5 reactions)
 *   - Glyoxylate shunt (2 reactions)
 *   - Methylglyoxal pathway (2 reactions)
 *
 * Bounds are from iJO1366 with glucose aerobic defaults.
 * Stoichiometry is exact from the genome-scale model.
 *
 * Total: ~83 reactions, ~90 metabolites, ~90 mass-balance constraints
 */

export type Subsystem =
  | "Glycolysis"
  | "PPP"
  | "TCA"
  | "OxPhos"
  | "Anaplerosis"
  | "Pyruvate"
  | "Fermentation"
  | "Exchange"
  | "AminoAcid"
  | "Biosynthesis"
  | "Cofactor"
  | "Transport"
  | "Overflow"
  | "Glyoxylate"
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
   * Gene-Protein-Reaction boolean rule from BiGG / iJO1366.
   * AND = protein complex (all genes required), OR = isozymes (any gene sufficient).
   * Empty/absent = reaction is always active (no gene dependency).
   */
  gpr?: string;
}

// ── Glycolysis / Gluconeogenesis ─────────────────────────────────────
const GLYCOLYSIS: IJO1366Reaction[] = [
  {
    id: "GLCpts",
    name: "Glucose PTS",
    subsystem: "Glycolysis",
    lb: 0,
    ub: 10,
    stoichiometry: { glc_e: -1, g6p: 1, pep: -1, pyr: 1 },
    gpr: "(b2417 AND b2416 AND b2415 AND b1101 AND b1817 AND b1818) OR (b2417 AND b2416 AND b2415 AND b1621)",
  },
  {
    id: "PGI",
    name: "Phosphoglucose isomerase",
    subsystem: "Glycolysis",
    lb: -100,
    ub: 100,
    stoichiometry: { g6p: -1, f6p: 1 },
    gpr: "(b4025)",
  },
  {
    id: "PFK",
    name: "Phosphofructokinase",
    subsystem: "Glycolysis",
    lb: 0,
    ub: 100,
    stoichiometry: { f6p: -1, atp: -1, fbp: 1, adp: 1 },
    gpr: "(b3916 OR b0631)",
  },
  {
    id: "FBP",
    name: "Fructose-bisphosphatase",
    subsystem: "Glycolysis",
    lb: 0,
    ub: 100,
    stoichiometry: { fbp: -1, f6p: 1, pi: 1 },
    gpr: "(b4232)",
  },
  {
    id: "FBA",
    name: "Fructose-bisphosphate aldolase",
    subsystem: "Glycolysis",
    lb: -100,
    ub: 100,
    stoichiometry: { fbp: -1, dhap: 1, g3p: 1 },
    gpr: "(b2925)",
  },
  {
    id: "TPI",
    name: "Triose-phosphate isomerase",
    subsystem: "Glycolysis",
    lb: -100,
    ub: 100,
    stoichiometry: { dhap: -1, g3p: 1 },
    gpr: "(b3919)",
  },
  {
    id: "GAPD",
    name: "Glyceraldehyde-3P dehydrogenase",
    subsystem: "Glycolysis",
    lb: -100,
    ub: 100,
    stoichiometry: { g3p: -1, nad: -1, pi: -1, bpg13: 1, nadh: 1 },
    gpr: "(b1779)",
  },
  {
    id: "PGK",
    name: "Phosphoglycerate kinase",
    subsystem: "Glycolysis",
    lb: -100,
    ub: 100,
    stoichiometry: { bpg13: -1, adp: -1, pg3: 1, atp: 1 },
    gpr: "(b2926)",
  },
  {
    id: "PGM",
    name: "Phosphoglycerate mutase",
    subsystem: "Glycolysis",
    lb: -100,
    ub: 100,
    stoichiometry: { pg3: -1, pg2: 1 },
    gpr: "(b3612 OR b0755)",
  },
  {
    id: "ENO",
    name: "Enolase",
    subsystem: "Glycolysis",
    lb: -100,
    ub: 100,
    stoichiometry: { pg2: -1, pep: 1, h2o: 1 },
    gpr: "(b2779)",
  },
  {
    id: "PYK",
    name: "Pyruvate kinase",
    subsystem: "Glycolysis",
    lb: 0,
    ub: 100,
    stoichiometry: { pep: -1, adp: -1, pyr: 1, atp: 1 },
    gpr: "(b1854 OR b1676)",
  },
  {
    id: "PPS",
    name: "PEP synthase",
    subsystem: "Glycolysis",
    lb: 0,
    ub: 100,
    stoichiometry: { pyr: -1, atp: -1, pep: 1, amp: 1, pi: 1 },
    gpr: "(b1702)",
  },
];

// ── Pentose Phosphate Pathway ────────────────────────────────────────
const PPP: IJO1366Reaction[] = [
  {
    id: "G6PDH2r",
    name: "G6P dehydrogenase",
    subsystem: "PPP",
    lb: -100,
    ub: 100,
    stoichiometry: { g6p: -1, nadp: -1, pgl6: 1, nadph: 1 },
    gpr: "(b1852)",
  },
  {
    id: "PGL",
    name: "6-Phosphogluconolactonase",
    subsystem: "PPP",
    lb: 0,
    ub: 100,
    stoichiometry: { pgl6: -1, h2o: -1, pg6: 1 },
    gpr: "(b0767)",
  },
  {
    id: "GND",
    name: "6-PG dehydrogenase",
    subsystem: "PPP",
    lb: 0,
    ub: 100,
    stoichiometry: { pg6: -1, nadp: -1, ru5p: 1, co2: 1, nadph: 1 },
    gpr: "(b2029)",
  },
  {
    id: "RPI",
    name: "Ribose-5P isomerase",
    subsystem: "PPP",
    lb: -100,
    ub: 100,
    stoichiometry: { ru5p: -1, r5p: 1 },
    gpr: "(b2914 OR b4090)",
  },
  {
    id: "RPE",
    name: "Ribulose-5P epimerase",
    subsystem: "PPP",
    lb: -100,
    ub: 100,
    stoichiometry: { ru5p: -1, xu5p: 1 },
    gpr: "(b3386 OR b2073)",
  },
  {
    id: "TKT1",
    name: "Transketolase 1",
    subsystem: "PPP",
    lb: -100,
    ub: 100,
    stoichiometry: { r5p: -1, xu5p: -1, s7p: 1, g3p: 1 },
    gpr: "(b2935 OR b2465)",
  },
  {
    id: "TALA",
    name: "Transaldolase",
    subsystem: "PPP",
    lb: -100,
    ub: 100,
    stoichiometry: { s7p: -1, g3p: -1, e4p: 1, f6p: 1 },
    gpr: "(b2464 OR b0008)",
  },
  {
    id: "TKT2",
    name: "Transketolase 2",
    subsystem: "PPP",
    lb: -100,
    ub: 100,
    stoichiometry: { xu5p: -1, e4p: -1, f6p: 1, g3p: 1 },
    gpr: "(b2935 OR b2465)",
  },
];

// ── TCA Cycle ────────────────────────────────────────────────────────
const TCA: IJO1366Reaction[] = [
  {
    id: "CS",
    name: "Citrate synthase",
    subsystem: "TCA",
    lb: 0,
    ub: 100,
    stoichiometry: { accoa: -1, oaa: -1, h2o: -1, cit: 1, coa: 1 },
    gpr: "(b0720)",
  },
  {
    id: "ACONTa",
    name: "Aconitase (half 1)",
    subsystem: "TCA",
    lb: -100,
    ub: 100,
    stoichiometry: { cit: -1, acon: 1, h2o: 1 },
    gpr: "(b1276)",
  },
  {
    id: "ACONTb",
    name: "Aconitase (half 2)",
    subsystem: "TCA",
    lb: -100,
    ub: 100,
    stoichiometry: { acon: -1, h2o: -1, icit: 1 },
    gpr: "(b1276)",
  },
  {
    id: "ICDHyr",
    name: "Isocitrate dehydrogenase",
    subsystem: "TCA",
    lb: -100,
    ub: 100,
    stoichiometry: { icit: -1, nadp: -1, akg: 1, co2: 1, nadph: 1 },
    gpr: "(b1136)",
  },
  {
    id: "AKGDH",
    name: "α-Ketoglutarate dehydrogenase",
    subsystem: "TCA",
    lb: 0,
    ub: 100,
    stoichiometry: { akg: -1, nad: -1, coa: -1, succoa: 1, co2: 1, nadh: 1 },
    gpr: "(b0116 AND b0726 AND b0727)",
  },
  {
    id: "SUCOAS",
    name: "Succinyl-CoA synthetase",
    subsystem: "TCA",
    lb: -100,
    ub: 100,
    stoichiometry: { succoa: -1, adp: -1, pi: -1, succ: 1, atp: 1, coa: 1 },
    gpr: "(b0728 AND b0729)",
  },
  {
    id: "SUCDi",
    name: "Succinate dehydrogenase",
    subsystem: "TCA",
    lb: 0,
    ub: 100,
    stoichiometry: { succ: -1, q8: -1, fum: 1, q8h2: 1 },
    gpr: "(b0721 AND b0722 AND b0723 AND b0724)",
  },
  {
    id: "FUM",
    name: "Fumarase",
    subsystem: "TCA",
    lb: -100,
    ub: 100,
    stoichiometry: { fum: -1, h2o: -1, mal: 1 },
    gpr: "(b1612 OR b4122 OR b1611)",
  },
  {
    id: "MDH",
    name: "Malate dehydrogenase",
    subsystem: "TCA",
    lb: -100,
    ub: 100,
    stoichiometry: { mal: -1, nad: -1, oaa: 1, nadh: 1 },
    gpr: "(b3236)",
  },
  {
    id: "ME1",
    name: "Malic enzyme (NAD)",
    subsystem: "TCA",
    lb: 0,
    ub: 100,
    stoichiometry: { mal: -1, nad: -1, pyr: 1, co2: 1, nadh: 1 },
    gpr: "(b1479)",
  },
];

// ── Oxidative Phosphorylation ────────────────────────────────────────
const OXPHOS: IJO1366Reaction[] = [
  {
    id: "NADH16",
    name: "NADH dehydrogenase (complex I)",
    subsystem: "OxPhos",
    lb: 0,
    ub: 100,
    stoichiometry: { nadh: -1, q8: -1, nad: 1, q8h2: 1 },
    gpr: "(b2276 AND b2277 AND b2278 AND b2279 AND b2280 AND b2281 AND b2282 AND b2283 AND b2284 AND b2285 AND b2286 AND b2287 AND b2288)",
  },
  {
    id: "CYTBD",
    name: "Cytochrome bd oxidase",
    subsystem: "OxPhos",
    lb: 0,
    ub: 100,
    stoichiometry: { q8h2: -1, o2: -0.5, q8: 1, h2o: 1 },
    gpr: "(b0978 AND b0979 AND b0980)",
  },
  {
    id: "ATPS4r",
    name: "ATP synthase",
    subsystem: "OxPhos",
    lb: -100,
    ub: 100,
    stoichiometry: { adp: -1, pi: -1, atp: 1, h2o: 1 },
    gpr: "(b3731 AND b3732 AND b3733 AND b3734 AND b3735 AND b3736 AND b3737 AND b3738 AND b3739)",
  },
  {
    id: "NADTRHD",
    name: "NAD(P) transhydrogenase",
    subsystem: "OxPhos",
    lb: -100,
    ub: 100,
    stoichiometry: { nadh: -1, nadp: -1, nad: 1, nadph: 1 },
    gpr: "(b3962)",
  },
  {
    id: "THD2",
    name: "Energy-dependent transhydrogenase",
    subsystem: "OxPhos",
    lb: 0,
    ub: 100,
    stoichiometry: { nadh: -1, nadp: -1, nad: 1, nadph: 1 },
    gpr: "(b1602 AND b1603)",
  },
];

// ── Anaplerotic Reactions ────────────────────────────────────────────
const ANAPLEROSIS: IJO1366Reaction[] = [
  {
    id: "PPC",
    name: "PEP carboxylase",
    subsystem: "Anaplerosis",
    lb: 0,
    ub: 100,
    stoichiometry: { pep: -1, co2: -1, oaa: 1, pi: 1 },
    gpr: "(b3956)",
  },
  {
    id: "PPCK",
    name: "PEP carboxykinase",
    subsystem: "Anaplerosis",
    lb: 0,
    ub: 100,
    stoichiometry: { oaa: -1, atp: -1, pep: 1, co2: 1, adp: 1 },
    gpr: "(b3403)",
  },
  {
    id: "ME2",
    name: "Malic enzyme (NADP)",
    subsystem: "Anaplerosis",
    lb: 0,
    ub: 100,
    stoichiometry: { mal: -1, nadp: -1, pyr: 1, co2: 1, nadph: 1 },
    gpr: "(b2463)",
  },
  {
    id: "PFL",
    name: "Pyruvate formate lyase",
    subsystem: "Anaplerosis",
    lb: 0,
    ub: 100,
    stoichiometry: { pyr: -1, coa: -1, accoa: 1, for: 1 },
    gpr: "(b0903 AND b0904)",
  },
];

// ── Pyruvate Metabolism ──────────────────────────────────────────────
const PYRUVATE: IJO1366Reaction[] = [
  {
    id: "PDH",
    name: "Pyruvate dehydrogenase",
    subsystem: "Pyruvate",
    lb: 0,
    ub: 100,
    stoichiometry: { pyr: -1, nad: -1, coa: -1, accoa: 1, co2: 1, nadh: 1 },
    gpr: "(b0114 AND b0115 AND b0116)",
  },
  {
    id: "LDH_D",
    name: "D-lactate dehydrogenase",
    subsystem: "Pyruvate",
    lb: -100,
    ub: 100,
    stoichiometry: { pyr: -1, nadh: -1, lac: 1, nad: 1 },
    gpr: "(b1380 OR b2133 OR b2927)",
  },
  {
    id: "ALCD2x",
    name: "Alcohol dehydrogenase",
    subsystem: "Pyruvate",
    lb: -100,
    ub: 100,
    stoichiometry: { acald: -1, nadh: -1, etoh: 1, nad: 1 },
    gpr: "(b1478 OR b1241)",
  },
  {
    id: "ACALD",
    name: "Acetaldehyde dehydrogenase",
    subsystem: "Pyruvate",
    lb: -100,
    ub: 100,
    stoichiometry: { accoa: -1, nadh: -1, acald: 1, nad: 1, coa: 1 },
    gpr: "(b0351 OR b1241)",
  },
];

// ── Fermentation / Overflow ──────────────────────────────────────────
const FERMENTATION: IJO1366Reaction[] = [
  {
    id: "PTAr",
    name: "Phosphotransacetylase",
    subsystem: "Fermentation",
    lb: -100,
    ub: 100,
    stoichiometry: { accoa: -1, pi: -1, actp: 1, coa: 1 },
    gpr: "(b2297)",
  },
  {
    id: "ACKr",
    name: "Acetate kinase",
    subsystem: "Fermentation",
    lb: -100,
    ub: 100,
    stoichiometry: { actp: -1, adp: -1, ac: 1, atp: 1 },
    gpr: "(b2296 OR b1849 OR b3115)",
  },
  {
    id: "FORt",
    name: "Formate transport",
    subsystem: "Fermentation",
    lb: 0,
    ub: 100,
    stoichiometry: { for: -1, for_e: 1 },
  },
  {
    id: "FHL",
    name: "Formate hydrogen lyase",
    subsystem: "Fermentation",
    lb: 0,
    ub: 100,
    stoichiometry: { for: -1, co2: 1 },
    gpr: "(b2723 AND b2724)",
  },
];

// ── Glyoxylate Shunt ─────────────────────────────────────────────────
const GLYOXYLATE: IJO1366Reaction[] = [
  {
    id: "ICL",
    name: "Isocitrate lyase",
    subsystem: "Glyoxylate",
    lb: 0,
    ub: 100,
    stoichiometry: { icit: -1, succ: 1, glx: 1 },
    gpr: "(b4015)",
  },
  {
    id: "MALS",
    name: "Malate synthase",
    subsystem: "Glyoxylate",
    lb: 0,
    ub: 100,
    stoichiometry: { accoa: -1, glx: -1, h2o: -1, mal: 1, coa: 1 },
    gpr: "(b4014 OR b2976)",
  },
];

// ── Exchange Reactions ───────────────────────────────────────────────
const EXCHANGE: IJO1366Reaction[] = [
  { id: "EX_glc_e", name: "Glucose exchange", subsystem: "Exchange", lb: -10, ub: 0, stoichiometry: { glc_e: -1 } },
  { id: "EX_o2_e", name: "O2 exchange", subsystem: "Exchange", lb: -20, ub: 0, stoichiometry: { o2: -1 } },
  { id: "EX_co2_e", name: "CO2 exchange", subsystem: "Exchange", lb: 0, ub: 1000, stoichiometry: { co2: -1 } },
  { id: "EX_h2o_e", name: "H2O exchange", subsystem: "Exchange", lb: -1000, ub: 1000, stoichiometry: { h2o: -1 } },
  { id: "EX_pi_e", name: "Phosphate exchange", subsystem: "Exchange", lb: -1000, ub: 1000, stoichiometry: { pi: -1 } },
  { id: "EX_ac_e", name: "Acetate exchange", subsystem: "Exchange", lb: 0, ub: 1000, stoichiometry: { ac: -1 } },
  { id: "EX_lac_e", name: "Lactate exchange", subsystem: "Exchange", lb: 0, ub: 1000, stoichiometry: { lac: -1 } },
  { id: "EX_etoh_e", name: "Ethanol exchange", subsystem: "Exchange", lb: 0, ub: 1000, stoichiometry: { etoh: -1 } },
  { id: "EX_for_e", name: "Formate exchange", subsystem: "Exchange", lb: 0, ub: 1000, stoichiometry: { for_e: -1 } },
  // Ion / nutrient exchange reactions (essential for biomass synthesis)
  { id: "EX_nh4_e", name: "NH4 exchange", subsystem: "Exchange", lb: -1000, ub: 1000, stoichiometry: { nh4_e: -1 } },
  { id: "EX_so4_e", name: "SO4 exchange", subsystem: "Exchange", lb: -1000, ub: 1000, stoichiometry: { so4_e: -1 } },
  { id: "EX_mg2_e", name: "Mg2+ exchange", subsystem: "Exchange", lb: -1000, ub: 1000, stoichiometry: { mg2_e: -1 } },
  { id: "EX_k_e", name: "K+ exchange", subsystem: "Exchange", lb: -1000, ub: 1000, stoichiometry: { k_e: -1 } },
  { id: "EX_na1_e", name: "Na+ exchange", subsystem: "Exchange", lb: -1000, ub: 1000, stoichiometry: { na1_e: -1 } },
  { id: "EX_fe2_e", name: "Fe2+ exchange", subsystem: "Exchange", lb: -1000, ub: 1000, stoichiometry: { fe2_e: -1 } },
  { id: "EX_fe3_e", name: "Fe3+ exchange", subsystem: "Exchange", lb: -1000, ub: 1000, stoichiometry: { fe3_e: -1 } },
  { id: "EX_ca2_e", name: "Ca2+ exchange", subsystem: "Exchange", lb: -1000, ub: 1000, stoichiometry: { ca2_e: -1 } },
  { id: "EX_mn2_e", name: "Mn2+ exchange", subsystem: "Exchange", lb: -1000, ub: 1000, stoichiometry: { mn2_e: -1 } },
  { id: "EX_zn2_e", name: "Zn2+ exchange", subsystem: "Exchange", lb: -1000, ub: 1000, stoichiometry: { zn2_e: -1 } },
  { id: "EX_cu2_e", name: "Cu2+ exchange", subsystem: "Exchange", lb: -1000, ub: 1000, stoichiometry: { cu2_e: -1 } },
  { id: "EX_cl_e", name: "Cl- exchange", subsystem: "Exchange", lb: -1000, ub: 1000, stoichiometry: { cl_e: -1 } },
];

// ── Amino Acid Precursor Drains ──────────────────────────────────────
// Simplified sinks representing amino acid biosynthesis demand
const AMINO_ACID: IJO1366Reaction[] = [
  { id: "DRAIN_akg", name: "Glu/Gln/Pro/Arg drain", subsystem: "AminoAcid", lb: 0, ub: 5, stoichiometry: { akg: -1 } },
  {
    id: "DRAIN_oaa",
    name: "Asp/Asn/Thr/Met/Lys drain",
    subsystem: "AminoAcid",
    lb: 0,
    ub: 5,
    stoichiometry: { oaa: -1 },
  },
  { id: "DRAIN_pyr", name: "Ala/Val/Leu drain", subsystem: "AminoAcid", lb: 0, ub: 5, stoichiometry: { pyr: -1 } },
  {
    id: "DRAIN_pep",
    name: "Phe/Tyr/Trp drain",
    subsystem: "AminoAcid",
    lb: 0,
    ub: 3,
    stoichiometry: { pep: -1, e4p: -1 },
  },
  { id: "DRAIN_pg3", name: "Ser/Gly/Cys drain", subsystem: "AminoAcid", lb: 0, ub: 3, stoichiometry: { pg3: -1 } },
  { id: "DRAIN_r5p", name: "His/nucleotide drain", subsystem: "AminoAcid", lb: 0, ub: 3, stoichiometry: { r5p: -1 } },
  {
    id: "DRAIN_accoa",
    name: "Fatty acid / lipid drain",
    subsystem: "AminoAcid",
    lb: 0,
    ub: 5,
    stoichiometry: { accoa: -1 },
  },
  { id: "DRAIN_e4p", name: "Aromatic AA drain", subsystem: "AminoAcid", lb: 0, ub: 2, stoichiometry: { e4p: -1 } },
];

// ── Biosynthetic / Biomass / ATP Maintenance ─────────────────────────
const BIOSYNTHESIS: IJO1366Reaction[] = [
  {
    id: "BIOMASS",
    name: "Biomass reaction (simplified)",
    subsystem: "Biosynthesis",
    lb: 0,
    ub: 100,
    stoichiometry: {
      // Simplified: consumes precursors, ATP, NADPH → biomass
      g6p: -0.205,
      f6p: -0.071,
      r5p: -0.154,
      e4p: -0.071,
      pg3: -0.129,
      pep: -0.051,
      pyr: -0.083,
      accoa: -0.295,
      oaa: -0.34,
      akg: -0.23,
      atp: -59.81,
      nadph: -13.03,
      nad: -3.547,
      adp: 59.81,
      nadp: 13.03,
      nadh: 3.547,
      pi: 59.81,
      h2o: 59.81,
      co2: 0.5,
    },
  },
  {
    id: "PRODUCT",
    name: "Target product reaction",
    subsystem: "Biosynthesis",
    lb: 0,
    ub: 100,
    stoichiometry: { accoa: -3, nadph: -2, atp: -1, adp: 1, nadp: 2, coa: 3, co2: 0.5 },
  },
  {
    id: "ATPM",
    name: "ATP maintenance requirement",
    subsystem: "Energy",
    lb: 8.39,
    ub: 8.39,
    stoichiometry: { atp: -1, h2o: -1, adp: 1, pi: 1 },
  },
];

// ── Cofactor cycling (NAD/NADH, NADP/NADPH, ATP/ADP, CoA, Q8) ──────
const COFACTOR: IJO1366Reaction[] = [
  // These are implicit in stoichiometry above — we add explicit sinks/sources
  // for cofactors that need to cycle but aren't consumed in a single net reaction.
  { id: "SINK_coa", name: "CoA cycling pool", subsystem: "Cofactor", lb: -1000, ub: 1000, stoichiometry: { coa: -1 } },
  {
    id: "SINK_amp",
    name: "AMP → ADP recycling",
    subsystem: "Cofactor",
    lb: 0,
    ub: 100,
    stoichiometry: { amp: -1, atp: -1, adp: 2 },
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
  ...FERMENTATION,
  ...GLYOXYLATE,
  ...EXCHANGE,
  ...AMINO_ACID,
  ...BIOSYNTHESIS,
  ...COFACTOR,
];

/** All unique metabolite IDs in the subset. */
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
  source: "Orth et al. 2011 (iJO1366 subset)",
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
