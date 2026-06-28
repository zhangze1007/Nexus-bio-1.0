/**
 * axonSelfCorrection — error recovery for the Axon DAG executor.
 *
 * When a tool execution fails, the self-correction module analyzes the
 * error and suggests modified parameters for retry. It supports:
 *   - Up to 3 correction attempts per failed task
 *   - Error-pattern-based parameter adjustment
 *   - Context-aware corrections using workbench state
 *   - Learning from previous failed attempts
 *
 * Non-goals:
 *   - No LLM calls for correction (deterministic heuristics)
 *   - No automatic retry — suggestions are returned to the caller
 *   - No side effects — pure function returning correction suggestions
 */

import type { WorkbenchCopilotContext } from "../axonContext";
import type { DAGTask } from "./axonDAGPlanner";

export const MAX_CORRECTION_ATTEMPTS = 3;

export interface CorrectionAttempt {
  originalInput: Record<string, unknown>;
  suggestedInput: Record<string, unknown>;
  reason: string;
  attempt: number;
}

interface CorrectionRule {
  pattern: RegExp;
  adjust: (
    input: Record<string, unknown>,
    context: WorkbenchCopilotContext,
    attempt: number,
  ) => Record<string, unknown>;
  reason: (error: string) => string;
}

/**
 * Correction rules map error patterns to parameter adjustments.
 * Rules are evaluated in order; the first match wins.
 */
const CORRECTION_RULES: CorrectionRule[] = [
  // Empty or missing target product
  {
    pattern: /target.?product.*(empty|missing|not found|unspecified)/i,
    adjust: (input, context, _attempt) => ({
      ...input,
      targetProduct: context.targetProduct ?? "artemisinin",
    }),
    reason: (error) => `Empty target product detected (${error}); injecting workbench target or default`,
  },

  // Infeasible FBA — loosen constraints
  {
    pattern: /infeasible|no feasible|solver.*fail/i,
    adjust: (input, _context, attempt) => ({
      ...input,
      glucoseUptake: 20 * attempt, // progressively increase uptake
      oxygenUptake: 25 * attempt,
      knockouts: [], // clear knockouts on infeasible
    }),
    reason: () => "FBA infeasible; increasing substrate uptake and clearing knockouts",
  },

  // Empty result / no data
  {
    pattern: /no.*(result|data|output|candidate)|empty.*(result|response)/i,
    adjust: (input, _context, attempt) => ({
      ...input,
      // On first retry: add a broader search hint
      // On subsequent retries: simplify inputs
      ...(attempt === 1 ? { hint: "broaden search" } : {}),
      ...(attempt >= 2 ? { species: "ecoli", objective: "biomass" } : {}),
    }),
    reason: () => "Empty result; broadening search parameters",
  },

  // Rate limit or timeout
  {
    pattern: /rate.?limit|timeout|too many|429|503/i,
    adjust: (input, _context, _attempt) => ({
      ...input,
      // Simplify the request to reduce computation
      maxResults: 5,
    }),
    reason: () => "Rate limit or timeout; simplifying request to reduce computation",
  },

  // HTTP/network errors
  {
    pattern: /http\s*(4\d{2}|5\d{2})|network|fetch.*fail|connection/i,
    adjust: (input, _context, _attempt) => ({
      ...input,
      retryWithBackoff: true,
    }),
    reason: () => "Network or server error; suggested retry with backoff",
  },

  // Invalid input parameters
  {
    pattern: /invalid.*(param|input|argument)|bad.*(request|param)/i,
    adjust: (input, context, _attempt) => {
      // Strip non-essential params, keep only known-good fields
      const cleaned: Record<string, unknown> = {};
      const keepFields = ["targetProduct", "species", "objective", "tool"];
      for (const key of keepFields) {
        if (key in input) cleaned[key] = input[key];
      }
      // Add target from context if missing
      if (!cleaned.targetProduct && context.targetProduct) {
        cleaned.targetProduct = context.targetProduct;
      }
      return cleaned;
    },
    reason: () => "Invalid parameters detected; stripping to known-good fields",
  },

  // Binding affinity or catalyst issues
  {
    pattern: /binding.*fail|affinity.*low|no.*binding/i,
    adjust: (input, _context, _attempt) => ({
      ...input,
      minAffinity: 0, // lower the threshold
      expandLibrary: true,
    }),
    reason: () => "Binding affinity issues; lowering threshold and expanding candidate library",
  },

  // Genome/chassis issues
  {
    pattern: /essential.*gene|lethal.*knockout|viability/i,
    adjust: (input, _context, attempt) => ({
      ...input,
      maxKnockouts: Math.max(1, 5 - attempt * 2), // reduce knockouts progressively
    }),
    reason: () => "Essential gene conflict; reducing number of knockouts",
  },
];

/**
 * Attempt to correct a failed task's inputs.
 *
 * Returns a CorrectionAttempt with suggested new inputs, or null if
 * the error pattern is not recognized (no correction possible).
 *
 * @param task — The failed DAG task
 * @param error — The error message from the failed execution
 * @param context — Workbench context for informed corrections
 * @param previousAttempts — Number of previous correction attempts
 */
export function attemptCorrection(
  task: DAGTask,
  error: string,
  context: WorkbenchCopilotContext,
  previousAttempts: number = 0,
): CorrectionAttempt | null {
  // Enforce max correction attempts
  if (previousAttempts >= MAX_CORRECTION_ATTEMPTS) {
    return null;
  }

  const attempt = previousAttempts + 1;

  // Find matching correction rule
  for (const rule of CORRECTION_RULES) {
    if (rule.pattern.test(error)) {
      const suggestedInput = rule.adjust({ ...task.inputs }, context, attempt);

      return {
        originalInput: { ...task.inputs },
        suggestedInput,
        reason: rule.reason(error),
        attempt,
      };
    }
  }

  // No matching rule — generic fallback correction
  if (attempt <= 2) {
    return {
      originalInput: { ...task.inputs },
      suggestedInput: { ...task.inputs, _correctionHint: "retry-simplified" },
      reason: `Unrecognized error pattern; generic retry attempt ${attempt}`,
      attempt,
    };
  }

  return null;
}

/**
 * Check if a correction attempt would change the inputs.
 * Returns false if suggested inputs are identical to original.
 */
export function isCorrectionMeaningful(correction: CorrectionAttempt): boolean {
  return JSON.stringify(correction.suggestedInput) !== JSON.stringify(correction.originalInput);
}

/**
 * Get a human-readable summary of all correction attempts for a task.
 */
export function summariseCorrections(attempts: CorrectionAttempt[]): string {
  if (attempts.length === 0) return "No correction attempts";
  return attempts.map((a) => `Attempt ${a.attempt}: ${a.reason}`).join("; ");
}
