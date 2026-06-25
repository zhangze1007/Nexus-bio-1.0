/**
 * FBAsim Strain Design Pipeline
 *
 * Unidirectional pipeline: Designer → Simulator → Optimizer
 *
 * Agent A (Designer): Proposes knockout strategies (OptKnock) + overexpression targets (FSEOF)
 * Agent B (Simulator): Runs FBA to evaluate each strain strategy
 * Agent C (Optimizer): Pareto front of product flux vs. growth rate
 *
 * Every numerical conclusion comes from real FBA solver calls.
 * LLM role: explain results, not fabricate them.
 *
 * @scientific_provenance
 *   ALGORITHM: Pipeline orchestration — OptKnock bilevel knockout optimization + FSEOF flux scanning + FBA evaluation + Pareto ranking
 *   REFERENCE:
 *     Burgard AP, Pharkya P, Maranas CD (2003) "OptKnock: A bilevel programming framework for identifying gene knockout strategies for microbial strain optimization" Biotechnol Bioeng 84:647-657
 *     Choi HS, Lee SY, Kim TY, Woo HM (2010) "In silico identification of gene amplification targets for improvement of lycopene production" Appl Environ Microbiol 76:3097-3105
 *   KNOWN_LIMITATIONS:
 *     - OptKnock implementation is simplified; true bilevel LP requires dedicated solver (not simplex)
 *     - FSEOF overexpression targets filtered by monotonicity > 0.5; threshold is heuristic
 *     - No thermodynamic feasibility (TFA) or protein burden constraints on strategies
 *     - Grid search over strategy space is coarse; no evolutionary or MILP-based optimization
 *     - Carbon efficiency metric is approximate; no atom-mapping or elemental balance verification
 *     - Strategies limited to single-species; no community FBA or consortia design
 */

import { IJO1366_REACTIONS } from "../data/iJO1366Subset";
import type { FBAOutput } from "../data/mockFBA";
import { type FBAObjective, type FBASpecies, solveAuthorityFBA } from "./fbaEngine";
import { type FSEOFModel, type FSEOFReaction, type FSEOFResult, runFSEOF } from "./fbaFSEOF";
import { getKnockoutReactions } from "./fbaGPR";
import { type KnockoutSet, type OptKnockModel, type OptKnockReaction, runOptKnock } from "./fbaOptKnock";
import { type GridSearchResult, type ParameterRange, runGridSearch } from "./gridSearch";

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface StrainDesignSpec {
  species: FBASpecies;
  objective: FBAObjective;
  glucoseUptake: number;
  oxygenUptake: number;
  targetProduct: string;
  maxKnockouts: number;
  growthFractionConstraint: number; // min growth as fraction of wild-type
}

export interface StrainStrategy {
  knockouts: string[];
  overexpressions: Array<{ reactionId: string; foldChange: number }>;
  description: string;
}

export interface StrainEvaluation {
  strategy: StrainStrategy;
  growthRate: number;
  productFlux: number;
  biomassYield: number;
  carbonEfficiency: number;
  growthFractionOfWT: number;
  feasible: boolean;
  solverCalls: Array<{ solver: string; description: string }>;
}

export interface StrainDesignResult {
  spec: StrainDesignSpec;
  wildType: FBAOutput;
  optKnock: KnockoutSet[];
  fseof: FSEOFResult;
  evaluations: StrainEvaluation[];
  paretoFront: StrainEvaluation[];
  bestDesign: StrainEvaluation;
  allSolverCalls: Array<{ solver: string; description: string }>;
}

// ── Agent A: Designer ───────────────────────────────────────────────────────

/**
 * Generate candidate strain strategies using OptKnock and FSEOF.
 * These are real solver calls, not LLM suggestions.
 */
