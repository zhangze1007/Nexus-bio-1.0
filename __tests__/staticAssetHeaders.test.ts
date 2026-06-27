import { getStaticAssetHeaders } from '../src/middleware/staticAssetHeaders';

describe('getStaticAssetHeaders', () => {
  // ─── Immutable (_next/static) ────────────────────────────────────────

  it('returns immutable Cache-Control for _next/static JS bundles', () => {
    const headers = getStaticAssetHeaders('/_next/static/chunks/main.abc123.js');
    expect(headers['Cache-Control']).toBe(
      'public, max-age=31536000, s-maxage=31536000, immutable',
    );
  });

  it('returns immutable Cache-Control for _next/static CSS files', () => {
    const headers = getStaticAssetHeaders('/_next/static/css/app/layout.css');
    expect(headers['Cache-Control']).toContain('immutable');
    expect(headers['Cache-Control']).toContain('max-age=31536000');
  });

  it('returns immutable Cache-Control for standalone .mjs files', () => {
    const headers = getStaticAssetHeaders('/scripts/widget.mjs');
    expect(headers['Cache-Control']).toContain('immutable');
  });

  // ─── Long-lived (images and fonts) ──────────────────────────────────

  it('returns 1-week Cache-Control for PNG images', () => {
    const headers = getStaticAssetHeaders('/images/hero.png');
    expect(headers['Cache-Control']).toBe(
      'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400',
    );
  });

  it('returns 1-week Cache-Control for JPEG images', () => {
    const headers = getStaticAssetHeaders('/photos/cover.jpg');
    expect(headers['Cache-Control']).toContain('max-age=604800');
  });

  it('returns 1-week Cache-Control for WebP images', () => {
    const headers = getStaticAssetHeaders('/assets/preview.webp');
    expect(headers['Cache-Control']).toContain('max-age=604800');
  });

  it('returns 1-week Cache-Control for WOFF2 fonts', () => {
    const headers = getStaticAssetHeaders('/fonts/public-sans.woff2');
    expect(headers['Cache-Control']).toContain('max-age=604800');
    expect(headers['Cache-Control']).toContain('stale-while-revalidate=86400');
  });

  it('returns 1-week Cache-Control for SVG files', () => {
    const headers = getStaticAssetHeaders('/icons/logo.svg');
    expect(headers['Cache-Control']).toContain('max-age=604800');
  });

  // ─── no-cache (HTML) ────────────────────────────────────────────────

  it('returns no-cache Cache-Control for HTML files', () => {
    const headers = getStaticAssetHeaders('/index.html');
    expect(headers['Cache-Control']).toBe('no-cache, must-revalidate');
  });

  it('returns no-cache Cache-Control for .htm files', () => {
    const headers = getStaticAssetHeaders('/about.htm');
    expect(headers['Cache-Control']).toBe('no-cache, must-revalidate');
  });

  // ─── Default fallback ───────────────────────────────────────────────

  it('returns no-cache for unknown file extensions', () => {
    const headers = getStaticAssetHeaders('/data/config.json');
    expect(headers['Cache-Control']).toBe('no-cache, must-revalidate');
  });

  it('returns no-cache for files with no extension', () => {
    const headers = getStaticAssetHeaders('/robots.txt');
    expect(headers['Cache-Control']).toBe('no-cache, must-revalidate');
  });

  // ─── Security headers ───────────────────────────────────────────────

  it('always includes Content-Security-Policy header', () => {
    const headers = getStaticAssetHeaders('/_next/static/chunks/main.js');
    expect(headers['Content-Security-Policy']).toBeDefined();
    expect(headers['Content-Security-Policy']).toContain("default-src 'none'");
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  });

  it('always includes X-Content-Type-Options: nosniff', () => {
    const headers = getStaticAssetHeaders('/images/photo.png');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('includes restrictive CSP for HTML pages', () => {
    const headers = getStaticAssetHeaders('/index.html');
    expect(headers['Content-Security-Policy']).toContain("object-src 'none'");
    expect(headers['Content-Security-Policy']).toContain("script-src 'none'");
  });
});
