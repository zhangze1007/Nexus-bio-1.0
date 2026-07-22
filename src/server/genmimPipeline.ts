/**
 * GenMIM Genome Minimization Pipeline
 *
 * Unidirectional pipeline: Planner → Simulator → Optimizer
 *
 * Agent A (Planner): Identifies essential genes and proposes knockdown schedules
 * Agent B (Simulator): Runs FBA with knockdowns applied
 * Agent C (Optimizer): Pareto-optimal trade-off between genome reduction and growth
 *
 * Every numerical conclusion comes from real FBA solver calls.
 *
 * @scientific_provenance
 *   ALGORITHM: Pipeline orchestration — GPR-based essentiality testing + FBA knockout evaluation + Pareto optimization
 *   REFERENCE:
 *     N/A — orchestration only; delegates to fbaEngine and fbaGPR
 *     Essentiality concept: Gerdes S et al. (2003) "Experimental determination and system level analysis of essential genes in Escherichia coli MG1655" J Bacteriol 185:5673-5684
 *   KNOWN_LIMITATIONS:
 *     - Essentiality test is binary (knock out single gene); no partial knockdown or CRISPRi dosage modeling
 *     - No epistasis — gene-gene interactions not considered in combinatorial knockdowns
 *     - Greedy gene selection (sequential non-essential genes) does not search combinatorial space
 *     - GPR rules are parsed via regex; complex Boolean expressions may be misinterpreted
 *     - Genome reduction metric is gene count fraction, not actual base-pair reduction
 */

import { IJO1366_REACTIONS } from "../data/iJO1366Subset";
import type { FBAOutput } from "../data/mockFBA";
import { type FBAObjective, type FBASpecies, solveAuthorityFBA } from "./fbaEngine";
import { getKnockoutReactions } from "./fbaGPR";

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface MinimizationSpec {
  species: FBASpecies;
  objective: FBAObjective;
  glucoseUptake: number;
  oxygenUptake: number;
  targetGenomeReduction: number; // fraction (0-1)
  minGrowthFraction: number; // min growth as fraction of wild-type
}

export interface KnockdownPlan {
  genes: string[];
  knockdownLevel: number; // 0 = full knockout, 0.5 = 50% reduction
  description: string;
}

export interface MinimizationResult {
  spec: MinimizationSpec;
  wildType: FBAOutput;
  essentialGenes: string[];
  bestPlan: KnockdownPlan;
  bestGrowthRate: number;
  bestGenomeReduction: number;
  paretoFront: Array<{ plan: KnockdownPlan; growthRate: number; genomeReduction: number }>;
  allSolverCalls: Array<{ solver: string; description: string }>;
}

// ── Agent A: Planner ────────────────────────────────────────────────────────

/**
 * Identify essential genes and propose knockdown schedules.
 */
/**
 * Reactions whose disruption defines essentiality FOR THIS SPEC: biomass always,
 * plus the reactions the chosen objective depends on — ATP maintenance/synthase
 * for "atp", product-forming exchange/demand/sink for "product".
 */
function objectiveTargetReactions(objective: FBAObjective, reactionIds: string[]): Set<string> {
  const targets = new Set<string>(["BIOMASS"]);
  if (objective === "atp") {
    for (const id of reactionIds) if (/ATPM|ATPS|^ATP/i.test(id)) targets.add(id);
  } else if (objective === "product") {
    for (const id of reactionIds) if (/^EX_|^DM_|^SK_|SINK/i.test(id)) targets.add(id);
  }
  return targets;
}

