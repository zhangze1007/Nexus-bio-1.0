/**
 * Confidence Scorer Tests
 *
 * Tests for pLDDT extraction from PDB B-factor columns, quality classification,
 * low-confidence region detection, and color mapping.
 */

import {
  extractPLDDTFromPDB,
  extractPLDDTByChain,
  pLDDTtoColor,
  pLDDTColorPalette,
  classifyQuality,
  detectLowConfidenceRegions,
  analyzeConfidence,
} from '../../src/services/protein/confidenceScorer';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/**
 * Generate a minimal PDB with per-residue B-factor values.
 * Each CA atom gets the specified B-factor.
 *
 * PDB fixed-width columns (0-indexed):
 *   0-5:  record name
 *   6-10: atom serial
 *   11:   space
 *   12-15: atom name (4 chars)
 *   16:   altLoc
 *   17-19: residue name (3 chars)
 *   20:   space
 *   21:   chain ID
 *   22-25: residue sequence number
 *   30-37: x
 *   38-45: y
 *   46-53: z
 *   54-59: occupancy
 *   60-65: B-factor
 */
function makePDB(bFactors: number[], chainId = 'A'): string {
  const lines = ['HEADER    TEST STRUCTURE'];
  for (let i = 0; i < bFactors.length; i++) {
    const serial = (i + 1).toString().padStart(5);
    const resSeq = (i + 1).toString().padStart(4);
    const x = (i * 3.8).toFixed(3).padStart(8);
    const y = (0).toFixed(3).padStart(8);
    const z = (0).toFixed(3).padStart(8);
    const bf = bFactors[i].toFixed(2).padStart(6);
    // ATOM  (6) + serial(5) + " " + name(4) + altLoc(1) + resName(3) + " " + chain(1) + resSeq(4) + "    " + x(8) + y(8) + z(8) + "  1.00" + bf(6) + "           N"
    lines.push(
      `ATOM  ${serial}  N   ALA ${chainId}${resSeq}    ${x}${y}${z}  1.00${bf}           N`,
    );
    lines.push(
      `ATOM  ${(i * 4 + 2).toString().padStart(5)}  CA  ALA ${chainId}${resSeq}    ${x}${y}${z}  1.00${bf}           C`,
    );
  }
  lines.push('END');
  return lines.join('\n');
}

/**
 * Generate a multi-chain PDB with different B-factors per chain.
 * Chain ID placed at column 22 (index 21) per PDB spec.
 */
