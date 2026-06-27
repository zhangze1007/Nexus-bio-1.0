/**
 * Environment variable validation service.
 *
 * Checks for required and optional env vars at startup / health-check time.
 * Never exposes actual values — only 'set' | 'missing' | 'optional' status.
 */

// ── Variable definitions ──────────────────────────────────────────────

interface EnvVarDef {
  key: string;
  required: boolean;
  description: string;
}

/**
 * Required variables — the app cannot serve core functionality without these.
 * AUTH_SECRET is used by Auth.js v5; NEXTAUTH_SECRET is the legacy name that
 * Auth.js also checks as a fallback, so we validate both.
 */
const ENV_DEFINITIONS: EnvVarDef[] = [
  // Required — database
  { key: 'TURSO_DATABASE_URL', required: true, description: 'Turso/LibSQL database connection URL' },

  // Required — auth (Auth.js v5 uses AUTH_SECRET; NEXTAUTH_SECRET is the legacy alias)
  { key: 'AUTH_SECRET', required: true, description: 'Auth.js session signing secret' },
  { key: 'NEXTAUTH_SECRET', required: true, description: 'NextAuth legacy signing secret (fallback)' },

  // Optional — AI providers
  { key: 'GROQ_API_KEY', required: false, description: 'Groq API key (primary AI provider)' },
  { key: 'GEMINI_API_KEY', required: false, description: 'Google Gemini API key (fallback AI provider)' },

  // Optional — billing
  { key: 'STRIPE_SECRET_KEY', required: false, description: 'Stripe secret key for billing' },
  { key: 'STRIPE_WEBHOOK_SECRET', required: false, description: 'Stripe webhook signing secret' },
  { key: 'STRIPE_PRO_PRICE_ID', required: false, description: 'Stripe Pro plan price ID' },
  { key: 'STRIPE_TEAM_PRICE_ID', required: false, description: 'Stripe Team plan price ID' },

  // Optional — auth providers
  { key: 'GITHUB_ID', required: false, description: 'GitHub OAuth client ID' },
  { key: 'GITHUB_SECRET', required: false, description: 'GitHub OAuth client secret' },
  { key: 'GOOGLE_CLIENT_ID', required: false, description: 'Google OAuth client ID' },
  { key: 'GOOGLE_CLIENT_SECRET', required: false, description: 'Google OAuth client secret' },

  // Optional — storage / infra
  { key: 'TURSO_AUTH_TOKEN', required: false, description: 'Turso auth token (required for remote DB)' },
  { key: 'SENTRY_DSN', required: false, description: 'Sentry error-tracking DSN' },
  { key: 'UPSTASH_REDIS_REST_URL', required: false, description: 'Upstash Redis URL for rate limiting' },
  { key: 'UPSTASH_REDIS_REST_TOKEN', required: false, description: 'Upstash Redis token for rate limiting' },
  { key: 'NEXUS_API_KEY', required: false, description: 'Legacy API key for middleware auth' },
  { key: 'R2_ENDPOINT', required: false, description: 'Cloudflare R2 storage endpoint' },
  { key: 'R2_ACCESS_KEY_ID', required: false, description: 'Cloudflare R2 access key' },
  { key: 'R2_SECRET_ACCESS_KEY', required: false, description: 'Cloudflare R2 secret key' },
  { key: 'R2_BUCKET', required: false, description: 'Cloudflare R2 bucket name' },

  // Optional — python backends
  { key: 'ESM2_PYTHON_BACKEND', required: false, description: 'ESM-2 Python backend URL' },
  { key: 'SCSPATIAL_PYTHON_BACKEND', required: false, description: 'ScSpatial Python backend URL' },
  { key: 'SCSPATIAL_PYTHON_BIN', required: false, description: 'Python binary for ScSpatial sidecar' },
  { key: 'SCSPATIAL_ARTIFACT_DIR', required: false, description: 'ScSpatial artifact storage directory' },
];

// ── Core validation ───────────────────────────────────────────────────

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validate all environment variables.
 *
 * - `missing` lists required vars that are absent or empty.
 * - `warnings` lists optional vars that are absent (informational).
 * - `valid` is true only when every required var is set.
 */
export function validateEnv(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const def of ENV_DEFINITIONS) {
    const value = process.env[def.key];
    const isSet = value !== undefined && value.trim().length > 0;

    if (!isSet) {
      if (def.required) {
        missing.push(def.key);
      } else {
        warnings.push(`${def.key} not set — ${def.description}`);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

// ── Status map ────────────────────────────────────────────────────────

export type EnvStatus = 'set' | 'missing' | 'optional';

/**
 * Return a per-variable status map for every tracked env var.
 *
 * - `'set'`      — variable has a non-empty value
 * - `'missing'`  — required variable is absent or empty
 * - `'optional'` — optional variable is absent or empty
 */
export function getEnvStatus(): Record<string, EnvStatus> {
  const result: Record<string, EnvStatus> = {};

  for (const def of ENV_DEFINITIONS) {
    const value = process.env[def.key];
    const isSet = value !== undefined && value.trim().length > 0;

    if (isSet) {
      result[def.key] = 'set';
    } else if (def.required) {
      result[def.key] = 'missing';
    } else {
      result[def.key] = 'optional';
    }
  }

  return result;
}

/**
 * Redact a sensitive value, showing only length metadata.
 * Returns `null` when the variable is not set.
 */
export function redactEnvValue(key: string): string | null {
  const value = process.env[key];
  if (value === undefined || value.trim().length === 0) return null;
  return `${'*'.repeat(Math.min(value.length, 8))} (${value.length} chars)`;
}