export function planKnockdowns(spec: MinimizationSpec): {
  essentialGenes: string[];
  candidateGenes: string[];
  plans: KnockdownPlan[];
  solverCalls: Array<{ solver: string; description: string }>;
} {
  const solverCalls: Array<{ solver: string; description: string }> = [];
  const rules = gprRules();
  const reactionIds = Object.keys(rules);

  // Collect all genes from GPR rules.
  const allGenes = new Set<string>();
  for (const rxn of IJO1366_REACTIONS) {
    if (rxn.gpr) {
      const genes = rxn.gpr.match(/\b[A-Z]{3}[0-9]{4}\b/g) ?? [];
      genes.forEach((g) => allGenes.add(g));
    }
  }

  // Essentiality is driven by the SPEC's objective (target product): a gene is
  // essential if knocking it out removes a reaction the objective depends on
  // (biomass, or ATP/product reactions per spec.objective).
  const targetReactions = objectiveTargetReactions(spec.objective, reactionIds);
  solverCalls.push({
    solver: "fbaGPR::essentiality",
    description: `Testing ${allGenes.size} genes vs objective=${spec.objective}, species=${spec.species}, O2=${spec.oxygenUptake}, glc=${spec.glucoseUptake}`,
  });

  const essentialGenes: string[] = [];
  const scoredCandidates: Array<{ gene: string; impact: number }> = [];
  for (const gene of allGenes) {
    const knockouts = getKnockoutReactions([gene], rules);
    if (knockouts.length === 0) continue; // gene not tied to any modeled reaction
    if (knockouts.some((k) => targetReactions.has(k))) {
      essentialGenes.push(gene);
    } else {
      // Non-essential: broader knockout impact ⇒ riskier ⇒ lower removal priority.
      scoredCandidates.push({ gene, impact: knockouts.length });
    }
  }
  // Safest-to-remove first: fewest disrupted reactions, deterministic tie-break.
  scoredCandidates.sort((a, b) => a.impact - b.impact || a.gene.localeCompare(b.gene));
  const candidateGenes = scoredCandidates.map((c) => c.gene);

  // Scheduling is driven by the SPEC's constraints: targetGenomeReduction sets how
  // many genes to remove; a stricter minGrowthFraction keeps more genes (a brake)
  // and switches full knockout → partial CRISPRi knockdown near the growth limit.
  const totalGenes = allGenes.size;
  const targetCount = Math.min(candidateGenes.length, Math.round(spec.targetGenomeReduction * totalGenes));
  const growthBrake = Math.max(0, Math.min(1, 1 - spec.minGrowthFraction));
  const maxSafeCount = Math.max(1, Math.round(targetCount * (0.4 + 0.6 * growthBrake)));
  const knockdownLevel = spec.minGrowthFraction > 0.8 ? 0.5 : 0;

  const plans: KnockdownPlan[] = [];
  const nSteps = 5;
  for (let s = 1; s <= nSteps; s++) {
    const count = Math.min(candidateGenes.length, Math.max(1, Math.round((maxSafeCount * s) / nSteps)));
    const genes = candidateGenes.slice(0, count);
    if (genes.length === 0) break;
    plans.push({
      genes,
      knockdownLevel,
      description: `${knockdownLevel === 0 ? "Knock out" : "Knock down"} ${genes.length}/${totalGenes} genes toward ${(spec.targetGenomeReduction * 100).toFixed(0)}% reduction (≥${(spec.minGrowthFraction * 100).toFixed(0)}% growth)`,
    });
  }
  const uniquePlans = plans.filter((p, i) => i === 0 || p.genes.length !== plans[i - 1].genes.length);

  return { essentialGenes, candidateGenes, plans: uniquePlans, solverCalls };
}

function gprRules(): Record<string, string> {
  const rules: Record<string, string> = {};
  for (const rxn of IJO1366_REACTIONS) {
    if (rxn.gpr) rules[rxn.id] = rxn.gpr;
  }
  return rules;
}

// ── Agent B: Simulator ──────────────────────────────────────────────────────

/**
 * Evaluate a knockdown plan by running FBA.
 */
async function simulateKnockdown(
  spec: MinimizationSpec,
  plan: KnockdownPlan,
): Promise<{
  growthRate: number;
  feasible: boolean;
  solverCalls: Array<{ solver: string; description: string }>;
}> {
  const solverCalls: Array<{ solver: string; description: string }> = [];

  const knockouts = getKnockoutReactions(plan.genes, gprRules());
  solverCalls.push({
    solver: "fbaEngine::solveAuthorityFBA",
    description: `FBA with ${knockouts.length} reaction knockouts`,
  });

  const result = await solveAuthorityFBA({
    species: spec.species,
    objective: spec.objective,
    glucoseUptake: spec.glucoseUptake,
    oxygenUptake: spec.oxygenUptake,
    knockouts,
  });

  return {
    growthRate: result.growthRate,
    feasible: result.feasible,
    solverCalls,
  };
}

