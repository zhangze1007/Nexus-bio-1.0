import type { ExperimentRecordV1 } from "../../types/experimentRecord";
import { validateExperimentRecordV1 } from "../../validation/experimentRecordValidator";
import type { AssayPull } from "./benchlingClient";
import { type AssayRecordContext, assayPullToExperimentRecord } from "./resultToExperimentRecord";

export interface SyncReport {
  pushed: number;
  pulled: number;
  recordsCreated: number;
  errors: string[];
}

/** Minimal pull contract shared by BenchlingClient and GenericLIMSAdapter. */
export interface PullClient {
  pullAssayResults(params: { batchId?: string; since?: string }): Promise<AssayPull[]>;
}

export interface SyncDeps {
  client?: PullClient;
  params?: { batchId?: string; since?: string };
  /** Join a pull to design identity (via entityMap / P1-1 manifest); null skips the record. */
  resolveContext?: (pull: AssayPull) => AssayRecordContext | null;
  /** Persistence hook invoked for each validated record. */
  onRecord?: (record: ExperimentRecordV1) => void;
  /** Optional push side; returns the number pushed. */
  pushFn?: () => Promise<number>;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Orchestrate push/pull sync. Dependencies are injected (no real network). Pull
 * results become ExperimentRecordV1 (sourceType `wet-lab`); only records passing
 * validateExperimentRecordV1 are counted and handed to `onRecord`.
 */
export async function runSync(
  configId: string,
  direction: "push" | "pull" | "bidirectional",
  deps: SyncDeps,
): Promise<SyncReport> {
  const report: SyncReport = { pushed: 0, pulled: 0, recordsCreated: 0, errors: [] };

  if ((direction === "push" || direction === "bidirectional") && deps.pushFn) {
    try {
      report.pushed = await deps.pushFn();
    } catch (e) {
      report.errors.push(`push(${configId}): ${errMsg(e)}`);
    }
  }

  if ((direction === "pull" || direction === "bidirectional") && deps.client && deps.resolveContext) {
    try {
      const pulls = await deps.client.pullAssayResults(deps.params ?? {});
      report.pulled = pulls.length;
      for (const pull of pulls) {
        const ctx = deps.resolveContext(pull);
        if (!ctx) {
          report.errors.push(`no identity join for external id "${pull.externalId}"`);
          continue;
        }
        const record = assayPullToExperimentRecord(pull, ctx);
        const validation = validateExperimentRecordV1(record);
        if (!validation.ok) {
          const codes = validation.issues
            .filter((i) => i.severity === "error")
            .map((i) => i.code)
            .join(",");
          report.errors.push(`invalid record "${record.recordId}": ${codes}`);
          continue;
        }
        report.recordsCreated++;
        deps.onRecord?.(record);
      }
    } catch (e) {
      report.errors.push(`pull(${configId}): ${errMsg(e)}`);
    }
  }

  return report;
}
