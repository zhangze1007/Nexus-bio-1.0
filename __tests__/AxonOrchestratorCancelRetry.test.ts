/** @jest-environment node */
/**
 * AxonOrchestrator — PR-4 cancel / retry / reorder + dependency scheduling.
 */
import {
  AxonOrchestrator,
  type AxonAdapterMap,
} from '../src/services/AxonOrchestrator';

function deterministic() {
  let t = 1_700_000_000_000;
  let n = 0;
  return new AxonOrchestrator({
    now: () => ++t,
    idFactory: () => `task-${++n}`,
  });
}

const noopAdapters: AxonAdapterMap = {
  pathd: async () => ({ nodeCount: 3, bottleneckCount: 1, provider: 'test' }),
  fbasim: async () => ({ objectiveValue: 0.42, fluxCount: 20, species: 'ecoli' }),
};

describe('AxonOrchestrator cancel/retry/reorder', () => {
  it('cancels a pending task and does NOT bump retryCount', () => {
    const o = deterministic();
    const t = o.enqueue({ tool: 'pathd', label: 'p', input: {} });
    const cancelled = o.cancel(t.id);
    expect(cancelled?.status).toBe('cancelled');
    expect(cancelled?.retryCount).toBe(0);
    expect(cancelled?.finishedAt).toBeGreaterThan(0);
  });

  it('cancel is a no-op on terminal tasks', async () => {
    const o = deterministic();
    const t = o.enqueue({ tool: 'pathd', label: 'p', input: {} });
    await o.runNext(noopAdapters);
    const second = o.cancel(t.id);
    expect(second).toBeUndefined();
    expect(o.getTask(t.id)?.status).toBe('done');
  });

  it('retry moves error → pending and bumps retryCount', async () => {
    const o = deterministic();
    const t = o.enqueue({
      tool: 'pathd',
      label: 'p',
      input: {},
      maxRetries: 0,
    });
    const failing: AxonAdapterMap = {
      pathd: async () => {
        throw new Error('boom');
      },
    };
    await o.runNext(failing);
    const errored = o.getTask(t.id);
    expect(errored?.status).toBe('error');
    // fail() already bumped retryCount to 1 on the failing run.
    const before = errored?.retryCount ?? 0;
    const retried = o.retry(t.id);
    expect(retried?.status).toBe('pending');
    expect(retried?.retryCount).toBe(before + 1);
    expect(retried?.error).toBeUndefined();
  });

  it('retry moves cancelled → pending', () => {
    const o = deterministic();
    const t = o.enqueue({ tool: 'pathd', label: 'p', input: {} });
    o.cancel(t.id);
    const retried = o.retry(t.id);
    expect(retried?.status).toBe('pending');
  });

  it('peekNextRunnable respects dependsOn and returns undefined while blocked', async () => {
    const o = deterministic();
    const a = o.enqueue({ tool: 'pathd', label: 'a', input: {} });
    const b = o.enqueue({
      tool: 'fbasim',
      label: 'b',
      input: {},
      dependsOn: [a.id],
    });
    expect(o.peekNextRunnable()?.id).toBe(a.id);
    // Before a completes, b is not runnable — even though it's pending.
    o.markRunning(a.id);
    expect(o.peekNextRunnable()).toBeUndefined();
    o.complete(a.id, {});
    expect(o.peekNextRunnable()?.id).toBe(b.id);
  });

  it('getBlockedByDependencyFailure surfaces tasks whose deps failed', () => {
    const o = deterministic();
    const a = o.enqueue({ tool: 'pathd', label: 'a', input: {} });
    const b = o.enqueue({
      tool: 'fbasim',
      label: 'b',
      input: {},
      dependsOn: [a.id],
    });
    o.cancel(a.id);
    const blocked = o.getBlockedByDependencyFailure();
    expect(blocked.map((t) => t.id)).toContain(b.id);
  });

  it('reorderPending refuses moves that violate dependsOn', () => {
    const o = deterministic();
    const a = o.enqueue({ tool: 'pathd', label: 'a', input: {} });
    const b = o.enqueue({
      tool: 'fbasim',
      label: 'b',
      input: {},
      dependsOn: [a.id],
    });
    // Try to move b before a — must refuse.
    const result = o.reorderPending(b.id, 0);
    expect(result).toBeUndefined();
    // Order unchanged.
    expect(o.getTasks().map((t) => t.id)).toEqual([a.id, b.id]);
  });

  it('reorderPending allows legal moves within pending window', () => {
    const o = deterministic();
    const a = o.enqueue({ tool: 'pathd', label: 'a', input: {} });
    const b = o.enqueue({ tool: 'fbasim', label: 'b', input: {} });
    const c = o.enqueue({ tool: 'pathd', label: 'c', input: {} });
    // Move c to index 0. No deps declared, legal.
    const moved = o.reorderPending(c.id, 0);
    expect(moved?.id).toBe(c.id);
    expect(o.getTasks().map((t) => t.id)).toEqual([c.id, a.id, b.id]);
  });

  it('reorderPending refuses non-pending tasks', async () => {
    const o = deterministic();
    const a = o.enqueue({ tool: 'pathd', label: 'a', input: {} });
    await o.runNext(noopAdapters);
    const result = o.reorderPending(a.id, 0);
    expect(result).toBeUndefined();
  });
});
