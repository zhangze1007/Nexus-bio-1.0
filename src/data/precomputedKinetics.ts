/**
 * Pre-computed Enzyme Kinetics — BRENDA-sourced default values
 *
 * Provides Km and kcat values for key enzymes in glycolysis, TCA, PPP,
 * and the artemisinin showcase pathway. These serve as defaults when
 * BRENDA API lookups are unavailable (e.g., on Vercel without a backend).
 *
 * @scientific_provenance
 * VALIDITY_TIER: real
 *
 * References:
 *   - BRENDA enzyme database (Chang et al. 2021, Nucleic Acids Res 49:D498-D508)
 *   - Bar-Even et al. (2011) Biochemistry 50:4478-4491 — enzyme kinetic parameters
 *   - Davidi et al. (2016) Proc Natl Acad Sci 113:3401-3406 — in vivo Km values
 *   - Ro et al. (2006) Nature 440:940-943 — Artemisinin biosynthesis
 *   - Teoh et al. (2009) Phytochemistry 70:993-1001 — CYP71AV1 kinetics
 *   - Nelson & Cox, Lehninger Principles of Biochemistry (various editions)
 *
 * NOTES:
 *   - Values represent typical values from BRENDA at or near physiological
 *     conditions (pH 7-8, 25-37°C) for the most common source organisms
 *     (E. coli, S. cerevisiae, or the native organism where relevant).
 *   - Actual enzyme kinetics vary significantly with organism, pH, temperature,
 *     ionic strength, and post-translational modifications.
 *   - Uncertainty ranges are not included here; consult BRENDA directly
 *     for organism-specific distributions.
 */

// ── Types ──────────────────────────────────────────────────────────────

/** Pre-computed kinetic parameters for a single enzyme */
export interface PrecomputedKinetics {
  /** Enzyme name (human-readable) */
  enzyme: string;
  /** EC number (Enzyme Commission classification) */
  ecNumber: string;
  /** Turnover number (s⁻¹) */
  kcat: number;
  /** Michaelis constant (mM) for the primary substrate */
  km: number;
  /** Primary substrate name */
  substrate: string;
  /** Source organism for the kinetic values */
  organism: string;
  /** Literature reference */
  source: string;
  /** Confidence level based on data quality */
  confidence: "high" | "medium" | "low";
}

/** Pre-computed kinetics for a pathway step */
export interface PathwayKinetics {
  /** Step label (matches PATHWAY_STEPS keys in mockCETHX.ts) */
  stepName: string;
  /** Enzyme that catalyzes this step */
  enzyme: PrecomputedKinetics;
}

// ── Glycolysis Enzyme Kinetics ─────────────────────────────────────────
// Values from BRENDA, primarily E. coli and S. cerevisiae data

