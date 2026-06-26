/**
 * Embedding Store — Vector Embeddings Service for RAG
 *
 * Provides upsert, query, and delete operations for vector embeddings
 * using Upstash Vector as the primary backend with an in-memory cosine
 * similarity fallback when Upstash is not configured.
 *
 * Embedding generation uses OpenAI text-embedding-3-small when
 * OPENAI_API_KEY is set; otherwise falls back to a deterministic
 * hash-based embedding (for offline/dev use only).
 *
 * Environment variables:
 *   UPSTASH_VECTOR_URL    — Upstash Vector index URL (e.g. https://xxx.vector.upstash.io)
 *   UPSTASH_VECTOR_TOKEN  — Upstash Vector REST token
 *   OPENAI_API_KEY         — OpenAI API key for embedding generation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmbeddingMetadata {
  /** Free-form tags for filtering */
  tags?: string[];
  /** Source document or page */
  source?: string;
  /** Tool or module origin */
  tool?: string;
  /** ISO timestamp of ingestion */
  createdAt?: string;
  /** Arbitrary key-value pairs */
  [key: string]: unknown;
}

export interface EmbeddingRecord {
  id: string;
  vector: number[];
  metadata: EmbeddingMetadata;
  /** Original text (stored only in local fallback) */
  text?: string;
}

export interface QueryResult {
  id: string;
  score: number;
  metadata: EmbeddingMetadata;
  text?: string;
}

export interface EmbeddingStoreStats {
  backend: "upstash" | "local";
  vectorCount: number;
  dimension: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const UPSTASH_URL = process.env.UPSTASH_VECTOR_URL ?? "";
const UPSTASH_TOKEN = process.env.UPSTASH_VECTOR_TOKEN ?? "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

/** Upstash Vector REST headers */
function upstashHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${UPSTASH_TOKEN}`,
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// Embedding Generation
// ---------------------------------------------------------------------------

/**
 * Generate an embedding vector for the given text.
 *
 * Cascade:
 *   1. OpenAI text-embedding-3-small (1536-dim) — production quality
 *   2. Deterministic hash-based embedding (128-dim) — offline/dev fallback
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (OPENAI_API_KEY) {
    return generateOpenAIEmbedding(text);
  }
  return generateLocalEmbedding(text);
}

/** OpenAI embedding via REST API */
async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `OpenAI embedding failed (${res.status}): ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as {
    data: Array<{ embedding: number[] }>;
  };

  return data.data[0].embedding;
}

/**
 * Deterministic hash-based embedding for offline use.
 *
 * NOT suitable for production semantic search — produces vectors where
 * cosine similarity loosely correlates with shared n-grams, but does not
 * capture true semantic meaning. Used only when no embedding provider is
 * configured.
 *
 * Produces 128-dimensional vectors in the range [-1, 1].
 */
export function generateLocalEmbedding(text: string): number[] {
  const dim = 128;
  const vec = new Float64Array(dim);
  const normalized = text.toLowerCase().trim();

  // Accumulate contributions from character bigrams
  for (let i = 0; i < normalized.length - 1; i++) {
    const bigram = normalized.charCodeAt(i) * 31 + normalized.charCodeAt(i + 1);
    const idx = ((bigram % dim) + dim) % dim;
    vec[idx] += 1;
  }

  // Also seed from individual characters for single-word inputs
  for (let i = 0; i < normalized.length; i++) {
    const idx = ((normalized.charCodeAt(i) * 17) % dim + dim) % dim;
    vec[idx] += 0.5;
  }

  // L2-normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= norm;

  return Array.from(vec);
}

// ---------------------------------------------------------------------------
// Local In-Memory Store (Fallback)
// ---------------------------------------------------------------------------

const localStore: Map<string, EmbeddingRecord> = new Map();

