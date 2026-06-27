/**
 * Tests for src/middleware/apiVersioning.ts
 *
 * Covers getApiVersion, addVersionHeaders, isVersionDeprecated,
 * and getVersionMeta across versioned, unversioned, and deprecated paths.
 */

// jsdom does not provide native Response/Request/Headers; polyfill minimally
class MockHeaders {
  private store: Record<string, string> = {};
  constructor(init?: Headers | Record<string, string>) {
    if (init instanceof MockHeaders) {
      // copy
      for (const [k, v] of Object.entries((init as any).store as Record<string, string>)) {
        this.store[k] = v;
      }
    } else if (init && typeof init === 'object') {
      for (const [k, v] of Object.entries(init as Record<string, string>)) {
        this.store[k.toLowerCase()] = v;
      }
    }
  }
  get(key: string) {
    return this.store[key.toLowerCase()] ?? null;
  }
  set(key: string, value: string) {
    this.store[key.toLowerCase()] = value;
  }
  append(key: string, value: string) {
    const existing = this.store[key.toLowerCase()];
    this.store[key.toLowerCase()] = existing ? `${existing}, ${value}` : value;
  }
}

class MockResponse {
  status: number;
  statusText: string;
  headers: MockHeaders;
  body: string | null;
  constructor(body: string | null, init?: { status?: number; statusText?: string; headers?: MockHeaders }) {
    this.body = body;
    this.status = init?.status ?? 200;
    this.statusText = init?.statusText ?? '';
    this.headers = init?.headers ?? new MockHeaders();
  }
}

(globalThis as any).Headers = MockHeaders;
(globalThis as any).Response = MockResponse;

import {
  getApiVersion,
  addVersionHeaders,
  isVersionDeprecated,
  getVersionMeta,
} from '../src/middleware/apiVersioning';

// ─── Helpers ────────────────────────────────────────────────────────

function makeRequest(url: string): { url: string } {
  return { url };
}

function makeResponse(status = 200, extraHeaders?: Record<string, string>): InstanceType<typeof MockResponse> {
  const headers = new MockHeaders(extraHeaders);
  return new MockResponse('OK', { status, headers }) as any;
}

// ────────────────────────────────────────────────────────────────────
// getApiVersion
// ────────────────────────────────────────────────────────────────────
describe('getApiVersion', () => {
  it('extracts v1 from /api/v1/tools/fbasim', () => {
    const req = makeRequest('https://nexus-bio-1-0.vercel.app/api/v1/tools/fbasim');
    expect(getApiVersion(req)).toBe('1');
  });

  it('extracts v2 from /api/v2/analyze', () => {
    const req = makeRequest('https://nexus-bio-1-0.vercel.app/api/v2/analyze');
    expect(getApiVersion(req)).toBe('2');
  });

  it('extracts v10 from /api/v10/workbench', () => {
    const req = makeRequest('https://nexus-bio-1-0.vercel.app/api/v10/workbench');
    expect(getApiVersion(req)).toBe('10');
  });

  it('returns "unversioned" for /api/analyze (no version segment)', () => {
    const req = makeRequest('https://nexus-bio-1-0.vercel.app/api/analyze');
    expect(getApiVersion(req)).toBe('unversioned');
  });

  it('returns "unversioned" for /api/tools/fbasim', () => {
    const req = makeRequest('https://nexus-bio-1-0.vercel.app/api/tools/fbasim');
    expect(getApiVersion(req)).toBe('unversioned');
  });

  it('returns "unversioned" for non-API paths', () => {
    const req = makeRequest('https://nexus-bio-1-0.vercel.app/');
    expect(getApiVersion(req)).toBe('unversioned');
  });

  it('extracts version from localhost URLs', () => {
    const req = makeRequest('http://localhost:3000/api/v3/kegg');
    expect(getApiVersion(req)).toBe('3');
  });

  it('ignores version-like segments outside /api/', () => {
    const req = makeRequest('https://nexus-bio-1-0.vercel.app/docs/v2/intro');
    expect(getApiVersion(req)).toBe('unversioned');
  });
});

// ────────────────────────────────────────────────────────────────────
// addVersionHeaders
// ────────────────────────────────────────────────────────────────────
describe('addVersionHeaders', () => {
  it('sets X-API-Version header on the response', () => {
    const res = makeResponse(200);
    const versioned = addVersionHeaders(res as any, '1');
    expect(versioned.headers.get('X-API-Version')).toBe('1');
  });

  it('sets X-API-Version to "unversioned" when no version segment', () => {
    const res = makeResponse(200);
    const versioned = addVersionHeaders(res as any, 'unversioned');
    expect(versioned.headers.get('X-API-Version')).toBe('unversioned');
  });

  it('preserves existing response status code', () => {
    const res = makeResponse(404);
    const versioned = addVersionHeaders(res as any, '1');
    expect(versioned.status).toBe(404);
  });

  it('preserves existing response headers', () => {
    const res = makeResponse(200, { 'Content-Type': 'application/json' });
    const versioned = addVersionHeaders(res as any, '1');
    expect(versioned.headers.get('Content-Type')).toBe('application/json');
  });

  it('does not set Deprecation header for non-deprecated version v1', () => {
    const res = makeResponse(200);
    const versioned = addVersionHeaders(res as any, '1');
    expect(versioned.headers.get('Deprecation')).toBeNull();
  });

  it('does not set Sunset header for non-deprecated version v1', () => {
    const res = makeResponse(200);
    const versioned = addVersionHeaders(res as any, '1');
    expect(versioned.headers.get('Sunset')).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────
// isVersionDeprecated
// ────────────────────────────────────────────────────────────────────
describe('isVersionDeprecated', () => {
  it('returns false for v1 (currently active)', () => {
    expect(isVersionDeprecated('1')).toBe(false);
  });

  it('returns false for unknown versions', () => {
    expect(isVersionDeprecated('99')).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────
// getVersionMeta
// ────────────────────────────────────────────────────────────────────
describe('getVersionMeta', () => {
  it('returns metadata for v1 with correct version string', () => {
    const meta = getVersionMeta('v1');
    expect(meta).toBeDefined();
    expect(meta!.version).toBe('1');
    expect(meta!.deprecated).toBe(false);
  });

  it('returns undefined for unknown version segment', () => {
    const meta = getVersionMeta('v99');
    expect(meta).toBeUndefined();
  });

  it('returns metadata with undefined sunsetDate for non-deprecated version', () => {
    const meta = getVersionMeta('v1');
    expect(meta!.sunsetDate).toBeUndefined();
  });
});
