import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, getRateLimitConfig } from "@/src/utils/rateLimit";

/**
 * Next.js Edge Middleware — API authentication + rate limiting + request IDs.
 *
 * Runs on every /api/* request before the route handler.
 * Health check (/api/health) is exempt from auth but still gets rate-limited.
 *
 * Auth:
 *   - Public routes (no key needed): /api/health, /api/alphafold, /api/pubchem, /api/kegg
 *   - Protected routes: /api/analyze, /api/fba, /api/files/*, /api/workbench, /api/scspatial/*
 *   - Auth methods (checked in order):
 *     1. Same-origin requests (Sec-Fetch-Site: same-origin) are allowed
 *     2. X-API-Key header with nxb_ prefix → DB-backed key validation (hash + lookup)
 *     3. X-API-Key header → legacy NEXUS_API_KEY env var comparison
 *     4. Authorization: Bearer <token> → legacy NEXUS_API_KEY env var comparison
 *
 * Rate limiting:
 *   - Upstash Redis sliding window when configured, in-memory fallback otherwise
 *   - Read (GET): 60 req/min
 *   - Write (POST/PUT/DELETE): 20 req/min
 *   - Analyze endpoint: 10 req/min (AI calls are expensive)
 *   - Proxy endpoints: 30 req/min
 */

// ── Config ────────────────────────────────────────────────────────────
// Read at runtime (not module level) so env vars set after build are available.
function getApiKey(): string | undefined {
  return process.env.NEXUS_API_KEY;
}

/** Routes that require authentication */
const PROTECTED_ROUTES = [
  "/api/analyze",
  "/api/fba",
  "/api/files",
  "/api/workbench",
  "/api/scspatial",
  "/api/admin",
  "/api/gdpr",
  "/api/billing",
  "/api/health/env",
];

/** Routes that require API key auth (same-origin trust NOT sufficient) */
const HIGH_SECURITY_ROUTES = ["/api/admin", "/api/gdpr", "/api/health/env"];

/**
 * Public read-only COMPUTE routes: stateless scientific computation that takes its input
 * in the request body and returns a result, with NO user data and no privileged side
 * effects. These are POSTed by the in-app tools, so same-origin browser requests are
 * trusted for ANY method (a POST body here is a computation input, not a state change).
 * Cross-origin callers still need an API key (they remain in PROTECTED_ROUTES).
 *
 * This is DELIBERATELY distinct from user-data / write routes — /api/workbench (a user's
 * saved project), /api/files (uploads/storage), /api/scspatial/ingest (data upload),
 * /api/billing — whose WRITES always require an explicit credential, and from
 * HIGH_SECURITY_ROUTES (admin/gdpr) which never accept same-origin trust. Do NOT add a
 * write or user-data route to this list.
 */
const SAME_ORIGIN_COMPUTE_ROUTES = [
  "/api/fba", // FBA / FVA / gene-deletion — deterministic metabolic computation (covers /api/fba/stream)
  "/api/analyze", // AI analysis — same-origin only (NOT fully public); abuse bounded by the 10 req/min rate limit
  "/api/scspatial/query", // read-only single-cell / spatial query + analysis (NOT /api/scspatial/ingest, which is a write)
];

/** Routes that are public (no auth needed) */
const PUBLIC_ROUTES = [
  "/api/health",
  "/api/alphafold",
  "/api/pubchem",
  "/api/kegg",
  "/api/gemini", // legacy alias for analyze
];

// ── Edge-compatible SHA-256 ───────────────────────────────────────────
/**
 * Compute SHA-256 hex digest using the Web Crypto API.
 * Produces the same output as hashApiKey() from src/utils/apiKeys.ts
 * but uses the Edge-compatible crypto.subtle API instead of Node.js crypto.createHash.
 */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── DB-backed API key validation ──────────────────────────────────────
/**
 * Validate an nxb_ prefixed API key against the database.
 * Hashes the key with SHA-256, looks up in api_keys table,
 * checks expiry, and updates last_used_at.
 *
 * Requires TURSO_DATABASE_URL to be set. Returns false if DB is unavailable.
 */
async function validateNxbKey(providedKey: string): Promise<boolean> {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (!tursoUrl) return false;

  try {
    const { createClient } = await import("@libsql/client");
    const client = createClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    const hash = await sha256Hex(providedKey);

    const result = await client.execute({
      sql: "SELECT id, expires_at FROM api_keys WHERE key_hash = ?",
      args: [hash],
    });

    if (result.rows.length === 0) return false;

    const row = result.rows[0];

    // Check expiry
    if (row.expires_at) {
      const expiresAt = new Date(row.expires_at as string);
      if (expiresAt < new Date()) return false;
    }

    // Update last_used_at (fire-and-forget, non-blocking)
    client
      .execute({
        sql: "UPDATE api_keys SET last_used_at = ? WHERE id = ?",
        args: [new Date().toISOString(), row.id as string],
      })
      .catch(() => {
        /* swallow — auth already succeeded */
      });

    return true;
  } catch {
    return false;
  }
}

