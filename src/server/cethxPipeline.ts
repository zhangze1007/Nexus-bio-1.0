/**
 * CETHX Thermodynamic Feasibility Pipeline
 *
 * Unidirectional pipeline: Analyzer → Feasibility Checker → Optimizer
 *
 * Agent A (Analyzer): Computes ΔG for each pathway step
 * Agent B (Checker): Evaluates thermodynamic feasibility
 * Agent C (Optimizer): Ranks pathway modifications by feasibility improvement
 *
 * Every numerical conclusion comes from real thermodynamic solver calls.
 */

import { runTFA, type TFAReaction, type TFAResult } from './tfaEngine';
import { computeSensitivity, type SensitivityReport } from './sensitivityAnalysis';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ThermodynamicSpec {
  reactions: TFAReaction[];
  conditions: {
    pH: number;
    ionicStrength: number;
    temperature: number;  // K
  };
  targetProduct: string;
}

export interface StepFeasibility {
  reactionId: string;
  deltaG: number;           // kJ/mol
  feasible: boolean;        // ΔG < 5 kJ/mol
  direction: 'forward' | 'reverse' | 'reversible';
  bottleneck: boolean;      // ΔG > 0 (thermodynamic barrier)
  recommendation: string;
}

export interface ThermodynamicResult {
  spec: ThermodynamicSpec;
  tfa: TFAResult;
  steps: StepFeasibility[];
  overallFeasible: boolean;
  overallDeltaG: number;
  bottleneckSteps: string[];
  sensitivity: SensitivityReport;
  allSolverCalls: Array<{ solver: string; description: string }>;
}

// ── Agent A: Analyzer ───────────────────────────────────────────────────────

/**
 * Run Thermodynamic Flux Analysis on the pathway.
 */
function analyzeThermodynamics(
  spec: ThermodynamicSpec,
): {
  tfa: TFAResult;
  solverCalls: Array<{ solver: string; description: string }>;
} {
  const solverCalls: Array<{ solver: string; description: string }> = [];

  solverCalls.push({ solver: 'tfaEngine::runTFA', description: `${spec.reactions.length} reactions, pH=${spec.conditions.pH}, T=${spec.conditions.temperature}K` });
  const tfa = runTFA({
    reactions: spec.reactions,
    conditions: spec.conditions,
  });

  return { tfa, solverCalls };
}

// ── Agent B: Feasibility Checker ────────────────────────────────────────────

/**
 * Evaluate thermodynamic feasibility of each step.
 */
function checkFeasibility(
  tfa: TFAResult,
): {
  steps: StepFeasibility[];
  overallFeasible: boolean;
  overallDeltaG: number;
  bottleneckSteps: string[];
  solverCalls: Array<{ solver: string; description: string }>;
} {
  const solverCalls: Array<{ solver: string; description: string }> = [];
  solverCalls.push({ solver: 'feasibility::check', description: `${tfa.reactionResults.length} reactions evaluated` });

  const steps: StepFeasibility[] = tfa.reactionResults.map(r => {
    const deltaG = r.transformedDeltaG;
    const feasible = deltaG < 5; // 5 kJ/mol threshold
    const bottleneck = deltaG > 0;

    let recommendation = '';
    if (deltaG > 10) recommendation = 'Strongly unfavorable — requires energy coupling or product removal';
    else if (deltaG > 5) recommendation = 'Marginally unfavorable — consider substrate/product concentration adjustment';
    else if (deltaG > 0) recommendation = 'Slightly unfavorable — feasible under cellular conditions';
    else recommendation = 'Thermodynamically favorable';

    return {
      reactionId: r.id,
      deltaG,
      feasible,
      direction: r.feasibleDirection,
      bottleneck,
      recommendation,
    };
  });

  const overallDeltaG = steps.reduce((s: number, step: StepFeasibility) => s + step.deltaG, 0);
  const overallFeasible = overallDeltaG < 0 && steps.filter(s => s.bottleneck).length <= 1;
  const bottleneckSteps = steps.filter((s: StepFeasibility) => s.bottleneck).map((s: StepFeasibility) => s.reactionId);

  return { steps, overallFeasible, overallDeltaG: Math.round(overallDeltaG * 100) / 100, bottleneckSteps, solverCalls };
}

// ── Agent C: Optimizer ──────────────────────────────────────────────────────

/**
 * Identify which parameters most affect thermodynamic feasibility.
 */
function optimizeFeasibility(
  spec: ThermodynamicSpec,
): {
  sensitivity: SensitivityReport;
  solverCalls: Array<{ solver: string; description: string }>;
} {
  const solverCalls: Array<{ solver: string; description: string }> = [];

  // Sensitivity: how does overall ΔG change with pH, temperature, ionic strength?
  solverCalls.push({ solver: 'sensitivityAnalysis::compute', description: 'Sensitivity to pH, T, ionic strength' });
  const sensitivity = computeSensitivity(
    (params) => {
      const tfa = runTFA({
        reactions: spec.reactions,
        conditions: {
          pH: params.pH ?? spec.conditions.pH,
          ionicStrength: params.ionicStrength ?? spec.conditions.ionicStrength,
          temperature: params.temperature ?? spec.conditions.temperature,
        },
      });
      return tfa.reactionResults.reduce((s: number, r) => s + r.transformedDeltaG, 0);
    },
    { pH: spec.conditions.pH, ionicStrength: spec.conditions.ionicStrength, temperature: spec.conditions.temperature },
  );

  return { sensitivity, solverCalls };
}

// ── Pipeline Entry Point ────────────────────────────────────────────────────

export function runThermodynamicPipeline(spec: ThermodynamicSpec): ThermodynamicResult {
  const allSolverCalls: Array<{ solver: string; description: string }> = [];

  // Agent A: Analyze
  const { tfa, solverCalls: analyzeCalls } = analyzeThermodynamics(spec);
  allSolverCalls.push(...analyzeCalls);

  // Agent B: Check feasibility
  const { steps, overallFeasible, overallDeltaG, bottleneckSteps, solverCalls: checkCalls } = checkFeasibility(tfa);
  allSolverCalls.push(...checkCalls);

  // Agent C: Optimize
  const { sensitivity, solverCalls: optCalls } = optimizeFeasibility(spec);
  allSolverCalls.push(...optCalls);

  return { spec, tfa, steps, overallFeasible, overallDeltaG, bottleneckSteps, sensitivity, allSolverCalls };
}
