/**
 * axonAutonomyLoop — bounded autonomy loop for NEXAI AI Agent.
 *
 * Implements Hermes/OpenClaw-style autonomous task execution:
 * - Automatically executes next plan step when current step completes
 * - Retries failed tasks up to MAX_RETRIES times
 * - Halts when plan is complete or max steps reached
 * - All decisions are logged for transparency
 *
 * Safety limits:
 * - Max auto-steps: AUTONOMY_MAX_STEPS (8)
 * - Max retries per task: AUTONOMY_MAX_RETRIES (2)
 * - Max total retries: AUTONOMY_MAX_TOTAL_RETRIES (5)
 */

import type { AxonPlan } from './axonPlanner';
import type { AxonTask } from './AxonOrchestrator';

export const AUTONOMY_MAX_STEPS = 8;
export const AUTONOMY_MAX_RETRIES = 2;
export const AUTONOMY_MAX_TOTAL_RETRIES = 5;

export interface AutonomyDecisionContext {
  plan: AxonPlan | null;
  tasks: AxonTask[];
  /** How many auto-generated steps have fired so far. */
  autoStepsTaken: number;
  /** Retries initiated by the loop (not by user / not by adapter bounce). */
  autoRetries: number;
}

export type AutonomyDecision =
  | { action: 'idle'; reason: string }
  | { action: 'run-next-step'; reason: string; taskId: string }
  | { action: 'retry-task'; reason: string; taskId: string }
  | { action: 'halt'; reason: string };

export interface AutonomyLoop {
  readonly enabled: boolean;
  /** Short human label surfaced in the UI ("off", "manual only", etc.). */
  readonly label: string;
  decide(ctx: AutonomyDecisionContext): AutonomyDecision;
}

/**
 * Noop autonomy loop — always returns idle.
 * Used when agentic mode is disabled.
 */
export const noopAutonomyLoop: AutonomyLoop = {
  enabled: false,
  label: 'Manual only — autonomy disabled',
  decide() {
    return { action: 'idle', reason: 'Autonomy disabled.' };
  },
};

/**
 * Bounded autonomy loop — automatically executes plan steps.
 *
 * Decision logic:
 * 1. If plan is null or no tasks → idle
 * 2. If max auto-steps reached → halt
 * 3. If any task is running → idle (wait for completion)
 * 4. If any task failed and can be retried → retry-task
 * 5. If next pending task exists and dependencies met → run-next-step
 * 6. If all tasks done → halt
 * 7. Otherwise → idle
 */
export const boundedAutonomyLoop: AutonomyLoop = {
  enabled: true,
  label: 'Bounded autonomy — auto-executes plan steps',
  decide(ctx: AutonomyDecisionContext): AutonomyDecision {
    const { plan, tasks, autoStepsTaken, autoRetries } = ctx;

    // No plan or no tasks
    if (!plan || tasks.length === 0) {
      return { action: 'idle', reason: 'No plan or tasks to execute.' };
    }

    // Max auto-steps reached
    if (autoStepsTaken >= AUTONOMY_MAX_STEPS) {
      return {
        action: 'halt',
        reason: `Maximum auto-steps (${AUTONOMY_MAX_STEPS}) reached. Manual intervention required.`,
      };
    }

    // Max total retries reached
    if (autoRetries >= AUTONOMY_MAX_TOTAL_RETRIES) {
      return {
        action: 'halt',
        reason: `Maximum total retries (${AUTONOMY_MAX_TOTAL_RETRIES}) reached. Stopping to prevent infinite loops.`,
      };
    }

    // Check if any task is currently running
    const runningTask = tasks.find(t => t.status === 'running');
    if (runningTask) {
      return {
        action: 'idle',
        reason: `Task "${runningTask.label}" is still running. Waiting for completion.`,
      };
    }

    // Check for failed tasks that can be retried
    const failedTask = tasks.find(t =>
      t.status === 'error' &&
      t.retryCount < (t.maxRetries ?? AUTONOMY_MAX_RETRIES)
    );
    if (failedTask) {
      return {
        action: 'retry-task',
        reason: `Task "${failedTask.label}" failed (attempt ${failedTask.retryCount + 1}/${failedTask.maxRetries ?? AUTONOMY_MAX_RETRIES}). Retrying.`,
        taskId: failedTask.id,
      };
    }

    // Find next pending task whose dependencies are satisfied
    const byId = new Map(tasks.map(t => [t.id, t]));
    const nextTask = tasks.find(t => {
      if (t.status !== 'pending') return false;
      if (!t.dependsOn || t.dependsOn.length === 0) return true;
      return t.dependsOn.every(depId => byId.get(depId)?.status === 'done');
    });

    if (nextTask) {
      return {
        action: 'run-next-step',
        reason: `Running step: ${nextTask.label}`,
        taskId: nextTask.id,
      };
    }

    // Check if all tasks are done
    const allDone = tasks.every(t => t.status === 'done' || t.status === 'cancelled');
    if (allDone) {
      return {
        action: 'halt',
        reason: 'All plan steps completed successfully.',
      };
    }

    // Check for blocked tasks (dependencies failed)
    const blockedTask = tasks.find(t => {
      if (t.status !== 'pending') return false;
      if (!t.dependsOn || t.dependsOn.length === 0) return false;
      return t.dependsOn.some(depId => {
        const dep = byId.get(depId);
        return dep?.status === 'error' || dep?.status === 'cancelled';
      });
    });

    if (blockedTask) {
      return {
        action: 'halt',
        reason: `Task "${blockedTask.label}" is blocked by a failed dependency. Manual intervention required.`,
      };
    }

    return { action: 'idle', reason: 'No actionable tasks at this time.' };
  },
};

// ── Workflow Control Plane bridge ───────────────────────────────────────
//
// Phase-1 addition. The Axon autonomy loop above answers a narrow
// question: "should the orchestrator auto-fire the next plan step?".
// The Workflow Control Plane needs a richer surface: workflow state,
// missing evidence, confidence/uncertainty, human gate, next recommended
// node. We expose that surface here as a separate seam so consumers can
// import a single module instead of reaching across services.

import {
  buildWorkflowDecision,
  type WorkflowDecision,
  type WorkflowSupervisorInput,
} from './workflowSupervisor';

export interface WorkflowSupervisorBridge {
  readonly enabled: boolean;
  readonly label: string;
  decide(input: WorkflowSupervisorInput): WorkflowDecision;
}

/**
 * Default bridge — delegates to the deterministic workflowSupervisor.
 * Tests and provider wiring import this to reach the supervisor without
 * pulling workflowSupervisor.ts into every call site.
 */
export const workflowSupervisorBridge: WorkflowSupervisorBridge = {
  enabled: true,
  label: 'Deterministic workflow supervisor (no LLM call)',
  decide(input) {
    return buildWorkflowDecision(input);
  },
};
