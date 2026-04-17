'use client';
/**
 * AxonOrchestratorProvider — shared Axon orchestration layer.
 *
 * Before PR-3 the orchestrator lived in a useRef inside NEXAIPage. That
 * meant (a) only NEXAI could enqueue, (b) state vanished the moment the
 * user navigated to another tool, (c) the AutomationDrawer could only
 * render on one page, (d) there was no writeback into shared workbench
 * state. PR-3 fixes all four.
 *
 * The provider mounts once in ToolsLayoutShell — high enough in the tree
 * to cover every /tools/* route, low enough to avoid editing forbidden
 * IDE chrome. It owns:
 *
 *   • a single long-lived AxonOrchestrator instance
 *   • the adapter registry (PATHD + FBASIM today, growable)
 *   • the reactive tasks array
 *   • the agentic-mode feature flag
 *   • session-scoped queue persistence (see axonQueuePersistence)
 *   • typed writeback of terminal tasks into workbench state
 *
 * It deliberately does NOT own the overlay open/close state — that lives
 * in uiStore where the rest of the IDE chrome state already lives. This
 * keeps the provider purely about orchestration.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AxonOrchestrator, type AxonTask, type AxonTool } from '../services/AxonOrchestrator';
import {
  buildDefaultAxonAdapterRegistry,
  type AxonAdapterRegistry,
} from '../services/axonAdapterRegistry';
import {
  loadPersistedQueue,
  reconstituteTasks,
  savePersistedQueue,
} from '../services/axonQueuePersistence';
import { publishTaskOutcome } from '../services/axonWriteback';
import {
  buildAxonPlan,
  type AxonPlan,
  type AxonPlanStep,
} from '../services/axonPlanner';
import {
  buildLogEntry,
  type AxonLogEntry,
  type AxonLogPhase,
} from '../services/axonExecutionLog';
import {
  buildDefaultEvidenceRegistry,
  type EvidenceAdapterRegistry,
} from '../services/axonEvidenceAdapter';
import {
  noopAutonomyLoop,
  type AutonomyLoop,
} from '../services/axonAutonomyLoop';
import type { WorkbenchCopilotContext } from '../services/axonContext';
import { useWorkbenchStore } from '../store/workbenchStore';
import { useUIStore } from '../store/uiStore';

export interface AxonEnqueueOptions {
  tool: AxonTool;
  label: string;
  input: unknown;
}

export interface AxonPlanAndRunOptions {
  request: string;
  context: WorkbenchCopilotContext;
}

export interface AxonPlanAndRunResult {
  plan: AxonPlan;
  enqueuedStepIds: string[];
  skippedStepIds: string[];
}

export interface AxonOrchestratorContextValue {
  tasks: AxonTask[];
  agenticMode: boolean;
  setAgenticMode: (value: boolean) => void;
  toggleAgenticMode: () => void;
  enqueueAndRun: (opts: AxonEnqueueOptions) => AxonTask | null;
  clearTerminal: () => void;
  isSupported: (tool: AxonTool) => boolean;
  registry: AxonAdapterRegistry;
  /** True if the session started with interrupted running tasks. */
  hadInterruptedTasks: boolean;

  /** PR-4: live execution trace, newest-first. */
  logs: AxonLogEntry[];

  /** PR-4: active plan. One plan at a time — latest supersedes prior. */
  activePlan: AxonPlan | null;

  /** PR-4: deterministic planner + dependency-aware enqueue. */
  planAndRun: (opts: AxonPlanAndRunOptions) => AxonPlanAndRunResult;

  /** PR-4: explicit queue controls. */
  cancelTask: (id: string) => void;
  retryTask: (id: string) => void;
  reorderTask: (id: string, newIndex: number) => { ok: boolean; reason?: string };

  /** PR-4: evidence adapter registry (read-only for consumers). */
  evidenceRegistry: EvidenceAdapterRegistry;

  /** PR-4: autonomy seam — ships disabled. */
  autonomy: AutonomyLoop;
}

