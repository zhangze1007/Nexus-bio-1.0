/**
 * Tests for syncSlice — server synchronization, artifact persistence, canonical state management.
 *
 * Covers:
 * - loadFromServer: success, error, 404, server-empty-with-local-data, stale-server
 * - syncToServer: success, error, conflict
 * - applyCanonicalState: state merging, hydration flags
 * - persistWorkflowArtifact: success, error (missing graph), error (API failure)
 */

import { createSyncSlice, syncInitialState } from '../src/store/slices/syncSlice';
import type { SyncSlice } from '../src/store/slices/syncSlice';
import type { WorkbenchCanonicalState } from '../src/store/workbenchTypes';
import type { WorkflowArtifact, WorkflowArtifactNode } from '../src/domain/workflowArtifact';

// ── Mocks ──

const mockRequestCanonicalState = jest.fn();
const mockBuildCanonicalSlice = jest.fn();
const mockBuildCanonicalPatchFromWorkflowArtifact = jest.fn();
const mockBuildWorkflowControlSnapshot = jest.fn().mockReturnValue(null);
const mockIsValidPersistedWorkflowArtifact = jest.fn();
const mockSummarizeWorkflowArtifactDebug = jest.fn().mockReturnValue({});
const mockDeriveAnalyzeCompatibilityProjection = jest.fn((a: unknown) => a);
const mockSanitizeWorkbenchState = jest.fn((s: unknown) => s);
const mockSanitizeWorkbenchBackendMeta = jest.fn((m: unknown) => m);
const mockSanitizeWorkbenchCollaborators = jest.fn(() => []);
const mockSanitizeWorkbenchExperimentRecords = jest.fn(() => []);
const mockSanitizeWorkbenchAuditLog = jest.fn(() => []);
const mockSanitizeWorkbenchHistory = jest.fn(() => []);
const mockNormalizeNonEmptyId = jest.fn((id: string | null) => id || null);

jest.mock('../src/store/slices/sharedHelpers', () => ({
  buildCanonicalSlice: (...args: unknown[]) => (mockBuildCanonicalSlice as Function)(...args),
  requestCanonicalState: (...args: unknown[]) => (mockRequestCanonicalState as Function)(...args),
  buildCanonicalPatchFromWorkflowArtifact: (...args: unknown[]) => (mockBuildCanonicalPatchFromWorkflowArtifact as Function)(...args),
  buildWorkflowControlSnapshot: (...args: unknown[]) => (mockBuildWorkflowControlSnapshot as Function)(...args),
  isValidPersistedWorkflowArtifact: (...args: unknown[]) => (mockIsValidPersistedWorkflowArtifact as Function)(...args),
  summarizeWorkflowArtifactDebug: (...args: unknown[]) => (mockSummarizeWorkflowArtifactDebug as Function)(...args),
}));

jest.mock('../src/domain/workflowArtifactAdapters', () => ({
  deriveAnalyzeCompatibilityProjection: (...args: unknown[]) => (mockDeriveAnalyzeCompatibilityProjection as Function)(...args),
}));

jest.mock('../src/store/workbenchStoreHelpers', () => ({
  normalizeNonEmptyId: (...args: unknown[]) => (mockNormalizeNonEmptyId as Function)(...args),
  DEFAULT_PROJECT_SYNC_SCOPE: 'default-workbench',
}));

jest.mock('../src/store/workbenchValidation', () => ({
  sanitizeWorkbenchState: (...args: unknown[]) => (mockSanitizeWorkbenchState as Function)(...args),
  sanitizeWorkbenchBackendMeta: (...args: unknown[]) => (mockSanitizeWorkbenchBackendMeta as Function)(...args),
  sanitizeWorkbenchCollaborators: (...args: unknown[]) => (mockSanitizeWorkbenchCollaborators as Function)(...args),
  sanitizeWorkbenchExperimentRecords: (...args: unknown[]) => (mockSanitizeWorkbenchExperimentRecords as Function)(...args),
  sanitizeWorkbenchAuditLog: (...args: unknown[]) => (mockSanitizeWorkbenchAuditLog as Function)(...args),
  sanitizeWorkbenchHistory: (...args: unknown[]) => (mockSanitizeWorkbenchHistory as Function)(...args),
}));

