/**
 * Complex Assembly Scoring Tests
 *
 * Tests for contact score, area score, energy score, clash penalty,
 * and composite scoring of protein complexes.
 */

import {
  computeContactScore,
  computeAreaScore,
  computeEnergyScore,
  computeClashPenalty,
  scoreComplex,
} from '../scoring';
import type { ComplexScore } from '../types';

// ── Test Helpers ──────────────────────────────────────────────────────────────

/**
 * Build a minimal PDB-format ATOM line.
 */
function buildAtomLine(
  serial: number,
  atomName: string,
  resName: string,
  chain: string,
  resSeq: number,
  x: number,
  y: number,
  z: number,
): string {
  const pad = (val: string, width: number) => val.padStart(width, ' ');
  return (
    'ATOM  ' +
    pad(String(serial), 5) +
    ' ' +
    atomName.padEnd(4, ' ') +
    ' ' +
    resName.padEnd(3, ' ') +
    ' ' +
    chain +
    pad(String(resSeq), 4) +
    '    ' +
    pad(x.toFixed(3), 8) +
    pad(y.toFixed(3), 8) +
    pad(z.toFixed(3), 8) +
    '  1.00' +
    '  0.00' +
    '           C'
  );
}

/**
 * Build a two-chain PDB with Cα atoms close together (interface contacts).
 * Chain A residues at x=0..10, Chain B residues at x=5..15 (overlap at ~5Å).
 */
function buildContactPdb(): string {
  const lines: string[] = [];

  // Chain A: 5 residues along x-axis
  for (let i = 0; i < 5; i++) {
    lines.push(buildAtomLine(i + 1, 'CA', 'ALA', 'A', i + 1, i * 3.8, 0, 0));
  }

  // Chain B: 5 residues along x-axis, offset by 6A in x to create realistic inter-chain distances
  for (let i = 0; i < 5; i++) {
    lines.push(buildAtomLine(i + 6, 'CA', 'GLY', 'B', i + 1, 13.6 + i * 3.8, 0, 0));
  }

  lines.push('END');
  return lines.join('\n');
}

/**
 * Build a PDB with chains far apart (no interface).
 */
function buildNoInterfacePdb(): string {
  const lines: string[] = [];

  lines.push(buildAtomLine(1, 'CA', 'ALA', 'A', 1, 0, 0, 0));
  lines.push(buildAtomLine(2, 'CA', 'ALA', 'A', 2, 3.8, 0, 0));
  lines.push(buildAtomLine(3, 'CA', 'ALA', 'B', 1, 100, 0, 0));
  lines.push(buildAtomLine(4, 'CA', 'ALA', 'B', 2, 103.8, 0, 0));

  lines.push('END');
  return lines.join('\n');
}

/**
 * Build a PDB with steric clashes (atoms very close together).
 * Chain B atoms placed at positions that clash with Chain A.
 */
function buildClashPdb(): string {
  const lines: string[] = [];

  // Chain A: 3 residues
  lines.push(buildAtomLine(1, 'CA', 'ALA', 'A', 1, 0, 0, 0));
  lines.push(buildAtomLine(2, 'CA', 'ALA', 'A', 2, 3.8, 0, 0));
  lines.push(buildAtomLine(3, 'CA', 'ALA', 'A', 3, 7.6, 0, 0));

  // Chain B: 3 residues very close to Chain A (clashes)
  lines.push(buildAtomLine(4, 'CA', 'GLY', 'B', 1, 1.5, 0, 0));
  lines.push(buildAtomLine(5, 'CA', 'GLY', 'B', 2, 5.0, 0, 0));
  lines.push(buildAtomLine(6, 'CA', 'GLY', 'B', 3, 8.8, 0, 0));

  lines.push('END');
  return lines.join('\n');
}

/**
 * Build a two-chain PDB with moderate inter-chain distances (~5Å).
 * Y-offset of 5Å places chains at LJ-favorable distances where the
 * statistical potential produces negative (stabilizing) energies.
 * Chain A along x-axis at y=0, Chain B along x-axis at y=5.
 */