function makeMultiChainPDB(chainData: Record<string, number[]>): string {
  const lines = ['HEADER    MULTI-CHAIN TEST'];
  let atomIdx = 1;
  for (const [chainId, bFactors] of Object.entries(chainData)) {
    for (let i = 0; i < bFactors.length; i++) {
      const serial = atomIdx.toString().padStart(5);
      const resSeq = (i + 1).toString().padStart(4);
      const x = (i * 3.8).toFixed(3).padStart(8);
      const y = (0).toFixed(3).padStart(8);
      const z = (0).toFixed(3).padStart(8);
      const bf = bFactors[i].toFixed(2).padStart(6);
      lines.push(
        `ATOM  ${serial}  CA  ALA ${chainId}${resSeq}    ${x}${y}${z}  1.00${bf}           C`,
      );
      atomIdx++;
    }
    lines.push('TER');
  }
  lines.push('END');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// extractPLDDTFromPDB
// ---------------------------------------------------------------------------

describe('extractPLDDTFromPDB', () => {
  it('extracts B-factors from CA atoms', () => {
    const pdb = makePDB([95, 82, 65, 45, 30]);
    const plddt = extractPLDDTFromPDB(pdb);
    expect(plddt).toEqual([95, 82, 65, 45, 30]);
  });

  it('returns empty array for PDB with no ATOM records', () => {
    const pdb = 'HEADER    EMPTY\nEND';
    expect(extractPLDDTFromPDB(pdb)).toEqual([]);
  });

  it('handles single residue', () => {
    const pdb = makePDB([88.5]);
    const plddt = extractPLDDTFromPDB(pdb);
    expect(plddt).toHaveLength(1);
    expect(plddt[0]).toBeCloseTo(88.5, 1);
  });

  it('handles multi-chain PDB (takes first CA per residue per chain)', () => {
    const pdb = makeMultiChainPDB({ A: [90, 80], B: [70, 60] });
    const plddt = extractPLDDTFromPDB(pdb);
    // Should get all 4 values (one per unique chain:residue)
    expect(plddt).toHaveLength(4);
  });

  it('skips non-CA atoms', () => {
    const lines = [
      'HEADER    MIXED ATOMS',
      'ATOM      1 N   ALA A   1       0.000   0.000   0.000  1.00 99.00           N  ',
      'ATOM      2 CA  ALA A   1       1.500   0.000   0.000  1.00 85.00           C  ',
      'ATOM      3 C   ALA A   1       3.000   0.000   0.000  1.00 99.00           C  ',
      'ATOM      4 O   ALA A   1       1.500   1.500   0.000  1.00 99.00           O  ',
      'END',
    ];
    const plddt = extractPLDDTFromPDB(lines.join('\n'));
    expect(plddt).toEqual([85]);
  });

  it('produces a large array for a realistic protein', () => {
    const bfactors = Array.from({ length: 200 }, (_, i) => 50 + Math.sin(i * 0.1) * 40);
    const pdb = makePDB(bfactors);
    const plddt = extractPLDDTFromPDB(pdb);
    expect(plddt).toHaveLength(200);
    expect(plddt[0]).toBeCloseTo(bfactors[0], 0);
  });
});

// ---------------------------------------------------------------------------
// extractPLDDTByChain
// ---------------------------------------------------------------------------

describe('extractPLDDTByChain', () => {
  it('groups pLDDT by chain', () => {
    const pdb = makeMultiChainPDB({ A: [90, 85], B: [70, 65] });
    const chains = extractPLDDTByChain(pdb);
    expect(chains.size).toBe(2);
    expect(chains.get('A')).toEqual([90, 85]);
    expect(chains.get('B')).toEqual([70, 65]);
  });

  it('returns empty map for empty PDB', () => {
    const chains = extractPLDDTByChain('HEADER\nEND');
    expect(chains.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// pLDDTtoColor
// ---------------------------------------------------------------------------

describe('pLDDTtoColor', () => {
  it('returns blue for pLDDT > 90', () => {
    expect(pLDDTtoColor(95)).toBe('#0053D6');
    expect(pLDDTtoColor(100)).toBe('#0053D6');
  });

  it('returns cyan for pLDDT 70-90', () => {
    expect(pLDDTtoColor(90)).toBe('#65CBF3');
    expect(pLDDTtoColor(80)).toBe('#65CBF3');
    expect(pLDDTtoColor(70)).toBe('#65CBF3');
  });

  it('returns yellow for pLDDT 50-70', () => {
    expect(pLDDTtoColor(69)).toBe('#FFDB13');
    expect(pLDDTtoColor(60)).toBe('#FFDB13');
    expect(pLDDTtoColor(50)).toBe('#FFDB13');
  });

  it('returns orange for pLDDT < 50', () => {
    expect(pLDDTtoColor(49)).toBe('#FF7D45');
    expect(pLDDTtoColor(20)).toBe('#FF7D45');
    expect(pLDDTtoColor(0)).toBe('#FF7D45');
  });
});

// ---------------------------------------------------------------------------
// pLDDTColorPalette
// ---------------------------------------------------------------------------

describe('pLDDTColorPalette', () => {
  it('returns 4 entries', () => {
    const palette = pLDDTColorPalette();
    expect(palette).toHaveLength(4);
  });

  it('has descending thresholds', () => {
    const palette = pLDDTColorPalette();
    for (let i = 0; i < palette.length - 1; i++) {
      expect(palette[i].threshold).toBeGreaterThan(palette[i + 1].threshold);
    }
  });
});

// ---------------------------------------------------------------------------
// classifyQuality
// ---------------------------------------------------------------------------

describe('classifyQuality', () => {
  it('returns high for mean pLDDT >= 70', () => {
    expect(classifyQuality(90)).toBe('high');
    expect(classifyQuality(70)).toBe('high');
  });

  it('returns medium for mean pLDDT 50-69', () => {
    expect(classifyQuality(69)).toBe('medium');
    expect(classifyQuality(50)).toBe('medium');
  });

  it('returns low for mean pLDDT 30-49', () => {
    expect(classifyQuality(49)).toBe('low');
    expect(classifyQuality(30)).toBe('low');
  });

  it('returns very_low for mean pLDDT < 30', () => {
    expect(classifyQuality(29)).toBe('very_low');
    expect(classifyQuality(0)).toBe('very_low');
  });
});

// ---------------------------------------------------------------------------
// detectLowConfidenceRegions
// ---------------------------------------------------------------------------

describe('detectLowConfidenceRegions', () => {
  it('detects a single low-confidence region', () => {
    const plddt = [90, 92, 40, 42, 38, 88, 91];
    const regions = detectLowConfidenceRegions(plddt);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toEqual({ start: 2, end: 4 });
  });

  it('detects multiple low-confidence regions', () => {
    const plddt = [30, 90, 92, 40, 42, 90, 20, 25, 90];
    const regions = detectLowConfidenceRegions(plddt);
    expect(regions).toHaveLength(3);
    expect(regions[0]).toEqual({ start: 0, end: 0 });
    expect(regions[1]).toEqual({ start: 3, end: 4 });
    expect(regions[2]).toEqual({ start: 6, end: 7 });
  });

  it('returns empty array when all residues are confident', () => {
    const plddt = [90, 85, 92, 78, 95];
    const regions = detectLowConfidenceRegions(plddt);
    expect(regions).toEqual([]);
  });

  it('handles entire sequence below threshold', () => {
    const plddt = [30, 20, 40, 10];
    const regions = detectLowConfidenceRegions(plddt);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toEqual({ start: 0, end: 3 });
  });

  it('handles empty array', () => {
    expect(detectLowConfidenceRegions([])).toEqual([]);
  });

  it('respects custom threshold', () => {
    const plddt = [80, 82, 85, 90];
    // With threshold 85, only 80 and 82 are strictly below (85 is not < 85)
    const regions = detectLowConfidenceRegions(plddt, 85);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toEqual({ start: 0, end: 1 });
  });

  it('detects low-confidence at start and end', () => {
    const plddt = [20, 25, 90, 92, 30];
    const regions = detectLowConfidenceRegions(plddt);
    expect(regions).toHaveLength(2);
    expect(regions[0]).toEqual({ start: 0, end: 1 });
    expect(regions[1]).toEqual({ start: 4, end: 4 });
  });
});

// ---------------------------------------------------------------------------
// analyzeConfidence (integration)
// ---------------------------------------------------------------------------

describe('analyzeConfidence', () => {
  it('produces high-quality analysis for a confident structure', () => {
    const bfactors = Array.from({ length: 100 }, () => 90 + Math.random() * 8);
    const pdb = makePDB(bfactors);
    const analysis = analyzeConfidence(pdb, 0.8, null);

    expect(analysis.overallQuality).toBe('high');
    expect(analysis.pTM).toBe(0.8);
    expect(analysis.ipTM).toBeNull();
    expect(analysis.meanPLDDT).toBeGreaterThanOrEqual(90);
    expect(analysis.perResidueConfidence).toHaveLength(100);
    expect(analysis.lowConfidenceRegions).toEqual([]);
    expect(analysis.interpretation).toContain('High-confidence');
  });

  it('produces medium-quality analysis', () => {
    const bfactors = Array.from({ length: 50 }, () => 55 + Math.random() * 15);
    const pdb = makePDB(bfactors);
    const analysis = analyzeConfidence(pdb, 0.5, null);

    expect(analysis.overallQuality).toBe('medium');
    expect(analysis.interpretation).toContain('Medium-confidence');
  });

  it('produces low-quality analysis with regions', () => {
    const bfactors = [
      ...Array.from({ length: 20 }, () => 90), // high confidence
      ...Array.from({ length: 15 }, () => 30), // low confidence
      ...Array.from({ length: 15 }, () => 85), // high again
    ];
    const pdb = makePDB(bfactors);
    const analysis = analyzeConfidence(pdb, 0.3, null);

    expect(analysis.overallQuality).toBe('high'); // mean is pulled up
    expect(analysis.lowConfidenceRegions).toHaveLength(1);
    expect(analysis.lowConfidenceRegions[0]).toEqual({ start: 20, end: 34 });
    expect(analysis.interpretation).toContain('low-confidence region');
  });

  it('includes ipTM interpretation for complexes', () => {
    const bfactors = Array.from({ length: 50 }, () => 85);
    const pdb = makePDB(bfactors);
    const analysis = analyzeConfidence(pdb, 0.75, 0.85);

    expect(analysis.ipTM).toBe(0.85);
    expect(analysis.interpretation).toContain('interface confidence');
    expect(analysis.interpretation).toContain('reliable');
  });

  it('handles empty PDB gracefully', () => {
    const analysis = analyzeConfidence('HEADER\nEND', 0, null);

    expect(analysis.overallQuality).toBe('very_low');
    expect(analysis.meanPLDDT).toBe(0);
    expect(analysis.perResidueConfidence).toEqual([]);
    expect(analysis.lowConfidenceRegions).toEqual([]);
  });

  it('warns about poor global topology', () => {
    const bfactors = Array.from({ length: 50 }, () => 85);
    const pdb = makePDB(bfactors);
    const analysis = analyzeConfidence(pdb, 0.3, null);

    expect(analysis.interpretation).toContain('Poor global topology');
  });

  it('warns about low interface confidence', () => {
    const bfactors = Array.from({ length: 50 }, () => 85);
    const pdb = makePDB(bfactors);
    const analysis = analyzeConfidence(pdb, 0.7, 0.4);

    expect(analysis.interpretation).toContain('Low interface confidence');
  });
});
