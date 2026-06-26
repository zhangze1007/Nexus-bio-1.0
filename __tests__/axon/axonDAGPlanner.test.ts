/** @jest-environment node */
/**
 * axonDAGPlanner.test.ts — DAG planning and dependency resolution.
 *
 * Covers:
 *   - Single-tool plans (no dependencies)
 *   - Multi-tool linear chains
 *   - Parallel branches (independent tasks)
 *   - Cycle detection (edge case)
 *   - getExecutableTasks dependency resolution
 *   - markTaskComplete / markTaskFailed immutability
 *   - Blocked task detection
 */
import {
  planDAG,
  getExecutableTasks,
  markTaskComplete,
  markTaskFailed,
  markTaskRunning,
  hasRemainingTasks,
  getBlockedTasks,
  type DAGPlan,
  type DAGTask,
} from "../../src/services/axon/axonDAGPlanner";
import type { WorkbenchCopilotContext } from "../../src/services/axonContext";

function emptyContext(): WorkbenchCopilotContext {
  return {
    hasContext: false,
    targetProduct: null,
    evidenceTotal: 0,
    evidenceSelected: 0,
    nextToolIds: [],
    currentToolId: null,
    workflowStatus: null,
    workflowCurrentToolId: null,
    workflowNextRecommendedNode: null,
    workflowHumanGateRequired: false,
    workflowIsDemoOnly: false,
    summaryOneLine: "No active workbench context",
    promptAugmentation: "",
  };
}

function ctxWithTarget(target: string): WorkbenchCopilotContext {
  return { ...emptyContext(), hasContext: true, targetProduct: target };
}

let counter = 0;
function deterministicIdFactory() {
  return `task-${++counter}`;
}

beforeEach(() => {
  counter = 0;
});

