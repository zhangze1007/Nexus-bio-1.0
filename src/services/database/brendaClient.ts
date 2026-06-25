/**
 * BRENDA / SABIO-RK Enzyme Kinetics Client
 *
 * Fetches enzyme kinetics parameters (Km, kcat) with a 3-tier fallback:
 *   1. SABIO-RK live API   → source: 'live'   (real experimental data)
 *   2. Local reference      → source: 'mock'   (curated literature values)
 *   3. Default fallback     → source: 'mock'   (generic placeholder)
 *
 * Sources:
 *   - SABIO-RK: Wittig et al. (2012) Nucleic Acids Res. 40:D790-D796
 *   - BRENDA:   Chang et al. (2021) Nucleic Acids Res. 49:D498-D508
 */

import { type FallbackResult, fetchWithFallback } from "./fetchWithFallback";

export interface BRENDAKinetics {
  ecNumber: string;
  enzymeName: string;
  km: { value: number; unit: string; substrate: string }[];
  kcat: { value: number; unit: string; substrate: string }[];
  /** Provenance: which data source provided these values */
  dataSource?: "sabio_rk" | "brenda_local" | "default_fallback";
  organism?: string;
  entryCount?: number;
}

/**
 * Local reference table — curated literature values for the 17 most
 * commonly encountered enzymes in synthetic biology workflows.
 *
 * These are real published values, not random defaults.
 * Serves as fallback when SABIO-RK is unavailable.
 */
const LOCAL_REFERENCE: Record<string, BRENDAKinetics> = {
  "1.1.1.1": {
    ecNumber: "1.1.1.1",
    enzymeName: "Alcohol dehydrogenase",
    km: [{ value: 0.5, unit: "mM", substrate: "ethanol" }],
    kcat: [{ value: 78, unit: "1/s", substrate: "ethanol" }],
  },
  "1.1.1.27": {
    ecNumber: "1.1.1.27",
    enzymeName: "Lactate dehydrogenase",
    km: [{ value: 0.6, unit: "mM", substrate: "pyruvate" }],
    kcat: [{ value: 250, unit: "1/s", substrate: "pyruvate" }],
  },
  "1.1.1.49": {
    ecNumber: "1.1.1.49",
    enzymeName: "Glucose-6-phosphate dehydrogenase",
    km: [{ value: 0.06, unit: "mM", substrate: "glucose-6-phosphate" }],
    kcat: [{ value: 110, unit: "1/s", substrate: "glucose-6-phosphate" }],
  },
  "1.2.1.12": {
    ecNumber: "1.2.1.12",
    enzymeName: "Glyceraldehyde-3-phosphate dehydrogenase",
    km: [{ value: 0.21, unit: "mM", substrate: "G3P" }],
    kcat: [{ value: 140, unit: "1/s", substrate: "G3P" }],
  },
  "2.3.1.9": {
    ecNumber: "2.3.1.9",
    enzymeName: "Acetyl-CoA acetyltransferase (thiolase)",
    km: [{ value: 0.012, unit: "mM", substrate: "acetyl-CoA" }],
    kcat: [{ value: 45, unit: "1/s", substrate: "acetyl-CoA" }],
  },
  "2.7.1.1": {
    ecNumber: "2.7.1.1",
    enzymeName: "Hexokinase",
    km: [{ value: 0.1, unit: "mM", substrate: "D-glucose" }],
    kcat: [{ value: 200, unit: "1/s", substrate: "D-glucose" }],
  },
  "2.7.1.2": {
    ecNumber: "2.7.1.2",
    enzymeName: "Glucokinase",
    km: [{ value: 8.0, unit: "mM", substrate: "D-glucose" }],
    kcat: [{ value: 60, unit: "1/s", substrate: "D-glucose" }],
  },
  "2.7.1.11": {
    ecNumber: "2.7.1.11",
    enzymeName: "Phosphofructokinase",
    km: [{ value: 0.1, unit: "mM", substrate: "D-fructose 6-phosphate" }],
    kcat: [{ value: 150, unit: "1/s", substrate: "F6P" }],
  },
  "2.7.1.40": {
    ecNumber: "2.7.1.40",
    enzymeName: "Pyruvate kinase",
    km: [{ value: 0.34, unit: "mM", substrate: "phosphoenolpyruvate" }],
    kcat: [{ value: 320, unit: "1/s", substrate: "PEP" }],
  },
  "3.1.1.3": {
    ecNumber: "3.1.1.3",
    enzymeName: "Triacylglycerol lipase",
    km: [{ value: 1.0, unit: "mM", substrate: "tributyrin" }],
    kcat: [{ value: 35, unit: "1/s", substrate: "tributyrin" }],
  },
  "3.2.1.4": {
    ecNumber: "3.2.1.4",
    enzymeName: "Cellulase (endoglucanase)",
    km: [{ value: 3.6, unit: "mM", substrate: "carboxymethylcellulose" }],
    kcat: [{ value: 15, unit: "1/s", substrate: "CMC" }],
  },
  "3.5.1.5": {
    ecNumber: "3.5.1.5",
    enzymeName: "Urease",
    km: [{ value: 25, unit: "mM", substrate: "urea" }],
    kcat: [{ value: 5500, unit: "1/s", substrate: "urea" }],
  },
  "4.1.1.39": {
    ecNumber: "4.1.1.39",
    enzymeName: "Ribulose-bisphosphate carboxylase (RuBisCO)",
    km: [{ value: 0.01, unit: "mM", substrate: "RuBP" }],
    kcat: [{ value: 3.6, unit: "1/s", substrate: "RuBP" }],
  },
  "4.2.1.1": {
    ecNumber: "4.2.1.1",
    enzymeName: "Carbonic anhydrase",
    km: [{ value: 12, unit: "mM", substrate: "CO2" }],
    kcat: [{ value: 1000000, unit: "1/s", substrate: "CO2" }],
  },
  "5.3.1.9": {
    ecNumber: "5.3.1.9",
    enzymeName: "Glucose-6-phosphate isomerase",
    km: [{ value: 0.4, unit: "mM", substrate: "fructose-6-phosphate" }],
    kcat: [{ value: 540, unit: "1/s", substrate: "F6P" }],
  },
  "6.2.1.1": {
    ecNumber: "6.2.1.1",
    enzymeName: "Acetyl-CoA synthetase",
    km: [{ value: 0.15, unit: "mM", substrate: "acetate" }],
    kcat: [{ value: 30, unit: "1/s", substrate: "acetate" }],
  },
  "2.3.3.1": {
    ecNumber: "2.3.3.1",
    enzymeName: "Citrate synthase",
    km: [{ value: 0.005, unit: "mM", substrate: "oxaloacetate" }],
    kcat: [{ value: 80, unit: "1/s", substrate: "oxaloacetate" }],
  },
};

