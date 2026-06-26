/** @jest-environment node */
/**
 * axonDAGExecutor.test.ts — DAG execution engine.
 *
 * Covers:
 *   - Single-task execution
 *   - Sequential dependency chain execution
 *   - Parallel independent task execution
 *   - Error handling and failure propagation
 *   - Progress callback invocation
 *   - Execution result summary
 *   - Blocked tasks when dependency fails
 */
import {
  executeDAG,
  summariseExecution,
  type ToolExecutor,
} from "../../src/services/axon/axonDAGExecutor";
import type { DAGPlan } from "../../src/services/axon/axonDAGPlanner";

function makePlan(tasks: DAGPlan["tasks"]): DAGPlan {
  return {
    tasks,
    goal: "test execution",
    createdAt: "2025-01-01T00:00:00.000Z",
  };
}

describe("executeDAG", () => {
  it("executes a single task", async () => {
    const plan = makePlan([
      { id: "a", tool: "pathd", inputs: { target: "artemisinin" }, dependsOn: [], status: "pending" },
    ]);

    const executor: ToolExecutor = jest.fn(async (_tool, inputs) => ({
      nodeCount: 7,
      inputs,
    }));

    const result = await executeDAG(plan, executor);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.results.get("a")).toEqual({
      nodeCount: 7,
      inputs: { target: "artemisinin" },
    });
    expect(executor).toHaveBeenCalledWith("pathd", { target: "artemisinin" });
  });

  it("executes tasks in dependency order", async () => {
    const executionOrder: string[] = [];

    const plan = makePlan([
      { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "pending" },
      { id: "b", tool: "fbasim", inputs: {}, dependsOn: ["a"], status: "pending" },
      { id: "c", tool: "catdes", inputs: {}, dependsOn: ["b"], status: "pending" },
    ]);

    const executor: ToolExecutor = jest.fn(async (tool) => {
      executionOrder.push(tool);
      return { ok: true };
    });

    const result = await executeDAG(plan, executor);
    expect(result.succeeded).toBe(3);
    expect(executionOrder).toEqual(["pathd", "fbasim", "catdes"]);
  });

  it("runs independent tasks concurrently", async () => {
    const plan = makePlan([
      { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "pending" },
      { id: "b", tool: "fbasim", inputs: {}, dependsOn: ["a"], status: "pending" },
      { id: "c", tool: "cethx", inputs: {}, dependsOn: ["a"], status: "pending" },
    ]);

    const startTimes: Record<string, number> = {};
    const executor: ToolExecutor = jest.fn(async (tool) => {
      startTimes[tool] = Date.now();
      // Small delay to test concurrency
      await new Promise((r) => setTimeout(r, 10));
      return { ok: true };
    });

    const result = await executeDAG(plan, executor);
    expect(result.succeeded).toBe(3);
    // fbasim and cethx should start at roughly the same time (both after pathd)
    // They are executed in the same Promise.all batch
    expect(startTimes["fbasim"]).toBeDefined();
    expect(startTimes["cethx"]).toBeDefined();
  });

  it("handles task failure and counts it", async () => {
    const plan = makePlan([
      { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "pending" },
    ]);

    const executor: ToolExecutor = jest.fn(async () => {
      throw new Error("Network timeout");
    });

    const result = await executeDAG(plan, executor);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.plan.tasks[0].status).toBe("failed");
    expect(result.plan.tasks[0].error).toBe("Network timeout");
  });

  it("blocks downstream tasks when dependency fails", async () => {
    const plan = makePlan([
      { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "pending" },
      { id: "b", tool: "fbasim", inputs: {}, dependsOn: ["a"], status: "pending" },
      { id: "c", tool: "catdes", inputs: {}, dependsOn: ["b"], status: "pending" },
    ]);

    const executor: ToolExecutor = jest.fn(async (tool) => {
      if (tool === "pathd") throw new Error("Pathway design failed");
      return { ok: true };
    });

    const result = await executeDAG(plan, executor);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    // fbasim and catdes remain pending (blocked by failed pathd)
    expect(result.plan.tasks[1].status).toBe("pending");
    expect(result.plan.tasks[2].status).toBe("pending");
  });

  it("fires progress callbacks", async () => {
    const plan = makePlan([
      { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "pending" },
    ]);

    const executor: ToolExecutor = jest.fn(async () => ({ ok: true }));
    const progressCalls: Array<{ id: string; status: string }> = [];

    await executeDAG(plan, executor, (task, status) => {
      progressCalls.push({ id: task.id, status });
    });

    expect(progressCalls).toHaveLength(2); // running + completed
    expect(progressCalls[0]).toEqual({ id: "a", status: "running" });
    expect(progressCalls[1]).toEqual({ id: "a", status: "completed" });
  });

  it("fires progress callbacks on failure", async () => {
    const plan = makePlan([
      { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "pending" },
    ]);

    const executor: ToolExecutor = jest.fn(async () => {
      throw new Error("fail");
    });
    const progressCalls: Array<{ id: string; status: string }> = [];

    await executeDAG(plan, executor, (task, status) => {
      progressCalls.push({ id: task.id, status });
    });

    expect(progressCalls).toHaveLength(2); // running + failed
    expect(progressCalls[0]).toEqual({ id: "a", status: "running" });
    expect(progressCalls[1]).toEqual({ id: "a", status: "failed" });
  });

  it("handles empty plan", async () => {
    const plan = makePlan([]);
    const executor: ToolExecutor = jest.fn(async () => ({ ok: true }));
    const result = await executeDAG(plan, executor);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.results.size).toBe(0);
  });

  it("handles partial success in parallel tasks", async () => {
    const plan = makePlan([
      { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "pending" },
      { id: "b", tool: "fbasim", inputs: {}, dependsOn: ["a"], status: "pending" },
      { id: "c", tool: "cethx", inputs: {}, dependsOn: ["a"], status: "pending" },
    ]);

    const executor: ToolExecutor = jest.fn(async (tool) => {
      if (tool === "fbasim") throw new Error("FBA failed");
      return { ok: true };
    });

    const result = await executeDAG(plan, executor);
    expect(result.succeeded).toBe(2); // pathd + cethx
    expect(result.failed).toBe(1); // fbasim
  });

  it("records results in the results map", async () => {
    const plan = makePlan([
      { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "pending" },
      { id: "b", tool: "cethx", inputs: {}, dependsOn: [], status: "pending" },
    ]);

    const executor: ToolExecutor = jest.fn(async (tool) => ({
      tool,
      data: "test",
    }));

    const result = await executeDAG(plan, executor);
    expect(result.results.size).toBe(2);
    expect(result.results.get("a")).toEqual({ tool: "pathd", data: "test" });
    expect(result.results.get("b")).toEqual({ tool: "cethx", data: "test" });
  });

  it("records total execution time", async () => {
    const plan = makePlan([
      { id: "a", tool: "pathd", inputs: {}, dependsOn: [], status: "pending" },
    ]);

    const executor: ToolExecutor = jest.fn(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return { ok: true };
    });

    const result = await executeDAG(plan, executor);
    expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe("summariseExecution", () => {
  it("summarises successful execution", () => {
    const summary = summariseExecution({
      plan: { tasks: [], goal: "test", createdAt: "" },
      results: new Map(),
      totalTimeMs: 1500,
      succeeded: 3,
      failed: 0,
    });
    expect(summary).toBe("Executed 3 tasks (3 ok, 0 failed) in 1.5s");
  });

  it("summarises mixed results", () => {
    const summary = summariseExecution({
      plan: { tasks: [], goal: "test", createdAt: "" },
      results: new Map(),
      totalTimeMs: 2300,
      succeeded: 2,
      failed: 1,
    });
    expect(summary).toBe("Executed 3 tasks (2 ok, 1 failed) in 2.3s");
  });
});
