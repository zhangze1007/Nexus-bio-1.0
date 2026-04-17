/** @jest-environment node */
/**
 * axonWriteback — terminal-task → workbench ledger bridge.
 * These tests lock the writeback contract: non-terminal ignored, done
 * and error emit an AxonRunRecord + a workbench tool-run entry, and
 * oversized result strings are trimmed out of the preview.
 */
import type { AxonTask } from '../src/services/AxonOrchestrator';
import {
  publishTaskOutcome,
  type AxonWritebackWorkbenchApi,
} from '../src/services/axonWriteback';

function makeApi() {
  const axonRuns: any[] = [];
  const toolRuns: any[] = [];
  const api: AxonWritebackWorkbenchApi = {
    appendAxonRun: (r) => axonRuns.push(r),
    addToolRun: (r) => toolRuns.push(r),
  };
  return { api, axonRuns, toolRuns };
}

function baseTask(overrides: Partial<AxonTask> = {}): AxonTask {
  return {
    id: 'task-1',
    tool: 'pathd',
    label: 'Design pathway for artemisinin',
    input: { targetProduct: 'artemisinin' },
    status: 'done',
    retryCount: 0,
    maxRetries: 2,
    createdAt: 100,
    startedAt: 110,
    finishedAt: 120,
    result: { nodeCount: 7, bottleneckCount: 2, provider: 'groq' },
    ...overrides,
  };
}

describe('publishTaskOutcome', () => {
  it('ignores non-terminal tasks', () => {
    const { api, axonRuns, toolRuns } = makeApi();
    publishTaskOutcome(baseTask({ status: 'pending' }), api);
    publishTaskOutcome(baseTask({ status: 'running' }), api);
    expect(axonRuns).toHaveLength(0);
    expect(toolRuns).toHaveLength(0);
  });

  it('emits an AxonRunRecord and a workbench tool-run on success', () => {
    const { api, axonRuns, toolRuns } = makeApi();
    publishTaskOutcome(baseTask(), api);
    expect(axonRuns).toHaveLength(1);
    const rec = axonRuns[0];
    expect(rec.taskId).toBe('task-1');
    expect(rec.tool).toBe('pathd');
    expect(rec.status).toBe('done');
    expect(rec.summary).toContain('7 nodes');
    expect(rec.summary).toContain('2 bottlenecks');
    expect(rec.summary).toContain('groq');
    expect(rec.provenance).toEqual({ createdAt: 100, startedAt: 110, retryCount: 0 });
    expect(rec.resultPreview).toEqual({ nodeCount: 7, bottleneckCount: 2, provider: 'groq' });
    expect(rec.error).toBeNull();

    expect(toolRuns).toHaveLength(1);
    expect(toolRuns[0].toolId).toBe('pathd');
    expect(toolRuns[0].isSimulated).toBe(false);
    expect(toolRuns[0].summary.toLowerCase()).toContain('axon automation');
  });

  it('emits an error record when the task failed', () => {
    const { api, axonRuns, toolRuns } = makeApi();
    publishTaskOutcome(
      baseTask({ status: 'error', error: 'Groq 429', result: undefined }),
      api,
    );
    expect(axonRuns).toHaveLength(1);
    expect(axonRuns[0].status).toBe('error');
    expect(axonRuns[0].error).toBe('Groq 429');
    expect(axonRuns[0].resultPreview).toBeNull();
    expect(toolRuns[0].summary.toLowerCase()).toContain('axon error');
  });

  it('strips rawText and truncates long result strings in the preview', () => {
    const { api, axonRuns } = makeApi();
    const bigString = 'x'.repeat(500);
    publishTaskOutcome(
      baseTask({ result: { provider: 'groq', rawText: bigString, bigField: bigString } }),
      api,
    );
    const preview = axonRuns[0].resultPreview!;
    expect(preview.rawText).toBeUndefined();
    expect(typeof preview.bigField).toBe('string');
    expect((preview.bigField as string).length).toBeLessThanOrEqual(200);
    expect((preview.bigField as string).endsWith('…')).toBe(true);
  });
});
