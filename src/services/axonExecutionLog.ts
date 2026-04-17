/**
 * axonExecutionLog — typed execution trace.
 *
 * PR-3 fed task outcomes into `axonRuns` (terminal only). PR-4 adds a
 * finer-grained trace that captures every honest lifecycle phase a task
 * goes through, plus plan-level events. This is the data source for the
 * shared live-log UI and for the audit timeline.
 *
 * Rules (non-negotiable):
 *   • No fake token streaming. No "thinking…" theatre. Only phases that
 *     actually occurred get a log entry.
 *   • Every entry carries a timestamp, a phase, and a short message.
 *     Optional metadata is bounded and sanitized.
 *   • Interrupted reloads surface as a distinct `interrupted` phase —
 *     never as `failed` and never as `cancelled`.
 *   • Cancellation is explicit; `cancelled` is separate from `failed`.
 */

export const AXON_LOG_LIMIT = 400;

export type AxonLogPhase =
  | 'plan-created'
  | 'plan-warning'
  | 'planned'
  | 'enqueued'
  | 'context-attached'
  | 'started'
  | 'adapter-invoked'
  | 'writeback-emitted'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted'
  | 'retried'
  | 'reordered'
  | 'blocked-dependency'
  | 'info';

export interface AxonLogEntry {
  id: string;
  timestamp: number;
  phase: AxonLogPhase;
  message: string;
  taskId?: string;
  planId?: string;
  tool?: string;
  metadata?: Record<string, unknown>;
}

const LONG_STRING_CUTOFF = 160;
const METADATA_KEY_CAP = 8;

/**
 * Sanitise metadata for safe storage + rendering. Strips common huge
 * fields (`rawText`, `raw`, `prompt`), truncates long strings, drops
 * non-primitive values. Capped at METADATA_KEY_CAP keys so a noisy
 * adapter can't pollute the log.
 */
export function sanitiseLogMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [key, value] of Object.entries(metadata)) {
    if (n >= METADATA_KEY_CAP) break;
    if (key === 'rawText' || key === 'raw' || key === 'prompt') continue;
    if (value === null) {
      out[key] = null;
      n += 1;
      continue;
    }
    if (typeof value === 'string') {
      out[key] = value.length > LONG_STRING_CUTOFF
        ? `${value.slice(0, LONG_STRING_CUTOFF - 1)}…`
        : value;
      n += 1;
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
      n += 1;
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = `[array len=${value.length}]`;
      n += 1;
    }
  }
  return n === 0 ? undefined : out;
}

export interface BuildLogOptions {
  now?: () => number;
  idFactory?: () => string;
}

export function buildLogEntry(
  input: Omit<AxonLogEntry, 'id' | 'timestamp'> & { timestamp?: number; id?: string },
  options: BuildLogOptions = {},
): AxonLogEntry {
  const now = options.now ?? Date.now;
  const idFactory = options.idFactory ?? (() => `log-${Math.random().toString(36).slice(2, 10)}`);
  return {
    id: input.id ?? idFactory(),
    timestamp: input.timestamp ?? now(),
    phase: input.phase,
    message: input.message,
    taskId: input.taskId,
    planId: input.planId,
    tool: input.tool,
    metadata: sanitiseLogMetadata(input.metadata),
  };
}

/**
 * Append a new entry to the log, respecting the overall cap. Newest
 * entries go to the front so the UI can render a reverse-chronological
 * feed without re-sorting.
 */
export function appendLogEntry(
  log: AxonLogEntry[],
  entry: AxonLogEntry,
  limit: number = AXON_LOG_LIMIT,
): AxonLogEntry[] {
  const next = [entry, ...log];
  if (next.length > limit) next.length = limit;
  return next;
}

/**
 * Short label for a phase, used by the UI. Kept here so the UI never
 * owns the canonical phase list — phases live with the model.
 */
export function phaseLabel(phase: AxonLogPhase): string {
  switch (phase) {
    case 'plan-created': return 'Plan created';
    case 'plan-warning': return 'Plan warning';
    case 'planned': return 'Planned';
    case 'enqueued': return 'Enqueued';
    case 'context-attached': return 'Context attached';
    case 'started': return 'Started';
    case 'adapter-invoked': return 'Adapter invoked';
    case 'writeback-emitted': return 'Writeback';
    case 'completed': return 'Completed';
    case 'failed': return 'Failed';
    case 'cancelled': return 'Cancelled';
    case 'interrupted': return 'Interrupted';
    case 'retried': return 'Retried';
    case 'reordered': return 'Reordered';
    case 'blocked-dependency': return 'Blocked by dependency';
    case 'info': return 'Info';
  }
}
