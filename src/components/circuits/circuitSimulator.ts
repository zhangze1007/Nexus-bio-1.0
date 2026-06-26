/**
 * Gene Circuit Simulator
 *
 * Simulates genetic circuit behavior using Hill function modeling.
 * Supports AND, OR, NOT, NOR, NAND gate logic with Euler-method ODE integration.
 *
 * Hill function: f(x) = x^n / (K^n + x^n)
 *
 * Gate logic:
 *   AND  = f(input1) * f(input2)
 *   OR   = max(f(input1), f(input2))
 *   NOT  = 1 - f(input1)
 *   NOR  = 1 - max(f(input1), f(input2))
 *   NAND = 1 - f(input1) * f(input2)
 */

// ── Types ───────────────────────────────────────────────────────────────

export type GateType = 'promoter' | 'andGate' | 'orGate' | 'notGate' | 'norGate' | 'nandGate' | 'reporter';

export interface CircuitNode {
  id: string;
  type: GateType;
  name: string;
  params?: {
    K?: number;   // Hill constant (default 0.5)
    n?: number;   // Hill coefficient (default 2)
    tau?: number;  // Time constant for ODE (default 1.0)
  };
}

export interface CircuitEdge {
  source: string;
  target: string;
}

export interface CircuitDefinition {
  nodes: CircuitNode[];
  edges: CircuitEdge[];
}

export interface SimulationResult {
  timePoints: number[];
  concentrations: Record<string, number[]>;
  steadyState: Record<string, number>;
}

// ── Hill Function ───────────────────────────────────────────────────────

/**
 * Hill function: f(x) = x^n / (K^n + x^n)
 *
 * @param x       Input concentration (must be >= 0)
 * @param K       Half-maximal activation constant (default 0.5)
 * @param n       Hill coefficient / cooperativity (default 2)
 * @returns       Activation level in [0, 1]
 */
export function hillFunction(x: number, K = 0.5, n = 2): number {
  if (x <= 0) return 0;
  const kn = Math.pow(K, n);
  const xn = Math.pow(x, n);
  return xn / (kn + xn);
}

// ── Gate Evaluation ─────────────────────────────────────────────────────

/**
 * Evaluate a single gate given its activated input values.
 *
 * @param gateType  Type of logic gate
 * @param inputs    Array of Hill-activated input values (each in [0,1])
 * @returns         Gate output in [0, 1]
 */
export function evaluateGate(gateType: GateType, inputs: number[]): number {
  switch (gateType) {
    case 'promoter':
      // Promoters pass through their activation; for simulation they are
      // driven by external input concentrations, so this is a no-op
      return inputs.length > 0 ? inputs[0] : 0;

    case 'andGate':
      // AND: multiply activated inputs
      if (inputs.length < 2) return 0;
      return inputs[0] * inputs[1];

    case 'orGate':
      // OR: max of activated inputs
      if (inputs.length < 2) return 0;
      return Math.max(inputs[0], inputs[1]);

    case 'notGate':
      // NOT: invert single input
      if (inputs.length < 1) return 1;
      return 1 - inputs[0];

    case 'norGate':
      // NOR: invert the OR
      if (inputs.length < 2) return 1;
      return 1 - Math.max(inputs[0], inputs[1]);

    case 'nandGate':
      // NAND: invert the AND
      if (inputs.length < 2) return 1;
      return 1 - inputs[0] * inputs[1];

    case 'reporter':
      // Reporter passes through
      return inputs.length > 0 ? inputs[0] : 0;

    default:
      return 0;
  }
}

// ── Topological Sort ────────────────────────────────────────────────────

/**
 * Topological sort of circuit nodes based on edges.
 * Returns node IDs in execution order (sources first).
 * Throws if the graph contains cycles.
 */
export function topologicalSort(nodes: CircuitNode[], edges: CircuitEdge[]): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    const current = inDegree.get(edge.target) ?? 0;
    inDegree.set(edge.target, current + 1);
    adjacency.get(edge.source)?.push(edge.target);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      const deg = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error('Circuit contains a cycle — topological sort impossible');
  }

  return sorted;
}

