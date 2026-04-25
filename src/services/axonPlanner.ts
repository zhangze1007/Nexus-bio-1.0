/**
 * axonPlanner — bounded multi-step planning for the Axon orchestrator.
 *
 * Turns a natural-language request + the current workbench context into
 * an explicit, inspectable plan. The planner is deterministic (no LLM
 * call inside this module) and intentionally conservative: it only
 * proposes steps for tools that are registered in the adapter registry,
 * and it only proposes tools whose triggers are clearly present in the
 * request or the workbench state.
 *
 * Non-goals:
 *   • No speculative execution.
 *   • No re-planning after failure (left as a PR-5 seam).
 *   • No autonomous loop here — that seam lives in axonAutonomyLoop.
 *
 * Contract:
 *   • Every plan is capped at MAX_PLAN_STEPS.
 *   • Every step references a tool that is either supported OR appears
 *     with an explicit `warnings` entry stating it is unsupported.
 *   • Unsupported-tool steps are NEVER silently dropped — they appear
 *     in the plan with `status: 'unsupported'` so the UI can display
 *     them and the user understands the gap.
 *   • Dependencies are always honored: a downstream step lists its
 *     upstream step id in `dependsOn`.
 */

import type { AxonTool } from './AxonOrchestrator';
import type { WorkbenchCopilotContext } from './axonContext';
import { GOLDEN_PATH_TOOL_IDS, type ToolId } from '../domain/workflowContract';
import { getToolContract } from './workflowRegistry';

export const MAX_PLAN_STEPS = 5;
export const MAX_PLAN_DEPTH = 1;
export const MAX_PLAN_RETRIES = 2;

export type AxonPlanStepStatus =
  | 'planned'
  | 'enqueued'
  | 'running'
  | 'done'
  | 'error'
  | 'cancelled'
  | 'unsupported';

export interface AxonPlanStep {
  id: string;
  title: string;
  tool: AxonTool;
  objective: string;
  inputSummary: string;
  expectedOutput: string;
  dependsOn: string[];
  status: AxonPlanStepStatus;
  reason: string;
  /** Set when the step has been enqueued into the orchestrator. */
  taskId?: string;
}

export interface AxonPlan {
  id: string;
  createdAt: number;
  origin: 'user' | 'auto';
  request: string;
  steps: AxonPlanStep[];
  warnings: string[];
  /** Plan-level depth counter; used if we ever re-plan. */
  depth: number;
}

export interface PlannerSupport {
  isSupported: (tool: AxonTool) => boolean;
}

export interface PlannerOptions {
  now?: () => number;
  idFactory?: (prefix: string) => string;
  origin?: 'user' | 'auto';
}

const PATHD_KEYWORDS = [
  'pathway',
  'design',
  'route',
  'biosynthesis',
  'biosynthesise',
  'biosynthesize',
  'produce',
  'synth',
  'synthesi',
  'steps to',
  'how do we make',
  'how to make',
];

const FBASIM_KEYWORDS = [
  'flux',
  'fba',
  'objective',
  'yield',
  'growth rate',
  'carbon efficiency',
  'knockout',
  'optimi',
  'balance',
  'bottleneck',
];

