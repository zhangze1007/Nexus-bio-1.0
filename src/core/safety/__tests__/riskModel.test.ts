/**
 * Risk Model Tests
 */

import { assessSequenceRisk, getRiskColor, getRiskLabel, SEQUENCE_RISK_RULES } from '../riskModel';

describe('riskModel', () => {
  describe('assessSequenceRisk', () => {
    it('returns low risk for normal sequence', () => {
      const result = assessSequenceRisk('ATGAAACGC', 'ecoli', 'research');
      expect(result.level).toBe('low');
      expect(result.canProceed).toBe(true);
      expect(result.requiresHumanReview).toBe(false);
    });

    it('blocks select agent matches', () => {
      const result = assessSequenceRisk('ATGAAACGC', 'ecoli', 'research', {
        virulence: 0, toxin: 0, selectAgent: 0.9,
      });
      expect(result.level).toBe('blocked');
      expect(result.canProceed).toBe(false);
      expect(result.requiresHumanReview).toBe(true);
      expect(result.triggerRule).toBe(SEQUENCE_RISK_RULES.SELECT_AGENT.id);
    });

    it('blocks toxin matches', () => {
      const result = assessSequenceRisk('ATGAAACGC', 'ecoli', 'research', {
        virulence: 0, toxin: 0.8, selectAgent: 0,
      });
      expect(result.level).toBe('blocked');
      expect(result.canProceed).toBe(false);
    });

    it('returns high risk for virulence + therapy purpose', () => {
      const result = assessSequenceRisk('ATGAAACGC', 'ecoli', 'therapy', {
        virulence: 0.7, toxin: 0, selectAgent: 0,
      });
      expect(result.level).toBe('high');
      expect(result.canProceed).toBe(false);
    });

    it('returns elevated risk for virulence + research purpose', () => {
      const result = assessSequenceRisk('ATGAAACGC', 'ecoli', 'research', {
        virulence: 0.7, toxin: 0, selectAgent: 0,
      });
      expect(result.level).toBe('elevated');
      expect(result.canProceed).toBe(true);
    });

    it('returns moderate risk for borderline scores', () => {
      const result = assessSequenceRisk('ATGAAACGC', 'ecoli', 'research', {
        virulence: 0.4, toxin: 0.35, selectAgent: 0,
      });
      expect(result.level).toBe('moderate');
      expect(result.canProceed).toBe(true);
    });
  });

  describe('getRiskColor', () => {
    it('returns valid hex colors', () => {
      expect(getRiskColor('low')).toMatch(/^#[0-9a-f]{6}$/);
      expect(getRiskColor('blocked')).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  describe('getRiskLabel', () => {
    it('returns human-readable labels', () => {
      expect(getRiskLabel('low')).toBe('Low Risk');
      expect(getRiskLabel('blocked')).toBe('Blocked');
    });
  });
});
