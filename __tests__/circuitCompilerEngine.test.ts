import { truthTableToBoolean, compileCircuit, estimateBurden, designToeholdSwitch } from '../src/server/circuitCompilerEngine';

describe('circuitCompilerEngine', () => {
  describe('truthTableToBoolean', () => {
    it('converts simple OR truth table', () => {
      const tt = {
        inputs: ['A', 'B'],
        output: 'Y',
        rows: [
          { inputValues: { A: false, B: false }, outputValue: false },
          { inputValues: { A: false, B: true }, outputValue: true },
          { inputValues: { A: true, B: false }, outputValue: true },
          { inputValues: { A: true, B: true }, outputValue: true },
        ],
      };
      const expr = truthTableToBoolean(tt);
      expect(expr).toContain('+');
    });

    it('converts AND truth table', () => {
      const tt = {
        inputs: ['A', 'B'],
        output: 'Y',
        rows: [
          { inputValues: { A: false, B: false }, outputValue: false },
          { inputValues: { A: false, B: true }, outputValue: false },
          { inputValues: { A: true, B: false }, outputValue: false },
          { inputValues: { A: true, B: true }, outputValue: true },
        ],
      };
      const expr = truthTableToBoolean(tt);
      expect(expr).toContain('·');
    });
  });

  describe('compileCircuit', () => {
    it('compiles a NOT gate circuit', () => {
      const tt = {
        inputs: ['A'],
        output: 'Y',
        rows: [
          { inputValues: { A: false }, outputValue: true },
          { inputValues: { A: true }, outputValue: false },
        ],
      };
      const circuit = compileCircuit('NOT gate', tt);
      expect(circuit.gates.length).toBeGreaterThan(0);
      expect(circuit.metrics.dynamicRange).toBeGreaterThanOrEqual(0);
    });

    it('includes response data', () => {
      const tt = {
        inputs: ['A'],
        output: 'Y',
        rows: [
          { inputValues: { A: false }, outputValue: true },
          { inputValues: { A: true }, outputValue: false },
        ],
      };
      const circuit = compileCircuit('NOT gate', tt);
      expect(circuit.response.length).toBeGreaterThan(0);
    });
  });

  describe('estimateBurden', () => {
    it('estimates burden for single gate', () => {
      const gates = [{
        id: 'g1', type: 'NOT' as const, inputs: ['A'], output: 'Y',
        genetic: { promoter: 'pTac', rbs: 'RBS', cds: 'LacI', terminator: 'T1' },
        hill: { ymax: 100, ymin: 0.5, K: 50, n: 2.5 },
      }];
      const burden = estimateBurden(gates);
      expect(burden).toBeGreaterThan(0);
      expect(burden).toBeLessThan(1);
    });
  });

  describe('designToeholdSwitch', () => {
    it('designs a toehold switch', () => {
      const switch1 = designToeholdSwitch('AUGCGAUCGAUCGAUCG');
      expect(switch1.toeholdDomain.length).toBe(7);
      expect(switch1.rbsAccessibility).toBeGreaterThan(0);
      expect(switch1.dynamicRange).toBeGreaterThan(1);
    });
  });
});