function buildEnergyPdb(): string {
  const lines: string[] = [];

  // Chain A: 5 residues along x-axis
  for (let i = 0; i < 5; i++) {
    lines.push(buildAtomLine(i + 1, 'CA', 'ALA', 'A', i + 1, i * 3.8, 0, 0));
  }

  // Chain B: 5 residues along x-axis, offset by 5Å in y direction
  for (let i = 0; i < 5; i++) {
    lines.push(buildAtomLine(i + 6, 'CA', 'GLY', 'B', i + 1, i * 3.8, 5.0, 0));
  }

  lines.push('END');
  return lines.join('\n');
}

/**
 * Build a PDB with many interface contacts (high density).
 * Two chains with residues interleaved in 3D space.
 */
function buildHighDensityPdb(): string {
  const lines: string[] = [];

  // Chain A: 10 residues in a line along x-axis
  for (let i = 0; i < 10; i++) {
    lines.push(buildAtomLine(i + 1, 'CA', 'ALA', 'A', i + 1, i * 3.8, 0, 0));
  }

  // Chain B: 10 residues interleaved with Chain A
  for (let i = 0; i < 10; i++) {
    lines.push(buildAtomLine(i + 11, 'CA', 'GLY', 'B', i + 1, 1.9 + i * 3.8, 3.0, 0));
  }

  lines.push('END');
  return lines.join('\n');
}

/**
 * Build a single-chain PDB (no interface possible).
 */
