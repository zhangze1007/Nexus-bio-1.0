/**
 * Thermodynamics Engine — core thermodynamic calculations for biochemistry.
 *
 * Implements:
 *   1. Group contribution method (Mavrovouniotis 1991) for ΔG°f estimation
 *   2. Alberty transformed Gibbs energy (Alberty 2003)
 *   3. Pathway ΔG summation
 *   4. Equilibrium constant from ΔG°
 *   5. Actual ΔG from standard ΔG° and metabolite concentrations
 *
 * @scientific_provenance
 * VALIDITY_TIER: real
 *
 * References:
 *   - Mavrovouniotis (1991) J Biol Chem 266(22):14440-14445
 *   - Alberty (2003) Thermodynamics of Biochemical Reactions, Wiley
 *   - Goldberg & Tewari (1991) Biophys Chem 40:241-261
 *   - eQuilibrator 3 (Beber et al. 2022, Nucleic Acids Research)
 */

import { estimateFormationEnergy, type GroupContributionResult } from "../utils/groupContribution";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Universal gas constant in kJ/(mol·K) */
export const R = 8.314e-3;

/** ln(10) for pH conversions */
const LN10 = Math.LN10;

/** Reference temperature in K (25 °C) */
export const T_REF = 298.15;

// ---------------------------------------------------------------------------
// 1. Group Contribution Method (Mavrovouniotis 1991)
// ---------------------------------------------------------------------------
// Group contribution estimation is delegated to utils/groupContribution.ts,
// which uses a proper SMILES graph parser instead of naive string matching.
// The adapter function adaptGroupContributionResult() bridges the result
// format to ThermoEstimate.

// ---------------------------------------------------------------------------
// 2. Alberty Transformed Gibbs Energy
// ---------------------------------------------------------------------------

/**
 * Calculate the Alberty transformed Gibbs energy (ΔG'°) under
 * non-standard pH, ionic strength, and temperature conditions.
 *
 * The Alberty formalism accounts for:
 *   - pH-dependent protonation state changes
 *   - Ionic strength effects via Debye-Hückel theory
 *   - Temperature scaling of the standard ΔG°
 *
 * Formula:
 *   ΔG'° = ΔG° + RT·ln(10)·(pH - 7)·nH + Debye-Hückel correction
 *
 * where the Debye-Hückel correction is:
 *   Δz² · (-9.205 · I^0.5 / (1 + 1.6 · I^0.5))
 *
 * @param dG0   - Standard Gibbs energy change at pH 7, I=0.1 M, 25 °C (kJ/mol)
 * @param pH    - Solution pH
 * @param ionicStrength - Ionic strength in M (mol/L)
 * @param temp  - Temperature in K
 * @param nH    - Net number of protons absorbed (positive = consumes H+)
 * @param deltaZSquared - Change in sum of squared charges (products - reactants)
 * @returns Transformed Gibbs energy ΔG'° in kJ/mol
 *
 * @scientific_provenance
 * Alberty (2003) Thermodynamics of Biochemical Reactions, Wiley
 * Goldberg & Tewari (1991) Biophys Chem 40:241-261
 */
export function calcTransformedGibbs(
  dG0: number,
  pH: number,
  ionicStrength: number,
  temp: number,
  nH: number = 0,
  deltaZSquared: number = 0,
): number {
  if (temp <= 0) throw new Error("Temperature must be positive (K)");
  if (ionicStrength < 0) throw new Error("Ionic strength must be non-negative");
  if (pH < 0 || pH > 14) throw new Error("pH must be between 0 and 14");

  // pH-dependent proton contribution
  const protonTerm = R * temp * LN10 * (pH - 7) * nH;

  // Debye-Hückel correction for ionic strength
  // Alberty (2003) formulation — stabilizes charged species:
  //   ΔG_DH = +9.205 · Δz² · √I / (1 + 1.6 · √I)
  // where Δz² = Σ_products(zi²) - Σ_reactants(zi²)
  const sqrtI = Math.sqrt(ionicStrength);
  const debyeHuckel = deltaZSquared !== 0 ? (9.205 * deltaZSquared * sqrtI) / (1 + 1.6 * sqrtI) : 0;

  return dG0 + protonTerm + debyeHuckel;
}

