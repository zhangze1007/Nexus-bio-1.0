/**
 * Audit Middleware — Wraps API route handlers to automatically log audit events.
 *
 * Usage:
 *   export const POST = withAudit(myHandler, {
 *     action: 'create',
 *     entityType: 'experiment',
 *     extractEntityId: (req) => new URL(req.url).searchParams.get('id') ?? undefined,
 *   });
 */

import { type NextRequest, NextResponse } from "next/server";
import { logAuditEvent, type AuditEvent } from "./auditLogger";

interface AuditMiddlewareOptions {
  action: string;
  entityType: string;
  extractEntityId?: (req: NextRequest) => string | undefined;
  extractProjectId?: (req: NextRequest) => string | undefined;
  extractActorId?: (req: NextRequest) => string | undefined;
}

/**
 * Wrap an API route handler to automatically emit an audit event on success.
 *
 * The audit event is logged *after* the handler completes successfully.
 * If the handler throws, no audit entry is created (the error propagates).
 */
export function withAudit(
  handler: (
    req: NextRequest,
    context?: unknown,
  ) => Promise<NextResponse>,
  options: AuditMiddlewareOptions,
): (req: NextRequest, context?: unknown) => Promise<NextResponse> {
  return async (req: NextRequest, context?: unknown) => {
    const result = await handler(req, context);

    // Only audit successful responses (2xx)
    if (result.status >= 200 && result.status < 300) {
      const event: AuditEvent = {
        actorId: options.extractActorId?.(req) ?? "system",
        action: options.action,
        entityType: options.entityType,
        entityId: options.extractEntityId?.(req),
        projectId: options.extractProjectId?.(req),
        metadata: {
          method: req.method,
          url: req.url,
          statusCode: result.status,
        },
      };

      // Fire-and-forget: audit logging should not block the response.
      // Errors are swallowed to avoid breaking the API response.
      logAuditEvent(event).catch((err) => {
        console.error("[audit] Failed to log audit event:", err);
      });
    }

    return result;
  };
}
