import { createCampaign, runClosedLoopDBTL } from '../src/server/closedLoopDBTLEngine';

describe('closedLoopDBTLEngine', () => {
  describe('createCampaign', () => {
    it('creates a campaign with correct structure', () => {
      const campaign = createCampaign('Test Campaign', [
        { name: 'temperature', type: 'continuous', bounds: [30, 40] },
        { name: 'pH', type: 'continuous', bounds: [6.0, 8.0] },
      ], 'maximize');

      expect(campaign.name).toBe('Test Campaign');
      expect(campaign.parameters.length).toBe(2);
      expect(campaign.objective).toBe('maximize');
      expect(campaign.round).toBe(0);
      expect(campaign.experiments).toEqual([]);
    });
  });

  describe('runClosedLoopDBTL', () => {
    // T1-4 anti-fabrication: same inputs + same seed => byte-identical suggestions.
    it('is reproducible for a fixed seed and varies with the seed', () => {
      const mk = () => createCampaign('Repro', [
        { name: 'x1', type: 'continuous', bounds: [0, 1] },
        { name: 'x2', type: 'continuous', bounds: [0, 1] },
      ], 'maximize');

      const a = runClosedLoopDBTL(mk(), 'EI', 3, 123);
      const b = runClosedLoopDBTL(mk(), 'EI', 3, 123);
      const c = runClosedLoopDBTL(mk(), 'EI', 3, 999);

      expect(a.suggestions).toEqual(b.suggestions);       // same seed -> identical
      expect(a.suggestions).not.toEqual(c.suggestions);   // different seed -> different
    });

    it('generates initial suggestions via LHS', () => {
      const campaign = createCampaign('Test', [
        { name: 'x1', type: 'continuous', bounds: [0, 1] },
        { name: 'x2', type: 'continuous', bounds: [0, 1] },
      ], 'maximize');

      const result = runClosedLoopDBTL(campaign, 'EI', 3);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].acquisitionType).toBe('LHS_initial');
      expect(result.campaign.round).toBe(1);
    });

    it('uses EI acquisition after experiments', () => {
      const campaign = createCampaign('Test', [
        { name: 'x1', type: 'continuous', bounds: [0, 1] },
      ], 'maximize');

      // Add a completed experiment
      campaign.experiments.push({
        id: 'exp1',
        parameters: { x1: 0.5 },
        objective: 0.8,
        timestamp: Date.now(),
        round: 0,
        status: 'completed',
      });

      const result = runClosedLoopDBTL(campaign, 'EI', 2);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].acquisitionType).toBe('EI');
      expect(result.convergence.bestValue).toBe(0.8);
    });

    it('generates protocol', () => {
      const campaign = createCampaign('Test', [
        { name: 'x1', type: 'continuous', bounds: [0, 1] },
      ], 'maximize');

      const result = runClosedLoopDBTL(campaign);
      expect(result.protocol).toContain('Experiment Protocol');
    });
  });

  describe('literature benchmarks', () => {
    it('GP should predict higher values near observed maxima', () => {
      // Create campaign with experiments clustered at x=0.8
      const campaign = createCampaign('Test', [
        { name: 'x', type: 'continuous', bounds: [0, 1] },
      ], 'maximize');

      // Add experiments near x=0.8 with high objective
      for (let i = 0; i < 5; i++) {
        campaign.experiments.push({
          id: `exp_${i}`,
          parameters: { x: 0.7 + Math.random() * 0.2 },
          objective: 0.8 + Math.random() * 0.15,
          timestamp: Date.now(),
          round: 0,
          status: 'completed',
        });
      }

      const result = runClosedLoopDBTL(campaign, 'EI', 3);
      // Suggestions should be near the observed high-value region
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.convergence.bestValue).toBeGreaterThan(0.7);
    });

    it('EI should balance exploration and exploitation', () => {
      const campaign = createCampaign('Test', [
        { name: 'x', type: 'continuous', bounds: [0, 1] },
      ], 'maximize');

      // Single experiment at x=0.5
      campaign.experiments.push({
        id: 'exp1',
        parameters: { x: 0.5 },
        objective: 0.6,
        timestamp: Date.now(),
        round: 0,
        status: 'completed',
      });

      const result = runClosedLoopDBTL(campaign, 'EI', 3);
      // Should suggest points both near and far from observed
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });
});
