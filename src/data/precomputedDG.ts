/**
 * Pre-computed ΔG data bundle for CETHX — enables production use without
 * the Python eQuilibrator sidecar.
 *
 * Contains:
 *   1. Reference ΔG° values from Lehninger / NIST (pH 7, 25°C, I=0.1 M)
 *   2. Alberty-transformed ΔG' at physiological conditions (pH 7.4, 37°C, I=0.25 M)
 *   3. Per-step proton stoichiometry (nH, Δz²) from KEGG reaction equations
 *   4. KEGG reaction formulas for eQuilibrator lookups
 *
 * The transformed values are computed via the Alberty formalism:
 *   ΔG' = ΔG° + RT·ln(10)·(pH-7)·nH + 9.205·Δz²·√I/(1+1.6·√I)
 *
 * @scientific_provenance
 * VALIDITY_TIER: real
 *
 * References:
 *   - Lehninger Principles of Biochemistry, Nelson & Cox (various editions)
 *   - NIST Thermodynamic Data for Biochemistry
 *   - Alberty (2003) Thermodynamics of Biochemical Reactions, Wiley
 *   - eQuilibrator 3 (Beber et al. 2022) Nucleic Acids Research 50(D1):D663-D669
 *   - Goldberg & Tewari (1991) Biophys Chem 40:241-261
 *
 * KNOWN_LIMITATIONS:
 *   - Proton stoichiometry (nH, Δz²) is estimated from KEGG reaction equations,
 *     not from measured pKa values per compound.
 *   - Uncertainty is a heuristic (~15% of |ΔG'|), not from statistical thermodynamics.
 *   - Does not account for magnesium binding or compartment-specific effects.
 *   - ΔG° values are for aqueous solution; in vivo values may differ.
 */

import type { PathwayKey } from './mockCETHX';

// ── Types ──────────────────────────────────────────────────────────────

/** Standard conditions for reference ΔG° values */
export interface StandardConditions {
  pH: number;              // default 7.0
  temperature_C: number;   // default 25
  ionicStrength_M: number; // default 0.1
}

/** Physiological conditions for transformed ΔG' values */
export interface PhysiologicalConditions {
  pH: number;              // default 7.4
  temperature_C: number;   // default 37
  ionicStrength_M: number; // default 0.25
}

/** Pre-computed ΔG entry for a single reaction step */
export interface PrecomputedDGEntry {
  /** Step label (matches PATHWAY_STEPS keys in mockCETHX.ts) */
  stepName: string;
  /** Standard ΔG° (kJ/mol) at pH 7, 25°C, I=0.1 M — Lehninger/NIST reference */
  dG0: number;
  /** Transformed ΔG' (kJ/mol) at pH 7.4, 37°C, I=0.25 M — Alberty transform */
  dG_prime_physiological: number;
  /** Transformed ΔG' (kJ/mol) at pH 7.0, 25°C, I=0.1 M — reference transform */
  dG_prime_standard: number;
  /** Estimated uncertainty in dG_prime (kJ/mol) — heuristic ~15% of |ΔG'| */
  uncertainty: number;
  /** Net protons absorbed (positive = consumes H+) — from KEGG reaction equation */
  nH: number;
  /** Change in sum of squared charges (products - reactants) */
  dz2: number;
  /** KEGG reaction formula (for eQuilibrator API lookups) */
  keggFormula: string;
  /** Reference source */
  source: string;
}

/** Complete pre-computed ΔG dataset for a pathway */
export interface PrecomputedPathwayData {
  pathway: PathwayKey;
  steps: PrecomputedDGEntry[];
  /** Conditions used for the physiological transform */
  physiologicalConditions: PhysiologicalConditions;
  /** Conditions used for the reference ΔG° values */
  standardConditions: StandardConditions;
}

// ── Constants ──────────────────────────────────────────────────────────

/** Gas constant (kJ/(mol·K)) */
const R = 8.314e-3;

/** ln(10) for pH conversions */
const LN10 = Math.LN10;

/** Default physiological conditions */
export const PHYSIOLOGICAL: PhysiologicalConditions = {
  pH: 7.4,
  temperature_C: 37,
  ionicStrength_M: 0.25,
};

/** Default standard (reference) conditions */
export const STANDARD: StandardConditions = {
  pH: 7.0,
  temperature_C: 25,
  ionicStrength_M: 0.1,
};

// ── Alberty Transform Helper ───────────────────────────────────────────

/**
 * Compute Alberty-transformed ΔG' at given conditions.
 * Mirror of calcTransformedGibbs from thermoEngine.ts — inlined here
 * to avoid runtime import dependency and enable static pre-computation.
 */
