/**
 * axonSessionView — PR-5 session model derived from PR-4 state.
 *
 * This module does NOT introduce a new orchestration path. It is a pure
 * derivation layer: given the active plan + task list + log (already
 * owned by AxonOrchestratorProvider), it projects one consistent
 * session object that the UI can render as a real agent run.
 *
 * The rules below exist so the session view cannot lie:
 *
 *   • Every step card is bound to an actual plan step OR an actual log
 *     event. We never synthesise "thinking…" or "searching…" cards.
 *   • Every preview is bound to the data that exists right now — the
 *     plan input summary, the task result preview, the evidence
 *     registry snapshot, the writeback log entry. If nothing grounded
 *     is available, the preview is the explicit `unavailable` shape.
 *   • Status is copied from orchestrator state; we do not re-interpret
 *     running/blocked/cancelled/unsupported.
 *   • Cancelled / failed / interrupted / unsupported remain distinct in
 *     the output.
 *
 * The domain classification from `axonDomainClassifier` is folded in
 * here so the session object explicitly exposes whether the current
 * request is in-domain for agentic routing. Off-domain sessions carry
 * a single "off-domain" advisory step and no plan execution.
 */

import type { AxonTask, AxonTaskStatus } from './AxonOrchestrator';
import type { AxonPlan, AxonPlanStep, AxonPlanStepStatus } from './axonPlanner';
import type { AxonLogEntry, AxonLogPhase } from './axonExecutionLog';
import type { AxonDomainClassification } from './axonDomainClassifier';
import type { EvidenceAdapterRegistry } from './axonEvidenceAdapter';

export type AxonSessionStatus =
  | 'idle'
  | 'planning'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled'
  | 'interrupted'
  | 'off-domain'
  | 'unsupported';

export type AxonSessionStepKind =
  | 'classification'
  | 'planning'
  | 'context-attached'
  | 'evidence-check'
  | 'plan-step'
  | 'unsupported-step'
  | 'off-domain-advisory'
  | 'writeback'
  | 'interrupted'
  | 'blocked-dependency';

export type AxonSessionStepStatus =
  | 'planned'
  | 'running'
  | 'waiting'
  | 'done'
  | 'failed'
  | 'cancelled'
  | 'unsupported'
  | 'blocked'
  | 'interrupted'
  | 'info';

/**
 * Preview shapes. Each is `null`able. Renderers switch on `kind` and
 * gracefully handle missing fields.
 */
export interface AxonPlannerPreview {
  kind: 'planner';
  stepCount: number;
  toolChain: string;
  warnings: string[];
  request: string;
}

export interface AxonEvidencePreview {
  kind: 'evidence';
  sourcesAvailable: string[];
  sourcesUnimplemented: string[];
  savedEvidenceCount: number;
  note: string;
}

export interface AxonContextPreview {
  kind: 'context';
  targetProduct: string | null;
  evidenceSelected: number;
  evidenceTotal: number;
  currentTool: string | null;
  summary: string;
}

export interface AxonMetadataPreview {
  kind: 'metadata';
  entries: Array<{ label: string; value: string }>;
}

export interface AxonResultPreview {
  kind: 'result';
  tool: string;
  summary: string;
  entries: Array<{ label: string; value: string }>;
}

export interface AxonWritebackPreview {
  kind: 'writeback';
  tool: string;
  status: 'done' | 'error';
  summary: string;
}

export interface AxonOffDomainPreview {
  kind: 'off-domain';
  reason: string;
  signals: string[];
  category: AxonDomainClassification['category'];
}

export interface AxonUnavailablePreview {
  kind: 'unavailable';
  reason: string;
}

export type AxonSessionPreview =
  | AxonPlannerPreview
  | AxonEvidencePreview
  | AxonContextPreview
  | AxonMetadataPreview
  | AxonResultPreview
  | AxonWritebackPreview
  | AxonOffDomainPreview
  | AxonUnavailablePreview;

