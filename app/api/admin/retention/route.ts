/**
 * Retention Automation Admin API
 *
 * POST /api/admin/retention  — Enforce all retention policies for an org.
 * GET  /api/admin/retention  — Get retention status for an org.
 *
 * Both endpoints require an `orgId` query parameter (GET) or body field (POST).
 */

import { NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../../src/utils/cors';
import {
  enforceRetentionPolicies,
  getRetentionStatus,
} from '../../../../src/services/governance/retentionAutomation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

/**
 * POST /api/admin/retention
 * Body: { orgId: string }
 *
 * Enforces all retention policies for the given org.
 * Returns aggregated enforcement results.
 */
export async function POST(req: Request) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const body = await req.json();
    const { orgId } = body as { orgId?: string };

    if (!orgId || typeof orgId !== 'string' || orgId.trim().length === 0) {
      return NextResponse.json(
        { error: 'orgId is required and must be a non-empty string' },
        { status: 400, headers: corsHeaders },
      );
    }

    const result = await enforceRetentionPolicies(orgId.trim());

    return NextResponse.json(
      { ok: true, ...result },
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders },
    );
  }
}

/**
 * GET /api/admin/retention?orgId=...
 *
 * Returns retention status for all entity types under the given org.
 */
export async function GET(req: Request) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId');

    if (!orgId || orgId.trim().length === 0) {
      return NextResponse.json(
        { error: 'orgId query parameter is required' },
        { status: 400, headers: corsHeaders },
      );
    }

    const status = await getRetentionStatus(orgId.trim());

    return NextResponse.json(
      { ok: true, orgId: orgId.trim(), status },
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders },
    );
  }
}
