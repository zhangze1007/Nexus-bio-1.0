import { runInverseFolding } from '../src/server/inverseFoldingEngine';

describe('inverseFoldingEngine — literature benchmarks', () => {
  // Generate a simple helical backbone for testing
  const helixBackbone = Array.from({ length: 30 }, (_, i) => ({
    residueIndex: i,
    residueName: 'ALA',
    x: 10 * Math.cos(i * 100 * Math.PI / 180),
    y: 10 * Math.sin(i * 100 * Math.PI / 180),
    z: i * 1.5,
  }));

  describe('structural graph construction', () => {
    it('builds k-NN graph with correct node count', () => {
      const result = runInverseFolding({ backbone: helixBackbone, nSequences: 1 });
      expect(result.graph.nodes.length).toBe(30);
    });

    it('each node has neighbors', () => {
      const result = runInverseFolding({ backbone: helixBackbone, nSequences: 1 });
      for (const node of result.graph.nodes) {
        expect(node.neighbors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('sequence design', () => {
    it('generates valid amino acid sequences', () => {
      const result = runInverseFolding({ backbone: helixBackbone, nSequences: 3 });
      expect(result.sequences.length).toBe(3);
      for (const seq of result.sequences) {
        expect(seq.sequence.length).toBe(30);
        expect(seq.sequence).toMatch(/^[ACDEFGHIKLMNPQRSTVWY]+$/);
      }
    });

    it('sequences have non-zero scores', () => {
      const result = runInverseFolding({ backbone: helixBackbone, nSequences: 3 });
      for (const seq of result.sequences) {
        expect(seq.score).toBeGreaterThan(0);
        expect(seq.score).toBeLessThanOrEqual(1);
      }
    });

    it('sequences have packing quality metrics', () => {
      const result = runInverseFolding({ backbone: helixBackbone, nSequences: 1 });
      const seq = result.sequences[0];
      expect(seq.metrics.packingQuality).toBeGreaterThanOrEqual(0);
      expect(seq.metrics.secondaryStructureMatch).toBeGreaterThanOrEqual(0);
      expect(seq.metrics.hydrophobicCoreIntegrity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('structural motifs', () => {
    it('detects helix motif in helical backbone', () => {
      const result = runInverseFolding({ backbone: helixBackbone, nSequences: 1 });
      // Helical backbone should produce helix motifs
      expect(result.structuralMotifs.length).toBeGreaterThan(0);
    });
  });

  describe('conservation analysis', () => {
    it('computes per-position entropy', () => {
      const result = runInverseFolding({ backbone: helixBackbone, nSequences: 5 });
      expect(result.conservationEntropy.length).toBe(30);
      for (const e of result.conservationEntropy) {
        expect(e).toBeGreaterThanOrEqual(0);
        expect(e).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('ESM-2 integration', () => {
    it('useESM2 flag is accepted', () => {
      // Test that the flag is accepted (may fall back to local if API unavailable)
      const result = runInverseFolding({ backbone: helixBackbone, nSequences: 1, useESM2: true });
      expect(result.sequences.length).toBeGreaterThan(0);
    });
  });
});