// ── Circuit Simulator ───────────────────────────────────────────────────

/**
 * Simulate a genetic circuit using Euler-method ODE integration.
 *
 * Each node's concentration evolves as:
 *   dC/dt = (gateOutput - C) / tau
 *
 * where gateOutput is computed from Hill-activated upstream inputs.
 *
 * @param circuit    Circuit definition (nodes + edges)
 * @param inputs     Map of promoter node IDs to their input concentrations
 * @param timeSpan   Total simulation time (default 10)
 * @param dt         Time step for Euler integration (default 0.05)
 * @returns          Simulation results with time series and steady state
 */
export function simulateCircuit(
  circuit: CircuitDefinition,
  inputs: Record<string, number>,
  timeSpan = 10,
  dt = 0.05,
): SimulationResult {
  const { nodes, edges } = circuit;
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const executionOrder = topologicalSort(nodes, edges);

  // Build incoming-edge map: target -> source[]
  const incomingMap = new Map<string, string[]>();
  for (const edge of edges) {
    if (!incomingMap.has(edge.target)) incomingMap.set(edge.target, []);
    incomingMap.get(edge.target)!.push(edge.source);
  }

  const steps = Math.ceil(timeSpan / dt);
  const timePoints: number[] = [];
  const concentrations: Record<string, number[]> = {};

  // Initialize concentrations
  for (const node of nodes) {
    concentrations[node.id] = new Array(steps + 1).fill(0);
  }

  // Set initial promoter concentrations from inputs
  for (const node of nodes) {
    if (node.type === 'promoter' && inputs[node.id] !== undefined) {
      concentrations[node.id][0] = inputs[node.id];
    }
  }

  // Euler integration
  for (let step = 0; step < steps; step++) {
    const t = step * dt;
    timePoints.push(t);

    // Snapshot current values
    const current: Record<string, number> = {};
    for (const node of nodes) {
      current[node.id] = concentrations[node.id][step];
    }

    for (const nodeId of executionOrder) {
      const node = nodeMap.get(nodeId)!;
      const K = node.params?.K ?? 0.5;
      const n = node.params?.n ?? 2;
      const tau = node.params?.tau ?? 1.0;

      if (node.type === 'promoter') {
        // Promoters are driven by external inputs; keep constant
        concentrations[nodeId][step + 1] = inputs[nodeId] !== undefined
          ? inputs[nodeId]
          : current[nodeId];
        continue;
      }

      // Get upstream inputs and apply Hill activation
      const upstreamIds = incomingMap.get(nodeId) ?? [];
      const activatedInputs = upstreamIds.map(srcId => {
        const srcNode = nodeMap.get(srcId);
        const srcK = srcNode?.params?.K ?? K;
        const srcN = srcNode?.params?.n ?? n;
        return hillFunction(current[srcId], srcK, srcN);
      });

      // Evaluate gate
      const gateOutput = evaluateGate(node.type, activatedInputs);

      // ODE: dC/dt = (gateOutput - C) / tau
      const dCdt = (gateOutput - current[nodeId]) / tau;
      concentrations[nodeId][step + 1] = Math.max(0, current[nodeId] + dCdt * dt);
    }
  }

  timePoints.push(timeSpan);

  // Steady state = final concentrations
  const steadyState: Record<string, number> = {};
  for (const node of nodes) {
    steadyState[node.id] = concentrations[node.id][steps];
  }

  return { timePoints, concentrations, steadyState };
}

/**
 * Extract a CircuitDefinition from React Flow nodes and edges.
 */
export function extractCircuitDefinition(
  flowNodes: Array<{ id: string; type?: string; data: { label: string; gateType: GateType; params?: CircuitNode['params'] } }>,
  flowEdges: Array<{ source: string; target: string }>,
): CircuitDefinition {
  return {
    nodes: flowNodes.map(n => ({
      id: n.id,
      type: n.data.gateType,
      name: n.data.label,
      params: n.data.params,
    })),
    edges: flowEdges.map(e => ({ source: e.source, target: e.target })),
  };
}
