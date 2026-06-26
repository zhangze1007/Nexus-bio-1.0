/**
 * Workbench <-> Yjs bidirectional sync layer.
 *
 * Keeps a Yjs shared type in sync with the workbench Zustand store.
 * Uses a top-level Y.Map so CRDT merge semantics handle concurrent edits.
 */

import * as Y from 'yjs';

/** The key used for the shared workbench map inside the Yjs doc. */
const WORKBENCH_KEY = 'workbench';

/**
 * Push workbench state into the Yjs document.
 *
 * Each top-level key becomes a Y.Map entry.  Nested objects are stored as
 * plain JSON (Yjs will serialize them).  This is intentional — deep CRDT
 * merging on every nested field would add complexity with little benefit
 * for the current workbench shape.
 *
 * Uses `ydoc.transact()` so all updates are batched into a single
 * undoable transaction.
 */
export function syncWorkbenchToYjs(
  ydoc: Y.Doc,
  workbenchState: Record<string, unknown>,
): void {
  ydoc.transact(() => {
    let rootMap = ydoc.getMap<unknown>(WORKBENCH_KEY);

    // If the map is empty, initialize it
    if (rootMap.size === 0) {
      for (const [key, value] of Object.entries(workbenchState)) {
        rootMap.set(key, value);
      }
    } else {
      // Merge: only update keys that actually changed
      for (const [key, value] of Object.entries(workbenchState)) {
        const existing = rootMap.get(key);
        if (JSON.stringify(existing) !== JSON.stringify(value)) {
          rootMap.set(key, value);
        }
      }
      // Remove keys that no longer exist in workbench state
      for (const key of rootMap.keys()) {
        if (!(key in workbenchState)) {
          rootMap.delete(key);
        }
      }
    }
  });
}

/**
 * Read the current workbench state from the Yjs document.
 *
 * Returns a plain object reconstructed from the Y.Map.
 */
export function syncYjsToWorkbench(
  ydoc: Y.Doc,
): Record<string, unknown> {
  const rootMap = ydoc.getMap<unknown>(WORKBENCH_KEY);
  const result: Record<string, unknown> = {};
  for (const [key, value] of rootMap.entries()) {
    result[key] = value;
  }
  return result;
}

/**
 * Watch for remote changes to the workbench shared type.
 *
 * Calls `callback` whenever the Y.Map is modified (by this client or a
 * remote peer).  The callback receives the full reconstructed state.
 *
 * Returns an unsubscribe function.
 */
export function watchWorkbenchChanges(
  ydoc: Y.Doc,
  callback: (state: Record<string, unknown>) => void,
): () => void {
  const rootMap = ydoc.getMap<unknown>(WORKBENCH_KEY);

  const observer = (_event: Y.YMapEvent<unknown>, transaction: Y.Transaction) => {
    // Only fire for remote changes (skip local echoes)
    if (transaction.local) return;

    const state = syncYjsToWorkbench(ydoc);
    callback(state);
  };

  rootMap.observe(observer);

  return () => {
    rootMap.unobserve(observer);
  };
}

/**
 * Watch for ALL changes (local + remote) to the workbench shared type.
 *
 * Useful when you need to react to any mutation regardless of origin.
 * Returns an unsubscribe function.
 */
export function watchAllWorkbenchChanges(
  ydoc: Y.Doc,
  callback: (state: Record<string, unknown>) => void,
): () => void {
  const rootMap = ydoc.getMap<unknown>(WORKBENCH_KEY);

  const observer = (_event: Y.YMapEvent<unknown>) => {
    const state = syncYjsToWorkbench(ydoc);
    callback(state);
  };

  rootMap.observe(observer);

  return () => {
    rootMap.unobserve(observer);
  };
}
