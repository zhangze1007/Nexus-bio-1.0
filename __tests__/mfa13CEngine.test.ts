import { run13CMFA } from '../src/server/mfa13CEngine';

describe('mfa13CEngine', () => {
  describe('MID simulation', () => {
    it('simulates correct MID for fully labeled glucose (6C)', () => {
      const result = run13CMFA({
        metabolites: [
          { id: 'glucose', name: 'Glucose', nCarbon: 6 },
          { id: 'pyruvate', name: 'Pyruvate', nCarbon: 3 },
        ],
        reactions: [
          {
            id: 'glycolysis',
            substrates: [{ metabolite: 'glucose', stoichiometry: 1 }],
            products: [{ metabolite: 'pyruvate', stoichiometry: 2 }],
            reversible: false,
          },
        ],
        labelSubstrate: 'glucose',
        labelPattern: [0, 1, 2, 3, 4, 5], // fully labeled
      });

      // Fully labeled glucose should produce M+6 MID
      const glucoseMID = result.mids.find(m => m.metabolite === 'glucose');
      expect(glucoseMID).toBeDefined();
      if (glucoseMID) {
        // M+6 should be dominant
        expect(glucoseMID.mid[6]).toBeGreaterThan(0.8);
      }
    });

    it('simulates partially labeled substrate (binomial distribution)', () => {
      const result = run13CMFA({
        metabolites: [
          { id: 'glucose', name: 'Glucose', nCarbon: 6 },
        ],
        reactions: [],
        labelSubstrate: 'glucose',
        labelPattern: [0, 1, 2], // first 3 carbons labeled → ~50% labeling fraction
      });

      const glucoseMID = result.mids.find(m => m.metabolite === 'glucose');
      expect(glucoseMID).toBeDefined();
      if (glucoseMID) {
        // With 50% labeling, binomial distribution: M+3 ≈ 0.3125
        // C(6,3) * 0.5^3 * 0.5^3 = 20 * 0.125 * 0.125 = 0.3125
        expect(glucoseMID.mid[3]).toBeCloseTo(0.3125, 2);
        // MID should sum to 1
        const sum = glucoseMID.mid.reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 2);
      }
    });

    it('MID sums to 1.0 (probability conservation)', () => {
      const result = run13CMFA({
        metabolites: [
          { id: 'glucose', name: 'Glucose', nCarbon: 6 },
        ],
        reactions: [],
        labelSubstrate: 'glucose',
        labelPattern: [0, 1, 2, 3, 4, 5],
      });

      const glucoseMID = result.mids.find(m => m.metabolite === 'glucose');
      expect(glucoseMID).toBeDefined();
      if (glucoseMID) {
        const sum = glucoseMID.mid.reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 2);
      }
    });
  });

  describe('flux estimation', () => {
    it('returns flux estimates', () => {
      const result = run13CMFA({
        metabolites: [
          { id: 'glucose', name: 'Glucose', nCarbon: 6 },
        ],
        reactions: [
          { id: 'uptake', substrates: [], products: [{ metabolite: 'glucose', stoichiometry: 1 }], reversible: false },
        ],
        labelSubstrate: 'glucose',
        labelPattern: [0, 1, 2, 3, 4, 5],
        objectiveReaction: 'uptake',
      });

      expect(result.fluxEstimates.length).toBeGreaterThan(0);
      expect(result.converged).toBeDefined();
    });
  });
});
