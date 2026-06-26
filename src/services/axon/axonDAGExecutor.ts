/**
 * axonDAGExecutor — parallel DAG execution engine.
 *
 * Executes a DAG plan produced by axonDAGPlanner. Key behaviors:
 *   - Independent tasks run concurrently (Promise.all)
 *   - Dependent tasks wait for their predecessors
 *   - Failed tasks block downstream dependents
 *   - Execution continues until no more tasks can run
 *   - Progress callbacks fire for each task state change
 *
 * Non-goals:
 *   - No persistence — execution state lives in memory
 *   - No retry logic (handled by axonSelfCorrection)
 *   - No LLM calls — execution delegates to tool adapters
 */

import type {
  DAGPlan,
  DAGTask,
  DAGTaskStatus,
} from "./axonDAGPlanner";
import {
  getExecutableTasks,
  markTaskComplete,
  markTaskFailed,
  markTaskRunning,
  hasRemainingTasks,
} from "./axonDAGPlanner";

export interface ExecutionResult {
  plan: DAGPlan;
  results: Map<string, unknown>;
  totalTimeMs: number;
  succeeded: number;
  failed: number;
}

export type ToolExecutor = (
  tool: string,
  inputs: Record<string, unknown>,
) => Promise<unknown>;

export type ProgressCallback = (task: DAGTask, status: string) => void;

/**
 * Execute a DAG plan to completion.
 *
 * Tasks are processed in topological order. At each level, all executable
 * tasks (whose dependencies are satisfied) are launched concurrently.
 * The executor halts when no more tasks can make progress.
 *
 * @param plan — The DAG plan to execute
 * @param executor — Function that runs a tool with given inputs
 * @param onProgress — Optional callback for task state changes
 */
export async function executeDAG(
  plan: DAGPlan,
  executor: ToolExecutor,
  onProgress?: ProgressCallback,
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const results = new Map<string, unknown>();
  let currentPlan: DAGPlan = { ...plan };
  let succeeded = 0;
  let failed = 0;
  let maxIterations = plan.tasks.length + 1; // safety bound

  while (hasRemainingTasks(currentPlan) && maxIterations > 0) {
    maxIterations--;
    const executable = getExecutableTasks(currentPlan);

    if (executable.length === 0) {
      // No executable tasks — either all done or stuck on failed deps
      break;
    }

    // Mark all executable tasks as running
    for (const task of executable) {
      currentPlan = markTaskRunning(currentPlan, task.id);
      if (onProgress) {
        const runningTask = currentPlan.tasks.find((t) => t.id === task.id);
        if (runningTask) onProgress(runningTask, "running");
      }
    }

    // Execute all executable tasks concurrently
    const taskPromises = executable.map(async (task) => {
      try {
        const result = await executor(task.tool, task.inputs);
        return { taskId: task.id, result, error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { taskId: task.id, result: null, error: message };
      }
    });

    const outcomes = await Promise.all(taskPromises);

    // Apply outcomes to the plan
    for (const outcome of outcomes) {
      if (outcome.error) {
        currentPlan = markTaskFailed(currentPlan, outcome.taskId, outcome.error);
        failed++;
        if (onProgress) {
          const failedTask = currentPlan.tasks.find((t) => t.id === outcome.taskId);
          if (failedTask) onProgress(failedTask, "failed");
        }
      } else {
        currentPlan = markTaskComplete(currentPlan, outcome.taskId, outcome.result);
        results.set(outcome.taskId, outcome.result);
        succeeded++;
        if (onProgress) {
          const completedTask = currentPlan.tasks.find((t) => t.id === outcome.taskId);
          if (completedTask) onProgress(completedTask, "completed");
        }
      }
    }
  }

  return {
    plan: currentPlan,
    results,
    totalTimeMs: Date.now() - startTime,
    succeeded,
    failed,
  };
}

/**
 * Get a summary string of the execution result.
 */
export function summariseExecution(result: ExecutionResult): string {
  const total = result.succeeded + result.failed;
  const timeS = (result.totalTimeMs / 1000).toFixed(1);
  return `Executed ${total} tasks (${result.succeeded} ok, ${result.failed} failed) in ${timeS}s`;
}
