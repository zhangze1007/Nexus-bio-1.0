/** @jest-environment node */
/**
 * axonQueuePersistence — session-scoped queue persistence.
 * The PR-3 honesty contract: running tasks do NOT restore as running.
 */
import type { AxonTask } from '../src/services/AxonOrchestrator';
import {
  AXON_QUEUE_SCHEMA_VERSION,
  AXON_QUEUE_STORAGE_KEY,
  clearPersistedQueue,
  loadPersistedQueue,
  reconstituteTasks,
  savePersistedQueue,
} from '../src/services/axonQueuePersistence';

function makeTask(overrides: Partial<AxonTask> = {}): AxonTask {
  return {
    id: 't1',
    tool: 'pathd',
    label: 'x',
    input: {},
    status: 'pending',
    retryCount: 0,
    maxRetries: 2,
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function mockStorage() {
  const backing = new Map<string, string>();
  return {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => { backing.set(k, v); },
    removeItem: (k: string) => { backing.delete(k); },
    _backing: backing,
  };
}

describe('reconstituteTasks', () => {
  it('maps running tasks to error with an interrupted-by-reload message', () => {
    const now = 1_700_000_999_999;
    const result = reconstituteTasks(
      {
        version: AXON_QUEUE_SCHEMA_VERSION,
        persistedAt: now - 1000,
        tasks: [
          makeTask({ id: 'a', status: 'running', startedAt: now - 500 }),
          makeTask({ id: 'b', status: 'pending' }),
          makeTask({ id: 'c', status: 'done', finishedAt: now - 100 }),
          makeTask({ id: 'd', status: 'error', error: 'original' }),
        ],
      },
      now,
    );
    expect(result.interrupted).toBe(1);
    const a = result.tasks.find((t) => t.id === 'a')!;
    expect(a.status).toBe('error');
    expect(a.error).toBe('Interrupted by page reload');
    expect(a.finishedAt).toBe(now);
    // Pending, done, and error-with-original-message are preserved verbatim.
    expect(result.tasks.find((t) => t.id === 'b')!.status).toBe('pending');
    expect(result.tasks.find((t) => t.id === 'c')!.status).toBe('done');
    const d = result.tasks.find((t) => t.id === 'd')!;
    expect(d.status).toBe('error');
    expect(d.error).toBe('original');
  });

  it('does not bump retryCount on interrupted tasks (distinct failure class)', () => {
    const result = reconstituteTasks(
      {
        version: AXON_QUEUE_SCHEMA_VERSION,
        persistedAt: 0,
        tasks: [makeTask({ status: 'running', retryCount: 2 })],
      },
      1,
    );
    expect(result.tasks[0].retryCount).toBe(2);
  });
});

describe('load / save / clear', () => {
  it('round-trips tasks through a storage stub', () => {
    const storage = mockStorage();
    const tasks = [makeTask({ id: 'x' })];
    savePersistedQueue(tasks, storage);
    const raw = storage.getItem(AXON_QUEUE_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const loaded = loadPersistedQueue(storage);
    expect(loaded?.version).toBe(AXON_QUEUE_SCHEMA_VERSION);
    expect(loaded?.tasks).toHaveLength(1);
    expect(loaded?.tasks[0].id).toBe('x');
    clearPersistedQueue(storage);
    expect(storage.getItem(AXON_QUEUE_STORAGE_KEY)).toBeNull();
  });

  it('rejects payloads with a mismatched schema version', () => {
    const storage = mockStorage();
    storage.setItem(AXON_QUEUE_STORAGE_KEY, JSON.stringify({ version: 999, tasks: [] }));
    expect(loadPersistedQueue(storage)).toBeNull();
  });

  it('returns null on malformed JSON', () => {
    const storage = mockStorage();
    storage.setItem(AXON_QUEUE_STORAGE_KEY, '{not json');
    expect(loadPersistedQueue(storage)).toBeNull();
  });
});
