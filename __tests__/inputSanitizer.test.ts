import {
  sanitizeHtml,
  sanitizeSql,
  validateEmail,
  validateUrl,
} from '../src/utils/inputSanitizer';

describe('sanitizeHtml', () => {
  it('strips simple HTML tags', () => {
    expect(sanitizeHtml('<b>hello</b>')).toBe('hello');
  });

  it('strips nested tags', () => {
    expect(sanitizeHtml('<div><p>text</p></div>')).toBe('text');
  });

  it('strips tags with attributes', () => {
    expect(sanitizeHtml('<a href="https://example.com">link</a>')).toBe('link');
  });

  it('decodes common HTML entities', () => {
    expect(sanitizeHtml('&amp; &lt; &gt;')).toBe('& < >');
  });

  it('decodes quote entities', () => {
    expect(sanitizeHtml('&quot;quoted&quot;')).toBe('"quoted"');
  });

  it('returns plain text unchanged', () => {
    expect(sanitizeHtml('no tags here')).toBe('no tags here');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('handles script tags', () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).toBe('alert("xss")');
  });
});

describe('sanitizeSql', () => {
  it('escapes single quotes', () => {
    expect(sanitizeSql("it's")).toBe("it''s");
  });

  it('escapes double quotes', () => {
    expect(sanitizeSql('"hello"')).toBe('""hello""');
  });

  it('escapes backslashes', () => {
    expect(sanitizeSql('path\\to')).toBe('path\\\\to');
  });

  it('returns plain text unchanged', () => {
    expect(sanitizeSql('normal text')).toBe('normal text');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeSql('')).toBe('');
  });

  it('handles SQL injection attempt by doubling single quotes', () => {
    const result = sanitizeSql("'; DROP TABLE users; --");
    expect(result).toBe("''; DROP TABLE users; --");
    // The single quote is escaped to '', so SQL parser sees an escaped literal, not a string terminator
    expect(result).toContain("'';");
  });
});

describe('validateEmail', () => {
  it('accepts valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('accepts email with subdomain', () => {
    expect(validateEmail('user@mail.example.com')).toBe(true);
  });

  it('accepts email with plus addressing', () => {
    expect(validateEmail('user+tag@example.com')).toBe(true);
  });

  it('rejects email without @', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });

  it('rejects email without domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });

  it('rejects email without TLD', () => {
    expect(validateEmail('user@example')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateEmail('')).toBe(false);
  });
});

describe('validateUrl', () => {
  it('accepts valid https URL', () => {
    expect(validateUrl('https://example.com')).toBe(true);
  });

  it('accepts valid http URL', () => {
    expect(validateUrl('http://example.com')).toBe(true);
  });

  it('accepts URL with path and query', () => {
    expect(validateUrl('https://example.com/path?q=1')).toBe(true);
  });

  it('rejects javascript: protocol', () => {
    expect(validateUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: protocol', () => {
    expect(validateUrl('data:text/html,<h1>hi</h1>')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateUrl('')).toBe(false);
  });

  it('rejects non-URL string', () => {
    expect(validateUrl('not a url')).toBe(false);
  });
});