export interface AxonSessionStep {
  id: string;
  kind: AxonSessionStepKind;
  title: string;
  status: AxonSessionStepStatus;
  /** Free-text describing what this step is, grounded in real data. */
  detail: string;
  /** Plan-step id when this card is bound to a planner step. */
  planStepId?: string;
  /** Orchestrator task id when this card is bound to a queue task. */
  taskId?: string;
  tool?: string;
  startedAt?: number;
  finishedAt?: number;
  preview: AxonSessionPreview;
  /** Optional compact log trail for this card — only real log entries. */
  logs: AxonLogEntry[];
}

export interface AxonSessionOutcome {
  completed: number;
  failed: number;
  cancelled: number;
  unsupported: number;
  blocked: number;
  interrupted: number;
  writebackCount: number;
  userActionNeeded: boolean;
  /** One-line summary safe to render directly. */
  headline: string;
}

export interface AxonSession {
  id: string;
  title: string;
  status: AxonSessionStatus;
  request: string | null;
  domain: AxonDomainClassification | null;
  plan: AxonPlan | null;
  startedAt: number | null;
  lastActivityAt: number | null;
  currentStepId: string | null;
  steps: AxonSessionStep[];
  outcome: AxonSessionOutcome;
}

export interface BuildSessionInput {
  plan: AxonPlan | null;
  tasks: AxonTask[];
  logs: AxonLogEntry[];
  domain: AxonDomainClassification | null;
  evidenceRegistry?: Pick<EvidenceAdapterRegistry, 'list'> | null;
  evidenceSavedCount?: number;
  currentToolId?: string | null;
  hadInterruptedTasks?: boolean;
  /** Optional compact context snapshot — target product + evidence counts. */
  context?: {
    targetProduct: string | null;
    evidenceTotal: number;
    evidenceSelected: number;
    summary: string;
  } | null;
  now?: () => number;
}

// ── Small helpers ────────────────────────────────────────────────────

const TASK_STATUS_TO_STEP: Record<AxonTaskStatus, AxonSessionStepStatus> = {
  pending: 'waiting',
  running: 'running',
  done: 'done',
  error: 'failed',
  cancelled: 'cancelled',
};

const PLAN_STATUS_TO_STEP: Record<AxonPlanStepStatus, AxonSessionStepStatus> = {
  planned: 'planned',
  enqueued: 'waiting',
  running: 'running',
  done: 'done',
  error: 'failed',
  cancelled: 'cancelled',
  unsupported: 'unsupported',
};

function logsForPlan(planId: string | null, logs: AxonLogEntry[]): AxonLogEntry[] {
  if (!planId) return [];
  return logs.filter((l) => l.planId === planId);
}

function logsForTask(taskId: string | null | undefined, logs: AxonLogEntry[]): AxonLogEntry[] {
  if (!taskId) return [];
  return logs.filter((l) => l.taskId === taskId);
}

function buildResultPreview(task: AxonTask): AxonResultPreview | AxonUnavailablePreview {
  if (task.status !== 'done' || !task.result || typeof task.result !== 'object') {
    if (task.status === 'error') {
      return {
        kind: 'unavailable',
        reason: task.error ?? 'Task failed — no result available',
      };
    }
    return {
      kind: 'unavailable',
      reason: 'No result captured for this step yet',
    };
  }
  const r = task.result as Record<string, unknown>;
  const entries: Array<{ label: string; value: string }> = [];
  if (task.tool === 'pathd') {
    if (typeof r.nodeCount === 'number') entries.push({ label: 'Nodes', value: String(r.nodeCount) });
    if (typeof r.bottleneckCount === 'number') {
      entries.push({ label: 'Bottlenecks', value: String(r.bottleneckCount) });
    }
    if (typeof r.provider === 'string') entries.push({ label: 'Provider', value: r.provider });
  } else if (task.tool === 'fbasim') {
    if (typeof r.species === 'string') entries.push({ label: 'Species', value: r.species });
    if (typeof r.objective === 'string') entries.push({ label: 'Objective', value: r.objective });
    if (typeof r.objectiveValue === 'number') {
      entries.push({ label: 'Objective value', value: r.objectiveValue.toFixed(3) });
    }
    if (typeof r.fluxCount === 'number') entries.push({ label: 'Flux rows', value: String(r.fluxCount) });
  } else {
    for (const [k, v] of Object.entries(r)) {
      if (entries.length >= 4) break;
      if (typeof v === 'string' && v.length <= 60) entries.push({ label: k, value: v });
      else if (typeof v === 'number') entries.push({ label: k, value: String(v) });
      else if (typeof v === 'boolean') entries.push({ label: k, value: v ? 'yes' : 'no' });
    }
  }

  const summary = entries.length > 0
    ? entries.slice(0, 3).map((e) => `${e.label}: ${e.value}`).join(' · ')
    : `${task.tool.toUpperCase()} complete`;
  return { kind: 'result', tool: task.tool, summary, entries };
}

