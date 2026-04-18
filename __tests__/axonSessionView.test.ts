/** @jest-environment node */
/**
 * axonSessionView — PR-5 session derivation.
 *
 * These tests pin the pure `buildAxonSession` projection so the UI can
 * never drift ahead of real orchestrator state. The invariants covered:
 *
 *   • No plan + no domain → idle, no steps.
 *   • Off-domain → exactly classification + advisory, no plan execution.
 *   • Plan statuses are copied verbatim from task statuses — completed,
 *     partial, failed, cancelled stay distinct.
 *   • Unsupported plan steps surface as their own card kind.
 *   • Writeback and blocked-dependency logs become dedicated cards.
 *   • Interrupted flag adds an interrupted step.
 *   • currentStepId prefers running > waiting > blocked > last.
 *   • Outcome headline is the honest concatenation of step counts.
 */
import { buildAxonSession } from '../src/services/axonSessionView';
import type { AxonSessionStep } from '../src/services/axonSessionView';
import type { AxonPlan, AxonPlanStep, AxonPlanStepStatus } from '../src/services/axonPlanner';
import type { AxonTask, AxonTaskStatus, AxonTool } from '../src/services/AxonOrchestrator';
import type { AxonLogEntry, AxonLogPhase } from '../src/services/axonExecutionLog';
import type { AxonDomainClassification } from '../src/services/axonDomainClassifier';

// ── Fixture helpers ──────────────────────────────────────────────────

let __id = 0;
const nextId = (prefix: string) => `${prefix}-${++__id}`;

function makeDomain(
  category: AxonDomainClassification['category'],
  overrides: Partial<AxonDomainClassification> = {},
): AxonDomainClassification {
  const base: AxonDomainClassification = {
    category,
    shouldPlan: category === 'scientific-pathway',
    allowBiosynthesisPrompt: category === 'scientific-pathway',
    allowProseAnswer: category !== 'off-domain' && category !== 'general-knowledge',
    signals: ['seed'],
    reason: `classified as ${category}`,
  };
  return { ...base, ...overrides };
}

function makePlanStep(overrides: Partial<AxonPlanStep> = {}): AxonPlanStep {
  return {
    id: overrides.id ?? nextId('ps'),
    title: overrides.title ?? 'Design pathway',
    tool: (overrides.tool ?? 'pathd') as AxonTool,
    objective: overrides.objective ?? 'Propose a pathway',
    inputSummary: overrides.inputSummary ?? 'target=artemisinin',
    expectedOutput: overrides.expectedOutput ?? 'Pathway graph',
    dependsOn: overrides.dependsOn ?? [],
    status: (overrides.status ?? 'planned') as AxonPlanStepStatus,
    reason: overrides.reason ?? 'pathway keyword',
    taskId: overrides.taskId,
  };
}

function makePlan(steps: AxonPlanStep[], overrides: Partial<AxonPlan> = {}): AxonPlan {
  return {
    id: overrides.id ?? nextId('plan'),
    createdAt: overrides.createdAt ?? 1_700_000_000_000,
    origin: overrides.origin ?? 'user',
    request: overrides.request ?? 'Design a biosynthesis pathway for artemisinin',
    steps,
    warnings: overrides.warnings ?? [],
    depth: overrides.depth ?? 0,
  };
}

function makeTask(overrides: Partial<AxonTask> = {}): AxonTask {
  return {
    id: overrides.id ?? nextId('t'),
    tool: (overrides.tool ?? 'pathd') as AxonTool,
    label: overrides.label ?? 'Design pathway for artemisinin',
    input: overrides.input ?? { query: 'artemisinin' },
    status: (overrides.status ?? 'pending') as AxonTaskStatus,
    result: overrides.result,
    error: overrides.error,
    retryCount: overrides.retryCount ?? 0,
    maxRetries: overrides.maxRetries ?? 0,
    createdAt: overrides.createdAt ?? 1_700_000_000_000,
    startedAt: overrides.startedAt,
    finishedAt: overrides.finishedAt,
    planId: overrides.planId,
    planStepId: overrides.planStepId,
    dependsOn: overrides.dependsOn,
    meta: overrides.meta,
  };
}

