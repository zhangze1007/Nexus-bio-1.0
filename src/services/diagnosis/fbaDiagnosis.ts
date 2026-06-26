/**
 * FBA Diagnosis Orchestrator.
 *
 * When an FBA simulation returns "infeasible" or produces suspicious results,
 * this module runs a comprehensive diagnosis pipeline to identify the root cause
 * and suggest fixes. It integrates three sub-diagnosers:
 *
 *   1. Dead-End Detector — finds metabolites with no producer or no consumer
 *   2. Conflict Detector — finds reactions with contradictory flux bounds
 *   3. Cofactor Checker — finds imbalanced cofactor pools
 *
 * The orchestrator runs all three in parallel, merges results, and produces
 * a structured DiagnosisResult that can be consumed by the Copilot (Task 26)
 * to present natural-language explanations to the user.
 *
 * @scientific_provenance
 *   ALGORITHM: Multi-signal FBA infeasibility diagnosis
 *   REFERENCE: Thiele, I. & Palsson, B.O. (2010) Nature Protocols 5(1):9-13
 *              "A protocol for generating a high-quality genome-scale metabolic reconstruction"
 *   KNOWN_LIMITATIONS:
 *     - Diagnosis is heuristic; some infeasibilities require LP infeasibility
 *       proof (IIS — Irreducible Infeasible Subsystem) which is not implemented
 *     - Cofactor balance requires a feasible flux solution; if FBA is infeasible,
 *       the fluxes passed may be zero or from a partial solve
 *     - Does not integrate thermodynamic feasibility (TFA) analysis
 */

import { detectDeadEnds, type DeadEnd } from "./deadEndDetector";
import { detectConflicts, type Conflict } from "./conflictDetector";
import { checkCofactorBalance, type CofactorImbalance } from "./cofactorChecker";

export interface DiagnosisResult {
  status: "diagnosed" | "undetermined";
  issues: DiagnosisIssue[];
  suggestions: DiagnosisSuggestion[];
  summary: string;
}

export interface DiagnosisIssue {
  type:
    | "dead_end"
    | "conflicting_bounds"
    | "missing_cofactor"
    | "blocked_reaction"
    | "thermodynamic_infeasible";
  severity: "critical" | "warning" | "info";
  description: string;
  affectedReactions: string[];
  affectedMetabolites: string[];
}

export interface DiagnosisSuggestion {
  action: "add_reaction" | "relax_bounds" | "add_exchange" | "remove_constraint";
  description: string;
  details: Record<string, unknown>;
  expectedImpact: string;
}

/**
 * Run a comprehensive FBA diagnosis.
 *
 * @param model - The metabolic model with reactions (including stoichiometry and bounds)
 *                and a list of all metabolite IDs
 * @param fluxes - The flux distribution from FBA (may be all zeros if infeasible)
 * @param status - The FBA solver status string ("optimal", "infeasible", etc.)
 * @returns A structured diagnosis with issues, suggestions, and a human-readable summary
 */
