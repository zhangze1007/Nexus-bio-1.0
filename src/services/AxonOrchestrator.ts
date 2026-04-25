/**
 * AxonOrchestrator — PR-2b minimal agentic queue core.
 *
 * This is the first real orchestration layer behind NEXAI. It is *not* a
 * multi-agent runtime, scheduler, or speculative background worker. It is
 * a deterministic, fully-testable task queue with explicit transitions:
 *
 *     pending ──run()──▶ running ──complete()──▶ done
 *                               ├─fail()──────▶ error
 *                               └─fail()─(retry)▶ pending
 *
 * The orchestrator owns only queue state. Actual tool execution is
 * delegated to injected adapters (see `AxonAdapter`). This boundary is
 * intentional: keeping the queue side-effect-free means the scheduler
 * behaviour can be asserted purely from state, and new tool adapters can
 * be slotted in without touching the queue contract.
 *
 * Scope (PR-2b): the queue runs tasks one-at-a-time via `runNext()`. We
 * explicitly do not ship concurrency, persistence, cron, or auto-loops
 * yet — those belong to PR-3. Listeners exist so the read-only
 * AutomationDrawer can subscribe without pulling in a state library.
 */

// Phase 1 — Workflow Control Plane: AxonTool now spans all 14 registered
// tool ids. Adapter coverage is intentionally narrower (PATHD + FBASim
// only at present); the orchestrator surfaces "no adapter registered"
// errors for any tool without one. See workflowRegistry.ts for the
// declarative contract per id.
import type { ToolId } from '../domain/workflowContract';
export type AxonTool = ToolId;

/**
 * `cancelled` is a PR-4 first-class status, distinct from `error`. An error
 * is an adapter failure; a cancellation is an explicit user action. They
 * diverge in retry semantics, audit messages, and downstream impact.
 */
export type AxonTaskStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'error'
  | 'cancelled';

export interface AxonTask<TInput = unknown, TResult = unknown> {
  id: string;
  tool: AxonTool;
  /** Human-readable label for the drawer — e.g. "Design pathway for artemisinin". */
  label: string;
  input: TInput;
  status: AxonTaskStatus;
  result?: TResult;
  error?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  /**
   * PR-4: optional plan linkage. When a task was enqueued as part of a
   * multi-step plan, these fields let the orchestrator respect dependency
   * ordering during runNext() and let the UI group the task with its peers.
   */
  planId?: string;
  planStepId?: string;
  dependsOn?: string[];
  /** Free-form provenance metadata (why the task exists). Not executed on. */
  meta?: Record<string, unknown>;
}

export interface AxonAdapterContext {
  signal?: AbortSignal;
}

export type AxonAdapter<TInput = unknown, TResult = unknown> = (
  input: TInput,
  ctx: AxonAdapterContext,
) => Promise<TResult>;

export type AxonAdapterMap = Partial<Record<AxonTool, AxonAdapter>>;

export interface EnqueueOptions {
  label: string;
  tool: AxonTool;
  input: unknown;
  maxRetries?: number;
  /** PR-4: plan linkage. Optional; omitted for ad-hoc tasks. */
  planId?: string;
  planStepId?: string;
  dependsOn?: string[];
  meta?: Record<string, unknown>;
  /** Override only for tests — never pass in production paths. */
  now?: () => number;
  /** Override only for tests — never pass in production paths. */
  idFactory?: () => string;
}

type Listener = (tasks: AxonTask[]) => void;

/**
 * Deterministic queue. All state changes go through methods on this
 * class so the transition graph can be asserted from tests without any
 * timing assumptions.
 */
export class AxonOrchestrator {
  private tasks: AxonTask[] = [];
  private listeners = new Set<Listener>();
  private now: () => number;
  private idFactory: () => string;

  constructor(opts?: { now?: () => number; idFactory?: () => string }) {
    this.now = opts?.now ?? (() => Date.now());
    this.idFactory = opts?.idFactory ?? defaultIdFactory;
  }

  // ── Read surface ─────────────────────────────────────────────

  getTasks(): AxonTask[] {
    return this.tasks.map((task) => ({ ...task }));
  }

  getTask(id: string): AxonTask | undefined {
    const task = this.tasks.find((t) => t.id === id);
    return task ? { ...task } : undefined;
  }

