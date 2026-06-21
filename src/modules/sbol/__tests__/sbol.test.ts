/**
 * SBOL Module Tests
 */

import { toSBOL3, exportSBOL3JSON } from '../types';

describe('sbol', () => {
  describe('toSBOL3', () => {
    it('converts a construct to SBOL3 design', () => {
      const design = toSBOL3({
        name: 'test_construct',
        promoter: 'TTGACATATACATTAAGAATTCGATATCAATGACA',
        rbs: 'AAGAAGGAGATATACAT',
        cds: 'ATGAAACGCACCAGCAACAGCAACTAA',
        terminator: 'GCAAAAAACCCCTCAAGACCCGTTTAGAG',
        host: 'ecoli',
      });
      expect(design.name).toBe('test_construct');
      expect(design.components.length).toBe(4);
      expect(design.components[0].role).toBe('promoter');
      expect(design.components[1].role).toBe('ribosome_binding_site');
      expect(design.components[2].role).toBe('coding_sequence');
      expect(design.components[3].role).toBe('terminator');
    });

    it('includes sequence data', () => {
      const design = toSBOL3({
        name: 'test',
        promoter: 'ATCG',
        rbs: 'AAGG',
        cds: 'ATGAAATGA',
        terminator: 'TTTT',
        host: 'ecoli',
      });
      expect(design.components[0].sequence).toBeDefined();
      expect(design.components[0].sequence?.elements).toBe('ATCG');
      expect(design.components[0].sequence?.type).toBe('DNA');
    });
  });

  describe('exportSBOL3JSON', () => {
    it('exports valid JSON-LD', () => {
      const design = toSBOL3({
        name: 'test',
        promoter: 'ATCG',
        rbs: 'AAGG',
        cds: 'ATGAAATGA',
        terminator: 'TTTT',
        host: 'ecoli',
      });
      const json = exportSBOL3JSON(design);
      const parsed = JSON.parse(json);
      expect(parsed['@context']).toContain('sbolstandard');
      expect(parsed.type).toBe('Design');
      expect(parsed.components.length).toBe(4);
    });
  });
});
