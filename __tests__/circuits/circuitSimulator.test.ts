import {
  hillFunction,
  evaluateGate,
  topologicalSort,
  simulateCircuit,
  extractCircuitDefinition,
  type CircuitDefinition,
  type GateType,
} from '../../src/components/circuits/circuitSimulator';

// ── Hill Function ───────────────────────────────────────────────────────

describe('hillFunction', () => {
  it('returns 0 for x = 0', () => {
    expect(hillFunction(0)).toBe(0);
  });

  it('returns 0 for negative x', () => {
    expect(hillFunction(-1)).toBe(0);
  });

  it('returns ~0.5 when x = K', () => {
    expect(hillFunction(0.5, 0.5, 2)).toBeCloseTo(0.5, 5);
  });

  it('approaches 1 for large x', () => {
    // With K=0.5, n=2: f(50) = 2500/(0.25+2500) ≈ 0.9999
    expect(hillFunction(50, 0.5, 2)).toBeCloseTo(1, 3);
  });

  it('returns 0.8 for x=1 with default K=0.5, n=2', () => {
    // f(1) = 1/(0.25+1) = 0.8
    expect(hillFunction(1, 0.5, 2)).toBeCloseTo(0.8, 5);
  });

  it('respects custom K and n', () => {
    // K=1, n=1: f(1) = 1/(1+1) = 0.5
    expect(hillFunction(1, 1, 1)).toBeCloseTo(0.5, 5);
    // K=1, n=4: f(1) = 1/(1+1) = 0.5
    expect(hillFunction(1, 1, 4)).toBeCloseTo(0.5, 5);
    // K=0.3, n=3: f(0.3) = 0.027/(0.027+0.027) = 0.5
    expect(hillFunction(0.3, 0.3, 3)).toBeCloseTo(0.5, 5);
  });

  it('is monotonically increasing', () => {
    const values = [0.1, 0.2, 0.3, 0.5, 0.7, 1.0, 2.0, 5.0];
    for (let i = 1; i < values.length; i++) {
      expect(hillFunction(values[i], 0.5, 2)).toBeGreaterThan(
        hillFunction(values[i - 1], 0.5, 2),
      );
    }
  });
});

// ── Gate Evaluation ─────────────────────────────────────────────────────

describe('evaluateGate', () => {
  describe('AND gate', () => {
    it('returns 0 when both inputs are low', () => {
      expect(evaluateGate('andGate', [0, 0])).toBe(0);
    });

    it('returns 0 when one input is low', () => {
      expect(evaluateGate('andGate', [1, 0])).toBe(0);
      expect(evaluateGate('andGate', [0, 1])).toBe(0);
    });

    it('returns 1 when both inputs are high', () => {
      expect(evaluateGate('andGate', [1, 1])).toBe(1);
    });

    it('returns product for fractional inputs', () => {
      expect(evaluateGate('andGate', [0.5, 0.8])).toBeCloseTo(0.4, 5);
    });
  });

  describe('OR gate', () => {
    it('returns 0 when both inputs are low', () => {
      expect(evaluateGate('orGate', [0, 0])).toBe(0);
    });

    it('returns 1 when either input is high', () => {
      expect(evaluateGate('orGate', [1, 0])).toBe(1);
      expect(evaluateGate('orGate', [0, 1])).toBe(1);
    });

    it('returns 1 when both inputs are high', () => {
      expect(evaluateGate('orGate', [1, 1])).toBe(1);
    });

    it('returns max for fractional inputs', () => {
      expect(evaluateGate('orGate', [0.3, 0.7])).toBeCloseTo(0.7, 5);
    });
  });

  describe('NOT gate', () => {
    it('returns 1 when input is low', () => {
      expect(evaluateGate('notGate', [0])).toBe(1);
    });

    it('returns 0 when input is high', () => {
      expect(evaluateGate('notGate', [1])).toBe(0);
    });

    it('inverts fractional inputs', () => {
      expect(evaluateGate('notGate', [0.3])).toBeCloseTo(0.7, 5);
    });
  });

  describe('NOR gate', () => {
    it('returns 1 when both inputs are low', () => {
      expect(evaluateGate('norGate', [0, 0])).toBe(1);
    });

    it('returns 0 when any input is high', () => {
      expect(evaluateGate('norGate', [1, 0])).toBe(0);
      expect(evaluateGate('norGate', [0, 1])).toBe(0);
      expect(evaluateGate('norGate', [1, 1])).toBe(0);
    });
  });

  describe('NAND gate', () => {
    it('returns 0 when both inputs are high', () => {
      expect(evaluateGate('nandGate', [1, 1])).toBe(0);
    });

    it('returns 1 when either input is low', () => {
      expect(evaluateGate('nandGate', [1, 0])).toBe(1);
      expect(evaluateGate('nandGate', [0, 1])).toBe(1);
      expect(evaluateGate('nandGate', [0, 0])).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('returns 0 for empty inputs on AND', () => {
      expect(evaluateGate('andGate', [])).toBe(0);
    });

    it('returns 1 for empty inputs on NOT', () => {
      expect(evaluateGate('notGate', [])).toBe(1);
    });

    it('reporter passes through input', () => {
      expect(evaluateGate('reporter', [0.7])).toBeCloseTo(0.7, 5);
    });

    it('promoter passes through input', () => {
      expect(evaluateGate('promoter', [0.42])).toBeCloseTo(0.42, 5);
    });
  });
});

// ── Topological Sort ────────────────────────────────────────────────────

describe('topologicalSort', () => {
  it('returns nodes in dependency order', () => {
    const nodes = [
      { id: 'a', type: 'promoter' as GateType, name: 'pTetR' },
      { id: 'b', type: 'andGate' as GateType, name: 'AND1' },
      { id: 'c', type: 'reporter' as GateType, name: 'GFP' },
    ];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ];
    const sorted = topologicalSort(nodes, edges);
    expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('b'));
    expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('c'));
  });

  it('handles disconnected nodes', () => {
    const nodes = [
      { id: 'a', type: 'promoter' as GateType, name: 'pTetR' },
      { id: 'b', type: 'reporter' as GateType, name: 'GFP' },
    ];
    const sorted = topologicalSort(nodes, []);
    expect(sorted).toHaveLength(2);
  });

  it('throws on cycles', () => {
    const nodes = [
      { id: 'a', type: 'andGate' as GateType, name: 'AND1' },
      { id: 'b', type: 'andGate' as GateType, name: 'AND2' },
    ];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' },
    ];
    expect(() => topologicalSort(nodes, edges)).toThrow('cycle');
  });
});

