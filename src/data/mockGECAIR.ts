import type { GeneticPart, CircuitNode } from '../types';

// Toggle-3 genetic circuit: 3 NOT gates in a ring (repressilator)
// + AND gate output for bistable switch

export const CIRCUIT_PARTS: GeneticPart[] = [
  { id: 'pTet',   type: 'promoter',   strength: 1.0,  label: 'pTet' },
  { id: 'rbsA',   type: 'rbs',        strength: 0.85, label: 'RBS-A' },
  { id: 'lacI',   type: 'cds',        strength: 1.0,  label: 'LacI' },
  { id: 'term1',  type: 'terminator', strength: 1.0,  label: 'T1' },

  { id: 'pLac',   type: 'promoter',   strength: 0.8,  label: 'pLac' },
  { id: 'rbsB',   type: 'rbs',        strength: 0.9,  label: 'RBS-B' },
  { id: 'tetR',   type: 'cds',        strength: 1.0,  label: 'TetR' },
  { id: 'term2',  type: 'terminator', strength: 1.0,  label: 'T2' },

  { id: 'pCI',    type: 'promoter',   strength: 0.75, label: 'pCI' },
  { id: 'rbsC',   type: 'rbs',        strength: 0.95, label: 'RBS-C' },
  { id: 'cI',     type: 'cds',        strength: 1.0,  label: 'cI' },
  { id: 'term3',  type: 'terminator', strength: 1.0,  label: 'T3' },

  { id: 'pAND',   type: 'promoter',   strength: 0.6,  label: 'pAND' },
  { id: 'rbsOut', type: 'rbs',        strength: 0.9,  label: 'RBS-Out' },
  { id: 'gfp',    type: 'cds',        strength: 1.0,  label: 'GFP' },
  { id: 'termOut',type: 'terminator', strength: 1.0,  label: 'T-Out' },
];

export const CIRCUIT_NODES: CircuitNode[] = [
  { id: 'nodeA', parts: ['pTet','rbsA','lacI','term1'].map(id => CIRCUIT_PARTS.find(p => p.id === id)!), outputLevel: 0.72 },
  { id: 'nodeB', parts: ['pLac','rbsB','tetR','term2'].map(id => CIRCUIT_PARTS.find(p => p.id === id)!), outputLevel: 0.58 },
  { id: 'nodeC', parts: ['pCI', 'rbsC','cI','term3'].map(id => CIRCUIT_PARTS.find(p => p.id === id)!), outputLevel: 0.41 },
  { id: 'output',parts: ['pAND','rbsOut','gfp','termOut'].map(id => CIRCUIT_PARTS.find(p => p.id === id)!), outputLevel: 0.0 },
];

export type GateType = 'NOT' | 'AND' | 'OR' | 'NAND';

export interface LogicGate {
  id: string;
  type: GateType;
  inputs: string[];   // node IDs
  output: string;
  active: boolean;
}

export const LOGIC_GATES: LogicGate[] = [
  { id: 'g1', type: 'NOT', inputs: ['nodeA'], output: 'nodeB', active: true },
  { id: 'g2', type: 'NOT', inputs: ['nodeB'], output: 'nodeC', active: true },
  { id: 'g3', type: 'NOT', inputs: ['nodeC'], output: 'nodeA', active: true },
  { id: 'g4', type: 'AND', inputs: ['nodeA','nodeB'], output: 'output', active: false },
];

// Hill function: f(x) = K^n / (K^n + x^n)
export function hillInhibition(x: number, K = 0.5, n = 2): number {
  return (K ** n) / ((K ** n) + (x ** n));
}
export function hillActivation(x: number, K = 0.5, n = 2): number {
  return (x ** n) / ((K ** n) + (x ** n));
}

// Repressilator ODE dynamics (Elowitz & Leibler, 2000, Nature)
// 6-variable system: 3 mRNA + 3 protein
export interface RepressilatorParams {
  alpha: number;     // Max transcription rate (mRNA/min)
  alpha0: number;    // Leak transcription rate
  beta: number;      // Translation rate (protein/mRNA/min)
  gamma: number;     // Protein degradation rate (1/min)
  n: number;         // Hill coefficient
  K: number;         // Half-maximal repression concentration
}

