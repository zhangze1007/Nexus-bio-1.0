/**
 * Confidence Engine — Layer 4 of NEXAI Cognitive Kernel
 *
 * Merges confidence signals from all layers into a single unified score:
 *   - Solver confidence (from pipeline convergence/status)
 *   - Citation confidence (from citation verification)
 *   - Workflow confidence (from workflow supervisor)
 *   - LLM self-report (from response analysis)
 *
 * Every confidence value is traceable to a source.
 */

// ── Confidence Components ──────────────────────────────────────────────────

export interface ConfidenceComponents {
  solver: number; // 0-1, from solver convergence/status
  citation: number; // 0-1, from citation verification
  workflow: number; // 0-1, from workflow supervisor
  llmSelfReport: number; // 0-1, from response analysis
}

export interface ConfidenceResult {
  overall: number; // 0-1, weighted composite
  level: "high" | "medium" | "low";
  components: ConfidenceComponents;
  sources: string[]; // traceable sources for each component
  badge: string; // display badge: 🟢 / 🟡 / 🔴
}

// ── Solver Confidence ──────────────────────────────────────────────────────

/**
 * Extract confidence from solver output.
 * Based on solver convergence, status, and result quality.
 */
export function extractSolverConfidence(solverResult: unknown, solverName: string): { score: number; source: string } {
  if (!solverResult || typeof solverResult !== "object") {
    return { score: 0.3, source: `${solverName}: no result` };
  }

  const r = solverResult as Record<string, unknown>;

  // FBA: feasible = high confidence
  if (r.feasible !== undefined) {
    const feasible = r.feasible as boolean;
    const growthRate = (r.growthRate as number) ?? 0;
    if (feasible && growthRate > 0) return { score: 0.9, source: `${solverName}: feasible, growth=${growthRate}` };
    if (feasible) return { score: 0.7, source: `${solverName}: feasible, no growth` };
    return { score: 0.3, source: `${solverName}: infeasible` };
  }

  // Robustness: overall score
  if (r.overallRobustness !== undefined) {
    return { score: r.overallRobustness as number, source: `${solverName}: robustness=${r.overallRobustness}` };
  }

  // Circuit: stability
  if (r.judge) {
    const j = r.judge as Record<string, unknown>;
    if (j.recommendedStable) return { score: 0.85, source: `${solverName}: stable circuit` };
    return { score: 0.4, source: `${solverName}: unstable circuit` };
  }

  // Thermodynamic: feasibility
  if (r.overallFeasible !== undefined) {
    return { score: r.overallFeasible ? 0.85 : 0.3, source: `${solverName}: feasible=${r.overallFeasible}` };
  }

  // Control: convergence
  if (r.performance) {
    const p = r.performance as Record<string, number>;
    if (p.isStable) return { score: 0.85, source: `${solverName}: stable, settling=${p.settlingTime}min` };
    return { score: 0.4, source: `${solverName}: unstable` };
  }

  // Pareto: number of solutions
  if (r.paretoFront) {
    const front = r.paretoFront as unknown[];
    if (front.length > 3) return { score: 0.8, source: `${solverName}: ${front.length} Pareto solutions` };
    if (front.length > 0) return { score: 0.6, source: `${solverName}: ${front.length} Pareto solutions` };
    return { score: 0.3, source: `${solverName}: no Pareto solutions` };
  }

  // Default: moderate confidence
  return { score: 0.5, source: `${solverName}: generic result` };
}

// ── Citation Confidence ────────────────────────────────────────────────────

/**
 * Compute confidence from citation verification results.
 */
export function computeCitationConfidence(citations: Array<{ verificationStatus?: string; relevance?: number }>): {
  score: number;
  source: string;
} {
  if (!citations || citations.length === 0) {
    return { score: 0.3, source: "No citations" };
  }

  const verified = citations.filter((c) => c.verificationStatus === "verified").length;
  const total = citations.length;
  const verificationRate = verified / total;

  if (verificationRate > 0.7) return { score: 0.9, source: `${verified}/${total} citations verified` };
  if (verificationRate > 0.3) return { score: 0.7, source: `${verified}/${total} citations verified` };
  return { score: 0.4, source: `Only ${verified}/${total} citations verified` };
}

// ── Workflow Confidence ────────────────────────────────────────────────────

/**
 * Compute confidence from workflow supervisor state.
 */
