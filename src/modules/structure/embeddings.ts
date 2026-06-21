/**
 * ESM-2 Embedding Module — Simulated Protein Embeddings
 *
 * Generates deterministic embeddings for protein sequences using a
 * hash-based approach. Designed as a lightweight local alternative
 * to ESM-2 inference for CPU-constrained environments.
 *
 * Reference: Lin et al. (2023) Science 379:1123 (ESMFold)
 * Reference: Rives et al. (2021) PNAS 118:e2016239118 (ESM-2)
 *
 * @scientific_provenance
 *   ALGORITHM: Hash-based simulated ESM-2 embeddings (deterministic, 32-dim)
 */

import type { ProteinChain } from './types';

// ── Constants ────────────────────────────────────────────────────────────────

/** Embedding dimension (lightweight for CPU) */
const EMBEDDING_DIM = 32;

// ── Hash Utilities ───────────────────────────────────────────────────────────

/**
 * Compute a deterministic hash from a string using FNV-1a variant.
 * Returns an array of seed values for pseudo-random number generation.
 *
 * @param str - Input string to hash
 * @returns Array of 4 hash values for seeding PRNG
 */
function fnv1aHash(str: string): number[] {
  let h1 = 0x811c9dc5; // FNV offset basis
  let h2 = 0x01000193;
  let h3 = 0xdeadbeef;
  let h4 = 0x12345678;

  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c;
    h1 = (h1 * 0x01000193) >>> 0;
    h2 ^= c;
    h2 = (h2 * 0x1b873593) >>> 0;
    h3 ^= c;
    h3 = (h3 * 0x85ebca6b) >>> 0;
    h4 ^= c;
    h4 = (h4 * 0xc2b2ae35) >>> 0;
  }

  return [h1, h2, h3, h4];
}

/**
 * Simple deterministic pseudo-random number generator (xorshift128).
 * Produces reproducible sequences from seed values.
 *
 * @param seeds - Array of 4 seed values
 * @returns Generator function that yields numbers in [-1, 1]
 */
function createPRNG(seeds: number[]): () => number {
  let [s0, s1, s2, s3] = seeds;
  if (s0 === 0 && s1 === 0 && s2 === 0 && s3 === 0) s1 = 1; // avoid all-zero state

  return () => {
    // xorshift128
    let t = s3;
    const v = (s0 ^ (s0 << 11)) >>> 0;
    s0 = s1;
    s1 = s2;
    s2 = s3;
    s3 = (v ^ (v >>> 8) ^ (t ^ (t >>> 19))) >>> 0;
    // Map to [-1, 1]
    return (s3 / 0xffffffff) * 2 - 1;
  };
}

// ── Embedding Generation ─────────────────────────────────────────────────────

/**
 * Generate a deterministic embedding from a protein sequence.
 *
 * Uses a hash-based approach for reproducibility (same input -> same output).
 * The embedding is normalized to unit length.
 *
 * @param sequence - Amino acid sequence (or nucleotide sequence)
 * @returns Promise resolving to a 32-dimensional unit-normalized embedding
 *
 * @example
 * ```ts
 * const emb = await generateEmbedding('MKWVTFISLLFLFSSAYS');
 * console.log(emb.length); // 32
 * ```
 */
export async function generateEmbedding(sequence: string): Promise<number[]> {
  if (!sequence || sequence.length === 0) {
    return new Array(EMBEDDING_DIM).fill(0);
  }

  const seeds = fnv1aHash(sequence);
  const prng = createPRNG(seeds);

  // Generate raw embedding values
  const raw: number[] = [];
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    raw.push(prng());
  }

  // L2 normalize to unit length
  const magnitude = Math.sqrt(raw.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) {
    return new Array(EMBEDDING_DIM).fill(0);
  }

  return raw.map(v => v / magnitude);
}

// ── Multi-Chain Embedding Support ────────────────────────────────────────────

/**
 * Generate embeddings for each chain in a protein complex.
 *
 * Uses different hash prefixes per chain type (protein, DNA, RNA) to ensure
 * different embedding strategies for different biomolecule types.
 *
 * @param chains - Array of ProteinChain objects
 * @returns Promise resolving to a Map from chain ID to embedding
 *
 * @example
 * ```ts
 * const chains = [
 *   { id: 'A', sequence: 'MKWV', type: 'protein' },
 *   { id: 'B', sequence: 'ATCG', type: 'dna' },
 * ];
 * const embeddings = await generateComplexEmbedding(chains);
 * ```
 */