function buildMetadataPreview(logs: AxonLogEntry[]): AxonMetadataPreview | AxonUnavailablePreview {
  const withMeta = logs.find((l) => l.metadata && Object.keys(l.metadata).length > 0);
  if (!withMeta || !withMeta.metadata) {
    return { kind: 'unavailable', reason: 'No metadata recorded for this step' };
  }
  const entries: Array<{ label: string; value: string }> = [];
  for (const [k, v] of Object.entries(withMeta.metadata)) {
    if (entries.length >= 6) break;
    entries.push({ label: k, value: typeof v === 'string' ? v : JSON.stringify(v) });
  }
  return { kind: 'metadata', entries };
}

function evidencePreview(
  registry: BuildSessionInput['evidenceRegistry'],
  savedCount: number,
): AxonEvidencePreview {
  const available: string[] = [];
  const unimplemented: string[] = [];
  if (registry) {
    for (const adapter of registry.list()) {
      if (adapter.status === 'available') available.push(adapter.label);
      else unimplemented.push(adapter.label);
    }
  } else {
    available.push('Workbench evidence ledger');
  }
  const note = available.length === 0
    ? 'No evidence adapters registered.'
    : unimplemented.length === 0
      ? 'All registered evidence adapters are wired.'
      : `${available.length} adapter(s) wired, ${unimplemented.length} marked as extension seams.`;
  return {
    kind: 'evidence',
    sourcesAvailable: available,
    sourcesUnimplemented: unimplemented,
    savedEvidenceCount: savedCount,
    note,
  };
}

function contextPreview(ctx: BuildSessionInput['context'], currentTool: string | null): AxonContextPreview {
  return {
    kind: 'context',
    targetProduct: ctx?.targetProduct ?? null,
    evidenceSelected: ctx?.evidenceSelected ?? 0,
    evidenceTotal: ctx?.evidenceTotal ?? 0,
    currentTool,
    summary: ctx?.summary ?? 'No active workbench context',
  };
}

function shortenRequest(request: string, max = 96): string {
  if (request.length <= max) return request;
  return `${request.slice(0, max - 1).trimEnd()}…`;
}

// ── Step builders ────────────────────────────────────────────────────

function classificationStep(domain: AxonDomainClassification): AxonSessionStep {
  const isOff = domain.category === 'off-domain';
  const isAmbiguous = domain.category === 'ambiguous';
  return {
    id: 'step-classification',
    kind: 'classification',
    title: 'Classified request domain',
    status: 'done',
    detail: domain.reason,
    preview: {
      kind: 'metadata',
      entries: [
        { label: 'Category', value: domain.category },
        { label: 'Signals', value: domain.signals.slice(0, 4).join(', ') || '—' },
        { label: 'Plan', value: domain.shouldPlan ? 'eligible' : 'not eligible' },
      ],
    },
    logs: [],
    ...(isOff ? { tool: undefined } : {}),
    ...(isAmbiguous ? { tool: undefined } : {}),
  };
}

