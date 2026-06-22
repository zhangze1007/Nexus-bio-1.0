/**
 * Gene Circuit Builder
 *
 * Translates structured circuit parameters into ODE systems compatible
 * with the RK4 solver. Supports toggle switch, repressilator, and
 * logic cascade topologies.
 *
 * Every output is a deterministic function of the input parameters.
 * No LLM inference, no mock data.
 *
 * @scientific_provenance
 *   ALGORITHM: Hill-function ODE system construction with RK4 (Runge-Kutta 4th-order) integration
 *   REFERENCE:
 *     Gardner TS, Cantor CR, Collins JJ (2000) "Construction of a genetic toggle switch in Escherichia coli" Nature 403:339-342
 *     Elowitz MB, Leibler S (2000) "A synthetic oscillatory network of transcriptional regulators" Nature 403:335-338
 *     Hooshangi S, Thiberge S, Weiss R (2005) "Ultrasensitivity and noise propagation in a synthetic transcriptional cascade" PNAS 102:3581-3586
 *   KNOWN_LIMITATIONS:
 *     - Only three fixed topologies (toggle switch, repressilator, logic cascade) — arbitrary graph wiring not supported
 *     - No stochastic effects (Gillespie SSA); deterministic ODE only
 *     - mRNA and protein lumped into single species per node; no spatial or compartmental modeling
 *     - Hill coefficients and Kd values are uniform per edge rather than fitted to experimental data
 *     - No resource competition or ribosome allocation coupling
 */

import { hillInhibition, hillActivation } from '../data/mockGECAIR';

// ── Interfaces ──────────────────────────────────────────────────────────────

export type CircuitTopology = 'toggle_switch' | 'repressilator' | 'logic_cascade';

export interface CircuitNode {
  id: string;
  promoterStrength: number;     // relative units (0-10)
  rbsStrength: number;          // relative units (0-10)
  degradationRate: number;      // min⁻¹ (protein degradation)
  mRNAdegradationRate: number;  // min⁻¹ (mRNA degradation)
}

export interface CircuitEdge {
  from: string;                 // repressor node ID
  to: string;                   // repressed node ID
  type: 'repression' | 'activation';
  hillCoefficient: number;      // dimensionless (1-4)
  kd: number;                   // nM (half-maximal concentration)
}

export interface CircuitParameters {
  topology: CircuitTopology;
  nodes: CircuitNode[];
  edges: CircuitEdge[];
  copyNumber: number;
  transcriptionRate: number;    // mRNA/min (base rate)
  leakRate: number;             // mRNA/min (leak transcription)
  translationRate: number;      // protein/mRNA/min
}

export interface ODESystem {
  /** Number of state variables */
  dim: number;
  /** State variable names */
  names: string[];
  /** Derivatives function: dy/dt = f(t, y) */
  derivatives: (t: number, y: number[]) => number[];
  /** Default initial conditions */
  initialConditions: number[];
}

// ── Preset Topologies ───────────────────────────────────────────────────────

/**
 * Generate default parameters for a given topology.
 */
