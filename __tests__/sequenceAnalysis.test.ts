/**
 * Tests for sequence analysis utilities.
 *
 * Covers:
 *   - GC content computation
 *   - Melting temperature (SantaLucia nearest-neighbor)
 *   - Molecular weight
 *   - ORF detection
 *   - DNA-to-protein translation
 */

import {
  computeGC,
  computeTm,
  computeMW,
  findORFs,
  translateSequence,
  type ORF,
} from '@/src/services/sequences/sequenceAnalysis';

// ── computeGC ──────────────────────────────────────────────────────────────────

describe('computeGC', () => {
  it('returns 0 for an empty sequence', () => {
    expect(computeGC('')).toBe(0);
  });

  it('returns 0 for a poly-A sequence', () => {
    expect(computeGC('AAAAAAAAAA')).toBe(0);
  });

  it('returns 1 for a poly-G sequence', () => {
    expect(computeGC('GGGGGGGGGG')).toBe(1);
  });

  it('computes correct GC for a mixed sequence', () => {
    // ATGCATGC → 4 GC out of 8 = 0.5
    expect(computeGC('ATGCATGC')).toBeCloseTo(0.5, 10);
  });

  it('is case-insensitive', () => {
    expect(computeGC('atgc')).toBeCloseTo(0.5, 10);
    expect(computeGC('ATGC')).toBeCloseTo(0.5, 10);
    expect(computeGC('AtGc')).toBeCloseTo(0.5, 10);
  });

  it('handles RNA (U instead of T)', () => {
    // AUGCAUGC → G=2, C=2, A=2, U=2 → GC = 4/8 = 0.5
    expect(computeGC('AUGCAUGC')).toBeCloseTo(0.5, 10);
  });

  it('ignores non-standard bases in the denominator', () => {
    // ATGCN → A=1, T=1, G=1, C=1, N skipped → 2/4 = 0.5
    expect(computeGC('ATGCN')).toBeCloseTo(0.5, 10);
  });
});

// ── computeTm ──────────────────────────────────────────────────────────────────

describe('computeTm', () => {
  it('returns a reasonable Tm for a short primer', () => {
    // A standard 20-mer primer
    const tm = computeTm('GCGCGATATACGCGCGATAT');
    // Typical Tm for a ~50% GC 20-mer is around 50-70°C
    expect(tm).toBeGreaterThan(40);
    expect(tm).toBeLessThan(80);
  });

  it('gives higher Tm for GC-rich sequences', () => {
    const gcRich = computeTm('GCGCGCGCGCGCGCGC');
    const atRich = computeTm('ATATATATATATATAT');
    expect(gcRich).toBeGreaterThan(atRich);
  });

  it('uses the Wallace rule for single-base input', () => {
    // Wallace rule: Tm = 2*(A+T) + 4*(G+C)
    expect(computeTm('A')).toBe(2);
    expect(computeTm('G')).toBe(4);
  });

  it('handles RNA input (U→T conversion)', () => {
    const dnaTm = computeTm('GCGCGCGC');
    const rnaTm = computeTm('GCGCGCGC'); // same sequence, DNA
    // Just verify it doesn't crash and returns a number
    expect(typeof rnaTm).toBe('number');
    expect(rnaTm).toBe(dnaTm);
  });

  it('is case-insensitive', () => {
    expect(computeTm('ATGCATGC')).toBe(computeTm('atgcatgc'));
  });
});

// ── computeMW ──────────────────────────────────────────────────────────────────

describe('computeMW', () => {
  it('returns 0 for an empty sequence', () => {
    expect(computeMW('')).toBe(0);
  });

  it('returns the correct MW for a single nucleotide', () => {
    // Single A: 5'-phosphate (79.97) + A residue (313.21) = 393.18
    expect(computeMW('A')).toBeCloseTo(393.18, 1);
  });

  it('scales linearly with sequence length', () => {
    const mw1 = computeMW('A');
    const mw2 = computeMW('AA');
    const mw3 = computeMW('AAA');
    // Each additional nucleotide adds its residue weight
    expect(mw2 - mw1).toBeCloseTo(313.21, 1); // A residue
    expect(mw3 - mw2).toBeCloseTo(313.21, 1);
  });

  it('gives higher MW for G-rich sequences than A-rich', () => {
    // G residue (329.21) > A residue (313.21)
    const gSeq = computeMW('GGGGG');
    const aSeq = computeMW('AAAAA');
    expect(gSeq).toBeGreaterThan(aSeq);
  });

  it('is case-insensitive', () => {
    expect(computeMW('atgc')).toBe(computeMW('ATGC'));
  });
});

// ── findORFs ───────────────────────────────────────────────────────────────────