function offDomainAdvisoryStep(domain: AxonDomainClassification): AxonSessionStep {
  return {
    id: 'step-off-domain',
    kind: 'off-domain-advisory',
    title: 'Query routed outside Nexus-Bio scope',
    status: 'info',
    detail:
      'This request does not map to a Nexus-Bio scientific tool. The planner is not run and no biosynthesis prompt is invoked.',
    preview: {
      kind: 'off-domain',
      reason: domain.reason,
      signals: domain.signals,
      category: domain.category,
    },
    logs: [],
  };
}

function planningStep(plan: AxonPlan, logs: AxonLogEntry[]): AxonSessionStep {
  const planLogs = logsForPlan(plan.id, logs);
  return {
    id: `step-planning-${plan.id}`,
    kind: 'planning',
    title: 'Built deterministic plan',
    status: 'done',
    detail:
      plan.steps.length === 0
        ? 'Planner returned no actionable steps — warning recorded.'
        : `Planner proposed ${plan.steps.length} step(s): ${plan.steps.map((s) => s.tool).join(' → ')}`,
    planStepId: undefined,
    startedAt: plan.createdAt,
    preview: {
      kind: 'planner',
      stepCount: plan.steps.length,
      toolChain: plan.steps.map((s) => s.tool.toUpperCase()).join(' → ') || '—',
      warnings: plan.warnings,
      request: shortenRequest(plan.request),
    },
    logs: planLogs.filter((l) => l.phase === 'plan-created' || l.phase === 'plan-warning'),
  };
}

function contextStep(
  plan: AxonPlan,
  logs: AxonLogEntry[],
  ctx: BuildSessionInput['context'],
  currentTool: string | null,
): AxonSessionStep {
  const planLogs = logsForPlan(plan.id, logs);
  const contextLog = planLogs.find((l) => l.phase === 'context-attached');
  return {
    id: `step-context-${plan.id}`,
    kind: 'context-attached',
    title: 'Attached workbench context',
    status: contextLog ? 'done' : 'planned',
    detail: ctx?.summary ?? 'No active workbench context',
    startedAt: contextLog?.timestamp,
    preview: contextPreview(ctx, currentTool),
    logs: contextLog ? [contextLog] : [],
  };
}

function evidenceStep(
  registry: BuildSessionInput['evidenceRegistry'],
  savedCount: number,
): AxonSessionStep {
  return {
    id: 'step-evidence-check',
    kind: 'evidence-check',
    title: 'Checked evidence adapters',
    status: 'done',
    detail: `Workbench evidence ledger holds ${savedCount} saved item(s); literature adapter seams listed as not wired.`,
    preview: evidencePreview(registry, savedCount),
    logs: [],
  };
}

function planStepCard(
  step: AxonPlanStep,
  plan: AxonPlan,
  tasks: AxonTask[],
  logs: AxonLogEntry[],
): AxonSessionStep {
  const task = step.taskId ? tasks.find((t) => t.id === step.taskId) : undefined;
  const status = step.status === 'unsupported'
    ? 'unsupported'
    : task
      ? TASK_STATUS_TO_STEP[task.status]
      : PLAN_STATUS_TO_STEP[step.status];
  const tool = step.tool;
  const taskLogs = task ? logsForTask(task.id, logs) : logsForPlan(plan.id, logs).filter((l) => !l.taskId);

  let preview: AxonSessionPreview;
  if (step.status === 'unsupported') {
    preview = {
      kind: 'metadata',
      entries: [
        { label: 'Tool', value: step.tool },
        { label: 'Reason', value: 'No adapter registered for this tool' },
        { label: 'Objective', value: step.objective },
      ],
    };
  } else if (task && task.status === 'done') {
    preview = buildResultPreview(task);
  } else if (task && task.status === 'error') {
    preview = { kind: 'unavailable', reason: task.error ?? 'Task failed' };
  } else if (task && task.status === 'cancelled') {
    preview = { kind: 'unavailable', reason: 'Task cancelled before completion' };
  } else {
    preview = buildMetadataPreview(taskLogs);
  }

  return {
    id: `step-plan-${step.id}`,
    kind: step.status === 'unsupported' ? 'unsupported-step' : 'plan-step',
    title: step.title,
    status,
    detail: step.objective,
    planStepId: step.id,
    taskId: task?.id,
    tool,
    startedAt: task?.startedAt,
    finishedAt: task?.finishedAt,
    preview,
    logs: taskLogs.slice(0, 8),
  };
}

