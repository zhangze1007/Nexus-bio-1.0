import { minimizeGenome, simulateSCRaMbLE } from '../src/server/syntheticGenomicsEngine';

describe('syntheticGenomicsEngine', () => {
  const sampleRegions = [
    { id: 'gene1', start: 0, end: 1000, strand: '+' as const, type: 'gene' as const, function: 'hexokinase', essential: true, removable: false },
    { id: 'gene2', start: 1000, end: 2000, strand: '+' as const, type: 'gene' as const, function: 'nonessential', essential: false, removable: true },
    { id: 'reg1', start: 2000, end: 2500, strand: '+' as const, type: 'regulatory' as const, function: 'promoter', essential: false, removable: true },
  ];

  describe('minimizeGenome', () => {
    it('minimizes genome by removing non-essential regions', () => {
      const result = minimizeGenome(sampleRegions, ['gene1']);
      expect(result.removedRegions.length).toBeGreaterThan(0);
      expect(result.minimizedSize).toBeLessThan(result.originalSize);
    });

    it('preserves essential genes', () => {
      const result = minimizeGenome(sampleRegions, ['gene1']);
      expect(result.essentialGenes).toContain('gene1');
      expect(result.removedRegions).not.toContain('gene1');
    });

    it('includes assembly plan', () => {
      const result = minimizeGenome(sampleRegions, ['gene1']);
      expect(result.assemblyPlan.length).toBeGreaterThan(0);
    });

    it('computes safety score', () => {
      const result = minimizeGenome(sampleRegions, ['gene1']);
      expect(result.safetyScore).toBeGreaterThanOrEqual(0);
      expect(result.safetyScore).toBeLessThanOrEqual(1);
    });
  });

  describe('simulateSCRaMbLE', () => {
    it('generates SCRaMbLE events', () => {
      const events = simulateSCRaMbLE(sampleRegions, [500, 1500, 2500], 5);
      expect(events.length).toBe(5);
      expect(['deletion', 'inversion', 'duplication', 'translocation']).toContain(events[0].type);
    });

    it('computes fitness effects', () => {
      const events = simulateSCRaMbLE(sampleRegions, [500, 1500], 3);
      events.forEach(e => {
        expect(e.fitnessEffect).toBeGreaterThanOrEqual(-1);
        expect(e.fitnessEffect).toBeLessThanOrEqual(1);
      });
    });
  });
});
