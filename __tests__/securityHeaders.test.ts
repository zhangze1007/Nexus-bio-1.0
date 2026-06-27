import { getSecurityHeaders } from '../src/middleware/securityHeaders';

describe('getSecurityHeaders', () => {
  const headers = getSecurityHeaders();

  it('returns an object with all required headers', () => {
    expect(headers).toBeDefined();
    expect(typeof headers).toBe('object');
    expect(Object.keys(headers).length).toBeGreaterThanOrEqual(6);
  });

  it('sets X-Content-Type-Options to nosniff', () => {
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('sets X-Frame-Options to DENY', () => {
    expect(headers['X-Frame-Options']).toBe('DENY');
  });

  it('sets X-XSS-Protection to 0 (disabled to prevent modern attacks)', () => {
    expect(headers['X-XSS-Protection']).toBe('0');
  });

  it('sets Referrer-Policy to strict-origin-when-cross-origin', () => {
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('sets Permissions-Policy to deny camera, microphone, and geolocation', () => {
    expect(headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('sets Strict-Transport-Security with 1 year max-age and includeSubDomains', () => {
    expect(headers['Strict-Transport-Security']).toBe(
      'max-age=31536000; includeSubDomains'
    );
  });

  it('returns consistent results on repeated calls', () => {
    const first = getSecurityHeaders();
    const second = getSecurityHeaders();
    expect(first).toEqual(second);
  });
});
