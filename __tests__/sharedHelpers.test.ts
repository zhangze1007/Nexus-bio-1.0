/**
 * Tests for src/store/slices/sharedHelpers.ts
 *
 * Covers:
 * - buildCanonicalSlice — pure function that extracts serializable state
 * - requestCanonicalState — mock fetch, test success/error/timeout paths
 * - buildCanonicalPatchFromWorkflowArtifact — pure function
 */

// Polyfill fetch / Request / Response for jsdom
const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

// We need minimal Headers support for the Response mock
class MockHeaders {
  private store: Record<string, string> = {};
  get(key: string) { return this.store[key.toLowerCase()] ?? null; }
  set(key: string, value: string) { this.store[key.toLowerCase()] = value; }
}
(globalThis as any).Headers = MockHeaders;

// Minimal localStorage mock
const localStorageMock = (() => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

import {
  buildCanonicalSlice,
  requestCanonicalState,
  buildCanonicalPatchFromWorkflowArtifact,
  isValidPersistedWorkflowArtifact,
  summarizeWorkflowArtifactDebug,
} from '../src/store/slices/sharedHelpers';
import type { WorkbenchCanonicalState } from '../src/store/workbenchTypes';
import type { WorkflowArtifact } from '../src/domain/workflowArtifact';

// ── Helpers ──
function makeMinimalCanonicalState(overrides?: Partial<WorkbenchCanonicalState>): WorkbenchCanonicalState {
  return {
    schemaVersion: 1,
    revision: 0,
    lastMutationAt: 0,
    activeArtifactId: null,
    project: null,
    evidenceItems: [],
    selectedEvidenceIds: [],
    draftAnalyzeInput: '',
    workflowArtifact: null,
    analyzeArtifact: null,
    toolRuns: [],
    toolPayloads: {},
    payloadAdmissionDecisionsByToolId: {},
    runArtifacts: [],
    checkpoints: [],
    nextRecommendations: [],
    workflowControl: {
      machineState: 'idle',
      status: 'idle',
      currentToolId: null,
      nextRecommendedNode: 'pathd',
      missingEvidence: { minRequired: 0, have: 0, kinds: [] },
      confidence: null,
      uncertainty: null,
      validity: null,
      humanGateRequired: false,
      nextNodeIsContractOnly: false,
      isDemoOnly: false,
      latestRunStatus: null,
      latestRunToolId: null,
      reasonCodes: ['NO_TARGET'],
      explanation: 'No target product set.',
      iteration: 0,
      updatedAt: Date.now(),
    },
    ...overrides,
  } as WorkbenchCanonicalState;
}

function makeMinimalWorkflowArtifact(overrides?: Partial<WorkflowArtifact>): WorkflowArtifact {
  return {
    id: 'wf-1',
    schemaVersion: 1,
    version: 1,
    status: 'compiled',
    sourcePage: 'analyze',
    intake: { rawAnalyzeInput: 'test input', sourceQuery: 'test query' },
    evidencePackets: [],
    atomicPathwayGraph: {
      nodes: [
        { id: 'n1', label: 'Source', role: 'metabolite' as const, nodeType: 'metabolite', summary: '', citation: '', color: '' },
        { id: 'n2', label: 'Target', role: 'metabolite' as const, nodeType: 'metabolite', summary: '', citation: '', color: '' },
        { id: 'n3', label: 'Enzyme1', role: 'enzyme' as const, nodeType: 'enzyme', summary: '', citation: '', color: '' },
      ],
      edges: [
        { start: 'n1', end: 'n3', key: 'k1', role: 'catalysis' as const },
        { start: 'n3', end: 'n2', key: 'k2', role: 'evidence-backed-transition' as const },
      ],
    },
    candidateRoutes: [
      { id: 'primary-route', label: 'Source -> Target', nodeIds: ['n1', 'n2', 'n3'], edgeKeys: ['k1', 'k2'], rank: 1 },
    ],
    provenance: {
      compiledFrom: 'manual-text',
      evidencePacketIds: [],
      sourceProvider: null,
    },
    workbench: { scientificStage: 'design' },
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  } as WorkflowArtifact;
}

// ────────────────────────────────────────────────────────
// buildCanonicalSlice
// ────────────────────────────────────────────────────────
describe('buildCanonicalSlice', () => {
  it('extracts serializable state from a workbench state', () => {
    const state = makeMinimalCanonicalState({
      revision: 5,
      activeArtifactId: 'art-1',
      draftAnalyzeInput: 'input text',
    });

    const result = buildCanonicalSlice(state as any);
    expect(result.schemaVersion).toBe(1);
    expect(result.revision).toBe(5);
    expect(result.activeArtifactId).toBe('art-1');
    expect(result.draftAnalyzeInput).toBe('input text');
    expect(result.evidenceItems).toEqual([]);
    expect(result.toolRuns).toEqual([]);
    expect(result.runArtifacts).toEqual([]);
  });

  it('preserves all fields exactly', () => {
    const state = makeMinimalCanonicalState();
    const result = buildCanonicalSlice(state as any);
    // Every key in the canonical state should be present
    expect(result).toHaveProperty('schemaVersion');
    expect(result).toHaveProperty('revision');
    expect(result).toHaveProperty('lastMutationAt');
    expect(result).toHaveProperty('activeArtifactId');
    expect(result).toHaveProperty('project');
    expect(result).toHaveProperty('evidenceItems');
    expect(result).toHaveProperty('selectedEvidenceIds');
    expect(result).toHaveProperty('draftAnalyzeInput');
    expect(result).toHaveProperty('workflowArtifact');
    expect(result).toHaveProperty('analyzeArtifact');
    expect(result).toHaveProperty('toolRuns');
    expect(result).toHaveProperty('toolPayloads');
    expect(result).toHaveProperty('payloadAdmissionDecisionsByToolId');
    expect(result).toHaveProperty('runArtifacts');
    expect(result).toHaveProperty('checkpoints');
    expect(result).toHaveProperty('nextRecommendations');
    expect(result).toHaveProperty('workflowControl');
  });

  it('does not include extra state properties', () => {
    const state = {
      ...makeMinimalCanonicalState(),
      syncStatus: 'synced',
      syncError: null,
      hydratedFromServer: true,
    };
    const result = buildCanonicalSlice(state as any);
    expect(result).not.toHaveProperty('syncStatus');
    expect(result).not.toHaveProperty('syncError');
    expect(result).not.toHaveProperty('hydratedFromServer');
  });
});

// ────────────────────────────────────────────────────────
// requestCanonicalState
// ────────────────────────────────────────────────────────
describe('requestCanonicalState', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorageMock.clear();
  });

  const validServerState = {
    schemaVersion: 1,
    revision: 1,
    lastMutationAt: 100,
  };

  it('GET success — returns sanitized canonical state', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        state: validServerState,
        backend: null,
        members: [],
        experiments: [],
        audit: [],
        history: [],
      }),
    });

    const result = await requestCanonicalState('GET');
    expect(result.canonicalState).not.toBeNull();
    expect(result.canonicalState.revision).toBe(1);
    expect(result.backendMeta).toBeNull();
    expect(result.collaborators).toEqual([]);
  });

  it('PUT success — sends state in body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        state: { ...validServerState, revision: 2 },
      }),
    });

    const state = makeMinimalCanonicalState();
    const result = await requestCanonicalState('PUT', state, { projectId: 'p1' });
    expect(result.canonicalState.revision).toBe(2);

    // Verify the fetch was called with PUT method and a body
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/workbench');
    expect(init.method).toBe('PUT');
    expect(init.body).toBeDefined();
  });

  it('GET with artifactId builds correct URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ state: validServerState }),
    });

    await requestCanonicalState('GET', undefined, { artifactId: 'art-123' });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/workbench?artifact=art-123');
  });

  it('PUT with artifactId in options builds correct URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ state: validServerState }),
    });

    const state = makeMinimalCanonicalState({ activeArtifactId: 'art-from-state' });
    await requestCanonicalState('PUT', state, { artifactId: 'art-override' });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/workbench?artifact=art-override');
  });

  it('throws with conflict state on non-OK response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'Conflict detected',
        state: validServerState,
        backend: { kind: 'sqlite', path: '/db' },
        members: [{ actorId: 'a1' }],
        experiments: [],
        audit: [],
        history: [],
      }),
    });

    try {
      await requestCanonicalState('GET');
      fail('should have thrown');
    } catch (e: any) {
      expect(e.message).toBe('Conflict detected');
      expect(e.status).toBe(409);
      expect(e.state).not.toBeNull();
      expect(e.state.revision).toBe(1);
      expect(e.backendMeta).not.toBeNull();
    }
    mockFetch.mockReset();
  });

  it('throws with default error message when response has no error field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await expect(requestCanonicalState('GET')).rejects.toThrow('GET /api/workbench failed (500)');
  });

  it('handles JSON parse failure gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => { throw new Error('bad json'); },
    });

    await expect(requestCanonicalState('GET')).rejects.toThrow('GET /api/workbench failed (502)');
  });

  it('throws when server returns invalid state (null sanitize result)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        state: null, // sanitizeWorkbenchState(null) returns null
      }),
    });

    await expect(requestCanonicalState('GET')).rejects.toThrow('Workbench server returned an invalid canonical state');
  });

  it('sends actorId and projectId headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ state: validServerState }),
    });

    await requestCanonicalState('GET', undefined, { projectId: 'my-project' });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['x-workbench-actor-id']).toBeDefined();
    expect(init.headers['x-workbench-project-id']).toBe('my-project');
  });

  it('defaults projectId from state.project.id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ state: validServerState }),
    });

    const state = makeMinimalCanonicalState({ project: { id: 'proj-1' } as any });
    await requestCanonicalState('PUT', state);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['x-workbench-project-id']).toBe('proj-1');
  });
});

