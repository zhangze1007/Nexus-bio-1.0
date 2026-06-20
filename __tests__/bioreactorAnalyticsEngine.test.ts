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
