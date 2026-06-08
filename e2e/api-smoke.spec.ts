import { test, expect } from '@playwright/test';

/**
 * API route smoke tests.
 *
 * These tests verify that the proxy/edge API routes return proper
 * error responses when called without required parameters.
 * No external API keys are needed for these negative-path tests.
 */

const E2E_API_KEY = 'e2e-test-key';

test.describe('AlphaFold proxy', () => {
  test('GET /api/alphafold without id returns 400', async ({ request }) => {
    const response = await request.get('/api/alphafold');
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('Missing id');
  });
});

test.describe('PubChem proxy', () => {
  test('GET /api/pubchem without cid or name returns 400', async ({
    request,
  }) => {
    const response = await request.get('/api/pubchem');
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('cid');
  });
});

test.describe('KEGG proxy', () => {
  test('GET /api/kegg without parameters returns 400', async ({ request }) => {
    const response = await request.get('/api/kegg');
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBeDefined();
  });
});

test.describe('Workbench API', () => {
  test('GET /api/workbench returns ok with state', async ({ request }) => {
    const response = await request.get('/api/workbench', {
      headers: { 'X-API-Key': E2E_API_KEY },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.state).toBeDefined();
    expect(body.backend).toBeDefined();
  });
});
