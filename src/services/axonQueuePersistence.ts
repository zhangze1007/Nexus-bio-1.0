/**
 * axonQueuePersistence — session-scoped queue persistence.
 *
 * PR-2b kept the orchestrator queue purely in memory. PR-3 persists it
 * across reloads so a researcher who reloads mid-run can still see
 * their recent automation state. Constraints (from the PR-3 brief):
 *
 *   • Session-scoped only (sessionStorage, not localStorage). The queue
 *     is conversational state — it should not outlive the tab.
 *   • Pending restores as pending (it really is pending).
 *   • Running does NOT restore as running. A reload interrupts the
 *     in-flight fetch; pretending otherwise would be a lie. Running
 *     tasks restore as `error` with `error: "interrupted by reload"`
 *     and `finishedAt = now`. The orchestrator retry logic is skipped
 *     because retryCount is not bumped — this is a distinct failure
 *     class, not an adapter failure.
 *   • Done / error restore as-is.
 *
 * The storage schema is versioned so future shape changes can be
 * rejected cleanly instead of crashing on parse.
 */

import type { AxonTask } from './AxonOrchestrator';

export const AXON_QUEUE_STORAGE_KEY = 'nexus-bio:axon-queue';
export const AXON_QUEUE_SCHEMA_VERSION = 1;

export interface PersistedAxonQueue {
  version: number;
  persistedAt: number;
  tasks: AxonTask[];
}

export interface RestoreResult {
  tasks: AxonTask[];
  interrupted: number;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getSessionStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Produce the restored-tasks list for the orchestrator. Pure function —
 * no side effects — so the semantics can be unit-tested independently
 * from the storage layer.
 */
export function reconstituteTasks(
  persisted: PersistedAxonQueue,
  now: number = Date.now(),
): RestoreResult {
  let interrupted = 0;
  const tasks = persisted.tasks.map((task) => {
    if (task.status === 'running') {
      interrupted += 1;
      return {
        ...task,
        status: 'error' as const,
        error: 'Interrupted by page reload',
        finishedAt: now,
      };
    }
    return { ...task };
  });
  return { tasks, interrupted };
}

export function loadPersistedQueue(storage: StorageLike | null = getSessionStorage()): PersistedAxonQueue | null {
  if (!storage) return null;
  const raw = storage.getItem(AXON_QUEUE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedAxonQueue;
    if (!parsed || parsed.version !== AXON_QUEUE_SCHEMA_VERSION) return null;
    if (!Array.isArray(parsed.tasks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePersistedQueue(tasks: AxonTask[], storage: StorageLike | null = getSessionStorage()): void {
  if (!storage) return;
  try {
    const payload: PersistedAxonQueue = {
      version: AXON_QUEUE_SCHEMA_VERSION,
      persistedAt: Date.now(),
      tasks,
    };
    storage.setItem(AXON_QUEUE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota / privacy-mode: fail silently. Persistence is best-effort.
  }
}

export function clearPersistedQueue(storage: StorageLike | null = getSessionStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(AXON_QUEUE_STORAGE_KEY);
  } catch {
    // ignore
  }
}