/**
 * SABIO-RK API response shape (from our proxy).
 */
interface SabioResponse {
  ok: boolean;
  km: number;
  kcat: number;
  vmax: number;
  organism?: string;
  entryCount: number;
  source: string;
  ecNumber: string;
}

/**
 * Try to fetch enzyme kinetics from SABIO-RK via our proxy.
 * Returns a BRENDAKinetics if SABIO-RK has data, or null if not.
 */
async function fetchFromSabio(ecNumber: string): Promise<BRENDAKinetics | null> {
  try {
    const res = await fetch(`/api/sabio?ec=${encodeURIComponent(ecNumber)}`, {
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;

    const data: SabioResponse = await res.json();
    if (!data.ok || data.entryCount === 0) return null;
    if (isNaN(data.km) && isNaN(data.kcat)) return null;

    const km: BRENDAKinetics["km"] = isNaN(data.km)
      ? []
      : [{ value: data.km, unit: "mM", substrate: "SABIO-RK (median)" }];

    const kcat: BRENDAKinetics["kcat"] = isNaN(data.kcat)
      ? []
      : [{ value: data.kcat, unit: "1/s", substrate: "SABIO-RK (median)" }];

    return {
      ecNumber,
      enzymeName: `EC ${ecNumber}`,
      km,
      kcat,
      dataSource: "sabio_rk",
      organism: data.organism,
      entryCount: data.entryCount,
    };
  } catch {
    return null;
  }
}

/**
 * Main entry point — 3-tier fallback for enzyme kinetics:
 *   1. SABIO-RK live API
 *   2. Local reference table (curated literature values)
 *   3. Default fallback (generic placeholder with warning)
 */
export async function getBRENDAKinetics(ecNumber: string): Promise<FallbackResult<BRENDAKinetics>> {
  // Tier 1: Try SABIO-RK live API
  const sabioData = await fetchFromSabio(ecNumber);
  if (sabioData && (sabioData.km.length > 0 || sabioData.kcat.length > 0)) {
    return {
      data: sabioData,
      source: "live",
      apiName: "SABIO-RK",
    };
  }

  // Tier 2: Local reference table
  const localEntry = LOCAL_REFERENCE[ecNumber];
  if (localEntry) {
    return {
      data: { ...localEntry, dataSource: "brenda_local" },
      source: "mock",
      error: "SABIO-RK unavailable; using curated literature values",
      apiName: "SABIO-RK (local fallback)",
    };
  }

  // Tier 3: Default fallback — always include at least one Km/kcat entry
  // so consumers that index [0] without length checks don't crash.
  const defaultData: BRENDAKinetics = {
    ecNumber,
    enzymeName: `EC ${ecNumber} (unverified)`,
    km: [{ value: 0.5, unit: "mM", substrate: "default estimate" }],
    kcat: [{ value: 10, unit: "1/s", substrate: "default estimate" }],
    dataSource: "default_fallback",
  };

  return {
    data: defaultData,
    source: "mock",
    error: `No kinetics data found for EC ${ecNumber} in SABIO-RK or local reference`,
    apiName: "SABIO-RK (default fallback)",
  };
}
