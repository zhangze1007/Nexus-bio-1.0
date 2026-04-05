export interface TargetBenchmark {
  id: string;
  targetAliases: string[];
  preferredHost: string;
  glucoseUptake: number;
  oxygenUptake: number;
  optimalTempC: number;
  optimalPH: number;
  dissolvedO2Setpoint: number;
  cellFreeTempC: number;
  theoreticalYieldMgL: number;
  citation: string;
}

export const TARGET_BENCHMARKS: TargetBenchmark[] = [
  {
    id: 'artemisinin',
    targetAliases: ['artemisinin', 'artemisinic acid', 'amorpha diene', 'fpp'],
    preferredHost: 'S. cerevisiae',
    glucoseUptake: 11.5,
    oxygenUptake: 13.5,
    optimalTempC: 30,
    optimalPH: 6.8,
    dissolvedO2Setpoint: 0.42,
    cellFreeTempC: 30,
    theoreticalYieldMgL: 1450,
    citation: 'Ro et al. 2006 Nature; Paddon et al. 2013 Nature',
  },
  {
    id: 'mevalonate',
    targetAliases: ['mevalonate', 'hmgr', 'hmg coa'],
    preferredHost: 'E. coli',
    glucoseUptake: 10.2,
    oxygenUptake: 11.4,
    optimalTempC: 32,
    optimalPH: 7.0,
    dissolvedO2Setpoint: 0.48,
    cellFreeTempC: 32,
    theoreticalYieldMgL: 2100,
    citation: 'Martin et al. 2003 Nat Biotechnol',
  },
  {
    id: 'lycopene',
    targetAliases: ['lycopene', 'isoprenoid', 'carotenoid'],
    preferredHost: 'E. coli',
    glucoseUptake: 9.4,
    oxygenUptake: 10.8,
    optimalTempC: 30,
    optimalPH: 7.1,
    dissolvedO2Setpoint: 0.46,
    cellFreeTempC: 29,
    theoreticalYieldMgL: 980,
    citation: 'Alper et al. 2005 Metab Eng',
  },
  {
    id: 'succinate',
    targetAliases: ['succinate', 'succinic acid'],
    preferredHost: 'E. coli',
    glucoseUptake: 8.8,
    oxygenUptake: 6.2,
    optimalTempC: 34,
    optimalPH: 6.6,
    dissolvedO2Setpoint: 0.28,
    cellFreeTempC: 33,
    theoreticalYieldMgL: 2600,
    citation: 'Jantama et al. 2008 Nat Biotechnol',
  },
  {
    id: 'vanillin',
    targetAliases: ['vanillin', 'aromatic aldehyde'],
    preferredHost: 'E. coli',
    glucoseUptake: 9.6,
    oxygenUptake: 9.1,
    optimalTempC: 31,
    optimalPH: 7.2,
    dissolvedO2Setpoint: 0.38,
    cellFreeTempC: 31,
    theoreticalYieldMgL: 760,
    citation: 'Hansen et al. 2009 Appl Environ Microbiol',
  },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function findBenchmarkByTarget(target?: string | null) {
  if (!target) return null;
  const normalized = normalize(target);
  return TARGET_BENCHMARKS.find((benchmark) =>
    benchmark.targetAliases.some((alias) => normalized.includes(normalize(alias))),
  ) ?? null;
}
