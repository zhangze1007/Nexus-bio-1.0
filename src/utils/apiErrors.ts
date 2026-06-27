import { NextResponse } from "next/server";

// ─── Standardized Error Codes ───────────────────────────────────────────────

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE";

export interface ApiErrorDefinition {
  code: ErrorCode;
  message: string;
  statusCode: number;
}

export const API_ERRORS: Record<ErrorCode, ApiErrorDefinition> = {
  VALIDATION_ERROR: {
    code: "VALIDATION_ERROR",
    message: "Request validation failed",
    statusCode: 400,
  },
  NOT_FOUND: {
    code: "NOT_FOUND",
    message: "Resource not found",
    statusCode: 404,
  },
  UNAUTHORIZED: {
    code: "UNAUTHORIZED",
    message: "Authentication required",
    statusCode: 401,
  },
  FORBIDDEN: {
    code: "FORBIDDEN",
    message: "Insufficient permissions",
    statusCode: 403,
  },
  RATE_LIMITED: {
    code: "RATE_LIMITED",
    message: "Rate limit exceeded",
    statusCode: 429,
  },
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    message: "Internal server error",
    statusCode: 500,
  },
  SERVICE_UNAVAILABLE: {
    code: "SERVICE_UNAVAILABLE",
    message: "Service temporarily unavailable",
    statusCode: 503,
  },
};

// ─── ApiError Type ──────────────────────────────────────────────────────────

export interface ApiError {
  ok: false;
  code: ErrorCode;
  error: string;
  statusCode: number;
  details?: string;
  [key: string]: unknown;
}

/**
 * Create a standardized API error object from a predefined error code.
 *
 * @param code   One of the standard ErrorCode values.
 * @param details  Optional human-readable detail to append.
 * @returns An ApiError object ready to be serialized as JSON.
 */
export function createApiError(code: ErrorCode, details?: string): ApiError {
  const def = API_ERRORS[code];
  const error: ApiError = {
    ok: false,
    code: def.code,
    error: details ? `${def.message}: ${details}` : def.message,
    statusCode: def.statusCode,
  };
  if (details) {
    error.details = details;
  }
  return error;
}

// ─── Legacy Error Response Helper ───────────────────────────────────────────

interface ErrorBody {
  ok: false;
  error: string;
  code?: string;
  [key: string]: unknown;
}

/**
 * Unified error response helper for all API routes.
 * Returns JSON with shape { ok: false, error: string, code?: string, requestId: string }.
 * Auto-generates a requestId if not provided in `extra`.
 */
export function errorResponse(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
  headers?: Record<string, string>,
) {
  const requestId = (extra?.requestId as string) || crypto.randomUUID();
  const body: ErrorBody = { ok: false, error: message, requestId, ...extra };
  return NextResponse.json(body, { status, headers });
}