// ── Circuit Simulator ───────────────────────────────────────────────────

describe('simulateCircuit', () => {
  /**
   * Use low K (0.1) so Hill activation is near 1.0 for input=1.0.
   * f(1.0, K=0.1, n=2) = 1/(0.01+1) = 0.9901
   */
  const lowK = { K: 0.1, n: 2 };

  it('simulates a single promoter-reporter circuit', () => {
    const circuit: CircuitDefinition = {
      nodes: [
        { id: 'p1', type: 'promoter', name: 'pTetR', params: lowK },
        { id: 'r1', type: 'reporter', name: 'GFP', params: lowK },
      ],
      edges: [{ source: 'p1', target: 'r1' }],
    };

    const result = simulateCircuit(circuit, { p1: 1.0 }, 10, 0.1);

    expect(result.timePoints.length).toBeGreaterThan(0);
    expect(result.steadyState['p1']).toBeCloseTo(1.0, 2);
    // Reporter converges to Hill(1.0, K=0.1) ≈ 0.99
    expect(result.steadyState['r1']).toBeGreaterThan(0.95);
  });

  it('AND gate: both inputs high produces high output', () => {
    const circuit: CircuitDefinition = {
      nodes: [
        { id: 'p1', type: 'promoter', name: 'pTetR', params: lowK },
        { id: 'p2', type: 'promoter', name: 'pLac', params: lowK },
        { id: 'g1', type: 'andGate', name: 'AND1', params: lowK },
        { id: 'r1', type: 'reporter', name: 'GFP', params: lowK },
      ],
      edges: [
        { source: 'p1', target: 'g1' },
        { source: 'p2', target: 'g1' },
        { source: 'g1', target: 'r1' },
      ],
    };

    const result = simulateCircuit(circuit, { p1: 1.0, p2: 1.0 }, 15, 0.05);
    // AND output = Hill(1) * Hill(1) ≈ 0.99 * 0.99 ≈ 0.98
    expect(result.steadyState['g1']).toBeGreaterThan(0.9);
  });

  it('AND gate: one input low produces low output', () => {
    const circuit: CircuitDefinition = {
      nodes: [
        { id: 'p1', type: 'promoter', name: 'pTetR', params: lowK },
        { id: 'p2', type: 'promoter', name: 'pLac', params: lowK },
        { id: 'g1', type: 'andGate', name: 'AND1', params: lowK },
        { id: 'r1', type: 'reporter', name: 'GFP', params: lowK },
      ],
      edges: [
        { source: 'p1', target: 'g1' },
        { source: 'p2', target: 'g1' },
        { source: 'g1', target: 'r1' },
      ],
    };

    const result = simulateCircuit(circuit, { p1: 1.0, p2: 0.0 }, 10, 0.1);
    // AND = Hill(1) * Hill(0) = 0.99 * 0 = 0
    expect(result.steadyState['g1']).toBeLessThan(0.05);
  });

  it('NOT gate: input high produces low output', () => {
    const circuit: CircuitDefinition = {
      nodes: [
        { id: 'p1', type: 'promoter', name: 'pTetR', params: lowK },
        { id: 'g1', type: 'notGate', name: 'NOT1', params: lowK },
        { id: 'r1', type: 'reporter', name: 'GFP', params: lowK },
      ],
      edges: [
        { source: 'p1', target: 'g1' },
        { source: 'g1', target: 'r1' },
      ],
    };

    const result = simulateCircuit(circuit, { p1: 1.0 }, 10, 0.1);
    // NOT(0.99) ≈ 0.01
    expect(result.steadyState['g1']).toBeLessThan(0.1);
  });

  it('NOT gate: input low produces high output', () => {
    const circuit: CircuitDefinition = {
      nodes: [
        { id: 'p1', type: 'promoter', name: 'pTetR', params: lowK },
        { id: 'g1', type: 'notGate', name: 'NOT1', params: lowK },
        { id: 'r1', type: 'reporter', name: 'GFP', params: lowK },
      ],
      edges: [
        { source: 'p1', target: 'g1' },
        { source: 'g1', target: 'r1' },
      ],
    };

    const result = simulateCircuit(circuit, { p1: 0.0 }, 10, 0.1);
    // NOT(0) = 1
    expect(result.steadyState['g1']).toBeGreaterThan(0.95);
  });

  it('cascade: NOT(AND(A, B)) produces correct output', () => {
    const circuit: CircuitDefinition = {
      nodes: [
        { id: 'p1', type: 'promoter', name: 'pTetR', params: lowK },
        { id: 'p2', type: 'promoter', name: 'pLac', params: lowK },
        { id: 'g1', type: 'andGate', name: 'AND1', params: lowK },
        { id: 'g2', type: 'notGate', name: 'NOT1', params: lowK },
        { id: 'r1', type: 'reporter', name: 'GFP', params: lowK },
      ],
      edges: [
        { source: 'p1', target: 'g1' },
        { source: 'p2', target: 'g1' },
        { source: 'g1', target: 'g2' },
        { source: 'g2', target: 'r1' },
      ],
    };

    // Both high -> AND ≈ 0.98 -> NOT ≈ 0.02
    const bothHigh = simulateCircuit(circuit, { p1: 1.0, p2: 1.0 }, 20, 0.02);
    expect(bothHigh.steadyState['g2']).toBeLessThan(0.15);

    // One low -> AND = 0 -> NOT = 1
    const oneLow = simulateCircuit(circuit, { p1: 1.0, p2: 0.0 }, 20, 0.02);
    expect(oneLow.steadyState['g2']).toBeGreaterThan(0.9);
  });

  it('concentrations evolve over time toward steady state', () => {
    const circuit: CircuitDefinition = {
      nodes: [
        { id: 'p1', type: 'promoter', name: 'pTetR', params: lowK },
        { id: 'r1', type: 'reporter', name: 'GFP', params: lowK },
      ],
      edges: [{ source: 'p1', target: 'r1' }],
    };

    const result = simulateCircuit(circuit, { p1: 1.0 }, 10, 0.1);

    // First time point should be near 0 for reporter (starts at 0)
    const reporterConc = result.concentrations['r1'];
    expect(reporterConc[0]).toBeCloseTo(0, 2);

    // Should approach steady state (Hill(1.0, K=0.1) ≈ 0.99)
    const lastVal = reporterConc[reporterConc.length - 1];
    expect(lastVal).toBeGreaterThan(0.9);

    // Should be monotonically increasing (since input is constant and > 0)
    for (let i = 2; i < reporterConc.length; i++) {
      expect(reporterConc[i]).toBeGreaterThanOrEqual(reporterConc[i - 1] - 0.001);
    }
  });

  it('uses custom Hill parameters', () => {
    const circuit: CircuitDefinition = {
      nodes: [
        { id: 'p1', type: 'promoter', name: 'pTetR', params: { K: 0.1, n: 2 } },
        {
          id: 'r1', type: 'reporter', name: 'GFP',
          params: { K: 0.1, n: 2, tau: 0.1 },
        },
      ],
      edges: [{ source: 'p1', target: 'r1' }],
    };

    // With tau=0.1, reporter should converge faster
    const result = simulateCircuit(circuit, { p1: 1.0 }, 3, 0.01);
    expect(result.steadyState['r1']).toBeGreaterThan(0.95);
  });

  it('throws on cyclic circuit', () => {
    const circuit: CircuitDefinition = {
      nodes: [
        { id: 'g1', type: 'andGate', name: 'AND1' },
        { id: 'g2', type: 'andGate', name: 'AND2' },
      ],
      edges: [
        { source: 'g1', target: 'g2' },
        { source: 'g2', target: 'g1' },
      ],
    };

    expect(() => simulateCircuit(circuit, {}, 10)).toThrow('cycle');
  });
});

// ── Extract Circuit Definition ──────────────────────────────────────────

describe('extractCircuitDefinition', () => {
  it('converts React Flow nodes and edges to circuit definition', () => {
    const flowNodes = [
      {
        id: 'n1',
        type: 'promoter',
        data: { label: 'pTetR', gateType: 'promoter' as GateType },
      },
      {
        id: 'n2',
        type: 'andGate',
        data: { label: 'AND1', gateType: 'andGate' as GateType, params: { K: 0.3, n: 3 } },
      },
    ];
    const flowEdges = [{ source: 'n1', target: 'n2' }];

    const result = extractCircuitDefinition(flowNodes, flowEdges);

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].id).toBe('n1');
    expect(result.nodes[0].type).toBe('promoter');
    expect(result.nodes[1].params?.K).toBe(0.3);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe('n1');
  });
});