/**
 * Calculate the transformed equilibrium constant K'eq from ΔG'°.
 *
 * K'eq = exp(-ΔG'° / RT)
 *
 * @param dGTransformed - Transformed Gibbs energy (kJ/mol)
 * @param temp - Temperature in K
 * @returns Transformed equilibrium constant
 */
export function calcTransformedKeq(dGTransformed: number, temp: number): number {
  if (temp <= 0) throw new Error("Temperature must be positive (K)");
  return Math.exp(-dGTransformed / (R * temp));
}

// ---------------------------------------------------------------------------
// 3. Pathway ΔG Summation
// ---------------------------------------------------------------------------

export interface PathwayStep {
  /** Standard Gibbs energy change for this step (kJ/mol) */
  dG0: number;
  /** Net protons absorbed in this step (default 0) */
  nH?: number;
  /** Change in squared charge sum (products - reactants, default 0) */
  z?: number;
}

/**
 * Calculate the total transformed Gibbs energy across a metabolic pathway.
 *
 * Sums the Alberty-transformed ΔG'° for each step under consistent
 * pH, ionic strength, and temperature conditions.
 *
 * @param steps - Array of pathway steps with dG0, optional nH and z
 * @param pH    - Solution pH
 * @param ionicStrength - Ionic strength in M
 * @param temp  - Temperature in K
 * @returns Total transformed ΔG'° for the pathway (kJ/mol)
 *
 * @example
 * // Glycolysis: glucose → glucose-6-phosphate → fructose-6-phosphate → ...
 * const total = calcPathwayDeltaG([
 *   { dG0: -16.7, nH: 0, z: 0 },  // hexokinase
 *   { dG0: 1.7, nH: 0, z: 0 },    // phosphoglucose isomerase
 *   { dG0: -14.2, nH: 0, z: 0 },  // PFK
 * ], 7.0, 0.1, 298.15);
 */
export function calcPathwayDeltaG(steps: PathwayStep[], pH: number, ionicStrength: number, temp: number): number {
  if (steps.length === 0) {
    throw new Error("Pathway must have at least one step");
  }

  return steps.reduce((sum, step) => {
    const nH = step.nH ?? 0;
    const z = step.z ?? 0;
    return sum + calcTransformedGibbs(step.dG0, pH, ionicStrength, temp, nH, z);
  }, 0);
}

// ---------------------------------------------------------------------------
// 4. Equilibrium Constant
// ---------------------------------------------------------------------------

/**
 * Calculate the equilibrium constant K_eq from standard Gibbs energy.
 *
 * Uses: K_eq = exp(-ΔG° / RT)
 *
 * @param dG0 - Standard Gibbs energy change (kJ/mol)
 * @param temp - Temperature in K
 * @returns Equilibrium constant (dimensionless)
 *
 * @example
 * // ATP hydrolysis: ΔG° = -30.5 kJ/mol
 * calcKeq(-30.5, 298.15)  // ≈ 2.2 × 10^5
 *
 * @scientific_provenance
 * Standard thermodynamic relation: ΔG° = -RT·ln(K_eq)
 */
export function calcKeq(dG0: number, temp: number): number {
  if (temp <= 0) throw new Error("Temperature must be positive (K)");
  return Math.exp(-dG0 / (R * temp));
}

// ---------------------------------------------------------------------------
// 5. Actual ΔG from Concentrations
// ---------------------------------------------------------------------------

