import { getAssetUrl, preloadCriticalAssets } from '../src/utils/assetManifest';

// Save and restore the original CDN_URL env var across tests
const ORIGINAL_CDN_URL = process.env.CDN_URL;

afterEach(() => {
  if (ORIGINAL_CDN_URL === undefined) {
    delete process.env.CDN_URL;
  } else {
    process.env.CDN_URL = ORIGINAL_CDN_URL;
  }
});

// ─── getAssetUrl ──────────────────────────────────────────────────────

describe('getAssetUrl', () => {
  it('returns the local path unchanged when CDN_URL is not set', () => {
    delete process.env.CDN_URL;
    const url = getAssetUrl('/_next/static/chunks/main.js');
    expect(url).toBe('/_next/static/chunks/main.js');
  });

  it('prefixes the path with CDN_URL when set', () => {
    process.env.CDN_URL = 'https://cdn.example.com';
    const url = getAssetUrl('/_next/static/chunks/main.js');
    expect(url).toBe('https://cdn.example.com/_next/static/chunks/main.js');
  });

  it('handles CDN_URL with a trailing slash', () => {
    process.env.CDN_URL = 'https://cdn.example.com/';
    const url = getAssetUrl('/_next/static/css/app.css');
    expect(url).toBe('https://cdn.example.com/_next/static/css/app.css');
  });

  it('prepends a leading slash when the path lacks one', () => {
    process.env.CDN_URL = 'https://cdn.example.com';
    const url = getAssetUrl('assets/logo.png');
    expect(url).toBe('https://cdn.example.com/assets/logo.png');
  });

  it('handles an empty CDN_URL by treating it as unset', () => {
    process.env.CDN_URL = '';
    const url = getAssetUrl('/_next/static/chunks/main.js');
    expect(url).toBe('/_next/static/chunks/main.js');
  });

  it('works with CDN_URL pointing to a subdirectory', () => {
    process.env.CDN_URL = 'https://cdn.example.com/nexus-bio';
    const url = getAssetUrl('/_next/static/chunks/main.js');
    expect(url).toBe('https://cdn.example.com/nexus-bio/_next/static/chunks/main.js');
  });

  it('handles paths with query strings', () => {
    process.env.CDN_URL = 'https://cdn.example.com';
    const url = getAssetUrl('/_next/static/chunks/main.js?v=abc123');
    expect(url).toBe('https://cdn.example.com/_next/static/chunks/main.js?v=abc123');
  });
});

// ─── preloadCriticalAssets ────────────────────────────────────────────

describe('preloadCriticalAssets', () => {
  it('returns an array of link tag strings', () => {
    delete process.env.CDN_URL;
    const tags = preloadCriticalAssets();
    expect(Array.isArray(tags)).toBe(true);
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag).toMatch(/^<link\s/);
      expect(tag).toMatch(/rel="preload"/);
    }
  });

  it('includes rel="preload" and as="style" for CSS assets', () => {
    delete process.env.CDN_URL;
    const tags = preloadCriticalAssets();
    const cssTag = tags.find(t => t.includes('as="style"'));
    expect(cssTag).toBeDefined();
    expect(cssTag).toContain('rel="preload"');
  });

  it('includes rel="preload" and as="script" for JS assets', () => {
    delete process.env.CDN_URL;
    const tags = preloadCriticalAssets();
    const scriptTags = tags.filter(t => t.includes('as="script"'));
    expect(scriptTags.length).toBeGreaterThanOrEqual(1);
  });

  it('uses local paths when CDN_URL is not set', () => {
    delete process.env.CDN_URL;
    const tags = preloadCriticalAssets();
    for (const tag of tags) {
      expect(tag).not.toContain('https://cdn');
      expect(tag).toContain('href="/_next/');
    }
  });

  it('uses CDN URLs when CDN_URL is set', () => {
    process.env.CDN_URL = 'https://cdn.example.com';
    const tags = preloadCriticalAssets();
    for (const tag of tags) {
      expect(tag).toContain('https://cdn.example.com/_next/');
    }
  });

  it('includes crossorigin attribute when CDN_URL is set', () => {
    process.env.CDN_URL = 'https://cdn.example.com';
    const tags = preloadCriticalAssets();
    for (const tag of tags) {
      expect(tag).toContain('crossorigin');
    }
  });

  it('does NOT include crossorigin attribute when CDN_URL is not set', () => {
    delete process.env.CDN_URL;
    const tags = preloadCriticalAssets();
    for (const tag of tags) {
      expect(tag).not.toContain('crossorigin');
    }
  });

  it('produces valid HTML link tag syntax', () => {
    delete process.env.CDN_URL;
    const tags = preloadCriticalAssets();
    for (const tag of tags) {
      expect(tag).toMatch(/^<link [^>]+\/>$/);
      // All attributes should be properly quoted
      const attrCount = (tag.match(/="[^"]*"/g) || []).length;
      expect(attrCount).toBeGreaterThanOrEqual(2); // at least rel + href + as
    }
  });
});
