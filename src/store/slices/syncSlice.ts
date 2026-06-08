/**
 * Sync slice — server synchronization, artifact persistence, canonical state management.
 *
 * State: syncStatus, syncError, hydratedFromServer, lastServerSyncAt, lastServerSyncedRevision,
 *        backendMeta, collaborators, experimentRecords, syncAuditLog, historyLog,
 *        artifactLoadState, artifactLoadError, artifactRequestedId
 * Actions: loadFromServer, syncToServer, applyCanonicalState, persistWorkflowArtifact
 */
import type { StateCreator } from 'zustand';
import type { WorkbenchState } from './types';
import type {
  WorkbenchBackendMeta,
  WorkbenchCollaborator,
  WorkbenchExperimentRecord,
  WorkbenchSyncAuditEntry,
  WorkbenchHistoryEntry,
  WorkbenchCanonicalState,
} from '../workbenchTypes';
import type { WorkflowArtifact } from '../../domain/workflowArtifact';
import { deriveAnalyzeCompatibilityProjection } from '../../domain/workflowArtifactAdapters';
import {
  normalizeNonEmptyId,
  DEFAULT_PROJECT_SYNC_SCOPE,
} from '../workbenchStoreHelpers';
import {
  sanitizeWorkbenchState,
  sanitizeWorkbenchBackendMeta,
  sanitizeWorkbenchCollaborators,
  sanitizeWorkbenchExperimentRecords,
  sanitizeWorkbenchAuditLog,
  sanitizeWorkbenchHistory,
} from '../workbenchValidation';
import {
  buildCanonicalSlice,
  requestCanonicalState,
  buildCanonicalPatchFromWorkflowArtifact,
  buildWorkflowControlSnapshot,
  isValidPersistedWorkflowArtifact,
  summarizeWorkflowArtifactDebug,
} from './sharedHelpers';

export interface SyncSlice {
  syncStatus: 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'conflict';
  syncError: string | null;
  hydratedFromServer: boolean;
  lastServerSyncAt: number | null;
  lastServerSyncedRevision: number;
  backendMeta: WorkbenchBackendMeta | null;
  collaborators: WorkbenchCollaborator[];
  experimentRecords: WorkbenchExperimentRecord[];
  syncAuditLog: WorkbenchSyncAuditEntry[];
  historyLog: WorkbenchHistoryEntry[];
  artifactLoadState: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  artifactLoadError: string | null;
  artifactRequestedId: string | null;
  loadFromServer: (options?: { artifactId?: string | null }) => Promise<void>;
  syncToServer: (options?: { artifactId?: string | null }) => Promise<void>;
  applyCanonicalState: (state: WorkbenchCanonicalState, options?: { markHydrated?: boolean; synced?: boolean; conflict?: boolean }) => void;
  persistWorkflowArtifact: (artifact: WorkflowArtifact) => Promise<WorkflowArtifact>;
}

export const syncInitialState = {
  syncStatus: 'idle' as const,
  syncError: null as string | null,
  hydratedFromServer: false,
  lastServerSyncAt: null as number | null,
  lastServerSyncedRevision: 0,
  backendMeta: null as WorkbenchBackendMeta | null,
  collaborators: [] as WorkbenchCollaborator[],
  experimentRecords: [] as WorkbenchExperimentRecord[],
  syncAuditLog: [] as WorkbenchSyncAuditEntry[],
  historyLog: [] as WorkbenchHistoryEntry[],
  artifactLoadState: 'idle' as const,
  artifactLoadError: null as string | null,
  artifactRequestedId: null as string | null,
};

