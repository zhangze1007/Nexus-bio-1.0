/**
 * Client-side API response cache (R-24).
 *
 * Reduces API invocations by caching GET responses in memory.
 * Helps stay under Vercel Hobby plan's 1000 invocations/day limit.
 *
 * Usage:
 *   import { cachedFetch } from '@/src/utils/apiCache';
 *   const data = await cachedFetch('/api/kegg?compound=glucose');
 *
 * Cache behavior:
 * - GET requests only (POST/PUT/DELETE are never cached)
 * - Default TTL: 5 minutes
 * - Max cache size: 100 entries
 * - LRU eviction when cache is full
 */

interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 100;
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Generate cache key from URL */
function getCacheKey(url: string): string {
  return url;
}

/** Evict oldest entries if cache is full */
function evictIfNeeded(): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

/**
 * Cached fetch wrapper for GET requests.
 *
 * @param url - URL to fetch
 * options - Fetch options (must be GET or omitted)
 * ttlMs - Cache TTL in milliseconds (default: 5 minutes)
 * @returns Cached or fresh response data
 */
export async function cachedFetch<T = unknown>(
  url: string,
  options?: RequestInit,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  // Only cache GET requests
  const method = (options?.method ?? 'GET').toUpperCase();
  if (method !== 'GET') {
    const res = await fetch(url, options);
    return res.json() as Promise<T>;
  }

  const key = getCacheKey(url);
  const now = Date.now();

  // Check cache
  const entry = cache.get(key);
  if (entry && now - entry.timestamp < entry.ttl) {
    return entry.data as T;
  }

  // Fetch fresh data
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const data = await res.json();

  // Store in cache
  evictIfNeeded();
  cache.set(key, { data, timestamp: now, ttl: ttlMs });

  return data as T;
}

/**
 * Clear the entire cache.
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Remove a specific entry from the cache.
 */
export function invalidateCache(url: string): void {
  cache.delete(getCacheKey(url));
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
