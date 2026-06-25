/**
 * toolDependencyValidator — checks whether upstream tool payloads exist
 * in the workbench store before a downstream tool can run meaningfully.
 *
 * Reads from the canonical WORKFLOW_CONTRACTS registry which defines
 * requiredInputs for each tool. Returns a structured validation result
 * indicating which dependencies are missing or stale.
 */

import type { ToolId } from "../domain/workflowContract";
import { WORKFLOW_CONTRACTS } from "./workflowRegistry";

/** Payloads may be any shape; we only check existence and freshness. */
type PayloadRecord = Record<string, { updatedAt?: number } | undefined>;

export interface DependencyValidation {
  /** 'ok' when all required inputs are present and fresh. */
  status: "ok" | "missing" | "stale";
  /** Tool ids whose payloads are entirely absent. */
  missing: string[];
  /** Tool ids whose payloads exist but are older than the staleness threshold. */
  stale: string[];
}

/**
 * Payloads older than this are considered stale (ms).
 * 30 minutes — long enough for normal work sessions, short enough to
 * catch genuinely outdated data after a long break.
 */
const STALE_THRESHOLD_MS = 30 * 60 * 1000;

/**
 * Validate whether all required upstream payloads exist and are fresh
 * for the given tool.
 *
 * @param toolId  — the tool being opened / run
 * @param payloads — the current `toolPayloads` map from the workbench store
 * @returns structured validation with missing/stale lists
 */
export function validateDependencies(toolId: string, payloads: PayloadRecord): DependencyValidation {
  const contract = (WORKFLOW_CONTRACTS as Record<string, { requiredInputs?: Array<{ toolId: string }> }>)[toolId];

  // Unknown tool or tool with no contract — nothing to validate.
  if (!contract) {
    return { status: "ok", missing: [], stale: [] };
  }

  const requiredInputs = contract.requiredInputs ?? [];

  // Tool has no required inputs — always ok.
  if (requiredInputs.length === 0) {
    return { status: "ok", missing: [], stale: [] };
  }

  const missing: string[] = [];
  const stale: string[] = [];
  const now = Date.now();

  for (const input of requiredInputs) {
    const upstreamId = input.toolId;
    const payload = payloads[upstreamId];

    if (!payload) {
      missing.push(upstreamId);
    } else if (typeof payload.updatedAt === "number" && now - payload.updatedAt > STALE_THRESHOLD_MS) {
      stale.push(upstreamId);
    }
  }

  if (missing.length > 0) {
    return { status: "missing", missing, stale };
  }
  if (stale.length > 0) {
    return { status: "stale", missing, stale };
  }
  return { status: "ok", missing: [], stale: [] };
}

/**
 * Convenience: get the list of required upstream tool ids for a given tool.
 * Returns an empty array for unknown tools or tools with no dependencies.
 */
export function getRequiredUpstreamIds(toolId: string): string[] {
  const contract = (WORKFLOW_CONTRACTS as Record<string, { requiredInputs?: Array<{ toolId: string }> }>)[toolId];
  if (!contract) return [];
  return (contract.requiredInputs ?? []).map((r) => r.toolId);
}

/**
 * Convenience: get the list of optional upstream tool ids for a given tool.
 */
export function getOptionalUpstreamIds(toolId: string): string[] {
  const contract = (WORKFLOW_CONTRACTS as Record<string, { optionalInputs?: Array<{ toolId: string }> }>)[toolId];
  if (!contract) return [];
  return (contract.optionalInputs ?? []).map((r) => r.toolId);
}
