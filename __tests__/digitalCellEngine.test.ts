import { simulateDigitalCell } from '../src/server/digitalCellEngine';

describe('digitalCellEngine', () => {
  const defaultConfig = {
    duration: 1,
    dt: 0.1,
    stochasticGeneExpression: false,
    includeDivision: false,
    environmentConditions: {
      glucose: 10,
      oxygen: 100,
      temperature: 37,
    },
  };

  describe('simulateDigitalCell', () => {
    it('simulates cell dynamics', () => {
      const result = simulateDigitalCell(defaultConfig);
      expect(result.finalState).toBeDefined();
      expect(result.timeSeries.length).toBeGreaterThan(0);
      expect(result.metrics.avgGrowthRate).toBeGreaterThanOrEqual(0);
    });

    it('tracks gene expression', () => {
      const result = simulateDigitalCell(defaultConfig);
      expect(Object.keys(result.finalState.proteins).length).toBeGreaterThan(0);
      expect(Object.keys(result.finalState.mrnas).length).toBeGreaterThan(0);
    });

    it('computes doubling time', () => {
      const result = simulateDigitalCell(defaultConfig);
      expect(result.doublingTime).toBeGreaterThan(0);
    });

    it('generates design notes', () => {
      const result = simulateDigitalCell(defaultConfig);
      expect(result.designNotes.length).toBeGreaterThan(0);
      expect(result.designNotes[0]).toContain('Simulated');
    });

    it('handles stochastic mode', () => {
      const config = { ...defaultConfig, stochasticGeneExpression: true };
      const result = simulateDigitalCell(config);
      expect(result.timeSeries.length).toBeGreaterThan(0);
    });
  });
});