function albertyTransform(
  dG0: number,
  pH: number,
  ionicStrength: number,
  tempK: number,
  nH: number,
  dz2: number,
): number {
  const protonTerm = R * tempK * LN10 * (pH - 7) * nH;
  const sqrtI = Math.sqrt(ionicStrength);
  const debyeHuckel = dz2 !== 0
    ? 9.205 * dz2 * sqrtI / (1 + 1.6 * sqrtI)
    : 0;
  return dG0 + protonTerm + debyeHuckel;
}

// ── KEGG Reaction Formulas ─────────────────────────────────────────────
// Copied from src/hooks/useEquilibrator.ts KEGG_REACTIONS

const KEGG_GLYCOLYSIS: Record<string, string> = {
  'Glc → G6P': 'kegg:C00031 + kegg:C00002 = kegg:C00085 + kegg:C00008',
  'G6P → F6P': 'kegg:C00085 = kegg:C00076',
  'F6P → FBP': 'kegg:C00076 + kegg:C00002 = kegg:C00354 + kegg:C00008',
  'FBP → DHAP+GAP': 'kegg:C00354 = kegg:C00111 + kegg:C00118',
  'DHAP → GAP': 'kegg:C00111 = kegg:C00118',
  'GAP → 1,3-BPG': 'kegg:C00118 + kegg:C00002 + kegg:C00003 = kegg:C00236 + kegg:C00004 + kegg:C00080',
  '1,3-BPG → 3PG': 'kegg:C00236 + kegg:C00005 = kegg:C00197 + kegg:C00002',
  '3PG → 2PG': 'kegg:C00197 = kegg:C00631',
  '2PG → PEP': 'kegg:C00631 = kegg:C00074 + kegg:C00001',
  'PEP → Pyr': 'kegg:C00074 + kegg:C00001 = kegg:C00022 + kegg:C00009',
};

const KEGG_TCA: Record<string, string> = {
  'AcCoA + OAA → Citrate': 'kegg:C00024 + kegg:C00036 = kegg:C00158 + kegg:C00010',
  'Citrate → Isocitrate': 'kegg:C00158 = kegg:C00311',
  'Isocitrate → α-KG': 'kegg:C00311 + kegg:C00003 = kegg:C00026 + kegg:C00004 + kegg:C00011',
  'α-KG → Succinyl-CoA': 'kegg:C00026 + kegg:C00003 + kegg:C00010 = kegg:C00091 + kegg:C00004 + kegg:C00011',
  'Succinyl-CoA → Succinate': 'kegg:C00091 + kegg:C00005 + kegg:C00002 = kegg:C00042 + kegg:C00010',
  'Succinate → Fumarate': 'kegg:C00042 + kegg:C00003 = kegg:C00122 + kegg:C00004',
  'Fumarate → Malate': 'kegg:C00122 + kegg:C00001 = kegg:C00149',
  'Malate → OAA': 'kegg:C00149 + kegg:C00003 = kegg:C00036 + kegg:C00004',
};

const KEGG_PPP: Record<string, string> = {
  'G6P → 6-PGL': 'kegg:C00085 + kegg:C00003 = kegg:C00936 + kegg:C00004',
  '6-PGL → 6-PG': 'kegg:C00936 + kegg:C00001 = kegg:C00345',
  '6-PG → Ribulose-5P': 'kegg:C00345 + kegg:C00003 = kegg:C00199 + kegg:C00004 + kegg:C00011',
  'Ribulose-5P → Ribose-5P': 'kegg:C00199 = kegg:C00117',
  'Transketolase (×2)': 'kegg:C00117 + kegg:C00118 = kegg:C00085 + kegg:C00279',
  'Transaldolase': 'kegg:C00279 + kegg:C00118 = kegg:C00031 + kegg:C00074',
};

// ── Raw Reference Data ─────────────────────────────────────────────────
// ΔG° values from Lehninger/NIST; proton stoichiometry from KEGG reactions.

interface RawStep {
  stepName: string;
  dG0: number;           // kJ/mol, Lehninger reference (pH 7, 25°C)
  nH: number;            // net H+ absorbed
  dz2: number;           // Δz² charge change
  keggFormula: string;
}