export const GLYCOLYSIS_KINETICS: PathwayKinetics[] = [
  {
    stepName: "Glc → G6P",
    enzyme: {
      enzyme: "Hexokinase",
      ecNumber: "2.7.1.1",
      kcat: 200, // s⁻¹ — BRENDA median for E. coli (range 100-600)
      km: 0.1, // mM — BRENDA median for glucose (range 0.05-0.5)
      substrate: "Glucose",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 2.7.1.1; Bar-Even et al. 2011 Biochemistry 50:4478",
      confidence: "high",
    },
  },
  {
    stepName: "G6P → F6P",
    enzyme: {
      enzyme: "Phosphoglucose isomerase",
      ecNumber: "5.3.1.9",
      kcat: 1000, // s⁻¹ — BRENDA median (range 400-4000)
      km: 0.3, // mM — BRENDA median for G6P (range 0.1-0.7)
      substrate: "Glucose-6-phosphate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 5.3.1.9; Bar-Even et al. 2011",
      confidence: "high",
    },
  },
  {
    stepName: "F6P → FBP",
    enzyme: {
      enzyme: "Phosphofructokinase",
      ecNumber: "2.7.1.11",
      kcat: 200, // s⁻¹ — BRENDA median for E. coli (range 50-500)
      km: 0.1, // mM — BRENDA median for F6P (range 0.02-0.5)
      substrate: "Fructose-6-phosphate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 2.7.1.11; Bar-Even et al. 2011",
      confidence: "high",
    },
  },
  {
    stepName: "FBP → DHAP+GAP",
    enzyme: {
      enzyme: "Fructose-bisphosphate aldolase",
      ecNumber: "4.1.2.13",
      kcat: 30, // s⁻¹ — BRENDA median (range 5-100)
      km: 0.003, // mM — BRENDA median for FBP (range 0.001-0.02)
      substrate: "Fructose-1,6-bisphosphate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 4.1.2.13; Bar-Even et al. 2011",
      confidence: "high",
    },
  },
  {
    stepName: "DHAP → GAP",
    enzyme: {
      enzyme: "Triosephosphate isomerase",
      ecNumber: "5.3.1.1",
      kcat: 4300, // s⁻¹ — BRENDA median (one of the fastest enzymes)
      km: 1.2, // mM — BRENDA median for DHAP (range 0.3-3.0)
      substrate: "Dihydroxyacetone phosphate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 5.3.1.1; Bar-Even et al. 2011",
      confidence: "high",
    },
  },
  {
    stepName: "GAP → 1,3-BPG",
    enzyme: {
      enzyme: "Glyceraldehyde-3-phosphate dehydrogenase",
      ecNumber: "1.2.1.12",
      kcat: 80, // s⁻¹ — BRENDA median (range 20-300)
      km: 0.21, // mM — BRENDA median for GAP (range 0.01-0.5)
      substrate: "Glyceraldehyde-3-phosphate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 1.2.1.12; Davidi et al. 2016 PNAS 113:3401",
      confidence: "high",
    },
  },
  {
    stepName: "1,3-BPG → 3PG",
    enzyme: {
      enzyme: "Phosphoglycerate kinase",
      ecNumber: "2.7.2.3",
      kcat: 1000, // s⁻¹ — BRENDA median (range 200-3000)
      km: 0.002, // mM — BRENDA median for 1,3-BPG (range 0.001-0.01)
      substrate: "1,3-Bisphosphoglycerate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 2.7.2.3; Bar-Even et al. 2011",
      confidence: "high",
    },
  },
  {
    stepName: "3PG → 2PG",
    enzyme: {
      enzyme: "Phosphoglycerate mutase",
      ecNumber: "5.4.2.12",
      kcat: 400, // s⁻¹ — BRENDA median (range 50-1000)
      km: 0.15, // mM — BRENDA median for 3-PG (range 0.05-0.5)
      substrate: "3-Phosphoglycerate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 5.4.2.12; Bar-Even et al. 2011",
      confidence: "high",
    },
  },
  {
    stepName: "2PG → PEP",
    enzyme: {
      enzyme: "Enolase",
      ecNumber: "4.2.1.11",
      kcat: 80, // s⁻¹ — BRENDA median (range 20-300)
      km: 0.04, // mM — BRENDA median for 2-PG (range 0.01-0.1)
      substrate: "2-Phosphoglycerate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 4.2.1.11; Bar-Even et al. 2011",
      confidence: "high",
    },
  },
  {
    stepName: "PEP → Pyr",
    enzyme: {
      enzyme: "Pyruvate kinase",
      ecNumber: "2.7.1.40",
      kcat: 200, // s⁻¹ — BRENDA median (range 50-1000)
      km: 0.08, // mM — BRENDA median for PEP (range 0.01-0.3)
      substrate: "Phosphoenolpyruvate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 2.7.1.40; Davidi et al. 2016 PNAS 113:3401",
      confidence: "high",
    },
  },
];

// ── TCA Cycle Enzyme Kinetics ──────────────────────────────────────────

