/**
 * GDPR Export API — Article 20 Data Portability
 *
 * POST /api/gdpr/export
 * Body: { userId: string }
 *
 * Creates an export request and processes it immediately.
 * Returns a download URL and file metadata.
 *
 * GET /api/gdpr/export?download=<requestId>
 * Downloads the ZIP file for a completed export.
 */

import { NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../../src/utils/cors';
import { GDPRService, ExportStore } from '../../../../src/services/governance/gdprService';

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

    // Create and process the export request
    const request = await service.requestDataExport(userId.trim());
    const result = await service.processExport(request.id);

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

export async function GET(req: Request) {
  const corsHeaders = getCorsHeaders(req);
  const url = new URL(req.url);
  const downloadId = url.searchParams.get('download');

  if (!downloadId) {
    return NextResponse.json(
      { error: 'download query parameter is required' },
      { status: 400, headers: corsHeaders },
    );
  }

  const zipBuffer = ExportStore.get(downloadId);
  if (!zipBuffer) {
    return NextResponse.json(
      { error: 'Export not found or expired. Please create a new export request.' },
      { status: 404, headers: corsHeaders },
    );
  }

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="gdpr-export-${downloadId}.zip"`,
      'Content-Length': String(zipBuffer.length),
    },
  });
}