function interruptedStep(logs: AxonLogEntry[]): AxonSessionStep | null {
  const interruptedLog = logs.find((l) => l.phase === 'interrupted');
  if (!interruptedLog) return null;
  return {
    id: `step-interrupted-${interruptedLog.id}`,
    kind: 'interrupted',
    title: 'Session interrupted',
    status: 'interrupted',
    detail: interruptedLog.message,
    preview: {
      kind: 'metadata',
      entries: Object.entries(interruptedLog.metadata ?? { note: 'previous session ended mid-run' })
        .slice(0, 4)
        .map(([k, v]) => ({ label: k, value: typeof v === 'string' ? v : JSON.stringify(v) })),
    },
    logs: [interruptedLog],
    startedAt: interruptedLog.timestamp,
  };
}

function blockedDependencyStep(logs: AxonLogEntry[], tasks: AxonTask[]): AxonSessionStep[] {
  const blockedLogs = logs.filter((l) => l.phase === 'blocked-dependency');
  return blockedLogs.map((log) => {
    const task = log.taskId ? tasks.find((t) => t.id === log.taskId) : undefined;
    return {
      id: `step-blocked-${log.id}`,
      kind: 'blocked-dependency',
      title: 'Downstream step blocked',
      status: 'blocked',
      detail: log.message,
      taskId: log.taskId,
      tool: log.tool,
      startedAt: log.timestamp,
      preview: {
        kind: 'metadata',
        entries: [
          { label: 'Task', value: task?.label ?? log.taskId ?? '—' },
          { label: 'Reason', value: 'Upstream step failed or was cancelled' },
        ],
      },
      logs: [log],
    };
  });
}

function writebackStep(logs: AxonLogEntry[], tasks: AxonTask[]): AxonSessionStep[] {
  const writebackLogs = logs.filter((l) => l.phase === 'writeback-emitted');
  return writebackLogs.map((log) => {
    const task = log.taskId ? tasks.find((t) => t.id === log.taskId) : undefined;
    const meta = log.metadata ?? {};
    const status = (typeof meta.status === 'string' && meta.status === 'error' ? 'error' : 'done') as 'done' | 'error';
    return {
      id: `step-writeback-${log.id}`,
      kind: 'writeback',
      title: `Writeback · ${log.tool?.toUpperCase() ?? 'AXON'}`,
      status: status === 'done' ? 'done' : 'failed',
      detail: log.message,
      taskId: log.taskId,
      tool: log.tool,
      startedAt: log.timestamp,
      preview: {
        kind: 'writeback',
        tool: log.tool ?? 'axon',
        status,
        summary: task ? task.label : log.message,
      },
      logs: [log],
    };
  });
}

// ── Public derivation ────────────────────────────────────────────────

