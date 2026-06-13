import {
  calculateRBSStrength,
  RBSConfig,
  RBSResult,
} from '../../src/server/rbsCalculator';

describe('RBS strength calculator (Salis et al. 2009)', () => {
  describe('basic functionality', () => {
    it('calculates RBS strength for a strong SD sequence', () => {
      const result = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGATATACAT',
        cdsSequence: 'ATGAAATTTGGCCCG',
        organism: 'ecoli',
      });
      expect(result.translationRate).toBeGreaterThan(0);
      expect(result.sdStrength).toBeDefined();
      expect(result.spacing).toBeDefined();
      expect(result.deltaG_total).toBeDefined();
      expect(result.deltaG_mRNA_rRNA).toBeDefined();
      expect(result.deltaG_spacing).toBeDefined();
      expect(result.deltaG_startCodon).toBeDefined();
    });

    it('returns numeric values for all fields', () => {
      const result = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGATATACAT',
        cdsSequence: 'ATGAAATTT',
        organism: 'ecoli',
      });
      expect(typeof result.translationRate).toBe('number');
      expect(typeof result.sdStrength).toBe('number');
      expect(typeof result.spacing).toBe('number');
      expect(typeof result.deltaG_total).toBe('number');
      expect(typeof result.deltaG_mRNA_rRNA).toBe('number');
      expect(typeof result.deltaG_spacing).toBe('number');
      expect(typeof result.deltaG_startCodon).toBe('number');
    });
  });

  describe('SD sequence strength', () => {
    it('predicts weak RBS for poor SD match vs strong SD match', () => {
      const weak = calculateRBSStrength({
        rbsSequence: 'AATTCGCGATATACAT',
        cdsSequence: 'ATGAAATTT',
        organism: 'ecoli',
      });
      const strong = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGATATACAT',
        cdsSequence: 'ATGAAATTT',
        organism: 'ecoli',
      });
      expect(weak.translationRate).toBeLessThan(strong.translationRate);
    });

    it('gives more negative ΔG_mRNA_rRNA for longer SD matches', () => {
      // Full 6-nt SD: AGGAGG directly in the RBS
      const fullSD = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGATATACAT',
        cdsSequence: 'ATGAAATTT',
        organism: 'ecoli',
      });
      // Partial 3-nt SD: only AGG in the RBS
      const partialSD = calculateRBSStrength({
        rbsSequence: 'AAGAAAGGATATACAT',
        cdsSequence: 'ATGAAATTT',
        organism: 'ecoli',
      });
      // Full SD should have more negative (stronger) mRNA-rRNA energy
      expect(fullSD.deltaG_mRNA_rRNA).toBeLessThan(partialSD.deltaG_mRNA_rRNA);
    });
  });

  describe('spacing penalty', () => {
    it('penalizes suboptimal spacing', () => {
      // Optimal spacing (5 nt)
      const optimal = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGAAAAA',  // SD ends, then 5 nt, then cds
        cdsSequence: 'ATGAAATTT',
        organism: 'ecoli',
      });
      // Too close (1 nt spacing)
      const tooClose = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGA',  // SD ends, then 1 nt, then cds
        cdsSequence: 'ATGAAATTT',
        organism: 'ecoli',
      });
      // Too far (15 nt spacing)
      const tooFar = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGAAAAAAAAAAAA',  // SD ends, then 15 nt, then cds
        cdsSequence: 'ATGAAATTT',
        organism: 'ecoli',
      });

      // Optimal spacing should give lower (better) ΔG_spacing
      expect(optimal.deltaG_spacing).toBeLessThanOrEqual(tooClose.deltaG_spacing);
      expect(optimal.deltaG_spacing).toBeLessThanOrEqual(tooFar.deltaG_spacing);
    });

    it('ΔG_spacing is zero at optimal spacing', () => {
      const result = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGAAAAA',
        cdsSequence: 'ATGAAATTT',
        organism: 'ecoli',
      });
      // Spacing should be 5 (optimal), so penalty should be 0
      expect(result.deltaG_spacing).toBeCloseTo(0, 5);
    });
  });

  describe('start codon energy', () => {
    it('gives most favorable energy for AUG start codon', () => {
      const aug = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGATATACAT',
        cdsSequence: 'ATGAAATTT',
        organism: 'ecoli',
      });
      const gug = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGATATACAT',
        cdsSequence: 'GTGAAATTT',
        organism: 'ecoli',
      });
      const uug = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGATATACAT',
        cdsSequence: 'TTGAAATTT',
        organism: 'ecoli',
      });

      // AUG should have the most negative (best) start codon energy
      expect(aug.deltaG_startCodon).toBeLessThan(gug.deltaG_startCodon);
      expect(gug.deltaG_startCodon).toBeLessThan(uug.deltaG_startCodon);
    });

    it('AUG gives -1.194 kcal/mol start codon energy', () => {
      const result = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGATATACAT',
        cdsSequence: 'ATGAAATTT',
        organism: 'ecoli',
      });
      expect(result.deltaG_startCodon).toBeCloseTo(-1.194, 3);
    });

    it('GUG gives +0.016 kcal/mol start codon energy', () => {
      const result = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGATATACAT',
        cdsSequence: 'GTGAAATTT',
        organism: 'ecoli',
      });
      expect(result.deltaG_startCodon).toBeCloseTo(0.016, 3);
    });

    it('UUG/TTG gives +0.767 kcal/mol start codon energy', () => {
      const result = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGATATACAT',
        cdsSequence: 'TTGAAATTT',
        organism: 'ecoli',
      });
      expect(result.deltaG_startCodon).toBeCloseTo(0.767, 3);
    });
  });

  describe('total energy and translation rate', () => {
    it('ΔG_total equals sum of components', () => {
      const result = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGATATACAT',
        cdsSequence: 'ATGAAATTT',
        organism: 'ecoli',
      });
      const sum = result.deltaG_mRNA_rRNA + result.deltaG_spacing + result.deltaG_startCodon;
      expect(result.deltaG_total).toBeCloseTo(sum, 10);
    });

    it('translation rate follows Boltzmann relation', () => {
      const result = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGATATACAT',
        cdsSequence: 'ATGAAATTT',
        organism: 'ecoli',
      });
      const RT = 1.987e-3 * 310.15;
      const expected = Math.exp(-result.deltaG_total / RT);
      expect(result.translationRate).toBeCloseTo(expected, 8);
    });

    it('stronger RBS gives higher translation rate', () => {
      const strong = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGAAAAA', // optimal spacing, full SD
        cdsSequence: 'ATGAAATTT',
        organism: 'ecoli',
      });
      const weak = calculateRBSStrength({
        rbsSequence: 'AACGCGCCAAAAA',  // no SD match, optimal spacing
        cdsSequence: 'ATGAAATTT',
        organism: 'ecoli',
      });
      expect(strong.translationRate).toBeGreaterThan(weak.translationRate);
    });
  });

  describe('organism support', () => {
    it('accepts ecoli organism', () => {
      expect(() =>
        calculateRBSStrength({
          rbsSequence: 'AAGAAGGAGATATACAT',
          cdsSequence: 'ATGAAATTT',
          organism: 'ecoli',
        }),
      ).not.toThrow();
    });

    it('accepts scerevisiae organism', () => {
      expect(() =>
        calculateRBSStrength({
          rbsSequence: 'AAGAAGGAGATATACAT',
          cdsSequence: 'ATGAAATTT',
          organism: 'scerevisiae',
        }),
      ).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('handles very short RBS sequence with no SD match', () => {
      const result = calculateRBSStrength({
        rbsSequence: 'AAAA',
        cdsSequence: 'ATGAAATTT',
        organism: 'ecoli',
      });
      expect(result.translationRate).toBeGreaterThan(0);
      expect(result.sdStrength).toBe(0); // no match
    });

    it('handles CDS starting with lowercase atg', () => {
      const result = calculateRBSStrength({
        rbsSequence: 'AAGAAGGAGATATACAT',
        cdsSequence: 'atgaaattt',
        organism: 'ecoli',
      });
      expect(result.deltaG_startCodon).toBeCloseTo(-1.194, 3);
    });

    it('handles RBS sequence with mixed case', () => {
      const result = calculateRBSStrength({
        rbsSequence: 'AAGaaGGAGATATACAT',
        cdsSequence: 'ATGAAATTT',
        organism: 'ecoli',
      });
      expect(result.translationRate).toBeGreaterThan(0);
    });
  });
});
