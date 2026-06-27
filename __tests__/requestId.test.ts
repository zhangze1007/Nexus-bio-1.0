/**
 * @jest-environment node
 */

import {
  generateRequestId,
  getRequestId,
  addRequestId,
} from '../src/middleware/requestId';

// ─── Constants ──────────────────────────────────────────────────────────────

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('generateRequestId', () => {
  it('returns a valid UUID v4 string', () => {
    const id = generateRequestId();
    expect(id).toMatch(UUID_V4_REGEX);
  });

  it('generates unique IDs on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()));
    // All 100 should be unique
    expect(ids.size).toBe(100);
  });

  it('returns a 36-character string (8-4-4-4-12 with hyphens)', () => {
    const id = generateRequestId();
    expect(id).toHaveLength(36);
    // Count hyphens
    expect(id.split('-')).toHaveLength(5);
  });
});

describe('getRequestId', () => {
  it('returns the existing x-request-id header when present and valid', () => {
    const existingId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    const request = new Request('http://localhost/api/test', {
      headers: { 'x-request-id': existingId },
    });

    expect(getRequestId(request)).toBe(existingId);
  });

  it('generates a new UUID when x-request-id header is missing', () => {
    const request = new Request('http://localhost/api/test');
    const id = getRequestId(request);

    expect(id).toMatch(UUID_V4_REGEX);
  });

  it('generates a new UUID when x-request-id header has invalid format', () => {
    const request = new Request('http://localhost/api/test', {
      headers: { 'x-request-id': 'not-a-valid-uuid' },
    });

    const id = getRequestId(request);
    expect(id).toMatch(UUID_V4_REGEX);
    expect(id).not.toBe('not-a-valid-uuid');
  });

  it('rejects UUIDs with wrong version nibble', () => {
    // Version 1 UUID (second group starts with 1, not 4)
    const v1 = 'a1b2c3d4-e5f6-1a7b-8c9d-0e1f2a3b4c5d';
    const request = new Request('http://localhost/api/test', {
      headers: { 'x-request-id': v1 },
    });

    const id = getRequestId(request);
    // Should NOT return the v1 UUID — should generate a fresh v4
    expect(id).not.toBe(v1);
    expect(id).toMatch(UUID_V4_REGEX);
  });

  it('rejects UUIDs with wrong variant bits', () => {
    // Variant bits wrong: 7xxx instead of 8xxx/9xxx/axxx/bxxx
    const badVariant = 'a1b2c3d4-e5f6-4a7b-7c9d-0e1f2a3b4c5d';
    const request = new Request('http://localhost/api/test', {
      headers: { 'x-request-id': badVariant },
    });

    const id = getRequestId(request);
    expect(id).not.toBe(badVariant);
    expect(id).toMatch(UUID_V4_REGEX);
  });
});

describe('addRequestId', () => {
  it('sets the x-request-id header on the response', () => {
    const response = new Response('ok');
    const requestId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

    addRequestId(response, requestId);

    expect(response.headers.get('x-request-id')).toBe(requestId);
  });

  it('returns the same response object for chaining', () => {
    const response = new Response('ok');
    const result = addRequestId(response, 'test-id');

    expect(result).toBe(response);
  });

  it('overwrites an existing x-request-id header', () => {
    const response = new Response('ok', {
      headers: { 'x-request-id': 'old-id' },
    });

    addRequestId(response, 'new-id');

    expect(response.headers.get('x-request-id')).toBe('new-id');
  });
});