const GLYCOLYSIS_RAW: RawStep[] = [
  { stepName: 'Glc → G6P',       dG0: -16.7, nH:  0, dz2: -2, keggFormula: KEGG_GLYCOLYSIS['Glc → G6P'] },
  { stepName: 'G6P → F6P',       dG0:   1.7, nH:  0, dz2:  0, keggFormula: KEGG_GLYCOLYSIS['G6P → F6P'] },
  { stepName: 'F6P → FBP',       dG0: -14.2, nH:  0, dz2: -2, keggFormula: KEGG_GLYCOLYSIS['F6P → FBP'] },
  { stepName: 'FBP → DHAP+GAP',  dG0:  23.8, nH:  0, dz2:  0, keggFormula: KEGG_GLYCOLYSIS['FBP → DHAP+GAP'] },
  { stepName: 'DHAP → GAP',      dG0:   7.5, nH:  0, dz2:  0, keggFormula: KEGG_GLYCOLYSIS['DHAP → GAP'] },
  { stepName: 'GAP → 1,3-BPG',   dG0:   6.3, nH: -1, dz2:  1, keggFormula: KEGG_GLYCOLYSIS['GAP → 1,3-BPG'] },
  { stepName: '1,3-BPG → 3PG',   dG0: -18.8, nH:  0, dz2:  2, keggFormula: KEGG_GLYCOLYSIS['1,3-BPG → 3PG'] },
  { stepName: '3PG → 2PG',       dG0:   4.4, nH:  0, dz2:  0, keggFormula: KEGG_GLYCOLYSIS['3PG → 2PG'] },
  { stepName: '2PG → PEP',       dG0:   1.8, nH:  0, dz2:  0, keggFormula: KEGG_GLYCOLYSIS['2PG → PEP'] },
  { stepName: 'PEP → Pyr',       dG0: -31.4, nH:  0, dz2:  0, keggFormula: KEGG_GLYCOLYSIS['PEP → Pyr'] },
];

const TCA_RAW: RawStep[] = [
  { stepName: 'AcCoA + OAA → Citrate', dG0: -32.2, nH:  0, dz2:  0, keggFormula: KEGG_TCA['AcCoA + OAA → Citrate'] },
  { stepName: 'Citrate → Isocitrate',  dG0:  13.3, nH:  0, dz2:  0, keggFormula: KEGG_TCA['Citrate → Isocitrate'] },
  { stepName: 'Isocitrate → α-KG',     dG0: -20.9, nH: -1, dz2:  1, keggFormula: KEGG_TCA['Isocitrate → α-KG'] },
  { stepName: 'α-KG → Succinyl-CoA',   dG0: -33.5, nH: -1, dz2:  1, keggFormula: KEGG_TCA['α-KG → Succinyl-CoA'] },
  { stepName: 'Succinyl-CoA → Succinate', dG0: -2.1, nH:  0, dz2:  2, keggFormula: KEGG_TCA['Succinyl-CoA → Succinate'] },
  { stepName: 'Succinate → Fumarate',  dG0:   0.0, nH: -1, dz2:  0, keggFormula: KEGG_TCA['Succinate → Fumarate'] },
  { stepName: 'Fumarate → Malate',     dG0:  -3.6, nH:  0, dz2:  0, keggFormula: KEGG_TCA['Fumarate → Malate'] },
  { stepName: 'Malate → OAA',          dG0:  29.7, nH: -1, dz2:  1, keggFormula: KEGG_TCA['Malate → OAA'] },
];

const PPP_RAW: RawStep[] = [
  { stepName: 'G6P → 6-PGL',            dG0: -17.6, nH: -1, dz2:  1, keggFormula: KEGG_PPP['G6P → 6-PGL'] },
  { stepName: '6-PGL → 6-PG',           dG0: -25.0, nH:  0, dz2:  0, keggFormula: KEGG_PPP['6-PGL → 6-PG'] },
  { stepName: '6-PG → Ribulose-5P',     dG0: -19.0, nH: -1, dz2:  1, keggFormula: KEGG_PPP['6-PG → Ribulose-5P'] },
  { stepName: 'Ribulose-5P → Ribose-5P', dG0:   2.4, nH:  0, dz2:  0, keggFormula: KEGG_PPP['Ribulose-5P → Ribose-5P'] },
  { stepName: 'Transketolase (×2)',      dG0:  -6.3, nH:  0, dz2:  0, keggFormula: KEGG_PPP['Transketolase (×2)'] },
  { stepName: 'Transaldolase',           dG0:  -0.4, nH:  0, dz2:  0, keggFormula: KEGG_PPP['Transaldolase'] },
];

// ── Pre-computation ────────────────────────────────────────────────────

