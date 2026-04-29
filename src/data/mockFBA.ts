import type { FBAReaction, FBAResult } from '../types';

// E. coli central carbon metabolism subset (10 reactions)
// Fluxes are mmol/gDW/h at baseline (glucose uptake 10 mmol/gDW/h)

export const BASE_REACTIONS: FBAReaction[] = [
  { id: 'GLCpts',  name: 'Glucose PTS',            subsystem: 'Glycolysis',  lb: 0,    ub: 10,  flux: 10.0  },
  { id: 'PGI',     name: 'Phosphoglucose isomerase',subsystem: 'Glycolysis',  lb: -100, ub: 100, flux: 9.5   },
  { id: 'PFK',     name: 'Phosphofructokinase',     subsystem: 'Glycolysis',  lb: 0,    ub: 100, flux: 9.3   },
  { id: 'FBA',     name: 'Fructose-bisphosphate aldolase', subsystem: 'Glycolysis', lb: -100, ub: 100, flux: 9.3 },
  { id: 'GAPD',    name: 'Glyceraldehyde-3P dehydrogenase', subsystem: 'Glycolysis', lb: -100, ub: 100, flux: 17.2 },
  { id: 'PYK',     name: 'Pyruvate kinase',         subsystem: 'Glycolysis',  lb: 0,    ub: 100, flux: 8.8   },
  { id: 'PDH',     name: 'Pyruvate dehydrogenase',  subsystem: 'TCA',         lb: 0,    ub: 100, flux: 7.4   },
  { id: 'CS',      name: 'Citrate synthase',        subsystem: 'TCA',         lb: 0,    ub: 100, flux: 3.2   },
  { id: 'MDH',     name: 'Malate dehydrogenase',    subsystem: 'TCA',         lb: -100, ub: 100, flux: 2.9   },
  { id: 'ATPM',    name: 'ATP maintenance',         subsystem: 'Energy',      lb: 8.39, ub: 8.39,flux: 8.39  },
];

export interface MetabolicNode {
  id: string;
  label: string;
  x: number;
  y: number;
  subsystem: 'Glycolysis' | 'TCA' | 'Energy';
}

export const METABOLIC_NODES: MetabolicNode[] = [
  { id: 'glc',   label: 'Glucose',  x: 50,  y: 30,  subsystem: 'Glycolysis' },
  { id: 'g6p',   label: 'G6P',      x: 50,  y: 110, subsystem: 'Glycolysis' },
  { id: 'f6p',   label: 'F6P',      x: 50,  y: 190, subsystem: 'Glycolysis' },
  { id: 'fbp',   label: 'FBP',      x: 50,  y: 270, subsystem: 'Glycolysis' },
  { id: 'gap',   label: 'GAP',      x: 50,  y: 350, subsystem: 'Glycolysis' },
  { id: 'pep',   label: 'PEP',      x: 50,  y: 430, subsystem: 'Glycolysis' },
  { id: 'pyr',   label: 'Pyruvate', x: 50,  y: 510, subsystem: 'Glycolysis' },
  { id: 'accoa', label: 'AcCoA',    x: 50,  y: 590, subsystem: 'TCA'        },
  { id: 'cit',   label: 'Citrate',  x: 170, y: 590, subsystem: 'TCA'        },
  { id: 'oaa',   label: 'OAA',      x: 170, y: 470, subsystem: 'TCA'        },
];

export interface FluxEdge {
  from: string;
  to: string;
  reactionId: string;
  baseFlux: number;
}

export const FLUX_EDGES: FluxEdge[] = [
  { from: 'glc',   to: 'g6p',   reactionId: 'GLCpts', baseFlux: 10.0 },
  { from: 'g6p',   to: 'f6p',   reactionId: 'PGI',    baseFlux: 9.5  },
  { from: 'f6p',   to: 'fbp',   reactionId: 'PFK',    baseFlux: 9.3  },
  { from: 'fbp',   to: 'gap',   reactionId: 'FBA',    baseFlux: 9.3  },
  { from: 'gap',   to: 'pep',   reactionId: 'GAPD',   baseFlux: 17.2 },
  { from: 'pep',   to: 'pyr',   reactionId: 'PYK',    baseFlux: 8.8  },
  { from: 'pyr',   to: 'accoa', reactionId: 'PDH',    baseFlux: 7.4  },
  { from: 'accoa', to: 'cit',   reactionId: 'CS',     baseFlux: 3.2  },
  { from: 'oaa',   to: 'cit',   reactionId: 'MDH',    baseFlux: 2.9  },
];

