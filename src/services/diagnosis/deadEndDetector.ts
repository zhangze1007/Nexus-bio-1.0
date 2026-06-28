/**
 * Dead-End Metabolite Detector for FBA Diagnosis.
 *
 * A dead-end metabolite is one that can only be produced OR consumed (not both)
 * within the network. Dead-ends make the model infeasible when they are required
 * intermediates — mass balance cannot be satisfied because flux must be zero
 * through all reactions touching the dead-end.
 *
 * This detector builds a bipartite incidence map of metabolite-to-reaction
 * participation, then classifies each metabolite by whether it appears on the
 * reactant (left/substrate) side, the product (right) side, or both.
 *
 * @scientific_provenance
 *   ALGORITHM: Dead-end metabolite detection via stoichiometric incidence analysis
 *   REFERENCE: Thiele, I. & Palsson, B.O. (2010) Nature Protocols 5(1):9-13
 *              "A protocol for generating a high-quality genome-scale metabolic reconstruction"
 *   KNOWN_LIMITATIONS:
 *     - Treats all non-zero stoichiometric entries equally; does not distinguish
 *       between exchange, transport, and internal reactions.
 *     - Does not account for reaction reversibility (lb < 0) when determining
 *       whether a reaction can supply a metabolite in the needed direction.
 *     - Exchange reactions can supply or consume external metabolites and may
 *       mask true dead-ends if included in the analysis.
 */

export interface DeadEnd {
  metabolite: string;
  producingReactions: string[];
  consumingReactions: string[];
  issue: "no_producer" | "no_consumer" | "both";
}

/**
 * Detect dead-end metabolites in a set of reactions.
 *
 * A metabolite is classified as a dead-end if:
 * - "no_producer": it appears only as a product (positive stoichiometry) — no
 *   reaction can produce it from substrates.
 * - "no_consumer": it appears only as a reactant (negative stoichiometry) — no
 *   reaction can consume it.
 * - "both": an edge case where the metabolite appears in stoichiometry but has
 *   no clear directionality (e.g., all coefficients are zero — degenerate).
 *
 * @param reactions - Array of reactions with id and stoichiometry
 *                   (negative coefficients = reactant/consumed, positive = product/produced)
 * @returns Array of DeadEnd objects, one per dead-end metabolite
 */
export function detectDeadEnds(reactions: Array<{ id: string; stoichiometry: Record<string, number> }>): DeadEnd[] {
  // Build metabolite → { producers, consumers } map
  const metaboliteMap = new Map<string, { producingReactions: Set<string>; consumingReactions: Set<string> }>();

  for (const rxn of reactions) {
    for (const [metId, coef] of Object.entries(rxn.stoichiometry)) {
      if (!metaboliteMap.has(metId)) {
        metaboliteMap.set(metId, {
          producingReactions: new Set(),
          consumingReactions: new Set(),
        });
      }
      const entry = metaboliteMap.get(metId)!;
      // Positive coefficient = product side (produced by this reaction)
      // Negative coefficient = reactant side (consumed by this reaction)
      if (coef > 0) {
        entry.producingReactions.add(rxn.id);
      } else if (coef < 0) {
        entry.consumingReactions.add(rxn.id);
      }
      // coef === 0 is ignored (not actually participating)
    }
  }

  // Filter to dead-end metabolites only
  const deadEnds: DeadEnd[] = [];

  for (const [metId, entry] of metaboliteMap) {
    const hasProducer = entry.producingReactions.size > 0;
    const hasConsumer = entry.consumingReactions.size > 0;

    if (!hasProducer && !hasConsumer) {
      // Degenerate case: metabolite in stoichiometry but all zero coefficients
      // Should not happen with well-formed models, but handle defensively
      deadEnds.push({
        metabolite: metId,
        producingReactions: [],
        consumingReactions: [],
        issue: "both",
      });
    } else if (!hasProducer) {
      deadEnds.push({
        metabolite: metId,
        producingReactions: [],
        consumingReactions: Array.from(entry.consumingReactions),
        issue: "no_producer",
      });
    } else if (!hasConsumer) {
      deadEnds.push({
        metabolite: metId,
        producingReactions: Array.from(entry.producingReactions),
        consumingReactions: [],
        issue: "no_consumer",
      });
    }
  }

  return deadEnds.sort((a, b) => a.metabolite.localeCompare(b.metabolite));
}
