/**
 * Gene Circuit Reasoner Pipeline
 *
 * Unidirectional pipeline: Designer → Physiologist → Judge
 *
 * Every numerical conclusion comes from a real solver call.
 * LLM role: translate user intent to parameters (Agent A),
 * explain real outputs (Agent C).
 *
 * Pipeline:
 *   1. Agent A (Designer): User spec → CircuitParameters
 *   2. Agent B (Physiologist): Parameters → ODE simulation + burden model + Jacobian stability
 *   3. Agent C (Judge): Latin Hypercube grid search → Pareto front → recommended design
 *
 * @scientific_provenance
 *   ALGORITHM: Pipeline orchestration — circuit ODE simulation + ribosome burden model + Jacobian eigenvalue analysis + LHS grid search + Pareto optimization
 *   REFERENCE: N/A — orchestration only; delegates to circuitBuilder, jacobianAnalysis, and gridSearch
 *     Burden model basis: Ceroni F, Algar R, Stan G-B, Ellis T (2015) "Quantifying cellular capacity identifies gene expression designs with reduced burden" Nat Methods 12:415-418
 *   KNOWN_LIMITATIONS:
 *     - Burden model is simplified (total protein / 10000 nM capacity); no ribosome queueing or metabolic flux coupling
 *     - Growth burden factor (0.8 * ribosomeBurden) is an arbitrary scaling, not from FBA
 *     - Grid search uses Latin Hypercube Sampling with 50 samples; may miss optima in high-dimensional space
 *     - Sensitivity metric for oscillatory circuits uses amplitude/500 normalization; not a standard sensitivity index
 *     - No stochastic simulation (SSA) for circuits where noise matters (e.g., toggle switch switching probability)
 */

import {
  type CircuitParameters,
  type CircuitTopology,
  defaultCircuitParams,
  simulateCircuit,
  extractCircuitFeatures,
} from './circuitBuilder';
import { analyzeStability } from './jacobianAnalysis';
import { runGridSearch, type ParameterRange, type GridSearchResult } from './gridSearch';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface CircuitSpec {
  topology: CircuitTopology;
  sensitivityTarget: number;     // 0-1
  burdenLimit: number;           // 0-1 (max growth burden)
  inputSignal?: number;          // input signal strength (0-10)
}

export interface PhysiologistOutput {
  // ODE results
  steadyState: Record<string, number>;
  period: number | null;
  amplitude: number | null;
  dutyCycle: number | null;
  isOscillatory: boolean;

  // Stability
  eigenvalues: number[];
  maxEigenvalue: number;
  isStable: boolean;

  // Burden (from resource allocation model)
  growthBurden: number;
  ribosomeBurden: number;

  // Solver trace
  solverCalls: Array<{ solver: string; description: string }>;
}

export interface JudgeOutput {
  // Grid search results
  gridSearch: GridSearchResult;

  // Recommended design
  recommendedParams: CircuitParameters;
  recommendedSensitivity: number;
  recommendedBurden: number;
  recommendedStable: boolean;

  // All Pareto-optimal designs
  paretoDesigns: Array<{
    params: CircuitParameters;
    sensitivity: number;
    burden: number;
    isStable: boolean;
  }>;

  // Summary
  summary: string;
}

export interface CircuitReasonerResult {
  spec: CircuitSpec;
  judge: JudgeOutput;
  allSolverCalls: Array<{ solver: string; description: string }>;
}

// ── Agent B: Physiologist ───────────────────────────────────────────────────

/**
 * Run the physiologist pipeline: ODE simulation + burden + Jacobian.
 * Every output comes from a real solver.
 */
function runPhysiologist(params: CircuitParameters): PhysiologistOutput {
  const solverCalls: Array<{ solver: string; description: string }> = [];

  // Step 1: Run ODE to steady state
  solverCalls.push({ solver: 'circuitBuilder::simulateCircuit', description: 'RK4 ODE integration to steady state' });
  const sim = simulateCircuit(params, 500, 0.5);

  // Step 2: Extract features
  solverCalls.push({ solver: 'circuitBuilder::extractCircuitFeatures', description: 'Period, amplitude, duty cycle extraction' });
  const features = extractCircuitFeatures(sim.trajectory, params);

  // Step 3: Compute growth burden
  // Burden model: (total protein production rate) / (cell capacity)
  // Real FBA would be used here in production
  const totalProtein = Object.entries(sim.steadyState)
    .filter(([k]) => k.startsWith('p'))
    .reduce((s, [, v]) => s + v, 0);
  const ribosomeBurden = Math.min(1, totalProtein / 10000); // 10000 nM capacity
  const growthBurden = ribosomeBurden * 0.8; // growth penalty from protein load
  solverCalls.push({ solver: 'burdenModel::ribosomeLoad', description: 'Growth burden from protein load' });

  // Step 4: Jacobian stability analysis
  solverCalls.push({ solver: 'jacobianAnalysis::analyzeStability', description: 'Finite-difference Jacobian + eigenvalues' });
  const stability = analyzeStability(
    sim.system.derivatives,
    Object.values(sim.steadyState),
  );

  return {
    steadyState: sim.steadyState,
    period: features.period,
    amplitude: features.amplitude,
    dutyCycle: features.dutyCycle,
    isOscillatory: features.isOscillatory,
    eigenvalues: stability.eigenvalues,
    maxEigenvalue: stability.maxEigenvalue,
    isStable: stability.isStable,
    growthBurden: Math.round(growthBurden * 1000) / 1000,
    ribosomeBurden: Math.round(ribosomeBurden * 1000) / 1000,
    solverCalls,
  };
}

