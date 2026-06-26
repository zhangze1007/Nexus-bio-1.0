'use client';

/**
 * React hook for Yjs-based real-time collaboration.
 *
 * Manages the full collaboration lifecycle:
 * - Creates/destroys Yjs sessions
 * - Tracks connection status
 * - Watches remote cursors
 * - Provides cursor broadcasting helper
 *
 * @param projectId — The project to collaborate on, or null to skip.
 * @param userId    — Current user's ID (default: 'current-user').
 * @param userName  — Current user's display name (default: 'Current User').
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CursorInfo } from '../services/collaboration/cursorPresence';
import {
  broadcastCursor,
  watchCursors,
} from '../services/collaboration/cursorPresence';
import type { CollaborationSession } from '../services/collaboration/yjsProvider';
import { createSession, destroySession } from '../services/collaboration/yjsProvider';

export interface UseCollaborationReturn {
  /** Whether the WebSocket provider is connected. */
  connected: boolean;
  /** Remote cursors (excludes local user). */
  cursors: CursorInfo[];
  /** Broadcast local cursor position to peers. */
  broadcastCursor: (cursor: Omit<CursorInfo, 'userId' | 'userName' | 'color'>) => void;
  /** The underlying Yjs document (for direct CRDT access). */
  ydoc: import('yjs').Doc | null;
  /** The collaboration session (for advanced use). */
  session: CollaborationSession | null;
}

export function useCollaboration(
  projectId: string | null,
  userId: string = 'current-user',
  userName: string = 'Current User',
): UseCollaborationReturn {
  const [connected, setConnected] = useState(false);
  const [cursors, setCursors] = useState<CursorInfo[]>([]);
  const sessionRef = useRef<CollaborationSession | null>(null);

  // Create / destroy session when projectId changes
  useEffect(() => {
    if (!projectId) {
      setConnected(false);
      setCursors([]);
      return;
    }

    const session = createSession(projectId, userId, userName);
    sessionRef.current = session;

    // Track connection status
    const handleStatus = (event: { status: string }) => {
      setConnected(event.status === 'connected');
    };
    session.provider.on('status', handleStatus);

    // Set initial status
    setConnected(session.provider.wsconnected);

    // Watch remote cursors
    const unsubscribeCursors = watchCursors(session.awareness, (remoteCursors) => {
      setCursors(remoteCursors);
    });

    return () => {
      unsubscribeCursors();
      session.provider.off('status', handleStatus);
      destroySession(session);
      sessionRef.current = null;
      setConnected(false);
      setCursors([]);
    };
  }, [projectId, userId, userName]);

  // Stable callback for broadcasting cursor
  const broadcast = useCallback(
    (cursor: Omit<CursorInfo, 'userId' | 'userName' | 'color'>) => {
      const session = sessionRef.current;
      if (!session) return;

      broadcastCursor(session.awareness, {
        ...cursor,
        userId,
        userName,
        color: session.awareness.getLocalState()?.user?.color ?? '#C8D8E8',
      });
    },
    [userId, userName],
  );

  return {
    connected,
    cursors,
    broadcastCursor: broadcast,
    ydoc: sessionRef.current?.ydoc ?? null,
    session: sessionRef.current,
  };
}