export const createSyncSlice: StateCreator<WorkbenchState, [], [], SyncSlice> = (set, get) => ({
  ...syncInitialState,

  applyCanonicalState: (incomingState, options) => {
    const sanitized = sanitizeWorkbenchState(incomingState);
    if (!sanitized) return;
    const derivedAnalyzeArtifact = sanitized.workflowArtifact
      ? deriveAnalyzeCompatibilityProjection(sanitized.workflowArtifact)
      : sanitized.analyzeArtifact;
    set((state) => ({
      ...state,
      ...sanitized,
      activeArtifactId: sanitized.activeArtifactId ?? sanitized.workflowArtifact?.id ?? null,
      analyzeArtifact: derivedAnalyzeArtifact,
      workflowControl: sanitized.workflowControl,
      syncStatus: options?.conflict ? 'conflict' : options?.synced ? 'synced' : state.syncStatus,
      syncError: null,
      hydratedFromServer: options?.markHydrated ? true : state.hydratedFromServer,
      lastServerSyncAt: options?.synced || options?.markHydrated ? Date.now() : state.lastServerSyncAt,
      lastServerSyncedRevision: options?.synced || options?.markHydrated ? sanitized.revision : state.lastServerSyncedRevision,
    }));
  },

  persistWorkflowArtifact: async (artifact) => {
    const state = get();
    const previousArtifact = state.workflowArtifact?.id === artifact.id
      ? state.workflowArtifact
      : null;
    const candidate: WorkflowArtifact = {
      ...artifact,
      status: artifact.status === 'error' ? 'error' : 'compiled',
      version: (previousArtifact?.version ?? 0) + 1,
      createdAt: previousArtifact?.createdAt ?? artifact.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      sourcePage: 'analyze',
    };
    console.info('[workbench] compiled artifact before save', summarizeWorkflowArtifactDebug(candidate));
    if (!candidate.atomicPathwayGraph || candidate.atomicPathwayGraph.nodes.length === 0) {
      const message = 'Compiled workflow artifact is missing an atomic pathway graph';
      set({
        syncStatus: 'error',
        syncError: message,
        artifactLoadState: 'error',
        artifactLoadError: message,
      });
      throw new Error(message);
    }
    const patch = buildCanonicalPatchFromWorkflowArtifact(state, candidate);
    const patchedState = {
      ...state,
      ...patch,
    };
    const canonicalState = buildCanonicalSlice({
      ...patchedState,
      workflowControl: buildWorkflowControlSnapshot(patchedState),
    });

    set({
      syncStatus: 'saving',
      syncError: null,
      artifactLoadState: 'loading',
      artifactLoadError: null,
      artifactRequestedId: normalizeNonEmptyId(candidate.id),
    });

    try {
      const { canonicalState: savedState, backendMeta, collaborators, experimentRecords, auditLog, historyLog } = await requestCanonicalState('PUT', canonicalState, {
        artifactId: normalizeNonEmptyId(candidate.id),
        projectId: canonicalState.project?.id ?? DEFAULT_PROJECT_SYNC_SCOPE,
      });
      const savedArtifact = savedState.workflowArtifact;
      console.info('[workbench] persisted artifact returned from API', {
        workflowArtifact: summarizeWorkflowArtifactDebug(savedArtifact),
        activeArtifactId: savedState.activeArtifactId ?? null,
      });
      if (!isValidPersistedWorkflowArtifact(savedArtifact)) {
        const message = 'Canonical artifact save failed: response did not include a valid persisted WorkflowArtifact';
        set({
          syncStatus: 'error',
          syncError: message,
          artifactLoadState: 'error',
          artifactLoadError: message,
        });
        throw new Error(message);
      }

      set((currentState) => ({
        ...currentState,
        ...savedState,
        analyzeArtifact: savedState.workflowArtifact
          ? deriveAnalyzeCompatibilityProjection(savedState.workflowArtifact)
          : savedState.analyzeArtifact,
        workflowControl: savedState.workflowControl,
        backendMeta,
        collaborators,
        experimentRecords,
        syncAuditLog: auditLog,
        historyLog,
        syncStatus: 'synced',
        syncError: null,
        hydratedFromServer: true,
        lastServerSyncAt: Date.now(),
        lastServerSyncedRevision: savedState.revision,
        artifactLoadState: 'ready',
        artifactLoadError: null,
        artifactRequestedId: savedArtifact.id,
        currentStageId: 'stage-1',
      }));

      const installedState = get();
      console.info('[workbench] installed workflow artifact after save', {
        workflowArtifact: summarizeWorkflowArtifactDebug(installedState.workflowArtifact),
        activeArtifactId: installedState.activeArtifactId ?? null,
      });
      if (
        !isValidPersistedWorkflowArtifact(installedState.workflowArtifact)
        || installedState.workflowArtifact.id !== savedArtifact.id
        || installedState.activeArtifactId !== savedArtifact.id
      ) {
        const message = 'Canonical artifact save succeeded but the persisted WorkflowArtifact was not installed into client state';
        set({
          syncStatus: 'error',
          syncError: message,
          artifactLoadState: 'error',
          artifactLoadError: message,
        });
        throw new Error(message);
      }

      return installedState.workflowArtifact;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to persist canonical workflow artifact';
      console.error('[workbench] canonical artifact save failed', {
        error: message,
        workflowArtifact: summarizeWorkflowArtifactDebug(candidate),
      });
      set((currentState) => ({
        syncStatus: 'error',
        syncError: message,
        artifactLoadState: 'error',
        artifactLoadError: message,
        artifactRequestedId: normalizeNonEmptyId(candidate.id) ?? currentState.artifactRequestedId,
      }));
      throw (error instanceof Error ? error : new Error(message));
    }
  },

  loadFromServer: async (options) => {
    const artifactId = options?.artifactId ?? null;
    set({
      syncStatus: 'loading',
      syncError: null,
      artifactLoadState: artifactId ? 'loading' : get().artifactLoadState,
      artifactLoadError: artifactId ? null : get().artifactLoadError,
      artifactRequestedId: artifactId,
    });
    try {
      const { canonicalState, backendMeta, collaborators, experimentRecords, auditLog, historyLog } = await requestCanonicalState('GET', undefined, {
        artifactId,
        projectId: artifactId ? undefined : get().project?.id ?? DEFAULT_PROJECT_SYNC_SCOPE,
      });
      const derivedAnalyzeArtifact = canonicalState.workflowArtifact
        ? deriveAnalyzeCompatibilityProjection(canonicalState.workflowArtifact)
        : canonicalState.analyzeArtifact;
      set((state) => {
        const currentArtifact = artifactId ? state.workflowArtifact : null;
        const incomingArtifact = artifactId ? canonicalState.workflowArtifact : null;
        const persistedArtifactIsNewer = Boolean(
          artifactId
          && currentArtifact
          && incomingArtifact
          && currentArtifact.id === incomingArtifact.id
          && incomingArtifact.version > currentArtifact.version
        );

        const serverIsEmpty = canonicalState.revision === 0
          && !canonicalState.project?.id
          && (!canonicalState.toolRuns || canonicalState.toolRuns.length === 0);
        const localHasData = state.revision > 0
          || (state.toolRuns && state.toolRuns.length > 0)
          || (state.evidenceItems && state.evidenceItems.length > 0);

        if (serverIsEmpty && localHasData) {
          return {
            backendMeta,
            collaborators,
            experimentRecords,
            syncAuditLog: auditLog,
            historyLog,
            syncStatus: 'synced',
            syncError: null,
            hydratedFromServer: true,
            lastServerSyncAt: Date.now(),
            lastServerSyncedRevision: state.revision,
            artifactLoadState: artifactId ? 'ready' : state.artifactLoadState,
            artifactLoadError: null,
            artifactRequestedId: artifactId,
          };
        }

        if (canonicalState.revision < state.revision && !persistedArtifactIsNewer) {
          return {
            backendMeta,
            collaborators,
            experimentRecords,
            syncAuditLog: auditLog,
            historyLog,
            syncStatus: 'synced',
            syncError: null,
            hydratedFromServer: true,
            lastServerSyncAt: Date.now(),
            lastServerSyncedRevision: canonicalState.revision,
            artifactLoadState: artifactId ? 'ready' : state.artifactLoadState,
            artifactLoadError: null,
            artifactRequestedId: artifactId,
          };
        }
        return {
          ...state,
          ...canonicalState,
          activeArtifactId: canonicalState.activeArtifactId ?? canonicalState.workflowArtifact?.id ?? state.activeArtifactId,
          analyzeArtifact: derivedAnalyzeArtifact,
          workflowControl: canonicalState.workflowControl,
          backendMeta,
          collaborators,
          experimentRecords,
          syncAuditLog: auditLog,
          historyLog,
          syncStatus: 'synced',
          syncError: null,
          hydratedFromServer: true,
          lastServerSyncAt: Date.now(),
          lastServerSyncedRevision: canonicalState.revision,
          artifactLoadState: artifactId ? 'ready' : state.artifactLoadState,
          artifactLoadError: null,
          artifactRequestedId: artifactId,
        };
      });
    } catch (error) {
      const status = error && typeof error === 'object' && 'status' in error
        ? Number((error as { status?: unknown }).status)
        : null;
      set({
        syncStatus: status === 404 ? 'synced' : 'error',
        syncError: status === 404
          ? null
          : error instanceof Error ? error.message : 'Failed to load canonical workbench state',
        hydratedFromServer: true,
        artifactLoadState: artifactId ? (status === 404 ? 'empty' : 'error') : get().artifactLoadState,
        artifactLoadError: artifactId
          ? error instanceof Error ? error.message : 'Failed to resolve canonical workflow artifact'
          : get().artifactLoadError,
        artifactRequestedId: artifactId,
        workflowArtifact: status === 404 && artifactId ? null : get().workflowArtifact,
        analyzeArtifact: status === 404 && artifactId ? null : get().analyzeArtifact,
        activeArtifactId: status === 404 && artifactId ? null : get().activeArtifactId,
      });
    }
  },

  syncToServer: async (options) => {
    const state = get();
    if (!state.hydratedFromServer) return;
    const canonicalState = buildCanonicalSlice(state);
    set({ syncStatus: 'saving', syncError: null });
    try {
      const { canonicalState: savedState, backendMeta, collaborators, experimentRecords, auditLog, historyLog } = await requestCanonicalState('PUT', canonicalState, {
        artifactId: options?.artifactId ?? canonicalState.activeArtifactId,
        projectId: canonicalState.project?.id ?? DEFAULT_PROJECT_SYNC_SCOPE,
      });
      set((currentState) => ({
        ...currentState,
        ...savedState,
        activeArtifactId: savedState.activeArtifactId ?? savedState.workflowArtifact?.id ?? currentState.activeArtifactId,
        analyzeArtifact: savedState.workflowArtifact
          ? deriveAnalyzeCompatibilityProjection(savedState.workflowArtifact)
          : savedState.analyzeArtifact,
        workflowControl: savedState.workflowControl,
        backendMeta,
        collaborators,
        experimentRecords,
        syncAuditLog: auditLog,
        historyLog,
        syncStatus: 'synced',
        syncError: null,
        lastServerSyncAt: Date.now(),
        lastServerSyncedRevision: savedState.revision,
      }));
    } catch (error) {
      const conflictState = error && typeof error === 'object' && 'state' in error
        ? sanitizeWorkbenchState((error as { state?: unknown }).state)
        : null;
      const backendMeta = error && typeof error === 'object' && 'backendMeta' in error
        ? sanitizeWorkbenchBackendMeta((error as { backendMeta?: unknown }).backendMeta)
        : null;
      const collaborators = error && typeof error === 'object' && 'collaborators' in error
        ? sanitizeWorkbenchCollaborators((error as { collaborators?: unknown }).collaborators)
        : [];
      const experimentRecords = error && typeof error === 'object' && 'experimentRecords' in error
        ? sanitizeWorkbenchExperimentRecords((error as { experimentRecords?: unknown }).experimentRecords)
        : [];
      const auditLog = error && typeof error === 'object' && 'auditLog' in error
        ? sanitizeWorkbenchAuditLog((error as { auditLog?: unknown }).auditLog)
        : [];
      const historyLog = error && typeof error === 'object' && 'historyLog' in error
        ? sanitizeWorkbenchHistory((error as { historyLog?: unknown }).historyLog)
        : [];

      if (conflictState) {
        set((currentState) => ({
          ...currentState,
          ...conflictState,
          activeArtifactId: conflictState.activeArtifactId ?? conflictState.workflowArtifact?.id ?? currentState.activeArtifactId,
          analyzeArtifact: conflictState.workflowArtifact
            ? deriveAnalyzeCompatibilityProjection(conflictState.workflowArtifact)
            : conflictState.analyzeArtifact,
          workflowControl: conflictState.workflowControl,
          backendMeta,
          collaborators,
          experimentRecords,
          syncAuditLog: auditLog,
          historyLog,
          syncStatus: 'conflict',
          syncError: 'Server canonical state overrode a stale local revision.',
          hydratedFromServer: true,
          lastServerSyncAt: Date.now(),
          lastServerSyncedRevision: conflictState.revision,
        }));
        return;
      }

      set({
        syncStatus: 'error',
        syncError: error instanceof Error ? error.message : 'Failed to sync canonical workbench state',
      });
    }
  },
});
