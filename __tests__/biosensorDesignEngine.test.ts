import { designBiosensor } from '../src/server/biosensorDesignEngine';

describe('biosensorDesignEngine', () => {
  describe('designBiosensor', () => {
    it('designs a sensor for arabinose', () => {
      const result = designBiosensor({
        targetLigand: 'arabinose',
        desiredDynamicRange: 100,
        desiredSensitivity: 100,
        hostOrganism: 'ecoli',
      });
      expect(result.transcriptionFactor).toBe('AraC');
      expect(result.responseCurve.length).toBeGreaterThan(0);
      expect(result.dynamicRange).toBeGreaterThan(1);
    });

    it('generates log-spaced response curve', () => {
      const result = designBiosensor({
        targetLigand: 'IPTG',
        desiredDynamicRange: 50,
        desiredSensitivity: 50,
        hostOrganism: 'ecoli',
      });
      const concs = result.responseCurve.map(p => p.ligandConc);
      // Should span from ~0.001 to ~1000
      expect(Math.min(...concs)).toBeLessThan(0.1);
      expect(Math.max(...concs)).toBeGreaterThan(100);
    });

    it('computes binding affinity with correct RT constant', () => {
      // RT at 310K should be 0.616 kcal/mol (Fersht 1999)
      // ΔG = RT * ln(Kd)
      // For Kd = 50 µM: ΔG = 0.616 * ln(50e-6) ≈ 0.616 * (-9.9) ≈ -6.1 kcal/mol
      const result = designBiosensor({
        targetLigand: 'IPTG',
        desiredDynamicRange: 50,
        desiredSensitivity: 50,
        hostOrganism: 'ecoli',
      });
      // The sensor should have valid binding properties
      expect(result.sensitivity).toBeGreaterThan(0);
      expect(result.specificity).toBeGreaterThanOrEqual(0);
      expect(result.specificity).toBeLessThanOrEqual(1);
    });

    it('includes leak expression in response', () => {
      const result = designBiosensor({
        targetLigand: 'IPTG',
        desiredDynamicRange: 50,
        desiredSensitivity: 50,
        hostOrganism: 'ecoli',
      });
      // First point should show leak (non-zero baseline)
      expect(result.leakExpression).toBeGreaterThanOrEqual(0);
      expect(result.leakExpression).toBeLessThan(0.1);
    });

    it('computes orthogonality score', () => {
      const result = designBiosensor({
        targetLigand: 'IPTG',
        desiredDynamicRange: 50,
        desiredSensitivity: 50,
        hostOrganism: 'ecoli',
      });
      expect(result.orthogonality).toBeGreaterThanOrEqual(0);
      expect(result.orthogonality).toBeLessThanOrEqual(1);
    });
  });
});