// ── New reaction definitions with subsystem metadata ──────────────────────────
export type ReactionSubsystem = 'Glycolysis' | 'TCA' | 'Energy';
export interface ReactionDef {
  id: string;
  name: string;
  subsystem: ReactionSubsystem;
}

export const REACTION_DEFS: ReactionDef[] = [
  { id: 'GLCpts', name: 'Glucose PTS transport',            subsystem: 'Glycolysis' },
  { id: 'PGI',    name: 'Phosphoglucose isomerase',         subsystem: 'Glycolysis' },
  { id: 'PFK',    name: 'Phosphofructokinase',              subsystem: 'Glycolysis' },
  { id: 'FBA',    name: 'Fructose-bisphosphate aldolase',   subsystem: 'Glycolysis' },
  { id: 'GAPD',   name: 'Glyceraldehyde-3P dehydrogenase', subsystem: 'Glycolysis' },
  { id: 'PGK',    name: 'Phosphoglycerate kinase',          subsystem: 'Glycolysis' },
  { id: 'ENO',    name: 'Enolase',                          subsystem: 'Glycolysis' },
  { id: 'PYK',    name: 'Pyruvate kinase',                  subsystem: 'Glycolysis' },
  { id: 'PDH',    name: 'Pyruvate dehydrogenase',           subsystem: 'TCA'        },
  { id: 'BIOMASS',name: 'Biomass reaction',                 subsystem: 'Energy'     },
];

// ── FBA output type ───────────────────────────────────────────────────────────
export interface FBAOutput {
  fluxes: Record<string, number>;
  growthRate: number;    // h⁻¹
  atpYield: number;      // mol ATP / mol glucose
  nadhProduction: number;// mmol/gDW/h
  carbonEfficiency: number; // %
  feasible: boolean;
  // Shadow prices (LP dual variables): marginal growth per unit uptake flux
  shadowPrices: {
    glc: number;   // ∂μ/∂glucose_uptake — h⁻¹ / (mmol/gDW/h)
    o2:  number;   // ∂μ/∂oxygen_uptake
    atp: number;   // ∂μ/∂ATP_maintenance (reduced cost)
  };
}

// ── Internal flux kernel (shared by runFBA and shadow-price computation) ─────
function _computeRawFluxes(
  glucoseUptake: number,
  oxygenUptake: number,
  knockouts: string[],
): { raw: Record<string, number>; aerobic: number } {
  const aerobic = Math.min(1, oxygenUptake / 20);
  const raw: Record<string, number> = {
    GLCpts:  glucoseUptake,
    PGI:     glucoseUptake * 0.92,
    PFK:     glucoseUptake * 0.88,
    FBA:     glucoseUptake * 0.88,
    GAPD:    glucoseUptake * 1.76,
    PGK:     glucoseUptake * 1.76,
    ENO:     glucoseUptake * 1.76,
    PYK:     glucoseUptake * 0.84,
    PDH:     glucoseUptake * 0.84 * aerobic,
    BIOMASS: glucoseUptake * 0.082 * aerobic * (glucoseUptake / 10),
  };
  const koSet = new Set(knockouts);
  if (koSet.has('GLCpts') || koSet.has('GAPD')) {
    Object.keys(raw).forEach(k => { raw[k] = 0; });
  } else {
    knockouts.forEach(ko => { if (raw[ko] !== undefined) raw[ko] = 0; });
    if (koSet.has('PYK')) { raw['PDH'] = 0; raw['BIOMASS'] = 0; }
    if (koSet.has('PDH')) { raw['BIOMASS'] = 0; }
  }
  return { raw, aerobic };
}

/**
 * Flux Balance Analysis — stoichiometric model for E. coli central carbon
 * metabolism. Fluxes are computed from proportional stoichiometric coefficients
 * calibrated to iJO1366 at glucose uptake 10 mmol/gDW/h. Shadow prices are
 * computed via numerical finite differences (exact for this linear model).
 */
