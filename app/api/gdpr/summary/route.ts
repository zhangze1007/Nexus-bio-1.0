/**
 * GDPR Summary API — Article 15 Right to Access
 *
 * GET /api/gdpr/summary?userId=<userId>
 *
 * Returns a summary of all data held for a user across all tables.
 */

import { NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../../src/utils/cors';
import { GDPRService } from '../../../../src/services/governance/gdprService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function GET(req: Request) {
  const corsHeaders = getCorsHeaders(req);
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');

  if (!userId || userId.trim().length === 0) {
    return NextResponse.json(
      { error: 'userId query parameter is required' },
      { status: 400, headers: corsHeaders },
    );
  }

  try {
    const service = new GDPRService();
    await GDPRService.ensureTables();

    const summary = await service.getDataSummary(userId.trim());

    return NextResponse.json(summary, { status: 200, headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders },
    );
  }
}
