import { biggToFBAFormat, clearCache } from '../src/services/fba/biggLoader';

describe('BiGG Loader', () => {
  afterEach(() => {
    clearCache();
  });

  describe('biggToFBAFormat', () => {
    it('should convert BiGG model to FBA format', () => {
      const model = {
        id: 'iJO1366',
        name: 'E. coli iJO1366',
        reactions: [
          {
            id: 'PFK',
            name: 'Phosphofructokinase',
            stoichiometry: { atp_c: -1, f6p_c: -1, adp_c: 1, fdp_c: 1 },
            lowerBound: 0,
            upperBound: 1000,
            subsystem: 'Glycolysis',
          },
          {
            id: 'GAPD',
            name: 'Glyceraldehyde-3-phosphate dehydrogenase',
            stoichiometry: { g3p_c: -1, nad_c: -1, pi_c: -1, '13dpg_c': 1, nadh_c: 1 },
            lowerBound: 0,
            upperBound: 1000,
            subsystem: 'Glycolysis',
          },
        ],
        metabolites: ['atp_c', 'f6p_c', 'adp_c', 'fdp_c', 'g3p_c', 'nad_c', 'pi_c', '13dpg_c', 'nadh_c'],
        geneCount: 1366,
      };

      const result = biggToFBAFormat(model);

      expect(result.reactions).toHaveLength(2);
      expect(result.reactions[0].id).toBe('PFK');
      expect(result.reactions[0].stoichiometry.atp_c).toBe(-1);
      expect(result.reactions[0].lowerBound).toBe(0);
      expect(result.metabolites).toContain('atp_c');
    });

    it('should handle empty model', () => {
      const model = {
        id: 'empty',
        name: 'Empty Model',
        reactions: [],
        metabolites: [],
        geneCount: 0,
      };

      const result = biggToFBAFormat(model);
      expect(result.reactions).toHaveLength(0);
      expect(result.metabolites).toHaveLength(0);
    });

    it('should preserve stoichiometry coefficients', () => {
      const model = {
        id: 'test',
        name: 'Test',
        reactions: [{
          id: 'R1',
          name: 'R1',
          stoichiometry: { A: -2, B: -3, C: 1 },
          lowerBound: -10,
          upperBound: 100,
        }],
        metabolites: ['A', 'B', 'C'],
        geneCount: 0,
      };

      const result = biggToFBAFormat(model);
      expect(result.reactions[0].stoichiometry.A).toBe(-2);
      expect(result.reactions[0].stoichiometry.B).toBe(-3);
      expect(result.reactions[0].stoichiometry.C).toBe(1);
      expect(result.reactions[0].lowerBound).toBe(-10);
      expect(result.reactions[0].upperBound).toBe(100);
    });
  });
});