// Phase-1 — Workflow Control Plane: per-tool keyword bags. Keys are
// ToolId; values are bag of phrases that nominate the tool. Co-located
// here because contracts don't carry keywords yet (kept terse to
// preserve existing planner behaviour for pathd / fbasim — see tests in
// __tests__/axonPlanner.test.ts).
const TOOL_KEYWORDS: Partial<Record<ToolId, readonly string[]>> = {
  pathd: PATHD_KEYWORDS,
  fbasim: FBASIM_KEYWORDS,
  catdes: ['catalyst design', 'enzyme design', 'redesign catalyst', 'binding affinity', 'mutagenesis'],
  dyncon: ['feedback control', 'dynamic control', 'controller', 'bioreactor', 'pid'],
  cellfree: ['cell-free', 'cellfree', 'txtl', 'tx-tl', 'in-vitro prototype', 'cfps'],
  dbtlflow: ['dbtl', 'design build test learn', 'iteration ledger', 'protocol generation'],
  cethx: ['thermodynamic', 'delta g', 'gibbs free energy', 'atp yield'],
  proevol: ['directed evolution', 'protein evolution', 'campaign', 'fitness landscape', 'survivor selection'],
  genmim: ['genome minimization', 'crispri', 'gene minimization', 'chassis minimization'],
  gecair: ['gene circuit', 'logic gate', 'hill curve', 'circuit topology'],
  multio: ['multi-omics', 'multio', 'transcriptomics proteomics', 'volcano plot', 'mofa'],
  scspatial: ['single-cell', 'spatial transcriptomics', 'visium', 'umap', 'paga'],
  'metabolic-eng': ['metabolic engineering lab', '3d metabolic'],
  nexai: ['research agent', 'literature synthesis', 'citation graph'],
};

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

