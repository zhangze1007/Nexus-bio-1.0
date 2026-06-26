/**
 * axonDAGPlanner — DAG-based multi-step planning for the Axon orchestrator.
 *
 * Decomposes a complex goal into a directed acyclic graph (DAG) of tool
 * calls. Unlike the single-shot axonPlanner, this planner supports:
 *   - Arbitrary dependency chains (not just linear)
 *   - Parallel execution of independent tasks
 *   - Dynamic re-planning after failure
 *   - Composite tool workflows
 *
 * Non-goals:
 *   - No LLM roundtrip inside this module (deterministic)
 *   - No speculative execution
 *   - No persistent state — plans are ephemeral
 *
 * Contract:
 *   - Every DAG is a valid DAG (no cycles)
 *   - Every task references a known tool id
 *   - Dependencies are always honored
 *   - getExecutableTasks returns tasks whose dependencies are all completed
 */

import type { WorkbenchCopilotContext } from "../axonContext";

export type DAGTaskStatus = "pending" | "running" | "completed" | "failed";

export interface DAGTask {
  id: string;
  tool: string;
  inputs: Record<string, unknown>;
  dependsOn: string[];
  status: DAGTaskStatus;
  result?: unknown;
  error?: string;
}

export interface DAGPlan {
  tasks: DAGTask[];
  goal: string;
  createdAt: string;
}

export interface DAGPlannerOptions {
  idFactory?: () => string;
  now?: () => Date;
}

