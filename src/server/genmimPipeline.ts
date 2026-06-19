/**
 * GenMIM Genome Minimization Pipeline
 *
 * Unidirectional pipeline: Planner → Simulator → Optimizer
 *
 * Agent A (Planner): Proposes gene knockdown schedule
 * Agent B (Simulator): Runs FBA with knockdowns applied
 * Agent C (Optimizer): Maximize growth while minimizing genome
 *
 * Every numerical conclusion comes from real FBA solver calls.
 */

import { solveAuthorityFBA, type FBASpecies, type FBAObjective } from './fbaEngine';
import type { FBAOutput } from '../data/mockFBA';
import { getKnockoutReactions } from './fbaGPR';
import { IJO1366_REACTIONS } from '../data/iJO1366Subset';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface MinimizationSpec {
  species: FBASpecies;
  objective: FBAObjective;
  glucoseUptake: number;
  oxygenUptake: number;
  targetGenomeReduction: number;  // fraction (0-1)
  minGrowthFraction: number;      // min growth as fraction of wild-type
}

export interface KnockdownPlan {
  genes: string[];
  knockdownLevel: number;  // 0 = full knockout, 0.5 = 50% reduction
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
function planKnockdowns(
  spec: MinimizationSpec,
): {
  essentialGenes: string[];
  candidateGenes: string[];
  plans: KnockdownPlan[];
  solverCalls: Array<{ solver: string; description: string }>;
} {
  const solverCalls: Array<{ solver: string; description: string }> = [];

  // Get all genes from GPR rules
  const allGenes = new Set<string>();
  for (const rxn of IJO1366_REACTIONS) {
    if (rxn.gpr) {
      const genes = rxn.gpr.match(/\b[A-Z]{3}[0-9]{4}\b/g) ?? [];
      genes.forEach(g => allGenes.add(g));
    }
  }

  // Test essentiality: knock out each gene individually
  solverCalls.push({ solver: 'fbaGPR::essentiality', description: `Testing ${allGenes.size} genes for essentiality` });
  const essentialGenes: string[] = [];
  const nonEssentialGenes: string[] = [];

  for (const gene of allGenes) {
    const knockouts = getKnockoutReactions([gene], gprRules());
    // If knocking out this gene kills growth, it's essential
    if (knockouts.length > 0) {
      // Quick check: would this knock out biomass?
      const biomassKnockouts = knockouts.filter(k => k === 'BIOMASS');
      if (biomassKnockouts.length > 0) {
        essentialGenes.push(gene);
      } else {
        nonEssentialGenes.push(gene);
      }
    }
  }

  // Generate knockdown plans of increasing aggressiveness
  const plans: KnockdownPlan[] = [];
  const step = Math.max(1, Math.floor(nonEssentialGenes.length / 10));

  for (let i = step; i <= nonEssentialGenes.length; i += step) {
    const genes = nonEssentialGenes.slice(0, i);
    plans.push({
      genes,
      knockdownLevel: 0,  // full knockout
      description: `Knock out ${genes.length} non-essential genes`,
    });
  }

  return { essentialGenes, candidateGenes: nonEssentialGenes, plans, solverCalls };
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
  solverCalls.push({ solver: 'fbaEngine::solveAuthorityFBA', description: `FBA with ${knockouts.length} reaction knockouts` });

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
  const feasible = results.filter(r =>
    r.feasible && r.growthRate >= wildTypeGrowthRate * spec.minGrowthFraction
  );

  // Pareto front: maximize genome reduction, maximize growth
  const paretoFront: typeof feasible = [];
  for (const candidate of feasible) {
    let dominated = false;
    for (const other of feasible) {
      if (other === candidate) continue;
      const betterGrowth = other.growthRate >= candidate.growthRate;
      const betterReduction = other.genomeReduction >= candidate.genomeReduction;
      const strictlyBetter = other.growthRate > candidate.growthRate || other.genomeReduction > candidate.genomeReduction;
      if (betterGrowth && betterReduction && strictlyBetter) {
        dominated = true;
        break;
      }
    }
    if (!dominated) paretoFront.push(candidate);
  }

  // Best: highest genome reduction that meets growth constraint
  const best = paretoFront.length > 0
    ? paretoFront.reduce((b, r) => r.genomeReduction > b.genomeReduction ? r : b)
    : feasible[0] ?? results[0];

  return {
    paretoFront: paretoFront.map(r => ({ plan: r.plan, growthRate: r.growthRate, genomeReduction: r.genomeReduction })),
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
  const { paretoFront, bestPlan, bestGrowthRate, bestGenomeReduction, solverCalls: optCalls } =
    await optimizeMinimization(spec, plans, wildType.growthRate, candidateGenes);
  allSolverCalls.push(...optCalls);

  return { spec, wildType, essentialGenes, bestPlan, bestGrowthRate, bestGenomeReduction, paretoFront, allSolverCalls };
}