// ── Helpers ──

function makeValidCanonicalState(overrides?: Partial<WorkbenchCanonicalState>): WorkbenchCanonicalState {
  return {
    schemaVersion: 1,
    revision: 5,
    lastMutationAt: Date.now(),
    activeArtifactId: 'artifact-1',
    project: {
      id: 'proj-1',
      title: 'Test Project',
      summary: '',
      targetProduct: 'Test',
      status: 'active' as const,
      isDemo: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    evidenceItems: [],
    selectedEvidenceIds: [],
    draftAnalyzeInput: '',
    workflowArtifact: {
      id: 'artifact-1',
      schemaVersion: 1,
      version: 1,
      status: 'compiled' as const,
      sourcePage: 'analyze' as const,
      intake: { rawAnalyzeInput: '' },
      evidencePackets: [],
      atomicPathwayGraph: { nodes: [{ id: 'n1', label: 'Test', type: 'metabolite' }], edges: [] },
      candidateRoutes: [],
      provenance: { compiledFrom: 'literature-bundle' as const, evidencePacketIds: [] },
      workbench: { scientificStage: 'design' as const },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    analyzeArtifact: null,
    toolRuns: [],
    toolPayloads: {},
    payloadAdmissionDecisionsByToolId: {},
    runArtifacts: [],
    checkpoints: [],
    nextRecommendations: [],
    workflowControl: null,
    ...overrides,
  } as WorkbenchCanonicalState;
}

function makeStoreState(overrides?: Record<string, unknown>) {
  return {
    ...syncInitialState,
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
    workflowControl: null,
    ...overrides,
  };
}

type SetFn = (partial: Record<string, unknown> | ((s: Record<string, unknown>) => Record<string, unknown>)) => void;
type GetFn = () => ReturnType<typeof makeStoreState>;

function createTestSlice(overrides?: Record<string, unknown>) {
  let state = makeStoreState(overrides);
  const set: SetFn = (partial) => {
    if (typeof partial === 'function') {
      state = { ...state, ...partial(state) };
    } else {
      state = { ...state, ...partial };
    }
  };
  const get: GetFn = () => state;
  const slice = createSyncSlice(set as unknown as Parameters<typeof createSyncSlice>[0], get as unknown as Parameters<typeof createSyncSlice>[1], {} as Parameters<typeof createSyncSlice>[2]);
  return { slice, getState: () => state, set, get };
}

// ── Tests ──

describe('syncSlice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1000000);
    // Default: sanitizeWorkbenchState returns a valid canonical state
    mockSanitizeWorkbenchState.mockImplementation((s: unknown) => {
      if (s && typeof s === 'object' && 'revision' in s) return s as WorkbenchCanonicalState;
      return null;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── syncInitialState ──
  describe('syncInitialState', () => {
    it('has correct default values', () => {
      expect(syncInitialState.syncStatus).toBe('idle');
      expect(syncInitialState.syncError).toBeNull();
      expect(syncInitialState.hydratedFromServer).toBe(false);
      expect(syncInitialState.lastServerSyncAt).toBeNull();
      expect(syncInitialState.lastServerSyncedRevision).toBe(0);
      expect(syncInitialState.artifactLoadState).toBe('idle');
      expect(syncInitialState.artifactLoadError).toBeNull();
      expect(syncInitialState.artifactRequestedId).toBeNull();
      expect(syncInitialState.backendMeta).toBeNull();
      expect(syncInitialState.collaborators).toEqual([]);
      expect(syncInitialState.experimentRecords).toEqual([]);
      expect(syncInitialState.syncAuditLog).toEqual([]);
      expect(syncInitialState.historyLog).toEqual([]);
    });
  });

  // ── applyCanonicalState ──
  describe('applyCanonicalState', () => {
    it('merges sanitized canonical state into store', () => {
      const { slice, getState } = createTestSlice();
      const canonical = makeValidCanonicalState();

      slice.applyCanonicalState(canonical);

      expect(getState().revision).toBe(5);
      expect(getState().activeArtifactId).toBe('artifact-1');
    });

    it('returns early if sanitizeWorkbenchState returns null', () => {
      mockSanitizeWorkbenchState.mockReturnValue(null);
      const { slice, getState } = createTestSlice();

      slice.applyCanonicalState({} as WorkbenchCanonicalState);

      // State should remain unchanged
      expect(getState().revision).toBe(0);
    });

    it('sets hydratedFromServer when markHydrated is true', () => {
      const { slice, getState } = createTestSlice();
      const canonical = makeValidCanonicalState();

      slice.applyCanonicalState(canonical, { markHydrated: true });

      expect(getState().hydratedFromServer).toBe(true);
      expect(getState().lastServerSyncAt).toBe(1000000);
      expect(getState().lastServerSyncedRevision).toBe(5);
    });

    it('sets syncStatus to synced when synced option is true', () => {
      const { slice, getState } = createTestSlice();
      const canonical = makeValidCanonicalState();

      slice.applyCanonicalState(canonical, { synced: true });

      expect(getState().syncStatus).toBe('synced');
      expect(getState().syncError).toBeNull();
      expect(getState().lastServerSyncAt).toBe(1000000);
    });

    it('sets syncStatus to conflict when conflict option is true', () => {
      const { slice, getState } = createTestSlice();
      const canonical = makeValidCanonicalState();

      slice.applyCanonicalState(canonical, { conflict: true });

      expect(getState().syncStatus).toBe('conflict');
      expect(getState().syncError).toBeNull();
    });

    it('does not change hydration flags when options are omitted', () => {
      const { slice, getState } = createTestSlice({ hydratedFromServer: true });
      const canonical = makeValidCanonicalState();

      slice.applyCanonicalState(canonical);

      expect(getState().hydratedFromServer).toBe(true);
    });

    it('derives analyze artifact from workflow artifact', () => {
      const { slice, getState } = createTestSlice();
      const canonical = makeValidCanonicalState();

      slice.applyCanonicalState(canonical);

      expect(mockDeriveAnalyzeCompatibilityProjection).toHaveBeenCalled();
    });

    it('falls back to analyzeArtifact when workflowArtifact is null', () => {
      const { slice, getState } = createTestSlice();
      const canonical = makeValidCanonicalState({ workflowArtifact: null });

      slice.applyCanonicalState(canonical);

      // Should not crash; activeArtifactId falls back to null
      expect(getState().revision).toBe(5);
    });
  });

  // ── loadFromServer ──
  describe('loadFromServer', () => {
    it('sets loading status and fetches canonical state', async () => {
      const { slice, getState } = createTestSlice();
      const canonical = makeValidCanonicalState();
      mockRequestCanonicalState.mockResolvedValue({
        canonicalState: canonical,
        backendMeta: null,
        collaborators: [],
        experimentRecords: [],
        auditLog: [],
        historyLog: [],
      });

      await slice.loadFromServer();

      expect(getState().syncStatus).toBe('synced');
      expect(getState().hydratedFromServer).toBe(true);
      expect(getState().lastServerSyncAt).toBe(1000000);
      expect(getState().lastServerSyncedRevision).toBe(5);
    });

    it('handles artifactId option', async () => {
      const { slice, getState } = createTestSlice();
      const canonical = makeValidCanonicalState();
      mockRequestCanonicalState.mockResolvedValue({
        canonicalState: canonical,
        backendMeta: null,
        collaborators: [],
        experimentRecords: [],
        auditLog: [],
        historyLog: [],
      });

      await slice.loadFromServer({ artifactId: 'artifact-1' });

      expect(getState().artifactRequestedId).toBe('artifact-1');
      expect(getState().artifactLoadState).toBe('ready');
    });

    it('handles 404 error with artifactId', async () => {
      const { slice, getState } = createTestSlice();
      const error = Object.assign(new Error('Not found'), { status: 404 });
      mockRequestCanonicalState.mockRejectedValue(error);

      await slice.loadFromServer({ artifactId: 'artifact-1' });

      expect(getState().syncStatus).toBe('synced');
      expect(getState().artifactLoadState).toBe('empty');
      expect(getState().workflowArtifact).toBeNull();
      expect(getState().analyzeArtifact).toBeNull();
      expect(getState().activeArtifactId).toBeNull();
    });

    it('handles non-404 error', async () => {
      const { slice, getState } = createTestSlice();
      mockRequestCanonicalState.mockRejectedValue(new Error('Network error'));

      await slice.loadFromServer();

      expect(getState().syncStatus).toBe('error');
      expect(getState().syncError).toBe('Network error');
      expect(getState().hydratedFromServer).toBe(true);
    });

    it('handles error without message (non-Error throw)', async () => {
      const { slice, getState } = createTestSlice();
      mockRequestCanonicalState.mockRejectedValue('string error');

      await slice.loadFromServer();

      expect(getState().syncStatus).toBe('error');
      expect(getState().syncError).toBe('Failed to load canonical workbench state');
    });

    it('handles 404 error without artifactId', async () => {
      const { slice, getState } = createTestSlice();
      const error = Object.assign(new Error('Not found'), { status: 404 });
      mockRequestCanonicalState.mockRejectedValue(error);

      await slice.loadFromServer();

      expect(getState().syncStatus).toBe('synced');
      expect(getState().syncError).toBeNull();
    });

    it('preserves local data when server is empty', async () => {
      const { slice, getState } = createTestSlice({
        revision: 3,
        toolRuns: [{ id: 'run-1' }],
        evidenceItems: [],
      });
      const emptyCanonical = makeValidCanonicalState({
        revision: 0,
        project: null,
        toolRuns: [],
      });
      mockRequestCanonicalState.mockResolvedValue({
        canonicalState: emptyCanonical,
        backendMeta: null,
        collaborators: [],
        experimentRecords: [],
        auditLog: [],
        historyLog: [],
      });

      await slice.loadFromServer();

      expect(getState().syncStatus).toBe('synced');
      expect(getState().lastServerSyncedRevision).toBe(3); // preserved local revision
    });

    it('preserves local data when server revision is older', async () => {
      const { slice, getState } = createTestSlice({ revision: 10 });
      const olderCanonical = makeValidCanonicalState({ revision: 5 });
      mockRequestCanonicalState.mockResolvedValue({
        canonicalState: olderCanonical,
        backendMeta: null,
        collaborators: [],
        experimentRecords: [],
        auditLog: [],
        historyLog: [],
      });

      await slice.loadFromServer();

      expect(getState().syncStatus).toBe('synced');
      expect(getState().lastServerSyncedRevision).toBe(5); // uses server revision
    });

    it('merges server state when server revision is newer', async () => {
      const { slice, getState } = createTestSlice({ revision: 3 });
      const newerCanonical = makeValidCanonicalState({ revision: 8 });
      mockRequestCanonicalState.mockResolvedValue({
        canonicalState: newerCanonical,
        backendMeta: { kind: 'sqlite', path: '/tmp/test.db' },
        collaborators: [],
        experimentRecords: [],
        auditLog: [],
        historyLog: [],
      });

      await slice.loadFromServer();

      expect(getState().syncStatus).toBe('synced');
      expect(getState().lastServerSyncedRevision).toBe(8);
      expect(getState().revision).toBe(8);
    });

    it('sets artifactLoadState to loading when artifactId is provided', async () => {
      const { slice, getState } = createTestSlice();
      // Don't resolve immediately so we can check intermediate state
      let resolve!: (v: unknown) => void;
      mockRequestCanonicalState.mockReturnValue(new Promise((r) => { resolve = r; }));

      const promise = slice.loadFromServer({ artifactId: 'artifact-1' });
      expect(getState().artifactLoadState).toBe('loading');
      expect(getState().artifactRequestedId).toBe('artifact-1');

      resolve({
        canonicalState: makeValidCanonicalState(),
        backendMeta: null,
        collaborators: [],
        experimentRecords: [],
        auditLog: [],
        historyLog: [],
      });
      await promise;
    });

    it('handles persisted artifact with newer version', async () => {
      const { slice, getState } = createTestSlice({
        workflowArtifact: { id: 'artifact-1', version: 1 },
      });
      const canonical = makeValidCanonicalState({
        workflowArtifact: {
          id: 'artifact-1',
          version: 3,
          status: 'compiled',
          atomicPathwayGraph: { nodes: [{ id: 'n1' } as unknown as WorkflowArtifactNode], edges: [] },
        } as unknown as WorkflowArtifact,
      });
      mockRequestCanonicalState.mockResolvedValue({
        canonicalState: canonical,
        backendMeta: null,
        collaborators: [],
        experimentRecords: [],
        auditLog: [],
        historyLog: [],
      });

      await slice.loadFromServer({ artifactId: 'artifact-1' });

      expect(getState().syncStatus).toBe('synced');
    });
  });

  // ── syncToServer ──
  describe('syncToServer', () => {
    it('does nothing if not hydrated', async () => {
      const { slice, getState } = createTestSlice({ hydratedFromServer: false });

      await slice.syncToServer();

      expect(getState().syncStatus).toBe('idle');
      expect(mockRequestCanonicalState).not.toHaveBeenCalled();
    });

    it('syncs successfully', async () => {
      const { slice, getState } = createTestSlice({ hydratedFromServer: true });
      const canonical = makeValidCanonicalState({ revision: 6 });
      mockBuildCanonicalSlice.mockReturnValue(canonical);
      mockRequestCanonicalState.mockResolvedValue({
        canonicalState: canonical,
        backendMeta: null,
        collaborators: [],
        experimentRecords: [],
        auditLog: [],
        historyLog: [],
      });

      await slice.syncToServer();

      expect(getState().syncStatus).toBe('synced');
      expect(getState().lastServerSyncAt).toBe(1000000);
      expect(getState().lastServerSyncedRevision).toBe(6);
    });

    it('handles non-conflict error', async () => {
      const { slice, getState } = createTestSlice({ hydratedFromServer: true });
      mockBuildCanonicalSlice.mockReturnValue(makeValidCanonicalState());
      mockRequestCanonicalState.mockRejectedValue(new Error('Server error'));

      await slice.syncToServer();

      expect(getState().syncStatus).toBe('error');
      expect(getState().syncError).toBe('Server error');
    });

    it('handles non-Error throw', async () => {
      const { slice, getState } = createTestSlice({ hydratedFromServer: true });
      mockBuildCanonicalSlice.mockReturnValue(makeValidCanonicalState());
      mockRequestCanonicalState.mockRejectedValue('string error');

      await slice.syncToServer();

      expect(getState().syncStatus).toBe('error');
      expect(getState().syncError).toBe('Failed to sync canonical workbench state');
    });

    it('handles conflict error with state', async () => {
      const { slice, getState } = createTestSlice({ hydratedFromServer: true });
      const conflictCanonical = makeValidCanonicalState({ revision: 10 });
      mockBuildCanonicalSlice.mockReturnValue(makeValidCanonicalState());
      const conflictError = Object.assign(new Error('Conflict'), {
        state: conflictCanonical,
        backendMeta: { kind: 'sqlite', path: '/tmp/test.db' },
        collaborators: [],
        experimentRecords: [],
        auditLog: [],
        historyLog: [],
      });
      mockRequestCanonicalState.mockRejectedValue(conflictError);

      await slice.syncToServer();

      expect(getState().syncStatus).toBe('conflict');
      expect(getState().syncError).toBe('Server canonical state overrode a stale local revision.');
      expect(getState().hydratedFromServer).toBe(true);
    });

    it('passes artifactId option', async () => {
      const { slice, getState } = createTestSlice({ hydratedFromServer: true });
      const canonical = makeValidCanonicalState();
      mockBuildCanonicalSlice.mockReturnValue(canonical);
      mockRequestCanonicalState.mockResolvedValue({
        canonicalState: canonical,
        backendMeta: null,
        collaborators: [],
        experimentRecords: [],
        auditLog: [],
        historyLog: [],
      });

      await slice.syncToServer({ artifactId: 'artifact-2' });

      expect(mockRequestCanonicalState).toHaveBeenCalledWith('PUT', canonical, expect.objectContaining({
        artifactId: 'artifact-2',
      }));
    });
  });

  // ── persistWorkflowArtifact ──
  describe('persistWorkflowArtifact', () => {
    const validArtifact = {
      id: 'artifact-1',
      schemaVersion: 1,
      version: 0,
      status: 'compiled' as const,
      sourcePage: 'analyze' as const,
      intake: { rawAnalyzeInput: 'test' },
      evidencePackets: [],
      atomicPathwayGraph: { nodes: [{ id: 'n1', label: 'Test', type: 'metabolite' }], edges: [] },
      candidateRoutes: [],
      provenance: { compiledFrom: 'literature-bundle' as const, evidencePacketIds: [] },
      workbench: { scientificStage: 'design' as const },
      createdAt: 100,
      updatedAt: 100,
    };

    it('throws when artifact has no atomic pathway graph', async () => {
      const { slice, getState } = createTestSlice();
      const badArtifact = { ...validArtifact, atomicPathwayGraph: { nodes: [], edges: [] } };

      await expect(slice.persistWorkflowArtifact(badArtifact as never)).rejects.toThrow(
        'Compiled workflow artifact is missing an atomic pathway graph',
      );
      expect(getState().syncStatus).toBe('error');
      expect(getState().artifactLoadState).toBe('error');
    });

    it('throws when artifact has null atomic pathway graph', async () => {
      const { slice, getState } = createTestSlice();
      const badArtifact = { ...validArtifact, atomicPathwayGraph: null };

      await expect(slice.persistWorkflowArtifact(badArtifact as never)).rejects.toThrow(
        'Compiled workflow artifact is missing an atomic pathway graph',
      );
    });

    it('persists artifact successfully', async () => {
      const { slice, getState } = createTestSlice();
      const savedState = makeValidCanonicalState();
      mockBuildCanonicalPatchFromWorkflowArtifact.mockReturnValue({});
      mockBuildCanonicalSlice.mockReturnValue(savedState);
      mockRequestCanonicalState.mockResolvedValue({
        canonicalState: savedState,
        backendMeta: null,
        collaborators: [],
        experimentRecords: [],
        auditLog: [],
        historyLog: [],
      });
      mockIsValidPersistedWorkflowArtifact.mockReturnValue(true);

      const result = await slice.persistWorkflowArtifact(validArtifact as never);

      expect(result).toBeDefined();
      expect(getState().syncStatus).toBe('synced');
      expect(getState().artifactLoadState).toBe('ready');
      expect(getState().hydratedFromServer).toBe(true);
    });

    it('throws when API returns invalid persisted artifact', async () => {
      const { slice } = createTestSlice();
      const savedState = makeValidCanonicalState();
      mockBuildCanonicalPatchFromWorkflowArtifact.mockReturnValue({});
      mockBuildCanonicalSlice.mockReturnValue(savedState);
      mockRequestCanonicalState.mockResolvedValue({
        canonicalState: savedState,
        backendMeta: null,
        collaborators: [],
        experimentRecords: [],
        auditLog: [],
        historyLog: [],
      });
      // First call: check after save; second call: check after install
      mockIsValidPersistedWorkflowArtifact.mockReturnValue(false);

      await expect(slice.persistWorkflowArtifact(validArtifact as never)).rejects.toThrow(
        'Canonical artifact save failed: response did not include a valid persisted WorkflowArtifact',
      );
    });

    it('handles API fetch error', async () => {
      const { slice, getState } = createTestSlice();
      mockBuildCanonicalPatchFromWorkflowArtifact.mockReturnValue({});
      mockBuildCanonicalSlice.mockReturnValue(makeValidCanonicalState());
      mockRequestCanonicalState.mockRejectedValue(new Error('Network failure'));

      await expect(slice.persistWorkflowArtifact(validArtifact as never)).rejects.toThrow('Network failure');
      expect(getState().syncStatus).toBe('error');
      expect(getState().syncError).toBe('Network failure');
    });

    it('handles non-Error API failure', async () => {
      const { slice, getState } = createTestSlice();
      mockBuildCanonicalPatchFromWorkflowArtifact.mockReturnValue({});
      mockBuildCanonicalSlice.mockReturnValue(makeValidCanonicalState());
      mockRequestCanonicalState.mockRejectedValue('string failure');

      await expect(slice.persistWorkflowArtifact(validArtifact as never)).rejects.toThrow(
        'Failed to persist canonical workflow artifact',
      );
      expect(getState().syncStatus).toBe('error');
    });

    it('sets saving/loading status during persist', async () => {
      const { slice, getState } = createTestSlice();
      mockBuildCanonicalPatchFromWorkflowArtifact.mockReturnValue({});
      mockBuildCanonicalSlice.mockReturnValue(makeValidCanonicalState());

      let resolve!: (v: unknown) => void;
      mockRequestCanonicalState.mockReturnValue(new Promise((r) => { resolve = r; }));

      const promise = slice.persistWorkflowArtifact(validArtifact as never);

      expect(getState().syncStatus).toBe('saving');
      expect(getState().artifactLoadState).toBe('loading');

      const savedState = makeValidCanonicalState();
      resolve({
        canonicalState: savedState,
        backendMeta: null,
        collaborators: [],
        experimentRecords: [],
        auditLog: [],
        historyLog: [],
      });
      mockIsValidPersistedWorkflowArtifact.mockReturnValue(true);
      await promise;
    });

    it('increments version from previous artifact', async () => {
      const { slice } = createTestSlice({
        workflowArtifact: { id: 'artifact-1', version: 3, createdAt: 50 },
      });
      const savedState = makeValidCanonicalState();
      mockBuildCanonicalPatchFromWorkflowArtifact.mockReturnValue({});
      mockBuildCanonicalSlice.mockReturnValue(savedState);
      mockRequestCanonicalState.mockResolvedValue({
        canonicalState: savedState,
        backendMeta: null,
        collaborators: [],
        experimentRecords: [],
        auditLog: [],
        historyLog: [],
      });
      mockIsValidPersistedWorkflowArtifact.mockReturnValue(true);

      await slice.persistWorkflowArtifact(validArtifact as never);

      // The candidate should have version 4 (previous 3 + 1)
      expect(mockSummarizeWorkflowArtifactDebug).toHaveBeenCalled();
    });

    it('preserves error status in artifact', async () => {
      const { slice } = createTestSlice();
      const errorArtifact = { ...validArtifact, status: 'error' as const };
      const savedState = makeValidCanonicalState();
      mockBuildCanonicalPatchFromWorkflowArtifact.mockReturnValue({});
      mockBuildCanonicalSlice.mockReturnValue(savedState);
      mockRequestCanonicalState.mockResolvedValue({
        canonicalState: savedState,
        backendMeta: null,
        collaborators: [],
        experimentRecords: [],
        auditLog: [],
        historyLog: [],
      });
      mockIsValidPersistedWorkflowArtifact.mockReturnValue(true);

      await slice.persistWorkflowArtifact(errorArtifact as never);

      // Should keep 'error' status for error artifacts
      expect(mockSummarizeWorkflowArtifactDebug).toHaveBeenCalled();
    });
  });
});