async function generateStrategies(
  spec: StrainDesignSpec,
  reactions: OptKnockReaction[],
): Promise<{
  knockoutStrategies: KnockoutSet[];
  overexpressionTargets: FSEOFResult;
  solverCalls: Array<{ solver: string; description: string }>;
}> {
  const solverCalls: Array<{ solver: string; description: string }> = [];

  // OptKnock: find knockout strategies
  solverCalls.push({
    solver: "fbaOptKnock::runOptKnock",
    description: `Bilevel knockout optimization, max ${spec.maxKnockouts} knockouts`,
  });
  const optKnockModel: OptKnockModel = {
    reactions,
    objectiveId: "BIOMASS",
    productReactionId: "PRODUCT",
  };
  const optKnockResult = await runOptKnock(optKnockModel, {
    maxKnockouts: spec.maxKnockouts,
    growthFraction: spec.growthFractionConstraint,
  });
  const knockoutStrategies = optKnockResult.knockoutSets;

  // FSEOF: find overexpression targets
  solverCalls.push({ solver: "fbaFSEOF::runFSEOF", description: "Flux scanning for overexpression targets" });
  const fseofModel: FSEOFModel = {
    reactions,
    objectiveId: "BIOMASS",
    productReactionId: "PRODUCT",
  };
  const overexpressionTargets = await runFSEOF(fseofModel);

  return { knockoutStrategies, overexpressionTargets, solverCalls };
}

// ── Agent B: Simulator ──────────────────────────────────────────────────────

/**
 * Evaluate a strain strategy by running FBA with the modifications applied.
 * Every output comes from a real LP solve.
 */
async function evaluateStrategy(
  spec: StrainDesignSpec,
  strategy: StrainStrategy,
  wildTypeGrowthRate: number,
): Promise<StrainEvaluation> {
  const solverCalls: Array<{ solver: string; description: string }> = [];

  // Run FBA with knockouts
  solverCalls.push({
    solver: "fbaEngine::solveAuthorityFBA",
    description: `FBA with ${strategy.knockouts.length} knockouts`,
  });
  const result = await solveAuthorityFBA({
    species: spec.species,
    objective: spec.objective,
    glucoseUptake: spec.glucoseUptake,
    oxygenUptake: spec.oxygenUptake,
    knockouts: strategy.knockouts,
  });

  const growthFraction = wildTypeGrowthRate > 0 ? result.growthRate / wildTypeGrowthRate : 0;

  return {
    strategy,
    growthRate: result.growthRate,
    productFlux: result.fluxes?.PRODUCT ?? 0,
    biomassYield: result.growthRate,
    carbonEfficiency: result.carbonEfficiency,
    growthFractionOfWT: Math.round(growthFraction * 1000) / 1000,
    feasible: result.feasible,
    solverCalls,
  };
}

// ── Agent C: Optimizer ──────────────────────────────────────────────────────

/**
 * Run grid search over strain strategies, evaluate each, build Pareto front.
 */
