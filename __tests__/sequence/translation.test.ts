/**
 * 6-Frame Translation — Tests
 *
 * TDD: These tests are written BEFORE the implementation.
 * They should FAIL until translation.ts is complete.
 */

import {
  translateCodon,
  translateFrame,
  sixFrameTranslation,
} from '../../src/components/sequence/translation';

describe('translateCodon', () => {
  it('should translate ATG to M (Methionine)', () => {
    expect(translateCodon('ATG')).toBe('M');
  });

  it('should translate TTT to F (Phenylalanine)', () => {
    expect(translateCodon('TTT')).toBe('F');
  });

  it('should translate TAG to * (stop codon)', () => {
    expect(translateCodon('TAG')).toBe('*');
  });

  it('should translate TAA to * (stop codon)', () => {
    expect(translateCodon('TAA')).toBe('*');
  });

  it('should translate TGA to * (stop codon)', () => {
    expect(translateCodon('TGA')).toBe('*');
  });

  it('should translate GCT to A (Alanine)', () => {
    expect(translateCodon('GCT')).toBe('A');
  });

  it('should translate TGG to W (Tryptophan)', () => {
    expect(translateCodon('TGG')).toBe('W');
  });

  it('should handle lowercase input', () => {
    expect(translateCodon('atg')).toBe('M');
  });

  it('should return ? for unknown/invalid codons', () => {
    expect(translateCodon('NNN')).toBe('?');
    expect(translateCodon('AT')).toBe('?');
  });

  it('should translate all four Leucine codons', () => {
    expect(translateCodon('TTA')).toBe('L');
    expect(translateCodon('TTG')).toBe('L');
    expect(translateCodon('CTT')).toBe('L');
    expect(translateCodon('CTA')).toBe('L');
  });

  it('should translate CGN family to R (Arginine)', () => {
    expect(translateCodon('CGT')).toBe('R');
    expect(translateCodon('CGC')).toBe('R');
    expect(translateCodon('CGA')).toBe('R');
    expect(translateCodon('CGG')).toBe('R');
  });
});

describe('translateFrame', () => {
  const testSeq = 'ATGAAATTTGGGTAG'; // M K F G *

  it('frame +1 (offset 0) should translate from position 0', () => {
    const result = translateFrame(testSeq, 0);
    expect(result).toBe('MKFG*');
  });

  it('frame +2 (offset 1) should translate from position 1', () => {
    const result = translateFrame(testSeq, 1);
    // from pos 1: TGA AAT TTG GGT AG = * N L G (partial)
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toBe('*'); // TGA = stop
  });

  it('frame +3 (offset 2) should translate from position 2', () => {
    const result = translateFrame(testSeq, 2);
    // from pos 2: GAA ATT TGG GTA G = E I W V (partial)
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toBe('E'); // GAA = E
  });

  it('frame -1 should reverse complement then translate from 0', () => {
    const result = translateFrame(testSeq, -1);
    expect(result.length).toBeGreaterThan(0);
    // Reverse complement of ATGAAATTTGGGTAG:
    // CTACCCAAATTTCAT
    // CTACCCAAATTTCAT → CTA CCC AAA TTT CAT → L P K F H
    expect(result).toBe('LPKFH');
  });

  it('frame -2 should reverse complement then translate from 1', () => {
    const result = translateFrame(testSeq, -2);
    expect(result.length).toBeGreaterThan(0);
  });

  it('frame -3 should reverse complement then translate from 2', () => {
    const result = translateFrame(testSeq, -3);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle empty sequence', () => {
    expect(translateFrame('', 0)).toBe('');
  });

  it('should handle sequence shorter than a codon', () => {
    expect(translateFrame('AT', 0)).toBe('');
  });
});

describe('sixFrameTranslation', () => {
  const testSeq = 'ATGAAATTTGGGTAG';

  it('should return 6 frames', () => {
    const result = sixFrameTranslation(testSeq);
    expect(Object.keys(result).length).toBe(6);
    expect(result['+1']).toBeDefined();
    expect(result['+2']).toBeDefined();
    expect(result['+3']).toBeDefined();
    expect(result['-1']).toBeDefined();
    expect(result['-2']).toBeDefined();
    expect(result['-3']).toBeDefined();
  });

  it('frame +1 should be the longest for an ORF-containing sequence', () => {
    const result = sixFrameTranslation(testSeq);
    expect(result['+1']).toBe('MKFG*');
  });

  it('all frames should be non-empty for sequences >= 3bp', () => {
    const result = sixFrameTranslation('ATGAAATTTGGGTAG');
    for (const key of ['+1', '+2', '+3', '-1', '-2', '-3'] as const) {
      expect(result[key].length).toBeGreaterThan(0);
    }
  });

  it('should handle very short sequence', () => {
    const result = sixFrameTranslation('AT');
    // All frames should still produce a value (possibly empty for partial codons)
    expect(Object.keys(result).length).toBe(6);
  });
});
