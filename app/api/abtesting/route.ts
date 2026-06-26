/**
 * A/B Testing API
 *
 * POST  — create experiment, assign variant, or record outcome (action field)
 * GET   — list experiments or retrieve results (?experimentId=...)
 */

import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../src/utils/cors";
import { errorResponse } from "../../../src/utils/apiErrors";
import {
  createExperiment,
  assignVariant,
  recordOutcome,
  getResults,
  listExperiments,
} from "../../../src/services/abtesting/abTestService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handleOptions(req);
}

/* ------------------------------------------------------------------ */
/*  POST — create / assign / record                                    */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest): Promise<NextResponse> {
  const headers = getCorsHeaders(request);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body.", 400, undefined, headers);
  }

  const action = body.action as string | undefined;

  try {
    switch (action) {
      case "create": {
        const { name, variants } = body as {
          name?: string;
          variants?: { id: string; weight: number }[];
        };
        if (!name || !variants || variants.length === 0) {
          return errorResponse("name and variants[] are required.", 400, undefined, headers);
        }
        const id = await createExperiment(name, variants);
        return NextResponse.json({ ok: true, experimentId: id }, { headers });
      }

      case "assign": {
        const { experimentId, userId } = body as {
          experimentId?: string;
          userId?: string;
        };
        if (!experimentId || !userId) {
          return errorResponse("experimentId and userId are required.", 400, undefined, headers);
        }
        const result = await assignVariant(experimentId, userId);
        return NextResponse.json({ ok: true, ...result }, { headers });
      }

      case "record": {
        const { experimentId, userId, outcome } = body as {
          experimentId?: string;
          userId?: string;
          outcome?: string;
        };
        if (!experimentId || !userId || outcome === undefined) {
          return errorResponse("experimentId, userId, and outcome are required.", 400, undefined, headers);
        }
        await recordOutcome(experimentId, userId, outcome);
        return NextResponse.json({ ok: true }, { headers });
      }

      default:
        return errorResponse(
          `Unknown action "${action}". Use "create", "assign", or "record".`,
          400,
          undefined,
          headers,
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error.";
    const status = message.includes("not found") ? 404 : 500;
    return errorResponse(message, status, undefined, headers);
  }
}

/* ------------------------------------------------------------------ */
/*  GET — list / results                                               */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest): Promise<NextResponse> {
  const headers = getCorsHeaders(request);
  const experimentId = request.nextUrl.searchParams.get("experimentId");

  try {
    if (experimentId) {
      const results = await getResults(experimentId);
      return NextResponse.json({ ok: true, results }, { headers });
    }

    const experiments = await listExperiments();
    return NextResponse.json({ ok: true, experiments }, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error.";
    const status = message.includes("not found") ? 404 : 500;
    return errorResponse(message, status, undefined, headers);
  }
}
