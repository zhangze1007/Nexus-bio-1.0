/**
 * Tests for yjsProvider — Yjs session lifecycle management.
 *
 * Mocks y-websocket and y-indexeddb since they require actual
 * network connections and IndexedDB (not available in jsdom).
 *
 * Each test uses a unique projectId to avoid cross-test interference
 * from the shared activeSessions map.
 */

import * as Y from 'yjs';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAwareness = {
  setLocalState: jest.fn(),
  setLocalStateField: jest.fn(),
  getLocalState: jest.fn(() => null),
  getStates: jest.fn(() => new Map()),
  clientID: 1,
  on: jest.fn(),
  off: jest.fn(),
  _checkInterval: null,
};

const mockProvider = {
  awareness: mockAwareness,
  wsconnected: true,
  connect: jest.fn(),
  disconnect: jest.fn(),
  destroy: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

const mockIndexeddb = {
  destroy: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

jest.mock('y-websocket', () => ({
  WebsocketProvider: jest.fn().mockImplementation(() => ({ ...mockProvider })),
}));

jest.mock('y-indexeddb', () => ({
  IndexeddbPersistence: jest.fn().mockImplementation(() => ({ ...mockIndexeddb })),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import {
  createSession,
  destroySession,
  getSession,
  destroyAllSessions,
} from '../../src/services/collaboration/yjsProvider';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createSession', () => {
  it('creates a session with ydoc, provider, indexeddb, and awareness', () => {
    const session = createSession('cs-1', 'user-1', 'Alice');

    expect(session.ydoc).toBeDefined();
    expect(session.provider).toBeDefined();
    expect(session.indexeddb).toBeDefined();
    expect(session.awareness).toBeDefined();
  });

  it('configures awareness with user identity', () => {
    createSession('cs-2', 'user-2', 'Bob');

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({
        id: 'user-2',
        name: 'Bob',
        color: expect.any(String),
      }),
    );
  });

  it('returns the same session for the same projectId', () => {
    const s1 = createSession('cs-3', 'user-1', 'Alice');
    const s2 = createSession('cs-3', 'user-1', 'Alice');

    expect(s1.ydoc).toBe(s2.ydoc);
    expect(s1.provider).toBe(s2.provider);
  });

  it('creates different sessions for different projects', () => {
    const s1 = createSession('cs-4a', 'user-1', 'Alice');
    const s2 = createSession('cs-4b', 'user-2', 'Bob');

    expect(s1.ydoc).not.toBe(s2.ydoc);
  });

  it('passes the correct room name to WebsocketProvider', () => {
    createSession('cs-5', 'user-1', 'Alice');

    expect(WebsocketProvider).toHaveBeenCalledWith(
      expect.any(String),
      'nexus-bio:cs-5',
      expect.any(Y.Doc),
      expect.objectContaining({ connect: true }),
    );
  });

  it('passes the correct room name to IndexeddbPersistence', () => {
    createSession('cs-6', 'user-1', 'Alice');

    expect(IndexeddbPersistence).toHaveBeenCalledWith(
      'nexus-bio:cs-6',
      expect.any(Y.Doc),
    );
  });

  it('generates a hex color string for the user', () => {
    createSession('cs-7', 'user-1', 'Alice');

    const userArg = mockAwareness.setLocalStateField.mock.calls.find(
      (c) => c[0] === 'user',
    )?.[1] as Record<string, unknown> | undefined;

    expect(userArg).toBeDefined();
    expect(typeof userArg!.color).toBe('string');
    expect(userArg!.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('destroySession', () => {
  it('clears awareness and disconnects provider', () => {
    const session = createSession('ds-1', 'user-1', 'Alice');
    destroySession(session);

    expect(mockAwareness.setLocalState).toHaveBeenCalledWith(null);
    expect(mockProvider.disconnect).toHaveBeenCalled();
    expect(mockProvider.destroy).toHaveBeenCalled();
    expect(mockIndexeddb.destroy).toHaveBeenCalled();
  });

  it('allows creating a new session for the same project after destruction', () => {
    const s1 = createSession('ds-2', 'user-1', 'Alice');
    destroySession(s1);

    const s2 = createSession('ds-2', 'user-1', 'Alice');

    // New session — different ydoc instance
    expect(s2.ydoc).not.toBe(s1.ydoc);
  });
});

describe('getSession', () => {
  it('returns null when no session exists', () => {
    expect(getSession('gs-nonexistent')).toBeNull();
  });

  it('returns the active session after creation', () => {
    const created = createSession('gs-1', 'user-1', 'Alice');
    const retrieved = getSession('gs-1');

    expect(retrieved).toBe(created);
  });
});

describe('destroyAllSessions', () => {
  it('destroys all active sessions', () => {
    createSession('da-1', 'user-1', 'Alice');
    createSession('da-2', 'user-2', 'Bob');

    destroyAllSessions();

    expect(getSession('da-1')).toBeNull();
    expect(getSession('da-2')).toBeNull();
  });
});
