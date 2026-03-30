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
