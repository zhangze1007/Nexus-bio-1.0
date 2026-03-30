import type { ThermoStep } from '../types';

// Glycolysis ΔG° values (kJ/mol) at standard conditions (pH 7, 25°C)
// Source: Lehninger, Nelson & Cox; NIST Webbook
export const GLYCOLYSIS_STEPS: ThermoStep[] = [
  { step: 'Glc → G6P',    deltaG: -16.7, cumulative: -16.7, atpYield: -1 },
  { step: 'G6P → F6P',    deltaG: +1.7,  cumulative: -15.0, atpYield: 0  },
  { step: 'F6P → FBP',    deltaG: -14.2, cumulative: -29.2, atpYield: -1 },
  { step: 'FBP → DHAP+GAP', deltaG: +23.8, cumulative: -5.4, atpYield: 0 },
  { step: 'DHAP → GAP',   deltaG: +7.5,  cumulative: +2.1,  atpYield: 0  },
  { step: 'GAP → 1,3-BPG',deltaG: +6.3,  cumulative: +8.4,  atpYield: 0  },
  { step: '1,3-BPG → 3PG',deltaG: -18.8, cumulative: -10.4, atpYield: 2  },
  { step: '3PG → 2PG',    deltaG: +4.4,  cumulative: -6.0,  atpYield: 0  },
  { step: '2PG → PEP',    deltaG: +1.8,  cumulative: -4.2,  atpYield: 0  },
  { step: 'PEP → Pyr',    deltaG: -31.4, cumulative: -35.6, atpYield: 2  },
];

export const TCA_STEPS: ThermoStep[] = [
  { step: 'AcCoA + OAA → Citrate', deltaG: -32.2, cumulative: -32.2, atpYield: 0 },
  { step: 'Citrate → Isocitrate',  deltaG: +13.3, cumulative: -18.9, atpYield: 0 },
  { step: 'Isocitrate → α-KG',     deltaG: -20.9, cumulative: -39.8, atpYield: 0 },
  { step: 'α-KG → Succinyl-CoA',   deltaG: -33.5, cumulative: -73.3, atpYield: 0 },
  { step: 'Succinyl-CoA → Succinate',deltaG: -2.1, cumulative: -75.4, atpYield: 1 },
  { step: 'Succinate → Fumarate',  deltaG: +0.0,  cumulative: -75.4, atpYield: 0 },
  { step: 'Fumarate → Malate',     deltaG: -3.6,  cumulative: -79.0, atpYield: 0 },
  { step: 'Malate → OAA',          deltaG: +29.7, cumulative: -49.3, atpYield: 0 },
];

export const PPP_STEPS: ThermoStep[] = [
  { step: 'G6P → 6-PGL',          deltaG: -17.6, cumulative: -17.6, atpYield: 0 },
  { step: '6-PGL → 6-PG',         deltaG: -25.0, cumulative: -42.6, atpYield: 0 },
  { step: '6-PG → Ribulose-5P',   deltaG: -19.0, cumulative: -61.6, atpYield: 0 },
  { step: 'Ribulose-5P → Ribose-5P',deltaG: +2.4, cumulative: -59.2, atpYield: 0},
  { step: 'Transketolase (×2)',    deltaG: -6.3,  cumulative: -65.5, atpYield: 0 },
  { step: 'Transaldolase',         deltaG: -0.4,  cumulative: -65.9, atpYield: 0 },
];

export type PathwayKey = 'glycolysis' | 'tca' | 'ppp';

export const PATHWAY_STEPS: Record<PathwayKey, ThermoStep[]> = {
  glycolysis: GLYCOLYSIS_STEPS,
  tca: TCA_STEPS,
  ppp: PPP_STEPS,
};

// Van't Hoff ΔG' = ΔG° + RT·ln(Q) temperature correction
export function correctedDeltaG(deltaG: number, tempC: number, pH: number): number {
  const R = 0.008314; // kJ/mol/K
  const T = tempC + 273.15;
  const pHcorrection = (pH - 7.0) * (-2.303 * R * T);
  const tempFactor = T / 298.15;
  return deltaG * tempFactor + pHcorrection * 0.1;
}

export function computeThermo(steps: ThermoStep[], tempC: number, pH: number) {
  const corrected = steps.map(s => ({
    ...s,
    deltaG: correctedDeltaG(s.deltaG, tempC, pH),
    cumulative: 0,
  }));
  let cum = 0;
  corrected.forEach(s => { cum += s.deltaG; s.cumulative = cum; });

  const atpNet = steps.reduce((a, s) => a + s.atpYield, 0);
  const nadhYield = steps.filter(s => s.atpYield === 0 && s.deltaG < -10).length * 2;
  const totalDeltaG = cum;
  const efficiency = Math.max(0, Math.min(1, -totalDeltaG / 2870 * 100)); // vs glucose combustion

  return {
    steps: corrected,
    atp_yield: atpNet,
    nadh_yield: nadhYield,
    entropy_production: -totalDeltaG / (tempC + 273.15),
    gibbs_free_energy: totalDeltaG,
    efficiency,
  };
}
