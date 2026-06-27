/**
 * Health Check Admin API
 *
 * GET /api/admin/health — Comprehensive system health check.
 *
 * Probes each subsystem in parallel and returns per-service status,
 * latency, and an overall summary.
 */

import { NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../../src/utils/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ServiceStatus = "healthy" | "degraded" | "down";

export interface HealthCheckResult {
  name: string;
  status: ServiceStatus;
  latencyMs: number;
  lastChecked: string; // ISO-8601
  detail?: string;
}

/* ------------------------------------------------------------------ */
/*  Individual probes                                                  */
/* ------------------------------------------------------------------ */

async function probeDatabase(): Promise<HealthCheckResult> {
  const start = performance.now();
  try {
    const { sqlGet } = await import("../../../../src/server/libsqlDb");
    await sqlGet("SELECT 1 AS ok");
    return {
      name: "Database",
      status: "healthy",
      latencyMs: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[api/admin/health] Database probe error:', err);
    return {
      name: "Database",
      status: "down",
      latencyMs: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
      detail: "Database connection failed",
    };
  }
}

async function probeGroq(): Promise<HealthCheckResult> {
  const start = performance.now();
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      name: "Groq",
      status: "down",
      latencyMs: 0,
      lastChecked: new Date().toISOString(),
      detail: "AI provider not configured",
    };
  }
  try {
    // Lightweight models endpoint — does not consume tokens
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Math.round(performance.now() - start);
    if (res.ok) {
      return { name: "Groq", status: "healthy", latencyMs, lastChecked: new Date().toISOString() };
    }
    return {
      name: "Groq",
      status: "degraded",
      latencyMs,
      lastChecked: new Date().toISOString(),
      detail: `HTTP ${res.status}`,
    };
  } catch (err) {
    console.error('[api/admin/health] Groq probe error:', err);
    return {
      name: "Groq",
      status: "down",
      latencyMs: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
      detail: "Groq API unreachable",
    };
  }
}

async function probeGemini(): Promise<HealthCheckResult> {
  const start = performance.now();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      name: "Gemini",
      status: "down",
      latencyMs: 0,
      lastChecked: new Date().toISOString(),
      detail: "Fallback AI provider not configured",
    };
  }
  try {
    // List models — lightweight, no token cost
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: "GET", signal: AbortSignal.timeout(5000) },
    );
    const latencyMs = Math.round(performance.now() - start);
    if (res.ok) {
      return { name: "Gemini", status: "healthy", latencyMs, lastChecked: new Date().toISOString() };
    }
    return {
      name: "Gemini",
      status: "degraded",
      latencyMs,
      lastChecked: new Date().toISOString(),
      detail: `HTTP ${res.status}`,
    };
  } catch (err) {
    console.error('[api/admin/health] Gemini probe error:', err);
    return {
      name: "Gemini",
      status: "down",
      latencyMs: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
      detail: "Gemini API unreachable",
    };
  }
}

async function probeRedis(): Promise<HealthCheckResult> {
  const start = performance.now();
  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  if (!url) {
    return {
      name: "Redis",
      status: "down",
      latencyMs: 0,
      lastChecked: new Date().toISOString(),
      detail: "No Redis URL configured",
    };
  }
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(5000) });
    const latencyMs = Math.round(performance.now() - start);
    // Any response (even auth errors) means the service is reachable
    if (res.status < 500) {
      return { name: "Redis", status: "healthy", latencyMs, lastChecked: new Date().toISOString() };
    }
    return {
      name: "Redis",
      status: "degraded",
      latencyMs,
      lastChecked: new Date().toISOString(),
      detail: `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      name: "Redis",
      status: "down",
      latencyMs: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
      detail: err instanceof Error ? err.message : "Network error",
    };
  }
}

async function probeR2Storage(): Promise<HealthCheckResult> {
  const start = performance.now();
  const endpoint = process.env.R2_ENDPOINT || process.env.CLOUDFLARE_R2_ENDPOINT;
  const accessKey = process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  if (!endpoint || !accessKey) {
    return {
      name: "R2 Storage",
      status: "down",
      latencyMs: 0,
      lastChecked: new Date().toISOString(),
      detail: "R2 credentials not configured",
    };
  }
  try {
    // HEAD request against the bucket endpoint — lightweight check
    const res = await fetch(endpoint, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    const latencyMs = Math.round(performance.now() - start);
    if (res.status < 500) {
      return { name: "R2 Storage", status: "healthy", latencyMs, lastChecked: new Date().toISOString() };
    }
    return {
      name: "R2 Storage",
      status: "degraded",
      latencyMs,
      lastChecked: new Date().toISOString(),
      detail: `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      name: "R2 Storage",
      status: "down",
      latencyMs: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
      detail: err instanceof Error ? err.message : "Network error",
    };
  }
}

async function probeWebSocket(): Promise<HealthCheckResult> {
  const start = performance.now();
  const wsUrl = process.env.WEBSOCKET_URL || process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  if (!wsUrl) {
    return {
      name: "WebSocket",
      status: "down",
      latencyMs: 0,
      lastChecked: new Date().toISOString(),
      detail: "WebSocket URL not configured",
    };
  }
  try {
    // HTTP upgrade probe — many WS servers respond to GET
    const res = await fetch(wsUrl, { method: "GET", signal: AbortSignal.timeout(5000) });
    const latencyMs = Math.round(performance.now() - start);
    // A WS server typically returns 426 Upgrade Required or 200
    if (res.status < 500) {
      return { name: "WebSocket", status: "healthy", latencyMs, lastChecked: new Date().toISOString() };
    }
    return {
      name: "WebSocket",
      status: "degraded",
      latencyMs,
      lastChecked: new Date().toISOString(),
      detail: `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      name: "WebSocket",
      status: "down",
      latencyMs: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
      detail: err instanceof Error ? err.message : "Network error",
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

/**
 * GET /api/admin/health
 *
 * Runs all probes in parallel and returns a summary.
 */
export async function GET(req: Request) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const [database, groq, gemini, redis, r2, websocket] = await Promise.all([
      probeDatabase(),
      probeGroq(),
      probeGemini(),
      probeRedis(),
      probeR2Storage(),
      probeWebSocket(),
    ]);

    const checks: HealthCheckResult[] = [database, groq, gemini, redis, r2, websocket];

    // Overall status: worst-case across all checks
    const overall: ServiceStatus = checks.some((c) => c.status === "down")
      ? "down"
      : checks.some((c) => c.status === "degraded")
        ? "degraded"
        : "healthy";

    return NextResponse.json(
      {
        ok: true,
        status: overall,
        timestamp: new Date().toISOString(),
        checks,
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    console.error('[api/admin/health] GET error:', err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
