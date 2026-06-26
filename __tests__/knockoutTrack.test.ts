/**
 * Tests for knockout track builder — knockoutTrack.ts
 */

import {
  buildKnockoutTrack,
  buildEssentialGeneTrack,
  summarizeKnockouts,
  type KnockoutTarget,
} from '../src/components/visualizations/knockoutTrack';

const MOCK_KNOCKOUTS: KnockoutTarget[] = [
  {
    geneId: 'b1779',
    geneName: 'gapA',
    start: 1858681,
    end: 1859682,
    strand: '+',
    impact: 'essential',
    growthImpact: -1.0,
    efficiency: 0.95,
    phenotype: 'Lethal',
  },
  {
    geneId: 'b1676',
    geneName: 'pykF',
    start: 1753966,
    end: 1755381,
    strand: '+',
    impact: 'beneficial',
    growthImpact: -0.18,
    efficiency: 0.92,
    phenotype: 'Flux redirect',
  },
  {
    geneId: 'b1852',
    geneName: 'zwf',
    start: 1935234,
    end: 1936763,
    strand: '+',
    impact: 'neutral',
    growthImpact: -0.12,
    efficiency: 0.95,
    phenotype: 'PPP reduction',
  },
  {
    geneId: 'b3916',
    geneName: 'pfkA',
    start: 4107530,
    end: 4108486,
    strand: '+',
    impact: 'deleterious',
    growthImpact: -0.45,
    efficiency: 0.85,
    phenotype: 'Growth defect',
  },
];

describe('buildKnockoutTrack', () => {
  it('returns a valid GenomeTrack with correct structure', () => {
    const track = buildKnockoutTrack(MOCK_KNOCKOUTS, 'chr');

    expect(track.name).toBe('Knockout Targets');
    expect(track.type).toBe('annotation');
    expect(track.format).toBe('bed');
    expect(track.features).toHaveLength(4);
  });

  it('generates BED-format features with correct coordinates', () => {
    const track = buildKnockoutTrack(MOCK_KNOCKOUTS, 'chr');

    const first = track.features![0];
    expect(first.chr).toBe('chr');
    expect(first.start).toBe(1858681);
    expect(first.end).toBe(1859682);
    expect(first.strand).toBe('+');
    expect(first.name).toBe('gapA');
  });

  it('assigns impact colors correctly', () => {
    const track = buildKnockoutTrack(MOCK_KNOCKOUTS, 'chr');

    // Essential = coral
    expect(track.features![0].color).toBe('#E8A3A1');
    // Beneficial = green
    expect(track.features![1].color).toBe('#9ECE7E');
    // Neutral = sky
    expect(track.features![2].color).toBe('#AFC3D6');
    // Deleterious = apricot
    expect(track.features![3].color).toBe('#E7C7A9');
  });

  it('includes description with gene details', () => {
    const track = buildKnockoutTrack(MOCK_KNOCKOUTS, 'chr');

    const desc = track.features![0].description!;
    expect(desc).toContain('gapA');
    expect(desc).toContain('b1779');
    expect(desc).toContain('Essential');
    expect(desc).toContain('-100%'); // growthImpact * 100
    expect(desc).toContain('95%');   // efficiency * 100
    expect(desc).toContain('Lethal');
  });

  it('handles empty knockout array', () => {
    const track = buildKnockoutTrack([], 'chr');

    expect(track.features).toHaveLength(0);
    expect(track.name).toBe('Knockout Targets');
  });

  it('uses score field for growthImpact', () => {
    const track = buildKnockoutTrack(MOCK_KNOCKOUTS, 'chr');

    expect(track.features![0].score).toBe(-1.0);
    expect(track.features![1].score).toBe(-0.18);
  });

  it('uses provided chromosome identifier', () => {
    const track = buildKnockoutTrack(MOCK_KNOCKOUTS, 'NC_000913.3');

    expect(track.features![0].chr).toBe('NC_000913.3');
  });
});

describe('buildEssentialGeneTrack', () => {
  it('creates track with all genes marked as essential', () => {
    const genes = [
      { geneId: 'b1779', geneName: 'gapA', start: 1858681, end: 1859682, strand: '+' as const },
      { geneId: 'b0755', geneName: 'gpmA', start: 786658, end: 787308, strand: '+' as const },
    ];

    const track = buildEssentialGeneTrack(genes, 'chr');

    expect(track.features).toHaveLength(2);
    expect(track.features![0].color).toBe('#E8A3A1');
    expect(track.features![1].color).toBe('#E8A3A1');
    expect(track.features![0].name).toBe('gapA');
  });

  it('includes essential impact label in description', () => {
    const genes = [
      { geneId: 'b1779', geneName: 'gapA', start: 1858681, end: 1859682, strand: '+' as const },
    ];

    const track = buildEssentialGeneTrack(genes, 'chr');

    expect(track.features![0].description).toContain('Essential');
  });
});

describe('summarizeKnockouts', () => {
  it('counts knockouts by impact category', () => {
    const summary = summarizeKnockouts(MOCK_KNOCKOUTS);

    expect(summary.total).toBe(4);
    expect(summary.essential).toBe(1);
    expect(summary.beneficial).toBe(1);
    expect(summary.neutral).toBe(1);
    expect(summary.deleterious).toBe(1);
  });

  it('calculates average growth impact', () => {
    const summary = summarizeKnockouts(MOCK_KNOCKOUTS);
    const expected = (-1.0 + -0.18 + -0.12 + -0.45) / 4;

    expect(summary.avgGrowthImpact).toBeCloseTo(expected, 2);
  });

  it('handles empty array', () => {
    const summary = summarizeKnockouts([]);

    expect(summary.total).toBe(0);
    expect(summary.essential).toBe(0);
    expect(summary.beneficial).toBe(0);
    expect(summary.neutral).toBe(0);
    expect(summary.deleterious).toBe(0);
    expect(summary.avgGrowthImpact).toBe(0);
  });

  it('handles knockouts without growthImpact', () => {
    const minimal: KnockoutTarget[] = [
      { geneId: 'b0001', geneName: 'thrA', start: 337, end: 2799, strand: '+', impact: 'essential' },
    ];

    const summary = summarizeKnockouts(minimal);

    expect(summary.total).toBe(1);
    expect(summary.avgGrowthImpact).toBe(0);
  });
});