/**
 * Calculate the actual Gibbs energy change (ΔG) for a reaction under
 * non-standard metabolite concentrations.
 *
 * Uses: ΔG = ΔG° + RT · ln(Q)
 *
 * where Q = Π[products]^ν / Π[reactants]^ν
 *
 * The concentrations map uses metabolite names as keys with their
 * concentrations in M (mol/L). Each entry represents one unit of
 * stoichiometry (for reactions like 2A → B, pass A twice).
 *
 * @param dG0 - Standard Gibbs energy change (kJ/mol)
 * @param temp - Temperature in K
 * @param concentrations - Map of metabolite names to concentrations (M)
 *   Keys prefixed with 'product_' are products; 'reactant_' are reactants.
 *   Alternatively, pass a Q value directly via the reaction quotient override.
 * @returns Actual ΔG in kJ/mol
 *
 * @example
 * // ATP hydrolysis in a cell:
 * // [ATP] = 10 mM, [ADP] = 1 mM, [Pi] = 5 mM
 * calcDeltaG(-30.5, 298.15, {
 *   product_ADP: 1e-3,
 *   product_Pi: 5e-3,
 *   reactant_ATP: 10e-3,
 * })
 * // Q = (1e-3 × 5e-3) / 10e-3 = 5e-4
 * // ΔG = -30.5 + 0.008314 × 298.15 × ln(5e-4) ≈ -49.4 kJ/mol
 */
export function calcDeltaG(dG0: number, temp: number, concentrations: Record<string, number>): number {
  if (temp <= 0) throw new Error("Temperature must be positive (K)");

  const keys = Object.keys(concentrations);
  if (keys.length === 0) {
    // No concentrations provided — return standard ΔG°
    return dG0;
  }

  // Separate products and reactants by key prefix convention
  const products: number[] = [];
  const reactants: number[] = [];

  for (const key of keys) {
    const conc = concentrations[key];
    if (conc < 0) throw new Error(`Concentration for "${key}" must be non-negative`);

    if (key.startsWith("product_")) {
      products.push(conc);
    } else if (key.startsWith("reactant_")) {
      reactants.push(conc);
    } else {
      // If no prefix, treat as reactant by default
      reactants.push(conc);
    }
  }

  if (reactants.length === 0) {
    throw new Error("At least one reactant concentration is required");
  }

  // Calculate reaction quotient Q
  const productProd = products.length > 0 ? products.reduce((a, b) => a * b, 1) : 1; // If no products specified, Q = 1/reactants
  const reactantProd = reactants.reduce((a, b) => a * b, 1);

  if (reactantProd === 0) {
    return -Infinity; // Infinite driving force toward products
  }
  if (productProd === 0 && products.length > 0) {
    return Infinity; // Infinite driving force toward reactants
  }

  const Q = productProd / reactantProd;
  const dG = dG0 + R * temp * Math.log(Q);

  return dG;
}

/**
 * Convenience overload: calculate ΔG directly from a reaction quotient Q.
 *
 * @param dG0 - Standard Gibbs energy change (kJ/mol)
 * @param temp - Temperature in K
 * @param Q - Reaction quotient (product concentrations / reactant concentrations)
 * @returns Actual ΔG in kJ/mol
 */
export function calcDeltaGFromQ(dG0: number, temp: number, Q: number): number {
  if (temp <= 0) throw new Error("Temperature must be positive (K)");
  if (Q < 0) throw new Error("Reaction quotient Q must be non-negative");
  if (Q === 0) return Infinity;
  return dG0 + R * temp * Math.log(Q);
}

// ---------------------------------------------------------------------------
// 6. eQuilibrator API Integration
// ---------------------------------------------------------------------------

/** eQuilibrator API base URL */
const EQUILIBRATOR_API_BASE = "https://equilibrator.weizmann.ac.il/api/v2";

/** Timeout for eQuilibrator API calls (ms) */
const EQUILIBRATOR_TIMEOUT = 8000;

/**
 * Result from eQuilibrator API lookup.
 */
export interface EquilibratorCompoundResult {
  /** Standard transformed Gibbs energy of formation (kJ/mol at pH 7, I=0.25 M, 25 °C) */
  dGf0: number;
  /** Compound name as returned by eQuilibrator */
  name: string;
  /** KEGG compound ID if available */
  keggId?: string;
  /** Source identifier */
  source: "equilibrator";
}

