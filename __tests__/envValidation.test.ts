/**
 * Tests for the environment variable validation service.
 *
 * Covers:
 * - validateEnv() returns valid=true when all required vars are set
 * - validateEnv() returns valid=false with missing list when required vars are absent
 * - validateEnv() includes warnings for absent optional vars
 * - validateEnv() treats empty-string values as missing
 * - validateEnv() treats whitespace-only values as missing
 * - getEnvStatus() maps each tracked variable to the correct status
 * - getEnvStatus() reflects set variables as 'set'
 * - redactEnvValue() returns null for missing vars
 * - redactEnvValue() returns a redacted string for set vars
 * - redactEnvValue() caps the asterisk length at 8
 * - validateEnv() is resilient when no env vars are set at all
 * - getEnvStatus() covers all expected variable keys
 */

import { validateEnv, getEnvStatus, redactEnvValue } from '../src/utils/envValidation';
import type { EnvStatus } from '../src/utils/envValidation';

// ── Helpers ───────────────────────────────────────────────────────────

/** Keys that the module tracks (extracted from source for assertion). */
const TRACKED_KEYS = [
  'TURSO_DATABASE_URL',
  'AUTH_SECRET',
  'NEXTAUTH_SECRET',
  'GROQ_API_KEY',
  'GEMINI_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID',
  'STRIPE_TEAM_PRICE_ID',
  'GITHUB_ID',
  'GITHUB_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'TURSO_AUTH_TOKEN',
  'SENTRY_DSN',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'NEXUS_API_KEY',
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'ESM2_PYTHON_BACKEND',
  'SCSPATIAL_PYTHON_BACKEND',
  'SCSPATIAL_PYTHON_BIN',
  'SCSPATIAL_ARTIFACT_DIR',
];

const REQUIRED_KEYS = ['TURSO_DATABASE_URL', 'AUTH_SECRET', 'NEXTAUTH_SECRET'];

const ALL_ENV_KEYS = [...TRACKED_KEYS];

/** Save and restore process.env between tests. */
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = { ...process.env };
});

afterEach(() => {
  // Restore original env
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, savedEnv);
});

/** Set all required vars so validateEnv() passes by default. */
function setRequiredEnv() {
  process.env.TURSO_DATABASE_URL = 'libsql://test.turso.io';
  process.env.AUTH_SECRET = 'test-auth-secret-32chars!!!!!';
  process.env.NEXTAUTH_SECRET = 'test-nextauth-secret-32chars!!';
}

/** Remove all tracked env vars to simulate a clean slate. */
function clearAllTrackedEnv() {
  for (const key of ALL_ENV_KEYS) {
    delete process.env[key];
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('validateEnv', () => {
  it('returns valid=true when all required vars are set', () => {
    clearAllTrackedEnv();
    setRequiredEnv();

    const result = validateEnv();
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('returns valid=false with missing list when required vars are absent', () => {
    clearAllTrackedEnv();
    // Do NOT set any required vars

    const result = validateEnv();
    expect(result.valid).toBe(false);
    for (const key of REQUIRED_KEYS) {
      expect(result.missing).toContain(key);
    }
  });

  it('includes warnings for absent optional vars', () => {
    clearAllTrackedEnv();
    setRequiredEnv();
    // Optional vars not set

    const result = validateEnv();
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    // At least one warning should mention GROQ
    expect(result.warnings.some((w) => w.includes('GROQ_API_KEY'))).toBe(true);
  });

  it('treats empty-string values as missing', () => {
    clearAllTrackedEnv();
    process.env.TURSO_DATABASE_URL = '';
    process.env.AUTH_SECRET = '';
    process.env.NEXTAUTH_SECRET = 'valid-secret-value-here!!!!!!!';

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('TURSO_DATABASE_URL');
    expect(result.missing).toContain('AUTH_SECRET');
  });

  it('treats whitespace-only values as missing', () => {
    clearAllTrackedEnv();
    process.env.TURSO_DATABASE_URL = '   ';
    process.env.AUTH_SECRET = '\t';
    process.env.NEXTAUTH_SECRET = 'valid-secret-value-here!!!!!!!';

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('TURSO_DATABASE_URL');
    expect(result.missing).toContain('AUTH_SECRET');
  });

  it('is resilient when no env vars are set at all', () => {
    clearAllTrackedEnv();

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing.length).toBe(REQUIRED_KEYS.length);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('reports valid=true even when optional vars are missing', () => {
    clearAllTrackedEnv();
    setRequiredEnv();
    // All optional vars are absent

    const result = validateEnv();
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });
});

describe('getEnvStatus', () => {
  it('maps set variables to "set"', () => {
    clearAllTrackedEnv();
    process.env.GROQ_API_KEY = 'gsk_test123';

    const status = getEnvStatus();
    expect(status.GROQ_API_KEY).toBe('set');
  });

  it('maps missing required variables to "missing"', () => {
    clearAllTrackedEnv();
    // TURSO_DATABASE_URL not set

    const status = getEnvStatus();
    expect(status.TURSO_DATABASE_URL).toBe('missing');
  });

  it('maps missing optional variables to "optional"', () => {
    clearAllTrackedEnv();
    // STRIPE_SECRET_KEY not set and is optional

    const status = getEnvStatus();
    expect(status.STRIPE_SECRET_KEY).toBe('optional');
  });

  it('covers all expected variable keys', () => {
    const status = getEnvStatus();
    for (const key of ALL_ENV_KEYS) {
      expect(status).toHaveProperty(key);
      expect(['set', 'missing', 'optional']).toContain(status[key]);
    }
  });

  it('returns consistent results across calls', () => {
    clearAllTrackedEnv();
    setRequiredEnv();

    const first = getEnvStatus();
    const second = getEnvStatus();
    expect(first).toEqual(second);
  });
});

describe('redactEnvValue', () => {
  it('returns null for missing vars', () => {
    delete process.env.GROQ_API_KEY;
    expect(redactEnvValue('GROQ_API_KEY')).toBeNull();
  });

  it('returns null for empty-string vars', () => {
    process.env.GROQ_API_KEY = '';
    expect(redactEnvValue('GROQ_API_KEY')).toBeNull();
  });

  it('returns a redacted string for set vars', () => {
    process.env.GROQ_API_KEY = 'gsk_abc123xyz';
    const result = redactEnvValue('GROQ_API_KEY');
    expect(result).not.toBeNull();
    expect(result).toContain('13 chars');
    // Should not contain the actual value
    expect(result).not.toContain('gsk_abc123xyz');
  });

  it('caps the asterisk count at 8', () => {
    process.env.GROQ_API_KEY = 'a'.repeat(100);
    const result = redactEnvValue('GROQ_API_KEY');
    expect(result).not.toBeNull();
    // Should have exactly 8 asterisks, not 100
    expect(result).toMatch(/^\*{8} \(100 chars\)$/);
  });

  it('shows fewer asterisks for short values', () => {
    process.env.GROQ_API_KEY = 'abc';
    const result = redactEnvValue('GROQ_API_KEY');
    expect(result).toBe('*** (3 chars)');
  });
});