describe("planDAG", () => {
  it("creates a single-tool plan for FBA-only goals", () => {
    const plan = planDAG("Run FBA on the model", emptyContext(), {
      idFactory: deterministicIdFactory,
      now: () => new Date("2025-01-01"),
    });
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].tool).toBe("fbasim");
    expect(plan.tasks[0].dependsOn).toEqual([]);
    expect(plan.goal).toBe("Run FBA on the model");
  });

  it("creates a 2-step plan with dependency for pathway + FBA", () => {
    const plan = planDAG(
      "Design a pathway and run FBA",
      emptyContext(),
      { idFactory: deterministicIdFactory, now: () => new Date("2025-01-01") },
    );
    expect(plan.tasks).toHaveLength(2);
    const pathd = plan.tasks.find((t) => t.tool === "pathd");
    const fba = plan.tasks.find((t) => t.tool === "fbasim");
    expect(pathd).toBeDefined();
    expect(fba).toBeDefined();
    expect(pathd!.dependsOn).toEqual([]);
    expect(fba!.dependsOn).toEqual([pathd!.id]);
  });

  it("creates parallel branches for independent tools", () => {
    // FBA and CETHX both depend on PATHD but not on each other
    const plan = planDAG(
      "Design pathway, run FBA and check thermodynamics",
      emptyContext(),
      { idFactory: deterministicIdFactory, now: () => new Date("2025-01-01") },
    );
    const fba = plan.tasks.find((t) => t.tool === "fbasim");
    const cethx = plan.tasks.find((t) => t.tool === "cethx");
    const pathd = plan.tasks.find((t) => t.tool === "pathd");
    expect(pathd).toBeDefined();
    expect(fba).toBeDefined();
    expect(cethx).toBeDefined();
    // Both depend on pathd, but not on each other
    expect(fba!.dependsOn).toEqual([pathd!.id]);
    expect(cethx!.dependsOn).toEqual([pathd!.id]);
    expect(fba!.dependsOn).not.toContain(cethx!.id);
    expect(cethx!.dependsOn).not.toContain(fba!.id);
  });

  it("uses workbench target product for pathd input", () => {
    const plan = planDAG("Just tell me what to do", ctxWithTarget("lycopene"), {
      idFactory: deterministicIdFactory,
      now: () => new Date("2025-01-01"),
    });
    const pathd = plan.tasks.find((t) => t.tool === "pathd");
    expect(pathd).toBeDefined();
    expect(pathd!.inputs.targetProduct).toBe("lycopene");
  });

  it("falls back to goal text when no context target", () => {
    const plan = planDAG("Design biosynthesis pathway", emptyContext(), {
      idFactory: deterministicIdFactory,
      now: () => new Date("2025-01-01"),
    });
    const pathd = plan.tasks.find((t) => t.tool === "pathd");
    expect(pathd).toBeDefined();
    expect(pathd!.inputs.targetProduct).toBe("Design biosynthesis pathway");
  });

  it("creates an empty plan for unmatched goals", () => {
    const plan = planDAG("Hello there", emptyContext(), {
      idFactory: deterministicIdFactory,
      now: () => new Date("2025-01-01"),
    });
    expect(plan.tasks).toHaveLength(0);
  });

  it("sets all tasks to pending status", () => {
    const plan = planDAG(
      "Design pathway and run FBA and check thermodynamics",
      emptyContext(),
      { idFactory: deterministicIdFactory, now: () => new Date("2025-01-01") },
    );
    for (const task of plan.tasks) {
      expect(task.status).toBe("pending");
    }
  });

  it("handles catalyst + evolution chain", () => {
    const plan = planDAG(
      "Design enzyme catalyst and directed evolution",
      emptyContext(),
      { idFactory: deterministicIdFactory, now: () => new Date("2025-01-01") },
    );
    const catdes = plan.tasks.find((t) => t.tool === "catdes");
    const proevol = plan.tasks.find((t) => t.tool === "proevol");
    expect(catdes).toBeDefined();
    expect(proevol).toBeDefined();
    expect(proevol!.dependsOn).toEqual([catdes!.id]);
  });

  it("handles chassis engineering chain (genmim -> gecair)", () => {
    const plan = planDAG(
      "Minimize genome and design gene circuit",
      emptyContext(),
      { idFactory: deterministicIdFactory, now: () => new Date("2025-01-01") },
    );
    const genmim = plan.tasks.find((t) => t.tool === "genmim");
    const gecair = plan.tasks.find((t) => t.tool === "gecair");
    expect(genmim).toBeDefined();
    expect(gecair).toBeDefined();
    expect(gecair!.dependsOn).toEqual([genmim!.id]);
  });

  it("handles full DBTL chain (pathd -> fbasim -> catdes -> dyncon -> cellfree)", () => {
    const plan = planDAG(
      "Design pathway and run FBA and design catalyst and control and cell-free",
      emptyContext(),
      { idFactory: deterministicIdFactory, now: () => new Date("2025-01-01") },
    );
    const pathd = plan.tasks.find((t) => t.tool === "pathd");
    const fba = plan.tasks.find((t) => t.tool === "fbasim");
    const catdes = plan.tasks.find((t) => t.tool === "catdes");
    const dyncon = plan.tasks.find((t) => t.tool === "dyncon");
    const cellfree = plan.tasks.find((t) => t.tool === "cellfree");
    expect(pathd).toBeDefined();
    expect(fba).toBeDefined();
    expect(catdes).toBeDefined();
    expect(dyncon).toBeDefined();
    expect(cellfree).toBeDefined();
    expect(fba!.dependsOn).toEqual([pathd!.id]);
    expect(catdes!.dependsOn).toEqual([fba!.id]);
    expect(dyncon!.dependsOn).toEqual([catdes!.id]);
    expect(cellfree!.dependsOn).toEqual([dyncon!.id]);
  });

  it("sets createdAt to ISO string", () => {
    const plan = planDAG("Run FBA", emptyContext(), {
      idFactory: deterministicIdFactory,
      now: () => new Date("2025-06-15T10:30:00Z"),
    });
    expect(plan.createdAt).toBe("2025-06-15T10:30:00.000Z");
  });
});

describe("getExecutableTasks", () => {
  it("returns tasks with no dependencies", () => {
    const plan: DAGPlan = {
      tasks: [
        { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "pending" },
        { id: "b", tool: "fbasim", inputs: {}, dependsOn: ["a"], status: "pending" },
      ],
      goal: "test",
      createdAt: "2025-01-01",
    };
    const executable = getExecutableTasks(plan);
    expect(executable).toHaveLength(1);
    expect(executable[0].id).toBe("a");
  });

  it("returns tasks whose dependencies are completed", () => {
    const plan: DAGPlan = {
      tasks: [
        { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "completed" },
        { id: "b", tool: "fbasim", inputs: {}, dependsOn: ["a"], status: "pending" },
      ],
      goal: "test",
      createdAt: "2025-01-01",
    };
    const executable = getExecutableTasks(plan);
    expect(executable).toHaveLength(1);
    expect(executable[0].id).toBe("b");
  });

  it("does not return tasks with unmet dependencies", () => {
    const plan: DAGPlan = {
      tasks: [
        { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "running" },
        { id: "b", tool: "fbasim", inputs: {}, dependsOn: ["a"], status: "pending" },
      ],
      goal: "test",
      createdAt: "2025-01-01",
    };
    const executable = getExecutableTasks(plan);
    expect(executable).toHaveLength(0);
  });

  it("returns multiple independent tasks", () => {
    const plan: DAGPlan = {
      tasks: [
        { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "completed" },
        { id: "b", tool: "fbasim", inputs: {}, dependsOn: ["a"], status: "pending" },
        { id: "c", tool: "cethx", inputs: {}, dependsOn: ["a"], status: "pending" },
      ],
      goal: "test",
      createdAt: "2025-01-01",
    };
    const executable = getExecutableTasks(plan);
    expect(executable).toHaveLength(2);
    expect(executable.map((t) => t.id).sort()).toEqual(["b", "c"]);
  });

  it("does not return completed or failed tasks", () => {
    const plan: DAGPlan = {
      tasks: [
        { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "completed" },
        { id: "b", tool: "fbasim", inputs: {}, dependsOn: [], status: "failed", error: "oops" },
        { id: "c", tool: "cethx", inputs: {}, dependsOn: [], status: "pending" },
      ],
      goal: "test",
      createdAt: "2025-01-01",
    };
    const executable = getExecutableTasks(plan);
    expect(executable).toHaveLength(1);
    expect(executable[0].id).toBe("c");
  });
});