/**
 * Fetch the standard transformed Gibbs energy of formation (ΔG'°f) for a
 * compound from the eQuilibrator API.
 *
 * Uses the eQuilibrator 3 web API (Beber et al. 2022, Nucleic Acids Research).
 * The API returns formation energies at pH 7, I=0.25 M, 25 °C by default.
 *
 * @param compoundName - Common name, KEGG ID (e.g., "C00002"), or InChI string
 * @returns Formation energy result, or null if not found / on error
 *
 * @example
 * const result = await fetchEquilibratorDeltaG('glucose');
 * if (result) console.log(result.dGf0); // kJ/mol
 *
 * @scientific_provenance
 * eQuilibrator 3 (Beber et al. 2022) Nucleic Acids Research 50(D1):D663-D669
 */
export async function fetchEquilibratorDeltaG(compoundName: string): Promise<EquilibratorCompoundResult | null> {
  if (!compoundName || compoundName.trim().length === 0) return null;

  const query = compoundName.trim();

  try {
    // Step 1: Search for the compound to get its identifiers
    const searchUrl = `${EQUILIBRATOR_API_BASE}/search?query=${encodeURIComponent(query)}`;
    const searchResponse = await fetch(searchUrl, {
      signal: AbortSignal.timeout(EQUILIBRATOR_TIMEOUT),
      headers: { Accept: "application/json" },
    });

    if (!searchResponse.ok) return null;

    const searchData = await searchResponse.json();

    // Extract the first compound match
    // eQuilibrator search returns an array of { name, model_ids, ... }
    const compounds: unknown[] = Array.isArray(searchData)
      ? searchData
      : (searchData?.compounds ?? searchData?.results ?? []);

    if (compounds.length === 0) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstHit = compounds[0] as any;
    const compoundId: string | undefined = firstHit?.model_ids?.[0] ?? firstHit?.id ?? firstHit?.kegg_id;

    if (!compoundId) return null;

    // Step 2: Fetch formation energy for the compound
    // Try the compound endpoint with the KEGG ID
    const compoundUrl = `${EQUILIBRATOR_API_BASE}/compound?ids=${encodeURIComponent(compoundId)}`;
    const compoundResponse = await fetch(compoundUrl, {
      signal: AbortSignal.timeout(EQUILIBRATOR_TIMEOUT),
      headers: { Accept: "application/json" },
    });

    if (!compoundResponse.ok) return null;

    const compoundData = await compoundResponse.json();

    // Parse the response — eQuilibrator returns formation energies in kJ/mol
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = Array.isArray(compoundData) ? compoundData[0] : compoundData;

    if (!entry) return null;

    // The formation energy field varies by API version
    const dGf0: number | undefined = entry.dgf0 ?? entry.dG_f ?? entry.formation_energy ?? entry.dg0_prime;

    if (dGf0 === undefined || dGf0 === null || !Number.isFinite(dGf0)) return null;

    return {
      dGf0,
      name: entry.name ?? query,
      keggId: compoundId.startsWith("C") ? compoundId : undefined,
      source: "equilibrator",
    };
  } catch {
    // Network error, timeout, parse error — all return null gracefully
    return null;
  }
}

// ---------------------------------------------------------------------------
// 7. Confidence Scoring & Fallback Logic
// ---------------------------------------------------------------------------

/**
 * Confidence levels for group contribution estimates.
 */
export type ConfidenceLevel = "high" | "medium" | "low" | "none";

/**
 * Result with confidence metadata.
 */
export interface ThermoEstimate {
  /** Estimated ΔG°f (kJ/mol) */
  dGf0: number;
  /** Confidence in the estimate */
  confidence: ConfidenceLevel;
  /** Number of functional groups identified */
  groupsFound: number;
  /** Source of the estimate */
  source: "group_contribution" | "equilibrator";
  /** eQuilibrator result if fetched */
  equilibratorResult?: EquilibratorCompoundResult;
}

