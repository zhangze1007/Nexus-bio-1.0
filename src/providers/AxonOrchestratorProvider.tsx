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
import { useWorkbenchStore } from '../store/workbenchStore';
import { useUIStore } from '../store/uiStore';

export interface AxonEnqueueOptions {
  tool: AxonTool;
  label: string;
  input: unknown;
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
  const hydratedRef = useRef(false);
  const appendConsole = useUIStore((s) => s.appendConsole);
  const appendAxonRun = useWorkbenchStore((s) => s.appendAxonRun);
  const addToolRun = useWorkbenchStore((s) => s.addToolRun);

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
    if (interrupted > 0) setHadInterruptedTasks(true);
  }, [orchestrator, disablePersistence]);

  // Persist on every task mutation.
  useEffect(() => {
    if (disablePersistence) return;
    savePersistedQueue(tasks);
  }, [tasks, disablePersistence]);

  // Writeback — fire when a task newly enters a terminal state.
  const publishedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const task of tasks) {
      if (task.status !== 'done' && task.status !== 'error') continue;
      if (publishedRef.current.has(task.id)) continue;
      publishedRef.current.add(task.id);
      publishTaskOutcome(task, { appendAxonRun, addToolRun });
    }
  }, [tasks, appendAxonRun, addToolRun]);

  function enqueueAndRun(opts: AxonEnqueueOptions): AxonTask | null {
    if (!registry.isSupported(opts.tool)) {
      appendConsole({
        level: 'error',
        module: 'axon',
        message: `No adapter registered for "${opts.tool}" — enqueue refused.`,
      });
      return null;
    }
    const task = orchestrator.enqueue({
      tool: opts.tool,
      label: opts.label,
      input: opts.input,
    });
    appendConsole({
      level: 'info',
      module: 'axon',
      message: `Queued ${opts.tool} task · ${task.id}`,
    });
    void orchestrator.runNext(adapters).then((finished) => {
      if (!finished) return;
      if (finished.status === 'done') {
        appendConsole({
          level: 'success',
          module: 'axon',
          message: `${finished.tool} task complete · ${finished.id}`,
        });
      } else if (finished.status === 'error') {
        appendConsole({
          level: 'error',
          module: 'axon',
          message: `${finished.tool} task failed · ${finished.error ?? 'unknown error'}`,
        });
      }
    });
    return task;
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