export interface RepressilatorState {
  mA: number;  // mRNA A (LacI)
  mB: number;  // mRNA B (TetR)
  mC: number;  // mRNA C (cI)
  pA: number;  // Protein A (LacI)
  pB: number;  // Protein B (TetR)
  pC: number;  // Protein C (cI)
}

export const DEFAULT_REPRESSILATOR_PARAMS: RepressilatorParams = {
  alpha: 216,      // mRNA/min (from Elowitz 2000)
  alpha0: 0.216,   // Leak rate (alpha0/alpha = 0.001)
  beta: 0.2,       // protein/mRNA/min
  gamma: 0.0075,   // 1/min (protein half-life ~92 min)
  n: 2,            // Hill coefficient
  K: 100,          // Half-maximal concentration (nM)
};

// Run repressilator ODE simulation using RK4
export function runRepressilator(
  params: RepressilatorParams = DEFAULT_REPRESSILATOR_PARAMS,
  duration: number = 500,  // minutes
  dt: number = 0.5,        // time step
): RepressilatorState[] {
  const { alpha, alpha0, beta, gamma, n, K } = params;

  // Initial conditions: slightly asymmetric to break symmetry
  let state: RepressilatorState = { mA: 10, mB: 5, mC: 3, pA: 100, pB: 50, pC: 30 };
  const trajectory: RepressilatorState[] = [{ ...state }];

  // Derivatives function
  const derivatives = (s: RepressilatorState): RepressilatorState => ({
    mA: alpha0 + alpha * hillInhibition(s.pC, K, n) - s.mA,
    mB: alpha0 + alpha * hillInhibition(s.pA, K, n) - s.mB,
    mC: alpha0 + alpha * hillInhibition(s.pB, K, n) - s.mC,
    pA: beta * s.mA - gamma * s.pA,
    pB: beta * s.mB - gamma * s.pB,
    pC: beta * s.mC - gamma * s.pC,
  });

  // Add two states
  const addStates = (a: RepressilatorState, b: RepressilatorState, scale: number): RepressilatorState => ({
    mA: a.mA + b.mA * scale,
    mB: a.mB + b.mB * scale,
    mC: a.mC + b.mC * scale,
    pA: a.pA + b.pA * scale,
    pB: a.pB + b.pB * scale,
    pC: a.pC + b.pC * scale,
  });

  const steps = Math.floor(duration / dt);
  for (let t = 0; t < steps; t++) {
    const k1 = derivatives(state);
    const s2 = addStates(state, k1, dt / 2);
    const k2 = derivatives(s2);
    const s3 = addStates(state, k2, dt / 2);
    const k3 = derivatives(s3);
    const s4 = addStates(state, k3, dt);
    const k4 = derivatives(s4);

    // RK4 update
    state = {
      mA: state.mA + (dt / 6) * (k1.mA + 2 * k2.mA + 2 * k3.mA + k4.mA),
      mB: state.mB + (dt / 6) * (k1.mB + 2 * k2.mB + 2 * k3.mB + k4.mB),
      mC: state.mC + (dt / 6) * (k1.mC + 2 * k2.mC + 2 * k3.mC + k4.mC),
      pA: state.pA + (dt / 6) * (k1.pA + 2 * k2.pA + 2 * k3.pA + k4.pA),
      pB: state.pB + (dt / 6) * (k1.pB + 2 * k2.pB + 2 * k3.pB + k4.pB),
      pC: state.pC + (dt / 6) * (k1.pC + 2 * k2.pC + 2 * k3.pC + k4.pC),
    };

    // Clamp to non-negative
    state.mA = Math.max(0, state.mA);
    state.mB = Math.max(0, state.mB);
    state.mC = Math.max(0, state.mC);
    state.pA = Math.max(0, state.pA);
    state.pB = Math.max(0, state.pB);
    state.pC = Math.max(0, state.pC);

    trajectory.push({ ...state });
  }

  return trajectory;
}
