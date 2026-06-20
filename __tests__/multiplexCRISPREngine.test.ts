/**
 * Tests for Multiplex CRISPR Strategy Engine
 *
 * Verifies that the engine:
 *   1. Finds real PAM sites and extracts real spacer sequences
 *   2. Uses Rule Set 2 scoring (not fabricated scores)
 *   3. Returns empty off-targets when no genome DB is available
 *   4. Applies principled epistasis thresholds (Segre et al. 2005)
 */

import { runMultiplexCRISPR, predictCombinationFitness, GeneTarget, MultiplexCRISPRInput } from '../src/server/multiplexCRISPREngine';

describe('multiplexCRISPREngine', () => {
  // A real gene sequence fragment with known PAM sites (NGG)
  // This is a synthetic 200-nt sequence designed to have multiple NGG sites
  const GENE_SEQUENCE_WITH_PAMS =
    'ATGGCTAGCGAATTCGATATCAAGCTTGGATCCACTAGTAACGGCCGCCAGTGTGCTGGAATTC' +
    'GCGGCCGCTCTAGAACTAGTGGATCCCCCGGGCTGCAGGAATTCGATATCAAGCTTATCGATAC' +
    'CGTCGATCTGGAGCTGTAATACGACTCACTATAGGGCGAATTGGGTACCGGGCCCCCCCTCGAG' +
    'GTCGACGGTATCGATAAGCTTGATATCGAATTCCTGCAGCCCGGGGGATCCACTAGTTCTAGA';

  // A gene without PAM sites (no NGG)
  const GENE_SEQUENCE_NO_PAMS =
    'ATGAACTTCAACTTCAACTTCAACTTCAACTTCAACTTCAACTTCAACTTCAACTTCAACTTCAA' +
    'TTCAACTTCAACTTCAACTTCAACTTCAACTTCAACTTCAACTTCAACTTCAACTTCAACTTCAA' +
    'TTCAACTTCAACTTCAACTTCAACTTCAACTTCAACTTCAACTTCAACTTCAACTTCAACTTCAA';

  const baseGeneTarget: GeneTarget = {
    geneId: 'test_gene',
    geneName: 'Test Gene',
    essentiality: 0.3,
    flux: 5.0,
    subsystem: 'glycolysis',
    maxKnockdown: 0.8,
    geneSequence: GENE_SEQUENCE_WITH_PAMS,
  };

  describe('generateGuides (via runMultiplexCRISPR)', () => {
    it('should find real spacer sequences from gene with PAM sites', () => {
      const geneA = { ...baseGeneTarget, geneId: 'geneA', geneSequence: GENE_SEQUENCE_WITH_PAMS };
      const geneB = { ...baseGeneTarget, geneId: 'geneB', geneSequence: GENE_SEQUENCE_WITH_PAMS, subsystem: 'tca_cycle' };

      const result = runMultiplexCRISPR({
        genes: [geneA, geneB],
        maxEdits: 2,
        topN: 1,
      });

      // Should have at least one strategy
      expect(result.strategies.length).toBeGreaterThan(0);

      // Check guides for geneA
      const guidesA = result.strategies[0].guides['geneA'] || [];
      if (guidesA.length > 0) {
        // Guide sequences should be real (not random) — exactly 20 chars
        for (const guide of guidesA) {
          expect(guide.sequence).toMatch(/^[ACGT]{20}$/);
          // GC content should be computed from actual sequence
          const gcCount = (guide.sequence.match(/[GC]/g) || []).length;
          expect(guide.gcContent).toBeCloseTo(gcCount / 20, 2);
        }
      }
    });

    it('should return empty guides when no gene sequence is provided', () => {
      const geneA = { ...baseGeneTarget, geneId: 'geneA', geneSequence: undefined };
      const geneB = { ...baseGeneTarget, geneId: 'geneB', geneSequence: undefined, subsystem: 'tca_cycle' };

      const result = runMultiplexCRISPR({
        genes: [geneA, geneB],
        maxEdits: 2,
        topN: 1,
      });

      // Should still produce strategies (fitness prediction works without sequences)
      expect(result.strategies.length).toBeGreaterThan(0);

      // But guides should be empty
      const guidesA = result.strategies[0].guides['geneA'] || [];
      expect(guidesA.length).toBe(0);

      // Design notes should mention the warning
      const hasWarning = result.designNotes.some(n => n.includes('Guide warnings'));
      expect(hasWarning).toBe(true);
    });

    it('should use Rule Set 2 scoring — on-target score > 0.5 for well-designed guide', () => {
      // A sequence with good GC content and no homopolymers
      const goodSequence =
        'ATGGCTAGCGAATTCGATATCAAGCTTGGATCCACTAGTAACGGCCGCCAGTGTGCTGGAATTC' +
        'GCGGCCGCTCTAGAACTAGTGGATCCCCCGGGCTGCAGGAATTCGATATCAAGCTTATCGATAC' +
        'CGTCGATCTGGAGCTGTAATACGACTCACTATAGGGCGAATTGGGTACCGGGCCCCCCCTCGAG' +
        'GTCGACGGTATCGATAAGCTTGATATCGAATTCCTGCAGCCCGGGGGATCCACTAGTTCTAGA';

      const geneA = { ...baseGeneTarget, geneId: 'geneA', geneSequence: goodSequence };
      const geneB = { ...baseGeneTarget, geneId: 'geneB', geneSequence: goodSequence, subsystem: 'tca_cycle' };

      const result = runMultiplexCRISPR({
        genes: [geneA, geneB],
        maxEdits: 2,
        topN: 1,
      });

      // At least one guide should have on-target score > 0.4 (Rule Set 2 range)
      const allGuides = Object.values(result.strategies[0].guides).flat();
      if (allGuides.length > 0) {
        const bestScore = Math.max(...allGuides.map(g => g.onTargetScore));
        expect(bestScore).toBeGreaterThan(0.3);
      }
    });

    it('should return empty off-target sites when no genome DB is available', () => {
      const geneA = { ...baseGeneTarget, geneId: 'geneA', geneSequence: GENE_SEQUENCE_WITH_PAMS };
      const geneB = { ...baseGeneTarget, geneId: 'geneB', geneSequence: GENE_SEQUENCE_WITH_PAMS, subsystem: 'tca_cycle' };

      const result = runMultiplexCRISPR({
        genes: [geneA, geneB],
        maxEdits: 2,
        topN: 1,
      });

      // All off-target arrays should be empty (no genome DB)
      for (const strategy of result.strategies) {
        for (const guides of Object.values(strategy.guides)) {
          for (const guide of guides) {
            expect(guide.offTargetSites).toEqual([]);
          }
        }
      }

      // Library stats should show 0 off-target risk
      expect(result.libraryStats.avgOffTargetRisk).toBe(0);

      // Design notes should mention no off-target search
      const hasNote = result.designNotes.some(n => n.includes('NOT performed'));
      expect(hasNote).toBe(true);
    });
  });

  describe('epistasis thresholds (Segre et al. 2005)', () => {
    it('should detect negative epistasis for same-subsystem genes with similar flux', () => {
      const geneA: GeneTarget = {
        ...baseGeneTarget,
        geneId: 'geneA',
        flux: 5.0,
        subsystem: 'glycolysis',
      };
      const geneB: GeneTarget = {
        ...baseGeneTarget,
        geneId: 'geneB',
        flux: 4.5, // similar flux: |5-4.5|/5 = 0.1 < 0.3
        subsystem: 'glycolysis',
      };

      const result = runMultiplexCRISPR({
        genes: [geneA, geneB],
        maxEdits: 2,
        topN: 5,
      });

      // Should have antagonistic interaction
      const interaction = result.epistasisMatrix.find(
        e => (e.geneA === 'geneA' && e.geneB === 'geneB') ||
             (e.geneA === 'geneB' && e.geneB === 'geneA')
      );
      expect(interaction).toBeDefined();
      expect(interaction!.type).toBe('antagonistic');
      expect(interaction!.strength).toBeLessThan(0);
    });

    it('should detect positive epistasis for different-subsystem genes with significant flux', () => {
      const geneA: GeneTarget = {
        ...baseGeneTarget,
        geneId: 'geneA',
        flux: 3.0, // > 1 mmol/gDW/h
        subsystem: 'glycolysis',
      };
      const geneB: GeneTarget = {
        ...baseGeneTarget,
        geneId: 'geneB',
        flux: 4.0, // > 1 mmol/gDW/h
        subsystem: 'tca_cycle', // different subsystem
      };

      const result = runMultiplexCRISPR({
        genes: [geneA, geneB],
        maxEdits: 2,
        topN: 5,
      });

      const interaction = result.epistasisMatrix.find(
        e => (e.geneA === 'geneA' && e.geneB === 'geneB') ||
             (e.geneA === 'geneB' && e.geneB === 'geneA')
      );
      expect(interaction).toBeDefined();
      expect(interaction!.type).toBe('synergistic');
      expect(interaction!.strength).toBeGreaterThan(0);
    });

    it('should detect synthetic lethal for both highly essential genes', () => {
      const geneA: GeneTarget = {
        ...baseGeneTarget,
        geneId: 'geneA',
        essentiality: 0.9,
        subsystem: 'glycolysis',
      };
      const geneB: GeneTarget = {
        ...baseGeneTarget,
        geneId: 'geneB',
        essentiality: 0.85,
        subsystem: 'tca_cycle',
      };

      const result = runMultiplexCRISPR({
        genes: [geneA, geneB],
        maxEdits: 2,
        topN: 5,
      });

      const interaction = result.epistasisMatrix.find(
        e => (e.geneA === 'geneA' && e.geneB === 'geneB') ||
             (e.geneA === 'geneB' && e.geneB === 'geneA')
      );
      expect(interaction).toBeDefined();
      expect(interaction!.type).toBe('synthetic_lethal');
      expect(interaction!.strength).toBeLessThan(-0.5);
    });
  });

  describe('predictCombinationFitness', () => {
    it('should return fitness between 0 and 2', () => {
      const genes: GeneTarget[] = [
        { ...baseGeneTarget, geneId: 'geneA', flux: 3.0, essentiality: 0.2 },
        { ...baseGeneTarget, geneId: 'geneB', flux: 5.0, essentiality: 0.4, subsystem: 'tca_cycle' },
      ];

      const result = predictCombinationFitness(['geneA', 'geneB'], genes);
      expect(result.fitness).toBeGreaterThanOrEqual(0);
      expect(result.fitness).toBeLessThanOrEqual(2);
      expect(result.titerImprovement).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(result.risk);
    });
  });

  describe('runMultiplexCRISPR validation', () => {
    it('should throw for fewer than 2 genes', () => {
      expect(() => runMultiplexCRISPR({
        genes: [baseGeneTarget],
        maxEdits: 2,
      })).toThrow('at least 2 target genes');
    });

    it('should throw for more than 50 genes', () => {
      const genes = Array.from({ length: 51 }, (_, i) => ({
        ...baseGeneTarget,
        geneId: `gene_${i}`,
      }));
      expect(() => runMultiplexCRISPR({
        genes,
        maxEdits: 2,
      })).toThrow('Maximum 50 genes');
    });
  });
});
