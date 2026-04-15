/** @jest-environment node */

import {
  MAX_PROMPT_CHARS,
  MAX_SEARCH_QUERY_CHARS,
  escapeHtml,
  sanitizePromptInput,
} from '../app/api/analyze/route';

describe('escapeHtml', () => {
  it('escapes the five canonical HTML metacharacters', () => {
    expect(escapeHtml(`<script>alert("x" & 'y')</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;',
    );
  });

  it('is idempotent under repeated application of "&" escaping', () => {
    // The first pass maps `&` → `&amp;`; running again must not double-encode
    // an unrelated payload — but it WILL re-encode `&amp;` itself. This test
    // documents that explicitly so callers know to escape exactly once.
    const once = escapeHtml('a&b');
    expect(once).toBe('a&amp;b');
    expect(escapeHtml(once)).toBe('a&amp;amp;b');
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('hello world 42')).toBe('hello world 42');
  });
});

describe('sanitizePromptInput', () => {
  it('strips null bytes', () => {
    const { value, truncated } = sanitizePromptInput('a\u0000b\u0000c', 100);
    expect(value).toBe('abc');
    expect(truncated).toBe(false);
  });

  it('normalizes CRLF to LF', () => {
    const { value } = sanitizePromptInput('line1\r\nline2', 100);
    expect(value).toBe('line1\nline2');
  });

  it('truncates above the cap and signals it', () => {
    const big = 'x'.repeat(200);
    const { value, truncated } = sanitizePromptInput(big, 50);
    expect(value).toHaveLength(50);
    expect(truncated).toBe(true);
  });

  it('does not truncate when input is exactly at the cap', () => {
    const exact = 'y'.repeat(50);
    const { value, truncated } = sanitizePromptInput(exact, 50);
    expect(value).toBe(exact);
    expect(truncated).toBe(false);
  });
});

describe('input limit constants', () => {
  it('exposes a generous prompt cap and a tight search-query cap', () => {
    // Sanity check: the search-query cap must be much smaller than the
    // prompt cap, so a hostile single-line query can't exhaust the
    // assembled-prompt budget on its own.
    expect(MAX_SEARCH_QUERY_CHARS).toBeLessThan(MAX_PROMPT_CHARS / 10);
    expect(MAX_PROMPT_CHARS).toBeGreaterThanOrEqual(8_000);
  });
});
