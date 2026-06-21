/**
 * RNA Engineering Engine Tests
 */

import { designRNA } from '../rnaEngine';

describe('rnaEngine', () => {
  const sampleTarget = 'ATGAAACGCACCAGCAACAGCAACTGGAGGCTTTACAACGTCGTGACTGGGAAA';

  describe('ribozyme design', () => {
    it('designs a hammerhead ribozyme', () => {
      // Sequence with UAC cleavage site (NUH pattern)
      const targetWithCleavage = 'ATGAAACGCACCUACGAAAA';
      const result = designRNA({
        type: 'ribozyme',
        targetSequence: targetWithCleavage,
        ribozymeType: 'hammerhead',
        host: 'ecoli',
      });
      expect(result.type).toBe('ribozyme');
      expect(result.evidence.length).toBeGreaterThan(0);
    });

    it('returns empty sequence when no cleavage sites', () => {
      // Sequence with no U in second position
      const result = designRNA({
        type: 'ribozyme',
        targetSequence: 'ATGAAACGCGGGAAA',
        ribozymeType: 'hammerhead',
        host: 'ecoli',
      });
      expect(result.sequence.length).toBe(0);
    });
  });

  describe('siRNA design', () => {
    it('designs an siRNA', () => {
      const longTarget = 'A'.repeat(50) + sampleTarget + 'U'.repeat(50);
      const result = designRNA({
        type: 'sirna',
        targetSequence: longTarget,
        host: 'human',
      });
      expect(result.type).toBe('sirna');
      expect(result.sequence.length).toBe(21);
    });

    it('includes literature evidence', () => {
      const longTarget = 'A'.repeat(50) + sampleTarget + 'U'.repeat(50);
      const result = designRNA({
        type: 'sirna',
        targetSequence: longTarget,
        host: 'human',
      });
      expect(result.evidence.length).toBeGreaterThan(0);
    });
  });

  describe('toehold switch design', () => {
    it('designs a toehold switch', () => {
      const result = designRNA({
        type: 'toehold',
        targetSequence: sampleTarget,
        host: 'ecoli',
      });
      expect(result.type).toBe('toehold');
      expect(result.sequence.length).toBeGreaterThan(0);
      expect(result.evidence.length).toBeGreaterThan(0);
    });
  });

  describe('aptamer design', () => {
    it('designs an aptamer candidate', () => {
      const result = designRNA({
        type: 'aptamer',
        targetSequence: 'theophylline',
        host: 'ecoli',
      });
      expect(result.type).toBe('aptamer');
      expect(result.sequence.length).toBeGreaterThan(0);
      expect(result.designNotes.length).toBeGreaterThan(0);
    });
  });
});
