/**
 * Tests for apiErrors utility.
 *
 * Covers:
 * - errorResponse with basic message and status
 * - errorResponse with extra fields
 * - errorResponse with custom headers
 * - errorResponse with all parameters
 * - Response body shape (ok: false, error: string, code?: string)
 */

// Mock next/server since it requires Edge Runtime APIs not available in jsdom
jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    headers: Headers;
    private _body: unknown;

    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this._body = body;
      this.status = init?.status ?? 200;
      this.headers = new Headers(init?.headers);
    }

    async json() {
      return this._body;
    }
  }

  return {
    NextResponse: {
      json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => {
        return new MockNextResponse(body, init);
      },
    },
  };
});

import { errorResponse } from '../src/utils/apiErrors';

// ── Tests ──

describe('errorResponse', () => {
  it('returns a NextResponse with correct status', () => {
    const response = errorResponse('Not found', 404);
    expect(response.status).toBe(404);
  });

  it('returns JSON body with ok:false and error message', async () => {
    const response = errorResponse('Something went wrong', 500);
    const body = await response.json();
    expect(body).toEqual({
      ok: false,
      error: 'Something went wrong',
    });
  });

  it('includes extra fields in the body', async () => {
    const response = errorResponse('Validation error', 400, { field: 'email', code: 'INVALID' });
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Validation error');
    expect(body.field).toBe('email');
    expect(body.code).toBe('INVALID');
  });

  it('sets custom headers', () => {
    const response = errorResponse('Rate limited', 429, undefined, { 'Retry-After': '60' });
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  it('works with all parameters', async () => {
    const response = errorResponse('Forbidden', 403, { reason: 'insufficient_scope' }, { 'X-Request-Id': 'abc123' });
    expect(response.status).toBe(403);
    expect(response.headers.get('X-Request-Id')).toBe('abc123');
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Forbidden');
    expect(body.reason).toBe('insufficient_scope');
  });

  it('works with 200 status (edge case)', async () => {
    const response = errorResponse('OK but error', 200);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });

  it('works with empty extra object', async () => {
    const response = errorResponse('Error', 500, {});
    const body = await response.json();
    expect(body).toEqual({ ok: false, error: 'Error' });
  });

  it('works with empty headers object', () => {
    const response = errorResponse('Error', 500, undefined, {});
    expect(response.status).toBe(500);
  });

  it('handles extra fields that overlap with base fields', async () => {
    const response = errorResponse('Error', 500, { ok: true, extra: 'data' });
    const body = await response.json();
    // Extra spread after base, so ok:true from extra overrides ok:false
    expect(body.extra).toBe('data');
  });
});
