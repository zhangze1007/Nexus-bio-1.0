/**
 * GDPR Deletion API — Article 17 Right to Deletion
 *
 * POST /api/gdpr/delete
 * Body: { userId: string }
 *
 * Creates a deletion request and immediately processes it.
 * Soft-deletes user data across all tables (30-day recovery window).
 * Anonymizes audit logs instead of deleting them.
 */

import { NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../../src/utils/cors';
import { GDPRService } from '../../../../src/services/governance/gdprService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const body = await req.json();
    const { userId } = body as { userId?: string };

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return NextResponse.json(
        { error: 'userId is required and must be a non-empty string' },
        { status: 400, headers: corsHeaders },
      );
    }

    const service = new GDPRService();
    await GDPRService.ensureTables();

    // Create and process the deletion request
    const request = await service.requestDataDeletion(userId.trim());
    const result = await service.processDeletion(request.id);

    return NextResponse.json(
      {
        requestId: request.id,
        status: 'completed',
        ...result,
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json(
      { error: message },
      { status, headers: corsHeaders },
    );
  }
}
