'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createAxonSlice, AXON_RUN_LIMIT, AXON_LOG_LIMIT } from './slices/axonSlice';
import { createEvidenceSlice } from './slices/evidenceSlice';
import { createProjectSlice } from './slices/projectSlice';
import { createWorkflowSlice } from './slices/workflowSlice';
import { createToolRunSlice } from './slices/toolRunSlice';
import { createSyncSlice } from './slices/syncSlice';
import {
  WORKBENCH_SCHEMA_VERSION,
  createId,
  deriveTargetProduct,
} from './workbenchStoreHelpers';
import type { BottleneckEnzyme, DeNovoDesignStrategy } from '../types';
import {
  sanitizeWorkbenchState,
} from './workbenchValidation';
import { deriveAnalyzeCompatibilityProjection } from '../domain/workflowArtifactAdapters';
import type {
  StructuredAnalysisPayload,
  WorkbenchAnalyzeArtifact,
} from './workbenchTypes';

// ── Import and re-export WorkbenchState for consumers that import it ──
import type { WorkbenchState } from './slices/types';
export type { WorkbenchState } from './slices/types';

// ── Debounced localStorage adapter to prevent UI stutter on large projects ──
let _persistTimer: ReturnType<typeof setTimeout> | null = null;
const PERSIST_DEBOUNCE_MS = 500;

function createDebouncedStorage() {
  if (typeof window === 'undefined') {
    // SSR fallback: no-op storage
    return createJSONStorage(() => ({
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    }));
  }
  return createJSONStorage(() => ({
    getItem: (name: string) => localStorage.getItem(name),
    setItem: (name: string, value: string) => {
      if (_persistTimer) clearTimeout(_persistTimer);
      _persistTimer = setTimeout(() => {
        try { localStorage.setItem(name, value); } catch { /* quota exceeded */ }
      }, PERSIST_DEBOUNCE_MS);
    },
    removeItem: (name: string) => {
      if (_persistTimer) clearTimeout(_persistTimer);
      localStorage.removeItem(name);
    },
  }));
}

// ── Type re-exports (preserved for consumers) ──
export type {
  AxonRunRecord,
  WorkbenchAxonLogEntry,
  WorkbenchAxonPlanRecord,
  WorkbenchAxonPlanStepRecord,
  BottleneckAssumption,
  EnzymeCandidateSummary,
  EvidenceSourceKind,
  NextStepRecommendation,
  PathwayCandidateSummary,
  StageCheckpoint,
  StructuredAnalysisPayload,
  WorkbenchAnalyzeArtifact,
  WorkbenchCanonicalState,
  WorkbenchEvidenceItem,
  WorkbenchHistoryEntry,
  WorkbenchProjectBrief,
  WorkbenchWorkflowControlSnapshot,
  WorkbenchRunArtifact,
  WorkbenchToolRun,
} from './workbenchTypes';
export type {
  ProductSourcePage,
  ScientificStage,
  WorkflowArtifact,
  WorkflowArtifactStatus,
  WorkflowEvidencePacket,
} from '../domain/workflowArtifact';

// Re-export test helper
export { __resetWorkflowActorForTests } from './slices/sharedHelpers';

// ── buildAnalyzeArtifactFromStructuredAnalysis ──
export function buildAnalyzeArtifactFromStructuredAnalysis(
  payload: StructuredAnalysisPayload,
  evidenceTraceIds: string[] = [],
): WorkbenchAnalyzeArtifact {
  const targetProduct = deriveTargetProduct(payload.nodes);
  const thermodynamicConcerns = payload.edges
    .filter((edge) => (edge.predicted_delta_G_kJ_mol ?? 0) > 0 || String(edge.spontaneity || '').toLowerCase().includes('non'))
    .slice(0, 4)
    .map((edge) => `${edge.start} -> ${edge.end}: ${edge.spontaneity ?? 'Condition-dependent thermodynamics'}`);

  const bottleneckAssumptions = payload.bottlenecks.map((bottleneck: BottleneckEnzyme) => ({
    id: bottleneck.node_id,
    label: bottleneck.enzyme,
    detail: bottleneck.evidence,
    yieldLossPercent: bottleneck.yield_loss_percent,
  }));

  const enzymeCandidates = payload.designStrategies.map((strategy: DeNovoDesignStrategy) => ({
    id: strategy.node_id,
    label: strategy.node_id.replace(/_/g, ' '),
    rationale: strategy.de_novo_design_strategy.predicted_impact,
  }));

  const recommendedNextTools = payload.interaction?.options?.length
    ? payload.interaction.options.includes('flux_balance_optimization')
      ? ['pathd', 'fbasim', 'cethx', 'catdes']
      : ['pathd', 'catdes', 'dyncon']
    : ['pathd', 'fbasim', 'cethx'];

  return {
    id: createId('artifact'),
    title: `${targetProduct} pathway analysis`,
    summary: payload.interaction?.question
      ?? `Generated ${payload.nodes.length} nodes and ${payload.edges.length} edges for ${targetProduct}.`,
    targetProduct,
    nodes: payload.nodes,
    edges: payload.edges,
    pathwayCandidates: [
      {
        id: 'primary-route',
        label: `${payload.nodes[0]?.label ?? 'Source'} -> ${targetProduct}`,
        description: `${payload.nodes.length} nodes · ${payload.edges.length} edges · ${Math.max(payload.bottlenecks.length, 1)} modeled bottleneck checkpoint(s)`,
        nodeCount: payload.nodes.length,
        edgeCount: payload.edges.length,
      },
    ],
    bottleneckAssumptions,
    enzymeCandidates,
    thermodynamicConcerns,
    recommendedNextTools,
    evidenceTraceIds,
    sourceProvider: payload.sourceProvider,
    generatedAt: Date.now(),
  };
}

// ── Re-export buildCanonicalSlice for the persist middleware ──
import { buildCanonicalSlice, createInitialWorkflowControl } from './slices/sharedHelpers';

// ── Composed store ──
export const useWorkbenchStore = create<WorkbenchState>()(
  persist(
    (set, get, store) => ({
      // Canonical state fields not owned by any slice
      schemaVersion: WORKBENCH_SCHEMA_VERSION,
      revision: 0,
      lastMutationAt: 0,
      activeArtifactId: null,

      // Compose all slices (each provides its own initial state + actions)
      ...createProjectSlice(set, get, store),
      ...createEvidenceSlice(set, get, store),
      ...createWorkflowSlice(set, get, store),
      ...createToolRunSlice(set, get, store),
      ...createSyncSlice(set, get, store),
      ...createAxonSlice(set, get, store),
    }),
    {
      name: 'nexus-bio-workbench',
      version: 3,
      storage: createDebouncedStorage(),
      partialize: (state) => buildCanonicalSlice(state),
      merge: (persistedState, currentState) => {
        const sanitized = sanitizeWorkbenchState(persistedState);
        return sanitized
          ? {
              ...currentState,
              ...sanitized,
              activeArtifactId: sanitized.activeArtifactId ?? sanitized.workflowArtifact?.id ?? null,
              analyzeArtifact: sanitized.workflowArtifact
                ? deriveAnalyzeCompatibilityProjection(sanitized.workflowArtifact)
                : sanitized.analyzeArtifact,
              workflowControl: sanitized.workflowControl,
            }
          : currentState;
      },
    },
  ),
);