function defaultIdFactory(): string {
  return `dag-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Build a DAG plan from a high-level goal and project context.
 *
 * The planner maps goal keywords to tool sequences with explicit
 * dependency edges. Independent tools get parallel-ready (empty dependsOn).
 */
export function planDAG(
  goal: string,
  context: WorkbenchCopilotContext,
  options: DAGPlannerOptions = {},
): DAGPlan {
  const idFactory = options.idFactory ?? defaultIdFactory;
  const now = options.now ?? (() => new Date());
  const text = goal.toLowerCase().trim();
  const tasks: DAGTask[] = [];

  // Map goal keywords to tool selections with dependency resolution
  const wantsPathd = /pathway|design|route|biosynthesis|produce/i.test(text) ||
    context.targetProduct !== null;
  const wantsFbasim = /flux|fba|yield|growth|balance|bottleneck/i.test(text);
  const wantsCatdes = /catalyst|enzyme|binding|mutagenesis/i.test(text);
  const wantsCethx = /thermodynamic|delta.?g|gibbs|atp/i.test(text);
  const wantsDyncon = /control|feedback|bioreactor|pid/i.test(text);
  const wantsCellfree = /cell.?free|txtl|in.?vitro/i.test(text);
  const wantsGenmim = /minimize|crispri|chassis|genome/i.test(text);
  const wantsProevol = /evolution|directed|fitness|campaign/i.test(text);
  const wantsGecair = /circuit|logic.?gate|hill/i.test(text);

  // Build the DAG with dependency edges
  const pathdId = wantsPathd ? idFactory() : null;
  const fbaId = wantsFbasim ? idFactory() : null;
  const cethxId = wantsCethx ? idFactory() : null;
  const catdesId = wantsCatdes ? idFactory() : null;
  const proevolId = wantsProevol ? idFactory() : null;
  const genmimId = wantsGenmim ? idFactory() : null;
  const gecairId = wantsGecair ? idFactory() : null;
  const dynconId = wantsDyncon ? idFactory() : null;
  const cellfreeId = wantsCellfree ? idFactory() : null;

  // PATHD — no dependencies (entry point)
  if (pathdId) {
    tasks.push({
      id: pathdId,
      tool: "pathd",
      inputs: { targetProduct: context.targetProduct ?? goal },
      dependsOn: [],
      status: "pending",
    });
  }

  // FBASIM — depends on PATHD when both present
  if (fbaId) {
    tasks.push({
      id: fbaId,
      tool: "fbasim",
      inputs: { species: "ecoli", objective: "biomass" },
      dependsOn: pathdId ? [pathdId] : [],
      status: "pending",
    });
  }

  // CETHX — can run in parallel with FBASIM; depends on PATHD if present
  if (cethxId) {
    tasks.push({
      id: cethxId,
      tool: "cethx",
      inputs: {},
      dependsOn: pathdId ? [pathdId] : [],
      status: "pending",
    });
  }

  // CATDES — depends on FBASIM (needs bottleneck data)
  if (catdesId) {
    const catDeps: string[] = [];
    if (fbaId) catDeps.push(fbaId);
    tasks.push({
      id: catdesId,
      tool: "catdes",
      inputs: {},
      dependsOn: catDeps,
      status: "pending",
    });
  }

  // PROEVOL — depends on CATDES (needs lead variant) when both present
  if (proevolId) {
    tasks.push({
      id: proevolId,
      tool: "proevol",
      inputs: {},
      dependsOn: catdesId ? [catdesId] : [],
      status: "pending",
    });
  }

  // GENMIM — depends on FBASIM when both present
  if (genmimId) {
    tasks.push({
      id: genmimId,
      tool: "genmim",
      inputs: {},
      dependsOn: fbaId ? [fbaId] : [],
      status: "pending",
    });
  }

  // GECAIR — depends on GENMIM when both present
  if (gecairId) {
    tasks.push({
      id: gecairId,
      tool: "gecair",
      inputs: {},
      dependsOn: genmimId ? [genmimId] : [],
      status: "pending",
    });
  }

  // DYNCON — depends on CATDES when both present
  if (dynconId) {
    const dynDeps: string[] = [];
    if (catdesId) dynDeps.push(catdesId);
    tasks.push({
      id: dynconId,
      tool: "dyncon",
      inputs: {},
      dependsOn: dynDeps,
      status: "pending",
    });
  }

  // CELLFREE — depends on DYNCON when both present
  if (cellfreeId) {
    tasks.push({
      id: cellfreeId,
      tool: "cellfree",
      inputs: {},
      dependsOn: dynconId ? [dynconId] : [],
      status: "pending",
    });
  }

  // Validate: detect any cycles (shouldn't happen with this construction)
  if (hasCycle(tasks)) {
    throw new Error("DAGPlanner: cycle detected in plan — this is a bug");
  }

  return {
    tasks,
    goal,
    createdAt: now().toISOString(),
  };
}

/**
 * Return tasks that are ready to execute: status is 'pending' and all
 * dependencies are 'completed'.
 */
export function getExecutableTasks(plan: DAGPlan): DAGTask[] {
  const completedIds = new Set(
    plan.tasks.filter((t) => t.status === "completed").map((t) => t.id),
  );

  return plan.tasks.filter(
    (task) =>
      task.status === "pending" &&
      task.dependsOn.every((depId) => completedIds.has(depId)),
  );
}

/**
 * Mark a task as completed with its result. Returns a new plan (immutable).
 */
export function markTaskComplete(
  plan: DAGPlan,
  taskId: string,
  result: unknown,
): DAGPlan {
  return {
    ...plan,
    tasks: plan.tasks.map((task) =>
      task.id === taskId
        ? { ...task, status: "completed" as const, result }
        : task,
    ),
  };
}

/**
 * Mark a task as failed with an error message. Returns a new plan (immutable).
 */
export function markTaskFailed(
  plan: DAGPlan,
  taskId: string,
  error: string,
): DAGPlan {
  return {
    ...plan,
    tasks: plan.tasks.map((task) =>
      task.id === taskId
        ? { ...task, status: "failed" as const, error }
        : task,
    ),
  };
}

/**
 * Mark a task as running. Returns a new plan (immutable).
 */
export function markTaskRunning(plan: DAGPlan, taskId: string): DAGPlan {
  return {
    ...plan,
    tasks: plan.tasks.map((task) =>
      task.id === taskId
        ? { ...task, status: "running" as const }
        : task,
    ),
  };
}

/**
 * Check if the plan has any remaining pending tasks (executable or blocked).
 */
export function hasRemainingTasks(plan: DAGPlan): boolean {
  return plan.tasks.some(
    (t) => t.status === "pending" || t.status === "running",
  );
}

/**
 * Get all tasks that are blocked because a dependency failed.
 */
export function getBlockedTasks(plan: DAGPlan): DAGTask[] {
  const failedIds = new Set(
    plan.tasks.filter((t) => t.status === "failed").map((t) => t.id),
  );

  return plan.tasks.filter(
    (task) =>
      task.status === "pending" &&
      task.dependsOn.some((depId) => failedIds.has(depId)),
  );
}

/**
 * Cycle detection via DFS. Returns true if any cycle exists.
 */
function hasCycle(tasks: DAGTask[]): boolean {
  const adj = new Map<string, string[]>();
  for (const task of tasks) {
    adj.set(task.id, task.dependsOn);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const task of tasks) {
    color.set(task.id, WHITE);
  }

  function dfs(node: string): boolean {
    color.set(node, GRAY);
    const neighbors = adj.get(node) ?? [];
    for (const neighbor of neighbors) {
      if (color.get(neighbor) === GRAY) return true; // back edge = cycle
      if (color.get(neighbor) === WHITE && dfs(neighbor)) return true;
    }
    color.set(node, BLACK);
    return false;
  }

  for (const task of tasks) {
    if (color.get(task.id) === WHITE && dfs(task.id)) return true;
  }
  return false;
}
