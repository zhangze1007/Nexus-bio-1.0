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

export type AxonTool = 'pathd' | 'fbasim';

export type AxonTaskStatus = 'pending' | 'running' | 'done' | 'error';

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
    };
    this.tasks.push(task);
    this.notify();
    return { ...task };
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
    const next = this.peekNextPending();
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
