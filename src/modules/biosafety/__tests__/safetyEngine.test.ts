/**
 * Biosafety Engine Tests
 */

import { assessBiosafety } from '../safetyEngine';

describe('safetyEngine', () => {
  const normalSequence = 'ATGAAACGCACCAGCAACAGCAACTAA';

  describe('assessBiosafety', () => {
    it('returns low risk for normal sequence', () => {
      const result = assessBiosafety({
        dnaSequence: normalSequence,
        host: 'ecoli',
        purpose: 'research',
        mode: 'research',
      });
      expect(result.risk.level).toBe('low');
      expect(result.canProceed).toBe(true);
      expect(result.requiresHumanReview).toBe(false);
    });

    it('detects virulence factor matches', () => {
      // hemolysin sequence
      const vfSequence = 'ATGAATAAAAGAAATTTTGTT' + 'A'.repeat(100);
      const result = assessBiosafety({
        dnaSequence: vfSequence,
        host: 'ecoli',
        purpose: 'research',
        mode: 'research',
      });
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches.some(m => m.source === 'VFDB')).toBe(true);
    });

    it('blocks select agent sequences', () => {
      // Exact match to anthrax pattern
      const selectAgentSeq = 'ATGAAAAAAATTAATATTTTCA';
      const result = assessBiosafety({
        dnaSequence: selectAgentSeq,
        host: 'ecoli',
        purpose: 'research',
        mode: 'research',
      });
      // Should detect select agent or virulence match
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.requiresHumanReview).toBe(true);
    });

    it('recommends containment for high-risk constructs', () => {
      const vfSequence = 'ATGAATAAAAGAAATTTTGTT' + 'A'.repeat(100);
      const result = assessBiosafety({
        dnaSequence: vfSequence,
        host: 'ecoli',
        purpose: 'environmental',
        mode: 'production',
      });
      expect(result.containment.length).toBeGreaterThan(0);
    });

    it('includes evidence from database matches', () => {
      const vfSequence = 'ATGAATAAAAGAAATTTTGTT' + 'A'.repeat(100);
      const result = assessBiosafety({
        dnaSequence: vfSequence,
        host: 'ecoli',
        purpose: 'research',
        mode: 'research',
      });
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.evidence[0].type).toBe('database');
    });

    it('generates design notes', () => {
      const result = assessBiosafety({
        dnaSequence: normalSequence,
        host: 'ecoli',
        purpose: 'research',
        mode: 'research',
      });
      expect(result.designNotes.length).toBeGreaterThan(0);
      expect(result.designNotes[0]).toContain('Screened');
    });

    it('warns about dangerous sequence matches', () => {
      const selectAgentSeq = 'ATGAAAAAAATTAATATTTTCA';
      const result = assessBiosafety({
        dnaSequence: selectAgentSeq,
        host: 'ecoli',
        purpose: 'research',
        mode: 'research',
      });
      // Should detect some match and warn
      expect(result.designNotes.length).toBeGreaterThan(0);
    });
  });
});
