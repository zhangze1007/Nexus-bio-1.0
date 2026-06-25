import { NextResponse } from "next/server";

interface ErrorBody {
  ok: false;
  error: string;
  code?: string;
  [key: string]: unknown;
}

/**
 * Unified error response helper for all API routes.
 * Returns JSON with shape { ok: false, error: string, code?: string }.
 */
export function errorResponse(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
  headers?: Record<string, string>,
) {
  const body: ErrorBody = { ok: false, error: message, ...extra };
  return NextResponse.json(body, { status, headers });
}
