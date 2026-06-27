/**
 * Primer Designer Tests
 *
 * Covers:
 *   - calculateTm (nearest-neighbor delegation)
 *   - checkSelfComplementarity (hairpin/dimer scoring)
 *   - designPrimers (pair design, constraints, edge cases)
 */

import {
  calculateTm,
  checkSelfComplementarity,
  designPrimers,
  PrimerDesignOptions,
} from '../src/services/sequences/primerDesigner';

// ── calculateTm ────────────────────────────────────────────────────────────────

describe('calculateTm', () => {
  it('returns a reasonable Tm for a standard 20-mer', () => {
    const tm = calculateTm('ATCGATCGATCGATCGATCG');
    expect(tm).toBeGreaterThan(40);
    expect(tm).toBeLessThan(90);
  });

  it('returns higher Tm for GC-rich sequences than AT-rich', () => {
    const gcRich = calculateTm('GCGCGCGCGCGCGCGCGCGC');
    const atRich = calculateTm('ATATATATATATATATATAT');
    expect(gcRich).toBeGreaterThan(atRich);
  });

  it('is case-insensitive', () => {
    const upper = calculateTm('ATCGATCGATCGATCG');
    const lower = calculateTm('atcgatcgatcgatcg');
    expect(upper).toBeCloseTo(lower, 4);
  });

  it('handles short sequences via Wallace rule fallback', () => {
    const tmA = calculateTm('A');
    expect(tmA).toBe(2); // 1 AT → 2

    const tmG = calculateTm('G');
    expect(tmG).toBe(4); // 1 GC → 4
  });
});

// ── checkSelfComplementarity ───────────────────────────────────────────────────

describe('checkSelfComplementarity', () => {
  it('returns a low score for an asymmetric sequence', () => {
    const score = checkSelfComplementarity('GACGACGACGACGACGAC');
    expect(score).toBeLessThanOrEqual(0.7);
  });

  it('returns a high score for a palindrome-like sequence', () => {
    const score = checkSelfComplementarity('AATTAATTAATTAATT');
    expect(score).toBeGreaterThan(0);
  });

  it('returns 0 for an empty sequence', () => {
    expect(checkSelfComplementarity('')).toBe(0);
  });

  it('scores are bounded between 0 and 1', () => {
    const score = checkSelfComplementarity('GCGCGCGCGC');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ── designPrimers ──────────────────────────────────────────────────────────────

describe('designPrimers', () => {
  // A realistic ~250 bp synthetic gene fragment with ~50% GC content.
  // Non-repeating base composition produces primers with Tm in the
  // default 55-65 °C window.
  const TEMPLATE = [
    'ATGGCTAGCAAGGTCAACGTGGATTTCAATGCGATCAAGAAGTTCTCCGAT',
    'GATCCAGATGCTATCGAGAAGGCATTGAAGGATGGCTTCCCCGAAGCCATG',
    'AAGCTGGTGGACTCCGTCGATGAAATCGATGCGATTGGCAAGAACTTCGAT',
    'CCAGATCAGATGGCGATTGCCGAAGTCAAGGCTATCGAGGATGGCTTCTCC',
    'GAAGCCATGAAGCTGGTGGATGAAATCGATGCGATTGGCAAGAAGTTCTCC',
  ].join('');

  it('returns at least one primer pair for a valid template', async () => {
    const pairs = await designPrimers(TEMPLATE);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array for templates that are too short', async () => {
    const pairs = await designPrimers('ATCG');
    expect(pairs).toEqual([]);
  });

  it('each pair contains forward and reverse primers with valid sequences', async () => {
    const pairs = await designPrimers(TEMPLATE);
    expect(pairs.length).toBeGreaterThan(0);

    for (const pair of pairs) {
      expect(pair.forward.sequence.length).toBeGreaterThanOrEqual(18);
      expect(pair.reverse.sequence.length).toBeGreaterThanOrEqual(18);
      expect(pair.forward.sequence).toMatch(/^[ATGC]+$/);
      expect(pair.reverse.sequence).toMatch(/^[ATGC]+$/);
    }
  });

  it('productSize is consistent with primer positions', async () => {
    const pairs = await designPrimers(TEMPLATE);
    for (const pair of pairs) {
      const expected = pair.reverse.end - pair.forward.start;
      expect(pair.productSize).toBe(expected);
    }
  });

  it('tmDiff is the absolute Tm difference between primers', async () => {
    const pairs = await designPrimers(TEMPLATE);
    for (const pair of pairs) {
      const expected = Math.abs(pair.forward.tm - pair.reverse.tm);
      expect(pair.tmDiff).toBeCloseTo(expected, 1);
    }
  });

  it('respects custom minTm/maxTm constraints', async () => {
    const opts: PrimerDesignOptions = { minTm: 58, maxTm: 65 };
    const pairs = await designPrimers(TEMPLATE, opts);

    for (const pair of pairs) {
      expect(pair.forward.tm).toBeGreaterThanOrEqual(58);
      expect(pair.forward.tm).toBeLessThanOrEqual(65);
      expect(pair.reverse.tm).toBeGreaterThanOrEqual(58);
      expect(pair.reverse.tm).toBeLessThanOrEqual(65);
    }
  });

  it('respects custom primer length constraints', async () => {
    const opts: PrimerDesignOptions = { minLength: 18, maxLength: 22 };
    const pairs = await designPrimers(TEMPLATE, opts);

    for (const pair of pairs) {
      expect(pair.forward.sequence.length).toBeGreaterThanOrEqual(18);
      expect(pair.forward.sequence.length).toBeLessThanOrEqual(22);
      expect(pair.reverse.sequence.length).toBeGreaterThanOrEqual(18);
      expect(pair.reverse.sequence.length).toBeLessThanOrEqual(22);
    }
  });

  it('results are sorted by ascending tmDiff', async () => {
    const pairs = await designPrimers(TEMPLATE);
    if (pairs.length > 1) {
      for (let i = 1; i < pairs.length; i++) {
        expect(pairs[i].tmDiff).toBeGreaterThanOrEqual(pairs[i - 1].tmDiff);
      }
    }
  });

  it('forward primer comes from the 5\' end of the template', async () => {
    const pairs = await designPrimers(TEMPLATE);
    for (const pair of pairs) {
      expect(pair.forward.start).toBeLessThan(TEMPLATE.length * 0.4);
    }
  });

  it('reverse primer comes from the 3\' end of the template', async () => {
    const pairs = await designPrimers(TEMPLATE);
    for (const pair of pairs) {
      expect(pair.reverse.end).toBeGreaterThan(TEMPLATE.length * 0.5);
    }
  });

  it('returns empty array when constraints are impossible to satisfy', async () => {
    const opts: PrimerDesignOptions = { minTm: 90, maxTm: 95 };
    const pairs = await designPrimers(TEMPLATE, opts);
    expect(pairs).toEqual([]);
  });

  it('GC content is computed correctly for primers', async () => {
    const pairs = await designPrimers(TEMPLATE);
    for (const pair of pairs) {
      const seq = pair.forward.sequence;
      const gcCount = (seq.match(/[GC]/gi) || []).length;
      const expected = gcCount / seq.length;
      expect(pair.forward.gcContent).toBeCloseTo(expected, 4);
    }
  });

  it('designPrimers is an async function returning a promise', () => {
    const result = designPrimers(TEMPLATE);
    expect(result).toBeInstanceOf(Promise);
  });
});