export function defaultCircuitParams(topology: CircuitTopology): CircuitParameters {
  switch (topology) {
    case 'toggle_switch':
      return {
        topology: 'toggle_switch',
        nodes: [
          { id: 'A', promoterStrength: 1.0, rbsStrength: 1.0, degradationRate: 0.0075, mRNAdegradationRate: 1.0 },
          { id: 'B', promoterStrength: 1.0, rbsStrength: 1.0, degradationRate: 0.0075, mRNAdegradationRate: 1.0 },
        ],
        edges: [
          { from: 'A', to: 'B', type: 'repression', hillCoefficient: 2.5, kd: 100 },
          { from: 'B', to: 'A', type: 'repression', hillCoefficient: 2.5, kd: 100 },
        ],
        copyNumber: 1,
        transcriptionRate: 216,
        leakRate: 0.216,
        translationRate: 0.2,
      };

    case 'repressilator':
      return {
        topology: 'repressilator',
        nodes: [
          { id: 'A', promoterStrength: 1.0, rbsStrength: 1.0, degradationRate: 0.0075, mRNAdegradationRate: 1.0 },
          { id: 'B', promoterStrength: 1.0, rbsStrength: 1.0, degradationRate: 0.0075, mRNAdegradationRate: 1.0 },
          { id: 'C', promoterStrength: 1.0, rbsStrength: 1.0, degradationRate: 0.0075, mRNAdegradationRate: 1.0 },
        ],
        edges: [
          { from: 'A', to: 'B', type: 'repression', hillCoefficient: 2.0, kd: 100 },
          { from: 'B', to: 'C', type: 'repression', hillCoefficient: 2.0, kd: 100 },
          { from: 'C', to: 'A', type: 'repression', hillCoefficient: 2.0, kd: 100 },
        ],
        copyNumber: 1,
        transcriptionRate: 216,
        leakRate: 0.216,
        translationRate: 0.2,
      };

    case 'logic_cascade':
      return {
        topology: 'logic_cascade',
        nodes: [
          { id: 'A', promoterStrength: 1.0, rbsStrength: 1.0, degradationRate: 0.0075, mRNAdegradationRate: 1.0 },
          { id: 'B', promoterStrength: 1.0, rbsStrength: 1.0, degradationRate: 0.0075, mRNAdegradationRate: 1.0 },
          { id: 'C', promoterStrength: 1.0, rbsStrength: 1.0, degradationRate: 0.0075, mRNAdegradationRate: 1.0 },
        ],
        edges: [
          { from: 'A', to: 'B', type: 'repression', hillCoefficient: 2.0, kd: 100 },
          { from: 'B', to: 'C', type: 'repression', hillCoefficient: 2.0, kd: 100 },
        ],
        copyNumber: 1,
        transcriptionRate: 216,
        leakRate: 0.216,
        translationRate: 0.2,
      };
  }
}

// ── ODE System Builder ──────────────────────────────────────────────────────

/**
 * Build an ODE system from circuit parameters.
 *
 * State vector: [mA, pA, mB, pB, mC, pC, ...]
 *   where mX = mRNA of node X, pX = protein of node X
 *
 * For each node X:
 *   dmX/dt = alpha * promoterStrength * copyNumber * regulation(X) + alpha0 - delta_mRNA * mX
 *   dpX/dt = beta * rbsStrength * mX - gamma * pX
 *
 * where regulation(X) = product of Hill functions from all repressors of X
 */
export function buildODESystem(params: CircuitParameters): ODESystem {
  const { nodes, edges, copyNumber, transcriptionRate, leakRate, translationRate } = params;
  const n = nodes.length;
  const dim = n * 2; // mRNA + protein per node

  // Build regulation map: for each node, what regulates it
  const regulators = new Map<string, CircuitEdge[]>();
  for (const node of nodes) {
    regulators.set(node.id, []);
  }
  for (const edge of edges) {
    regulators.get(edge.to)!.push(edge);
  }

  // State index mapping: node ID → (mRNA index, protein index)
  const nodeIndex = new Map<string, { mi: number; pi: number }>();
  for (let i = 0; i < n; i++) {
    nodeIndex.set(nodes[i].id, { mi: i * 2, pi: i * 2 + 1 });
  }

  const names: string[] = [];
  for (const node of nodes) {
    names.push(`m${node.id}`);
    names.push(`p${node.id}`);
  }

  const derivatives = (_t: number, y: number[]): number[] => {
    const dydt = new Array(dim).fill(0);

    for (const node of nodes) {
      const { mi, pi } = nodeIndex.get(node.id)!;
      const mRNA = y[mi];
      const protein = y[pi];

      // Compute regulation factor
      let regulation = 1.0;
      const regs = regulators.get(node.id)!;
      if (regs.length === 0) {
        // Constitutive expression (no regulation)
        regulation = 1.0;
      } else {
        for (const edge of regs) {
          const repressorIdx = nodeIndex.get(edge.from)!;
          const repressorProtein = y[repressorIdx.pi];
          if (edge.type === 'repression') {
            regulation *= hillInhibition(repressorProtein, edge.kd, edge.hillCoefficient);
          } else {
            regulation *= hillActivation(repressorProtein, edge.kd, edge.hillCoefficient);
          }
        }
      }

      // mRNA dynamics
      const transcription = transcriptionRate * node.promoterStrength * copyNumber * regulation;
      dydt[mi] = transcription + leakRate - node.mRNAdegradationRate * mRNA;

      // Protein dynamics
      dydt[pi] = translationRate * node.rbsStrength * mRNA - node.degradationRate * protein;
    }

    return dydt;
  };

  // Default initial conditions: low mRNA, low protein
  const initialConditions = new Array(dim).fill(0);
  for (let i = 0; i < n; i++) {
    initialConditions[i * 2] = 5;      // mRNA starts at 5 nM
    initialConditions[i * 2 + 1] = 50;  // protein starts at 50 nM
  }

  return { dim, names, derivatives, initialConditions };
}