const AxonOrchestratorContext = createContext<AxonOrchestratorContextValue | null>(null);

export interface AxonOrchestratorProviderProps {
  children: ReactNode;
  /** Inject a custom registry in tests. */
  registry?: AxonAdapterRegistry;
  /** When true, skip the sessionStorage hydrate (tests). */
  disablePersistence?: boolean;
}

export function AxonOrchestratorProvider({
  children,
  registry: registryOverride,
  disablePersistence = false,
}: AxonOrchestratorProviderProps) {
  const orchestratorRef = useRef<AxonOrchestrator | null>(null);
  if (!orchestratorRef.current) orchestratorRef.current = new AxonOrchestrator();
  const orchestrator = orchestratorRef.current;

  const registry = useMemo(
    () => registryOverride ?? buildDefaultAxonAdapterRegistry(),
    [registryOverride],
  );
  const adapters = useMemo(() => registry.toMap(), [registry]);

  const [tasks, setTasks] = useState<AxonTask[]>([]);
  const [agenticMode, setAgenticMode] = useState(false);
  const [hadInterruptedTasks, setHadInterruptedTasks] = useState(false);
  const [logs, setLogs] = useState<AxonLogEntry[]>([]);
  const [activePlan, setActivePlan] = useState<AxonPlan | null>(null);
  const hydratedRef = useRef(false);
  const appendConsole = useUIStore((s) => s.appendConsole);
  const appendAxonRun = useWorkbenchStore((s) => s.appendAxonRun);
  const addToolRun = useWorkbenchStore((s) => s.addToolRun);
  const appendAxonLog = useWorkbenchStore((s) => s.appendAxonLog);
  const setAxonPlanStore = useWorkbenchStore((s) => s.setAxonPlan);
  const updateAxonPlanStep = useWorkbenchStore((s) => s.updateAxonPlanStep);

  // Evidence registry — reads live from the workbench store, so stays
  // in sync without re-rendering the provider.
  const evidenceRegistry = useMemo(
    () =>
      buildDefaultEvidenceRegistry(() => {
        const s = useWorkbenchStore.getState();
        return {
          evidenceItems: s.evidenceItems,
          analyzeArtifact: s.analyzeArtifact,
          nextRecommendations: s.nextRecommendations,
        };
      }),
    [],
  );

  const autonomy: AutonomyLoop = noopAutonomyLoop;

  const pushLog = useCallback(
    (
      phase: AxonLogPhase,
      message: string,
      extras: Partial<Omit<AxonLogEntry, 'id' | 'timestamp' | 'phase' | 'message'>> = {},
    ) => {
      const entry = buildLogEntry({ phase, message, ...extras });
      setLogs((prev) => {
        const next = [entry, ...prev];
        if (next.length > 400) next.length = 400;
        return next;
      });
      appendAxonLog({
        id: entry.id,
        timestamp: entry.timestamp,
        phase: entry.phase,
        message: entry.message,
        taskId: entry.taskId,
        planId: entry.planId,
        tool: entry.tool,
        metadata: entry.metadata,
      });
    },
    [appendAxonLog],
  );

  // Subscribe to orchestrator state.
  useEffect(() => {
    return orchestrator.subscribe(setTasks);
  }, [orchestrator]);

  // Hydrate from session storage on first client render only.
  useEffect(() => {
    if (hydratedRef.current || disablePersistence) return;
    hydratedRef.current = true;
    const persisted = loadPersistedQueue();
    if (!persisted || persisted.tasks.length === 0) return;
    const { tasks: restored, interrupted } = reconstituteTasks(persisted);
    orchestrator.restoreTasks(restored);
    if (interrupted > 0) {
      setHadInterruptedTasks(true);
      pushLog(
        'interrupted',
        `Restored ${interrupted} task(s) as interrupted — previous session ended mid-run.`,
        { metadata: { interruptedCount: interrupted } },
      );
    }
  }, [orchestrator, disablePersistence, pushLog]);

  // Persist on every task mutation.
  useEffect(() => {
    if (disablePersistence) return;
    savePersistedQueue(tasks);
  }, [tasks, disablePersistence]);

  // Writeback — fire when a task newly enters a terminal state.
  // Cancelled tasks do NOT trigger writeback — they are not outcomes.
  const publishedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const task of tasks) {
      if (task.status !== 'done' && task.status !== 'error') continue;
      if (publishedRef.current.has(task.id)) continue;
      publishedRef.current.add(task.id);
      publishTaskOutcome(task, { appendAxonRun, addToolRun });
      pushLog(
        'writeback-emitted',
        `Writeback: ${task.tool.toUpperCase()} ${task.status === 'done' ? 'result' : 'error'} published to workbench ledger.`,
        {
          taskId: task.id,
          planId: task.planId,
          tool: task.tool,
          metadata: { status: task.status },
        },
      );

      // Update matching plan step status so the planner card reflects
      // the outcome without a separate subscription.
      if (task.planId && task.planStepId) {
        setActivePlan((prev) => {
          if (!prev || prev.id !== task.planId) return prev;
          const nextSteps = prev.steps.map((s) =>
            s.id === task.planStepId ? { ...s, status: task.status as AxonPlanStep['status'] } : s,
          );
          return { ...prev, steps: nextSteps };
        });
        updateAxonPlanStep(task.planId, task.planStepId, { status: task.status as AxonPlanStep['status'] });
      }
    }

    // Blocked-by-dependency warnings: surface once per blocked task.
    const blocked = orchestrator.getBlockedByDependencyFailure();
    for (const b of blocked) {
      const key = `blocked-${b.id}`;
      if (publishedRef.current.has(key)) continue;
      publishedRef.current.add(key);
      pushLog(
        'blocked-dependency',
        `Task "${b.label}" cannot run — upstream dependency failed or was cancelled.`,
        { taskId: b.id, tool: b.tool, planId: b.planId },
      );
    }
  }, [tasks, appendAxonRun, addToolRun, pushLog, orchestrator, updateAxonPlanStep]);

  function enqueueInternal(
    opts: AxonEnqueueOptions & {
      planId?: string;
      planStepId?: string;
      dependsOn?: string[];
      meta?: Record<string, unknown>;
    },
  ): AxonTask | null {
    if (!registry.isSupported(opts.tool)) {
      appendConsole({
        level: 'error',
        module: 'axon',
        message: `No adapter registered for "${opts.tool}" — enqueue refused.`,
      });
      pushLog('info', `Enqueue refused — no adapter for "${opts.tool}".`, {
        tool: opts.tool,
        metadata: { reason: 'unsupported' },
      });
      return null;
    }
    const task = orchestrator.enqueue({
      tool: opts.tool,
      label: opts.label,
      input: opts.input,
      planId: opts.planId,
      planStepId: opts.planStepId,
      dependsOn: opts.dependsOn,
      meta: opts.meta,
    });
    appendConsole({
      level: 'info',
      module: 'axon',
      message: `Queued ${opts.tool} task · ${task.id}`,
    });
    pushLog('enqueued', `Queued ${opts.tool.toUpperCase()} — "${opts.label}"`, {
      taskId: task.id,
      tool: opts.tool,
      planId: opts.planId,
      metadata: { dependsOn: task.dependsOn?.length ?? 0 },
    });

    // Only kick off execution when dependencies allow. Otherwise the
    // task sits until an earlier step completes and the next tick of
    // the drain effect picks it up.
    void drainQueue();
    return task;
  }

  const drainingRef = useRef(false);
  async function drainQueue(): Promise<void> {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const peek = orchestrator.peekNextRunnable();
        if (!peek) return;
        pushLog('started', `Started ${peek.tool.toUpperCase()} — "${peek.label}"`, {
          taskId: peek.id,
          tool: peek.tool,
          planId: peek.planId,
        });
        pushLog('adapter-invoked', `Adapter invoked for ${peek.tool.toUpperCase()}.`, {
          taskId: peek.id,
          tool: peek.tool,
          planId: peek.planId,
        });
        const finished = await orchestrator.runNext(adapters);
        if (!finished) return;
        if (finished.status === 'done') {
          appendConsole({
            level: 'success',
            module: 'axon',
            message: `${finished.tool} task complete · ${finished.id}`,
          });
          pushLog('completed', `${finished.tool.toUpperCase()} task complete.`, {
            taskId: finished.id,
            tool: finished.tool,
            planId: finished.planId,
          });
        } else if (finished.status === 'error') {
          appendConsole({
            level: 'error',
            module: 'axon',
            message: `${finished.tool} task failed · ${finished.error ?? 'unknown error'}`,
          });
          pushLog('failed', `${finished.tool.toUpperCase()} task failed: ${finished.error ?? 'unknown error'}`, {
            taskId: finished.id,
            tool: finished.tool,
            planId: finished.planId,
            metadata: { error: finished.error },
          });
        }
      }
    } finally {
      drainingRef.current = false;
    }
  }

  function enqueueAndRun(opts: AxonEnqueueOptions): AxonTask | null {
    return enqueueInternal(opts);
  }

  function planAndRun(opts: AxonPlanAndRunOptions): AxonPlanAndRunResult {
    const plan = buildAxonPlan(opts.request, opts.context, {
      isSupported: (tool) => registry.isSupported(tool),
    });
    setActivePlan(plan);
    setAxonPlanStore({
      id: plan.id,
      createdAt: plan.createdAt,
      origin: plan.origin,
      request: plan.request,
      warnings: plan.warnings,
      depth: plan.depth,
      steps: plan.steps.map((s) => ({
        id: s.id,
        title: s.title,
        tool: s.tool,
        objective: s.objective,
        inputSummary: s.inputSummary,
        expectedOutput: s.expectedOutput,
        dependsOn: s.dependsOn,
        status: s.status,
        reason: s.reason,
        taskId: s.taskId,
      })),
    });
    pushLog(
      'plan-created',
      `Plan created · ${plan.steps.length} step(s)`,
      { planId: plan.id, metadata: { request: plan.request, origin: plan.origin } },
    );
    for (const w of plan.warnings) {
      pushLog('plan-warning', w, { planId: plan.id });
    }

    const enqueuedStepIds: string[] = [];
    const skippedStepIds: string[] = [];
    const stepIdToTaskId = new Map<string, string>();

    for (const step of plan.steps) {
      if (step.status === 'unsupported') {
        skippedStepIds.push(step.id);
        continue;
      }
      // Translate plan-step dependsOn (plan-step ids) into orchestrator
      // task ids, so the scheduler respects the graph we declared.
      const taskDeps = step.dependsOn
        .map((id) => stepIdToTaskId.get(id))
        .filter((id): id is string => Boolean(id));
      const task = enqueueInternal({
        tool: step.tool,
        label: step.title,
        input: buildStepInput(step, opts.context),
        planId: plan.id,
        planStepId: step.id,
        dependsOn: taskDeps,
        meta: { reason: step.reason, objective: step.objective },
      });
      if (task) {
        stepIdToTaskId.set(step.id, task.id);
        enqueuedStepIds.push(step.id);
        step.taskId = task.id;
        step.status = 'enqueued';
        updateAxonPlanStep(plan.id, step.id, { status: 'enqueued', taskId: task.id });
      } else {
        skippedStepIds.push(step.id);
      }
    }

    // Context attachment log is a single event per plan, not per step —
    // the bounded context is the same for every step in this plan.
    pushLog(
      'context-attached',
      `Workbench context attached: ${opts.context.summaryOneLine}`,
      { planId: plan.id, metadata: opts.context.hasContext ? { summary: opts.context.summaryOneLine } : { summary: 'none' } },
    );

    return { plan, enqueuedStepIds, skippedStepIds };
  }

  function cancelTask(id: string) {
    const cancelled = orchestrator.cancel(id);
    if (!cancelled) return;
    pushLog('cancelled', `Cancelled ${cancelled.tool.toUpperCase()} task.`, {
      taskId: cancelled.id,
      tool: cancelled.tool,
      planId: cancelled.planId,
    });
    if (cancelled.planId && cancelled.planStepId) {
      updateAxonPlanStep(cancelled.planId, cancelled.planStepId, { status: 'cancelled' });
      setActivePlan((prev) => {
        if (!prev || prev.id !== cancelled.planId) return prev;
        return {
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === cancelled.planStepId ? { ...s, status: 'cancelled' } : s,
          ),
        };
      });
    }
  }

  function retryTask(id: string) {
    const retried = orchestrator.retry(id);
    if (!retried) return;
    pushLog(
      'retried',
      `Retry ${retried.tool.toUpperCase()} (retryCount=${retried.retryCount}).`,
      { taskId: retried.id, tool: retried.tool, planId: retried.planId },
    );
    if (retried.planId && retried.planStepId) {
      updateAxonPlanStep(retried.planId, retried.planStepId, { status: 'enqueued' });
    }
    // Allow publishTaskOutcome / dep-blocked logs to fire again for this id.
    publishedRef.current.delete(retried.id);
    publishedRef.current.delete(`blocked-${retried.id}`);
    void drainQueue();
  }

  function reorderTask(id: string, newIndex: number): { ok: boolean; reason?: string } {
    const result = orchestrator.reorderPending(id, newIndex);
    if (!result) {
      pushLog('info', `Reorder refused for task ${id} — illegal move or dependency violation.`, {
        taskId: id,
        metadata: { attemptedIndex: newIndex },
      });
      return { ok: false, reason: 'Illegal reorder (not pending, out of range, or violates dependency).' };
    }
    pushLog('reordered', `Reordered ${result.tool.toUpperCase()} task.`, {
      taskId: result.id,
      tool: result.tool,
      planId: result.planId,
      metadata: { newIndex },
    });
    return { ok: true };
  }

  function toggleAgenticMode() {
    setAgenticMode((v) => !v);
  }

  function clearTerminal() {
    orchestrator.clearTerminal();
  }

  const value: AxonOrchestratorContextValue = {
    tasks,
    agenticMode,
    setAgenticMode,
    toggleAgenticMode,
    enqueueAndRun,
    clearTerminal,
    isSupported: (tool) => registry.isSupported(tool),
    registry,
    hadInterruptedTasks,
    logs,
    activePlan,
    planAndRun,
    cancelTask,
    retryTask,
    reorderTask,
    evidenceRegistry,
    autonomy,
  };

  return (
    <AxonOrchestratorContext.Provider value={value}>
      {children}
    </AxonOrchestratorContext.Provider>
  );
}

export function useAxonOrchestrator(): AxonOrchestratorContextValue {
  const ctx = useContext(AxonOrchestratorContext);
  if (!ctx) {
    throw new Error(
      'useAxonOrchestrator must be called inside <AxonOrchestratorProvider>',
    );
  }
  return ctx;
}

/**
 * Non-throwing variant — returns null outside the provider. Useful for
 * components that are optionally hosted outside the /tools/* shell.
 */
export function useAxonOrchestratorOptional(): AxonOrchestratorContextValue | null {
  return useContext(AxonOrchestratorContext);
}

/**
 * Translate a plan step into the adapter input shape it expects. This
 * is deliberately narrow — the planner does not know adapter internals,
 * so we map here. Each branch is dead-simple and auditable.
 */
function buildStepInput(step: AxonPlanStep, context: WorkbenchCopilotContext): unknown {
  if (step.tool === 'pathd') {
    return {
      targetProduct: context.targetProduct ?? 'unspecified',
      hint: step.objective,
    };
  }
  // fbasim
  return {
    species: null,
    objective: null,
    glucoseUptake: null,
    oxygenUptake: null,
    knockouts: [],
    hint: step.objective,
  };
}
