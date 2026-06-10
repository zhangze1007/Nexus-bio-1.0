/**
 * Nexus-Bio — FBA Streaming Endpoint
 *
 * Provides real-time FBA results via Server-Sent Events (SSE).
 * Clients connect via EventSource or the custom FBAStreamClient in fbaWorker.ts.
 *
 * Protocol:
 *   GET  /api/fba/stream?species=ecoli&objective=biomass&glucoseUptake=10&...
 *   → text/event-stream with periodic FBA solve results
 *
 *   POST /api/fba/stream  (JSON body with same params)
 *   → text/event-stream with periodic FBA solve results
 *
 * Each SSE event has:
 *   event: fba-result
 *   data: { ok, mode, result, provenance, timestamp }
 *
 * Heartbeat every 15s:
 *   event: heartbeat
 *   data: { timestamp }
 *
 * The stream stays open until the client disconnects or 5 minutes elapse.
 *
 * @note WebSocket upgrade is not supported in Next.js App Router (Vercel serverless).
 *       SSE is the correct streaming primitive for this runtime.
 */

import { NextResponse } from 'next/server';
import {
  solveAuthorityFBA,
  type FBAObjective,
  type FBASpecies,
  type SingleSpeciesFBARequest,
} from '../../../../src/server/fbaEngine';
import { createProvenanceEntry } from '../../../../src/utils/provenance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Maximum stream lifetime (serverless function timeout guard)
const MAX_STREAM_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const SOLVE_INTERVAL_MS = 2000; // Re-solve every 2 seconds
const HEARTBEAT_INTERVAL_MS = 15_000; // Heartbeat every 15 seconds

function parseSpecies(value: unknown): FBASpecies {
  return value === 'yeast' ? 'yeast' : 'ecoli';
}

function parseObjective(value: unknown): FBAObjective {
  return value === 'product' || value === 'atp' ? value : 'biomass';
}

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function parseKnockouts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function parseParamsFromSearch(searchParams: URLSearchParams): SingleSpeciesFBARequest {
  return {
    species: parseSpecies(searchParams.get('species')),
    objective: parseObjective(searchParams.get('objective')),
    glucoseUptake: parseNumber(searchParams.get('glucoseUptake'), 10),
    oxygenUptake: parseNumber(searchParams.get('oxygenUptake'), 12),
    knockouts: parseKnockouts(searchParams.get('knockouts')?.split(',').filter(Boolean)),
  };
}

function buildSSEPayload(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function buildSSEEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Core streaming logic shared by GET and POST handlers.
 * Creates a ReadableStream that emits SSE events with FBA results.
 */
function createFBAStream(request: Request, params: SingleSpeciesFBARequest) {
  const encoder = new TextEncoder();
  const requestId = `fba_stream_${Date.now().toString(36)}`;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let solveCount = 0;
      const startTime = Date.now();

      // Heartbeat interval
      const heartbeatInterval = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(buildSSEEvent('heartbeat', { timestamp: Date.now() })),
          );
        } catch {
          closed = true;
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Check for client disconnect via request signal
      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(heartbeatInterval);
        try { controller.close(); } catch { /* already closed */ }
      });

      // Initial solve + periodic re-solve loop
      while (!closed) {
        // Guard: max stream duration
        if (Date.now() - startTime > MAX_STREAM_DURATION_MS) {
          controller.enqueue(
            encoder.encode(buildSSEEvent('stream-end', {
              reason: 'max_duration',
              duration: Date.now() - startTime,
              requestId,
            })),
          );
          closed = true;
          break;
        }

        try {
          const result = await solveAuthorityFBA(params);
          solveCount++;

          const provenanceEntry = createProvenanceEntry({
            toolId: 'fbasim-single',
            outputAssumptions: [
              'fbasim-single.steady_state',
              'fbasim-single.biomass_objective',
              'fbasim-single.no_regulation',
              'fbasim-single.simplex_real',
            ],
            evidence: [{
              id: `fba-stream-${Date.now()}`,
              source: 'computation',
              reference: 'two-phase simplex LP on iJO1366Subset (streaming)',
              confidence: 'high',
            }],
          });

          const payload = {
            ok: true,
            mode: 'single',
            result: {
              ...result,
              sensitivityCoefficients: result.sensitivityCoefficients,
            },
            provenance: provenanceEntry,
            timestamp: Date.now(),
            solveCount,
            requestId,
          };

          controller.enqueue(
            encoder.encode(buildSSEEvent('fba-result', payload)),
          );
        } catch (error) {
          controller.enqueue(
            encoder.encode(buildSSEEvent('fba-error', {
              ok: false,
              error: 'FBA solve failed during streaming',
              timestamp: Date.now(),
              requestId,
            })),
          );
        }

        // Wait before next solve (or until cancelled)
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, SOLVE_INTERVAL_MS);
          request.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve();
          }, { once: true });
        });
      }

      clearInterval(heartbeatInterval);
      try { controller.close(); } catch { /* already closed */ }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Request-Id': requestId,
    },
  });
}

/**
 * GET handler — params from query string.
 * Usage: new EventSource('/api/fba/stream?species=ecoli&objective=biomass&glucoseUptake=10')
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = parseParamsFromSearch(url.searchParams);
  return createFBAStream(request, params);
}

/**
 * POST handler — params from JSON body.
 * Usage: fetch('/api/fba/stream', { method: 'POST', body: JSON.stringify({...}) })
 *        then read the response body as SSE stream.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { ok: false, error: 'Invalid request payload' },
      { status: 400 },
    );
  }

  const input = body as Record<string, unknown>;
  const params: SingleSpeciesFBARequest = {
    species: parseSpecies(input.species),
    objective: parseObjective(input.objective),
    glucoseUptake: parseNumber(input.glucoseUptake, 10),
    oxygenUptake: parseNumber(input.oxygenUptake, 12),
    knockouts: parseKnockouts(input.knockouts),
  };

  return createFBAStream(request, params);
}
