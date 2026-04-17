/** @jest-environment node */
/**
 * axonPlanner — deterministic plan generation.
 *
 * Every branch of the decision tree must be asserted:
 *   • single-step pathd
 *   • single-step fbasim
 *   • multi-step pathd → fbasim with explicit dependsOn
 *   • unsupported tool surfaced as warning + 'unsupported' step status
 *   • no-match path still returns a plan with a warning
 *   • caps: no plan exceeds MAX_PLAN_STEPS
 */
import {
  buildAxonPlan,
  summarisePlan,
  MAX_PLAN_STEPS,
  type PlannerSupport,
} from '../src/services/axonPlanner';
import type { WorkbenchCopilotContext } from '../src/services/axonContext';

const allSupported: PlannerSupport = { isSupported: () => true };
const noneSupported: PlannerSupport = { isSupported: () => false };

function emptyContext(): WorkbenchCopilotContext {
  return {
    hasContext: false,
    targetProduct: null,
    evidenceTotal: 0,
    evidenceSelected: 0,
    nextToolIds: [],
    currentToolId: null,
    summaryOneLine: 'No active workbench context',
    promptAugmentation: '',
  };
}

function ctxWithTarget(target: string): WorkbenchCopilotContext {
  return { ...emptyContext(), hasContext: true, targetProduct: target };
}

function deterministic() {
  let t = 1_700_000_000_000;
  let n = 0;
  return {
    now: () => ++t,
    idFactory: (prefix: string) => `${prefix}-${++n}`,
  };
}

describe('axonPlanner', () => {
  it('builds a single-step fbasim plan when only flux keywords match', () => {
    const plan = buildAxonPlan(
      'Run FBA on the current chassis and tell me the growth rate.',
      emptyContext(),
      allSupported,
      deterministic(),
    );
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].tool).toBe('fbasim');
    expect(plan.steps[0].status).toBe('planned');
    expect(plan.steps[0].dependsOn).toEqual([]);
    expect(plan.warnings).toEqual([]);
  });

  it('builds a single-step pathd plan when only pathway keywords match', () => {
    const plan = buildAxonPlan(
      'Design a biosynthesis route for lycopene.',
      emptyContext(),
      allSupported,
      deterministic(),
    );
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].tool).toBe('pathd');
    expect(plan.steps[0].dependsOn).toEqual([]);
  });

  it('builds a 2-step plan with pathd → fbasim dependency when both match', () => {
    const plan = buildAxonPlan(
      'Design a pathway for artemisinin and run flux balance analysis.',
      emptyContext(),
      allSupported,
      deterministic(),
    );
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].tool).toBe('pathd');
    expect(plan.steps[1].tool).toBe('fbasim');
    expect(plan.steps[1].dependsOn).toEqual([plan.steps[0].id]);
    expect(plan.warnings).toEqual([]);
    expect(summarisePlan(plan)).toBe('2-step plan · pathd → fbasim');
  });

  it('treats a workbench target product as pathd trigger even without keywords', () => {
    const plan = buildAxonPlan(
      'Just tell me what to do.',
      ctxWithTarget('muconic acid'),
      allSupported,
      deterministic(),
    );
    expect(plan.steps.some((s) => s.tool === 'pathd')).toBe(true);
  });

  it('marks unsupported tools explicitly and records a warning', () => {
    const plan = buildAxonPlan(
      'Design pathway for lysine',
      emptyContext(),
      noneSupported,
      deterministic(),
    );
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].status).toBe('unsupported');
    expect(plan.warnings.length).toBeGreaterThan(0);
    expect(plan.warnings[0]).toMatch(/not registered/i);
  });

  it('returns a 0-step plan with a warning when no trigger fires', () => {
    const plan = buildAxonPlan(
      'Hello there, general Kenobi.',
      emptyContext(),
      allSupported,
      deterministic(),
    );
    expect(plan.steps).toHaveLength(0);
    expect(plan.warnings.length).toBeGreaterThan(0);
    expect(summarisePlan(plan)).toBe('No plan steps');
  });

  it('never exceeds the MAX_PLAN_STEPS cap', () => {
    const plan = buildAxonPlan(
      'Design pathway and run FBA and optimize yield and design pathway and run FBA.',
      ctxWithTarget('glutamate'),
      allSupported,
      deterministic(),
    );
    expect(plan.steps.length).toBeLessThanOrEqual(MAX_PLAN_STEPS);
  });

  it('preserves plan metadata (origin, request, depth)', () => {
    const plan = buildAxonPlan(
      'Design pathway for X',
      emptyContext(),
      allSupported,
      { ...deterministic(), origin: 'auto' },
    );
    expect(plan.origin).toBe('auto');
    expect(plan.depth).toBe(0);
    expect(plan.request).toContain('Design pathway for X');
  });
});
