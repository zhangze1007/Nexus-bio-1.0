/**
 * CRISPR Editor Tests
 */

import { designCRISPREdit } from '../crisprEditor';

describe('crisprEditor', () => {
  const sampleSequence = 'ATGAAACGCACCAGCAACAGCAACTGGAGGCTTTACAACGTCGTGACTGGGAAAACCCTGGCGTTACCCAACTTAATCGCCTTGCAGCACATCCCCCTTTCGCCAGCTGGCGTAATAGCGAAGAGGCCCGCACCGATCGCCCTTCCCAACAGTTGCGCAG';

  describe('designCRISPREdit', () => {
    it('designs a Cas9 guide RNA', () => {
      const result = designCRISPREdit({
        targetSequence: sampleSequence,
        targetPosition: 50,
        editType: 'substitution',
        desiredChange: { from: 'A', to: 'T' },
        mode: 'cas9',
        host: 'ecoli',
      });
      expect(result.mode).toBe('cas9');
      expect(result.guides.length).toBeGreaterThan(0);
    });

    it('rejects base editing with incompatible change', () => {
      const result = designCRISPREdit({
        targetSequence: sampleSequence,
        targetPosition: 50,
        editType: 'substitution',
        desiredChange: { from: 'A', to: 'T' },
        mode: 'base_editing',
        baseEditor: 'BE3',
        host: 'ecoli',
      });
      // BE3 only supports C→T, so A→T should be rejected
      expect(result.isAcceptable).toBe(false);
      expect(result.rejectionReason).toBeDefined();
    });

    it('designs ABE for A→G edit', () => {
      const result = designCRISPREdit({
        targetSequence: sampleSequence,
        targetPosition: 10,
        editType: 'substitution',
        desiredChange: { from: 'A', to: 'G' },
        mode: 'base_editing',
        baseEditor: 'ABE',
        host: 'ecoli',
      });
      expect(result.mode).toBe('base_editing');
      // May or may not be acceptable depending on PAM availability
    });

    it('designs prime editing for substitution', () => {
      const result = designCRISPREdit({
        targetSequence: sampleSequence,
        targetPosition: 50,
        editType: 'substitution',
        desiredChange: { from: 'A', to: 'G' },
        mode: 'prime_editing',
        primeEditor: 'PE2',
        host: 'ecoli',
      });
      expect(result.mode).toBe('prime_editing');
      expect(result.predictedEdit).toContain('PE');
    });

    it('rejects invalid target position', () => {
      const result = designCRISPREdit({
        targetSequence: sampleSequence,
        targetPosition: 999,
        editType: 'substitution',
        mode: 'cas9',
        host: 'ecoli',
      });
      expect(result.isAcceptable).toBe(false);
      expect(result.rejectionReason).toContain('out of sequence bounds');
    });

    it('includes evidence from literature', () => {
      const result = designCRISPREdit({
        targetSequence: sampleSequence,
        targetPosition: 50,
        editType: 'substitution',
        desiredChange: { from: 'A', to: 'T' },
        mode: 'cas9',
        host: 'ecoli',
      });
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.evidence[0].type).toBe('literature');
    });

    it('generates design notes', () => {
      const result = designCRISPREdit({
        targetSequence: sampleSequence,
        targetPosition: 50,
        editType: 'substitution',
        desiredChange: { from: 'A', to: 'T' },
        mode: 'cas9',
        host: 'ecoli',
      });
      expect(result.designNotes.length).toBeGreaterThan(0);
      expect(result.designNotes[0]).toContain('Mode');
    });
  });
});
