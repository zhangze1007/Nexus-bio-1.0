import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../../src/utils/cors";

/**
 * Session management API.
 *
 * GET  /api/auth/sessions  → list active sessions for the current user
 * DELETE /api/auth/sessions → revoke a session by id
 *
 * This is a stub implementation backed by an in-memory store.
 * Replace with a real session table (e.g. next-auth adapter) in production.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── In-memory session store (stub) ─────────────────────────────────────────

interface StoredSession {
  id: string;
  userId: string;
  device: string;
  browser: string;
  os: string;
  ip: string;
  lastActive: number;
  createdAt: number;
  isCurrent: boolean;
}

const sessions = new Map<string, StoredSession>();

function seedDemoSessions(userId: string) {
  if (sessions.size > 0) return;
  const now = Date.now();
  const demos: Omit<StoredSession, "id">[] = [
    {
      userId,
      device: "Desktop — Chrome 126",
      browser: "Chrome 126",
      os: "Windows 11",
      ip: "192.168.1.42",
      lastActive: now,
      createdAt: now - 86_400_000 * 3,
      isCurrent: true,
    },
    {
      userId,
      device: "MacBook Pro — Safari 18",
      browser: "Safari 18",
      os: "macOS Sequoia",
      ip: "10.0.0.17",
      lastActive: now - 3_600_000,
      createdAt: now - 86_400_000 * 12,
      isCurrent: false,
    },
    {
      userId,
      device: "iPhone 16 — Safari Mobile",
      browser: "Safari Mobile",
      os: "iOS 19",
      ip: "172.16.0.88",
      lastActive: now - 86_400_000,
      createdAt: now - 86_400_000 * 30,
      isCurrent: false,
    },
  ];
  for (const d of demos) {
    sessions.set(randomUUID(), d as StoredSession);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const cors = getCorsHeaders(req);
  // Stub: derive userId from header or use a default
  const userId = req.headers.get("x-user-id") || "demo-user";
  seedDemoSessions(userId);

  const userSessions = [...sessions.entries()]
    .filter(([, s]) => s.userId === userId)
    .map(([id, s]) => ({
      id,
      device: s.device,
      browser: s.browser,
      os: s.os,
      ip: s.ip,
      lastActive: s.lastActive,
      createdAt: s.createdAt,
      isCurrent: s.isCurrent,
    }))
    .sort((a, b) => (a.isCurrent ? -1 : b.isCurrent ? 1 : b.lastActive - a.lastActive));

  return NextResponse.json({ sessions: userSessions }, { headers: cors });
}

// ── OPTIONS ────────────────────────────────────────────────────────────────

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

// ── DELETE ─────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const cors = getCorsHeaders(req);
  const userId = req.headers.get("x-user-id") || "demo-user";
  seedDemoSessions(userId);

  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: cors },
    );
  }

  const { sessionId } = body;
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400, headers: cors },
    );
  }

  const target = sessions.get(sessionId);
  if (!target || target.userId !== userId) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404, headers: cors },
    );
  }

  if (target.isCurrent) {
    return NextResponse.json(
      { error: "Cannot revoke the current session" },
      { status: 400, headers: cors },
    );
  }

  sessions.delete(sessionId);

  return NextResponse.json({ success: true }, { headers: cors });
}
