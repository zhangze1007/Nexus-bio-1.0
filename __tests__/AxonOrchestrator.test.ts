/** @jest-environment node */
/**
 * AxonOrchestrator — deterministic queue transitions.
 *
 * Transitions covered:
 *   pending → running → done
 *   pending → running → error (retries exhausted)
 *   pending → running → error → pending (retry available)
 *   pending → error (missing adapter)
 */
import { AxonOrchestrator, type AxonAdapterMap } from '../src/services/AxonOrchestrator';

function deterministicOrchestrator() {
  let time = 1_700_000_000_000;
  let n = 0;
  return new AxonOrchestrator({
    now: () => ++time,
    idFactory: () => `task-${++n}`,
  });
}

describe('AxonOrchestrator', () => {
  it('enqueues a pending task with deterministic id and createdAt', () => {
    const o = deterministicOrchestrator();
    const task = o.enqueue({ tool: 'pathd', label: 'pathway for X', input: { targetProduct: 'X' } });
    expect(task.id).toBe('task-1');
    expect(task.status).toBe('pending');
    expect(task.retryCount).toBe(0);
    expect(task.createdAt).toBeGreaterThan(0);
    expect(o.getTasks()).toHaveLength(1);
  });

  it('peekNextPending returns the first pending task and skips terminal ones', () => {
    const o = deterministicOrchestrator();
    const a = o.enqueue({ tool: 'pathd', label: 'a', input: {} });
    const b = o.enqueue({ tool: 'fbasim', label: 'b', input: {} });
    o.markRunning(a.id);
    o.complete(a.id, { ok: true });
    const next = o.peekNextPending();
    expect(next?.id).toBe(b.id);
  });

  it('markRunning only transitions from pending', () => {
    const o = deterministicOrchestrator();
    const task = o.enqueue({ tool: 'pathd', label: 'x', input: {} });
    expect(o.markRunning(task.id)?.status).toBe('running');
    // Second call should fail silently — already running.
    expect(o.markRunning(task.id)).toBeUndefined();
  });

  it('complete only transitions from running', () => {
    const o = deterministicOrchestrator();
    const task = o.enqueue({ tool: 'pathd', label: 'x', input: {} });
    expect(o.complete(task.id, { any: 1 })).toBeUndefined();
    o.markRunning(task.id);
    const done = o.complete(task.id, { any: 1 });
    expect(done?.status).toBe('done');
    expect(done?.finishedAt).toBeDefined();
  });

  it('fail routes back to pending while retries remain, then to error', () => {
    const o = deterministicOrchestrator();
    const task = o.enqueue({
      tool: 'pathd',
      label: 'x',
      input: {},
      maxRetries: 1,
    });
    o.markRunning(task.id);
    const firstFail = o.fail(task.id, 'boom');
    expect(firstFail?.status).toBe('pending');
    expect(firstFail?.retryCount).toBe(1);

    o.markRunning(task.id);
    const secondFail = o.fail(task.id, 'boom again');
    expect(secondFail?.status).toBe('error');
    expect(secondFail?.retryCount).toBe(2);
    expect(secondFail?.error).toBe('boom again');
  });

  it('runNext runs adapter and completes task on success', async () => {
    const o = deterministicOrchestrator();
    const task = o.enqueue({ tool: 'pathd', label: 'x', input: { v: 42 } });
    const adapters: AxonAdapterMap = {
      pathd: async (input) => ({ echoed: (input as { v: number }).v * 2 }),
    };
    const finished = await o.runNext(adapters);
    expect(finished?.id).toBe(task.id);
    expect(finished?.status).toBe('done');
    expect((finished?.result as { echoed: number }).echoed).toBe(84);
  });

  it('runNext surfaces adapter errors onto the task, not as a thrown exception', async () => {
    const o = deterministicOrchestrator();
    const task = o.enqueue({ tool: 'pathd', label: 'x', input: {}, maxRetries: 0 });
    const adapters: AxonAdapterMap = {
      pathd: async () => { throw new Error('backend unreachable'); },
    };
    const finished = await o.runNext(adapters);
    expect(finished?.id).toBe(task.id);
    expect(finished?.status).toBe('error');
    expect(finished?.error).toContain('backend unreachable');
  });

  it('runNext fails cleanly when the tool has no adapter registered', async () => {
    const o = deterministicOrchestrator();
    const task = o.enqueue({ tool: 'fbasim', label: 'x', input: {}, maxRetries: 0 });
    const finished = await o.runNext({}); // no adapters at all
    expect(finished?.id).toBe(task.id);
    expect(finished?.status).toBe('error');
    expect(finished?.error).toMatch(/No adapter registered/i);
  });

  it('subscribe emits a snapshot on subscribe and on every transition', async () => {
    const o = deterministicOrchestrator();
    const snapshots: number[] = [];
    const unsubscribe = o.subscribe((tasks) => snapshots.push(tasks.length));
    expect(snapshots).toEqual([0]);
    o.enqueue({ tool: 'pathd', label: 'x', input: {} });
    expect(snapshots).toEqual([0, 1]);
    unsubscribe();
    o.enqueue({ tool: 'pathd', label: 'y', input: {} });
    expect(snapshots).toEqual([0, 1]); // no new entry after unsubscribe
  });

  it('clearTerminal removes done and error but preserves pending/running', () => {
    const o = deterministicOrchestrator();
    const a = o.enqueue({ tool: 'pathd', label: 'a', input: {} });
    const b = o.enqueue({ tool: 'pathd', label: 'b', input: {}, maxRetries: 0 });
    const c = o.enqueue({ tool: 'fbasim', label: 'c', input: {} });

    o.markRunning(a.id); o.complete(a.id, null);
    o.markRunning(b.id); o.fail(b.id, 'x');
    // c stays pending
    o.clearTerminal();
    const ids = o.getTasks().map((t) => t.id);
    expect(ids).toEqual([c.id]);
  });
});
