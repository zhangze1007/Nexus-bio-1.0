/**
 * Tests for apiErrors utility.
 *
 * Covers:
 * - errorResponse with basic message and status
 * - errorResponse with extra fields
 * - errorResponse with custom headers
 * - errorResponse with all parameters
 * - Response body shape (ok: false, error: string, code?: string)
 * - createApiError for each standardized error code
 * - createApiError with and without details
 * - API_ERRORS constant integrity
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

import { errorResponse, createApiError, API_ERRORS, type ErrorCode } from '../src/utils/apiErrors';

// ── errorResponse Tests ──

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

// ── API_ERRORS Constant Tests ──

describe('API_ERRORS', () => {
  const expectedCodes: ErrorCode[] = [
    'VALIDATION_ERROR',
    'NOT_FOUND',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'RATE_LIMITED',
    'INTERNAL_ERROR',
    'SERVICE_UNAVAILABLE',
  ];

  it.each(expectedCodes)('has entry for %s', (code) => {
    expect(API_ERRORS[code]).toBeDefined();
    expect(API_ERRORS[code].code).toBe(code);
    expect(typeof API_ERRORS[code].message).toBe('string');
    expect(typeof API_ERRORS[code].statusCode).toBe('number');
  });

  it('maps VALIDATION_ERROR to 400', () => {
    expect(API_ERRORS.VALIDATION_ERROR.statusCode).toBe(400);
  });

  it('maps UNAUTHORIZED to 401', () => {
    expect(API_ERRORS.UNAUTHORIZED.statusCode).toBe(401);
  });

  it('maps FORBIDDEN to 403', () => {
    expect(API_ERRORS.FORBIDDEN.statusCode).toBe(403);
  });

  it('maps NOT_FOUND to 404', () => {
    expect(API_ERRORS.NOT_FOUND.statusCode).toBe(404);
  });

  it('maps RATE_LIMITED to 429', () => {
    expect(API_ERRORS.RATE_LIMITED.statusCode).toBe(429);
  });

  it('maps INTERNAL_ERROR to 500', () => {
    expect(API_ERRORS.INTERNAL_ERROR.statusCode).toBe(500);
  });

  it('maps SERVICE_UNAVAILABLE to 503', () => {
    expect(API_ERRORS.SERVICE_UNAVAILABLE.statusCode).toBe(503);
  });
});

// ── createApiError Tests ──

describe('createApiError', () => {
  it('returns an object with ok:false', () => {
    const err = createApiError('INTERNAL_ERROR');
    expect(err.ok).toBe(false);
  });

  it('returns correct code for each error type', () => {
    const codes: ErrorCode[] = [
      'VALIDATION_ERROR', 'NOT_FOUND', 'UNAUTHORIZED',
      'FORBIDDEN', 'RATE_LIMITED', 'INTERNAL_ERROR', 'SERVICE_UNAVAILABLE',
    ];
    for (const code of codes) {
      const err = createApiError(code);
      expect(err.code).toBe(code);
    }
  });

  it('returns the correct statusCode for each error type', () => {
    expect(createApiError('VALIDATION_ERROR').statusCode).toBe(400);
    expect(createApiError('UNAUTHORIZED').statusCode).toBe(401);
    expect(createApiError('FORBIDDEN').statusCode).toBe(403);
    expect(createApiError('NOT_FOUND').statusCode).toBe(404);
    expect(createApiError('RATE_LIMITED').statusCode).toBe(429);
    expect(createApiError('INTERNAL_ERROR').statusCode).toBe(500);
    expect(createApiError('SERVICE_UNAVAILABLE').statusCode).toBe(503);
  });

  it('uses the default message when no details are provided', () => {
    const err = createApiError('NOT_FOUND');
    expect(err.error).toBe('Resource not found');
    expect(err.details).toBeUndefined();
  });

  it('appends details to the message when provided', () => {
    const err = createApiError('VALIDATION_ERROR', 'email is required');
    expect(err.error).toBe('Request validation failed: email is required');
    expect(err.details).toBe('email is required');
  });

  it('does not include details field when details is undefined', () => {
    const err = createApiError('FORBIDDEN');
    expect(err).not.toHaveProperty('details');
  });

  it('includes details field when details is provided', () => {
    const err = createApiError('RATE_LIMITED', 'try again in 30s');
    expect(err).toHaveProperty('details');
    expect(err.details).toBe('try again in 30s');
  });

  it('produces a serializable JSON object', () => {
    const err = createApiError('SERVICE_UNAVAILABLE', 'maintenance');
    const json = JSON.stringify(err);
    const parsed = JSON.parse(json);
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('SERVICE_UNAVAILABLE');
    expect(parsed.statusCode).toBe(503);
    expect(parsed.details).toBe('maintenance');
  });
});
