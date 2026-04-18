/** @jest-environment node */

import {
  MAX_PROMPT_CHARS,
  MAX_SEARCH_QUERY_CHARS,
  escapeHtml,
  sanitizePromptInput,
  AXON_PROSE_SYSTEM_PROMPT,
  withProseSystemPrompt,
  offDomainRefusalText,
} from '../app/api/analyze/route';
import { classifyAxonDomain } from '../src/services/axonDomainClassifier';

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

describe('PR-5 prose prompt', () => {
  it('explicitly instructs the model NOT to return pathway JSON', () => {
    // The prose prompt is what guards queries like "explain kinetics"
    // from being forced into biosynthesis JSON output.
    expect(AXON_PROSE_SYSTEM_PROMPT).toMatch(/do not return pathway json/i);
    expect(AXON_PROSE_SYSTEM_PROMPT).toMatch(/never produce a json object/i);
  });

  it('tells the model to answer in plain prose and cap length', () => {
    expect(AXON_PROSE_SYSTEM_PROMPT).toMatch(/plain prose/i);
    expect(AXON_PROSE_SYSTEM_PROMPT).toMatch(/short|3–6 sentences|3-6 sentences/i);
  });

  it('wraps the user question with a labelled delimiter', () => {
    const prompt = withProseSystemPrompt('Explain kinetics briefly');
    expect(prompt.startsWith(AXON_PROSE_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toMatch(/user question:\s*\nexplain kinetics briefly/i);
  });
});

describe('PR-5 off-domain refusal', () => {
  it('surfaces the classifier reason in the refusal text', () => {
    const c = classifyAxonDomain('Who is Donald Trump');
    expect(c.category).toBe('off-domain');
    const refusal = offDomainRefusalText('Who is Donald Trump', c.reason);
    expect(refusal).toMatch(/outside Nexus-Bio's scope/i);
    expect(refusal).toContain(c.reason);
    expect(refusal).toContain('Donald Trump');
  });

  it('never fabricates a pathway or enzyme for the off-domain subject', () => {
    const refusal = offDomainRefusalText('Who is Donald Trump', 'off-domain signal');
    // Honesty invariant — the refusal must NOT pretend the off-domain
    // subject has a pathway, ΔG, flux, or enzyme associated with it.
    expect(refusal).not.toMatch(/biosynthesis pathway for donald/i);
    expect(refusal).not.toMatch(/enzyme for donald/i);
    expect(refusal).not.toMatch(/flux.*donald/i);
    expect(refusal).not.toMatch(/ΔG/);
  });

  it('truncates very long queries in the echoed text', () => {
    const long = 'x'.repeat(200);
    const refusal = offDomainRefusalText(long, 'too long');
    // Confirm we did not paste the full 200 chars back verbatim.
    expect(refusal.includes('x'.repeat(200))).toBe(false);
    expect(refusal).toMatch(/…/);
  });

  it('is a non-empty string for every off-domain classifier signal', () => {
    const samples = [
      'Who is Donald Trump',
      "What's the weather in Kuala Lumpur today",
      'Taylor Swift concert tour dates',
    ];
    for (const s of samples) {
      const c = classifyAxonDomain(s);
      expect(c.category).toBe('off-domain');
      const refusal = offDomainRefusalText(s, c.reason);
      expect(typeof refusal).toBe('string');
      expect(refusal.length).toBeGreaterThan(50);
    }
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
