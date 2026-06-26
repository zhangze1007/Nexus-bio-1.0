/**
 * Tests for workbenchSync — bidirectional Yjs <-> workbench state sync.
 *
 * Uses a real Y.Doc (no mocks needed — Yjs works entirely in-memory).
 */

import * as Y from 'yjs';
import {
  syncWorkbenchToYjs,
  syncYjsToWorkbench,
  watchWorkbenchChanges,
  watchAllWorkbenchChanges,
} from '../../src/services/collaboration/workbenchSync';

function makeDoc() {
  return new Y.Doc();
}

describe('syncWorkbenchToYjs', () => {
  it('writes all top-level keys into the Y.Map', () => {
    const doc = makeDoc();
    const state = { projectId: 'p1', title: 'Test', count: 42 };

    syncWorkbenchToYjs(doc, state);

    const map = doc.getMap('workbench');
    expect(map.get('projectId')).toBe('p1');
    expect(map.get('title')).toBe('Test');
    expect(map.get('count')).toBe(42);
  });

  it('handles nested objects as JSON values', () => {
    const doc = makeDoc();
    const nested = { a: { b: { c: 1 } }, list: [1, 2, 3] };

    syncWorkbenchToYjs(doc, nested);

    const map = doc.getMap('workbench');
    expect(map.get('a')).toEqual({ b: { c: 1 } });
    expect(map.get('list')).toEqual([1, 2, 3]);
  });

  it('removes keys that no longer exist in the source state', () => {
    const doc = makeDoc();
    const map = doc.getMap('workbench');
    map.set('oldKey', 'should be removed');
    map.set('keepKey', 'keep me');

    syncWorkbenchToYjs(doc, { keepKey: 'keep me', newKey: 'new' });

    expect(map.has('oldKey')).toBe(false);
    expect(map.get('keepKey')).toBe('keep me');
    expect(map.get('newKey')).toBe('new');
  });

  it('does not overwrite unchanged keys (JSON comparison)', () => {
    const doc = makeDoc();
    const map = doc.getMap('workbench');

    // Pre-populate
    map.set('data', { x: 1 });
    const beforeSize = map.size;

    // Same value — should not trigger a new set
    syncWorkbenchToYjs(doc, { data: { x: 1 } });

    expect(map.size).toBe(beforeSize);
    expect(map.get('data')).toEqual({ x: 1 });
  });

  it('handles empty state', () => {
    const doc = makeDoc();
    syncWorkbenchToYjs(doc, {});
    expect(doc.getMap('workbench').size).toBe(0);
  });
});

describe('syncYjsToWorkbench', () => {
  it('reads all entries from the Y.Map into a plain object', () => {
    const doc = makeDoc();
    const map = doc.getMap('workbench');
    map.set('a', 1);
    map.set('b', 'two');
    map.set('c', [3]);

    const result = syncYjsToWorkbench(doc);
    expect(result).toEqual({ a: 1, b: 'two', c: [3] });
  });

  it('returns empty object for empty map', () => {
    const doc = makeDoc();
    expect(syncYjsToWorkbench(doc)).toEqual({});
  });
});

describe('watchWorkbenchChanges', () => {
  it('fires callback on remote changes', () => {
    const doc1 = makeDoc();
    const doc2 = makeDoc();

    // Sync doc2 as a "remote peer"
    const update: Uint8Array[] = [];
    doc1.on('update', (u: Uint8Array) => {
      update.push(u);
      Y.applyUpdate(doc2, u);
    });

    const received: Record<string, unknown>[] = [];
    const unsub = watchWorkbenchChanges(doc2, (state) => {
      received.push(state);
    });

    // Local change on doc1 → should be "remote" for doc2
    syncWorkbenchToYjs(doc1, { hello: 'world' });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ hello: 'world' });

    unsub();
  });

  it('does NOT fire callback on local changes', () => {
    const doc = makeDoc();
    const received: Record<string, unknown>[] = [];
    const unsub = watchWorkbenchChanges(doc, (state) => {
      received.push(state);
    });

    // Local change — should be skipped
    syncWorkbenchToYjs(doc, { local: true });

    expect(received).toHaveLength(0);
    unsub();
  });
});

describe('watchAllWorkbenchChanges', () => {
  it('fires callback on both local and remote changes', () => {
    const doc = makeDoc();
    const received: Record<string, unknown>[] = [];
    const unsub = watchAllWorkbenchChanges(doc, (state) => {
      received.push(state);
    });

    syncWorkbenchToYjs(doc, { x: 1 });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ x: 1 });

    unsub();
  });

  it('stops firing after unsubscribe', () => {
    const doc = makeDoc();
    let count = 0;
    const unsub = watchAllWorkbenchChanges(doc, () => {
      count++;
    });

    syncWorkbenchToYjs(doc, { a: 1 });
    expect(count).toBe(1);

    unsub();

    syncWorkbenchToYjs(doc, { b: 2 });
    expect(count).toBe(1); // no additional calls
  });
});

describe('round-trip sync', () => {
  it('preserves state through write → read cycle', () => {
    const doc = makeDoc();
    const original = {
      projectId: 'abc-123',
      title: 'Artemisinin Pathway',
      stage: 'simulation',
      evidence: [{ id: 'e1', title: 'Paper A' }],
      count: 7,
    };

    syncWorkbenchToYjs(doc, original);
    const roundTripped = syncYjsToWorkbench(doc);

    expect(roundTripped).toEqual(original);
  });
});
