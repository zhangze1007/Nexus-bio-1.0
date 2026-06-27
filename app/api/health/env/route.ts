import { NextResponse } from 'next/server';
import { validateEnv, getEnvStatus, redactEnvValue } from '../../../../src/utils/envValidation';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * GET /api/health/env
 *
 * Returns environment variable validation status with redacted values.
 * Useful for ops dashboards and deploy-time smoke tests.
 *
 * Response shape:
 * {
 *   valid: boolean,
 *   missing: string[],
 *   warnings: string[],
 *   variables: { [key]: { status, redacted } },
 *   timestamp: string
 * }
 */
export async function GET() {
  const { valid, missing, warnings } = validateEnv();
  const statusMap = getEnvStatus();

  // Build a per-variable detail map with redacted values
  const variables: Record<string, { status: string; redacted: string | null }> = {};
  for (const [key, status] of Object.entries(statusMap)) {
    variables[key] = {
      status,
      redacted: redactEnvValue(key),
    };
  }

  return NextResponse.json(
    {
      valid,
      missing,
      warnings,
      variables,
      timestamp: new Date().toISOString(),
    },
    {
      status: valid ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