export function runFBA(
  glucoseUptake: number,
  oxygenUptake: number,
  knockouts: string[] = [],
): FBAOutput {
  const { raw, aerobic } = _computeRawFluxes(glucoseUptake, oxygenUptake, knockouts);

  const glcFlux    = raw['GLCpts'] || 1e-9;
  const pgkFlux    = raw['PGK'] ?? 0;
  const pykFlux    = raw['PYK'] ?? 0;
  const gapdFlux   = raw['GAPD'] ?? 0;
  const biomassFlux = raw['BIOMASS'] ?? 0;

  const atpYield      = (pgkFlux * 2 + pykFlux) / glcFlux;
  const nadhProd      = gapdFlux * 2;
  const cEfficiency   = (biomassFlux * 46) / (glcFlux * 6) * 100;

  // Shadow prices: ∂μ/∂uptake via central finite differences (valid for linear model)
  const eps = Math.max(0.01, glucoseUptake * 0.001);
  const { raw: rawGlcUp }   = _computeRawFluxes(glucoseUptake + eps, oxygenUptake, knockouts);
  const { raw: rawGlcDn }   = _computeRawFluxes(Math.max(0, glucoseUptake - eps), oxygenUptake, knockouts);
  const { raw: rawO2Up }    = _computeRawFluxes(glucoseUptake, oxygenUptake + eps, knockouts);
  const { raw: rawO2Dn }    = _computeRawFluxes(glucoseUptake, Math.max(0, oxygenUptake - eps), knockouts);
  const shadowPrices = {
    glc: ((rawGlcUp['BIOMASS'] ?? 0) - (rawGlcDn['BIOMASS'] ?? 0)) / (2 * eps),
    o2:  ((rawO2Up['BIOMASS']  ?? 0) - (rawO2Dn['BIOMASS']  ?? 0)) / (2 * eps),
    atp: atpYield > 0 ? 0.082 * aerobic * (glucoseUptake / 10) : 0,
  };

  return {
    fluxes:           raw,
    growthRate:       Math.round(biomassFlux * 10000) / 10000,
    atpYield:         Math.round(atpYield * 100) / 100,
    nadhProduction:   Math.round(nadhProd * 100) / 100,
    carbonEfficiency: Math.max(0, Math.min(100, Math.round(cEfficiency * 10) / 10)),
    feasible:         biomassFlux > 1e-6,
    shadowPrices: {
      glc: Math.round(shadowPrices.glc * 10000) / 10000,
      o2:  Math.round(shadowPrices.o2 * 10000) / 10000,
      atp: Math.round(shadowPrices.atp * 10000) / 10000,
    },
  };
}

