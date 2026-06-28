/**
 * Cofactor Balance Checker for FBA Diagnosis.
 *
 * Checks whether key cofactors (ATP, NADH, NADPH, CoA, etc.) are balanced
 * across the flux distribution. Cofactor imbalances indicate missing or
 * incorrect reactions that regenerate cofactors, which is a common cause
 * of FBA infeasibility.
 *
 * In a valid steady-state flux distribution, the net production of every
 * metabolite (including cofactors) must be zero: what is produced must be
 * consumed. For cofactors specifically, the cell needs a balanced supply
 * and demand — overproduction without a sink, or overconsumption without
 * a source, indicates a missing reaction.
 *
 * @scientific_provenance
 *   ALGORITHM: Cofactor balance analysis via stoichiometric flux multiplication
 *   REFERENCE: Varma, A. & Palsson, B.O. (1994) Bio/Technology 12:994-998
 *              "Stoichiometric flux balance models quantitatively predict growth
 *              and metabolic by-product secretion in wild-type Escherichia coli"
 *   KNOWN_LIMITATIONS:
 *     - Does not distinguish between free and protein-bound cofactor pools
 *     - Treats all cofactor metabolites as universally exchangeable; in reality,
 *       compartmentalization (cytosol vs mitochondria) affects cofactor availability
 *     - Threshold for "significant" imbalance is heuristic (0.01 mmol/gDW/h)
 *     - Does not account for cofactor regeneration pathways that may be present
 *       but inactive due to other constraints
 */

/** Standard set of cofactors to check in metabolic models. */
export const COFACTORS = ["atp", "adp", "amp", "nad", "nadh", "nadp", "nadph", "coa", "accoa", "pi", "ppi", "h2o", "h"];

export interface CofactorImbalance {
  cofactor: string;
  netProduction: number;
  netConsumption: number;
  imbalance: number;
  issue: "overproduced" | "underproduced";
}

/**
 * Check cofactor balance across a flux distribution.
 *
 * For each cofactor, computes:
 *   netProduction = sum of (flux * positive_stoich_coeff) across all reactions
 *   netConsumption = sum of (flux * |negative_stoich_coeff|) across all reactions
 *   imbalance = netProduction - netConsumption
 *
 * An imbalance != 0 means the cofactor is not balanced at steady state, indicating
 * missing sink or source reactions.
 *
 * @param reactions - Array of reactions with id and stoichiometry
 * @param fluxes - Map of reaction ID to flux value (from FBA solution)
 * @param tolerance - Minimum absolute imbalance to report (default 0.01)
 * @returns Array of CofactorImbalance objects for unbalanced cofactors
 */
export function checkCofactorBalance(
  reactions: Array<{ id: string; stoichiometry: Record<string, number> }>,
  fluxes: Record<string, number>,
  tolerance = 0.01,
): CofactorImbalance[] {
  const cofactorSet = new Set(COFACTORS.map((c) => c.toLowerCase()));
  const imbalances: CofactorImbalance[] = [];

  // Compute net production/consumption for each cofactor
  const cofactorProduction = new Map<string, number>();
  const cofactorConsumption = new Map<string, number>();

  for (const rxn of reactions) {
    const flux = fluxes[rxn.id] ?? 0;
    if (Math.abs(flux) < 1e-12) continue; // Skip zero-flux reactions

    for (const [metId, coef] of Object.entries(rxn.stoichiometry)) {
      const metLower = metId.toLowerCase();
      // Match cofactor by checking if the metabolite ID contains the cofactor name
      // This handles variants like "atp_c", "nadph_m", etc. (compartment-suffixed IDs)
      const matchedCofactor = Array.from(cofactorSet).find(
        (cf) => metLower === cf || metLower.startsWith(`${cf}_`) || metLower.endsWith(`_${cf}`),
      );
      if (!matchedCofactor) continue;

      const effectiveRate = flux * coef; // positive = net production, negative = net consumption

      if (effectiveRate > 0) {
        cofactorProduction.set(matchedCofactor, (cofactorProduction.get(matchedCofactor) ?? 0) + effectiveRate);
      } else {
        cofactorConsumption.set(
          matchedCofactor,
          (cofactorConsumption.get(matchedCofactor) ?? 0) + Math.abs(effectiveRate),
        );
      }
    }
  }

  // Identify imbalances
  const allCofactors = new Set([...cofactorProduction.keys(), ...cofactorConsumption.keys()]);

  for (const cofactor of allCofactors) {
    const prod = cofactorProduction.get(cofactor) ?? 0;
    const cons = cofactorConsumption.get(cofactor) ?? 0;
    const imbalance = prod - cons;

    if (Math.abs(imbalance) > tolerance) {
      imbalances.push({
        cofactor,
        netProduction: Math.round(prod * 10000) / 10000,
        netConsumption: Math.round(cons * 10000) / 10000,
        imbalance: Math.round(imbalance * 10000) / 10000,
        issue: imbalance > 0 ? "overproduced" : "underproduced",
      });
    }
  }

  return imbalances.sort((a, b) => Math.abs(b.imbalance) - Math.abs(a.imbalance));
}
