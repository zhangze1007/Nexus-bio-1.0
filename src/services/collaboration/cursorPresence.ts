/**
 * Cursor presence via Yjs Awareness protocol.
 *
 * Broadcasts cursor positions to all peers in a collaboration session.
 * Uses the Yjs awareness protocol which is already part of y-websocket
 * — no extra transport needed.
 */

import type { Awareness } from 'y-protocols/awareness';

/** Cursor information broadcast to peers. */
export interface CursorInfo {
  /** Unique user identifier. */
  userId: string;
  /** Display name. */
  userName: string;
  /** Cursor X position (pixels or canvas coords). */
  x: number;
  /** Cursor Y position (pixels or canvas coords). */
  y: number;
  /** Which tool/page the cursor is on. */
  toolId: string;
  /** User's assigned color (hex). */
  color: string;
}

/** Internal awareness field key for cursor data. */
const CURSOR_FIELD = 'cursor';

/**
 * Broadcast the local user's cursor position to all peers.
 *
 * Sets the `cursor` field in the local awareness state.
 * The y-websocket provider automatically propagates this to all peers.
 */
export function broadcastCursor(
  awareness: Awareness,
  cursor: CursorInfo,
): void {
  awareness.setLocalStateField(CURSOR_FIELD, {
    userId: cursor.userId,
    userName: cursor.userName,
    x: cursor.x,
    y: cursor.y,
    toolId: cursor.toolId,
    color: cursor.color,
  });
}

/**
 * Watch for cursor updates from all peers (including self).
 *
 * Calls `callback` with the full list of remote cursors whenever
 * any peer's awareness state changes.
 *
 * The callback only includes cursors from OTHER users — the local
 * user's own cursor is excluded so consumers don't render a duplicate.
 *
 * Returns an unsubscribe function.
 */
export function watchCursors(
  awareness: Awareness,
  callback: (cursors: CursorInfo[]) => void,
): () => void {
  const localClientId = awareness.clientID;

  const handleChange = () => {
    const cursors: CursorInfo[] = [];

    for (const [clientId, state] of awareness.getStates().entries()) {
      // Skip local user
      if (clientId === localClientId) continue;

      const cursorData = (state as Record<string, unknown>)[CURSOR_FIELD];
      if (cursorData && typeof cursorData === 'object') {
        const c = cursorData as Record<string, unknown>;
        if (
          typeof c.userId === 'string' &&
          typeof c.userName === 'string' &&
          typeof c.x === 'number' &&
          typeof c.y === 'number' &&
          typeof c.toolId === 'string' &&
          typeof c.color === 'string'
        ) {
          cursors.push({
            userId: c.userId,
            userName: c.userName,
            x: c.x,
            y: c.y,
            toolId: c.toolId,
            color: c.color,
          });
        }
      }
    }

    callback(cursors);
  };

  awareness.on('change', handleChange);

  // Fire immediately with current state
  handleChange();

  return () => {
    awareness.off('change', handleChange);
  };
}

/**
 * Clear the local user's cursor from awareness.
 *
 * Call this when the cursor leaves the collaboration viewport
 * (e.g., user switches tools or navigates away).
 */
export function clearLocalCursor(awareness: Awareness): void {
  awareness.setLocalStateField(CURSOR_FIELD, null);
}
