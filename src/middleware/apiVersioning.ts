/**
 * API Versioning Middleware
 *
 * Extracts API version from URL path segments (/api/v1/..., /api/v2/...),
 * attaches version metadata to responses, and handles deprecation notices
 * for older versions via Deprecation + Sunset headers.
 *
 * Design:
 * - URL-first versioning: /api/v{n}/... is the source of truth.
 * - If no version segment is present the request is treated as "unversioned"
 *   (equivalent to latest) so existing un-versioned routes keep working.
 * - Deprecation is declared per-version in the VERSION_REGISTRY below.
 */

// ─── Version Registry ───────────────────────────────────────────────

export interface VersionMeta {
  /** Semver-ish string returned in X-API-Version */
  version: string;
  /** When true, Deprecation + Sunset headers are emitted */
  deprecated: boolean;
  /** ISO-8601 date after which the version will stop being served */
  sunsetDate?: string;
  /** Human-readable deprecation message (optional, for documentation) */
  deprecationMessage?: string;
}

/**
 * Ordered map of version segment -> metadata.
 * Add new entries here when introducing a new API version.
 */
const VERSION_REGISTRY: Record<string, VersionMeta> = {
  v1: {
    version: "1",
    deprecated: false,
  },
  // Example: uncomment when v2 ships and v1 is deprecated
  // v2: {
  //   version: '2',
  //   deprecated: false,
  // },
  // v1: {
  //   version: '1',
  //   deprecated: true,
  //   sunsetDate: '2027-01-01',
  //   deprecationMessage: 'API v1 is deprecated. Please migrate to v2.',
  // },
};

/** The version segment returned when the URL carries no /v{n}/ prefix. */
const DEFAULT_VERSION = "unversioned";

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Extract the API version from a request URL.
 *
 * Recognises paths like `/api/v1/tools/fbasim` and returns `"1"`.
 * Returns `"unversioned"` when the URL has no `/v{n}/` segment so that
 * existing routes keep working without changes.
 *
 * @param request - The incoming Request (or any object with a `url` property).
 * @returns A version string, e.g. `"1"`, `"2"`, or `"unversioned"`.
 */
export function getApiVersion(request: { url: string }): string {
  const match = request.url.match(/\/api\/(v\d+)\//);
  if (!match) return DEFAULT_VERSION;

  const segment = match[1]; // e.g. "v1"
  const meta = VERSION_REGISTRY[segment];
  return meta ? meta.version : segment.replace("v", "");
}

/**
 * Add version-related headers to a Response.
 *
 * Always sets `X-API-Version`.  For deprecated versions the function also
 * adds the IETF draft `Deprecation` header (RFC 8594-style) and the
 * `Sunset` header with the configured sunset date.
 *
 * Because Response headers are immutable in the Fetch API, this function
 * returns a **new** Response with the extra headers merged in.  The
 * original response body is streamed through without buffering.
 *
 * @param response - The original Response to augment.
 * @param version  - Version string from `getApiVersion`.
 * @returns A new Response with version headers attached.
 */
export function addVersionHeaders(response: Response, version: string): Response {
  const headers = new Headers(response.headers);
  headers.set("X-API-Version", version);

  const segment = `v${version}`;
  const meta = VERSION_REGISTRY[segment];

  if (meta?.deprecated) {
    headers.set("Deprecation", "true");
    if (meta.sunsetDate) {
      headers.set("Sunset", meta.sunsetDate);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Look up full metadata for a version segment (e.g. "v1").
 * Returns undefined for unknown segments.
 */
export function getVersionMeta(segment: string): VersionMeta | undefined {
  return VERSION_REGISTRY[segment];
}

/**
 * Check whether a given version is deprecated.
 */
export function isVersionDeprecated(version: string): boolean {
  const segment = `v${version}`;
  const meta = VERSION_REGISTRY[segment];
  return meta?.deprecated ?? false;
}