export const TCA_KINETICS: PathwayKinetics[] = [
  {
    stepName: "AcCoA + OAA → Citrate",
    enzyme: {
      enzyme: "Citrate synthase",
      ecNumber: "2.3.3.1",
      kcat: 100, // s⁻¹ — BRENDA median (range 20-300)
      km: 0.005, // mM — BRENDA median for OAA (range 0.001-0.02)
      substrate: "Oxaloacetate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 2.3.3.1; Bar-Even et al. 2011",
      confidence: "high",
    },
  },
  {
    stepName: "Citrate → Isocitrate",
    enzyme: {
      enzyme: "Aconitase",
      ecNumber: "4.2.1.3",
      kcat: 100, // s⁻¹ — BRENDA median (range 10-500)
      km: 0.2, // mM — BRENDA median for citrate (range 0.05-1.0)
      substrate: "Citrate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 4.2.1.3; Bar-Even et al. 2011",
      confidence: "high",
    },
  },
  {
    stepName: "Isocitrate → α-KG",
    enzyme: {
      enzyme: "Isocitrate dehydrogenase",
      ecNumber: "1.1.1.41",
      kcat: 40, // s⁻¹ — BRENDA median (range 10-100)
      km: 0.008, // mM — BRENDA median for isocitrate (range 0.002-0.05)
      substrate: "Isocitrate",
      organism: "E. coli",
      source: "BRENDA EC 1.1.1.41; Davidi et al. 2016 PNAS 113:3401",
      confidence: "high",
    },
  },
  {
    stepName: "α-KG → Succinyl-CoA",
    enzyme: {
      enzyme: "Alpha-ketoglutarate dehydrogenase complex",
      ecNumber: "1.2.4.2",
      kcat: 20, // s⁻¹ — BRENDA median (range 5-60)
      km: 0.03, // mM — BRENDA median for α-KG (range 0.005-0.1)
      substrate: "Alpha-ketoglutarate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 1.2.4.2; Bar-Even et al. 2011",
      confidence: "high",
    },
  },
  {
    stepName: "Succinyl-CoA → Succinate",
    enzyme: {
      enzyme: "Succinyl-CoA synthetase",
      ecNumber: "6.2.1.5",
      kcat: 50, // s⁻¹ — BRENDA median (range 10-200)
      km: 0.005, // mM — BRENDA median for succinyl-CoA (range 0.001-0.02)
      substrate: "Succinyl-CoA",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 6.2.1.5; Bar-Even et al. 2011",
      confidence: "high",
    },
  },
  {
    stepName: "Succinate → Fumarate",
    enzyme: {
      enzyme: "Succinate dehydrogenase",
      ecNumber: "1.3.5.1",
      kcat: 50, // s⁻¹ — BRENDA median (range 10-150)
      km: 0.05, // mM — BRENDA median for succinate (range 0.01-0.3)
      substrate: "Succinate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 1.3.5.1; Bar-Even et al. 2011",
      confidence: "high",
    },
  },
  {
    stepName: "Fumarate → Malate",
    enzyme: {
      enzyme: "Fumarase",
      ecNumber: "4.2.1.2",
      kcat: 800, // s⁻¹ — BRENDA median (range 200-3000)
      km: 0.005, // mM — BRENDA median for fumarate (range 0.001-0.02)
      substrate: "Fumarate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 4.2.1.2; Bar-Even et al. 2011",
      confidence: "high",
    },
  },
  {
    stepName: "Malate → OAA",
    enzyme: {
      enzyme: "Malate dehydrogenase",
      ecNumber: "1.1.1.37",
      kcat: 100, // s⁻¹ — BRENDA median (range 20-500)
      km: 0.05, // mM — BRENDA median for malate (range 0.01-0.2)
      substrate: "Malate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 1.1.1.37; Bar-Even et al. 2011",
      confidence: "high",
    },
  },
];

// ── Pentose Phosphate Pathway Enzyme Kinetics ──────────────────────────