/** Cosine similarity between two vectors of equal length. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: ${a.length} vs ${b.length}`,
    );
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  return dot / denom;
}

/** Whether Upstash Vector is configured and should be used. */
function useUpstash(): boolean {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

// ---------------------------------------------------------------------------
// Core API — upsertEmbedding
// ---------------------------------------------------------------------------

/**
 * Insert or update an embedding.
 *
 * @param id       Unique identifier for the embedding
 * @param text     Source text to embed
 * @param metadata Arbitrary metadata to store alongside the vector
 */
export async function upsertEmbedding(
  id: string,
  text: string,
  metadata: EmbeddingMetadata = {},
): Promise<void> {
  const vector = await generateEmbedding(text);

  if (useUpstash()) {
    await upsertToUpstash(id, vector, { ...metadata, text });
  } else {
    upsertToLocal(id, vector, metadata, text);
  }
}

async function upsertToUpstash(
  id: string,
  vector: number[],
  metadata: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${UPSTASH_URL}/upsert`, {
    method: "POST",
    headers: upstashHeaders(),
    body: JSON.stringify({
      id,
      vector,
      metadata,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Upstash upsert failed (${res.status}): ${body.slice(0, 200)}`,
    );
  }
}

function upsertToLocal(
  id: string,
  vector: number[],
  metadata: EmbeddingMetadata,
  text: string,
): void {
  localStore.set(id, { id, vector, metadata, text });
}

// ---------------------------------------------------------------------------
// Core API — queryEmbedding
// ---------------------------------------------------------------------------

/**
 * Query for the most similar embeddings.
 *
 * @param text  Query text to embed and search against
 * @param topK  Maximum number of results to return (default 5)
 * @returns     Ranked results sorted by descending similarity score
 */
export async function queryEmbedding(
  text: string,
  topK: number = 5,
): Promise<QueryResult[]> {
  const vector = await generateEmbedding(text);

  if (useUpstash()) {
    return queryFromUpstash(vector, topK);
  }
  return queryFromLocal(vector, topK);
}

async function queryFromUpstash(
  vector: number[],
  topK: number,
): Promise<QueryResult[]> {
  const res = await fetch(`${UPSTASH_URL}/query`, {
    method: "POST",
    headers: upstashHeaders(),
    body: JSON.stringify({
      vector,
      topK,
      includeMetadata: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Upstash query failed (${res.status}): ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as {
    result: Array<{
      id: string;
      score: number;
      metadata?: Record<string, unknown>;
    }>;
  };

  return data.result.map((r) => ({
    id: r.id,
    score: r.score,
    metadata: (r.metadata ?? {}) as EmbeddingMetadata,
    text: (r.metadata as Record<string, unknown> | undefined)?.text as
      | string
      | undefined,
  }));
}

function queryFromLocal(
  queryVector: number[],
  topK: number,
): QueryResult[] {
  const results: QueryResult[] = [];

  for (const record of localStore.values()) {
    // Skip dimension mismatches (e.g. mixed embedding providers)
    if (record.vector.length !== queryVector.length) continue;

    results.push({
      id: record.id,
      score: cosineSimilarity(queryVector, record.vector),
      metadata: record.metadata,
      text: record.text,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

// ---------------------------------------------------------------------------
// Core API — deleteEmbedding
// ---------------------------------------------------------------------------

/**
 * Delete an embedding by its ID.
 *
 * @param id  The embedding identifier to remove
 * @returns   true if the embedding existed (local) or deletion was accepted (upstash)
 */
export async function deleteEmbedding(id: string): Promise<boolean> {
  if (useUpstash()) {
    return deleteFromUpstash(id);
  }
  return deleteFromLocal(id);
}

async function deleteFromUpstash(id: string): Promise<boolean> {
  const res = await fetch(`${UPSTASH_URL}/delete`, {
    method: "POST",
    headers: upstashHeaders(),
    body: JSON.stringify({ ids: [id] }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Upstash delete failed (${res.status}): ${body.slice(0, 200)}`,
    );
  }

  return true;
}

function deleteFromLocal(id: string): boolean {
  return localStore.delete(id);
}

// ---------------------------------------------------------------------------
// Utility — stats & management
// ---------------------------------------------------------------------------

/** Get current store statistics. */
export function getStoreStats(): EmbeddingStoreStats {
  return {
    backend: useUpstash() ? "upstash" : "local",
    vectorCount: localStore.size,
    dimension: 128, // local fallback dimension; upstash dimension depends on embedding model
  };
}

/** Clear all embeddings from the local store. Intended for testing. */
export function clearLocalStore(): void {
  localStore.clear();
}

/** Get the number of vectors in the local store. */
export function getLocalVectorCount(): number {
  return localStore.size;
}