function defaultIdFactory(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function inputSummaryForPathd(context: WorkbenchCopilotContext): string {
  const target = context.targetProduct ?? 'unspecified target';
  const ev = context.evidenceTotal > 0
    ? `${context.evidenceSelected}/${context.evidenceTotal} evidence items`
    : 'no selected evidence';
  return `target=${target}, ${ev}`;
}

function inputSummaryForFbasim(context: WorkbenchCopilotContext): string {
  return context.targetProduct
    ? `species from context, objective tied to ${context.targetProduct}`
    : 'default species, default objective';
}

/**
 * Build a plan from a user request and workbench context. The planner
 * walks a small deterministic decision tree — no LLM roundtrip, no
 * hidden state — so plans are reproducible in tests.
 */
export function buildAxonPlan(
  request: string,
  context: WorkbenchCopilotContext,
  support: PlannerSupport,
  options: PlannerOptions = {},
): AxonPlan {
  const now = options.now ?? Date.now;
  const idFactory = options.idFactory ?? defaultIdFactory;
  const origin = options.origin ?? 'user';
  const trimmed = request.trim();
  const text = trimmed.toLowerCase();

  const wantsPathd = hasAny(text, PATHD_KEYWORDS) || context.targetProduct !== null;
  const wantsFbasim = hasAny(text, FBASIM_KEYWORDS);

  const steps: AxonPlanStep[] = [];
  const warnings: string[] = [];

  function stepFor(
    tool: AxonTool,
    title: string,
    objective: string,
    inputSummary: string,
    expectedOutput: string,
    reason: string,
    dependsOn: string[] = [],
  ): AxonPlanStep {
    const supported = support.isSupported(tool);
    if (!supported) {
      warnings.push(
        `Tool "${tool}" is not registered in the adapter registry — step kept in plan as unsupported.`,
      );
    }
    return {
      id: idFactory('step'),
      title,
      tool,
      objective,
      inputSummary,
      expectedOutput,
      dependsOn,
      status: supported ? 'planned' : 'unsupported',
      reason,
    };
  }

  if (wantsPathd && wantsFbasim) {
    const pathd = stepFor(
      'pathd',
      'Design pathway',
      'Propose an end-to-end pathway for the target product.',
      inputSummaryForPathd(context),
      'Node list + edges + bottleneck hints',
      'Request mentions both pathway design and flux analysis; pathway must exist before fluxes can be computed.',
    );
    const fba = stepFor(
      'fbasim',
      'Flux-balance analysis',
      'Compute steady-state fluxes for the designed pathway; surface bottlenecks.',
      inputSummaryForFbasim(context),
      'Objective value + flux map + shadow prices',
      'Flux analysis depends on the upstream pathway design step.',
      [pathd.id],
    );
    steps.push(pathd, fba);
  } else if (wantsFbasim) {
    steps.push(
      stepFor(
        'fbasim',
        'Flux-balance analysis',
        'Compute steady-state fluxes on the active workbench metabolic model.',
        inputSummaryForFbasim(context),
        'Objective value + flux map + shadow prices',
        'Request aligns with FBA analysis; no upstream pathway design required.',
      ),
    );
  } else if (wantsPathd) {
    steps.push(
      stepFor(
        'pathd',
        'Design pathway',
        'Propose an end-to-end pathway for the target product.',
        inputSummaryForPathd(context),
        'Node list + edges + bottleneck hints',
        'Request aligns with pathway design; workbench has a target product or the request names one.',
      ),
    );
  }

  // Phase-1 extension: dispatch any other tool whose contract keywords
  // appear in the request. Contract-only tools (no Axon adapter) are
  // pushed as `unsupported` per the existing stepFor() rules. This makes
  // the planner cover all 14 tools while keeping pathd / fbasim behavior
  // bit-exact for the existing test matrix.
  const alreadyEnqueued = new Set(steps.map((s) => s.tool));
  for (const tool of Object.keys(TOOL_KEYWORDS) as ToolId[]) {
    if (tool === 'pathd' || tool === 'fbasim') continue; // handled above
    if (alreadyEnqueued.has(tool)) continue;
    const bag = TOOL_KEYWORDS[tool] ?? [];
    if (!hasAny(text, bag as string[])) continue;
    if (steps.length >= MAX_PLAN_STEPS) break;
    const contract = getToolContract(tool);
    steps.push(
      stepFor(
        tool,
        `${tool.toUpperCase()} — ${contract.primaryIntent}`,
        contract.validityBaseline.reason,
        context.targetProduct ? `target=${context.targetProduct}` : 'no target in context',
        contract.outputArtifacts.map((a) => a.payloadPath).join(', ') || 'no declared outputs',
        `Matched ${tool} contract keywords; ${contract.isGoldenPath ? 'golden-path' : 'sidecar'} step.`,
      ),
    );
    alreadyEnqueued.add(tool);
  }
  // Surface contract-only successors of golden-path tools currently in
  // the plan, so the user sees the next required step even when keywords
  // don't trigger it explicitly. We don't actually push them — we just
  // record a one-line warning so the UI can render them.
  for (const tool of [...alreadyEnqueued]) {
    const idx = GOLDEN_PATH_TOOL_IDS.indexOf(tool as never);
    if (idx < 0 || idx === GOLDEN_PATH_TOOL_IDS.length - 1) continue;
    const successor = GOLDEN_PATH_TOOL_IDS[idx + 1];
    if (alreadyEnqueued.has(successor)) continue;
    if (!support.isSupported(successor)) {
      warnings.push(
        `Successor "${successor}" on the golden path is contract-defined but has no adapter — run it manually.`,
      );
    }
  }

  // Even when no tool trigger fires, we still return a plan shell so
  // the UI can render "no actionable step proposed" instead of nothing.
  if (steps.length === 0) {
    warnings.push(
      'No supported tool matched the request. Rephrase with pathway-design or flux-analysis intent, or enqueue a tool manually.',
    );
  }

  // Enforce cap — should never fire with current heuristic, but lets
  // future planners fail loudly instead of silently ballooning.
  if (steps.length > MAX_PLAN_STEPS) {
    warnings.push(
      `Plan truncated to ${MAX_PLAN_STEPS} steps (was ${steps.length}).`,
    );
    steps.length = MAX_PLAN_STEPS;
  }

  return {
    id: idFactory('plan'),
    createdAt: now(),
    origin,
    request: truncate(trimmed, 500),
    steps,
    warnings,
    depth: 0,
  };
}

/**
 * Pretty short label for the UI: "2-step plan · pathd → fbasim".
 */
export function summarisePlan(plan: AxonPlan): string {
  if (plan.steps.length === 0) return 'No plan steps';
  const toolChain = plan.steps.map((s) => s.tool).join(' → ');
  return `${plan.steps.length}-step plan · ${toolChain}`;
}