function deriveStatus(params: {
  domain: AxonDomainClassification | null;
  plan: AxonPlan | null;
  tasks: AxonTask[];
  interrupted: boolean;
}): AxonSessionStatus {
  const { domain, plan, tasks, interrupted } = params;
  if (interrupted) return 'interrupted';
  if (domain && domain.category === 'off-domain') return 'off-domain';
  if (!plan) return 'idle';
  if (plan.steps.length === 0) return 'unsupported';
  const supportedSteps = plan.steps.filter((s) => s.status !== 'unsupported');
  if (supportedSteps.length === 0) return 'unsupported';
  const planSupportedTaskIds = new Set(
    supportedSteps.map((s) => s.taskId).filter((id): id is string => Boolean(id)),
  );
  const planTasks = tasks.filter((t) => planSupportedTaskIds.has(t.id));
  const anyRunning = planTasks.some((t) => t.status === 'running');
  if (anyRunning) return 'running';
  const anyPending = planTasks.some((t) => t.status === 'pending');
  if (anyPending) return 'waiting';
  if (planTasks.length === 0) return 'planning';
  const anyError = planTasks.some((t) => t.status === 'error');
  const anyCancelled = planTasks.some((t) => t.status === 'cancelled');
  const allDone = planTasks.every((t) => t.status === 'done');
  if (allDone) return 'completed';
  if (anyError && planTasks.some((t) => t.status === 'done')) return 'partial';
  if (anyError) return 'failed';
  if (anyCancelled) return 'cancelled';
  return 'waiting';
}

function deriveOutcome(steps: AxonSessionStep[]): AxonSessionOutcome {
  let completed = 0;
  let failed = 0;
  let cancelled = 0;
  let unsupported = 0;
  let blocked = 0;
  let interrupted = 0;
  let writebackCount = 0;
  for (const step of steps) {
    if (step.kind === 'plan-step' || step.kind === 'unsupported-step') {
      if (step.status === 'done') completed += 1;
      else if (step.status === 'failed') failed += 1;
      else if (step.status === 'cancelled') cancelled += 1;
      else if (step.status === 'unsupported') unsupported += 1;
      else if (step.status === 'blocked') blocked += 1;
    }
    if (step.kind === 'blocked-dependency') blocked += 1;
    if (step.kind === 'interrupted') interrupted += 1;
    if (step.kind === 'writeback') writebackCount += 1;
  }
  const userActionNeeded = failed > 0 || cancelled > 0 || blocked > 0 || interrupted > 0;
  const parts: string[] = [];
  if (completed) parts.push(`${completed} completed`);
  if (failed) parts.push(`${failed} failed`);
  if (cancelled) parts.push(`${cancelled} cancelled`);
  if (unsupported) parts.push(`${unsupported} unsupported`);
  if (blocked) parts.push(`${blocked} blocked`);
  if (interrupted) parts.push(`${interrupted} interrupted`);
  if (writebackCount) parts.push(`${writebackCount} writeback`);
  const headline = parts.length === 0 ? 'No steps executed yet.' : parts.join(' · ');
  return {
    completed,
    failed,
    cancelled,
    unsupported,
    blocked,
    interrupted,
    writebackCount,
    userActionNeeded,
    headline,
  };
}

function deriveCurrentStepId(steps: AxonSessionStep[]): string | null {
  const running = steps.find((s) => s.status === 'running');
  if (running) return running.id;
  const waiting = steps.find((s) => s.status === 'waiting');
  if (waiting) return waiting.id;
  const blocked = steps.find((s) => s.status === 'blocked');
  if (blocked) return blocked.id;
  // Done — pick last step.
  return steps.length > 0 ? steps[steps.length - 1].id : null;
}

function buildTitle(
  plan: AxonPlan | null,
  domain: AxonDomainClassification | null,
  request: string | null,
): string {
  if (domain && domain.category === 'off-domain') return 'Off-domain request · no plan';
  if (plan && plan.steps.length > 0) {
    return `Session · ${plan.steps.map((s) => s.tool.toUpperCase()).join(' → ')}`;
  }
  if (plan) return 'Session · planner returned no steps';
  if (request) return 'Session · awaiting plan';
  return 'Session · idle';
}

