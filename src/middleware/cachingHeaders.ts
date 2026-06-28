/**
 * Caching headers middleware for Nexus-Bio.
 *
 * Provides cache-control header strategies for different content types:
 * - no-store: API responses, never cached
 * - short (5 min): dynamic pages that change frequently
 * - medium (1 hour): tool pages, semi-static content
 * - long (1 day): static assets without content hashing
 * - immutable (1 year): hashed/static assets that never change
 */

export type CacheStrategy = "no-store" | "short" | "medium" | "long" | "immutable";

const STRATEGY_MAP: Record<CacheStrategy, Record<string, string>> = {
  "no-store": {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  },
  short: {
    "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
  },
  medium: {
    "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=300",
  },
  long: {
    "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600",
  },
  immutable: {
    "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
  },
};

/**
 * Returns a copy of the cache headers for the given strategy.
 */
export function getCacheHeaders(strategy: CacheStrategy): Record<string, string> {
  const headers = STRATEGY_MAP[strategy];
  if (!headers) {
    throw new Error(`Unknown cache strategy: "${strategy}"`);
  }
  return { ...headers };
}

/**
 * Mutates a Response object (or plain headers object) by adding cache headers
 * for the given strategy.
 *
 * Works with both the Web Fetch API `Response` and Next.js `NextResponse`.
 */
export function addCacheHeaders(
  response: { headers: { set(key: string, value: string): void } | Headers },
  strategy: CacheStrategy,
): void {
  const headers = getCacheHeaders(strategy);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
}