export async function diagnoseFBA(
  model: {
    reactions: Array<{
      id: string;
      stoichiometry: Record<string, number>;
      lowerBound: number;
      upperBound: number;
    }>;
    metabolites: string[];
  },
  fluxes: Record<string, number>,
  status: string,
): Promise<DiagnosisResult> {
  const issues: DiagnosisIssue[] = [];
  const suggestions: DiagnosisSuggestion[] = [];

  // Run all three detectors
  const deadEnds = detectDeadEnds(model.reactions);
  const conflicts = detectConflicts(model.reactions);
  const cofactorImbalances = checkCofactorBalance(model.reactions, fluxes);

  // ── Process dead-end metabolites ──

  for (const de of deadEnds) {
    const isReversible = de.consumingReactions.some((rxnId) => {
      const rxn = model.reactions.find((r) => r.id === rxnId);
      return rxn && rxn.lowerBound < 0;
    });

    let description: string;
    if (de.issue === "no_producer") {
      description = `Metabolite "${de.metabolite}" has no producing reaction — it can only be consumed. This creates a mass balance violation if the metabolite is required.`;
    } else if (de.issue === "no_consumer") {
      description = `Metabolite "${de.metabolite}" has no consuming reaction — it can only be produced. This creates a sink problem: accumulation without consumption.`;
    } else {
      description = `Metabolite "${de.metabolite}" has no producing or consuming reactions (degenerate stoichiometry).`;
    }

    issues.push({
      type: "dead_end",
      severity: "critical",
      description,
      affectedReactions: [...de.producingReactions, ...de.consumingReactions],
      affectedMetabolites: [de.metabolite],
    });

    // Suggest adding exchange reaction for dead-end metabolites
    const isExternal = de.metabolite.endsWith("_e") || de.metabolite.endsWith("_ext");
    if (de.issue === "no_producer") {
      suggestions.push({
        action: isExternal ? "add_exchange" : "add_reaction",
        description: isExternal
          ? `Add an exchange reaction (EX_${de.metabolite}) to allow import of "${de.metabolite}".`
          : `Add a reaction that produces "${de.metabolite}" to close the mass balance gap.`,
        details: { metabolite: de.metabolite, issue: de.issue },
        expectedImpact: `Resolving the dead-end for "${de.metabolite}" may restore model feasibility.`,
      });
    } else if (de.issue === "no_consumer") {
      suggestions.push({
        action: isExternal ? "add_exchange" : "add_reaction",
        description: isExternal
          ? `Add an exchange reaction (EX_${de.metabolite}) to allow export of "${de.metabolite}".`
          : `Add a reaction that consumes "${de.metabolite}" to prevent accumulation.`,
        details: { metabolite: de.metabolite, issue: de.issue },
        expectedImpact: `Adding a sink for "${de.metabolite}" may restore mass balance.`,
      });
    }
  }

  // ── Process bound conflicts ──

  for (const conflict of conflicts) {
    if (conflict.issue === "bounds_crossed") {
      issues.push({
        type: "conflicting_bounds",
        severity: "critical",
        description: `Reaction "${conflict.reaction}" has lowerBound (${conflict.lowerBound}) > upperBound (${conflict.upperBound}). This is mathematically infeasible — no flux value can satisfy both bounds.`,
        affectedReactions: [conflict.reaction],
        affectedMetabolites: [],
      });

      suggestions.push({
        action: "relax_bounds",
        description: `Fix bounds on reaction "${conflict.reaction}": set lowerBound <= upperBound. Current: [${conflict.lowerBound}, ${conflict.upperBound}].`,
        details: {
          reaction: conflict.reaction,
          currentLower: conflict.lowerBound,
          currentUpper: conflict.upperBound,
          suggestedLower: Math.min(conflict.lowerBound, conflict.upperBound),
          suggestedUpper: Math.max(conflict.lowerBound, conflict.upperBound),
        },
        expectedImpact: `Relaxing bounds on "${conflict.reaction}" will directly resolve this infeasibility constraint.`,
      });
    } else if (conflict.issue === "fixed_to_zero") {
      issues.push({
        type: "blocked_reaction",
        severity: "warning",
        description: `Reaction "${conflict.reaction}" is fixed to zero flux (both bounds = 0). This may be intentional (gene knockout) or accidental.`,
        affectedReactions: [conflict.reaction],
        affectedMetabolites: [],
      });

      // Only suggest relaxing if it's not a typical knockout target
      if (!conflict.reaction.startsWith("EX_")) {
        suggestions.push({
          action: "relax_bounds",
          description: `If "${conflict.reaction}" should be active, restore its flux bounds to their default values.`,
          details: {
            reaction: conflict.reaction,
            currentBounds: [0, 0],
          },
          expectedImpact: `Activating "${conflict.reaction}" may open an additional metabolic pathway.`,
        });
      }
    }
  }

  // ── Process cofactor imbalances ──

  // Only report cofactor issues if we have a feasible-ish flux distribution
  // (non-trivial flux values present)
  const hasNonTrivialFlux = Object.values(fluxes).some((f) => Math.abs(f) > 1e-6);

  if (hasNonTrivialFlux && cofactorImbalances.length > 0) {
    for (const imb of cofactorImbalances) {
      issues.push({
        type: "missing_cofactor",
        severity: Math.abs(imb.imbalance) > 1.0 ? "critical" : "warning",
        description: `Cofactor "${imb.cofactor}" is ${imb.issue}: net production = ${imb.netProduction}, net consumption = ${imb.netConsumption}, imbalance = ${imb.imbalance} mmol/gDW/h.`,
        affectedReactions: [],
        affectedMetabolites: [imb.cofactor],
      });

      if (imb.issue === "overproduced") {
        suggestions.push({
          action: "add_reaction",
          description: `Add a sink reaction for "${imb.cofactor}" to consume excess production, or add an exchange reaction to export it.`,
          details: { cofactor: imb.cofactor, excess: imb.imbalance },
          expectedImpact: `Adding a sink for "${imb.cofactor}" would balance the ${imb.imbalance} mmol/gDW/h excess.`,
        });
      } else {
        suggestions.push({
          action: "add_reaction",
          description: `Add a regeneration reaction for "${imb.cofactor}" to supply the ${Math.abs(imb.imbalance)} mmol/gDW/h deficit.`,
          details: { cofactor: imb.cofactor, deficit: Math.abs(imb.imbalance) },
          expectedImpact: `Adding a source for "${imb.cofactor}" would balance the deficit and may restore feasibility.`,
        });
      }
    }
  }

  // ── Build summary ──

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  let summary: string;
  if (issues.length === 0) {
    summary = "No issues detected. The model appears structurally sound. If FBA is infeasible, the cause may be in implicit constraint interactions (requires IIS analysis).";
  } else if (status === "infeasible" || status === "infeasible_or_unbounded") {
    summary = `FBA infeasibility diagnosis found ${criticalCount} critical and ${warningCount} warning issues. `;
    if (deadEnds.length > 0) {
      summary += `${deadEnds.length} dead-end metabolite(s) detected — these commonly cause infeasibility by violating mass balance. `;
    }
    if (conflicts.filter((c) => c.issue === "bounds_crossed").length > 0) {
      summary += `${conflicts.filter((c) => c.issue === "bounds_crossed").length} bound conflict(s) detected — these are direct mathematical infeasibilities. `;
    }
    if (cofactorImbalances.length > 0) {
      summary += `${cofactorImbalances.length} cofactor imbalance(s) detected — missing regeneration reactions are a common root cause. `;
    }
  } else {
    summary = `Diagnosis found ${criticalCount} critical and ${warningCount} warning issues. `;
    if (deadEnds.length > 0) {
      summary += `${deadEnds.length} dead-end metabolite(s). `;
    }
    if (cofactorImbalances.length > 0) {
      summary += `${cofactorImbalances.length} cofactor imbalance(s). `;
    }
    summary += "These issues may not prevent FBA from solving but indicate structural model problems.";
  }

  return {
    status: issues.length > 0 ? "diagnosed" : "undetermined",
    issues,
    suggestions,
    summary,
  };
}
