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
}

/**
 * Flux balance heuristic: proportional flux distribution from stoichiometric
 * constraints. Knockouts are propagated downstream from the first blocked step.
 */
export function runFBA(
  glucoseUptake: number,
  oxygenUptake: number,
  knockouts: string[] = [],
): FBAOutput {
  const scale = glucoseUptake / 10;
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
    BIOMASS: glucoseUptake * 0.082 * aerobic * scale,
  };

  // Apply knockouts — zero out and propagate downstream
  const koSet = new Set(knockouts);
  if (koSet.has('GLCpts') || koSet.has('GAPD')) {
    // Upstream block → entire pathway collapses
    Object.keys(raw).forEach(k => raw[k] = 0);
  } else {
    knockouts.forEach(ko => { if (raw[ko] !== undefined) raw[ko] = 0; });
    // Downstream collapse: if PYK knocked out, block PDH and BIOMASS
    if (koSet.has('PYK')) { raw['PDH'] = 0; raw['BIOMASS'] = 0; }
    if (koSet.has('PDH')) { raw['BIOMASS'] = 0; }
  }

  const glcFlux = raw['GLCpts'] || 1e-9;
  const pgkFlux = raw['PGK'] ?? 0;
  const pykFlux = raw['PYK'] ?? 0;
  const gapdFlux = raw['GAPD'] ?? 0;
  const biomassFlux = raw['BIOMASS'] ?? 0;

  const atpYield     = (pgkFlux * 2 + pykFlux) / glcFlux;
  const nadhProd     = gapdFlux * 2;
  const cEfficiency  = (biomassFlux * 46) / (glcFlux * 6) * 100;

  return {
    fluxes:          raw,
    growthRate:      Math.round(biomassFlux * 10000) / 10000,
    atpYield:        Math.round(atpYield * 100) / 100,
    nadhProduction:  Math.round(nadhProd * 100) / 100,
    carbonEfficiency:Math.max(0, Math.min(100, Math.round(cEfficiency * 10) / 10)),
    feasible:        biomassFlux > 1e-6,
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