// ────────────────────────────────────────────────────────
// buildCanonicalPatchFromWorkflowArtifact
// ────────────────────────────────────────────────────────
describe('buildCanonicalPatchFromWorkflowArtifact', () => {
  it('returns a patch with activeArtifactId, workflowArtifact, analyzeArtifact, project', () => {
    const state = {
      project: null,
      toolRuns: [],
    } as any;
    const artifact = makeMinimalWorkflowArtifact();

    const patch = buildCanonicalPatchFromWorkflowArtifact(state, artifact);
    expect(patch.activeArtifactId).toBe('wf-1');
    expect(patch.workflowArtifact).toBe(artifact);
    expect(patch.analyzeArtifact).toBeDefined();
    expect(patch.analyzeArtifact!.id).toBe('wf-1');
    expect(patch.analyzeArtifact!.targetProduct).toBe('Target');
    expect(patch.project).toBeDefined();
    expect(patch.project!.status).toBe('active');
    expect(patch.project!.isDemo).toBe(false);
  });

  it('uses existing project when available', () => {
    const state = {
      project: {
        id: 'existing-proj',
        title: 'Existing Title',
        summary: 'Existing Summary',
        targetProduct: 'Existing Target',
        status: 'draft',
        isDemo: false,
        createdAt: 500,
        updatedAt: 600,
      },
      toolRuns: [],
    } as any;
    const artifact = makeMinimalWorkflowArtifact();

    const patch = buildCanonicalPatchFromWorkflowArtifact(state, artifact);
    expect(patch.project!.id).toBe('existing-proj');
    // Summary and targetProduct are overwritten from the analyze artifact
    expect(typeof patch.project!.summary).toBe('string');
    expect(patch.project!.summary.length).toBeGreaterThan(0);
    expect(patch.project!.status).toBe('active');
  });

  it('uses intake sourceQuery in project', () => {
    const state = { project: null, toolRuns: [] } as any;
    const artifact = makeMinimalWorkflowArtifact({
      intake: { rawAnalyzeInput: 'test', sourceQuery: 'my query' },
    });

    const patch = buildCanonicalPatchFromWorkflowArtifact(state, artifact);
    expect(patch.project!.sourceQuery).toBe('my query');
  });

  it('generates checkpoints and nextRecommendations', () => {
    const state = { project: null, toolRuns: [] } as any;
    const artifact = makeMinimalWorkflowArtifact();

    const patch = buildCanonicalPatchFromWorkflowArtifact(state, artifact);
    expect(patch.checkpoints).toBeDefined();
    expect(Array.isArray(patch.checkpoints)).toBe(true);
    expect(patch.nextRecommendations).toBeDefined();
    expect(Array.isArray(patch.nextRecommendations)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────
// isValidPersistedWorkflowArtifact
// ────────────────────────────────────────────────────────
describe('isValidPersistedWorkflowArtifact', () => {
  it('returns false for null/undefined', () => {
    expect(isValidPersistedWorkflowArtifact(null)).toBe(false);
    expect(isValidPersistedWorkflowArtifact(undefined)).toBe(false);
  });

  it('returns false for artifact without id', () => {
    expect(isValidPersistedWorkflowArtifact({ id: '' } as any)).toBe(false);
  });

  it('returns false for non-compiled artifact', () => {
    expect(isValidPersistedWorkflowArtifact({
      id: 'wf-1',
      status: 'draft',
      atomicPathwayGraph: { nodes: [{ id: 'n1' }], edges: [] },
    } as any)).toBe(false);
  });

  it('returns false when atomicPathwayGraph is null', () => {
    expect(isValidPersistedWorkflowArtifact({
      id: 'wf-1',
      status: 'compiled',
      atomicPathwayGraph: null,
    } as any)).toBe(false);
  });

  it('returns false when nodes are empty', () => {
    expect(isValidPersistedWorkflowArtifact({
      id: 'wf-1',
      status: 'compiled',
      atomicPathwayGraph: { nodes: [], edges: [] },
    } as any)).toBe(false);
  });

  it('returns true for a valid persisted artifact', () => {
    expect(isValidPersistedWorkflowArtifact({
      id: 'wf-1',
      status: 'compiled',
      atomicPathwayGraph: { nodes: [{ id: 'n1' }], edges: [] },
    } as any)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────
// summarizeWorkflowArtifactDebug
// ────────────────────────────────────────────────────────
describe('summarizeWorkflowArtifactDebug', () => {
  it('returns null for null/undefined', () => {
    expect(summarizeWorkflowArtifactDebug(null)).toBeNull();
    expect(summarizeWorkflowArtifactDebug(undefined)).toBeNull();
  });

  it('returns debug summary for a valid artifact', () => {
    const artifact = makeMinimalWorkflowArtifact();
    const result = summarizeWorkflowArtifactDebug(artifact);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('wf-1');
    expect(result!.status).toBe('compiled');
    expect(result!.hasGraph).toBe(true);
    expect(result!.nodeCount).toBe(3);
    expect(result!.edgeCount).toBe(2);
    expect(result!.evidencePacketCount).toBe(0);
    expect(result!.candidateRouteCount).toBe(1);
    expect(result!.scientificStage).toBe('design');
  });
});