function buildPrecomputedEntries(rawSteps: RawStep[]): PrecomputedDGEntry[] {
  const physT = PHYSIOLOGICAL.temperature_C + 273.15;
  const stdT = STANDARD.temperature_C + 273.15;

  return rawSteps.map(s => {
    const dG_prime_phys = albertyTransform(
      s.dG0, PHYSIOLOGICAL.pH, PHYSIOLOGICAL.ionicStrength_M, physT, s.nH, s.dz2,
    );
    const dG_prime_std = albertyTransform(
      s.dG0, STANDARD.pH, STANDARD.ionicStrength_M, stdT, s.nH, s.dz2,
    );
    const uncertainty = Math.abs(dG_prime_phys) * 0.15;

    return {
      stepName: s.stepName,
      dG0: s.dG0,
      dG_prime_physiological: Math.round(dG_prime_phys * 100) / 100,
      dG_prime_standard: Math.round(dG_prime_std * 100) / 100,
      uncertainty: Math.round(uncertainty * 100) / 100,
      nH: s.nH,
      dz2: s.dz2,
      keggFormula: s.keggFormula,
      source: 'Lehninger/NIST + Alberty transform',
    };
  });
}

// ── Exported Pre-computed Datasets ──────────────────────────────────────

export const GLYCOLYSIS_PRECOMPUTED: PrecomputedPathwayData = {
  pathway: 'glycolysis',
  steps: buildPrecomputedEntries(GLYCOLYSIS_RAW),
  physiologicalConditions: PHYSIOLOGICAL,
  standardConditions: STANDARD,
};

export const TCA_PRECOMPUTED: PrecomputedPathwayData = {
  pathway: 'tca',
  steps: buildPrecomputedEntries(TCA_RAW),
  physiologicalConditions: PHYSIOLOGICAL,
  standardConditions: STANDARD,
};

export const PPP_PRECOMPUTED: PrecomputedPathwayData = {
  pathway: 'ppp',
  steps: buildPrecomputedEntries(PPP_RAW),
  physiologicalConditions: PHYSIOLOGICAL,
  standardConditions: STANDARD,
};

/** All pre-computed pathway data keyed by pathway ID */
export const PRECOMPUTED_DG: Record<PathwayKey, PrecomputedPathwayData> = {
  glycolysis: GLYCOLYSIS_PRECOMPUTED,
  tca: TCA_PRECOMPUTED,
  ppp: PPP_PRECOMPUTED,
};

// ── Lookup Utilities ───────────────────────────────────────────────────

/**
 * Get pre-computed ΔG' for a specific step in a pathway at physiological conditions.
 *
 * @param pathway  Pathway key
 * @param stepName Step label (must match PATHWAY_STEPS keys)
 * @returns Pre-computed entry, or undefined if not found
 */
export function lookupPrecomputedDG(
  pathway: PathwayKey,
  stepName: string,
): PrecomputedDGEntry | undefined {
  return PRECOMPUTED_DG[pathway]?.steps.find(s => s.stepName === stepName);
}

/**
 * Get pre-computed ΔG' values for all steps in a pathway, returning a Map
 * keyed by step name for efficient lookup during the eQuilibrator merge.
 *
 * @param pathway Pathway key
 * @returns Map of stepName → dG_prime_physiological
 */
export function getPrecomputedDGMap(
  pathway: PathwayKey,
): Map<string, { dG_prime: number; dG_prime_uncertainty: number }> {
  const data = PRECOMPUTED_DG[pathway];
  if (!data) return new Map();

  const map = new Map<string, { dG_prime: number; dG_prime_uncertainty: number }>();
  for (const step of data.steps) {
    map.set(step.stepName, {
      dG_prime: step.dG_prime_physiological,
      dG_prime_uncertainty: step.uncertainty,
    });
  }
  return map;
}

/**
 * Re-compute ΔG' at arbitrary conditions using the stored dG0, nH, and dz2.
 * Use this when the user changes pH/temperature/I away from the pre-computed points.
 *
 * @param pathway Pathway key
 * @param pH      Target pH
 * @param tempC   Target temperature (°C)
 * @param ionicStrength Target ionic strength (M)
 * @returns Map of stepName → { dG_prime, uncertainty }
 */
export function computeDGAtConditions(
  pathway: PathwayKey,
  pH: number,
  tempC: number,
  ionicStrength: number = 0.25,
): Map<string, { dG_prime: number; dG_prime_uncertainty: number }> {
  const data = PRECOMPUTED_DG[pathway];
  if (!data) return new Map();

  const T = tempC + 273.15;
  const map = new Map<string, { dG_prime: number; dG_prime_uncertainty: number }>();

  for (const step of data.steps) {
    const dG_prime = albertyTransform(step.dG0, pH, ionicStrength, T, step.nH, step.dz2);
    const uncertainty = Math.abs(dG_prime) * 0.15;
    map.set(step.stepName, {
      dG_prime: Math.round(dG_prime * 100) / 100,
      dG_prime_uncertainty: Math.round(uncertainty * 100) / 100,
    });
  }

  return map;
}
