import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit, getRateLimitConfig } from '@/src/utils/rateLimit';

/**
 * Next.js Edge Middleware — API authentication + rate limiting + request IDs.
 *
 * Runs on every /api/* request before the route handler.
 * Health check (/api/health) is exempt from auth but still gets rate-limited.
 *
 * Auth:
 *   - Public routes (no key needed): /api/health, /api/alphafold, /api/pubchem, /api/kegg
 *   - Protected routes: /api/analyze, /api/fba, /api/workbench, /api/scspatial/*
 *   - Auth methods (checked in order):
 *     1. X-API-Key header
 *     2. Authorization: Bearer <token>
 *     3. Same-origin requests (Sec-Fetch-Site: same-origin) are allowed
 *
 * Rate limiting:
 *   - Upstash Redis sliding window when configured, in-memory fallback otherwise
 *   - Read (GET): 60 req/min
 *   - Write (POST/PUT/DELETE): 20 req/min
 *   - Analyze endpoint: 10 req/min (AI calls are expensive)
 *   - Proxy endpoints: 30 req/min
 */

// ── Config ────────────────────────────────────────────────────────────
const API_KEY = process.env.NEXUS_API_KEY;

/** Routes that require authentication */
const PROTECTED_ROUTES = [
  '/api/analyze',
  '/api/fba',
  '/api/workbench',
  '/api/scspatial',
];

/** Routes that are public (no auth needed) */
const PUBLIC_ROUTES = [
  '/api/health',
  '/api/alphafold',
  '/api/pubchem',
  '/api/kegg',
  '/api/gemini', // legacy alias for analyze
];

// ── Auth Check ────────────────────────────────────────────────────────
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
}

function isAuthenticated(req: NextRequest): boolean {
  // Same-origin requests are trusted (browser-initiated from the app)
  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite === 'same-origin') return true;

  // If no API key is configured, only same-origin requests are allowed.
  // External callers must provide a key — never silently bypass auth.
  if (!API_KEY) return false;

  // Check X-API-Key header
  const apiKey = req.headers.get('x-api-key');
  if (apiKey === API_KEY) return true;

  // Check Authorization: Bearer <token>
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token === API_KEY) return true;
  }

  return false;
}

// ── Request ID ────────────────────────────────────────────────────────
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Middleware ─────────────────────────────────────────────────────────
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only run on API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '127.0.0.1';
  const requestId = generateRequestId();

  // ── Rate Limiting (Upstash Redis with in-memory fallback) ──
  const rateLimit = await checkRateLimit(ip, pathname);

  if (!rateLimit.allowed) {
    const config = getRateLimitConfig(pathname);
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        retryAfterMs: rateLimit.resetMs,
        requestId,
      },
      {
        status: 429,
        headers: {
          'X-Request-Id': requestId,
          'X-RateLimit-Limit': String(config.limit),
          'X-RateLimit-Remaining': '0',
          'Retry-After': String(Math.ceil(rateLimit.resetMs / 1000)),
        },
      }
    );
  }

  // ── Authentication ──
  if (isProtectedRoute(pathname) && !isAuthenticated(req)) {
    return NextResponse.json(
      {
        error: 'Authentication required',
        message: 'Provide a valid API key via X-API-Key header or Authorization: Bearer token.',
        requestId,
      },
      {
        status: 401,
        headers: {
          'X-Request-Id': requestId,
          'WWW-Authenticate': 'Bearer realm="nexus-bio"',
        },
      }
    );
  }

  // ── Pass through with request metadata ──
  const config = getRateLimitConfig(pathname);
  const response = NextResponse.next();
  response.headers.set('X-Request-Id', requestId);
  response.headers.set('X-RateLimit-Limit', String(config.limit));
  response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
