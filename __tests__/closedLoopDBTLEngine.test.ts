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
});
