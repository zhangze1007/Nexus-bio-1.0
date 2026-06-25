/**
 * FBASimPage helper functions and factory constructors.
 * Extracted from FBASimPage.tsx for modularity.
 */

import type { CommunityFBAOutput, FBAOutput } from "../../../data/mockFBA";
import { REACTION_DEFS, SHARED_METABOLITES, YEAST_REACTION_DEFS } from "../../../data/mockFBA";

export type SimMode = "single" | "community";

export function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function createEmptyFBAOutput(): FBAOutput {
  return {
    fluxes: Object.fromEntries(REACTION_DEFS.map((reaction) => [reaction.id, 0])),
    growthRate: 0,
    atpYield: 0,
    nadhProduction: 0,
    carbonEfficiency: 0,
    feasible: false,
    sensitivityCoefficients: {
      glc: 0,
      o2: 0,
      atp: 0,
    },
  };
}

export function createEmptyCommunityOutput(): CommunityFBAOutput {
  return {
    ecoli: createEmptyFBAOutput(),
    yeast: {
      fluxes: Object.fromEntries(YEAST_REACTION_DEFS.map((reaction) => [reaction.id, 0])),
      growthRate: 0,
      atpYield: 0,
      nadhProduction: 0,
      carbonEfficiency: 0,
      feasible: false,
      sensitivityCoefficients: {
        glc: 0,
        o2: 0,
        atp: 0,
      },
    },
    exchangeFluxes: SHARED_METABOLITES.map((metabolite) => ({
      id: `EX_${metabolite.id}`,
      metabolite: metabolite.name,
      fromStrain: metabolite.exporterStrain,
      toStrain: metabolite.importerStrain,
      flux: 0,
    })),
    communityGrowthRate: 0,
    communityBiomassObjective: 0,
    feasible: false,
  };
}