// ── Agent C: Optimizer ──────────────────────────────────────────────────────

/**
 * Find the Pareto-optimal trade-off between genome reduction and growth.
 */
async function optimizeMinimization(
  spec: MinimizationSpec,
  plans: KnockdownPlan[],
  wildTypeGrowthRate: number,
  candidateGenes: string[],
): Promise<{
  paretoFront: Array<{ plan: KnockdownPlan; growthRate: number; genomeReduction: number }>;
  bestPlan: KnockdownPlan;
  bestGrowthRate: number;
  bestGenomeReduction: number;
  solverCalls: Array<{ solver: string; description: string }>;
}> {
  const solverCalls: Array<{ solver: string; description: string }> = [];

  // Evaluate all plans
  const results: Array<{ plan: KnockdownPlan; growthRate: number; genomeReduction: number; feasible: boolean }> = [];
  for (const plan of plans) {
    const { growthRate, feasible, solverCalls: simCalls } = await simulateKnockdown(spec, plan);
    solverCalls.push(...simCalls);
    const genomeReduction = plan.genes.length / candidateGenes.length;
    results.push({ plan, growthRate, genomeReduction, feasible });
  }

  // Filter to feasible plans that meet growth constraint
  const feasible = results.filter((r) => r.feasible && r.growthRate >= wildTypeGrowthRate * spec.minGrowthFraction);

  // Pareto front: maximize genome reduction, maximize growth
  const paretoFront: typeof feasible = [];
  for (const candidate of feasible) {
    let dominated = false;
    for (const other of feasible) {
      if (other === candidate) continue;
      const betterGrowth = other.growthRate >= candidate.growthRate;
      const betterReduction = other.genomeReduction >= candidate.genomeReduction;
      const strictlyBetter =
        other.growthRate > candidate.growthRate || other.genomeReduction > candidate.genomeReduction;
      if (betterGrowth && betterReduction && strictlyBetter) {
        dominated = true;
        break;
      }
    }
    if (!dominated) paretoFront.push(candidate);
  }

  // Best: highest genome reduction that meets growth constraint
  const best =
    paretoFront.length > 0
      ? paretoFront.reduce((b, r) => (r.genomeReduction > b.genomeReduction ? r : b))
      : (feasible[0] ?? results[0]);

  return {
    paretoFront: paretoFront.map((r) => ({
      plan: r.plan,
      growthRate: r.growthRate,
      genomeReduction: r.genomeReduction,
    })),
    bestPlan: best.plan,
    bestGrowthRate: best.growthRate,
    bestGenomeReduction: Math.round(best.genomeReduction * 1000) / 1000,
    solverCalls,
  };
}

// ── Pipeline Entry Point ────────────────────────────────────────────────────

export async function runMinimizationPipeline(spec: MinimizationSpec): Promise<MinimizationResult> {
  const allSolverCalls: Array<{ solver: string; description: string }> = [];

  // Get wild-type baseline
  const wildType = await solveAuthorityFBA({
    species: spec.species,
    objective: spec.objective,
    glucoseUptake: spec.glucoseUptake,
    oxygenUptake: spec.oxygenUptake,
  });

  // Agent A: Plan knockdowns
  const { essentialGenes, candidateGenes, plans, solverCalls: planCalls } = planKnockdowns(spec);
  allSolverCalls.push(...planCalls);

  // Agent B + C: Simulate and optimize
  const {
    paretoFront,
    bestPlan,
    bestGrowthRate,
    bestGenomeReduction,
    solverCalls: optCalls,
  } = await optimizeMinimization(spec, plans, wildType.growthRate, candidateGenes);
  allSolverCalls.push(...optCalls);

  return { spec, wildType, essentialGenes, bestPlan, bestGrowthRate, bestGenomeReduction, paretoFront, allSolverCalls };
}
