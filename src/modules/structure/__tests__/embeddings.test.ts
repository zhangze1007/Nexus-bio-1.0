/**
 * ESM-2 Embedding Module Tests
 *
 * Tests for simulated ESM-2 embeddings: generation, caching,
 * multi-chain support, batch processing, and fallback.
 */

import {
  generateEmbedding,
  generateComplexEmbedding,
  EmbeddingCache,
  generateBatchEmbeddings,
  generateEmbeddingWithFallback,
} from '../embeddings';
import type { ProteinChain } from '../types';

describe('embeddings', () => {
  // ── Embedding Generation ─────────────────────────────────────────────────

  describe('generateEmbedding', () => {
    const sampleSequence = 'MKWVTFISLLFLFSSAYS';

    it('returns deterministic output for same sequence', async () => {
      const emb1 = await generateEmbedding(sampleSequence);
      const emb2 = await generateEmbedding(sampleSequence);
      expect(emb1).toEqual(emb2);
    });

    it('returns different embeddings for different sequences', async () => {
      const emb1 = await generateEmbedding('MKWVTFISLLFLFSSAYS');
      const emb2 = await generateEffectivelyDifferent();
      // Two different sequences should differ
      const different = emb1.some((v, i) => Math.abs(v - emb2[i]) > 1e-10);
      expect(different).toBe(true);

      async function generateEffectivelyDifferent() {
        return generateEmbedding('AAAAAAAAAA');
      }
    });

    it('produces a normalized (unit length) embedding', async () => {
      const emb = await generateEmbedding(sampleSequence);
      const magnitude = Math.sqrt(emb.reduce((sum, v) => sum + v * v, 0));
      expect(magnitude).toBeCloseTo(1.0, 6);
    });

    it('returns a zero vector for an empty sequence', async () => {
      const emb = await generateEmbedding('');
      expect(emb.length).toBe(32);
      expect(emb.every(v => v === 0)).toBe(true);
    });

    it('returns embedding with dimension 32', async () => {
      const emb = await generateEmbedding(sampleSequence);
      expect(emb.length).toBe(32);
    });
  });

  // ── Multi-Chain Support ──────────────────────────────────────────────────

  describe('generateComplexEmbedding', () => {
    const chains: ProteinChain[] = [
      { id: 'A', sequence: 'MKWVTFISLLFLFSSAYS', type: 'protein' },
      { id: 'B', sequence: 'ATCGATCGATCG', type: 'dna' },
      { id: 'C', sequence: 'AUGCUAGCUAGC', type: 'rna' },
    ];

    it('generates embeddings for all chains', async () => {
      const result = await generateComplexEmbedding(chains);
      expect(result.size).toBe(3);
    });

    it('returns correct Map structure with chain IDs as keys', async () => {
      const result = await generateComplexEmbedding(chains);
      expect(result.has('A')).toBe(true);
      expect(result.has('B')).toBe(true);
      expect(result.has('C')).toBe(true);
    });

    it('produces embeddings with dimension 32 for each chain', async () => {
      const result = await generateComplexEmbedding(chains);
      for (const emb of result.values()) {
        expect(emb.length).toBe(32);
      }
    });

    it('uses different embedding strategies per chain type', async () => {
      const result = await generateComplexEmbedding(chains);
      const embProtein = result.get('A')!;
      const embDna = result.get('B')!;
      const embRna = result.get('C')!;

      // Different chain types should yield different embeddings
      const dnaDiffers = embProtein.some((v, i) => Math.abs(v - embDna[i]) > 1e-10);
      const rnaDiffers = embProtein.some((v, i) => Math.abs(v - embRna[i]) > 1e-10);
      expect(dnaDiffers).toBe(true);
      expect(rnaDiffers).toBe(true);
    });

    it('normalizes each chain embedding to unit length', async () => {
      const result = await generateComplexEmbedding(chains);
      for (const [id, emb] of result) {
        const magnitude = Math.sqrt(emb.reduce((sum, v) => sum + v * v, 0));
        expect(magnitude).toBeCloseTo(1.0, 6);
      }
    });
  });

  // ── Embedding Cache ──────────────────────────────────────────────────────

  describe('EmbeddingCache', () => {
    let cache: EmbeddingCache;

    beforeEach(() => {
      cache = new EmbeddingCache();
    });

    it('returns null on cache miss', () => {
      expect(cache.get('MKWVTFISLLFLFSSAYS')).toBeNull();
    });

    it('returns cached value on cache hit', () => {
      const sequence = 'MKWVTFISLLFLFSSAYS';
      const embedding = [0.1, 0.2, 0.3];
      cache.set(sequence, embedding);
      expect(cache.get(sequence)).toEqual(embedding);
    });

    it('reports has() correctly', () => {
      const sequence = 'MKWVTFISLLFLFSSAYS';
      expect(cache.has(sequence)).toBe(false);
      cache.set(sequence, [0.1, 0.2, 0.3]);
      expect(cache.has(sequence)).toBe(true);
    });

    it('can be cleared', () => {
      cache.set('seq1', [0.1]);
      cache.set('seq2', [0.2]);
      expect(cache.size()).toBe(2);
      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get('seq1')).toBeNull();
    });

    it('tracks size correctly', () => {
      expect(cache.size()).toBe(0);
      cache.set('seq1', [0.1]);
      expect(cache.size()).toBe(1);
      cache.set('seq2', [0.2]);
      expect(cache.size()).toBe(2);
    });

    it('overwrites existing entry on same key', () => {
      const seq = 'MKWVTFISLLFLFSSAYS';
      cache.set(seq, [0.1]);
      cache.set(seq, [0.9]);
      expect(cache.size()).toBe(1);
      expect(cache.get(seq)).toEqual([0.9]);
    });
  });

  // ── Batch Processing ─────────────────────────────────────────────────────

  describe('generateBatchEmbeddings', () => {
    it('processes multiple sequences', async () => {
      const sequences = ['MKWV', 'AAAA', 'LLLL'];
      const result = await generateBatchEmbeddings(sequences);
      expect(result.size).toBe(3);
      for (const seq of sequences) {
        expect(result.has(seq)).toBe(true);
        expect(result.get(seq)!.length).toBe(32);
      }
    });

    it('uses cache to avoid recomputation', async () => {
      const sequences = ['MKWV', 'AAAA'];
      // First call populates cache
      await generateBatchEmbeddings(sequences);
      // Second call should use cache (same results)
      const result = await generateBatchEmbeddings(sequences);
      expect(result.size).toBe(2);
      // Verify deterministic results (cached)
      const result2 = await generateBatchEmbeddings(sequences);
      for (const seq of sequences) {
        expect(result.get(seq)).toEqual(result2.get(seq));
      }
    });

    it('handles empty input', async () => {
      const result = await generateBatchEmbeddings([]);
      expect(result.size).toBe(0);
    });

    it('respects batchSize option', async () => {
      const sequences = ['A', 'B', 'C', 'D', 'E'];
      const result = await generateBatchEmbeddings(sequences, { batchSize: 2 });
      expect(result.size).toBe(5);
    });
  });

  // ── Failure Fallback ─────────────────────────────────────────────────────

  describe('generateEmbeddingWithFallback', () => {
    it('returns computed embedding for valid sequence', async () => {
      const result = await generateEmbeddingWithFallback('MKWVTFISLLFLFSSAYS');
      expect(result.embedding.length).toBe(32);
      expect(['cache', 'computed']).toContain(result.source);
    });

    it('uses cache on second call', async () => {
      const seq = 'MKWVTFISLLFLFSSAYS';
      await generateEmbeddingWithFallback(seq);
      const result = await generateEmbeddingWithFallback(seq);
      expect(result.source).toBe('cache');
    });

    it('reports source correctly', async () => {
      const seq = 'UniqueSeq123' + Date.now(); // unlikely to be cached
      const result = await generateEmbeddingWithFallback(seq);
      expect(['cache', 'computed']).toContain(result.source);
      expect(result.embedding.length).toBe(32);
    });

    it('returns fallback zero vector for empty sequence', async () => {
      const result = await generateEmbeddingWithFallback('');
      expect(result.embedding.length).toBe(32);
      expect(result.embedding.every(v => v === 0)).toBe(true);
      expect(result.source).toBe('fallback');
    });
  });
});