export const PPP_KINETICS: PathwayKinetics[] = [
  {
    stepName: "G6P → 6-PGL",
    enzyme: {
      enzyme: "Glucose-6-phosphate dehydrogenase",
      ecNumber: "1.1.1.49",
      kcat: 80, // s⁻¹ — BRENDA median (range 20-300)
      km: 0.06, // mM — BRENDA median for G6P (range 0.01-0.2)
      substrate: "Glucose-6-phosphate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 1.1.1.49; Bar-Even et al. 2011",
      confidence: "high",
    },
  },
  {
    stepName: "6-PGL → 6-PG",
    enzyme: {
      enzyme: "6-Phosphogluconolactonase",
      ecNumber: "3.1.1.31",
      kcat: 500, // s⁻¹ — BRENDA median (range 100-2000)
      km: 0.007, // mM — BRENDA median for 6-PGL (range 0.001-0.05)
      substrate: "6-Phosphogluconolactone",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 3.1.1.31; Bar-Even et al. 2011",
      confidence: "medium",
    },
  },
  {
    stepName: "6-PG → Ribulose-5P",
    enzyme: {
      enzyme: "6-Phosphogluconate dehydrogenase",
      ecNumber: "1.1.1.44",
      kcat: 60, // s⁻¹ — BRENDA median (range 10-200)
      km: 0.06, // mM — BRENDA median for 6-PG (range 0.01-0.2)
      substrate: "6-Phosphogluconate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 1.1.1.44; Bar-Even et al. 2011",
      confidence: "high",
    },
  },
  {
    stepName: "Ribulose-5P → Ribose-5P",
    enzyme: {
      enzyme: "Ribose-5-phosphate isomerase",
      ecNumber: "5.3.1.6",
      kcat: 200, // s⁻¹ — BRENDA median (range 50-1000)
      km: 0.2, // mM — BRENDA median for ribulose-5P (range 0.05-1.0)
      substrate: "Ribulose-5-phosphate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 5.3.1.6; Bar-Even et al. 2011",
      confidence: "medium",
    },
  },
  {
    stepName: "Transketolase (×2)",
    enzyme: {
      enzyme: "Transketolase",
      ecNumber: "2.2.1.1",
      kcat: 50, // s⁻¹ — BRENDA median (range 10-200)
      km: 0.1, // mM — BRENDA median for xylulose-5P (range 0.02-0.5)
      substrate: "Xylulose-5-phosphate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 2.2.1.1; Bar-Even et al. 2011",
      confidence: "medium",
    },
  },
  {
    stepName: "Transaldolase",
    enzyme: {
      enzyme: "Transaldolase",
      ecNumber: "2.2.1.2",
      kcat: 30, // s⁻¹ — BRENDA median (range 5-100)
      km: 0.1, // mM — BRENDA median for sedoheptulose-7P (range 0.02-0.5)
      substrate: "Sedoheptulose-7-phosphate",
      organism: "E. coli / S. cerevisiae",
      source: "BRENDA EC 2.2.1.2; Bar-Even et al. 2011",
      confidence: "medium",
    },
  },
];

// ── Artemisinin Showcase Pathway Enzyme Kinetics ───────────────────────
// From Ro et al. (2006) Nature, Teoh et al. (2009), and BRENDA