// ── Auth Check ────────────────────────────────────────────────────────
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

function isHighSecurityRoute(pathname: string): boolean {
  return HIGH_SECURITY_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Check if the request is authenticated.
 *
 * Supports three auth methods:
 *   1. Same-origin (Sec-Fetch-Site: same-origin) — trusted browser requests (NOT for high-security routes)
 *   2. nxb_ prefixed API keys — SHA-256 hashed and validated against DB
 *   3. Legacy NEXUS_API_KEY env var — direct string comparison via X-API-Key or Bearer
 *
 * @param highSecurity - If true, skip same-origin trust (admin, GDPR, health/env routes)
 */
async function isAuthenticated(req: NextRequest, highSecurity = false): Promise<boolean> {
  // Same-origin trust (Sec-Fetch-Site is browser-set and cannot be forged cross-origin,
  // so it is a valid CSRF defense). Reach differs by route class:
  //   - Read-only methods (GET/HEAD/OPTIONS): trusted for any protected route.
  //   - Read-only COMPUTE routes (SAME_ORIGIN_COMPUTE_ROUTES, no user data): trusted for
  //     ANY method — a POST body is just a computation input, not a state change. This is
  //     what lets anonymous in-app tools (e.g. FBA) run without a key.
  //   - Everything else (user-data/storage WRITES, e.g. /api/workbench PUT, /api/files):
  //     the write still requires an explicit credential below.
  // High-security routes (admin, GDPR, health/env) skip same-origin trust entirely.
  const method = req.method.toUpperCase();
  const isReadOnly = method === "GET" || method === "HEAD" || method === "OPTIONS";
  const isComputeRoute = SAME_ORIGIN_COMPUTE_ROUTES.some((route) => req.nextUrl.pathname.startsWith(route));
  if (!highSecurity && (isReadOnly || isComputeRoute)) {
    const secFetchSite = req.headers.get("sec-fetch-site");
    if (secFetchSite === "same-origin") return true;
  }

  const providedKey = req.headers.get("x-api-key");

  // nxb_ prefixed keys: hash and look up in database
  if (providedKey && providedKey.startsWith("nxb_")) {
    return validateNxbKey(providedKey);
  }

  const apiKey = getApiKey();

  // If no API key is configured, only same-origin requests are allowed.
  // External callers must provide a key — never silently bypass auth.
  if (!apiKey) return false;

  // Check X-API-Key header (legacy direct comparison)
  if (providedKey === apiKey) return true;

  // Check Authorization: Bearer <token>
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token === apiKey) return true;
  }

  return false;
}

// ── Request ID & CSP Nonce ─────────────────────────────────────────────
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate a cryptographic nonce for CSP (R-17). */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

// ── Middleware ─────────────────────────────────────────────────────────
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const nonce = generateNonce();

  // ── CSP nonce for all routes (R-17) ──
  // Generate nonce and set CSP header. Next.js 14+ reads x-nonce header.
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' cdnjs.cloudflare.com 3Dmol.org`,
    `style-src 'self' 'nonce-${nonce}'`,
    "font-src 'self'",
    "img-src 'self' data: blob: https: upload.wikimedia.org cellimagelibrary.org idr.openmicroscopy.org",
    "connect-src 'self' https://eutils.ncbi.nlm.nih.gov https://www.ebi.ac.uk https://api.semanticscholar.org https://api.openalex.org https://api.core.ac.uk https://europepmc.org https://doi.org https://nexus-bio-1-0.vercel.app https://nexus-bio.org https://*.turso.io *.sentry.io",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  // For page routes, set CSP and pass nonce
  if (!pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    response.headers.set("Content-Security-Policy", cspHeader);
    response.headers.set("x-nonce", nonce);
    return response;
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1";
  const requestId = generateRequestId();

  // ── Rate Limiting (Upstash Redis with in-memory fallback) ──
  const rateLimit = await checkRateLimit(ip, pathname);

  if (!rateLimit.allowed) {
    const config = getRateLimitConfig(pathname);
    return NextResponse.json(
      {
        ok: false,
        error: "Rate limit exceeded",
        retryAfterMs: rateLimit.resetMs,
        requestId,
      },
      {
        status: 429,
        headers: {
          "X-Request-Id": requestId,
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
          "Retry-After": String(Math.ceil(rateLimit.resetMs / 1000)),
        },
      },
    );
  }

  // ── Authentication ──
  if (isProtectedRoute(pathname) && !(await isAuthenticated(req, isHighSecurityRoute(pathname)))) {
    return NextResponse.json(
      {
        ok: false,
        error: "Authentication required",
        message: "Provide a valid API key via X-API-Key header or Authorization: Bearer token.",
        requestId,
      },
      {
        status: 401,
        headers: {
          "X-Request-Id": requestId,
          "WWW-Authenticate": 'Bearer realm="nexus-bio"',
        },
      },
    );
  }

  // ── Pass through with request metadata ──
  const config = getRateLimitConfig(pathname);
  const response = NextResponse.next();
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-RateLimit-Limit", String(config.limit));
  response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
