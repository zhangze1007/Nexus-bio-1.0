/**
 * Yjs CRDT Provider — session lifecycle management.
 *
 * Creates and destroys Yjs documents with WebSocket + IndexedDB persistence.
 * Each session binds to a project room so multiple users can collaborate
 * on the same workbench state without conflicts.
 */

import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

/** Full state for one collaboration session. */
export interface CollaborationSession {
  /** The Yjs CRDT document. */
  ydoc: Y.Doc;
  /** WebSocket provider that syncs with the y-websocket server. */
  provider: WebsocketProvider;
  /** IndexedDB persistence for offline support. */
  indexeddb: IndexeddbPersistence;
  /** Awareness protocol — tracks cursors, user info, etc. */
  awareness: WebsocketProvider["awareness"];
}

/** Active sessions keyed by projectId. */
const activeSessions = new Map<string, CollaborationSession>();

/**
 * Derive the y-websocket server URL.
 *
 * In production, set `NEXT_PUBLIC_YJS_WS_URL` to a dedicated y-websocket
 * server.  Falls back to `ws://localhost:1234` for local development
 * (the default y-websocket server port).
 */
function getWsUrl(): string {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_YJS_WS_URL) {
    return process.env.NEXT_PUBLIC_YJS_WS_URL;
  }
  // In the browser, derive from the current origin
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.hostname}:1234`;
  }
  return "ws://localhost:1234";
}

/**
 * Create a new collaboration session for a project.
 *
 * - Opens a Yjs document
 * - Connects to the y-websocket server for real-time sync
 * - Sets up IndexedDB persistence for offline support
 * - Configures awareness with user identity
 *
 * If a session already exists for this projectId it is returned as-is.
 */
export function createSession(projectId: string, userId: string, userName: string): CollaborationSession {
  // Return existing session if already open
  const existing = activeSessions.get(projectId);
  if (existing) return existing;

  const ydoc = new Y.Doc();
  const roomName = `nexus-bio:${projectId}`;
  const wsUrl = getWsUrl();

  // IndexedDB persistence (offline-first)
  const indexeddb = new IndexeddbPersistence(roomName, ydoc);

  // WebSocket provider (real-time sync)
  const provider = new WebsocketProvider(wsUrl, roomName, ydoc, {
    connect: true,
  });

  // Configure awareness with user identity
  const awareness = provider.awareness;
  awareness.setLocalStateField("user", {
    id: userId,
    name: userName,
    color: generateUserColor(userId),
  });

  const session: CollaborationSession = {
    ydoc,
    provider,
    indexeddb,
    awareness,
  };

  activeSessions.set(projectId, session);
  return session;
}

/**
 * Destroy a collaboration session.
 *
 * Disconnects WebSocket, persists final state to IndexedDB, and
 * destroys the Yjs document to free memory.
 */
export function destroySession(session: CollaborationSession): void {
  const { provider, indexeddb, ydoc, awareness } = session;

  // Clear awareness state
  awareness.setLocalState(null);

  // Disconnect WebSocket
  provider.disconnect();
  provider.destroy();

  // Destroy IndexedDB persistence (flushes pending writes)
  indexeddb.destroy();

  // Destroy the Yjs document
  ydoc.destroy();

  // Remove from active sessions
  for (const [key, value] of activeSessions.entries()) {
    if (value === session) {
      activeSessions.delete(key);
      break;
    }
  }
}

/**
 * Get an existing session for a project, or null if none is active.
 */
export function getSession(projectId: string): CollaborationSession | null {
  return activeSessions.get(projectId) ?? null;
}

/**
 * Destroy all active sessions. Useful for cleanup on app shutdown.
 */
export function destroyAllSessions(): void {
  for (const session of activeSessions.values()) {
    destroySession(session);
  }
}

/**
 * Generate a deterministic pastel color from a user ID.
 * Uses a simple hash so the same user always gets the same color.
 */
function generateUserColor(userId: string): string {
  const COLORS = [
    "#C8D8E8",
    "#C8E0D0",
    "#DDD0E8",
    "#E8DCC8",
    "#93CB52",
    "#5151CD",
    "#FA8072",
    "#87CEEB",
    "#DDA0DD",
    "#F0E68C",
    "#98FB98",
    "#FFB6C1",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}
