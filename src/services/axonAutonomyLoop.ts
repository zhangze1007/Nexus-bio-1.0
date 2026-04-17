/**
 * axonAutonomyLoop — bounded autonomy loop extension seam.
 *
 * PR-4 brief (section E): "Allow optional limited autonomous
 * continuation, but only within strict limits… If safety/clarity is
 * not solid, do not implement this yet; leave a documented extension
 * seam instead."
 *
 * Decision for PR-4: we are shipping the seam, not the loop. Reasons:
 *
 *   1. Deterministic planner + explicit per-step writeback + live logs
 *      are the preconditions for honest autonomy. They landed in this
 *      PR. Wiring a loop on top without field testing them first risks
 *      the exact "fake autonomy" failure mode the brief forbids.
 *
 *   2. The current planner proposes at most two steps
 *      (PATHD → FBASIM). Autonomy would add zero value over letting
 *      the existing dependency scheduler drain the plan.
 *
 *   3. "Easy to stop" and "each auto-generated next step must show why
 *      it was created" both require UI affordances we have not yet
 *      shipped. Building those without a real autonomy use-case would
 *      be speculative.
 *
 * This file defines the contract a future autonomous continuation must
 * satisfy. It exports a `noopAutonomyLoop` implementation so callers can
 * thread the seam without behavior changes.
 */

import type { AxonPlan } from './axonPlanner';
import type { AxonTask } from './AxonOrchestrator';

export const AUTONOMY_MAX_STEPS = 8;
export const AUTONOMY_MAX_RETRIES = 2;

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
  | { action: 'plan-next-step'; reason: string; tool: 'pathd' | 'fbasim' }
  | { action: 'retry-task'; reason: string; taskId: string }
  | { action: 'halt'; reason: string };

export interface AutonomyLoop {
  readonly enabled: boolean;
  /** Short human label surfaced in the UI ("off", "manual only", etc.). */
  readonly label: string;
  decide(ctx: AutonomyDecisionContext): AutonomyDecision;
}

/**
 * Ships disabled. Always returns `idle`. The field `reason` is the
 * honest user-facing message: "no autonomy implemented".
 */
export const noopAutonomyLoop: AutonomyLoop = {
  enabled: false,
  label: 'Manual only — autonomy seam, not implemented',
  decide() {
    return {
      action: 'idle',
      reason:
        'Bounded autonomy is a PR-5 candidate — the seam exists but no auto-decisions fire.',
    };
  },
};
