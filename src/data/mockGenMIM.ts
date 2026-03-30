import type { CRISPRiTarget } from '../types';

// 20 candidate genes for CRISPRi knockdown in E. coli chassis
// Essential genes are protected from knockdown by the algorithm

export const CRISPRI_TARGETS: CRISPRiTarget[] = [
  { gene: 'gapA',  position: 1848,  essential: true,  knockdown_efficiency: 0.0,  phenotype: 'Lethal',         growth_impact: -1.00 },
  { gene: 'gpmA',  position: 3386,  essential: true,  knockdown_efficiency: 0.0,  phenotype: 'Lethal',         growth_impact: -1.00 },
  { gene: 'eno',   position: 3715,  essential: true,  knockdown_efficiency: 0.0,  phenotype: 'Lethal',         growth_impact: -1.00 },
  { gene: 'pykF',  position: 1754,  essential: false, knockdown_efficiency: 0.92, phenotype: 'Flux redirect',  growth_impact: -0.18 },
  { gene: 'pykA',  position: 1476,  essential: false, knockdown_efficiency: 0.88, phenotype: 'Flux redirect',  growth_impact: -0.08 },
  { gene: 'zwf',   position: 1625,  essential: false, knockdown_efficiency: 0.95, phenotype: 'PPP reduction',  growth_impact: -0.12 },
  { gene: 'pfkA',  position: 3894,  essential: false, knockdown_efficiency: 0.85, phenotype: 'Flux reduction', growth_impact: -0.15 },
  { gene: 'pfkB',  position: 399,   essential: false, knockdown_efficiency: 0.78, phenotype: 'Mild effect',    growth_impact: -0.04 },
  { gene: 'aceA',  position: 3930,  essential: false, knockdown_efficiency: 0.91, phenotype: 'Glyoxylate OFF', growth_impact: -0.06 },
  { gene: 'aceB',  position: 3928,  essential: false, knockdown_efficiency: 0.89, phenotype: 'Glyoxylate OFF', growth_impact: -0.05 },
  { gene: 'ppc',   position: 3307,  essential: false, knockdown_efficiency: 0.94, phenotype: 'OAA reduction',  growth_impact: -0.20 },
  { gene: 'pckA',  position: 3404,  essential: false, knockdown_efficiency: 0.82, phenotype: 'Gluconeogenesis',growth_impact: -0.03 },
  { gene: 'maeB',  position: 2425,  essential: false, knockdown_efficiency: 0.76, phenotype: 'Mild effect',    growth_impact: -0.02 },
  { gene: 'sdhA',  position: 407,   essential: false, knockdown_efficiency: 0.88, phenotype: 'TCA bypass',     growth_impact: -0.11 },
  { gene: 'sucA',  position: 758,   essential: false, knockdown_efficiency: 0.90, phenotype: 'TCA bypass',     growth_impact: -0.14 },
  { gene: 'glk',   position: 2921,  essential: false, knockdown_efficiency: 0.72, phenotype: 'Glc uptake↓',   growth_impact: -0.09 },
  { gene: 'pta',   position: 3371,  essential: false, knockdown_efficiency: 0.85, phenotype: 'Acetate OFF',    growth_impact: -0.05 },
  { gene: 'ackA',  position: 3372,  essential: false, knockdown_efficiency: 0.83, phenotype: 'Acetate OFF',    growth_impact: -0.04 },
  { gene: 'ldhA',  position: 1380,  essential: false, knockdown_efficiency: 0.96, phenotype: 'Lactate OFF',    growth_impact: -0.01 },
  { gene: 'adhE',  position: 1414,  essential: false, knockdown_efficiency: 0.93, phenotype: 'Ethanol OFF',    growth_impact: -0.01 },
];

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
      // Maximize knockdown efficiency, minimize growth impact
      const scoreA = a.knockdown_efficiency + (1 + (a.growth_impact ?? 0)) * 0.3;
      const scoreB = b.knockdown_efficiency + (1 + (b.growth_impact ?? 0)) * 0.3;
      return scoreB - scoreA;
    });
  return candidates.slice(0, maxTargets);
}