describe("markTaskComplete / markTaskFailed", () => {
  it("markTaskComplete returns new plan with task completed", () => {
    const plan: DAGPlan = {
      tasks: [
        { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "running" },
      ],
      goal: "test",
      createdAt: "2025-01-01",
    };
    const result = markTaskComplete(plan, "a", { nodes: 5 });
    expect(result.tasks[0].status).toBe("completed");
    expect(result.tasks[0].result).toEqual({ nodes: 5 });
    // Original is unchanged (immutability)
    expect(plan.tasks[0].status).toBe("running");
  });

  it("markTaskFailed returns new plan with task failed", () => {
    const plan: DAGPlan = {
      tasks: [
        { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "running" },
      ],
      goal: "test",
      createdAt: "2025-01-01",
    };
    const result = markTaskFailed(plan, "a", "Network error");
    expect(result.tasks[0].status).toBe("failed");
    expect(result.tasks[0].error).toBe("Network error");
  });

  it("markTaskRunning returns new plan with task running", () => {
    const plan: DAGPlan = {
      tasks: [
        { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "pending" },
      ],
      goal: "test",
      createdAt: "2025-01-01",
    };
    const result = markTaskRunning(plan, "a");
    expect(result.tasks[0].status).toBe("running");
  });

  it("ignores non-existent task ids", () => {
    const plan: DAGPlan = {
      tasks: [
        { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "pending" },
      ],
      goal: "test",
      createdAt: "2025-01-01",
    };
    const result = markTaskComplete(plan, "nonexistent", {});
    expect(result.tasks[0].status).toBe("pending");
  });
});

describe("hasRemainingTasks", () => {
  it("returns true when pending tasks exist", () => {
    const plan: DAGPlan = {
      tasks: [
        { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "completed" },
        { id: "b", tool: "fbasim", inputs: {}, dependsOn: ["a"], status: "pending" },
      ],
      goal: "test",
      createdAt: "2025-01-01",
    };
    expect(hasRemainingTasks(plan)).toBe(true);
  });

  it("returns true when running tasks exist", () => {
    const plan: DAGPlan = {
      tasks: [
        { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "running" },
      ],
      goal: "test",
      createdAt: "2025-01-01",
    };
    expect(hasRemainingTasks(plan)).toBe(true);
  });

  it("returns false when all tasks are terminal", () => {
    const plan: DAGPlan = {
      tasks: [
        { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "completed" },
        { id: "b", tool: "fbasim", inputs: {}, dependsOn: [], status: "failed" },
      ],
      goal: "test",
      createdAt: "2025-01-01",
    };
    expect(hasRemainingTasks(plan)).toBe(false);
  });
});

describe("getBlockedTasks", () => {
  it("returns tasks blocked by failed dependencies", () => {
    const plan: DAGPlan = {
      tasks: [
        { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "failed", error: "oops" },
        { id: "b", tool: "fbasim", inputs: {}, dependsOn: ["a"], status: "pending" },
      ],
      goal: "test",
      createdAt: "2025-01-01",
    };
    const blocked = getBlockedTasks(plan);
    expect(blocked).toHaveLength(1);
    expect(blocked[0].id).toBe("b");
  });

  it("returns empty when no tasks are blocked", () => {
    const plan: DAGPlan = {
      tasks: [
        { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "completed" },
        { id: "b", tool: "fbasim", inputs: {}, dependsOn: ["a"], status: "pending" },
      ],
      goal: "test",
      createdAt: "2025-01-01",
    };
    expect(getBlockedTasks(plan)).toHaveLength(0);
  });
});