/**
 * Convert a GroupContributionResult (from the graph-based SMILES parser)
 * to a ThermoEstimate (the thermoEngine's public interface).
 *
 * This adapter bridges the proper graph-based group contribution method
 * in utils/groupContribution.ts with the thermoEngine's confidence-based
 * estimation API.
 *
 * @param result - Result from estimateFormationEnergy()
 * @returns ThermoEstimate with confidence level mapped from numeric to categorical
 */
export function adaptGroupContributionResult(result: GroupContributionResult): ThermoEstimate {
  let confidence: ConfidenceLevel;
  if (result.confidence === 0) confidence = "none";
  else if (result.confidence <= 0.3) confidence = "low";
  else if (result.confidence <= 0.7) confidence = "medium";
  else confidence = "high";

  const groupsFound = result.matchedGroups.reduce((sum, g) => sum + g.count, 0);

  return {
    dGf0: result.deltaGf,
    confidence,
    groupsFound,
    source: "group_contribution",
  };
}

/**
 * Threshold below which we consider the local estimate to have low confidence
 * and should try the eQuilibrator API as a fallback.
 */
const LOW_CONFIDENCE_GROUPS = 2;

/**
 * Estimate formation energy with eQuilibrator fallback.
 *
 * Strategy:
 *   1. Try local group contribution from SMILES
 *   2. If confidence is low or none, try eQuilibrator API by compound name
 *   3. Prefer eQuilibrator result when local confidence is low
 *   4. If both fail, return the local estimate with its confidence level
 *
 * @param smiles - SMILES string for local estimation
 * @param compoundName - Compound name for eQuilibrator lookup (optional)
 * @param forceApiLookup - Skip local estimation and go straight to API
 * @returns Formation energy estimate with confidence metadata
 */
export async function estimateFormationEnergyWithFallback(
  smiles: string,
  compoundName?: string,
  forceApiLookup: boolean = false,
): Promise<ThermoEstimate> {
  // If forced to use API, skip local estimation
  if (forceApiLookup && compoundName) {
    const apiResult = await fetchEquilibratorDeltaG(compoundName);
    if (apiResult) {
      return {
        dGf0: apiResult.dGf0,
        confidence: "high",
        groupsFound: 0,
        source: "equilibrator",
        equilibratorResult: apiResult,
      };
    }
    // API failed — fall through to local estimation
  }

  // Step 1: Local group contribution (using graph-based SMILES parser)
  const localEstimate = adaptGroupContributionResult(estimateFormationEnergy(smiles));

  // If confidence is high/medium, return local result
  if (localEstimate.confidence === "high" || localEstimate.confidence === "medium") {
    return localEstimate;
  }

  // Step 2: Low/no confidence — try eQuilibrator API
  if (compoundName) {
    const apiResult = await fetchEquilibratorDeltaG(compoundName);
    if (apiResult) {
      return {
        dGf0: apiResult.dGf0,
        confidence: "high",
        groupsFound: localEstimate.groupsFound,
        source: "equilibrator",
        equilibratorResult: apiResult,
      };
    }
  }

  // Step 3: Both failed or no compound name — return local estimate
  return localEstimate;
}

/**
 * Synchronous fallback: estimate formation energy using only local data.
 * Use when eQuilibrator API is unavailable or in non-async contexts.
 *
 * @param smiles - SMILES string
 * @param referenceDGf0 - Known reference ΔG°f to use if local confidence is low
 * @returns Formation energy estimate
 */
export function estimateFormationEnergyLocal(smiles: string, referenceDGf0?: number): ThermoEstimate {
  const local = adaptGroupContributionResult(estimateFormationEnergy(smiles));

  if ((local.confidence === "none" || local.confidence === "low") && referenceDGf0 !== undefined) {
    return {
      dGf0: referenceDGf0,
      confidence: "medium",
      groupsFound: local.groupsFound,
      source: "equilibrator", // treating reference as authoritative
    };
  }

  return local;
}