/**
 * Run a circuit simulation to steady state.
 *
 * @returns Final state and trajectory
 */
export function simulateCircuit(
  params: CircuitParameters,
  duration = 500,
  dt = 0.5,
): {
  steadyState: Record<string, number>;
  trajectory: Array<{ time: number; state: Record<string, number> }>;
  system: ODESystem;
} {
  const system = buildODESystem(params);
  const { dim, names, derivatives, initialConditions } = system;

  // RK4 integration
  let y = [...initialConditions];
  const trajectory: Array<{ time: number; state: Record<string, number> }> = [];
  const steps = Math.floor(duration / dt);

  for (let step = 0; step <= steps; step++) {
    const t = step * dt;

    // Record state
    const state: Record<string, number> = {};
    for (let i = 0; i < dim; i++) {
      state[names[i]] = y[i];
    }
    trajectory.push({ time: t, state });

    if (step < steps) {
      // RK4 step
      const k1 = derivatives(t, y);
      const y2 = y.map((yi, i) => yi + dt / 2 * k1[i]);
      const k2 = derivatives(t + dt / 2, y2);
      const y3 = y.map((yi, i) => yi + dt / 2 * k2[i]);
      const k3 = derivatives(t + dt / 2, y3);
      const y4 = y.map((yi, i) => yi + dt * k3[i]);
      const k4 = derivatives(t + dt, y4);

      y = y.map((yi, i) =>
        Math.max(0, yi + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]))
      );
    }
  }

  // Extract steady state
  const steadyState: Record<string, number> = {};
  for (let i = 0; i < dim; i++) {
    steadyState[names[i]] = y[i];
  }

  return { steadyState, trajectory, system };
}

/**
 * Extract circuit features from simulation output.
 */
export function extractCircuitFeatures(
  trajectory: Array<{ time: number; state: Record<string, number> }>,
  params: CircuitParameters,
): {
  proteinNames: string[];
  steadyStateValues: Record<string, number>;
  period: number | null;
  amplitude: number | null;
  dutyCycle: number | null;
  isOscillatory: boolean;
} {
  const proteinNames = params.nodes.map(n => `p${n.id}`);
  const steadyStateValues: Record<string, number> = {};
  for (const name of proteinNames) {
    steadyStateValues[name] = trajectory[trajectory.length - 1].state[name] ?? 0;
  }

  // Detect oscillations: look at the last 60% of trajectory
  const startIdx = Math.floor(trajectory.length * 0.4);
  const tail = trajectory.slice(startIdx);

  // Use the first protein node for oscillation detection
  const probeName = proteinNames[0];
  const values = tail.map(t => t.state[probeName] ?? 0);
  const times = tail.map(t => t.time);

  // Find zero crossings of derivative (approximate)
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  let crossings: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if ((values[i - 1] - mean) * (values[i] - mean) < 0) {
      crossings.push(times[i]);
    }
  }

  let period: number | null = null;
  let amplitude: number | null = null;
  let dutyCycle: number | null = null;
  let isOscillatory = false;

  if (crossings.length >= 4) {
    // Compute period from zero-crossing intervals
    const intervals: number[] = [];
    for (let i = 2; i < crossings.length; i += 2) {
      intervals.push(crossings[i] - crossings[i - 2]);
    }
    if (intervals.length > 0) {
      period = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      isOscillatory = true;

      // Amplitude: max - min in tail
      const max = Math.max(...values);
      const min = Math.min(...values);
      amplitude = max - min;

      // Duty cycle: fraction of time above half-max
      const halfMax = (max + min) / 2;
      const aboveHalf = values.filter(v => v > halfMax).length;
      dutyCycle = aboveHalf / values.length;
    }
  }

  return { proteinNames, steadyStateValues, period, amplitude, dutyCycle, isOscillatory };
}
