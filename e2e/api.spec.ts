import { test, expect } from '@playwright/test';

/**
 * API endpoint E2E tests.
 *
 * These tests hit the Next.js API routes through the dev server.
 * They verify basic contract compliance (status codes, response shape)
 * without requiring external API keys.
 */

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
  test('POST /api/fba with empty body returns 400', async ({ request }) => {
    const response = await request.post('/api/fba', {
      data: {},
    });

    // The FBA endpoint returns 400 for invalid payloads
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBeDefined();
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
    });

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.ok).toBe(true);
  });
});