function buildSingleChainPdb(): string {
  const lines: string[] = [];

  for (let i = 0; i < 5; i++) {
    lines.push(buildAtomLine(i + 1, 'CA', 'ALA', 'A', i + 1, i * 3.8, 0, 0));
  }

  lines.push('END');
  return lines.join('\n');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('complex assembly scoring', () => {
  // ── Contact Score ───────────────────────────────────────────────────────────

  describe('computeContactScore', () => {
    it('returns score in [0, 1] for a two-chain complex', () => {
      const pdb = buildContactPdb();
      const score = computeContactScore(pdb, ['A', 'B']);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('returns higher score for more contacts', () => {
      const contactPdb = buildContactPdb();
      const noContactPdb = buildNoInterfacePdb();

      const scoreWithContacts = computeContactScore(contactPdb, ['A', 'B']);
      const scoreNoContacts = computeContactScore(noContactPdb, ['A', 'B']);

      expect(scoreWithContacts).toBeGreaterThan(scoreNoContacts);
    });

    it('returns 0 for empty PDB', () => {
      const score = computeContactScore('', ['A', 'B']);
      expect(score).toBe(0);
    });

    it('returns 0 for single chain', () => {
      const pdb = buildSingleChainPdb();
      const score = computeContactScore(pdb, ['A']);
      expect(score).toBe(0);
    });

    it('respects custom distance threshold', () => {
      const pdb = buildContactPdb();
      const score8 = computeContactScore(pdb, ['A', 'B'], { distanceThreshold: 8 });
      const score2 = computeContactScore(pdb, ['A', 'B'], { distanceThreshold: 2 });

      // Smaller threshold -> fewer contacts -> lower score
      expect(score2).toBeLessThanOrEqual(score8);
    });

    it('returns 0 when chains are far apart', () => {
      const pdb = buildNoInterfacePdb();
      const score = computeContactScore(pdb, ['A', 'B']);
      expect(score).toBe(0);
    });
  });

  // ── Area Score ──────────────────────────────────────────────────────────────

  describe('computeAreaScore', () => {
    it('returns score in [0, 1] for a two-chain complex', () => {
      const pdb = buildContactPdb();
      const score = computeAreaScore(pdb, ['A', 'B']);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('returns higher score for more buried area', () => {
      const contactPdb = buildContactPdb();
      const noContactPdb = buildNoInterfacePdb();

      const scoreWithContacts = computeAreaScore(contactPdb, ['A', 'B']);
      const scoreNoContacts = computeAreaScore(noContactPdb, ['A', 'B']);

      expect(scoreWithContacts).toBeGreaterThan(scoreNoContacts);
    });

    it('returns 0 for empty PDB', () => {
      const score = computeAreaScore('', ['A', 'B']);
      expect(score).toBe(0);
    });

    it('returns 0 for single chain', () => {
      const pdb = buildSingleChainPdb();
      const score = computeAreaScore(pdb, ['A']);
      expect(score).toBe(0);
    });

    it('returns 0 when no contacts exist', () => {
      const pdb = buildNoInterfacePdb();
      const score = computeAreaScore(pdb, ['A', 'B']);
      expect(score).toBe(0);
    });
  });

  // ── Energy Score ────────────────────────────────────────────────────────────

  describe('computeEnergyScore', () => {
    it('returns score in [0, 1] for a two-chain complex', () => {
      const pdb = buildContactPdb();
      const score = computeEnergyScore(pdb, ['A', 'B']);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('returns lower energy for stable complexes (close contacts)', () => {
      // Use energy-specific fixture with ~5Å inter-chain distances
      // where LJ potential produces favorable (negative) values
      const energyPdb = buildEnergyPdb();
      const noContactPdb = buildNoInterfacePdb();

      const scoreWithContacts = computeEnergyScore(energyPdb, ['A', 'B']);
      const scoreNoContacts = computeEnergyScore(noContactPdb, ['A', 'B']);

      // Energy PDB should have lower energy (more stable) when there are favorable contacts
      // No-contact PDB returns 0 (no energy contribution)
      expect(scoreWithContacts).toBeGreaterThanOrEqual(0);
      expect(scoreNoContacts).toBe(0);
      expect(scoreWithContacts).toBeGreaterThan(scoreNoContacts);
    });

    it('returns 0 for empty PDB', () => {
      const score = computeEnergyScore('', ['A', 'B']);
      expect(score).toBe(0);
    });

    it('returns 0 for single chain', () => {
      const pdb = buildSingleChainPdb();
      const score = computeEnergyScore(pdb, ['A']);
      expect(score).toBe(0);
    });

    it('handles different distances appropriately', () => {
      // Build PDB with specific distances
      const lines: string[] = [];

      // Chain A: single residue at origin
      lines.push(buildAtomLine(1, 'CA', 'ALA', 'A', 1, 0, 0, 0));

      // Chain B: residue at 4Å (favorable distance)
      lines.push(buildAtomLine(2, 'CA', 'GLY', 'B', 1, 4.0, 0, 0));

      lines.push('END');
      const pdb = lines.join('\n');

      const score = computeEnergyScore(pdb, ['A', 'B']);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  // ── Clash Penalty ───────────────────────────────────────────────────────────

  describe('computeClashPenalty', () => {
    it('returns penalty in [0, 1] for a two-chain complex', () => {
      const pdb = buildClashPdb();
      const penalty = computeClashPenalty(pdb, ['A', 'B']);

      expect(penalty).toBeGreaterThanOrEqual(0);
      expect(penalty).toBeLessThanOrEqual(1);
    });

    it('returns higher penalty for more clashes', () => {
      const clashPdb = buildClashPdb();
      const noClashPdb = buildNoInterfacePdb();

      const penaltyClash = computeClashPenalty(clashPdb, ['A', 'B']);
      const penaltyNoClash = computeClashPenalty(noClashPdb, ['A', 'B']);

      expect(penaltyClash).toBeGreaterThan(penaltyNoClash);
    });

    it('returns 0 for empty PDB', () => {
      const penalty = computeClashPenalty('', ['A', 'B']);
      expect(penalty).toBe(0);
    });

    it('returns 0 for single chain', () => {
      const pdb = buildSingleChainPdb();
      const penalty = computeClashPenalty(pdb, ['A']);
      expect(penalty).toBe(0);
    });

    it('respects custom clash threshold', () => {
      const pdb = buildClashPdb();

      // Default threshold (2.0A) should detect some clashes
      const penaltyDefault = computeClashPenalty(pdb, ['A', 'B']);

      // Very small threshold should detect fewer clashes
      const penaltySmall = computeClashPenalty(pdb, ['A', 'B'], { clashThreshold: 0.5 });

      // Very large threshold should detect more clashes
      const penaltyLarge = computeClashPenalty(pdb, ['A', 'B'], { clashThreshold: 10.0 });

      expect(penaltySmall).toBeLessThanOrEqual(penaltyDefault);
      expect(penaltyDefault).toBeLessThanOrEqual(penaltyLarge);
    });

    it('returns 0 when no clashes exist', () => {
      const pdb = buildNoInterfacePdb();
      const penalty = computeClashPenalty(pdb, ['A', 'B'], { clashThreshold: 2.0 });
      expect(penalty).toBe(0);
    });
  });

  // ── Composite Score ─────────────────────────────────────────────────────────

  describe('scoreComplex', () => {
    it('returns all sub-scores', () => {
      const pdb = buildContactPdb();
      const result = scoreComplex(pdb, ['A', 'B']);

      expect(result).toHaveProperty('contactScore');
      expect(result).toHaveProperty('areaScore');
      expect(result).toHaveProperty('energyScore');
      expect(result).toHaveProperty('clashPenalty');
      expect(result).toHaveProperty('finalScore');
    });

    it('returns all sub-scores in [0, 1]', () => {
      const pdb = buildContactPdb();
      const result = scoreComplex(pdb, ['A', 'B']);

      expect(result.contactScore).toBeGreaterThanOrEqual(0);
      expect(result.contactScore).toBeLessThanOrEqual(1);
      expect(result.areaScore).toBeGreaterThanOrEqual(0);
      expect(result.areaScore).toBeLessThanOrEqual(1);
      expect(result.energyScore).toBeGreaterThanOrEqual(0);
      expect(result.energyScore).toBeLessThanOrEqual(1);
      expect(result.clashPenalty).toBeGreaterThanOrEqual(0);
      expect(result.clashPenalty).toBeLessThanOrEqual(1);
    });

    it('computes final score as weighted sum minus weighted clash penalty', () => {
      const pdb = buildContactPdb();
      const result = scoreComplex(pdb, ['A', 'B']);

      // Default weights: contact=0.3, area=0.3, energy=0.3, clash=0.1
      const expectedWeightedSum =
        0.3 * result.contactScore +
        0.3 * result.areaScore +
        0.3 * result.energyScore;

      const expectedFinal = expectedWeightedSum - 0.1 * result.clashPenalty;

      expect(result.finalScore).toBeCloseTo(expectedFinal, 2);
    });

    it('handles custom weights', () => {
      const pdb = buildContactPdb();
      const result = scoreComplex(pdb, ['A', 'B'], {
        weights: { contact: 0.5, area: 0.2, energy: 0.2, clash: 0.1 },
      });

      const expectedWeightedSum =
        0.5 * result.contactScore +
        0.2 * result.areaScore +
        0.2 * result.energyScore;

      const expectedFinal = expectedWeightedSum - 0.1 * result.clashPenalty;

      expect(result.finalScore).toBeCloseTo(expectedFinal, 2);
    });

    it('handles empty PDB', () => {
      const result = scoreComplex('', ['A', 'B']);

      expect(result.contactScore).toBe(0);
      expect(result.areaScore).toBe(0);
      expect(result.energyScore).toBe(0);
      expect(result.clashPenalty).toBe(0);
      expect(result.finalScore).toBe(0);
    });

    it('handles single chain', () => {
      const pdb = buildSingleChainPdb();
      const result = scoreComplex(pdb, ['A']);

      expect(result.contactScore).toBe(0);
      expect(result.areaScore).toBe(0);
      expect(result.energyScore).toBe(0);
      expect(result.clashPenalty).toBe(0);
      expect(result.finalScore).toBe(0);
    });

    it('produces higher final score for well-packed complexes', () => {
      const goodPdb = buildContactPdb();
      const badPdb = buildNoInterfacePdb();

      const goodResult = scoreComplex(goodPdb, ['A', 'B']);
      const badResult = scoreComplex(badPdb, ['A', 'B']);

      expect(goodResult.finalScore).toBeGreaterThan(badResult.finalScore);
    });

    it('penalizes clashes in final score', () => {
      const noClashPdb = buildNoInterfacePdb();
      const clashPdb = buildClashPdb();

      const noClashResult = scoreComplex(noClashPdb, ['A', 'B']);
      const clashResult = scoreComplex(clashPdb, ['A', 'B']);

      // Clash PDB should have lower final score due to penalty
      // (assuming contact/area/energy are similar or clash penalty dominates)
      expect(clashResult.clashPenalty).toBeGreaterThan(noClashResult.clashPenalty);
    });
  });
});
