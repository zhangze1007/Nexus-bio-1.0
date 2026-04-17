/**
 * axonWriteback — typed writeback layer for Axon task outcomes.
 *
 * PR-3 requires that successful PATHD and FBASIM runs publish structured
 * summaries into shared workbench state. The writeback layer lives here,
 * not inside the orchestrator, because the orchestrator is deliberately
 * side-effect-free (only queue state transitions).
 *
 * Writeback rules:
 *   • Never overwrites `toolPayloads[*]`. That slot belongs to the
 *     actual tool page (e.g. PATHD's own workbench page). An Axon run
 *     is a different kind of event and gets its own channel.
 *   • Writes into `axonRuns` (additive ledger, bounded) and calls
 *     `addToolRun(...)` so the run shows up in the existing workbench
 *     audit timeline.
 *   • Only runs on tasks in a terminal state (done / error).
 *   • Carries minimal provenance: taskId, tool, timestamp, status,
 *     compact summary, and the orchestrator-emitted result/error.
 */

import type { AxonTask } from './AxonOrchestrator';
import type { AxonRunRecord } from '../store/workbenchTypes';

export interface AxonWritebackWorkbenchApi {
  appendAxonRun: (record: AxonRunRecord) => void;
  addToolRun: (run: {
    toolId: string;
    title: string;
    summary: string;
    isSimulated: boolean;
  }) => void;
}

function summarisePathd(task: AxonTask): string {
  if (task.status === 'error') return task.error ?? 'PATHD task failed';
  const r = (task.result ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof r.nodeCount === 'number') {
    parts.push(`${r.nodeCount} node${r.nodeCount === 1 ? '' : 's'}`);
  }
  if (typeof r.bottleneckCount === 'number') {
    parts.push(`${r.bottleneckCount} bottleneck${r.bottleneckCount === 1 ? '' : 's'}`);
  }
  if (typeof r.provider === 'string') parts.push(r.provider);
  return parts.join(' · ') || 'PATHD run complete';
}

function summariseFbasim(task: AxonTask): string {
  if (task.status === 'error') return task.error ?? 'FBASIM task failed';
  const r = (task.result ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof r.species === 'string') parts.push(r.species);
  if (typeof r.objective === 'string') parts.push(`obj ${r.objective}`);
  if (typeof r.objectiveValue === 'number') {
    parts.push(`value ${r.objectiveValue.toFixed(3)}`);
  }
  if (typeof r.fluxCount === 'number') parts.push(`${r.fluxCount} flux`);
  return parts.join(' · ') || 'FBASIM run complete';
}

function buildRecord(task: AxonTask, summary: string): AxonRunRecord {
  return {
    taskId: task.id,
    tool: task.tool,
    status: task.status as 'done' | 'error',
    label: task.label,
    summary,
    timestamp: task.finishedAt ?? Date.now(),
    provenance: {
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      retryCount: task.retryCount,
    },
    resultPreview: task.status === 'done' ? sanitiseResultPreview(task.result) : null,
    error: task.status === 'error' ? task.error ?? null : null,
  };
}

/**
 * Strip huge blobs (e.g. rawText) from the result preview so the ledger
 * stays bounded. Callers that need the raw payload should keep their
 * own reference to the task; the ledger is for inspection, not replay.
 */
function sanitiseResultPreview(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;
  const preview: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(r)) {
    if (key === 'rawText' || key === 'raw') continue;
    if (typeof value === 'string' && value.length > 200) {
      preview[key] = `${value.slice(0, 199)}…`;
      continue;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      preview[key] = value;
    }
  }
  return preview;
}

/**
 * Publish a terminal task into shared workbench state. Pending/running
 * tasks are ignored — only `done` and `error` are meaningful outcomes.
 */
export function publishTaskOutcome(task: AxonTask, api: AxonWritebackWorkbenchApi): void {
  if (task.status !== 'done' && task.status !== 'error') return;

  let summary: string;
  if (task.tool === 'pathd') summary = summarisePathd(task);
  else if (task.tool === 'fbasim') summary = summariseFbasim(task);
  else summary = task.status === 'error' ? task.error ?? 'Axon task failed' : 'Axon task complete';

  const record = buildRecord(task, summary);
  api.appendAxonRun(record);

  api.addToolRun({
    toolId: task.tool,
    title: `Axon · ${task.tool.toUpperCase()}`,
    summary: task.status === 'error' ? `Axon error: ${summary}` : `Axon automation · ${summary}`,
    isSimulated: false,
  });
}
