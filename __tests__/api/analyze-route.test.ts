/** @jest-environment node */

/**
 * Tests for the /api/analyze endpoint (AI provider chain).
 *
 * Covers: successful response, Groq→Gemini fallback chain, rate limiting,
 * invalid input, content-type validation, and body size limits.
 */

// ── Mocks (must be before imports) ──

jest.mock('../../src/services/axonDomainClassifier', () => ({
  classifyAxonDomain: jest.fn(() => ({
    category: 'scientific-pathway',
    reason: 'pathway intent',
    signals: ['pathway'],
    shouldPlan: true,
    allowProseAnswer: true,
    allowBiosynthesisPrompt: true,
  })),
}));

jest.mock('../../src/utils/rateLimit', () => ({
  checkRateLimit: jest.fn(() => Promise.resolve({ allowed: true, remaining: 9, resetMs: 60000 })),
}));

jest.mock('../../src/services/analyze/providerChain', () => ({
  tryGroq: jest.fn(),
  tryGemini: jest.fn(),
}));

jest.mock('../../src/services/analyze/outputEnricher', () => ({
  enrichAxonOutput: jest.fn((text: string) => ({ text, parseError: undefined })),
}));

// ── Imports ──

import { NextRequest } from 'next/server';
import { POST } from '../../app/api/analyze/route';
import { checkRateLimit } from '../../src/utils/rateLimit';
import { tryGroq, tryGemini } from '../../src/services/analyze/providerChain';
import { classifyAxonDomain } from '../../src/services/axonDomainClassifier';

const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockTryGroq = tryGroq as jest.MockedFunction<typeof tryGroq>;
const mockTryGemini = tryGemini as jest.MockedFunction<typeof tryGemini>;
const mockClassify = classifyAxonDomain as jest.MockedFunction<typeof classifyAxonDomain>;

const originalEnv = process.env;

// Unique IP per test to avoid rate limiter cross-contamination
let ipCounter = 0;
function uniqueIp(): string {
  ipCounter++;
  return `10.0.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
}

function createAnalyzeRequest(
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): NextRequest {
  const ip = uniqueIp();
  return new NextRequest('http://localhost:3000/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv, GROQ_API_KEY: 'test-groq-key', GEMINI_API_KEY: 'test-gemini-key' };
  mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetMs: 60000 });
  mockClassify.mockReturnValue({
    category: 'scientific-pathway',
    reason: 'pathway intent',
    signals: ['pathway'],
    shouldPlan: true,
    allowProseAnswer: true,
    allowBiosynthesisPrompt: true,
  });
});

afterAll(() => {
  process.env = originalEnv;
});

// ── Tests ──

describe('POST /api/analyze', () => {
  describe('successful responses', () => {
    it('returns Groq response when Groq succeeds', async () => {
      mockTryGroq.mockResolvedValue('{"nodes":[],"edges":[]}');

      const req = createAnalyzeRequest({
        searchQuery: 'Design a pathway for artemisinin biosynthesis',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.candidates).toBeDefined();
      expect(data.candidates[0].content.parts[0].text).toContain('nodes');
      expect(data.meta.provider).toBe('groq');
      expect(mockTryGroq).toHaveBeenCalledTimes(1);
    });

    it('returns enriched output with meta fields', async () => {
      mockTryGroq.mockResolvedValue('{"nodes":[{"id":"acetyl_coa"}],"edges":[]}');

      const req = createAnalyzeRequest({
        searchQuery: 'artemisinin pathway design',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.meta).toBeDefined();
      expect(data.meta.provider).toBe('groq');
    });

    it('accepts legacy Gemini-format body with contents array', async () => {
      mockTryGroq.mockResolvedValue('{"nodes":[],"edges":[]}');

      const req = createAnalyzeRequest({
        contents: [{ parts: [{ text: 'Design artemisinin pathway' }] }],
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockTryGroq).toHaveBeenCalledTimes(1);
    });
  });

  describe('fallback chain (Groq fails -> Gemini)', () => {
    it('falls back to Gemini when Groq returns null', async () => {
      mockTryGroq.mockResolvedValue(null);
      mockTryGemini.mockResolvedValue('{"nodes":[],"edges":[]}');

      const req = createAnalyzeRequest({
        searchQuery: 'Design a pathway for artemisinin',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.meta.provider).toBe('gemini');
      expect(mockTryGroq).toHaveBeenCalledTimes(1);
      expect(mockTryGemini).toHaveBeenCalledTimes(1);
    });

    it('returns 503 when both Groq and Gemini fail', async () => {
      mockTryGroq.mockResolvedValue(null);
      mockTryGemini.mockResolvedValue(null);

      const req = createAnalyzeRequest({
        searchQuery: 'Design a pathway for artemisinin',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(503);
      expect(data.ok).toBe(false);
      expect(data.error).toMatch(/unavailable/i);
    });

    it('skips Groq when no GROQ_API_KEY is set', async () => {
      process.env = { ...originalEnv, GEMINI_API_KEY: 'test-gemini-key' };
      delete process.env.GROQ_API_KEY;
      mockTryGemini.mockResolvedValue('{"nodes":[],"edges":[]}');

      const req = createAnalyzeRequest({
        searchQuery: 'Design artemisinin pathway',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.meta.provider).toBe('gemini');
      expect(mockTryGroq).not.toHaveBeenCalled();
      expect(mockTryGemini).toHaveBeenCalledTimes(1);
    });
  });

  describe('rate limiting', () => {
    it('returns 429 when rate limit is exceeded', async () => {
      mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetMs: 45000 });

      const req = createAnalyzeRequest({
        searchQuery: 'artemisinin pathway',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(429);
      expect(data.ok).toBe(false);
      expect(data.error).toMatch(/rate limit/i);
      expect(mockTryGroq).not.toHaveBeenCalled();
    });
  });

  describe('invalid input', () => {
    it('returns 400 for missing contents and searchQuery', async () => {
      const req = createAnalyzeRequest({});
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/invalid request body/i);
    });

    it('returns 400 for invalid JSON body', async () => {
      const ip = uniqueIp();
      const req = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': ip,
        },
        body: 'not-valid-json',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/invalid json/i);
    });

    it('returns 415 for non-JSON content type', async () => {
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
      const data = await res.json();

      expect(res.status).toBe(415);
      expect(data.error).toMatch(/content type/i);
    });

    it('returns 500 when no API keys are configured', async () => {
      process.env = { ...originalEnv };
      delete process.env.GROQ_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const req = createAnalyzeRequest({
        searchQuery: 'artemisinin pathway',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toMatch(/api keys/i);
    });

    it('returns 413 when body exceeds size limit', async () => {
      const ip = uniqueIp();
      const bigBody = JSON.stringify({ searchQuery: 'x'.repeat(200) });
      const req = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': ip,
          'content-length': String(1_000_001),
        },
        body: bigBody,
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(413);
      expect(data.error).toMatch(/too large/i);
    });
  });

  describe('off-domain rejection', () => {
    it('returns refusal for off-domain queries', async () => {
      mockClassify.mockReturnValue({
        category: 'off-domain',
        reason: 'political content',
        signals: ['politics'],
        shouldPlan: false,
        allowBiosynthesisPrompt: false,
        allowProseAnswer: false,
      });

      const req = createAnalyzeRequest({
        searchQuery: 'Who won the election?',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.meta.provider).toBe('none');
      expect(data.meta.domain.category).toBe('off-domain');
      expect(mockTryGroq).not.toHaveBeenCalled();
    });
  });
});
