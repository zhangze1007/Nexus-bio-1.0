import { getCacheHeaders, addCacheHeaders, CacheStrategy } from '../src/middleware/cachingHeaders';

describe('getCacheHeaders', () => {
  it('returns no-store headers for "no-store" strategy', () => {
    const headers = getCacheHeaders('no-store');
    expect(headers['Cache-Control']).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
    expect(headers['Pragma']).toBe('no-cache');
    expect(headers['Expires']).toBe('0');
    expect(headers['Surrogate-Control']).toBe('no-store');
  });

  it('returns 5-minute cache for "short" strategy', () => {
    const headers = getCacheHeaders('short');
    expect(headers['Cache-Control']).toContain('max-age=300');
    expect(headers['Cache-Control']).toContain('s-maxage=300');
    expect(headers['Cache-Control']).toContain('stale-while-revalidate=60');
  });

  it('returns 1-hour cache for "medium" strategy', () => {
    const headers = getCacheHeaders('medium');
    expect(headers['Cache-Control']).toContain('max-age=3600');
    expect(headers['Cache-Control']).toContain('s-maxage=3600');
    expect(headers['Cache-Control']).toContain('stale-while-revalidate=300');
  });

  it('returns 1-day cache for "long" strategy', () => {
    const headers = getCacheHeaders('long');
    expect(headers['Cache-Control']).toContain('max-age=86400');
    expect(headers['Cache-Control']).toContain('s-maxage=86400');
    expect(headers['Cache-Control']).toContain('stale-while-revalidate=3600');
  });

  it('returns 1-year immutable cache for "immutable" strategy', () => {
    const headers = getCacheHeaders('immutable');
    expect(headers['Cache-Control']).toContain('max-age=31536000');
    expect(headers['Cache-Control']).toContain('immutable');
  });

  it('returns a new object each call (no shared reference)', () => {
    const a = getCacheHeaders('short');
    const b = getCacheHeaders('short');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('throws on unknown strategy', () => {
    // @ts-expect-error — testing invalid input
    expect(() => getCacheHeaders('turbo')).toThrow('Unknown cache strategy');
  });

  it('includes "public" directive for all cacheable strategies', () => {
    for (const strategy of ['short', 'medium', 'long', 'immutable'] as CacheStrategy[]) {
      const headers = getCacheHeaders(strategy);
      expect(headers['Cache-Control']).toContain('public');
    }
  });

  it('does not include "public" for no-store', () => {
    const headers = getCacheHeaders('no-store');
    expect(headers['Cache-Control']).not.toContain('public');
  });
});

describe('addCacheHeaders', () => {
  it('sets headers on a mock response object', () => {
    const store: Record<string, string> = {};
    const response = {
      headers: {
        set(key: string, value: string) {
          store[key] = value;
        },
      },
    };

    addCacheHeaders(response, 'medium');

    expect(store['Cache-Control']).toContain('max-age=3600');
  });

  it('sets all no-store headers including Pragma and Expires', () => {
    const store: Record<string, string> = {};
    const response = {
      headers: {
        set(key: string, value: string) {
          store[key] = value;
        },
      },
    };

    addCacheHeaders(response, 'no-store');

    expect(store['Cache-Control']).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
    expect(store['Pragma']).toBe('no-cache');
    expect(store['Expires']).toBe('0');
    expect(store['Surrogate-Control']).toBe('no-store');
  });

  it('sets immutable headers correctly', () => {
    const store: Record<string, string> = {};
    const response = {
      headers: {
        set(key: string, value: string) {
          store[key] = value;
        },
      },
    };

    addCacheHeaders(response, 'immutable');

    expect(store['Cache-Control']).toContain('immutable');
    expect(store['Cache-Control']).toContain('max-age=31536000');
  });

  it('works with a Headers-like object (Web API style)', () => {
    const headers = new Headers();
    const response = { headers };

    addCacheHeaders(response, 'long');

    expect(headers.get('Cache-Control')).toContain('max-age=86400');
  });

  it('overwrites existing Cache-Control header', () => {
    const store: Record<string, string> = { 'Cache-Control': 'old-value' };
    const response = {
      headers: {
        set(key: string, value: string) {
          store[key] = value;
        },
      },
    };

    addCacheHeaders(response, 'short');

    expect(store['Cache-Control']).toContain('max-age=300');
    expect(store['Cache-Control']).not.toBe('old-value');
  });
});
