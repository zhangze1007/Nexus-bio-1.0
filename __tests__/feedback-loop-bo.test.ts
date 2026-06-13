import {
  runBayesianOptimization,
  type BOExperiment,
  type BOConfig,
} from '../src/utils/feedback-loop';

describe('Bayesian optimization', () => {
  describe('with sufficient history (>= 5 experiments)', () => {
    it('suggests next experiments that improve yield', () => {
      const history: BOExperiment[] = [
        { params: { temp: 30, conc: 0.5 }, yield: 2.1 },
        { params: { temp: 37, conc: 0.8 }, yield: 3.5 },
        { params: { temp: 33, conc: 0.6 }, yield: 2.8 },
        { params: { temp: 35, conc: 0.7 }, yield: 3.2 },
        { params: { temp: 28, conc: 0.3 }, yield: 1.5 },
        { params: { temp: 40, conc: 0.9 }, yield: 3.0 },
      ];
      const config: BOConfig = {
        paramRanges: { temp: [25, 42], conc: [0.1, 1.0] },
        nSuggestions: 3,
      };
      const result = runBayesianOptimization(history, config);

      expect(result.suggestions.length).toBe(3);
      expect(result.suggestions[0].expectedImprovement).toBeGreaterThanOrEqual(0);
      expect(result.suggestions[0].predictedYield).toBeDefined();
      expect(result.suggestions[0].predictedUncertainty).toBeGreaterThanOrEqual(0);

      // All suggestions should have valid param values within ranges
      for (const s of result.suggestions) {
        expect(s.params.temp).toBeGreaterThanOrEqual(25);
        expect(s.params.temp).toBeLessThanOrEqual(42);
        expect(s.params.conc).toBeGreaterThanOrEqual(0.1);
        expect(s.params.conc).toBeLessThanOrEqual(1.0);
      }
    });

    it('returns suggestions with diverse parameter values', () => {
      const history: BOExperiment[] = [
        { params: { temp: 30, conc: 0.5 }, yield: 2.1 },
        { params: { temp: 37, conc: 0.8 }, yield: 3.5 },
        { params: { temp: 33, conc: 0.6 }, yield: 2.8 },
        { params: { temp: 35, conc: 0.7 }, yield: 3.2 },
        { params: { temp: 28, conc: 0.3 }, yield: 1.5 },
      ];
      const result = runBayesianOptimization(history, {
        paramRanges: { temp: [25, 42], conc: [0.1, 1.0] },
        nSuggestions: 3,
      });

      // Check that suggestions are not all identical
      const uniqueTemps = new Set(result.suggestions.map((s) => s.params.temp));
      expect(uniqueTemps.size).toBeGreaterThan(1);
    });

    it('handles single-dimensional parameter space', () => {
      const history: BOExperiment[] = [
        { params: { temp: 30 }, yield: 2.1 },
        { params: { temp: 33 }, yield: 2.8 },
        { params: { temp: 35 }, yield: 3.2 },
        { params: { temp: 37 }, yield: 3.5 },
        { params: { temp: 40 }, yield: 3.0 },
      ];
      const result = runBayesianOptimization(history, {
        paramRanges: { temp: [25, 42] },
        nSuggestions: 2,
      });

      expect(result.suggestions.length).toBe(2);
      for (const s of result.suggestions) {
        expect(s.params.temp).toBeGreaterThanOrEqual(25);
        expect(s.params.temp).toBeLessThanOrEqual(42);
      }
    });

    it('handles three-dimensional parameter space', () => {
      const history: BOExperiment[] = [
        { params: { temp: 30, conc: 0.5, ph: 6.5 }, yield: 2.1 },
        { params: { temp: 37, conc: 0.8, ph: 7.0 }, yield: 3.5 },
        { params: { temp: 33, conc: 0.6, ph: 6.8 }, yield: 2.8 },
        { params: { temp: 35, conc: 0.7, ph: 7.2 }, yield: 3.2 },
        { params: { temp: 28, conc: 0.3, ph: 6.0 }, yield: 1.5 },
        { params: { temp: 40, conc: 0.9, ph: 7.5 }, yield: 3.0 },
      ];
      const result = runBayesianOptimization(history, {
        paramRanges: { temp: [25, 42], conc: [0.1, 1.0], ph: [5.0, 8.0] },
        nSuggestions: 2,
      });

      expect(result.suggestions.length).toBe(2);
      for (const s of result.suggestions) {
        expect(s.params.ph).toBeGreaterThanOrEqual(5.0);
        expect(s.params.ph).toBeLessThanOrEqual(8.0);
      }
    });
  });

  describe('with small history (< 5 experiments)', () => {
    it('falls back to heuristic suggestions', () => {
      const history: BOExperiment[] = [
        { params: { temp: 30, conc: 0.5 }, yield: 2.1 },
        { params: { temp: 37, conc: 0.8 }, yield: 3.5 },
        { params: { temp: 33, conc: 0.6 }, yield: 2.8 },
      ];
      const result = runBayesianOptimization(history, {
        paramRanges: { temp: [25, 42], conc: [0.1, 1.0] },
        nSuggestions: 3,
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeLessThanOrEqual(3);

      for (const s of result.suggestions) {
        expect(s.params.temp).toBeGreaterThanOrEqual(25);
        expect(s.params.temp).toBeLessThanOrEqual(42);
        expect(s.params.conc).toBeGreaterThanOrEqual(0.1);
        expect(s.params.conc).toBeLessThanOrEqual(1.0);
      }
    });

    it('handles empty history', () => {
      const result = runBayesianOptimization([], {
        paramRanges: { temp: [25, 42], conc: [0.1, 1.0] },
        nSuggestions: 3,
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
      for (const s of result.suggestions) {
        expect(s.params.temp).toBeGreaterThanOrEqual(25);
        expect(s.params.temp).toBeLessThanOrEqual(42);
      }
    });

    it('handles single experiment', () => {
      const history: BOExperiment[] = [
        { params: { temp: 30, conc: 0.5 }, yield: 2.1 },
      ];
      const result = runBayesianOptimization(history, {
        paramRanges: { temp: [25, 42], conc: [0.1, 1.0] },
        nSuggestions: 2,
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('returns empty suggestions for empty parameter ranges', () => {
      const history: BOExperiment[] = [
        { params: {}, yield: 2.1 },
      ];
      const result = runBayesianOptimization(history, {
        paramRanges: {},
        nSuggestions: 3,
      });

      expect(result.suggestions).toEqual([]);
    });

    it('respects nSuggestions default of 3', () => {
      const history: BOExperiment[] = [
        { params: { temp: 30, conc: 0.5 }, yield: 2.1 },
        { params: { temp: 37, conc: 0.8 }, yield: 3.5 },
        { params: { temp: 33, conc: 0.6 }, yield: 2.8 },
        { params: { temp: 35, conc: 0.7 }, yield: 3.2 },
        { params: { temp: 28, conc: 0.3 }, yield: 1.5 },
      ];
      const result = runBayesianOptimization(history, {
        paramRanges: { temp: [25, 42], conc: [0.1, 1.0] },
        // nSuggestions omitted => defaults to 3
      });

      expect(result.suggestions.length).toBeLessThanOrEqual(3);
    });

    it('handles identical yield values', () => {
      const history: BOExperiment[] = [
        { params: { temp: 30, conc: 0.5 }, yield: 3.0 },
        { params: { temp: 33, conc: 0.6 }, yield: 3.0 },
        { params: { temp: 35, conc: 0.7 }, yield: 3.0 },
        { params: { temp: 37, conc: 0.8 }, yield: 3.0 },
        { params: { temp: 28, conc: 0.3 }, yield: 3.0 },
      ];
      const result = runBayesianOptimization(history, {
        paramRanges: { temp: [25, 42], conc: [0.1, 1.0] },
        nSuggestions: 2,
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('handles params outside range gracefully', () => {
      const history: BOExperiment[] = [
        { params: { temp: 20, conc: 0.5 }, yield: 2.1 }, // temp below range
        { params: { temp: 50, conc: 0.8 }, yield: 3.5 }, // temp above range
        { params: { temp: 33, conc: 0.6 }, yield: 2.8 },
        { params: { temp: 35, conc: 0.7 }, yield: 3.2 },
        { params: { temp: 28, conc: 0.3 }, yield: 1.5 },
      ];
      const result = runBayesianOptimization(history, {
        paramRanges: { temp: [25, 42], conc: [0.1, 1.0] },
        nSuggestions: 2,
      });

      // Should still produce valid suggestions within range
      for (const s of result.suggestions) {
        expect(s.params.temp).toBeGreaterThanOrEqual(25);
        expect(s.params.temp).toBeLessThanOrEqual(42);
      }
    });
  });

  describe('determinism', () => {
    it('returns identical results for identical inputs', () => {
      const history: BOExperiment[] = [
        { params: { temp: 30, conc: 0.5 }, yield: 2.1 },
        { params: { temp: 37, conc: 0.8 }, yield: 3.5 },
        { params: { temp: 33, conc: 0.6 }, yield: 2.8 },
        { params: { temp: 35, conc: 0.7 }, yield: 3.2 },
        { params: { temp: 28, conc: 0.3 }, yield: 1.5 },
      ];
      const config: BOConfig = {
        paramRanges: { temp: [25, 42], conc: [0.1, 1.0] },
        nSuggestions: 3,
      };

      const result1 = runBayesianOptimization(history, config);
      const result2 = runBayesianOptimization(history, config);

      expect(result1).toEqual(result2);
    });
  });
});
