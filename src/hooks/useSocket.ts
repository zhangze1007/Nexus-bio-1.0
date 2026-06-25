'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

/** User info broadcast from the server */
export interface SocketUser {
  userId: string;
  userName: string;
  cursor?: { x: number; y: number; toolId: string };
}

/** Cursor position payload */
export interface CursorPayload {
  projectId: string;
  userId: string;
  x: number;
  y: number;
  toolId: string;
}

/** Chat message payload */
export interface ChatMessagePayload {
  projectId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
}

export interface UseSocketReturn {
  /** The underlying Socket.io socket (null until connected) */
  socket: Socket | null;
  /** Whether the socket is currently connected */
  connected: boolean;
  /** Users currently in the same project room */
  users: SocketUser[];
  /** Send a cursor position update */
  sendCursorMove: (data: Omit<CursorPayload, 'projectId'>) => void;
  /** Send a chat message */
  sendChatMessage: (message: string, userId: string, userName: string) => void;
}

/**
 * React hook that manages a Socket.io connection to a project room.
 *
 * Automatically joins the room on connect, tracks other users,
 * and cleans up on unmount or when `projectId` changes.
 *
 * @param projectId - The project to join, or null to skip connecting
 * @returns Socket state and helper senders
 */
export function useSocket(projectId: string | null): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<SocketUser[]>([]);

  useEffect(() => {
    if (!projectId) return;

    const socket = io({
      path: '/api/ws',
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join:project', {
        projectId,
        userId: 'current-user', // TODO: replace with real auth session
        userName: 'Current User',
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('users:list', (list: SocketUser[]) => {
      setUsers(list);
    });

    socket.on('user:joined', (user: SocketUser) => {
      setUsers((prev) => [...prev, user]);
    });

    socket.on('user:left', ({ userId }: { userId: string }) => {
      setUsers((prev) => prev.filter((u) => u.userId !== userId));
    });

    socketRef.current = socket;

    return () => {
      socket.emit('leave:project', { projectId });
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setUsers([]);
    };
  }, [projectId]);

  const sendCursorMove = useCallback(
    (data: Omit<CursorPayload, 'projectId'>) => {
      if (!socketRef.current || !projectId) return;
      socketRef.current.emit('cursor:move', { ...data, projectId });
    },
    [projectId],
  );

  const sendChatMessage = useCallback(
    (message: string, userId: string, userName: string) => {
      if (!socketRef.current || !projectId) return;
      socketRef.current.emit('chat:message', {
        projectId,
        userId,
        userName,
        message,
        timestamp: new Date().toISOString(),
      });
    },
    [projectId],
  );

  return { socket: socketRef.current, connected, users, sendCursorMove, sendChatMessage };
}
