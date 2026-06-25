/**
 * Sequence Data Model — Tests
 *
 * Tests for createSequenceData, validateSequence, reverseComplement.
 */

import {
  createSequenceData,
  validateSequence,
  reverseComplement,
  type SequenceData,
  type SequenceType,
} from '../../src/components/sequence/types';

describe('createSequenceData', () => {
  it('should create a SequenceData with defaults', () => {
    const seq = createSequenceData({ sequence: 'ATCGATCG' });
    expect(seq.sequence).toBe('ATCGATCG');
    expect(seq.type).toBe('dna');
    expect(seq.topology).toBe('linear');
    expect(seq.length).toBe(8);
    expect(seq.features).toEqual([]);
    expect(seq.restrictionSites).toEqual([]);
    expect(seq.primers).toEqual([]);
  });

  it('should uppercase the sequence', () => {
    const seq = createSequenceData({ sequence: 'atcgatcg' });
    expect(seq.sequence).toBe('ATCGATCG');
  });

  it('should strip whitespace', () => {
    const seq = createSequenceData({ sequence: 'ATCG ATC G' });
    expect(seq.sequence).toBe('ATCGATCG');
    expect(seq.length).toBe(8);
  });

  it('should infer RNA type from U-containing sequence', () => {
    const seq = createSequenceData({ sequence: 'AUCGAUCG' });
    expect(seq.type).toBe('rna');
  });

  it('should infer protein type from amino acid sequence', () => {
    const seq = createSequenceData({ sequence: 'MKFGH' });
    expect(seq.type).toBe('protein');
  });

  it('should accept explicit type override', () => {
    const seq = createSequenceData({ sequence: 'ATCG', type: 'rna' });
    expect(seq.type).toBe('rna');
  });

  it('should preserve provided features', () => {
    const seq = createSequenceData({
      sequence: 'ATCGATCG',
      features: [
        {
          id: 'f1',
          type: 'CDS',
          start: 0,
          end: 8,
          strand: 1,
          name: 'gene1',
          color: '#5151CD',
        },
      ],
    });
    expect(seq.features.length).toBe(1);
    expect(seq.features[0].name).toBe('gene1');
  });
});

describe('validateSequence', () => {
  it('should accept valid DNA', () => {
    expect(validateSequence('ATCG', 'dna')).toBeNull();
  });

  it('should reject DNA with U', () => {
    expect(validateSequence('ATCU', 'dna')).toBeTruthy();
  });

  it('should reject DNA with invalid chars', () => {
    expect(validateSequence('ATCGX', 'dna')).toBeTruthy();
  });

  it('should accept valid RNA', () => {
    expect(validateSequence('AUCG', 'rna')).toBeNull();
  });

  it('should reject RNA with T', () => {
    expect(validateSequence('AUCGT', 'rna')).toBeTruthy();
  });

  it('should accept valid protein', () => {
    expect(validateSequence('ACDEFGHIKLMNPQRSTVWY', 'protein')).toBeNull();
  });

  it('should reject protein with invalid chars', () => {
    expect(validateSequence('MKFGH123', 'protein')).toBeTruthy();
  });

  it('should reject empty sequence', () => {
    expect(validateSequence('', 'dna')).toBeTruthy();
  });

  it('should handle whitespace in validation', () => {
    expect(validateSequence('A T C G', 'dna')).toBeNull();
  });
});

describe('reverseComplement', () => {
  it('should reverse complement ATCG -> CGAT', () => {
    expect(reverseComplement('ATCG')).toBe('CGAT');
  });

  it('should reverse complement a known sequence', () => {
    // GAATTC (EcoRI) is palindromic
    expect(reverseComplement('GAATTC')).toBe('GAATTC');
  });

  it('should handle empty string', () => {
    expect(reverseComplement('')).toBe('');
  });

  it('should handle lowercase', () => {
    expect(reverseComplement('atcg')).toBe('cgat');
  });

  it('should reverse complement AAAA -> TTTT', () => {
    expect(reverseComplement('AAAA')).toBe('TTTT');
  });
});
