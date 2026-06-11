import type { CRISPRiTarget } from '../types';

// 20 candidate genes for CRISPRi knockdown in E. coli chassis
// Essential genes are protected from knockdown by the algorithm

export const CRISPRI_TARGETS: CRISPRiTarget[] = [
  // Essential genes: realistic knockdown efficiencies, but protected by `essential` flag
  // Positions are real E. coli K-12 MG1655 loci (NC_000913.3), rounded to kb
  { gene: 'gapA',  position: 1859,  essential: true,  knockdown_efficiency: 0.95, phenotype: 'Lethal',         growth_impact: -1.00 },
  { gene: 'gpmA',  position: 787,   essential: true,  knockdown_efficiency: 0.92, phenotype: 'Lethal',         growth_impact: -1.00 },
  { gene: 'eno',   position: 2907,  essential: true,  knockdown_efficiency: 0.94, phenotype: 'Lethal',         growth_impact: -1.00 },
  { gene: 'pykF',  position: 1754,  essential: false, knockdown_efficiency: 0.92, phenotype: 'Flux redirect',  growth_impact: -0.18 },
  { gene: 'pykA',  position: 1938,  essential: false, knockdown_efficiency: 0.88, phenotype: 'Flux redirect',  growth_impact: -0.08 },
  { gene: 'zwf',   position: 1935,  essential: false, knockdown_efficiency: 0.95, phenotype: 'PPP reduction',  growth_impact: -0.12 },
  { gene: 'pfkA',  position: 4108,  essential: false, knockdown_efficiency: 0.85, phenotype: 'Flux reduction', growth_impact: -0.15 },
  { gene: 'pfkB',  position: 1806,  essential: false, knockdown_efficiency: 0.78, phenotype: 'Mild effect',    growth_impact: -0.04 },
  { gene: 'aceA',  position: 4217,  essential: false, knockdown_efficiency: 0.91, phenotype: 'Glyoxylate OFF', growth_impact: -0.06 },
  { gene: 'aceB',  position: 4215,  essential: false, knockdown_efficiency: 0.89, phenotype: 'Glyoxylate OFF', growth_impact: -0.05 },
  { gene: 'ppc',   position: 4150,  essential: false, knockdown_efficiency: 0.94, phenotype: 'OAA reduction',  growth_impact: -0.20 },
  { gene: 'pckA',  position: 3533,  essential: false, knockdown_efficiency: 0.82, phenotype: 'Gluconeogenesis',growth_impact: -0.03 },
  { gene: 'maeB',  position: 2576,  essential: false, knockdown_efficiency: 0.76, phenotype: 'Mild effect',    growth_impact: -0.02 },
  { gene: 'sdhA',  position: 756,   essential: false, knockdown_efficiency: 0.88, phenotype: 'TCA bypass',     growth_impact: -0.11 },
  { gene: 'sucA',  position: 759,   essential: false, knockdown_efficiency: 0.90, phenotype: 'TCA bypass',     growth_impact: -0.14 },
  { gene: 'glk',   position: 2508,  essential: false, knockdown_efficiency: 0.72, phenotype: 'Glc uptake↓',   growth_impact: -0.09 },
  { gene: 'pta',   position: 2415,  essential: false, knockdown_efficiency: 0.85, phenotype: 'Acetate OFF',    growth_impact: -0.05 },
  { gene: 'ackA',  position: 2413,  essential: false, knockdown_efficiency: 0.83, phenotype: 'Acetate OFF',    growth_impact: -0.04 },
  { gene: 'ldhA',  position: 1442,  essential: false, knockdown_efficiency: 0.96, phenotype: 'Lactate OFF',    growth_impact: -0.01 },
  { gene: 'adhE',  position: 1295,  essential: false, knockdown_efficiency: 0.93, phenotype: 'Ethanol OFF',    growth_impact: -0.01 },
];

// Greedy CRISPRi target selector (confirmed real, P1.4 review).
// Scores each candidate as score = KD_eff + (1 + growth_impact) × 0.3
// to maximize knockdown potency while penalizing host fitness cost.
// Limitation: growth viability is modelled as additive per-gene impacts.
// This is valid when knockdown targets are non-interacting but breaks
// under epistasis; a future upgrade would incorporate a Wagner-style
// essentiality network that captures synthetic interactions.
export function greedyKnockdownSchedule(
  targets: CRISPRiTarget[],
  maxTargets: number,
  efficiencyThreshold: number,
  protectEssential: boolean,
): CRISPRiTarget[] {
  const candidates = targets
    .filter(t => !(protectEssential && t.essential))
    .filter(t => t.knockdown_efficiency >= efficiencyThreshold)
    .sort((a, b) => {
      const scoreA = a.knockdown_efficiency + (1 + (a.growth_impact ?? 0)) * 0.3;
      const scoreB = b.knockdown_efficiency + (1 + (b.growth_impact ?? 0)) * 0.3;
      return scoreB - scoreA;
    });
  return candidates.slice(0, maxTargets);
}
