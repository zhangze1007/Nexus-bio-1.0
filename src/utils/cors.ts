/**
 * Shared CORS utility for all API routes.
 * Restricts origins to known deployments instead of wildcard '*'.
 */

const ALLOWED_ORIGINS = ["https://nexus-bio-1-0.vercel.app", "http://localhost:3000", "http://localhost:3001"];

/**
 * Build CORS headers for a request. Falls back to the primary origin
 * if the request origin is not in the allowlist.
 */
export function getCorsHeaders(req?: Request): Record<string, string> {
  let origin = ALLOWED_ORIGINS[0];
  if (req) {
    const reqOrigin = req.headers.get("origin") ?? "";
    if (ALLOWED_ORIGINS.includes(reqOrigin)) {
      origin = reqOrigin;
    }
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-workbench-actor-id, x-workbench-project-id",
  };
}

/**
 * Standard OPTIONS preflight handler.
 */
export function handleOptions(req?: Request): Response {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(req),
  });
}