  peekNextPending(): AxonTask | undefined {
    const task = this.tasks.find((t) => t.status === 'pending');
    return task ? { ...task } : undefined;
  }

  // ── Mutations ────────────────────────────────────────────────

  enqueue(opts: EnqueueOptions): AxonTask {
    const now = opts.now ?? this.now;
    const idFactory = opts.idFactory ?? this.idFactory;
    const task: AxonTask = {
      id: idFactory(),
      tool: opts.tool,
      label: opts.label,
      input: opts.input,
      status: 'pending',
      retryCount: 0,
      maxRetries: opts.maxRetries ?? 1,
      createdAt: now(),
      planId: opts.planId,
      planStepId: opts.planStepId,
      dependsOn: opts.dependsOn,
      meta: opts.meta,
    };
    this.tasks.push(task);
    this.notify();
    return { ...task };
  }

  /**
   * PR-4: Returns the next pending task whose dependencies are all done.
   * Skips pending tasks waiting on unmet deps. A task blocked on a
   * dependency that has terminally failed or been cancelled is NOT
   * scheduled — the caller (provider) detects the stuck state and either
   * explicitly cancels or warns.
   */
  peekNextRunnable(): AxonTask | undefined {
    for (const task of this.tasks) {
      if (task.status !== 'pending') continue;
      if (!this.dependenciesSatisfied(task)) continue;
      return { ...task };
    }
    return undefined;
  }

  /**
   * Pending tasks whose predecessors are cancelled or errored — the
   * caller uses this to surface "downstream blocked by upstream failure"
   * warnings instead of letting tasks sit silently.
   */
  getBlockedByDependencyFailure(): AxonTask[] {
    const byId = new Map(this.tasks.map((t) => [t.id, t]));
    const blocked: AxonTask[] = [];
    for (const task of this.tasks) {
      if (task.status !== 'pending') continue;
      if (!task.dependsOn?.length) continue;
      const hasDead = task.dependsOn.some((dep) => {
        const d = byId.get(dep);
        return d?.status === 'error' || d?.status === 'cancelled';
      });
      if (hasDead) blocked.push({ ...task });
    }
    return blocked;
  }

  private dependenciesSatisfied(task: AxonTask): boolean {
    if (!task.dependsOn || task.dependsOn.length === 0) return true;
    const byId = new Map(this.tasks.map((t) => [t.id, t]));
    return task.dependsOn.every((dep) => byId.get(dep)?.status === 'done');
  }

  /** Transition pending → running. Returns the mutated task or undefined. */
  markRunning(id: string): AxonTask | undefined {
    const task = this.tasks.find((t) => t.id === id);
    if (!task || task.status !== 'pending') return undefined;
    task.status = 'running';
    task.startedAt = this.now();
    this.notify();
    return { ...task };
  }

  /** Transition running → done. */
  complete(id: string, result: unknown): AxonTask | undefined {
    const task = this.tasks.find((t) => t.id === id);
    if (!task || task.status !== 'running') return undefined;
    task.status = 'done';
    task.result = result;
    task.finishedAt = this.now();
    this.notify();
    return { ...task };
  }

  /**
   * Transition running → error. When retryCount < maxRetries, the task is
   * bounced back to pending and left in the queue for the next runNext()
   * call. When retries are exhausted the task stays as error.
   */
  fail(id: string, error: string): AxonTask | undefined {
    const task = this.tasks.find((t) => t.id === id);
    if (!task || task.status !== 'running') return undefined;
    task.retryCount += 1;
    if (task.retryCount <= task.maxRetries) {
      task.status = 'pending';
      task.startedAt = undefined;
      task.error = error;
    } else {
      task.status = 'error';
      task.error = error;
      task.finishedAt = this.now();
    }
    this.notify();
    return { ...task };
  }

  /** Remove every task in terminal state. Running / pending are preserved. */
  clearTerminal(): void {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter(
      (t) => t.status === 'pending' || t.status === 'running',
    );
    if (this.tasks.length !== before) this.notify();
  }

  /**
   * PR-4: explicit cancellation.
   *   • pending → cancelled (immediate)
   *   • running → cancelled (signals the adapter AbortController, if any)
   *   • terminal (done/error/cancelled) → no-op
   * Cancelled != error. Retry count is NOT incremented.
   */
  cancel(id: string): AxonTask | undefined {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return undefined;
    if (
      task.status === 'done' ||
      task.status === 'error' ||
      task.status === 'cancelled'
    ) {
      return undefined;
    }
    task.status = 'cancelled';
    task.finishedAt = this.now();
    this.notify();
    return { ...task };
  }