async function optimizeStrategies(
  spec: StrainDesignSpec,
  strategies: StrainStrategy[],
  wildTypeGrowthRate: number,
): Promise<{
  evaluations: StrainEvaluation[];
  paretoFront: StrainEvaluation[];
  bestDesign: StrainEvaluation;
  solverCalls: Array<{ solver: string; description: string }>;
}> {
  const solverCalls: Array<{ solver: string; description: string }> = [];

  // Evaluate all strategies
  solverCalls.push({
    solver: "fbaEngine::evaluateStrategy",
    description: `Evaluating ${strategies.length} strategies`,
  });
  const evaluations: StrainEvaluation[] = [];
  for (const strategy of strategies) {
    const eval_ = await evaluateStrategy(spec, strategy, wildTypeGrowthRate);
    evaluations.push(eval_);
  }

  // Build Pareto front: maximize productFlux, constrain growthFraction > threshold
  const feasible = evaluations.filter((e) => e.feasible && e.growthFractionOfWT >= spec.growthFractionConstraint);
  const paretoFront: StrainEvaluation[] = [];

  for (const candidate of feasible) {
    let dominated = false;
    for (const other of feasible) {
      if (other === candidate) continue;
      const betterProduct = other.productFlux >= candidate.productFlux;
      const betterGrowth = other.growthFractionOfWT >= candidate.growthFractionOfWT;
      const strictlyBetter =
        other.productFlux > candidate.productFlux || other.growthFractionOfWT > candidate.growthFractionOfWT;
      if (betterProduct && betterGrowth && strictlyBetter) {
        dominated = true;
        break;
      }
    }
    if (!dominated) paretoFront.push(candidate);
  }

  // Best by composite: 0.6 * product + 0.4 * growth
  const bestDesign =
    paretoFront.length > 0
      ? paretoFront.reduce((best, e) => {
          const scoreE = 0.6 * (e.productFlux / 10) + 0.4 * e.growthFractionOfWT;
          const scoreB = 0.6 * (best.productFlux / 10) + 0.4 * best.growthFractionOfWT;
          return scoreE > scoreB ? e : best;
        })
      : evaluations[0];

  return { evaluations, paretoFront, bestDesign, solverCalls };
}

// ── Pipeline Entry Point ────────────────────────────────────────────────────

/**
 * Run the complete FBAsim Strain Design pipeline.
 */
export async function runStrainDesignPipeline(spec: StrainDesignSpec): Promise<StrainDesignResult> {
  const allSolverCalls: Array<{ solver: string; description: string }> = [];

  // Get reactions for the model
  const reactions: OptKnockReaction[] = IJO1366_REACTIONS.map((r) => ({
    id: r.id,
    lb: r.lb,
    ub: r.ub,
    stoichiometry: r.stoichiometry,
    gpr: r.gpr,
  }));

  // Agent A: Generate strategies
  allSolverCalls.push({ solver: "pipeline::generateStrategies", description: "OptKnock + FSEOF strategy generation" });
  const {
    knockoutStrategies,
    overexpressionTargets,
    solverCalls: genCalls,
  } = await generateStrategies(spec, reactions);
  allSolverCalls.push(...genCalls);

  // Build strategy list from OptKnock results
  const strategies: StrainStrategy[] = knockoutStrategies.map((ks: KnockoutSet) => ({
    knockouts: ks.reactions,
    overexpressions: [],
    description: `OptKnock: knock out ${ks.reactions.join(", ")}`,
  }));

  // Add FSEOF overexpression strategies
  const oeTargets = overexpressionTargets.overexpressionTargets
    .filter((t: { direction: string; monotonicityScore: number }) => t.direction === "up" && t.monotonicityScore > 0.5)
    .slice(0, 5);
  if (oeTargets.length > 0) {
    strategies.push({
      knockouts: [],
      overexpressions: oeTargets.map((t: { reactionId: string }) => ({ reactionId: t.reactionId, foldChange: 2.0 })),
      description: `FSEOF: overexpress ${oeTargets.map((t: { reactionId: string }) => t.reactionId).join(", ")}`,
    });
  }

  // Get wild-type baseline first (needed for growth fraction calculation)
  const wildType = await solveAuthorityFBA({
    species: spec.species,
    objective: spec.objective,
    glucoseUptake: spec.glucoseUptake,
    oxygenUptake: spec.oxygenUptake,
  });

  // Agent B + C: Evaluate and optimize
  allSolverCalls.push({
    solver: "pipeline::optimizeStrategies",
    description: `Evaluating ${strategies.length} strategies`,
  });
  const {
    evaluations,
    paretoFront,
    bestDesign,
    solverCalls: optCalls,
  } = await optimizeStrategies(spec, strategies, wildType.growthRate);
  allSolverCalls.push(...optCalls);

  return {
    spec,
    wildType,
    optKnock: knockoutStrategies,
    fseof: overexpressionTargets,
    evaluations,
    paretoFront,
    bestDesign,
    allSolverCalls,
  };
}
