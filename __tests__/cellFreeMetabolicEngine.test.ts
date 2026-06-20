import { simulateCellFreePathway, optimizeEnzymeRatios } from '../src/server/cellFreeMetabolicEngine';

describe('cellFreeMetabolicEngine', () => {
  const defaultSystem = {
    extractType: 'E_coli' as const,
    energySystem: 'PEP' as const,
    templateDNA: 5,
    aminoAcids: { 'L-Ala': 1.0 },
    rNTPs: { ATP: 2.0, GTP: 1.0, CTP: 1.0, UTP: 1.0 },
    cofactors: { NAD: 1.0, CoA: 0.5 },
    volume: 10,
    temperature: 37,
  };

  describe('simulateCellFreePathway', () => {
    it('simulates TX-TL dynamics', () => {
      const result = simulateCellFreePathway(defaultSystem, [], 4);
      expect(result.productYield).toBeGreaterThanOrEqual(0);
      expect(result.timeSeries.length).toBeGreaterThan(0);
      expect(result.energyBalance).toBeDefined();
    });

    it('includes energy balance', () => {
      const result = simulateCellFreePathway(defaultSystem, [], 2);
      expect(result.energyBalance.atpProduced).toBeGreaterThanOrEqual(0);
      expect(result.energyBalance.net).toBeDefined();
    });

    it('generates recommendations', () => {
      const result = simulateCellFreePathway(defaultSystem, [], 2);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('optimizeEnzymeRatios', () => {
    it('optimizes enzyme ratios', () => {
      const pathway = [
        { enzyme: 'Hexokinase', ecNumber: '2.7.1.1', substrate: 'glucose', product: 'g6p', kcat: 100, km: 0.1, enzymeConc: 1.0 },
      ];
      const result = optimizeEnzymeRatios(defaultSystem, pathway, 5);
      expect(result.optimalRatios.length).toBe(1);
      expect(result.maxYield).toBeGreaterThanOrEqual(0);
    });
  });
});
