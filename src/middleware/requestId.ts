/**
 * Request ID Middleware
 *
 * Ensures every API request carries a unique identifier (UUID v4)
 * that flows through logs, error responses, and downstream services.
 *
 * Usage in Next.js middleware (middleware.ts):
 *   import { addRequestId } from '@/middleware/requestId';
 *   export function middleware(request: NextRequest) {
 *     const id = getRequestId(request);
 *     const response = NextResponse.next();
 *     addRequestId(response, id);
 *     return response;
 *   }
 *
 * Usage in API routes:
 *   import { getRequestId } from '@/middleware/requestId';
 *   const requestId = getRequestId(request);
 */

// ─── UUID Generation ────────────────────────────────────────────────────────

/**
 * Generate a UUID v4.
 * Uses crypto.randomUUID() when available (Node 19+, modern Edge runtimes),
 * falls back to a manual implementation for older environments.
 */
export function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback: manual UUID v4 generation using crypto.getRandomValues
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    // Last resort — Math.random (not cryptographically secure, but functional)
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Set version (4) and variant (10xx) bits per RFC 4122
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join("-");
}

// ─── Header Operations ──────────────────────────────────────────────────────

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Extract an existing request ID from the request headers, or generate a new one.
 *
 * @param request  A Request (or NextRequest) object.
 * @returns The request ID string (UUID v4).
 */
export function getRequestId(request: Request): string {
  const existing = request.headers.get(REQUEST_ID_HEADER);
  if (existing && isValidUUID(existing)) {
    return existing;
  }
  return generateRequestId();
}

/**
 * Set the X-Request-ID header on a Response (or NextResponse) object.
 * Returns the response for chaining.
 *
 * @param response    A Response (or NextResponse) object.
 * @param requestId   The UUID to set.
 * @returns The same response object (for chaining).
 */
export function addRequestId(response: Response, requestId: string): Response {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate that a string is a UUID v4 format.
 * Enforces version nibble = 4 and variant bits = 10xx (8, 9, a, b).
 */
function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