  /**
   * PR-4: explicit retry. Only terminal failed/cancelled tasks can be
   * retried. Bumps retryCount by 1 (separate from the adapter-level
   * retry bounce in fail()). Resets status → pending so runNext() picks
   * it up. Never called automatically — this is a user action.
   */
  retry(id: string): AxonTask | undefined {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return undefined;
    if (task.status !== 'error' && task.status !== 'cancelled') return undefined;
    task.status = 'pending';
    task.retryCount += 1;
    task.error = undefined;
    task.startedAt = undefined;
    task.finishedAt = undefined;
    this.notify();
    return { ...task };
  }

  /**
   * PR-4: reorder a pending task. Moves `id` to the requested index
   * within the pending sub-sequence. Refuses illegal moves:
   *   • not pending → refused
   *   • target index would place it ahead of a still-pending dependency → refused
   * Returns undefined on refusal. Caller inspects return to warn the user.
   */
  reorderPending(id: string, newIndex: number): AxonTask | undefined {
    const current = this.tasks.findIndex((t) => t.id === id);
    if (current < 0) return undefined;
    const task = this.tasks[current];
    if (task.status !== 'pending') return undefined;

    // Compute target slot within the full array based on pending index.
    const pending = this.tasks
      .map((t, i) => ({ t, i }))
      .filter((p) => p.t.status === 'pending');
    if (newIndex < 0 || newIndex >= pending.length) return undefined;

    // Dependency guard: newIndex must not place task before any unmet
    // pending-or-running predecessor that lives earlier in the queue.
    if (task.dependsOn?.length) {
      const byId = new Map(this.tasks.map((t) => [t.id, t]));
      for (const dep of task.dependsOn) {
        const depTask = byId.get(dep);
        if (!depTask) continue;
        if (depTask.status === 'done') continue;
        const depPendingIdx = pending.findIndex((p) => p.t.id === dep);
        if (depPendingIdx >= 0 && newIndex <= depPendingIdx) return undefined;
      }
    }

    const targetSlot = pending[newIndex].i;
    // Remove then insert at the target slot index (adjust if removal was earlier).
    const [removed] = this.tasks.splice(current, 1);
    const adjusted = targetSlot > current ? targetSlot - 1 : targetSlot;
    this.tasks.splice(adjusted, 0, removed);
    this.notify();
    return { ...removed };
  }

  /**
   * Replace the entire task list. Used by the provider when hydrating
   * queue state from session storage. Never called during normal
   * operation — this is deliberately named `restoreTasks` (not
   * `setTasks`) to signal that it is persistence-layer glue.
   */
  restoreTasks(tasks: AxonTask[]): void {
    this.tasks = tasks.map((task) => ({ ...task }));
    this.notify();
  }

  // ── Execution ────────────────────────────────────────────────

  /**
   * Run the next pending task using the supplied adapter map.
   *
   * Returns the terminal task (done or error) or undefined when the
   * queue has nothing to run. Missing / unsupported adapters transition
   * the task straight to `error` with a clear message — we never silently
   * skip, because that would hide broken wiring behind a quiet success.
   */
  async runNext(adapters: AxonAdapterMap, ctx: AxonAdapterContext = {}): Promise<AxonTask | undefined> {
    // PR-4: honour explicit dependencies. peekNextRunnable returns
    // undefined when every pending task is still waiting on a
    // predecessor — the caller treats that as "idle until a prior
    // step completes".
    const next = this.peekNextRunnable();
    if (!next) return undefined;

    const running = this.markRunning(next.id);
    if (!running) return undefined;

    const adapter = adapters[running.tool];
    if (!adapter) {
      return this.fail(running.id, `No adapter registered for tool "${running.tool}"`);
    }

    try {
      const result = await adapter(running.input, ctx);
      return this.complete(running.id, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.fail(running.id, message);
    }
  }

  // ── Subscription ─────────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getTasks());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snapshot = this.getTasks();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

function defaultIdFactory(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `axon-${Date.now().toString(36)}-${rand}`;
}