function makeLog(overrides: Partial<AxonLogEntry> & { phase: AxonLogPhase }): AxonLogEntry {
  return {
    id: overrides.id ?? nextId('log'),
    timestamp: overrides.timestamp ?? 1_700_000_000_500,
    phase: overrides.phase,
    message: overrides.message ?? 'log',
    taskId: overrides.taskId,
    planId: overrides.planId,
    tool: overrides.tool,
    metadata: overrides.metadata,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('buildAxonSession', () => {
  beforeEach(() => {
    __id = 0;
  });

  it('returns an idle session when there is no plan and no domain', () => {
    const s = buildAxonSession({
      plan: null,
      tasks: [],
      logs: [],
      domain: null,
    });
    expect(s.status).toBe('idle');
    expect(s.steps).toHaveLength(0);
    expect(s.plan).toBeNull();
    expect(s.domain).toBeNull();
    expect(s.outcome.headline).toMatch(/no steps/i);
    expect(s.currentStepId).toBeNull();
  });

  it('off-domain classification produces exactly classification + advisory, no plan execution', () => {
    const s = buildAxonSession({
      plan: null,
      tasks: [],
      logs: [],
      domain: makeDomain('off-domain', {
        signals: ['donald trump'],
        reason: 'matched off-domain keywords',
      }),
    });
    expect(s.status).toBe('off-domain');
    expect(s.steps).toHaveLength(2);
    expect(s.steps[0].kind).toBe('classification');
    expect(s.steps[1].kind).toBe('off-domain-advisory');
    expect(s.steps[1].preview.kind).toBe('off-domain');
    // No plan-step cards whatsoever for off-domain.
    expect(s.steps.some((st) => st.kind === 'plan-step')).toBe(false);
  });

  it('off-domain ignores any plan that might still be lingering in state', () => {
    // Defensive: a stale plan should NOT produce plan-step cards for an
    // off-domain classification — this is the honesty-gate invariant.
    const step = makePlanStep();
    const plan = makePlan([step]);
    const s = buildAxonSession({
      plan,
      tasks: [],
      logs: [],
      domain: makeDomain('off-domain'),
    });
    expect(s.status).toBe('off-domain');
    expect(s.steps.some((st) => st.kind === 'plan-step')).toBe(false);
    expect(s.steps.some((st) => st.kind === 'planning')).toBe(false);
  });

  it('scientific-pathway plan with all tasks done → completed, headline counts completions', () => {
    const ps1 = makePlanStep({ id: 'ps-1', tool: 'pathd', status: 'done', taskId: 't-1' });
    const ps2 = makePlanStep({
      id: 'ps-2',
      tool: 'fbasim',
      title: 'Run FBA',
      status: 'done',
      taskId: 't-2',
      dependsOn: ['ps-1'],
    });
    const plan = makePlan([ps1, ps2]);
    const tasks: AxonTask[] = [
      makeTask({
        id: 't-1',
        tool: 'pathd',
        status: 'done',
        result: { nodeCount: 7, bottleneckCount: 2, provider: 'groq' },
        planId: plan.id,
        planStepId: 'ps-1',
      }),
      makeTask({
        id: 't-2',
        tool: 'fbasim',
        status: 'done',
        result: { species: 'E.coli', objective: 'biomass', objectiveValue: 0.873, fluxCount: 95 },
        planId: plan.id,
        planStepId: 'ps-2',
      }),
    ];
    const s = buildAxonSession({
      plan,
      tasks,
      logs: [],
      domain: makeDomain('scientific-pathway'),
    });
    expect(s.status).toBe('completed');
    const planSteps = s.steps.filter((st) => st.kind === 'plan-step');
    expect(planSteps).toHaveLength(2);
    expect(planSteps.map((st) => st.taskId)).toEqual(['t-1', 't-2']);
    expect(planSteps.map((st) => st.status)).toEqual(['done', 'done']);
    expect(s.outcome.completed).toBe(2);
    expect(s.outcome.failed).toBe(0);
    expect(s.outcome.headline).toMatch(/2 completed/);
    // Result preview shape for the pathd step.
    const pathdCard = planSteps[0];
    expect(pathdCard.preview.kind).toBe('result');
    if (pathdCard.preview.kind === 'result') {
      expect(pathdCard.preview.tool).toBe('pathd');
    }
  });

  it('mixed done + failed tasks → partial status, headline reports both', () => {
    const ps1 = makePlanStep({ id: 'ps-1', tool: 'pathd', status: 'done', taskId: 't-1' });
    const ps2 = makePlanStep({
      id: 'ps-2',
      tool: 'fbasim',
      status: 'error',
      taskId: 't-2',
      dependsOn: ['ps-1'],
    });
    const plan = makePlan([ps1, ps2]);
    const tasks: AxonTask[] = [
      makeTask({ id: 't-1', tool: 'pathd', status: 'done', result: { nodeCount: 4 }, planId: plan.id }),
      makeTask({
        id: 't-2',
        tool: 'fbasim',
        status: 'error',
        error: 'Solver diverged',
        planId: plan.id,
      }),
    ];
    const s = buildAxonSession({
      plan,
      tasks,
      logs: [],
      domain: makeDomain('scientific-pathway'),
    });
    expect(s.status).toBe('partial');
    expect(s.outcome.completed).toBe(1);
    expect(s.outcome.failed).toBe(1);
    expect(s.outcome.headline).toMatch(/1 completed/);
    expect(s.outcome.headline).toMatch(/1 failed/);
    expect(s.outcome.userActionNeeded).toBe(true);
    const failedCard = s.steps.find((st) => st.kind === 'plan-step' && st.taskId === 't-2');
    expect(failedCard?.status).toBe('failed');
    expect(failedCard?.preview.kind).toBe('unavailable');
    if (failedCard?.preview.kind === 'unavailable') {
      expect(failedCard.preview.reason).toBe('Solver diverged');
    }
  });

  it('all tasks cancelled → status cancelled, cancelled cards distinct from failed', () => {
    const ps1 = makePlanStep({ id: 'ps-1', tool: 'pathd', status: 'cancelled', taskId: 't-1' });
    const ps2 = makePlanStep({ id: 'ps-2', tool: 'fbasim', status: 'cancelled', taskId: 't-2' });
    const plan = makePlan([ps1, ps2]);
    const tasks: AxonTask[] = [
      makeTask({ id: 't-1', tool: 'pathd', status: 'cancelled', planId: plan.id }),
      makeTask({ id: 't-2', tool: 'fbasim', status: 'cancelled', planId: plan.id }),
    ];
    const s = buildAxonSession({
      plan,
      tasks,
      logs: [],
      domain: makeDomain('scientific-pathway'),
    });
    expect(s.status).toBe('cancelled');
    expect(s.outcome.cancelled).toBe(2);
    expect(s.outcome.failed).toBe(0);
    expect(s.outcome.userActionNeeded).toBe(true);
    const cancelledCards = s.steps.filter((st) => st.kind === 'plan-step');
    for (const c of cancelledCards) {
      expect(c.status).toBe('cancelled');
      expect(c.preview.kind).toBe('unavailable');
    }
  });

  it('unsupported plan steps surface as their own card kind and session status', () => {
    // When all plan steps are unsupported, deriveStatus returns 'unsupported'.
    const ps = makePlanStep({
      id: 'ps-x',
      tool: 'pathd',
      status: 'unsupported',
      reason: 'No adapter registered',
    });
    const plan = makePlan([ps]);
    const s = buildAxonSession({
      plan,
      tasks: [],
      logs: [],
      domain: makeDomain('scientific-pathway'),
    });
    expect(s.status).toBe('unsupported');
    const card = s.steps.find((st) => st.planStepId === 'ps-x');
    expect(card?.kind).toBe('unsupported-step');
    expect(card?.status).toBe('unsupported');
    expect(card?.preview.kind).toBe('metadata');
    expect(s.outcome.unsupported).toBe(1);
  });

  it('writeback log entries become writeback cards (one per log)', () => {
    const ps = makePlanStep({ id: 'ps-1', tool: 'pathd', status: 'done', taskId: 't-1' });
    const plan = makePlan([ps]);
    const tasks = [makeTask({ id: 't-1', tool: 'pathd', status: 'done', result: { nodeCount: 3 } })];
    const logs: AxonLogEntry[] = [
      makeLog({
        phase: 'writeback-emitted',
        tool: 'pathd',
        taskId: 't-1',
        message: 'PATHD writeback to workbench',
        metadata: { status: 'done' },
      }),
    ];
    const s = buildAxonSession({
      plan,
      tasks,
      logs,
      domain: makeDomain('scientific-pathway'),
    });
    const wb = s.steps.filter((st) => st.kind === 'writeback');
    expect(wb).toHaveLength(1);
    expect(wb[0].status).toBe('done');
    expect(wb[0].preview.kind).toBe('writeback');
    expect(s.outcome.writebackCount).toBe(1);
    expect(s.outcome.headline).toMatch(/1 writeback/);
  });

  it('blocked-dependency log entries become blocked cards', () => {
    const ps1 = makePlanStep({ id: 'ps-1', tool: 'pathd', status: 'error', taskId: 't-1' });
    const ps2 = makePlanStep({
      id: 'ps-2',
      tool: 'fbasim',
      status: 'planned',
      taskId: 't-2',
      dependsOn: ['ps-1'],
    });
    const plan = makePlan([ps1, ps2]);
    const tasks: AxonTask[] = [
      makeTask({ id: 't-1', tool: 'pathd', status: 'error', error: 'boom', planId: plan.id }),
      makeTask({ id: 't-2', tool: 'fbasim', status: 'pending', planId: plan.id }),
    ];
    const logs: AxonLogEntry[] = [
      makeLog({
        phase: 'blocked-dependency',
        tool: 'fbasim',
        taskId: 't-2',
        message: 'Upstream pathd failed — fbasim cannot run',
      }),
    ];
    const s = buildAxonSession({
      plan,
      tasks,
      logs,
      domain: makeDomain('scientific-pathway'),
    });
    const blocked = s.steps.filter((st) => st.kind === 'blocked-dependency');
    expect(blocked).toHaveLength(1);
    expect(blocked[0].status).toBe('blocked');
    expect(s.outcome.blocked).toBe(1);
    expect(s.outcome.userActionNeeded).toBe(true);
  });

  it('interrupted flag adds an interrupted step sourced from the log', () => {
    const logs: AxonLogEntry[] = [
      makeLog({
        phase: 'interrupted',
        message: 'Session was interrupted by reload',
        metadata: { reason: 'reload' },
      }),
    ];
    const s = buildAxonSession({
      plan: null,
      tasks: [],
      logs,
      domain: makeDomain('scientific-pathway'),
      hadInterruptedTasks: true,
    });
    expect(s.status).toBe('interrupted');
    const card = s.steps.find((st) => st.kind === 'interrupted');
    expect(card).toBeDefined();
    expect(card?.status).toBe('interrupted');
    expect(s.outcome.interrupted).toBe(1);
  });

  it('currentStepId prefers running over waiting, and waiting over last done', () => {
    const psA = makePlanStep({ id: 'psA', tool: 'pathd', status: 'done', taskId: 'tA' });
    const psB = makePlanStep({ id: 'psB', tool: 'fbasim', status: 'running', taskId: 'tB' });
    const psC = makePlanStep({ id: 'psC', tool: 'fbasim', status: 'planned', taskId: 'tC' });
    const plan = makePlan([psA, psB, psC]);
    const tasks: AxonTask[] = [
      makeTask({ id: 'tA', tool: 'pathd', status: 'done', result: { nodeCount: 3 } }),
      makeTask({ id: 'tB', tool: 'fbasim', status: 'running' }),
      makeTask({ id: 'tC', tool: 'fbasim', status: 'pending' }),
    ];
    const s = buildAxonSession({
      plan,
      tasks,
      logs: [],
      domain: makeDomain('scientific-pathway'),
    });
    expect(s.status).toBe('running');
    expect(s.currentStepId).toBe(`step-plan-${psB.id}`);
  });

  it('currentStepId falls back to waiting when nothing is running', () => {
    const psA = makePlanStep({ id: 'psA', tool: 'pathd', status: 'done', taskId: 'tA' });
    const psB = makePlanStep({ id: 'psB', tool: 'fbasim', status: 'planned', taskId: 'tB' });
    const plan = makePlan([psA, psB]);
    const tasks: AxonTask[] = [
      makeTask({ id: 'tA', tool: 'pathd', status: 'done', result: { nodeCount: 3 } }),
      makeTask({ id: 'tB', tool: 'fbasim', status: 'pending' }),
    ];
    const s = buildAxonSession({
      plan,
      tasks,
      logs: [],
      domain: makeDomain('scientific-pathway'),
    });
    expect(s.currentStepId).toBe(`step-plan-${psB.id}`);
  });

  it('orphan tasks (no plan linkage) are surfaced as standalone plan-step cards', () => {
    const orphan = makeTask({
      id: 'orphan-1',
      tool: 'pathd',
      status: 'done',
      result: { nodeCount: 5, provider: 'groq' },
    });
    const s = buildAxonSession({
      plan: null,
      tasks: [orphan],
      logs: [],
      domain: null,
    });
    // No plan + no domain → idle, but the orphan task is surfaced, not hidden.
    const orphanCard = s.steps.find((st) => st.taskId === 'orphan-1');
    expect(orphanCard).toBeDefined();
    expect(orphanCard?.kind).toBe('plan-step');
    expect(orphanCard?.status).toBe('done');
    expect(orphanCard?.preview.kind).toBe('result');
  });

  it('planner-returned-no-steps yields unsupported status and planner warning card', () => {
    const plan = makePlan([], { warnings: ['No supported tool matched the request'] });
    const s = buildAxonSession({
      plan,
      tasks: [],
      logs: [],
      domain: makeDomain('scientific-pathway'),
    });
    expect(s.status).toBe('unsupported');
    const planning = s.steps.find((st) => st.kind === 'planning');
    expect(planning).toBeDefined();
    expect(planning?.preview.kind).toBe('planner');
    if (planning?.preview.kind === 'planner') {
      expect(planning.preview.stepCount).toBe(0);
      expect(planning.preview.warnings).toContain('No supported tool matched the request');
    }
  });

  it('running plan-step card carries task startedAt/finishedAt timestamps when present', () => {
    const ps = makePlanStep({ id: 'ps-1', tool: 'pathd', status: 'running', taskId: 't-1' });
    const plan = makePlan([ps]);
    const tasks = [
      makeTask({
        id: 't-1',
        tool: 'pathd',
        status: 'running',
        startedAt: 1_700_000_000_100,
      }),
    ];
    const s = buildAxonSession({
      plan,
      tasks,
      logs: [],
      domain: makeDomain('scientific-pathway'),
    });
    const card = s.steps.find((st) => st.planStepId === 'ps-1') as AxonSessionStep;
    expect(card.startedAt).toBe(1_700_000_000_100);
    expect(card.finishedAt).toBeUndefined();
    expect(s.status).toBe('running');
  });

  it('session title reflects the plan tool chain for scientific-pathway', () => {
    const ps1 = makePlanStep({ tool: 'pathd', status: 'done' });
    const ps2 = makePlanStep({ tool: 'fbasim', status: 'done' });
    const plan = makePlan([ps1, ps2]);
    const s = buildAxonSession({
      plan,
      tasks: [],
      logs: [],
      domain: makeDomain('scientific-pathway'),
    });
    expect(s.title).toMatch(/PATHD/);
    expect(s.title).toMatch(/FBASIM/);
  });

  it('off-domain title explicitly calls out no-plan', () => {
    const s = buildAxonSession({
      plan: null,
      tasks: [],
      logs: [],
      domain: makeDomain('off-domain'),
    });
    expect(s.title).toMatch(/off-domain/i);
    expect(s.title).toMatch(/no plan/i);
  });

  it('outcome headline concatenates every non-zero counter in order', () => {
    const psDone = makePlanStep({ id: 'pD', tool: 'pathd', status: 'done', taskId: 'tD' });
    const psFail = makePlanStep({ id: 'pF', tool: 'pathd', status: 'error', taskId: 'tF' });
    const psCancel = makePlanStep({ id: 'pC', tool: 'pathd', status: 'cancelled', taskId: 'tC' });
    const plan = makePlan([psDone, psFail, psCancel]);
    const tasks: AxonTask[] = [
      makeTask({ id: 'tD', status: 'done', result: { nodeCount: 1 } }),
      makeTask({ id: 'tF', status: 'error', error: 'x' }),
      makeTask({ id: 'tC', status: 'cancelled' }),
    ];
    const logs: AxonLogEntry[] = [
      makeLog({ phase: 'writeback-emitted', tool: 'pathd', taskId: 'tD', message: 'wb' }),
    ];
    const s = buildAxonSession({
      plan,
      tasks,
      logs,
      domain: makeDomain('scientific-pathway'),
    });
    // completed before failed before cancelled before writeback
    const idxCompleted = s.outcome.headline.indexOf('completed');
    const idxFailed = s.outcome.headline.indexOf('failed');
    const idxCancelled = s.outcome.headline.indexOf('cancelled');
    const idxWb = s.outcome.headline.indexOf('writeback');
    expect(idxCompleted).toBeGreaterThan(-1);
    expect(idxFailed).toBeGreaterThan(idxCompleted);
    expect(idxCancelled).toBeGreaterThan(idxFailed);
    expect(idxWb).toBeGreaterThan(idxCancelled);
  });
});
