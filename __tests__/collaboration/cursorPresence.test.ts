/**
 * Tests for cursorPresence — cursor broadcasting via Yjs Awareness.
 *
 * Uses a mock Awareness object since the real one requires a Y.Doc
 * and y-websocket transport.
 */

import type { Awareness } from 'y-protocols/awareness';
import {
  broadcastCursor,
  watchCursors,
  clearLocalCursor,
  type CursorInfo,
} from '../../src/services/collaboration/cursorPresence';

/** Minimal mock Awareness that supports on/off/setLocalStateField/getStates. */
function createMockAwareness(localClientId: number = 1): Awareness {
  const states = new Map<number, Record<string, unknown>>();
  const listeners = new Set<(event: unknown) => void>();

  // Initialize local state
  states.set(localClientId, {});

  const mock = {
    clientID: localClientId,
    setLocalStateField: (field: string, value: unknown) => {
      const current = states.get(localClientId) ?? {};
      current[field] = value;
      states.set(localClientId, current);
      // Fire change event
      for (const listener of listeners) {
        listener({});
      }
    },
    getStates: () => states,
    getLocalState: () => states.get(localClientId) ?? null,
    setLocalState: (state: Record<string, unknown> | null) => {
      if (state === null) {
        states.delete(localClientId);
      } else {
        states.set(localClientId, state);
      }
    },
    on: (event: string, handler: (event: unknown) => void) => {
      if (event === 'change') {
        listeners.add(handler);
      }
    },
    off: (event: string, handler: (event: unknown) => void) => {
      if (event === 'change') {
        listeners.delete(handler);
      }
    },
  };

  return mock as unknown as Awareness;
}

const CURSOR_1: CursorInfo = {
  userId: 'user-1',
  userName: 'Alice',
  x: 100,
  y: 200,
  toolId: 'fbasim',
  color: '#C8D8E8',
};

const CURSOR_2: CursorInfo = {
  userId: 'user-2',
  userName: 'Bob',
  x: 300,
  y: 400,
  toolId: 'catdes',
  color: '#C8E0D0',
};

describe('broadcastCursor', () => {
  it('sets cursor data in local awareness state', () => {
    const awareness = createMockAwareness();
    broadcastCursor(awareness, CURSOR_1);

    const localState = awareness.getLocalState() as Record<string, unknown>;
    expect(localState.cursor).toEqual({
      userId: 'user-1',
      userName: 'Alice',
      x: 100,
      y: 200,
      toolId: 'fbasim',
      color: '#C8D8E8',
    });
  });

  it('overwrites previous cursor data', () => {
    const awareness = createMockAwareness();
    broadcastCursor(awareness, CURSOR_1);
    broadcastCursor(awareness, { ...CURSOR_1, x: 999, y: 888 });

    const localState = awareness.getLocalState() as Record<string, unknown>;
    expect((localState.cursor as Record<string, unknown>).x).toBe(999);
    expect((localState.cursor as Record<string, unknown>).y).toBe(888);
  });
});

describe('watchCursors', () => {
  it('returns remote cursors, excluding local user', () => {
    const awareness = createMockAwareness(1); // local = clientID 1

    // Add a remote user (clientID 2)
    awareness.setLocalStateField('user', { id: 'user-1', name: 'Alice' });
    const states = awareness.getStates();
    states.set(2, {
      user: { id: 'user-2', name: 'Bob' },
      cursor: {
        userId: 'user-2',
        userName: 'Bob',
        x: 300,
        y: 400,
        toolId: 'catdes',
        color: '#C8E0D0',
      },
    });

    const received: CursorInfo[][] = [];
    const unsub = watchCursors(awareness, (cursors) => {
      received.push([...cursors]);
    });

    // Initial call should pick up the remote cursor
    expect(received.length).toBeGreaterThanOrEqual(1);
    const last = received[received.length - 1];
    expect(last).toHaveLength(1);
    expect(last[0].userId).toBe('user-2');
    expect(last[0].userName).toBe('Bob');

    unsub();
  });

  it('excludes local user cursor from the list', () => {
    const awareness = createMockAwareness(1);
    awareness.setLocalStateField('user', { id: 'user-1', name: 'Alice' });
    broadcastCursor(awareness, CURSOR_1);

    const received: CursorInfo[][] = [];
    const unsub = watchCursors(awareness, (cursors) => {
      received.push([...cursors]);
    });

    // Should be empty — only local cursor exists
    const last = received[received.length - 1];
    expect(last).toHaveLength(0);

    unsub();
  });

  it('updates when remote cursor changes', () => {
    const awareness = createMockAwareness(1);

    // Add remote user
    const states = awareness.getStates();
    states.set(2, {
      cursor: {
        userId: 'user-2',
        userName: 'Bob',
        x: 100,
        y: 100,
        toolId: 'fbasim',
        color: '#DDD0E8',
      },
    });

    const received: CursorInfo[][] = [];
    const unsub = watchCursors(awareness, (cursors) => {
      received.push([...cursors]);
    });

    const initialCount = received.length;

    // Update remote cursor
    states.set(2, {
      cursor: {
        userId: 'user-2',
        userName: 'Bob',
        x: 500,
        y: 600,
        toolId: 'catdes',
        color: '#DDD0E8',
      },
    });

    // Trigger change event
    awareness.setLocalStateField('_trigger', Date.now());

    expect(received.length).toBeGreaterThan(initialCount);
    const last = received[received.length - 1];
    expect(last[0].x).toBe(500);

    unsub();
  });

  it('stops firing after unsubscribe', () => {
    const awareness = createMockAwareness(1);
    const states = awareness.getStates();
    states.set(2, {
      cursor: { ...CURSOR_1, userId: 'user-2' },
    });

    let callCount = 0;
    const unsub = watchCursors(awareness, () => {
      callCount++;
    });

    const countAfterSub = callCount;
    unsub();

    // Trigger another change
    awareness.setLocalStateField('_trigger', Date.now());
    expect(callCount).toBe(countAfterSub); // no new calls
  });

  it('skips cursors with missing or invalid fields', () => {
    const awareness = createMockAwareness(1);
    const states = awareness.getStates();

    // Incomplete cursor data
    states.set(2, {
      cursor: { userId: 'user-2' }, // missing required fields
    });

    // Valid cursor
    states.set(3, {
      cursor: { ...CURSOR_2 },
    });

    const received: CursorInfo[][] = [];
    const unsub = watchCursors(awareness, (cursors) => {
      received.push([...cursors]);
    });

    const last = received[received.length - 1];
    // Only the valid cursor should appear
    expect(last).toHaveLength(1);
    expect(last[0].userId).toBe('user-2');

    unsub();
  });
});

describe('clearLocalCursor', () => {
  it('sets cursor field to null in awareness', () => {
    const awareness = createMockAwareness();
    broadcastCursor(awareness, CURSOR_1);

    clearLocalCursor(awareness);

    const localState = awareness.getLocalState() as Record<string, unknown>;
    expect(localState.cursor).toBeNull();
  });
});