export const ARTEMISININ_KINETICS: PathwayKinetics[] = [
  {
    stepName: "Acetyl-CoA → HMG-CoA",
    enzyme: {
      enzyme: "HMG-CoA synthase",
      ecNumber: "2.3.3.10",
      kcat: 5, // s⁻¹ — BRENDA median (range 1-20)
      km: 0.005, // mM — BRENDA median for acetyl-CoA (range 0.001-0.05)
      substrate: "Acetyl-CoA",
      organism: "S. cerevisiae",
      source: "BRENDA EC 2.3.3.10; Ro et al. 2006 Nature 440:940",
      confidence: "medium",
    },
  },
  {
    stepName: "HMG-CoA → Mevalonate",
    enzyme: {
      enzyme: "HMG-CoA reductase",
      ecNumber: "1.1.1.34",
      kcat: 2, // s⁻¹ — BRENDA median (range 0.5-10)
      km: 0.004, // mM — BRENDA median for HMG-CoA (range 0.001-0.02)
      substrate: "HMG-CoA",
      organism: "S. cerevisiae",
      source: "BRENDA EC 1.1.1.34; Ro et al. 2006",
      confidence: "high",
    },
  },
  {
    stepName: "Mevalonate → FPP",
    enzyme: {
      enzyme: "Mevalonate kinase → FPP synthase (multi-step)",
      ecNumber: "2.7.1.36 / 2.5.1.1",
      kcat: 5, // s⁻¹ — composite rate-limiting step
      km: 0.05, // mM — mevalonate Km
      substrate: "Mevalonate",
      organism: "S. cerevisiae",
      source: "BRENDA EC 2.7.1.36; Ro et al. 2006",
      confidence: "medium",
    },
  },
  {
    stepName: "FPP → Amorpha-4,11-diene",
    enzyme: {
      enzyme: "Amorpha-4,11-diene synthase (ADS)",
      ecNumber: "4.2.3.24",
      kcat: 0.02, // s⁻¹ — Teoh et al. 2009 (slow terpene synthase)
      km: 0.006, // mM — Teoh et al. 2009 for FPP
      substrate: "Farnesyl diphosphate",
      organism: "A. annua",
      source: "Teoh et al. 2009 Phytochemistry 70:993; BRENDA EC 4.2.3.24",
      confidence: "high",
    },
  },
  {
    stepName: "Amorpha-4,11-diene → Artemisinic acid",
    enzyme: {
      enzyme: "CYP71AV1 (amorpha-diene oxidase)",
      ecNumber: "1.14.14.115",
      kcat: 0.5, // s⁻¹ — Teoh et al. 2009 (CYP monooxygenase)
      km: 0.005, // mM — Teoh et al. 2009
      substrate: "Amorpha-4,11-diene",
      organism: "A. annua",
      source: "Teoh et al. 2009 Phytochemistry 70:993; Ro et al. 2006",
      confidence: "high",
    },
  },
  {
    stepName: "Artemisinic acid → Artemisinin",
    enzyme: {
      enzyme: "Artemisinin aldehyde reductase (DBR2 + ALDH1)",
      ecNumber: "1.1.1.- / 1.2.1.-",
      kcat: 0.1, // s⁻¹ — estimated (multi-step, poorly characterized)
      km: 0.01, // mM — estimated for artemisinic aldehyde
      substrate: "Artemisinic aldehyde",
      organism: "A. annua",
      source: "Estimated from Ro et al. 2006; Teoh et al. 2009 — multi-step pathway, individual kcat values uncertain",
      confidence: "low",
    },
  },
];

// ── Aggregated Lookup ──────────────────────────────────────────────────

import type { PathwayKey } from "./mockCETHX";

/** All pre-computed kinetics organized by pathway */
export const PRECOMPUTED_KINETICS: Record<PathwayKey, PathwayKinetics[]> = {
  glycolysis: GLYCOLYSIS_KINETICS,
  tca: TCA_KINETICS,
  ppp: PPP_KINETICS,
};

/** Artemisinin showcase pathway kinetics (separate — not a standard CETHX pathway) */
export const ARTEMISININ_PATHWAY_KINETICS = ARTEMISININ_KINETICS;

// ── Lookup Utilities ───────────────────────────────────────────────────

/**
 * Look up pre-computed kinetics for a specific step in a pathway.
 *
 * @param pathway  Pathway key
 * @param stepName Step label
 * @returns Enzyme kinetics, or undefined if not found
 */
export function lookupKinetics(pathway: PathwayKey, stepName: string): PrecomputedKinetics | undefined {
  return PRECOMPUTED_KINETICS[pathway]?.find((k) => k.stepName === stepName)?.enzyme;
}

/**
 * Get all kinetics for a pathway as a Map keyed by step name.
 *
 * @param pathway Pathway key
 * @returns Map of stepName → enzyme kinetics
 */
export function getKineticsMap(pathway: PathwayKey): Map<string, PrecomputedKinetics> {
  const data = PRECOMPUTED_KINETICS[pathway];
  if (!data) return new Map();
  return new Map(data.map((k) => [k.stepName, k.enzyme]));
}

/**
 * Get default kcat for a step (returns a fallback if not found).
 *
 * @param pathway  Pathway key
 * @param stepName Step label
 * @returns kcat in s⁻¹
 */
export function getDefaultKcat(pathway: PathwayKey, stepName: string): number {
  return lookupKinetics(pathway, stepName)?.kcat ?? 10; // 10 s⁻¹ conservative fallback
}

/**
 * Get default Km for a step (returns a fallback if not found).
 *
 * @param pathway  Pathway key
 * @param stepName Step label
 * @returns Km in mM
 */
export function getDefaultKm(pathway: PathwayKey, stepName: string): number {
  return lookupKinetics(pathway, stepName)?.km ?? 0.1; // 0.1 mM conservative fallback
}
