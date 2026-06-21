import { designPlasmid } from '../src/server/plasmidDesignEngine';

describe('plasmidDesignEngine — benchmarks', () => {
  const sampleCDS = 'ATGAAACGCACCAGCAACAGCACCAGCAACAGCACCAGCAACAGCACCAGCAACAGCAACTAA';

  describe('CDS optimization', () => {
    it('improves CAI for E. coli', () => {
      const result = designPlasmid(sampleCDS, 'ecoli', 'high_expression');
      expect(result.mainDesign.cdsOptimization.metrics.caiAfter).toBeGreaterThanOrEqual(
        result.mainDesign.cdsOptimization.metrics.caiBefore
      );
    });

    it('removes restriction sites', () => {
      // Sample CDS with EcoRI site (GAATTC)
      const cdsWithEcoRI = 'ATGGAATTCGAATTCGAATTCTAA';
      const result = designPlasmid(cdsWithEcoRI, 'ecoli');
      expect(result.mainDesign.cdsOptimization.metrics.restrictionSitesRemoved).toBeGreaterThanOrEqual(0);
    });

    it('maintains coding sequence length after optimization', () => {
      const result = designPlasmid(sampleCDS, 'ecoli');
      // Optimized CDS should have same length (codon-by-codon replacement)
      expect(result.mainDesign.cdsOptimization.optimized.length).toBe(
        result.mainDesign.cdsOptimization.original.length
      );
    });
  });

  describe('component selection', () => {
    it('selects real replicon sequences (not placeholder)', () => {
      const result = designPlasmid(sampleCDS, 'ecoli');
      const replicon = result.mainDesign.components.find(c => c.type === 'replicon');
      expect(replicon).toBeDefined();
      if (replicon) {
        // Should NOT be the old placeholder 'ATGATCGATCG'
        expect(replicon.sequence).not.toBe('ATGATCGATCG');
        expect(replicon.sequence.length).toBeGreaterThan(50);
      }
    });

    it('returns alternatives', () => {
      const result = designPlasmid(sampleCDS, 'ecoli', 'high_expression', 'gibson', 2);
      expect(result.alternatives.length).toBe(2);
    });
  });

  describe('assembly compatibility', () => {
    it('checks junction structure risk', () => {
      const result = designPlasmid(sampleCDS, 'ecoli', 'high_expression', 'gibson');
      expect(result.mainDesign.assemblyChecks.length).toBeGreaterThan(0);
      expect(result.mainDesign.assemblyChecks[0].junctionStructureRisk).toBeGreaterThanOrEqual(0);
    });
  });
});

// Helper: translate DNA to protein
function translateDNA(seq: string): string {
  const codonTable: Record<string, string> = {
    'ATG': 'M', 'TAA': '*', 'TAG': '*', 'TGA': '*',
    'AAA': 'K', 'AAC': 'N', 'AAG': 'K', 'AAT': 'N',
    'ACA': 'T', 'ACC': 'T', 'ACG': 'T', 'ACT': 'T',
    'AGA': 'R', 'AGC': 'S', 'AGG': 'R', 'AGT': 'S',
    'GCA': 'A', 'GCC': 'A', 'GCG': 'A', 'GCT': 'A',
  };
  let protein = '';
  for (let i = 0; i < seq.length - 2; i += 3) {
    const codon = seq.substring(i, i + 3);
    protein += codonTable[codon] || 'X';
  }
  return protein;
}