export function buildAxonSession(input: BuildSessionInput): AxonSession {
  const {
    plan,
    tasks,
    logs,
    domain,
    evidenceRegistry,
    evidenceSavedCount = 0,
    currentToolId = null,
    hadInterruptedTasks = false,
    context = null,
    now = Date.now,
  } = input;

  const steps: AxonSessionStep[] = [];

  if (domain) {
    steps.push(classificationStep(domain));
    if (domain.category === 'off-domain') {
      steps.push(offDomainAdvisoryStep(domain));
    }
  }

  const interruptedCard = hadInterruptedTasks ? interruptedStep(logs) : null;
  if (interruptedCard) steps.push(interruptedCard);

  if (plan && (!domain || domain.category !== 'off-domain')) {
    steps.push(planningStep(plan, logs));
    steps.push(contextStep(plan, logs, context, currentToolId));
    steps.push(evidenceStep(evidenceRegistry ?? null, evidenceSavedCount));
    for (const step of plan.steps) {
      steps.push(planStepCard(step, plan, tasks, logs));
    }
  }

  // Orphan tasks (no plan link) — surface them honestly, not hidden.
  const linkedTaskIds = new Set(
    plan?.steps.map((s) => s.taskId).filter((id): id is string => Boolean(id)) ?? [],
  );
  for (const task of tasks) {
    if (linkedTaskIds.has(task.id)) continue;
    if (task.status === 'running' || task.status === 'pending' || task.status === 'done' || task.status === 'error' || task.status === 'cancelled') {
      steps.push({
        id: `step-task-${task.id}`,
        kind: 'plan-step',
        title: task.label,
        status: TASK_STATUS_TO_STEP[task.status],
        detail: `Ad-hoc ${task.tool.toUpperCase()} task`,
        taskId: task.id,
        tool: task.tool,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt,
        preview: task.status === 'done' ? buildResultPreview(task) : buildMetadataPreview(logsForTask(task.id, logs)),
        logs: logsForTask(task.id, logs).slice(0, 8),
      });
    }
  }

  for (const blocked of blockedDependencyStep(logs, tasks)) steps.push(blocked);
  for (const wb of writebackStep(logs, tasks)) steps.push(wb);

  const status = deriveStatus({
    domain,
    plan,
    tasks,
    interrupted: hadInterruptedTasks,
  });
  const outcome = deriveOutcome(steps);
  const startedAt = plan?.createdAt ?? (tasks[0]?.createdAt ?? null);
  const lastActivityAt = logs[0]?.timestamp ?? startedAt ?? now();

  return {
    id: plan?.id ?? (domain ? `session-domain-${domain.category}` : 'session-idle'),
    title: buildTitle(plan, domain, input.context?.summary ?? null),
    status,
    request: plan?.request ?? null,
    domain,
    plan,
    startedAt,
    lastActivityAt,
    currentStepId: deriveCurrentStepId(steps),
    steps,
    outcome,
  };
}

/**
 * Short label for the session status chip.
 */
export function sessionStatusLabel(status: AxonSessionStatus): string {
  switch (status) {
    case 'idle': return 'Idle';
    case 'planning': return 'Planning';
    case 'running': return 'Running';
    case 'waiting': return 'Waiting';
    case 'completed': return 'Completed';
    case 'partial': return 'Partial';
    case 'failed': return 'Failed';
    case 'cancelled': return 'Cancelled';
    case 'interrupted': return 'Interrupted';
    case 'off-domain': return 'Off-domain';
    case 'unsupported': return 'Unsupported';
  }
}

export function sessionStepStatusLabel(status: AxonSessionStepStatus): string {
  switch (status) {
    case 'planned': return 'Planned';
    case 'running': return 'Running';
    case 'waiting': return 'Waiting';
    case 'done': return 'Done';
    case 'failed': return 'Failed';
    case 'cancelled': return 'Cancelled';
    case 'unsupported': return 'Unsupported';
    case 'blocked': return 'Blocked';
    case 'interrupted': return 'Interrupted';
    case 'info': return 'Info';
  }
}

// Re-export so consumers can get the log phase tone without re-importing
// from the execution-log module (the session viewer uses both).
export type { AxonLogPhase };
