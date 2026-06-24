'use client';
/**
 * CETHX shared types, constants, and utility functions.
 * Extracted from CETHXPage.tsx for modularity.
 */
import { THEME } from '../../../theme';
import type { PathwayKey } from '../../../data/mockCETHX';
import type { TFAReaction } from '../../../server/tfaEngine';
import type { ToolTab } from '../shared/ToolTabBar';

// ── Per-step proton stoichiometry for Alberty transform ──────────────────
// Estimated nH (net H+ absorbed) and Δz² (charge change squared) per step.
// Source: reaction stoichiometry from KEGG, typical physiological protonation.
// Steps with NAD+/NADH involve -1 nH; kinase steps with ATP/ADP are ~0 nH.
export const STEP_PROTON_STOICH: Record<PathwayKey, Array<{ nH: number; dz2: number }>> = {
  glycolysis: [
    { nH: 0, dz2: -2 },  // Glc → G6P (kinase: ATP→ADP)
    { nH: 0, dz2: 0 },   // G6P → F6P (isomerase)
    { nH: 0, dz2: -2 },  // F6P → FBP (kinase: ATP→ADP)
    { nH: 0, dz2: 0 },   // FBP → DHAP+GAP (aldolase)
    { nH: 0, dz2: 0 },   // DHAP → GAP (isomerase)
    { nH: -1, dz2: 1 },  // GAP → 1,3-BPG (dehydrogenase: NAD+→NADH)
    { nH: 0, dz2: 2 },   // 1,3-BPG → 3PG (kinase: ADP→ATP)
    { nH: 0, dz2: 0 },   // 3PG → 2PG (mutase)
    { nH: 0, dz2: 0 },   // 2PG → PEP (enolase)
    { nH: 0, dz2: 0 },   // PEP → Pyr (kinase: ADP→ATP)
  ],
  tca: [
    { nH: 0, dz2: 0 },   // AcCoA + OAA → Citrate (synthase)
    { nH: 0, dz2: 0 },   // Citrate → Isocitrate (aconitase)
    { nH: -1, dz2: 1 },  // Isocitrate → α-KG (dehydrogenase: NAD+→NADH)
    { nH: -1, dz2: 1 },  // α-KG → Succinyl-CoA (dehydrogenase: NAD+→NADH)
    { nH: 0, dz2: 2 },   // Succinyl-CoA → Succinate (kinase: GDP→GTP)
    { nH: -1, dz2: 0 },  // Succinate → Fumarate (dehydrogenase: FAD→FADH2)
    { nH: 0, dz2: 0 },   // Fumarate → Malate (hydratase)
    { nH: -1, dz2: 1 },  // Malate → OAA (dehydrogenase: NAD+→NADH)
  ],
  ppp: [
    { nH: -1, dz2: 1 },  // G6P → 6-PGL (dehydrogenase: NADP+→NADPH)
    { nH: 0, dz2: 0 },   // 6-PGL → 6-PG (lactonase)
    { nH: -1, dz2: 1 },  // 6-PG → Ribulose-5P (decarboxylating dehydrogenase)
    { nH: 0, dz2: 0 },   // Ribulose-5P → Ribose-5P (isomerase)
    { nH: 0, dz2: 0 },   // Transketolase
    { nH: 0, dz2: 0 },   // Transaldolase
  ],
};

/** Feasibility classification for a single step */
export type StepFeasibility = 'feasible' | 'marginal' | 'infeasible';

export function classifyFeasibility(dG: number): StepFeasibility {
  if (dG < -5) return 'feasible';
  if (dG <= 5) return 'marginal';
  return 'infeasible';
}

export const FEASIBILITY_TONE: Record<StepFeasibility, 'cool' | 'neutral' | 'warm'> = {
  feasible: 'cool',
  marginal: 'neutral',
  infeasible: 'warm',
};

// ── Pathway list ───────────────────────────────────────────────────────
export const PATHWAYS: { id: PathwayKey; label: string; desc: string }[] = [
  { id: 'glycolysis', label: 'Glycolysis', desc: 'Glucose → 2 Pyruvate' },
  { id: 'tca',        label: 'TCA Cycle',  desc: 'Acetyl-CoA → CO₂ + energy' },
  { id: 'ppp',        label: 'Pentose ℙ',  desc: 'G6P → Ribose-5P + NADPH' },
];

export const CETHX_TABS: ToolTab[] = [
  { id: 'waterfall', label: 'Waterfall', accent: THEME.SKY },
  { id: 'atp', label: 'ATP Ledger', accent: THEME.LILAC },
  { id: 'feasibility', label: 'Feasibility', accent: THEME.APRICOT },
  { id: 'tfa', label: 'TFA', accent: THEME.MINT },
];

// ── Pre-loaded glycolysis fragment for TFA demo ─────────────────────────
export const GLYCOLYSIS_TFA_REACTIONS: TFAReaction[] = [
  { id: 'HEX1',  deltaG0Prime: -27.2, stoichiometry: { glc: -1, atp: -1, g6p: 1, adp: 1 }, nH: 0, deltaZSquared: -2 },
  { id: 'PGI',   deltaG0Prime:  1.7,  stoichiometry: { g6p: -1, f6p: 1 }, nH: 0, deltaZSquared: 0 },
  { id: 'PFK',   deltaG0Prime: -14.2, stoichiometry: { f6p: -1, atp: -1, fbp: 1, adp: 1 }, nH: 0, deltaZSquared: -2 },
  { id: 'FBA',   deltaG0Prime:  23.8, stoichiometry: { fbp: -1, dhap: 1, gap: 1 }, nH: 0, deltaZSquared: 0 },
  { id: 'TPI',   deltaG0Prime:  7.5,  stoichiometry: { dhap: -1, gap: 1 }, nH: 0, deltaZSquared: 0 },
  { id: 'GAPD',  deltaG0Prime:  6.3,  stoichiometry: { gap: -1, nad: -1, pi: -1, bpg13: 1, nadh: 1 }, nH: -1, deltaZSquared: 1 },
  { id: 'PGK',   deltaG0Prime: -18.5, stoichiometry: { bpg13: -1, adp: -1, pg3: 1, atp: 1 }, nH: 0, deltaZSquared: 2 },
  { id: 'PGM',   deltaG0Prime:  4.4,  stoichiometry: { pg3: -1, pg2: 1 }, nH: 0, deltaZSquared: 0 },
  { id: 'ENO',   deltaG0Prime:  7.5,  stoichiometry: { pg2: -1, pep: 1, h2o: 1 }, nH: 0, deltaZSquared: 0 },
  { id: 'PYK',   deltaG0Prime: -31.4, stoichiometry: { pep: -1, adp: -1, pyr: 1, atp: 1 }, nH: 0, deltaZSquared: 0 },
];
