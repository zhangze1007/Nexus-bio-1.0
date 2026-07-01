import {
  minimizeGenome,
  simulateSCRaMbLE,
  scrambleFitnessEffect,
  affectedRegions,
  computeCAI,
  optimizeCodonsForHost,
} from '../src/server/syntheticGenomicsEngine';

describe('syntheticGenomicsEngine', () => {
  const sampleRegions = [
    { id: 'gene1', start: 0, end: 1000, strand: '+' as const, type: 'gene' as const, function: 'hexokinase', essential: true, removable: false },
    { id: 'gene2', start: 1000, end: 2000, strand: '+' as const, type: 'gene' as const, function: 'nonessential', essential: false, removable: true },
    { id: 'reg1', start: 2000, end: 2500, strand: '+' as const, type: 'regulatory' as const, function: 'promoter', essential: false, removable: true },
  ];

  describe('minimizeGenome', () => {
    it('minimizes genome by removing non-essential regions', () => {
      const result = minimizeGenome(sampleRegions, ['gene1']);
      expect(result.removedRegions.length).toBeGreaterThan(0);
      expect(result.minimizedSize).toBeLessThan(result.originalSize);
    });

    it('preserves essential genes', () => {
      const result = minimizeGenome(sampleRegions, ['gene1']);
      expect(result.essentialGenes).toContain('gene1');
      expect(result.removedRegions).not.toContain('gene1');
    });

    it('includes assembly plan', () => {
      const result = minimizeGenome(sampleRegions, ['gene1']);
      expect(result.assemblyPlan.length).toBeGreaterThan(0);
    });

    it('computes safety score', () => {
      const result = minimizeGenome(sampleRegions, ['gene1']);
      expect(result.safetyScore).toBeGreaterThanOrEqual(0);
      expect(result.safetyScore).toBeLessThanOrEqual(1);
    });
  });

  describe('simulateSCRaMbLE', () => {
    it('generates SCRaMbLE events', () => {
      const events = simulateSCRaMbLE(sampleRegions, [500, 1500, 2500], 5);
      expect(events.length).toBe(5);
      expect(['deletion', 'inversion', 'duplication', 'translocation']).toContain(events[0].type);
    });

    it('computes fitness effects', () => {
      const events = simulateSCRaMbLE(sampleRegions, [500, 1500], 3);
      events.forEach(e => {
        expect(e.fitnessEffect).toBeGreaterThanOrEqual(-1);
        expect(e.fitnessEffect).toBeLessThanOrEqual(1);
      });
    });

    // T0-2 anti-decoy: fitnessEffect MUST depend on the CONTENT of the affected
    // region, not be a random draw by event type.
    it('penalizes deletion of an essential region more than a redundant region', () => {
      const essentialSpan = affectedRegions(sampleRegions, 0, 1000);   // gene1 (essential)
      const redundantSpan = affectedRegions(sampleRegions, 1000, 2000); // gene2 (non-essential)

      const essentialEffect = scrambleFitnessEffect('deletion', essentialSpan);
      const redundantEffect = scrambleFitnessEffect('deletion', redundantSpan);

      // Essential deletion must be strictly MORE negative than redundant deletion.
      expect(essentialEffect).toBeLessThan(redundantEffect);
      // And it must be near-lethal, while redundant is near-neutral.
      expect(essentialEffect).toBeLessThan(-0.8);
      expect(redundantEffect).toBeGreaterThan(-0.2);
    });

    it('is reproducible for a fixed seed and varies with the seed', () => {
      const a = simulateSCRaMbLE(sampleRegions, [500, 1500, 2500], 8, 123);
      const b = simulateSCRaMbLE(sampleRegions, [500, 1500, 2500], 8, 123);
      const c = simulateSCRaMbLE(sampleRegions, [500, 1500, 2500], 8, 999);
      expect(a).toEqual(b);            // same seed -> identical
      expect(a).not.toEqual(c);        // different seed -> different run
    });
  });
});

// ── computeCAI Tests ──────────────────────────────────────────────────────