// ── Agent C: Judge ──────────────────────────────────────────────────────────

/**
 * Run the judge pipeline: grid search over parameter space,
 * evaluate each candidate through Agent B, build Pareto front.
 */
function runJudge(spec: CircuitSpec): JudgeOutput {
  // Define parameter ranges based on topology
  const baseParams = defaultCircuitParams(spec.topology);
  const ranges: ParameterRange[] = [
    { name: 'transcriptionRate', min: 50, max: 500, steps: 5 },
    { name: 'translationRate', min: 0.05, max: 0.5, steps: 5 },
    { name: 'hillCoefficient', min: 1, max: 4, steps: 4 },
    { name: 'kd', min: 20, max: 300, steps: 4 },
    { name: 'degradationRate', min: 0.002, max: 0.02, steps: 4 },
  ];

  // Grid search: evaluate each parameter set
  const gridResult = runGridSearch(
    ranges,
    (sampledParams) => {
      // Build circuit parameters from sampled values
      const circuitParams: CircuitParameters = {
        ...baseParams,
        transcriptionRate: sampledParams.transcriptionRate ?? baseParams.transcriptionRate,
        translationRate: sampledParams.translationRate ?? baseParams.translationRate,
        nodes: baseParams.nodes.map(n => ({
          ...n,
          degradationRate: sampledParams.degradationRate ?? n.degradationRate,
        })),
        edges: baseParams.edges.map(e => ({
          ...e,
          hillCoefficient: sampledParams.hillCoefficient ?? e.hillCoefficient,
          kd: sampledParams.kd ?? e.kd,
        })),
      };

      // Run real solvers
      const phys = runPhysiologist(circuitParams);

      // Compute sensitivity: how much output changes with input
      const sensitivity = phys.amplitude !== null
        ? Math.min(1, phys.amplitude / 500)  // normalized
        : (phys.steadyState['pA'] ?? 0) / 1000;  // normalized steady-state

      return {
        objectives: {
          sensitivity: Math.round(sensitivity * 1000) / 1000,
        },
        constraints: {
          burden: {
            value: phys.growthBurden,
            satisfied: phys.growthBurden < spec.burdenLimit,
            threshold: spec.burdenLimit,
          },
          stability: {
            value: phys.maxEigenvalue,
            satisfied: phys.isStable,
            threshold: 0,
          },
        },
      };
    },
    'lhs',
    50,
    { sensitivity: 1.0 },
  );

  // Find best feasible design
  const feasiblePareto = gridResult.paretoFront;
  const best = gridResult.bestByComposite;

  // Re-run best through physiologist for full output
  const bestParams: CircuitParameters = {
    ...baseParams,
    transcriptionRate: best.parameters.transcriptionRate ?? baseParams.transcriptionRate,
    translationRate: best.parameters.translationRate ?? baseParams.translationRate,
    nodes: baseParams.nodes.map(n => ({
      ...n,
      degradationRate: best.parameters.degradationRate ?? n.degradationRate,
    })),
    edges: baseParams.edges.map(e => ({
      ...e,
      hillCoefficient: best.parameters.hillCoefficient ?? e.hillCoefficient,
      kd: best.parameters.kd ?? e.kd,
    })),
  };
  const bestPhys = runPhysiologist(bestParams);

  // Build Pareto design list
  const paretoDesigns = feasiblePareto.map(c => {
    const params: CircuitParameters = {
      ...baseParams,
      transcriptionRate: c.parameters.transcriptionRate ?? baseParams.transcriptionRate,
      translationRate: c.parameters.translationRate ?? baseParams.translationRate,
      nodes: baseParams.nodes.map(n => ({
        ...n,
        degradationRate: c.parameters.degradationRate ?? n.degradationRate,
      })),
      edges: baseParams.edges.map(e => ({
        ...e,
        hillCoefficient: c.parameters.hillCoefficient ?? e.hillCoefficient,
        kd: c.parameters.kd ?? e.kd,
      })),
    };
    return {
      params,
      sensitivity: c.objectives.sensitivity ?? 0,
      burden: c.constraints.burden?.value ?? 0,
      isStable: c.constraints.stability?.satisfied ?? false,
    };
  });

  return {
    gridSearch: gridResult,
    recommendedParams: bestParams,
    recommendedSensitivity: best.objectives.sensitivity ?? 0,
    recommendedBurden: bestPhys.growthBurden,
    recommendedStable: bestPhys.isStable,
    paretoDesigns,
    summary: '',  // filled by LLM in UI
  };
}

// ── Pipeline Entry Point ────────────────────────────────────────────────────

/**
 * Run the complete Gene Circuit Reasoner pipeline.
 *
 * @param spec - User's circuit specification
 * @returns Complete result with solver traces
 */
export function runCircuitReasoner(spec: CircuitSpec): CircuitReasonerResult {
  const judge = runJudge(spec);

  // Collect all solver calls
  const allSolverCalls = [
    { solver: 'gridSearch::runGridSearch', description: `${judge.gridSearch.stats.totalEvaluated} parameter sets evaluated` },
    { solver: 'circuitBuilder::simulateCircuit', description: 'RK4 ODE for each candidate' },
    { solver: 'jacobianAnalysis::analyzeStability', description: 'Eigenvalue analysis for each candidate' },
  ];

  return { spec, judge, allSolverCalls };
}