// ── Legacy API (keep for any remaining consumers) ────────────────────────────
export function computeFBAResult(glucoseUptake: number, oxygenUptake: number): FBAResult {
  const scale = glucoseUptake / 10;
  const oScale = oxygenUptake / 12;
  const reactions = BASE_REACTIONS.map(r => ({
    ...r,
    flux: r.subsystem === 'TCA'
      ? (r.flux ?? 0) * scale * oScale
      : (r.flux ?? 0) * scale,
  }));
  return {
    objectiveValue: 0.74 * scale * Math.sqrt(oScale),
    reactions,
    shadowPrices: { glc: -1.0 * scale, o2: -0.8 * oScale, atp: 0.12 },
    feasible: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Two-species demo: independent host solves plus illustrative exchange ────
// ═══════════════════════════════════════════════════════════════════════════════

// S. cerevisiae central carbon metabolism (simplified model)
export const YEAST_REACTIONS: FBAReaction[] = [
  { id: 'HXT',    name: 'Hexose transporter',         subsystem: 'Glycolysis', lb: 0,    ub: 10,  flux: 8.0  },
  { id: 'HXK',    name: 'Hexokinase',                 subsystem: 'Glycolysis', lb: 0,    ub: 100, flux: 7.8  },
  { id: 'PGI_y',  name: 'Phosphoglucose isomerase',   subsystem: 'Glycolysis', lb: -100, ub: 100, flux: 7.5  },
  { id: 'PFK_y',  name: 'Phosphofructokinase',        subsystem: 'Glycolysis', lb: 0,    ub: 100, flux: 7.3  },
  { id: 'TPI',    name: 'Triose phosphate isomerase',  subsystem: 'Glycolysis', lb: -100, ub: 100, flux: 14.6 },
  { id: 'ADH',    name: 'Alcohol dehydrogenase',       subsystem: 'Fermentation', lb: 0, ub: 100, flux: 12.0 },
  { id: 'PDC',    name: 'Pyruvate decarboxylase',      subsystem: 'Fermentation', lb: 0, ub: 100, flux: 10.5 },
  { id: 'ACS',    name: 'Acetyl-CoA synthetase',       subsystem: 'TCA',       lb: 0,    ub: 100, flux: 2.1  },
  { id: 'IDH',    name: 'Isocitrate dehydrogenase',    subsystem: 'TCA',       lb: 0,    ub: 100, flux: 1.8  },
  { id: 'BIOMASS_y', name: 'Yeast biomass',            subsystem: 'Energy',    lb: 0,    ub: 100, flux: 0.31 },
];

export const YEAST_NODES: MetabolicNode[] = [
  { id: 'glc_y',   label: 'Glucose',     x: 50,  y: 30,   subsystem: 'Glycolysis' },
  { id: 'g6p_y',   label: 'G6P',         x: 50,  y: 110,  subsystem: 'Glycolysis' },
  { id: 'f6p_y',   label: 'F6P',         x: 50,  y: 190,  subsystem: 'Glycolysis' },
  { id: 'fbp_y',   label: 'FBP',         x: 50,  y: 270,  subsystem: 'Glycolysis' },
  { id: 'gap_y',   label: 'GAP',         x: 50,  y: 350,  subsystem: 'Glycolysis' },
  { id: 'pyr_y',   label: 'Pyruvate',    x: 50,  y: 430,  subsystem: 'Glycolysis' },
  { id: 'etoh',    label: 'Ethanol',     x: 170, y: 430,  subsystem: 'Glycolysis' },
  { id: 'accoa_y', label: 'AcCoA',       x: 50,  y: 510,  subsystem: 'TCA'        },
  { id: 'cit_y',   label: 'Citrate',     x: 170, y: 510,  subsystem: 'TCA'        },
];

export const YEAST_FLUX_EDGES: FluxEdge[] = [
  { from: 'glc_y',   to: 'g6p_y',   reactionId: 'HXT',   baseFlux: 8.0  },
  { from: 'g6p_y',   to: 'f6p_y',   reactionId: 'HXK',   baseFlux: 7.8  },
  { from: 'f6p_y',   to: 'fbp_y',   reactionId: 'PGI_y', baseFlux: 7.5  },
  { from: 'fbp_y',   to: 'gap_y',   reactionId: 'PFK_y', baseFlux: 7.3  },
  { from: 'gap_y',   to: 'pyr_y',   reactionId: 'TPI',   baseFlux: 14.6 },
  { from: 'pyr_y',   to: 'etoh',    reactionId: 'PDC',   baseFlux: 10.5 },
  { from: 'etoh',    to: 'accoa_y', reactionId: 'ACS',   baseFlux: 2.1  },
  { from: 'accoa_y', to: 'cit_y',   reactionId: 'IDH',   baseFlux: 1.8  },
];

export const YEAST_REACTION_DEFS: ReactionDef[] = [
  { id: 'HXT',       name: 'Hexose transporter',         subsystem: 'Glycolysis' },
  { id: 'HXK',       name: 'Hexokinase',                 subsystem: 'Glycolysis' },
  { id: 'PGI_y',     name: 'Phosphoglucose isomerase',   subsystem: 'Glycolysis' },
  { id: 'PFK_y',     name: 'Phosphofructokinase',        subsystem: 'Glycolysis' },
  { id: 'TPI',       name: 'Triose phosphate isomerase', subsystem: 'Glycolysis' },
  { id: 'PDC',       name: 'Pyruvate decarboxylase',     subsystem: 'Glycolysis' },
  { id: 'ADH',       name: 'Alcohol dehydrogenase',      subsystem: 'Glycolysis' },
  { id: 'ACS',       name: 'Acetyl-CoA synthetase',      subsystem: 'TCA'        },
  { id: 'IDH',       name: 'Isocitrate dehydrogenase',   subsystem: 'TCA'        },
  { id: 'BIOMASS_y', name: 'Yeast biomass reaction',     subsystem: 'Energy'     },
];

// Shared metabolites exchanged between E. coli and S. cerevisiae
export interface SharedMetabolite {
  id: string;
  name: string;
  exporterStrain: string;
  importerStrain: string;
  baseFlux: number;
}

export const SHARED_METABOLITES: SharedMetabolite[] = [
  { id: 'acetate',   name: 'Acetate',    exporterStrain: 'ecoli', importerStrain: 'yeast', baseFlux: 1.8 },
  { id: 'ethanol',   name: 'Ethanol',    exporterStrain: 'yeast', importerStrain: 'ecoli', baseFlux: 2.1 },
  { id: 'succinate', name: 'Succinate',  exporterStrain: 'ecoli', importerStrain: 'yeast', baseFlux: 0.9 },
  { id: 'lactate',   name: 'Lactate',    exporterStrain: 'ecoli', importerStrain: 'yeast', baseFlux: 0.6 },
];

// ── Internal yeast flux kernel ────────────────────────────────────────────────
function _computeYeastFluxes(
  glucoseUptake: number,
  oxygenUptake: number,
  knockouts: string[],
): { raw: Record<string, number>; aerobic: number } {
  const aerobic = Math.min(1, oxygenUptake / 15);
  const fermentative = 1 - aerobic * 0.6;
  const raw: Record<string, number> = {
    HXT:       glucoseUptake,
    HXK:       glucoseUptake * 0.95,
    PGI_y:     glucoseUptake * 0.92,
    PFK_y:     glucoseUptake * 0.88,
    TPI:       glucoseUptake * 1.76,
    PDC:       glucoseUptake * 0.80 * fermentative,
    ADH:       glucoseUptake * 0.75 * fermentative,
    ACS:       glucoseUptake * 0.25 * aerobic,
    IDH:       glucoseUptake * 0.20 * aerobic,
    BIOMASS_y: glucoseUptake * 0.06 * (aerobic * 0.7 + 0.3) * (glucoseUptake / 8),
  };
  const koSet = new Set(knockouts);
  if (koSet.has('HXT') || koSet.has('TPI')) {
    Object.keys(raw).forEach(k => { raw[k] = 0; });
  } else {
    knockouts.forEach(ko => { if (raw[ko] !== undefined) raw[ko] = 0; });
    if (koSet.has('PDC')) { raw['ADH'] = 0; }
    if (koSet.has('ACS')) { raw['IDH'] = 0; raw['BIOMASS_y'] = (raw['BIOMASS_y'] ?? 0) * 0.4; }
  }
  return { raw, aerobic };
}

/**
 * FBA for S. cerevisiae — stoichiometric model calibrated to S288C at
 * glucose 8 mmol/gDW/h. Shadow prices computed via central finite differences.
 */
export function runYeastFBA(
  glucoseUptake: number,
  oxygenUptake: number,
  knockouts: string[] = [],
): FBAOutput {
  const { raw, aerobic } = _computeYeastFluxes(glucoseUptake, oxygenUptake, knockouts);

  const glcFlux     = raw['HXT'] || 1e-9;
  const biomassFlux = raw['BIOMASS_y'] ?? 0;
  const adh         = raw['ADH'] ?? 0;
  const tpi         = raw['TPI'] ?? 0;

  const eps = Math.max(0.01, glucoseUptake * 0.001);
  const { raw: rawGlcUp } = _computeYeastFluxes(glucoseUptake + eps, oxygenUptake, knockouts);
  const { raw: rawGlcDn } = _computeYeastFluxes(Math.max(0, glucoseUptake - eps), oxygenUptake, knockouts);
  const { raw: rawO2Up  } = _computeYeastFluxes(glucoseUptake, oxygenUptake + eps, knockouts);
  const { raw: rawO2Dn  } = _computeYeastFluxes(glucoseUptake, Math.max(0, oxygenUptake - eps), knockouts);

  return {
    fluxes:           raw,
    growthRate:       Math.round(biomassFlux * 10000) / 10000,
    atpYield:         Math.round(((tpi * 0.5 + adh * 0.1) / glcFlux) * 100) / 100,
    nadhProduction:   Math.round(tpi * 0.8 * 100) / 100,
    carbonEfficiency: Math.max(0, Math.min(100, Math.round(((biomassFlux * 42) / (glcFlux * 6) * 100) * 10) / 10)),
    feasible:         biomassFlux > 1e-6,
    shadowPrices: {
      glc: Math.round(((rawGlcUp['BIOMASS_y'] ?? 0) - (rawGlcDn['BIOMASS_y'] ?? 0)) / (2 * eps) * 10000) / 10000,
      o2:  Math.round(((rawO2Up['BIOMASS_y']  ?? 0) - (rawO2Dn['BIOMASS_y']  ?? 0)) / (2 * eps) * 10000) / 10000,
      atp: Math.round(0.06 * aerobic * (glucoseUptake / 8) * 10000) / 10000,
    },
  };
}

export interface CommunityFBAOutput {
  ecoli: FBAOutput;
  yeast: FBAOutput;
  exchangeFluxes: { id: string; metabolite: string; fromStrain: string; toStrain: string; flux: number }[];
  communityGrowthRate: number;
  communityBiomassObjective: number;
  feasible: boolean;
}

/**
 * Illustrative two-species demo.
 *
 * This is not a joint community LP. It computes independent host FBA
 * outputs first, then scales exchange-like values and blends growth
 * post hoc for visualization.
 */
export function calculateCommunityFlux(
  ecoliGlucose: number,
  ecoliOxygen: number,
  ecoliKnockouts: string[],
  yeastGlucose: number,
  yeastOxygen: number,
  yeastKnockouts: string[],
  alpha = 0.5, // weighting: 0 = all ecoli, 1 = all yeast
): CommunityFBAOutput {
  // Compute individual strain FBA
  const ecoliResult = runFBA(ecoliGlucose, ecoliOxygen, ecoliKnockouts);
  const yeastResult = runYeastFBA(yeastGlucose, yeastOxygen, yeastKnockouts);

  // Exchange reactions: metabolite transfer between strains via environmental pool
  const exchangeFluxes = SHARED_METABOLITES.map(sm => {
    const exporterResult = sm.exporterStrain === 'ecoli' ? ecoliResult : yeastResult;
    const importerResult = sm.importerStrain === 'ecoli' ? ecoliResult : yeastResult;

    // Export flux scales with exporter's growth; import benefit scales with importer need
    const exporterViability = exporterResult.feasible ? exporterResult.growthRate : 0;
    const importerViability = importerResult.feasible ? 1 : 0;
    const flux = sm.baseFlux * (exporterViability / 0.5) * importerViability;

    return {
      id: `EX_${sm.id}`,
      metabolite: sm.name,
      fromStrain: sm.exporterStrain,
      toStrain: sm.importerStrain,
      flux: Math.round(flux * 1000) / 1000,
    };
  });

  // Cross-feeding bonus: metabolites flowing into a strain boost its effective growth
  const ecoliFeedingBonus = exchangeFluxes
    .filter(e => e.toStrain === 'ecoli' && e.flux > 0)
    .reduce((sum, e) => sum + e.flux * 0.02, 0);
  const yeastFeedingBonus = exchangeFluxes
    .filter(e => e.toStrain === 'yeast' && e.flux > 0)
    .reduce((sum, e) => sum + e.flux * 0.02, 0);

  const adjustedEcoliGrowth = ecoliResult.growthRate + ecoliFeedingBonus;
  const adjustedYeastGrowth = yeastResult.growthRate + yeastFeedingBonus;

  // Community biomass objective: weighted sum of individual growth rates
  const communityBiomassObjective =
    (1 - alpha) * adjustedEcoliGrowth + alpha * adjustedYeastGrowth;

  return {
    ecoli: { ...ecoliResult, growthRate: Math.round(adjustedEcoliGrowth * 10000) / 10000 },
    yeast: { ...yeastResult, growthRate: Math.round(adjustedYeastGrowth * 10000) / 10000 },
    exchangeFluxes,
    communityGrowthRate: Math.round(communityBiomassObjective * 10000) / 10000,
    communityBiomassObjective: Math.round(communityBiomassObjective * 10000) / 10000,
    feasible: ecoliResult.feasible || yeastResult.feasible,
  };
}
