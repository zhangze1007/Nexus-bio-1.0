import type { PredictionRecordV1 } from "../../types/predictionRecord";

/** 每个工具实现一个适配器：workbench payload → 预测记录。 */
export interface ToolPredictionAdapter<TPayload = unknown> {
  toolId: string;
  /** null 表示该 payload 尚不足以产出可比预测。 */
  toPrediction(payload: TPayload, ctx: { runId: string; modelVersion: string }): PredictionRecordV1 | null;
}

/**
 * Resolves a tool's workbench payload (and its model version) for a given run.
 * Injected so `buildPredictionsForRun` stays decoupled from the storage layer
 * (`workbenchDb`) — the app wires a real resolver; tests wire a fixture one.
 * Returning null means the tool did not run / has no comparable payload.
 */
export type RunPayloadResolver = (toolId: string, runId: string) => { payload: unknown; modelVersion: string } | null;

const adapters = new Map<string, ToolPredictionAdapter>();
let runPayloadResolver: RunPayloadResolver = () => null;

export function registerPredictionAdapter(a: ToolPredictionAdapter): void {
  adapters.set(a.toolId, a);
}

/** Set the payload resolver used by buildPredictionsForRun (app wiring / tests). */
export function setRunPayloadResolver(resolver: RunPayloadResolver): void {
  runPayloadResolver = resolver;
}

/** Test/introspection helper. */
export function getRegisteredAdapterIds(): string[] {
  return [...adapters.keys()];
}

/** Test helper: clear registry + resolver so suites do not leak state. */
export function resetPredictionAdapters(): void {
  adapters.clear();
  runPayloadResolver = () => null;
}

export function buildPredictionsForRun(runId: string): PredictionRecordV1[] {
  const records: PredictionRecordV1[] = [];
  for (const adapter of adapters.values()) {
    const resolved = runPayloadResolver(adapter.toolId, runId);
    if (!resolved) continue;
    const record = adapter.toPrediction(resolved.payload, { runId, modelVersion: resolved.modelVersion });
    if (record) records.push(record);
  }
  return records;
}
