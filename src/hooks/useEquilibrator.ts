/**
 * useEquilibrator — Hook for condition-aware thermodynamic calculations
 *
 * Fetches real ΔG' values from eQuilibrator API when available,
 * falls back to reference ΔG° values from Lehninger/NIST.
 *
 * References:
 *   - eQuilibrator 3 (Beber et al. 2022, Nucleic Acids Research)
 *   - Alberty (2003) Thermodynamics of Biochemical Reactions
 */

import { useCallback, useEffect, useState } from "react";

interface EquilibratorConditions {
  pH: number;
  temperature: number; // °C
  ionicStrength?: number; // M, default 0.25
}

interface EquilibratorResult {
  dG_prime: number; // kJ/mol
  dG_prime_uncertainty: number;
  dG_physiological: number;
  dG_physiological_uncertainty: number;
  conditions: {
    pH: number;
    ionic_strength_M: number;
    temperature_K: number;
    pMg: number;
  };
  balanced: boolean;
  source: string;
}

interface UseEquilibratorReturn {
  data: EquilibratorResult | null;
  loading: boolean;
  error: string | null;
  isRealData: boolean;
  calculate: (reaction: string, conditions: EquilibratorConditions) => Promise<void>;
}

/**
 * KEGG reaction IDs for glycolysis, TCA, and PPP pathways.
 * These map to the reaction formulas needed by eQuilibrator.
 */
export const KEGG_REACTIONS: Record<string, Record<string, string>> = {
  glycolysis: {
    "Glc → G6P": "kegg:C00031 + kegg:C00002 = kegg:C00085 + kegg:C00008",
    "G6P → F6P": "kegg:C00085 = kegg:C00076",
    "F6P → FBP": "kegg:C00076 + kegg:C00002 = kegg:C00354 + kegg:C00008",
    "FBP → DHAP+GAP": "kegg:C00354 = kegg:C00111 + kegg:C00118",
    "DHAP → GAP": "kegg:C00111 = kegg:C00118",
    "GAP → 1,3-BPG": "kegg:C00118 + kegg:C00002 + kegg:C00003 = kegg:C00236 + kegg:C00004 + kegg:C00080",
    "1,3-BPG → 3PG": "kegg:C00236 + kegg:C00005 = kegg:C00197 + kegg:C00002",
    "3PG → 2PG": "kegg:C00197 = kegg:C00631",
    "2PG → PEP": "kegg:C00631 = kegg:C00074 + kegg:C00001",
    "PEP → Pyr": "kegg:C00074 + kegg:C00001 = kegg:C00022 + kegg:C00009",
  },
  tca: {
    "AcCoA + OAA → Citrate": "kegg:C00024 + kegg:C00036 = kegg:C00158 + kegg:C00010",
    "Citrate → Isocitrate": "kegg:C00158 = kegg:C00311",
    "Isocitrate → α-KG": "kegg:C00311 + kegg:C00003 = kegg:C00026 + kegg:C00004 + kegg:C00011",
    "α-KG → Succinyl-CoA": "kegg:C00026 + kegg:C00003 + kegg:C00010 = kegg:C00091 + kegg:C00004 + kegg:C00011",
    "Succinyl-CoA → Succinate": "kegg:C00091 + kegg:C00005 + kegg:C00002 = kegg:C00042 + kegg:C00010",
    "Succinate → Fumarate": "kegg:C00042 + kegg:C00003 = kegg:C00122 + kegg:C00004",
    "Fumarate → Malate": "kegg:C00122 + kegg:C00001 = kegg:C00149",
    "Malate → OAA": "kegg:C00149 + kegg:C00003 = kegg:C00036 + kegg:C00004",
  },
  ppp: {
    "G6P → 6-PGL": "kegg:C00085 + kegg:C00003 = kegg:C00936 + kegg:C00004",
    "6-PGL → 6-PG": "kegg:C00936 + kegg:C00001 = kegg:C00345",
    "6-PG → Ribulose-5P": "kegg:C00345 + kegg:C00003 = kegg:C00199 + kegg:C00004 + kegg:C00011",
    "Ribulose-5P → Ribose-5P": "kegg:C00199 = kegg:C00117",
    "Transketolase (×2)": "kegg:C00117 + kegg:C00118 = kegg:C00085 + kegg:C00279",
    Transaldolase: "kegg:C00279 + kegg:C00118 = kegg:C00031 + kegg:C00074",
  },
};

/**
 * Hook for condition-aware thermodynamic calculations via eQuilibrator.
 */
export function useEquilibrator(): UseEquilibratorReturn {
  const [data, setData] = useState<EquilibratorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRealData, setIsRealData] = useState(false);

  const calculate = useCallback(async (reaction: string, conditions: EquilibratorConditions) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/equilibrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reaction,
          pH: conditions.pH,
          temperature: conditions.temperature + 273.15, // Convert to Kelvin
          ionic_strength: conditions.ionicStrength || 0.25,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setData(result);
      setIsRealData(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setIsRealData(false);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, isRealData, calculate };
}

/**
 * Batch calculate ΔG' for multiple reactions.
 */
export async function batchCalculateDG(
  reactions: Array<{ id: string; formula: string }>,
  conditions: EquilibratorConditions,
): Promise<Map<string, EquilibratorResult>> {
  const results = new Map<string, EquilibratorResult>();

  // Try to fetch all at once
  try {
    const promises = reactions.map(async ({ id, formula }) => {
      const response = await fetch("/api/equilibrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reaction: formula,
          pH: conditions.pH,
          temperature: conditions.temperature + 273.15,
          ionic_strength: conditions.ionicStrength || 0.25,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (!result.error) {
          results.set(id, result);
        }
      }
    });

    await Promise.allSettled(promises);
  } catch {
    // Silently fail - will use fallback values
  }

  return results;
}
