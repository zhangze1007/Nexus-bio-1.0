/**
 * Confidence Visualization Mapping Tests
 *
 * Tests for pLDDT per-residue mapping, ipTM per-chain mapping,
 * color scales, export functions, and summary statistics.
 */

import {
  mapPLDDT,
  mapIPTM,
  confidenceToColor,
  exportConfidenceJSON,
  exportConfidenceCSV,
  computeConfidenceSummary,
} from '../visualization';
import type { ResidueConfidence, ChainConfidence } from '../types';

// ── pLDDT Per-Residue Mapping ─────────────────────────────────────────────────

describe('mapPLDDT', () => {
  it('maps scores to per-residue confidence objects', () => {
    const scores = [95, 75, 55, 30];
    const result = mapPLDDT(scores);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      residueIndex: 0,
      score: 95,
      confidence: 'very_high',
      color: expect.stringMatching(/^#[0-9a-f]{6}$/),
    });
    expect(result[1].score).toBe(75);
    expect(result[2].score).toBe(55);
    expect(result[3].score).toBe(30);
  });

  it('classifies confidence levels correctly', () => {
    const scores = [95, 90, 89, 70, 69, 50, 49, 0];
    const result = mapPLDDT(scores);

    expect(result[0].confidence).toBe('very_high'); // 95 > 90
    expect(result[1].confidence).toBe('high');       // 90: not > 90, >= 70
    expect(result[2].confidence).toBe('high');       // 89: >= 70
    expect(result[3].confidence).toBe('high');       // 70: >= 70
    expect(result[4].confidence).toBe('low');        // 69: < 70, >= 50
    expect(result[5].confidence).toBe('low');        // 50: >= 50
    expect(result[6].confidence).toBe('very_low');   // 49: < 50
    expect(result[7].confidence).toBe('very_low');   // 0
  });

  it('uses custom residue indices when provided', () => {
    const scores = [80, 60];
    const indices = [100, 200];
    const result = mapPLDDT(scores, indices);

    expect(result[0].residueIndex).toBe(100);
    expect(result[1].residueIndex).toBe(200);
  });

  it('uses sequential indices by default', () => {
    const scores = [80, 60, 40];
    const result = mapPLDDT(scores);

    expect(result[0].residueIndex).toBe(0);
    expect(result[1].residueIndex).toBe(1);
    expect(result[2].residueIndex).toBe(2);
  });

  it('returns empty array for empty input', () => {
    const result = mapPLDDT([]);
    expect(result).toEqual([]);
  });

  it('clamps out-of-range scores', () => {
    const result = mapPLDDT([150, -10]);

    expect(result[0].score).toBe(100);
    expect(result[1].score).toBe(0);
  });

  it('handles single element', () => {
    const result = mapPLDDT([85]);

    expect(result).toHaveLength(1);
    expect(result[0].residueIndex).toBe(0);
    expect(result[0].score).toBe(85);
    expect(result[0].confidence).toBe('high');
  });
});

// ── ipTM Per-Chain Mapping ────────────────────────────────────────────────────

