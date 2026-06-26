/**
 * Tests for CRISPR track builder — crisprTrack.ts
 */

import { buildCRISPRTrack, summarizeGuides, type CRISPRGuide } from '../src/components/visualizations/crisprTrack';

const MOCK_GUIDES: CRISPRGuide[] = [
  {
    sequence: 'ATGCGATCGATCGATCGATC',
    targetStart: 1000,
    targetEnd: 1023,
    score: 0.85,
    offTargets: 0,
    strand: '+',
    geneName: 'gapA',
    pam: 'NGG',
  },
  {
    sequence: 'GCTAGCTAGCTAGCTAGCTA',
    targetStart: 2000,
    targetEnd: 2023,
    score: 0.6,
    offTargets: 3,
    strand: '-',
    geneName: 'pykF',
  },
  {
    sequence: 'TTTTAAAACCCCGGGGTTTT',
    targetStart: 3000,
    targetEnd: 3023,
    score: 0.3,
    offTargets: 8,
    strand: '+',
  },
  {
    sequence: 'AAAAAAAAAAAAAAAAAAAA',
    targetStart: 4000,
    targetEnd: 4023,
    score: 0.75,
    offTargets: 1,
    strand: '+',
    geneName: 'zwf',
  },
];

describe('buildCRISPRTrack', () => {
  it('returns a valid GenomeTrack with correct structure', () => {
    const track = buildCRISPRTrack(MOCK_GUIDES, 'chr');

    expect(track.name).toBe('CRISPR Targets');
    expect(track.type).toBe('annotation');
    expect(track.format).toBe('bed');
    expect(track.features).toHaveLength(4);
  });

  it('generates BED-format features with correct coordinates', () => {
    const track = buildCRISPRTrack(MOCK_GUIDES, 'chr');

    const first = track.features![0];
    expect(first.chr).toBe('chr');
    expect(first.start).toBe(1000);
    expect(first.end).toBe(1023);
    expect(first.strand).toBe('+');
  });

  it('includes gene name in feature name when available', () => {
    const track = buildCRISPRTrack(MOCK_GUIDES, 'chr');

    const withGene = track.features!.find((f: { name?: string }) => f.name!.includes('gapA'));
    expect(withGene).toBeDefined();
    expect(withGene!.name).toContain('ATGCGATC');

    const withoutGene = track.features!.find((f: { start: number }) => f.start === 3000);
    expect(withoutGene).toBeDefined();
    expect(withoutGene!.name).toContain('TTTTAAAA');
  });

  it('assigns colors based on off-target risk', () => {
    const track = buildCRISPRTrack(MOCK_GUIDES, 'chr');

    // Excellent: 0 off-targets, score >= 0.7
    const excellent = track.features![0];
    expect(excellent.color).toBe('#9ECE7E');

    // Caution: 3 off-targets
    const caution = track.features![1];
    expect(caution.color).toBe('#D9BC5D');

    // High Risk: 8 off-targets
    const highRisk = track.features![2];
    expect(highRisk.color).toBe('#D96562');

    // Good: 1 off-target, score >= 0.5
    const good = track.features![3];
    expect(good.color).toBe('#86C2C6');
  });

  it('includes description field with guide details', () => {
    const track = buildCRISPRTrack(MOCK_GUIDES, 'chr');

    const desc = track.features![0].description!;
    expect(desc).toContain('ATGCGATCGATCGATCGATC');
    expect(desc).toContain('PAM: NGG');
    expect(desc).toContain('Efficiency: 85%');
    expect(desc).toContain('Off-targets: 0');
    expect(desc).toContain('Optimal');
  });

  it('handles empty guide array', () => {
    const track = buildCRISPRTrack([], 'chr');

    expect(track.features).toHaveLength(0);
    expect(track.name).toBe('CRISPR Targets');
  });

  it('preserves score field in features', () => {
    const track = buildCRISPRTrack(MOCK_GUIDES, 'chr');

    expect(track.features![0].score).toBe(0.85);
    expect(track.features![2].score).toBe(0.3);
  });

  it('uses provided chromosome identifier', () => {
    const track = buildCRISPRTrack(MOCK_GUIDES, 'NC_000913.3');

    expect(track.features![0].chr).toBe('NC_000913.3');
  });
});

describe('summarizeGuides', () => {
  it('counts guides by quality category', () => {
    const summary = summarizeGuides(MOCK_GUIDES);

    expect(summary.total).toBe(4);
    expect(summary.optimal).toBe(1);  // gapA: 0 off-targets, 0.85 score
    expect(summary.good).toBe(1);     // zwf: 1 off-target, 0.75 score
    expect(summary.caution).toBe(1);  // pykF: 3 off-targets
    expect(summary.highRisk).toBe(1); // unnamed: 8 off-targets
  });

  it('calculates average score', () => {
    const summary = summarizeGuides(MOCK_GUIDES);
    const expectedAvg = (0.85 + 0.6 + 0.3 + 0.75) / 4;

    expect(summary.avgScore).toBeCloseTo(expectedAvg, 2);
  });

  it('calculates average off-targets', () => {
    const summary = summarizeGuides(MOCK_GUIDES);
    const expectedAvg = (0 + 3 + 8 + 1) / 4;

    expect(summary.avgOffTargets).toBeCloseTo(expectedAvg, 2);
  });

  it('handles empty array', () => {
    const summary = summarizeGuides([]);

    expect(summary.total).toBe(0);
    expect(summary.optimal).toBe(0);
    expect(summary.good).toBe(0);
    expect(summary.caution).toBe(0);
    expect(summary.highRisk).toBe(0);
    expect(summary.avgScore).toBe(0);
    expect(summary.avgOffTargets).toBe(0);
  });
});
