/**
 * Tests for src/utils/cors.ts
 *
 * Covers getCorsHeaders (with/without origin, allowed/forbidden origins)
 * and handleOptions (OPTIONS preflight handler).
 */

// jsdom does not provide Response/Request; polyfill minimally
class MockHeaders {
  private store: Record<string, string> = {};
  get(key: string) { return this.store[key.toLowerCase()] ?? null; }
  set(key: string, value: string) { this.store[key.toLowerCase()] = value; }
}

class MockRequest {
  headers: MockHeaders;
  constructor(_url: string, init?: { headers?: MockHeaders }) {
    this.headers = init?.headers ?? new MockHeaders();
  }
}

class MockResponse {
  status: number;
  headers: MockHeaders;
  private _body: string | null;
  constructor(body: string | null, init?: { status?: number; headers?: MockHeaders | Record<string, string> }) {
    this._body = body;
    this.status = init?.status ?? 200;
    if (init?.headers instanceof MockHeaders) {
      this.headers = init.headers;
    } else if (init?.headers) {
      const h = new MockHeaders();
      for (const [k, v] of Object.entries(init.headers)) h.set(k, v);
      this.headers = h;
    } else {
      this.headers = new MockHeaders();
    }
  }
  async text() { return this._body ?? ''; }
}

(globalThis as any).Request = MockRequest;
(globalThis as any).Response = MockResponse;
(globalThis as any).Headers = MockHeaders;

import { getCorsHeaders, handleOptions } from '../src/utils/cors';

function makeRequest(origin?: string): InstanceType<typeof MockRequest> {
  const headers = new MockHeaders();
  if (origin) headers.set('origin', origin);
  return new MockRequest('https://nexus-bio-1-0.vercel.app/api/test', { headers }) as any;
}

// ────────────────────────────────────────────────────────
// getCorsHeaders
// ────────────────────────────────────────────────────────
describe('getCorsHeaders', () => {
  it('returns primary origin when no request is provided', () => {
    const headers = getCorsHeaders();
    expect(headers['Access-Control-Allow-Origin']).toBe('https://nexus-bio-1-0.vercel.app');
    expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST, PUT, PATCH, OPTIONS');
    expect(headers['Access-Control-Allow-Headers']).toBe(
      'Content-Type, x-workbench-actor-id, x-workbench-project-id, X-API-Version, Deprecation, Sunset',
    );
  });

  it('returns primary origin when request has no origin header', () => {
    const req = makeRequest();
    const headers = getCorsHeaders(req as any);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://nexus-bio-1-0.vercel.app');
  });

  it('returns the request origin when it is in the allowlist', () => {
    const req = makeRequest('http://localhost:3000');
    const headers = getCorsHeaders(req as any);
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });

  it('returns the second localhost origin when it matches', () => {
    const req = makeRequest('http://localhost:3001');
    const headers = getCorsHeaders(req as any);
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:3001');
  });

  it('returns primary origin when request origin is not in the allowlist', () => {
    const req = makeRequest('https://evil.com');
    const headers = getCorsHeaders(req as any);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://nexus-bio-1-0.vercel.app');
  });

  it('returns primary origin for empty string origin', () => {
    const req = makeRequest('');
    const headers = getCorsHeaders(req as any);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://nexus-bio-1-0.vercel.app');
  });

  it('includes all required CORS headers', () => {
    const headers = getCorsHeaders();
    expect(Object.keys(headers).sort()).toEqual([
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Methods',
      'Access-Control-Allow-Origin',
    ]);
  });
});

// ────────────────────────────────────────────────────────
// handleOptions
// ────────────────────────────────────────────────────────
describe('handleOptions', () => {
  it('returns a 200 response with no body', async () => {
    const res = handleOptions();
    expect(res.status).toBe(200);
    const body = await (res as any).text();
    expect(body).toBe('');
  });

  it('includes CORS headers in the response', () => {
    const res = handleOptions();
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://nexus-bio-1-0.vercel.app');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, PATCH, OPTIONS');
  });

  it('passes request origin to getCorsHeaders', () => {
    const req = makeRequest('http://localhost:3000');
    const res = handleOptions(req as any);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
  });

  it('falls back to primary origin for disallowed origin', () => {
    const req = makeRequest('https://attacker.com');
    const res = handleOptions(req as any);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://nexus-bio-1-0.vercel.app');
  });

  it('works with undefined argument', () => {
    const res = handleOptions(undefined);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://nexus-bio-1-0.vercel.app');
  });
});
