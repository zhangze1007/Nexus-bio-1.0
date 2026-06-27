/**
 * Asset Manifest Utility
 *
 * Provides CDN-aware URL generation and critical asset preloading for
 * Next.js static assets. When the CDN_URL environment variable is set,
 * all asset paths are rewritten to point at the CDN; otherwise local
 * paths are returned unchanged.
 *
 * Usage:
 *   import { getAssetUrl, preloadCriticalAssets } from '@/utils/assetManifest';
 *
 *   // In a layout or _document:
 *   const links = preloadCriticalAssets();
 *   // -> ['<link rel="preload" href="/_next/static/css/app.css" as="style" />', ...]
 */

/**
 * Critical CSS and JS paths that should be preloaded for fast initial render.
 * These correspond to Next.js App Router default bundles — adjust as the
 * project's build output evolves.
 */
const CRITICAL_ASSETS: Array<{ path: string; as: string; type?: string }> = [
  { path: '/_next/static/css/app/layout.css', as: 'style' },
  { path: '/_next/static/chunks/main.js', as: 'script' },
  { path: '/_next/static/chunks/app/layout.js', as: 'script' },
  { path: '/_next/static/chunks/webpack.js', as: 'script' },
];

/**
 * Normalizes a base URL by stripping any trailing slash.
 */
function normalizeBaseUrl(base: string): string {
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

/**
 * Returns the full URL for a static asset path.
 *
 * When `CDN_URL` is set in the environment, the path is prefixed with the
 * CDN origin. Otherwise the original path is returned as-is (local fallback).
 *
 * @param path - Asset path relative to the site root, e.g. `/_next/static/chunks/main.js`
 * @returns Full URL suitable for use in `<link>`, `<script>`, or CSS `url()`.
 *
 * @example
 * // With CDN_URL=https://cdn.example.com
 * getAssetUrl('/_next/static/chunks/main.js')
 * // -> 'https://cdn.example.com/_next/static/chunks/main.js'
 *
 * // Without CDN_URL
 * getAssetUrl('/_next/static/chunks/main.js')
 * // -> '/_next/static/chunks/main.js'
 */
export function getAssetUrl(path: string): string {
  const cdnBase = process.env.CDN_URL;
  if (!cdnBase) return path;

  const base = normalizeBaseUrl(cdnBase);
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

/**
 * Returns an array of `<link rel="preload">` tag strings for critical
 * CSS and JS assets. These should be injected into the document `<head>`
 * to hint the browser to fetch them early.
 *
 * Each tag includes the `crossorigin` attribute when a CDN is configured
 * (required for CORS-safelisted preloads of same-origin scripts/styles).
 *
 * @returns Array of HTML link tag strings.
 *
 * @example
 * // In a Next.js layout or _document:
 * preloadCriticalAssets().map(tag => (
 *   <link key={tag} {...parseLinkTag(tag)} />
 * ))
 */
export function preloadCriticalAssets(): string[] {
  const cdnBase = process.env.CDN_URL;
  const useCrossorigin = !!cdnBase;

  return CRITICAL_ASSETS.map(({ path, as, type }) => {
    const href = getAssetUrl(path);
    const parts = [
      'rel="preload"',
      `href="${href}"`,
      `as="${as}"`,
    ];
    if (useCrossorigin) {
      parts.push('crossorigin');
    }
    if (type) {
      parts.push(`type="${type}"`);
    }
    return `<link ${parts.join(' ')} />`;
  });
}
