/**
 * Static Asset Headers Middleware
 *
 * Returns cache-control and security headers tailored to the asset type.
 * Designed for use in Next.js middleware, API routes, or edge functions
 * to optimize caching of _next/static bundles, images, fonts, and HTML.
 *
 * Cache tiers:
 * - immutable (1 year): content-hashed _next/static assets
 * - long (1 week): images and fonts (stable but not content-hashed)
 * - no-cache: HTML documents (must revalidate every time)
 */

/** Extensions considered immutable (Next.js content-hashed bundles). */
const IMMUTABLE_EXTENSIONS = new Set([".js", ".mjs", ".css", ".map"]);

/** Extensions for images and fonts (long-lived but not hashed). */
const LONG_LIVED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
]);

/** Extensions for HTML documents. */
const HTML_EXTENSIONS = new Set([".html", ".htm"]);

/**
 * Extracts the file extension (lowercased, with dot) from a filename or path.
 * Returns an empty string if no extension is found.
 */
function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return "";
  return filename.slice(dot).toLowerCase();
}

/**
 * Returns a cache-control header map appropriate for the given static asset.
 *
 * Decision logic:
 * 1. Paths containing `_next/static` -> immutable (1 year)
 * 2. Image/font extensions -> long (1 week)
 * 3. HTML extensions -> no-cache
 * 4. Default -> no-cache (conservative fallback)
 *
 * All responses include a restrictive Content-Security-Policy suitable for
 * static asset delivery (no inline scripts, no framing).
 */
export function getStaticAssetHeaders(filename: string): Record<string, string> {
  const ext = getExtension(filename);
  const isNextStatic = filename.includes("_next/static");

  let cacheControl: string;

  if (isNextStatic || IMMUTABLE_EXTENSIONS.has(ext)) {
    cacheControl = "public, max-age=31536000, s-maxage=31536000, immutable";
  } else if (LONG_LIVED_EXTENSIONS.has(ext)) {
    cacheControl = "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400";
  } else if (HTML_EXTENSIONS.has(ext)) {
    cacheControl = "no-cache, must-revalidate";
  } else {
    // Conservative default: no-cache for unknown types
    cacheControl = "no-cache, must-revalidate";
  }

  return {
    "Cache-Control": cacheControl,
    "Content-Security-Policy":
      "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; object-src 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
  };
}
