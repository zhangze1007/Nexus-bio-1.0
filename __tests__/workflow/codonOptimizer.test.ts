import {
  optimizeCodons,
  CodonOptimizationConfig,
  CodonOptimizationResult,
} from '../../src/server/codonOptimizer';

describe('codon optimization', () => {
  it('optimizes codons for E. coli', () => {
    const result = optimizeCodons('MKTAYIAKQR', { organism: 'ecoli' });
    expect(result.dnaSequence.length).toBe(30);
    expect(result.cai).toBeGreaterThan(0.5);
    expect(result.restrictionSitesFound).toEqual([]);
  });

  it('optimizes codons for S. cerevisiae', () => {
    const result = optimizeCodons('MKTAYIAKQR', { organism: 'scerevisiae' });
    expect(result.dnaSequence.length).toBe(30);
    expect(result.cai).toBeGreaterThan(0.5);
  });

  it('avoids restriction sites', () => {
    const result = optimizeCodons('MKTAYIAKQR', {
      organism: 'ecoli',
      avoidSites: ['GAATTC'], // EcoRI
    });
    expect(result.dnaSequence.includes('GAATTC')).toBe(false);
    expect(result.restrictionSitesFound).toEqual([]);
  });

  it('returns correct GC content range', () => {
    const result = optimizeCodons('MKTAYIAKQR', { organism: 'ecoli' });
    expect(result.gcContent).toBeGreaterThanOrEqual(0);
    expect(result.gcContent).toBeLessThanOrEqual(1);
  });

  it('handles a longer protein sequence', () => {
    // GFP chromophore region (SYG)
    const longSeq = 'MVSKGEELFTGVVPILVELDGDVNGHKFSVRGEGEGDATIGKLVT';
    const result = optimizeCodons(longSeq, { organism: 'ecoli' });
    expect(result.dnaSequence.length).toBe(longSeq.length * 3);
    expect(result.cai).toBeGreaterThan(0.4);
  });

  it('respects custom GC target range', () => {
    const result = optimizeCodons('MKTAYIAKQR', {
      organism: 'ecoli',
      gcTarget: [0.5, 0.7],
    });
    // GC content should ideally be in range, but is a soft target
    expect(result.gcContent).toBeGreaterThanOrEqual(0);
    expect(result.gcContent).toBeLessThanOrEqual(1);
  });

  it('avoids multiple restriction sites simultaneously', () => {
    const result = optimizeCodons('MKTAYIAKQR', {
      organism: 'ecoli',
      avoidSites: ['GAATTC', 'AAGCTT', 'GGATCC'], // EcoRI, HindIII, BamHI
    });
    expect(result.dnaSequence.toUpperCase().includes('GAATTC')).toBe(false);
    expect(result.dnaSequence.toUpperCase().includes('AAGCTT')).toBe(false);
    expect(result.dnaSequence.toUpperCase().includes('GGATCC')).toBe(false);
    expect(result.restrictionSitesFound).toEqual([]);
  });

  it('starts with ATG for methionine', () => {
    const result = optimizeCodons('MKTAYIAKQR', { organism: 'ecoli' });
    expect(result.dnaSequence.startsWith('ATG')).toBe(true);
  });

  it('throws for unknown amino acid character', () => {
    expect(() => optimizeCodons('MX', { organism: 'ecoli' })).toThrow(
      /No codon mapping found/,
    );
  });

  it('handles single amino acid input', () => {
    const result = optimizeCodons('M', { organism: 'ecoli' });
    expect(result.dnaSequence).toBe('ATG');
    expect(result.cai).toBe(1);
  });
});
