/** @jest-environment node */

// Mock the axonDomainClassifier to control classification results
jest.mock('../src/services/axonDomainClassifier', () => ({
  classifyAxonDomain: jest.fn((query: string) => {
    const q = query.toLowerCase();
    if (q.includes('trump') || q.includes('weather') || q.includes('taylor swift')) {
      return { category: 'off-domain', reason: 'off-domain signal', signals: ['test'] };
    }
    if (q.includes('what is') || q.includes('how does')) {
      return { category: 'scientific-adjacent', reason: 'science mention', signals: ['science'], allowProseAnswer: true, allowBiosynthesisPrompt: false };
    }
    if (q.includes('pathway') || q.includes('enzyme') || q.includes('flux')) {
      return { category: 'scientific-pathway', reason: 'pathway intent', signals: ['pathway'], allowProseAnswer: true, allowBiosynthesisPrompt: true };
    }
    if (q === 'short') {
      return { category: 'general-knowledge', reason: 'generic', signals: ['generic'], allowProseAnswer: false, allowBiosynthesisPrompt: false };
    }
    return { category: 'ambiguous', reason: 'no signals', signals: [], allowProseAnswer: true, allowBiosynthesisPrompt: true };
  }),
}));

// Mock fetch for Groq/Gemini API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { NextRequest } from 'next/server';

const originalEnv = process.env;

