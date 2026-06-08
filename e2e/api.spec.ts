import { test, expect } from '@playwright/test';

/**
 * API endpoint E2E tests.
 *
 * These tests hit the Next.js API routes through the dev server.
 * They verify basic contract compliance (status codes, response shape)
 * without requiring external API keys.
 */

const E2E_API_KEY = 'e2e-test-key';

test.describe('Health endpoint', () => {
  test('GET /api/health returns ok status', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(body.version).toBeDefined();
  });
});

test.describe('Analyze endpoint', () => {
  test('POST /api/analyze with empty body returns 400', async ({ request }) => {
    const response = await request.post('/api/analyze', {
      data: {},
    });

    // The endpoint should reject an empty request
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('POST /api/analyze with invalid JSON returns 400', async ({ request }) => {
    const response = await request.post('/api/analyze', {
      data: 'not-json',
      headers: { 'Content-Type': 'text/plain' },
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('FBA endpoint', () => {
  test('POST /api/fba with empty body uses defaults and returns 200', async ({ request }) => {
    const response = await request.post('/api/fba', {
      data: {},
      headers: { 'X-API-Key': E2E_API_KEY },
    });

    // The FBA endpoint applies sensible defaults (ecoli, biomass, etc.)
    // so an empty body is a valid request, not a 400 error.
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.result).toBeDefined();
  });

  test('POST /api/fba with valid single-species request returns 200', async ({
    request,
  }) => {
    const response = await request.post('/api/fba', {
      data: {
        mode: 'single',
        species: 'ecoli',
        objective: 'biomass',
        glucoseUptake: 10,
        oxygenUptake: 12,
      },
      headers: { 'X-API-Key': E2E_API_KEY },
    });

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.result).toBeDefined();
  });

  test('POST /api/fba with community mode returns 200', async ({ request }) => {
    const response = await request.post('/api/fba', {
      data: {
        mode: 'community',
        objective: 'biomass',
        alpha: 0.5,
        ecoli: { glucoseUptake: 10, oxygenUptake: 12 },
        yeast: { glucoseUptake: 8, oxygenUptake: 6 },
      },
      headers: { 'X-API-Key': E2E_API_KEY },
    });

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.ok).toBe(true);
  });
});
