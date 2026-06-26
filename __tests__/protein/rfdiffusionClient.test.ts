import {
  designProtein,
  generateUnconditionalDesign,
  generateScaffoldedDesign,
  generateBinderDesign,
  validateDesignRequest,
} from '../../src/services/protein/rfdiffusionClient';
import type { RFdiffusionRequest, RFdiffusionResult } from '../../src/services/protein/rfdiffusionClient';

describe('rfdiffusionClient', () => {
  describe('designProtein', () => {
    it('generates PDB structures for unconditional design', async () => {
      const request: RFdiffusionRequest = {
        targetLength: 50,
        designType: 'unconditional',
        numDesigns: 1,
      };
      const result = await designProtein(request);
      expect(result.pdbs).toHaveLength(1);
      expect(result.pdbs[0]).toContain('ATOM');
      expect(result.scores).toHaveLength(1);
    });

    it('generates multiple designs when numDesigns > 1', async () => {
      const request: RFdiffusionRequest = {
        targetLength: 30,
        designType: 'unconditional',
        numDesigns: 3,
      };
      const result = await designProtein(request);
      expect(result.pdbs).toHaveLength(3);
      expect(result.scores).toHaveLength(3);
    });

    it('returns metadata with model name and timestamp', async () => {
      const request: RFdiffusionRequest = {
        targetLength: 40,
        designType: 'unconditional',
      };
      const result = await designProtein(request);
      expect(result.metadata.model).toBe('rfdiffusion-heuristic-v1');
      expect(result.metadata.targetLength).toBe(40);
      expect(result.metadata.designType).toBe('unconditional');
      expect(result.metadata.timestamp).toBeDefined();
      // Verify timestamp is valid ISO date
      expect(new Date(result.metadata.timestamp).toISOString()).toBe(result.metadata.timestamp);
    });

    it('generates PDB with correct number of ATOM records for target length', async () => {
      const request: RFdiffusionRequest = {
        targetLength: 25,
        designType: 'unconditional',
        numDesigns: 1,
      };
      const result = await designProtein(request);
      const atomLines = result.pdbs[0].split('\n').filter((l) => l.startsWith('ATOM'));
      // 4 atoms per residue (N, CA, C, O)
      expect(atomLines).toHaveLength(25 * 4);
    });

    it('handles scaffolded design with partial structure', async () => {
      const request: RFdiffusionRequest = {
        targetLength: 60,
        designType: 'scaffolded',
        partialStructure: 'ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00  0.00           N\nATOM      2  CA  ALA A   1       1.470   0.000   0.000  1.00  0.00           C\nATOM      3  C   ALA A   1       2.000   1.430   0.000  1.00  0.00           C\nATOM      4  O   ALA A   1       1.250   2.400   0.000  1.00  0.00           O',
        numDesigns: 1,
      };
      const result = await designProtein(request);
      expect(result.pdbs).toHaveLength(1);
      expect(result.pdbs[0]).toContain('ATOM');
      expect(result.metadata.designType).toBe('scaffolded');
    });

    it('handles binder design with hotspots', async () => {
      const request: RFdiffusionRequest = {
        targetLength: 80,
        designType: 'binder',
        hotspots: ['ALA12A', 'LEU45A'],
        numDesigns: 1,
      };
      const result = await designProtein(request);
      expect(result.pdbs).toHaveLength(1);
      expect(result.metadata.designType).toBe('binder');
    });

    it('defaults numDesigns to 1 when not specified', async () => {
      const request: RFdiffusionRequest = {
        targetLength: 30,
        designType: 'unconditional',
      };
      const result = await designProtein(request);
      expect(result.pdbs).toHaveLength(1);
      expect(result.scores).toHaveLength(1);
    });

    it('scores are between 0 and 1', async () => {
      const request: RFdiffusionRequest = {
        targetLength: 40,
        designType: 'unconditional',
        numDesigns: 5,
      };
      const result = await designProtein(request);
      result.scores.forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it('generates valid PDB format in all outputs', async () => {
      const request: RFdiffusionRequest = {
        targetLength: 20,
        designType: 'unconditional',
        numDesigns: 2,
      };
      const result = await designProtein(request);
      result.pdbs.forEach((pdb) => {
        expect(pdb).toContain('ATOM');
        expect(pdb).toContain('TER');
        expect(pdb).toContain('END');
        // Verify ATOM lines have correct format
        const atomLines = pdb.split('\n').filter((l) => l.startsWith('ATOM'));
        atomLines.forEach((line) => {
          expect(line.substring(0, 6).trim()).toBe('ATOM');
          const atomName = line.substring(12, 16).trim();
          expect(['N', 'CA', 'C', 'O']).toContain(atomName);
        });
      });
    });
  });

  describe('generateUnconditionalDesign', () => {
    it('generates a single design with default params', async () => {
      const result = await generateUnconditionalDesign(50);
      expect(result.pdbs).toHaveLength(1);
      expect(result.metadata.designType).toBe('unconditional');
      expect(result.metadata.targetLength).toBe(50);
    });

    it('respects numDesigns parameter', async () => {
      const result = await generateUnconditionalDesign(30, 3);
      expect(result.pdbs).toHaveLength(3);
    });
  });

  describe('generateScaffoldedDesign', () => {
    it('generates scaffolded design from partial PDB', async () => {
      const partialPDB = 'ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00  0.00           N';
      const result = await generateScaffoldedDesign(40, partialPDB);
      expect(result.pdbs).toHaveLength(1);
      expect(result.metadata.designType).toBe('scaffolded');
    });
  });

  describe('generateBinderDesign', () => {
    it('generates binder design with hotspots', async () => {
      const result = await generateBinderDesign(60, ['ALA12A']);
      expect(result.pdbs).toHaveLength(1);
      expect(result.metadata.designType).toBe('binder');
    });
  });

  describe('validateDesignRequest', () => {
    it('returns valid for correct request', () => {
      const request: RFdiffusionRequest = {
        targetLength: 50,
        designType: 'unconditional',
      };
      const result = validateDesignRequest(request);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects targetLength < 10', () => {
      const request: RFdiffusionRequest = {
        targetLength: 5,
        designType: 'unconditional',
      };
      const result = validateDesignRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects targetLength > 1000', () => {
      const request: RFdiffusionRequest = {
        targetLength: 1500,
        designType: 'unconditional',
      };
      const result = validateDesignRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects invalid designType', () => {
      const request = {
        targetLength: 50,
        designType: 'invalid',
      } as unknown as RFdiffusionRequest;
      const result = validateDesignRequest(request);
      expect(result.valid).toBe(false);
    });

    it('rejects numDesigns < 1', () => {
      const request: RFdiffusionRequest = {
        targetLength: 50,
        designType: 'unconditional',
        numDesigns: 0,
      };
      const result = validateDesignRequest(request);
      expect(result.valid).toBe(false);
    });

    it('rejects numDesigns > 10', () => {
      const request: RFdiffusionRequest = {
        targetLength: 50,
        designType: 'unconditional',
        numDesigns: 15,
      };
      const result = validateDesignRequest(request);
      expect(result.valid).toBe(false);
    });

    it('rejects binder design without hotspots', () => {
      const request: RFdiffusionRequest = {
        targetLength: 50,
        designType: 'binder',
      };
      const result = validateDesignRequest(request);
      expect(result.valid).toBe(false);
    });

    it('accepts binder design with hotspots', () => {
      const request: RFdiffusionRequest = {
        targetLength: 50,
        designType: 'binder',
        hotspots: ['ALA12A'],
      };
      const result = validateDesignRequest(request);
      expect(result.valid).toBe(true);
    });
  });
});