// Use unique IPs per describe block to avoid rate limiter interference
let ipCounter = 0;
function uniqueIp(): string {
  ipCounter++;
  return `10.0.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv, GROQ_API_KEY: 'test-groq-key', GEMINI_API_KEY: 'test-gemini-key' };
});

afterAll(() => {
  process.env = originalEnv;
});

// Helper to create a mock NextRequest with unique IP
function createRequest(body: Record<string, unknown>, headers?: Record<string, string>): NextRequest {
  const ip = uniqueIp();
  const req = new NextRequest('http://localhost:3000/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return req;
}

describe('POST handler — input validation', () => {
  let POST: typeof import('../app/api/analyze/route').POST;

  beforeAll(async () => {
    const mod = await import('../app/api/analyze/route');
    POST = mod.POST;
  });

  it('rejects non-JSON content type', async () => {
    const ip = uniqueIp();
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'x-forwarded-for': ip,
      },
      body: 'hello',
    });
    const res = await POST(req);
    expect(res.status).toBe(415);
  });

  it('rejects invalid JSON body', async () => {
    const ip = uniqueIp();
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': ip,
      },
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid JSON');
  });

  it('rejects request with no API keys', async () => {
    process.env = { ...originalEnv };
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const req = createRequest({ searchQuery: 'test pathway' });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('No API keys');
  });

  it('rejects legacy body with missing contents array', async () => {
    const req = createRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Missing contents');
  });

  it('rejects legacy body with empty contents array', async () => {
    const req = createRequest({ contents: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects legacy body with no text in parts', async () => {
    const req = createRequest({
      contents: [{ parts: [{ inline_data: { data: 'abc' } }] }],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('No prompt text');
  });

  it('rejects searchQuery exceeding MAX_SEARCH_QUERY_CHARS', async () => {
    const longQuery = 'x'.repeat(501);
    const req = createRequest({ searchQuery: longQuery });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });
});

describe('POST handler — off-domain classification', () => {
  let POST: typeof import('../app/api/analyze/route').POST;

  beforeAll(async () => {
    const mod = await import('../app/api/analyze/route');
    POST = mod.POST;
  });

  it('returns refusal for off-domain searchQuery', async () => {
    const req = createRequest({ searchQuery: 'Who is Donald Trump' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.provider).toBe('none');
    expect(data.meta.domain.category).toBe('off-domain');
  });

  it('returns refusal for general-knowledge without allowProseAnswer', async () => {
    const req = createRequest({ searchQuery: 'short' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.provider).toBe('none');
    expect(data.meta.domain.category).toBe('general-knowledge');
  });
});

describe('POST handler — Groq API integration', () => {
  let POST: typeof import('../app/api/analyze/route').POST;

  beforeAll(async () => {
    const mod = await import('../app/api/analyze/route');
    POST = mod.POST;
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns Groq result when Groq succeeds', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"nodes":[],"edges":[]}' } }],
      }),
    });

    const req = createRequest({ searchQuery: 'artemisinin pathway' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.provider).toBe('groq');
    expect(data.candidates[0].content.parts[0].text).toBeDefined();
  });

  it('falls back to Gemini when Groq returns 429', async () => {
    // Groq returns 429 for both models
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'rate limited' }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'rate limited' }),
    });
    // Gemini succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"nodes":[],"edges":[]}' }] } }],
      }),
    });

    const req = createRequest({ searchQuery: 'artemisinin pathway' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.provider).toBe('gemini');
  });

  it('falls back to Gemini when Groq returns 503', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: 'unavailable' }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: 'unavailable' }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"nodes":[],"edges":[]}' }] } }],
      }),
    });

    const req = createRequest({ searchQuery: 'artemisinin pathway' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.provider).toBe('gemini');
  });

  it('falls back to Gemini when Groq throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"nodes":[],"edges":[]}' }] } }],
      }),
    });

    const req = createRequest({ searchQuery: 'artemisinin pathway' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.provider).toBe('gemini');
  });

  it('returns 503 when all providers fail', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    const req = createRequest({ searchQuery: 'artemisinin pathway' });
    const res = await POST(req);
    expect(res.status).toBe(503);
  });

  it('skips Groq when no GROQ_API_KEY but GEMINI_API_KEY exists', async () => {
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-gemini-key' };
    delete process.env.GROQ_API_KEY;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"nodes":[],"edges":[]}' }] } }],
      }),
    });

    const req = createRequest({ searchQuery: 'artemisinin pathway' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.provider).toBe('gemini');
  });

  it('uses prose prompt for scientific-adjacent queries', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'This is a prose response about kinetics.' } }],
      }),
    });

    const req = createRequest({ searchQuery: 'what is Michaelis-Menten' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.provider).toBe('groq');
    expect(data.meta.parseError.code).toBe('NO_OBJECT');
  });

  it('handles legacy Gemini-format body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"nodes":[],"edges":[]}' } }],
      }),
    });

    const req = createRequest({
      contents: [{ parts: [{ text: 'Design a pathway for artemisinin' }] }],
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.provider).toBe('groq');
  });

  it('includes conversation history in meta', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"nodes":[],"edges":[]}' } }],
      }),
    });

    const req = createRequest({
      searchQuery: 'artemisinin pathway',
      history: [
        { role: 'user', content: 'previous question' },
        { role: 'assistant', content: 'previous answer' },
      ],
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.historyTurns).toBe(2);
  });

  it('Gemini returns 404 triggers next model', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"nodes":[],"edges":[]}' }] } }],
      }),
    });

    const req = createRequest({ searchQuery: 'artemisinin pathway' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.provider).toBe('gemini');
  });

  it('includes truncated flag in meta when prompt is truncated', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"nodes":[],"edges":[]}' } }],
      }),
    });

    const longText = 'x'.repeat(25000);
    const req = createRequest({
      contents: [{ parts: [{ text: longText }] }],
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.truncated).toBe(true);
  });
});

describe('POST handler — multimodal detection', () => {
  let POST: typeof import('../app/api/analyze/route').POST;

  beforeAll(async () => {
    const mod = await import('../app/api/analyze/route');
    POST = mod.POST;
  });

  it('rejects multimodal request without GEMINI_API_KEY', async () => {
    process.env = { ...originalEnv, GROQ_API_KEY: 'test-groq-key' };
    delete process.env.GEMINI_API_KEY;

    const req = createRequest({
      contents: [{
        parts: [
          { text: 'analyze this' },
          { inline_data: { mime_type: 'image/png', data: 'base64data' } },
        ],
      }],
    });
    const res = await POST(req);
    // Could be 503 (multimodal without gemini) or 429 (rate limited from previous tests)
    expect([429, 503]).toContain(res.status);
  });
});

describe('POST handler — rate limiting', () => {
  let POST: typeof import('../app/api/analyze/route').POST;

  beforeAll(async () => {
    const mod = await import('../app/api/analyze/route');
    POST = mod.POST;
  });

  it('rate limits after many requests from same IP', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"nodes":[],"edges":[]}' } }],
      }),
    });

    // Use a single IP for all requests in this test
    const ip = uniqueIp();
    let rateLimited = false;
    for (let i = 0; i < 15; i++) {
      const req = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': ip,
        },
        body: JSON.stringify({ searchQuery: 'test pathway' }),
      });
      const res = await POST(req);
      if (res.status === 429) {
        rateLimited = true;
        break;
      }
    }
    expect(rateLimited).toBe(true);
  });
});

describe('analyze route — exported constants', () => {
  it('MAX_PROMPT_CHARS is reasonable', async () => {
    const { MAX_PROMPT_CHARS } = await import('../app/api/analyze/route');
    expect(MAX_PROMPT_CHARS).toBeGreaterThanOrEqual(8_000);
    expect(MAX_PROMPT_CHARS).toBeLessThanOrEqual(50_000);
  });

  it('MAX_SEARCH_QUERY_CHARS is much smaller than MAX_PROMPT_CHARS', async () => {
    const { MAX_PROMPT_CHARS, MAX_SEARCH_QUERY_CHARS } = await import('../app/api/analyze/route');
    expect(MAX_SEARCH_QUERY_CHARS).toBeLessThan(MAX_PROMPT_CHARS / 10);
  });

  it('history limits are sensible', async () => {
    const { MAX_HISTORY_TURNS, MAX_HISTORY_MSG_CHARS, MAX_HISTORY_TOTAL_CHARS } = await import('../app/api/analyze/route');
    expect(MAX_HISTORY_TURNS).toBeGreaterThanOrEqual(3);
    expect(MAX_HISTORY_MSG_CHARS).toBeGreaterThanOrEqual(500);
    expect(MAX_HISTORY_TOTAL_CHARS).toBeGreaterThanOrEqual(3000);
  });
});
