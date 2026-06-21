import { analyzeBioreactorData } from '../src/server/bioreactorAnalyticsEngine';

describe('bioreactorAnalyticsEngine', () => {
  const sampleData = Array.from({ length: 50 }, (_, i) => ({
    time: i * 0.5,
    biomass: 0.1 * Math.exp(0.15 * i) + (Math.random() - 0.5) * 0.02,
    substrate: Math.max(0, 10 - 0.2 * i),
    product: 0.05 * i,
    dissolvedO2: 80 - i * 0.5,
    pH: 7.0 + (Math.random() - 0.5) * 0.1,
    temperature: 37 + (Math.random() - 0.5) * 0.2,
  }));

  describe('analyzeBioreactorData', () => {
    it('detects anomalies', () => {
      const result = analyzeBioreactorData(sampleData);
      expect(Array.isArray(result.anomalies)).toBe(true);
    });

    it('identifies growth phases', () => {
      const result = analyzeBioreactorData(sampleData);
      expect(result.phases.length).toBeGreaterThan(0);
      expect(['lag', 'exponential', 'stationary', 'decline']).toContain(result.phases[0].phase);
    });

    it('estimates kinetic parameters', () => {
      const result = analyzeBioreactorData(sampleData);
      expect(result.kinetics.muMax).toBeGreaterThanOrEqual(0);
      expect(result.kinetics.ks).toBeGreaterThanOrEqual(0);
      expect(result.kinetics.r2).toBeGreaterThanOrEqual(0);
    });

    it('includes linear and nonlinear estimates', () => {
      const result = analyzeBioreactorData(sampleData);
      expect(result.kinetics.linearEstimate).toBeDefined();
      expect(result.kinetics.nonlinearEstimate).toBeDefined();
    });

    it('computes PCA model', () => {
      const result = analyzeBioreactorData(sampleData);
      expect(result.pcaModel.nComponents).toBeGreaterThan(0);
      expect(result.pcaModel.explainedVariance.length).toBeGreaterThan(0);
    });

    it('generates summary', () => {
      const result = analyzeBioreactorData(sampleData);
      expect(result.summary.maxBiomass).toBeGreaterThan(0);
      expect(result.summary.duration).toBeGreaterThan(0);
    });

    it('generates recommendations', () => {
      const result = analyzeBioreactorData(sampleData);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('compares with historical batches', () => {
      const historical = [sampleData.map(d => ({ ...d, biomass: (d.biomass ?? 0) * 0.9 }))];
      const result = analyzeBioreactorData(sampleData, historical);
      expect(result.batchComparison).not.toBeNull();
      expect(result.batchComparison!.similarity).toBeGreaterThanOrEqual(0);
    });

    it('generates design notes', () => {
      const result = analyzeBioreactorData(sampleData);
      expect(result.designNotes.length).toBeGreaterThan(0);
    });
  });
});

describe('bioreactorAnalyticsEngine — literature benchmarks', () => {
  // Generate deterministic exponential growth data
  // μ = 0.5 h⁻¹, X0 = 0.1 g/L, S0 = 10 g/L, Yxs = 0.5 g/g
  // Reference: Monod (1949) Annu Rev Microbiol 3:371-394
  const muMax = 0.5;
  const x0 = 0.1;
  const s0 = 10;
  const nPoints = 40;
  const dt = 0.5;

  const exponentialData = Array.from({ length: nPoints }, (_, i) => {
    const t = i * dt;
    const x = x0 * Math.exp(muMax * t);
    return {
      time: t,
      biomass: Math.min(x, 50),
      substrate: Math.max(0, s0 - x * 0.5),
      product: 0.05 * x,
      dissolvedO2: 80,
      pH: 7.0,
      temperature: 37,
    };
  });

  describe('kinetic parameter estimation', () => {
    it('should recover μmax within order of magnitude of 0.5 h⁻¹', () => {
      const result = analyzeBioreactorData(exponentialData);
      expect(result.kinetics.muMax).toBeGreaterThan(0.1);
      expect(result.kinetics.muMax).toBeLessThan(2.0);
    });

    it('should report R² for fit quality', () => {
      const result = analyzeBioreactorData(exponentialData);
      expect(result.kinetics.r2).toBeGreaterThanOrEqual(0);
    });
  });

  describe('growth phase identification', () => {
    it('should identify exponential phase', () => {
      const result = analyzeBioreactorData(exponentialData);
      const expPhase = result.phases.find(p => p.phase === 'exponential');
      expect(expPhase).toBeDefined();
    });
  });

  describe('summary statistics', () => {
    it('max biomass should be reasonable', () => {
      const result = analyzeBioreactorData(exponentialData);
      expect(result.summary.maxBiomass).toBeGreaterThan(0);
      expect(result.summary.maxBiomass).toBeLessThan(100);
    });
  });
});