export function computeWorkflowConfidence(
  workflowStatus?: string,
  toolConfidence?: number | null,
): { score: number; source: string } {
  if (!workflowStatus) return { score: 0.5, source: "No workflow context" };

  switch (workflowStatus) {
    case "complete":
      return { score: 0.95, source: "Workflow complete" };
    case "ready":
      return { score: 0.8, source: "Workflow ready" };
    case "blocked":
      return { score: 0.3, source: "Workflow blocked" };
    case "gated":
      return { score: 0.4, source: "Workflow gated" };
    case "demoOnly":
      return { score: 0.2, source: "Demo data only" };
    default:
      return { score: 0.5, source: `Workflow: ${workflowStatus}` };
  }
}

// ── LLM Self-Report Confidence ─────────────────────────────────────────────

/**
 * Estimate confidence from LLM response characteristics.
 * This is the least reliable signal — it's a heuristic.
 */
export function estimateLLMConfidence(responseText: string): { score: number; source: string } {
  if (!responseText) return { score: 0.1, source: "Empty response" };

  let score = 0.5;
  const lower = responseText.toLowerCase();

  // Boost: specific numbers
  if (/\d+\.?\d*/.test(responseText)) score += 0.1;

  // Boost: citations or references
  if (/doi|pmid|pubmed|reference|et al/i.test(responseText)) score += 0.1;

  // Boost: solver trace mentioned
  if (/solver|computed|calculated|FBA|pipeline/i.test(responseText)) score += 0.1;

  // Penalty: hedging language
  if (/might|maybe|possibly|not sure|uncertain|i think/i.test(lower)) score -= 0.15;

  // Penalty: very short response
  if (responseText.length < 100) score -= 0.1;

  return {
    score: Math.max(0.1, Math.min(0.9, score)),
    source: `LLM response analysis (${responseText.length} chars)`,
  };
}

// ── Unified Confidence ─────────────────────────────────────────────────────

/**
 * Compute unified confidence from all components.
 *
 * Weights:
 *   solver: 0.40 (most reliable — real computation)
 *   citation: 0.20 (external verification)
 *   workflow: 0.20 (process state)
 *   llmSelfReport: 0.20 (least reliable — heuristic)
 */
export function computeUnifiedConfidence(components: Partial<ConfidenceComponents>): ConfidenceResult {
  const weights = { solver: 0.4, citation: 0.2, workflow: 0.2, llmSelfReport: 0.2 };
  const defaults = { solver: 0.3, citation: 0.3, workflow: 0.5, llmSelfReport: 0.5 };

  const solver = components.solver ?? defaults.solver;
  const citation = components.citation ?? defaults.citation;
  const workflow = components.workflow ?? defaults.workflow;
  const llmSelfReport = components.llmSelfReport ?? defaults.llmSelfReport;

  const overall =
    Math.round(
      (solver * weights.solver +
        citation * weights.citation +
        workflow * weights.workflow +
        llmSelfReport * weights.llmSelfReport) *
        100,
    ) / 100;

  const level: "high" | "medium" | "low" = overall > 0.7 ? "high" : overall > 0.4 ? "medium" : "low";

  const badge = level === "high" ? "🟢" : level === "medium" ? "🟡" : "🔴";

  const sources: string[] = [];
  if (components.solver !== undefined) sources.push(`Solver: ${components.solver}`);
  if (components.citation !== undefined) sources.push(`Citation: ${components.citation}`);
  if (components.workflow !== undefined) sources.push(`Workflow: ${components.workflow}`);
  if (components.llmSelfReport !== undefined) sources.push(`LLM: ${components.llmSelfReport}`);

  return {
    overall,
    level,
    components: { solver, citation, workflow, llmSelfReport },
    sources,
    badge,
  };
}

/**
 * Convenience: compute confidence from a full executor result.
 */
export function computeConfidenceFromResult(
  solverResult: unknown,
  solverName: string,
  citations: Array<{ verificationStatus?: string; relevance?: number }>,
  workflowStatus?: string,
  llmResponse?: string,
): ConfidenceResult {
  const solver = extractSolverConfidence(solverResult, solverName);
  const citation = computeCitationConfidence(citations);
  const workflow = computeWorkflowConfidence(workflowStatus);
  const llm = llmResponse ? estimateLLMConfidence(llmResponse) : { score: 0.5, source: "No LLM response" };

  return computeUnifiedConfidence({
    solver: solver.score,
    citation: citation.score,
    workflow: workflow.score,
    llmSelfReport: llm.score,
  });
}