describe('computeCAI', () => {
  it('should return CAI > 0.7 for E. coli highly-expressed gene (lacZ)', () => {
    // lacZ gene from E. coli — highly expressed, natural codon usage
    // Natural genes have CAI 0.6-0.9 (Sharp & Li 1987)
    // Reference: Sharp & Li (1987) Nucleic Acids Res 15:1281-1295
    const lacZ = 'ATGACCATGATTACGGATTCACTGGCCGTCGTTTTACAACGTCGTGACTGGGAAAACCCTGGCGTTACCCAACTTAATCGCCTTGCAGCACATCCCCCTTTCGCCAGCTGGCGTAATAGCGAAGAGGCCCGCACCGATCGCCCTTCCCAACAGTTGCGCAGCCTGAATGGCGAATGGCGCTTTGCCTGGTTTCCGGCACCAGAAGCGGTGCCGGAAAGCTGGCTGGAGTGCGATCTTCCTGAGGCCGATACTGTCGTCGTCCCCTCAAACTGGCAGATGCACGGTTACGATGCGCCCATCTACACCAACGTGACCTATCCCATTACGGTCAATCCGCCGTTTGTTCCCACGGAGAATCCGACGGGTTGTTACTCGCTCACATTTAATGTTGATGAACTAG';

    const cai = computeCAI(lacZ, 'ecoli');
    // lacZ is highly expressed in E. coli, CAI should be > 0.7 (natural gene)
    expect(cai).toBeGreaterThan(0.7);
    expect(cai).toBeLessThanOrEqual(1.0);
  });

  it('should return CAI close to 1.0 for sequence using only optimal codons', () => {
    // Build a sequence using only the most frequent codon for each amino acid
    // ATG (M:27), GCG (A:33), GAA (E:39), GAT (D:32), TTT (F:22)
    // Reference: Nakamura et al. (2000) Nucleic Acids Res 28:292
    const optimalSeq = 'ATGGCGGAAGATTTTATGGCGGAAGATTTTATGGCGGAAGATTTT';
    const cai = computeCAI(optimalSeq, 'ecoli');
    // All codons are the most frequent for their amino acid → CAI ≈ 1.0
    expect(cai).toBeCloseTo(1.0, 1);
  });

  it('should return lower CAI for sequence with rare codons', () => {
    // Sequence using rare codons: CTA (Leu, rare in E. coli), AGA (Arg, rare)
    const rareSeq = 'CTACTACTACTACTACTACTACTACTACTACTA';
    const cai = computeCAI(rareSeq, 'ecoli');
    // Rare codons should give CAI < 0.5
    expect(cai).toBeLessThan(0.5);
  });

  it('should return 0 for empty sequence', () => {
    const cai = computeCAI('', 'ecoli');
    expect(cai).toBe(0);
  });

  it('should compute CAI for yeast codon table', () => {
    // Sequence with yeast-optimal codons
    const seq = 'ATGGCTGAAGATTTT';
    const cai = computeCAI(seq, 'yeast');
    expect(cai).toBeGreaterThan(0);
    expect(cai).toBeLessThanOrEqual(1.0);
  });
});

// ── optimizeCodonsForHost Tests ──────────────────────────────────────────

describe('optimizeCodonsForHost', () => {
  it('should change codons when given a sequence with rare codons', () => {
    // CTA is rare in E. coli (usage = 4 per 1000)
    // CTG is most common Leucine codon (usage = 50 per 1000)
    const rareCodonSeq = 'CTACTACTACTACTACTACTACTACTACTACTA'; // 10x CTA (Leu, rare)
    const optimized = optimizeCodonsForHost(rareCodonSeq, 'ecoli');

    // Should change CTA to CTG (most common Leucine codon)
    expect(optimized).not.toBe(rareCodonSeq);
    expect(optimized).toContain('CTG');
    // Length should be preserved
    expect(optimized).toHaveLength(rareCodonSeq.length);
  });

  it('should not change stop codons', () => {
    const seqWithStop = 'ATGAAATGA'; // ATG (M), AAA (K), TGA (*)
    const optimized = optimizeCodonsForHost(seqWithStop, 'ecoli');
    // Stop codon TGA should be preserved
    expect(optimized.substring(6, 9)).toBe('TGA');
  });

  it('should preserve sequence length', () => {
    const seq = 'ATGCGTCTGAAATTT';
    const optimized = optimizeCodonsForHost(seq, 'ecoli');
    expect(optimized).toHaveLength(seq.length);
  });

  it('should produce valid codons (all in codon table)', () => {
    const seq = 'ATGCGTCTGAAATTTGGCTCT';
    const optimized = optimizeCodonsForHost(seq, 'ecoli');
    // Every 3-character substring should be a valid codon
    for (let i = 0; i < optimized.length - 2; i += 3) {
      const codon = optimized.substring(i, i + 3);
      expect(codon).toMatch(/^[ATCG]{3}$/);
    }
  });

  it('should use yeast codon table when host is yeast', () => {
    // TCG is rare in yeast (usage = 8), TCT is more common (usage = 20)
    const seq = 'TCGTCGTCGTCGTCG';
    const optimized = optimizeCodonsForHost(seq, 'yeast');
    // Should optimize for yeast codon usage
    expect(optimized).toHaveLength(seq.length);
  });
});

// ── GC Content Computation Tests ────────────────────────────────────────

describe('minimizeGenome GC content', () => {
  it('should compute GC content from sequence data when available', () => {
    const regions = [
      {
        id: 'gene1',
        start: 0,
        end: 100,
        strand: '+' as const,
        type: 'gene' as const,
        function: 'test',
        essential: true,
        removable: false,
        sequence: 'GCGCGCGCGCGCGCGCGCGC', // 100% GC
      },
    ];
    const result = minimizeGenome(regions, ['gene1']);
    // GC content should be 1.0 (all G and C)
    expect(result.gcContent).toBeCloseTo(1.0, 2);
  });

  it('should compute GC content from mixed AT/GC sequence', () => {
    const regions = [
      {
        id: 'gene1',
        start: 0,
        end: 100,
        strand: '+' as const,
        type: 'gene' as const,
        function: 'test',
        essential: true,
        removable: false,
        sequence: 'ATATATATATATATATATATGCGCGCGCGCGCGCGCGCGC', // 50% GC
      },
    ];
    const result = minimizeGenome(regions, ['gene1']);
    expect(result.gcContent).toBeCloseTo(0.5, 2);
  });

  it('should use E. coli default when no sequence data available', () => {
    const regions = [
      { id: 'gene1', start: 0, end: 1000, strand: '+' as const, type: 'gene' as const, function: 'test', essential: true, removable: false },
    ];
    const result = minimizeGenome(regions, ['gene1']);
    // Default: E. coli K-12 GC = 50.79% — Hayashi et al. (2013)
    expect(result.gcContent).toBeCloseTo(0.508, 2);
  });
});