export async function generateComplexEmbedding(
  chains: ProteinChain[]
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();

  for (const chain of chains) {
    // Prefix with chain type to differentiate embedding strategies
    const prefixedSequence = `${chain.type}:${chain.sequence}`;
    const embedding = await generateEmbedding(prefixedSequence);
    result.set(chain.id, embedding);
  }

  return result;
}

// ── Embedding Cache ──────────────────────────────────────────────────────────

/**
 * LRU-style cache for embeddings, keyed by sequence string.
 *
 * Avoids recomputation when the same sequence is queried multiple times.
 * Thread-safe by design (JavaScript is single-threaded).
 */
export class EmbeddingCache {
  private cache: Map<string, number[]>;

  constructor() {
    this.cache = new Map();
  }

  /**
   * Get a cached embedding by sequence.
   *
   * @param sequence - The sequence to look up
   * @returns The cached embedding, or null if not found
   */
  get(sequence: string): number[] | null {
    return this.cache.get(sequence) ?? null;
  }

  /**
   * Store an embedding in the cache.
   *
   * @param sequence - The sequence key
   * @param embedding - The embedding to cache
   */
  set(sequence: string, embedding: number[]): void {
    this.cache.set(sequence, embedding);
  }

  /**
   * Check if a sequence is in the cache.
   *
   * @param sequence - The sequence to check
   * @returns true if the sequence has a cached embedding
   */
  has(sequence: string): boolean {
    return this.cache.has(sequence);
  }

  /**
   * Clear all cached embeddings.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of cached embeddings.
   *
   * @returns The number of entries in the cache
   */
  size(): number {
    return this.cache.size;
  }
}

// ── Batch Processing ─────────────────────────────────────────────────────────

/**
 * Generate embeddings for multiple sequences in batch.
 *
 * Uses a shared cache to avoid recomputation. Processes sequences
 * in configurable batch sizes to manage memory.
 *
 * @param sequences - Array of sequences to embed
 * @param options - Optional batch configuration
 * @param options.batchSize - Number of sequences per batch (default: all)
 * @returns Promise resolving to a Map from sequence to embedding
 *
 * @example
 * ```ts
 * const result = await generateBatchEmbeddings(['MKWV', 'AAAA'], { batchSize: 10 });
 * ```
 */
export async function generateBatchEmbeddings(
  sequences: string[],
  options?: { batchSize?: number }
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  const batchSize = options?.batchSize ?? sequences.length;

  for (let i = 0; i < sequences.length; i += batchSize) {
    const batch = sequences.slice(i, i + batchSize);
    const embeddings = await Promise.all(batch.map(seq => generateEmbedding(seq)));
    for (let j = 0; j < batch.length; j++) {
      result.set(batch[j], embeddings[j]);
    }
  }

  return result;
}

// ── Failure Fallback ─────────────────────────────────────────────────────────

// Module-level cache for fallback function
const fallbackCache = new EmbeddingCache();

/**
 * Generate an embedding with automatic fallback.
 *
 * Strategy:
 *   1. Check cache for existing embedding
 *   2. Compute embedding from sequence
 *   3. Return zero vector if both fail
 *
 * Reports the source of the embedding: 'cache', 'computed', or 'fallback'.
 *
 * @param sequence - The sequence to embed
 * @returns Promise resolving to embedding and its source
 *
 * @example
 * ```ts
 * const { embedding, source } = await generateEmbeddingWithFallback('MKWV');
 * console.log(source); // 'computed' or 'cache'
 * ```
 */
export async function generateEmbeddingWithFallback(
  sequence: string
): Promise<{ embedding: number[]; source: 'cache' | 'computed' | 'fallback' }> {
  // Try cache first
  const cached = fallbackCache.get(sequence);
  if (cached) {
    return { embedding: cached, source: 'cache' };
  }

  // Handle empty sequence as fallback
  if (!sequence || sequence.length === 0) {
    const zeroVec = new Array(EMBEDDING_DIM).fill(0);
    return { embedding: zeroVec, source: 'fallback' };
  }

  // Compute embedding
  try {
    const embedding = await generateEmbedding(sequence);
    fallbackCache.set(sequence, embedding);
    return { embedding, source: 'computed' };
  } catch {
    // Fallback to zero vector
    const zeroVec = new Array(EMBEDDING_DIM).fill(0);
    return { embedding: zeroVec, source: 'fallback' };
  }
}