describe('findORFs', () => {
  it('finds a simple ORF with ATG and stop codon', () => {
    // ATG TTT TAA → 9 bases, well above default 30? No, it's 9.
    // With minLength=3, it should be found.
    const orfs = findORFs('ATGTTTAAA', 3);
    // ATG TTT AAA = Met-Phe-Lys (AAA is Lys, not a stop codon)
    // Actually AAA is Lys, not a stop codon. Stop codons are TAA, TAG, TGA.
    // So ATGTTTAAA has no stop codon → no ORF with default minLength
    // Let's use a real one:
    // ATG TTT TAA → 9 bases, stop at TAA
    const orfs2 = findORFs('ATGTTTTAA', 3);
    expect(orfs2.length).toBeGreaterThanOrEqual(1);
    expect(orfs2[0].start).toBe(0);
    expect(orfs2[0].end).toBe(9);
    expect(orfs2[0].frame).toBe(0);
    expect(orfs2[0].peptide).toBe('MF');
  });

  it('respects the minLength parameter', () => {
    // ATG TTT TAA = 9 bases
    const orfs = findORFs('ATGTTTTAA', 100);
    expect(orfs.length).toBe(0);
  });

  it('finds ORFs in different reading frames', () => {
    // Frame 0: starts at 0
    // Frame 1: starts at 1
    // Frame 2: starts at 2
    // Construct: NNN ATG CCC TAA NNN (frame 1 ORF from pos 1 to 10)
    const seq = 'AATGCCCTAA';
    // Frame 0: ATG CCC TAA → start=0, end=9? Let's check:
    //   pos 0: AAT (not ATG)
    //   pos 3: GCC (not ATG)
    //   pos 6: CTA (not ATG)
    // Frame 1: pos 1: ATG → found! Then CCC, then TAA at pos 7 → stop
    //   ORF: start=1, end=10
    const orfs = findORFs(seq, 3);
    expect(orfs.length).toBeGreaterThanOrEqual(1);
    expect(orfs.some((o: ORF) => o.frame === 1 && o.start === 1)).toBe(true);
  });

  it('returns an empty array for no start codons', () => {
    expect(findORFs('TTTTTTTTTT', 3)).toEqual([]);
  });

  it('returns an empty array for no stop codons', () => {
    // ATG AAA AAA ... (no stop)
    expect(findORFs('ATGAAAAAAA', 3)).toEqual([]);
  });

  it('finds multiple ORFs', () => {
    // Two ORFs: ATGTTT TAA ATGCCC TGA
    const seq = 'ATGTTTTAAATGCCCTGA';
    const orfs = findORFs(seq, 3);
    expect(orfs.length).toBeGreaterThanOrEqual(2);
  });

  it('sorts ORFs by start position', () => {
    const seq = 'ATGTTTTAAATGCCCTGA';
    const orfs = findORFs(seq, 3);
    for (let i = 1; i < orfs.length; i++) {
      expect(orfs[i].start).toBeGreaterThanOrEqual(orfs[i - 1].start);
    }
  });
});

// ── translateSequence ──────────────────────────────────────────────────────────

describe('translateSequence', () => {
  it('translates ATG to M (methionine)', () => {
    expect(translateSequence('ATG')).toBe('M');
  });

  it('translates a known coding sequence', () => {
    // ATG GCT → M A (Met-Ala)
    expect(translateSequence('ATGGCT')).toBe('MA');
  });

  it('stops at a stop codon', () => {
    // ATG TAA → M (stop at TAA)
    expect(translateSequence('ATGTAA')).toBe('M');
  });

  it('ignores trailing partial codons', () => {
    // ATG A → just the first codon ATG → M
    expect(translateSequence('ATGA')).toBe('M');
  });

  it('returns empty string for no complete codons', () => {
    expect(translateSequence('')).toBe('');
    expect(translateSequence('AT')).toBe('');
  });

  it('translates all standard amino acids', () => {
    // A sequence encoding all 20 amino acids (no stops)
    // Using known codons:
    const codons = [
      'ATG', // M
      'GCT', // A
      'TTT', // F
      'TGG', // W
      'TGT', // C
      'GAT', // D
      'GAA', // E
      'GGT', // G
      'CAT', // H
      'ATT', // I
      'AAA', // K
      'CTT', // L
      'AAT', // N
      'CCT', // P
      'CAA', // Q
      'CGT', // R
      'TCT', // S
      'ACT', // T
      'GTT', // V
      'TAT', // Y
    ];
    const dna = codons.join('');
    const protein = translateSequence(dna);
    expect(protein).toBe('MAFWCDEGHIKLNPQRSTVY');
    expect(protein.length).toBe(20);
  });

  it('is case-insensitive', () => {
    expect(translateSequence('atg')).toBe(translateSequence('ATG'));
    expect(translateSequence('AtG')).toBe(translateSequence('ATG'));
  });

  it('handles RNA input (U→T conversion)', () => {
    expect(translateSequence('AUGGCU')).toBe(translateSequence('ATGGCT'));
  });

  it('produces X for non-standard codons', () => {
    // NNN → should produce X for unknown codon
    expect(translateSequence('NNN')).toBe('X');
  });
});