describe('mapIPTM', () => {
  it('maps score to all chains', () => {
    const result = mapIPTM(0.85, ['A', 'B', 'C']);

    expect(result).toHaveLength(3);
    expect(result[0].chainId).toBe('A');
    expect(result[1].chainId).toBe('B');
    expect(result[2].chainId).toBe('C');
  });

  it('applies same score to all chains', () => {
    const result = mapIPTM(0.72, ['A', 'B']);

    expect(result[0].score).toBe(0.72);
    expect(result[1].score).toBe(0.72);
  });

  it('returns valid hex colors', () => {
    const result = mapIPTM(0.5, ['A']);

    expect(result[0].color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('returns empty array for empty chain list', () => {
    const result = mapIPTM(0.8, []);
    expect(result).toEqual([]);
  });

  it('clamps out-of-range scores', () => {
    const resultHigh = mapIPTM(1.5, ['A']);
    const resultLow = mapIPTM(-0.1, ['A']);

    expect(resultHigh[0].score).toBe(1);
    expect(resultLow[0].score).toBe(0);
  });

  it('handles single chain', () => {
    const result = mapIPTM(0.65, ['X']);

    expect(result).toHaveLength(1);
    expect(result[0].chainId).toBe('X');
    expect(result[0].score).toBe(0.65);
  });
});

// ── Color Mapping ─────────────────────────────────────────────────────────────

describe('confidenceToColor', () => {
  it('returns valid 6-digit hex colors', () => {
    const colors = [0, 0.25, 0.5, 0.75, 1].map((v) => confidenceToColor(v));

    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('returns red for low confidence (plddt scale)', () => {
    const color = confidenceToColor(0, 'plddt');
    expect(color).toBe('#ff0000');
  });

  it('returns blue for high confidence (plddt scale)', () => {
    const color = confidenceToColor(1, 'plddt');
    expect(color).toBe('#0000ff');
  });

  it('returns black for 0 (grayscale)', () => {
    const color = confidenceToColor(0, 'grayscale');
    expect(color).toBe('#000000');
  });

  it('returns white for 1 (grayscale)', () => {
    const color = confidenceToColor(1, 'grayscale');
    expect(color).toBe('#ffffff');
  });

  it('returns different colors for different scales', () => {
    const plddtColor = confidenceToColor(0.5, 'plddt');
    const rainbowColor = confidenceToColor(0.5, 'rainbow');
    const grayColor = confidenceToColor(0.5, 'grayscale');

    // At t=0.5: plddt=yellow, rainbow=green, gray=mid-gray
    expect(plddtColor).not.toBe(rainbowColor);
    expect(plddtColor).not.toBe(grayColor);
    expect(rainbowColor).not.toBe(grayColor);
  });

  it('defaults to plddt scale', () => {
    const explicit = confidenceToColor(0.3, 'plddt');
    const defaultScale = confidenceToColor(0.3);

    expect(defaultScale).toBe(explicit);
  });

  it('clamps values to [0, 1]', () => {
    const over = confidenceToColor(2);
    const under = confidenceToColor(-1);

    expect(over).toBe(confidenceToColor(1));
    expect(under).toBe(confidenceToColor(0));
  });

  it('handles rainbow scale boundaries', () => {
    const red = confidenceToColor(0, 'rainbow');
    const blue = confidenceToColor(1, 'rainbow');

    expect(red).toBe('#ff0000');
    expect(blue).toBe('#0000ff');
  });
});

// ── Export Functions ──────────────────────────────────────────────────────────

describe('exportConfidenceJSON', () => {
  it('returns parseable JSON', () => {
    const residues: ResidueConfidence[] = [
      { residueIndex: 0, score: 95, confidence: 'very_high', color: '#0000ff' },
    ];
    const chains: ChainConfidence[] = [
      { chainId: 'A', score: 0.85, color: '#0040ff' },
    ];

    const json = exportConfidenceJSON(residues, chains);
    const parsed = JSON.parse(json);

    expect(parsed.residues).toHaveLength(1);
    expect(parsed.chains).toHaveLength(1);
    expect(parsed.residues[0].score).toBe(95);
    expect(parsed.chains[0].chainId).toBe('A');
  });

  it('produces pretty-printed output with 2-space indent', () => {
    const json = exportConfidenceJSON([], []);
    expect(json).toContain('\n');
    expect(json).toContain('  ');
  });

  it('handles empty arrays', () => {
    const json = exportConfidenceJSON([], []);
    const parsed = JSON.parse(json);

    expect(parsed.residues).toEqual([]);
    expect(parsed.chains).toEqual([]);
  });
});

describe('exportConfidenceCSV', () => {
  it('produces correct header row', () => {
    const csv = exportConfidenceCSV([]);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('residueIndex,score,confidence,color');
  });

  it('exports residue data as CSV rows', () => {
    const residues: ResidueConfidence[] = [
      { residueIndex: 0, score: 95, confidence: 'very_high', color: '#0000ff' },
      { residueIndex: 1, score: 60, confidence: 'low', color: '#ffff00' },
    ];

    const csv = exportConfidenceCSV(residues);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[1]).toBe('0,95,very_high,#0000ff');
    expect(lines[2]).toBe('1,60,low,#ffff00');
  });

  it('handles empty residues', () => {
    const csv = exportConfidenceCSV([]);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(1); // header only
  });
});

// ── Summary Statistics ────────────────────────────────────────────────────────

describe('computeConfidenceSummary', () => {
  const makeResidues = (scores: number[]): ResidueConfidence[] =>
    mapPLDDT(scores);

  const makeChains = (scores: number[]): ChainConfidence[] =>
    scores.map((s, i) => ({
      chainId: String.fromCharCode(65 + i), // A, B, C, ...
      score: s,
      color: '#000000',
    }));

  it('computes correct mean', () => {
    const residues = makeResidues([80, 90, 70]);
    const chains = makeChains([0.8]);
    const summary = computeConfidenceSummary(residues, chains);

    expect(summary.residueMean).toBeCloseTo(80, 1);
  });

  it('computes correct min and max', () => {
    const residues = makeResidues([50, 95, 70, 30]);
    const chains = makeChains([0.7]);
    const summary = computeConfidenceSummary(residues, chains);

    expect(summary.residueMin).toBe(30);
    expect(summary.residueMax).toBe(95);
  });

  it('computes correct standard deviation', () => {
    // Known values: [70, 80, 90], mean=80
    // variance = ((70-80)^2 + (80-80)^2 + (90-80)^2) / 3 = 200/3 ≈ 66.67
    // std = sqrt(66.67) ≈ 8.165
    const residues = makeResidues([70, 80, 90]);
    const chains = makeChains([0.8]);
    const summary = computeConfidenceSummary(residues, chains);

    expect(summary.residueStd).toBeCloseTo(8.165, 1);
  });

  it('counts residues by confidence level', () => {
    // 95 -> very_high, 80 -> high, 60 -> low, 30 -> very_low
    const residues = makeResidues([95, 80, 60, 30]);
    const chains = makeChains([0.7]);
    const summary = computeConfidenceSummary(residues, chains);

    expect(summary.counts.very_high).toBe(1);
    expect(summary.counts.high).toBe(1);
    expect(summary.counts.low).toBe(1);
    expect(summary.counts.very_low).toBe(1);
  });

  it('computes overall confidence as mean chain score', () => {
    const residues = makeResidues([80]);
    const chains = makeChains([0.6, 0.9]);
    const summary = computeConfidenceSummary(residues, chains);

    expect(summary.overallConfidence).toBeCloseTo(0.75, 2);
  });

  it('handles empty residues', () => {
    const chains = makeChains([0.5]);
    const summary = computeConfidenceSummary([], chains);

    expect(summary.residueMean).toBe(0);
    expect(summary.residueMin).toBe(0);
    expect(summary.residueMax).toBe(0);
    expect(summary.residueStd).toBe(0);
    expect(summary.overallConfidence).toBe(0.5);
    expect(summary.counts).toEqual({ very_high: 0, high: 0, low: 0, very_low: 0 });
  });

  it('handles empty chains', () => {
    const residues = makeResidues([80]);
    const summary = computeConfidenceSummary(residues, []);

    expect(summary.overallConfidence).toBe(0);
    expect(summary.residueMean).toBe(80);
  });

  it('handles both empty', () => {
    const summary = computeConfidenceSummary([], []);

    expect(summary.residueMean).toBe(0);
    expect(summary.residueMin).toBe(0);
    expect(summary.residueMax).toBe(0);
    expect(summary.residueStd).toBe(0);
    expect(summary.overallConfidence).toBe(0);
    expect(summary.counts).toEqual({ very_high: 0, high: 0, low: 0, very_low: 0 });
  });

  it('handles single residue', () => {
    const residues = makeResidues([75]);
    const chains = makeChains([0.75]);
    const summary = computeConfidenceSummary(residues, chains);

    expect(summary.residueMean).toBe(75);
    expect(summary.residueMin).toBe(75);
    expect(summary.residueMax).toBe(75);
    expect(summary.residueStd).toBe(0); // single value has 0 std
  });

  it('correctly counts multiple residues in same level', () => {
    // 95, 92 -> very_high; 80, 75 -> high; 55 -> low; 40 -> very_low
    const residues = makeResidues([95, 92, 80, 75, 55, 40]);
    const chains = makeChains([0.8]);
    const summary = computeConfidenceSummary(residues, chains);

    expect(summary.counts.very_high).toBe(2);
    expect(summary.counts.high).toBe(2);
    expect(summary.counts.low).toBe(1);
    expect(summary.counts.very_low).toBe(1);
  });
});
