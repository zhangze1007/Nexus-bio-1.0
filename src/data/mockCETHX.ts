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

// Reference ΔG°' values (pH 7, 25°C, I = 0.25 M) from Lehninger / NIST.
// HONEST DEMO MODE: we deliberately do NOT apply ad-hoc temperature/pH "corrections"
// here. A scientifically valid transform requires the Alberty Legendre transform
// with per-reaction proton stoichiometry and ionic-strength-corrected formation
// energies (e.g. eQuilibrator API). The previous implementation multiplied ΔG° by
// (T/298.15) and added a hand-tuned "* 0.1" pH term, both of which are incorrect.
// Until eQuilibrator integration lands, we surface the reference value unchanged
// and the UI must label outputs as "Lehninger reference ΔG°' — demo only".
export function correctedDeltaG(deltaG: number, _tempC: number, _pH: number): number {
  return deltaG;
}

export function computeThermo(steps: ThermoStep[], tempC: number, pH: number) {
  const corrected = steps.map(s => ({
    ...s,
    deltaG: correctedDeltaG(s.deltaG, tempC, pH),
    cumulative: 0,
  }));
  let cum = 0;
  corrected.forEach(s => { cum += s.deltaG; s.cumulative = cum; });

  // ATP/NADH yields are taken directly from the curated reference table.
  // We previously inferred NADH yield from "deltaG < -10 kJ/mol" which has no
  // biochemical basis; that heuristic has been removed. NADH yield is now an
  // explicit per-step field (defaults to 0 when omitted by the data source).
  const atpNet = steps.reduce((a, s) => a + s.atpYield, 0);
  const nadhYield = steps.reduce((a, s) => a + ((s as ThermoStep & { nadhYield?: number }).nadhYield ?? 0), 0);
  const totalDeltaG = cum;
  // Fraction of glucose combustion enthalpy (-2870 kJ/mol) captured as -ΔG along
  // the modelled segment. Bounded to [0,1]; this is an order-of-magnitude
  // illustration, not a true thermodynamic efficiency.
  const efficiency = Math.max(0, Math.min(1, -totalDeltaG / 2870));

  // Total Gibbs energy dissipated along the pathway (kJ per mol substrate).
  // The previous field "entropy_production = -ΔG / T" is dimensionally a single
  // entropy change (kJ/mol/K), NOT a rate (which would require a flux). We expose
  // both quantities under honest names.
  const T = tempC + 273.15;
  const dissipationKJ = -totalDeltaG;
  const entropyChange = dissipationKJ / T; // kJ/(mol·K), per mol substrate processed

  return {
    steps: corrected,
    atp_yield: atpNet,
    nadh_yield: nadhYield,
    entropy_production: entropyChange, // retained key for backward compat (now honest units)
    dissipation_kJ_per_mol: dissipationKJ,
    gibbs_free_energy: totalDeltaG,
    efficiency,
  };
}
