'use client';

import React, { createContext, useContext, useReducer, useCallback, type Dispatch } from 'react';
import { PathwayNode, PathwayEdge, EvidenceAnchor } from '../types';

// ── Global state shape ────────────────────────────────────────────────

export interface NexusState {
  // Pathway data
  activeNodes: PathwayNode[];
  activeEdges: PathwayEdge[];
  isAIGenerated: boolean;

  // Selection & cross-component sync
  selectedNodeId: string | null;
  selectedResidueId: number | null;
  highlightedEnzymeNodeId: string | null;
  /** PubMed ID or citation key — consumed by literature panel to auto-scroll on residue selection */
  literatureScrollTarget: string | null;

  // Evidence layer
  evidenceAnchors: EvidenceAnchor[];
  activePopoverAnchor: EvidenceAnchor | null;

  // Simulation state
  edgeFluxMap: Record<string, number>;
}

// ── Actions ──────────────────────────────────────────────────────────

export type NexusAction =
  | { type: 'SET_PATHWAY'; nodes: PathwayNode[]; edges: PathwayEdge[] }
  | { type: 'RESET_PATHWAY'; defaultNodes: PathwayNode[]; defaultEdges: PathwayEdge[] }
  | { type: 'SELECT_NODE'; nodeId: string | null }
  | { type: 'SELECT_RESIDUE'; residueId: number | null; relatedNodeId?: string; pubmedId?: string }
  | { type: 'SET_EVIDENCE_ANCHORS'; anchors: EvidenceAnchor[] }
  | { type: 'SHOW_EVIDENCE_POPOVER'; anchor: EvidenceAnchor | null }
  | { type: 'SET_EDGE_FLUX'; fluxMap: Record<string, number> }
  | { type: 'SCROLL_TO_LITERATURE'; target: string | null };

// ── Reducer ──────────────────────────────────────────────────────────

function nexusReducer(state: NexusState, action: NexusAction): NexusState {
  switch (action.type) {
    case 'SET_PATHWAY':
      return {
        ...state,
        activeNodes: action.nodes,
        activeEdges: action.edges,
        isAIGenerated: true,
        selectedNodeId: null,
        selectedResidueId: null,
        highlightedEnzymeNodeId: null,
      };

    case 'RESET_PATHWAY':
      return {
        ...state,
        activeNodes: action.defaultNodes,
        activeEdges: action.defaultEdges,
        isAIGenerated: false,
        selectedNodeId: null,
        selectedResidueId: null,
        highlightedEnzymeNodeId: null,
        evidenceAnchors: [],
        activePopoverAnchor: null,
        edgeFluxMap: {},
      };

    case 'SELECT_NODE':
      return {
        ...state,
        selectedNodeId: action.nodeId,
        // Auto-highlight related enzyme node when a metabolite is selected
        highlightedEnzymeNodeId: action.nodeId
          ? findRelatedEnzyme(state.activeNodes, state.activeEdges, action.nodeId)
          : null,
      };

    case 'SELECT_RESIDUE': {
      // Push-Pull: selecting a residue scrolls literature and highlights enzyme
      const relatedNode = action.relatedNodeId ?? null;
      const litTarget = action.pubmedId ?? null;
      return {
        ...state,
        selectedResidueId: action.residueId,
        highlightedEnzymeNodeId: relatedNode,
        literatureScrollTarget: litTarget,
      };
    }

    case 'SET_EVIDENCE_ANCHORS':
      return { ...state, evidenceAnchors: action.anchors };

    case 'SHOW_EVIDENCE_POPOVER':
      return { ...state, activePopoverAnchor: action.anchor };

    case 'SET_EDGE_FLUX':
      return { ...state, edgeFluxMap: action.fluxMap };

    case 'SCROLL_TO_LITERATURE':
      return { ...state, literatureScrollTarget: action.target };

    default:
      return state;
  }
}

// ── Helper: find related enzyme for a given node ──────────────────────

function findRelatedEnzyme(
  nodes: PathwayNode[],
  edges: PathwayEdge[],
  nodeId: string,
): string | null {
  for (const edge of edges) {
    if (edge.start === nodeId || edge.end === nodeId) {
      const otherId = edge.start === nodeId ? edge.end : edge.start;
      const otherNode = nodes.find(n => n.id === otherId);
      if (otherNode?.nodeType === 'enzyme') return otherId;
    }
  }
  return null;
}

// ── Context ──────────────────────────────────────────────────────────

const NexusContext = createContext<NexusState | null>(null);
const NexusDispatchContext = createContext<Dispatch<NexusAction> | null>(null);

export function NexusProvider({
  children,
  defaultNodes,
  defaultEdges,
}: {
  children: React.ReactNode;
  defaultNodes: PathwayNode[];
  defaultEdges: PathwayEdge[];
}) {
  const [state, dispatch] = useReducer(nexusReducer, {
    activeNodes: defaultNodes,
    activeEdges: defaultEdges,
    isAIGenerated: false,
    selectedNodeId: null,
    selectedResidueId: null,
    highlightedEnzymeNodeId: null,
    literatureScrollTarget: null,
    evidenceAnchors: [],
    activePopoverAnchor: null,
    edgeFluxMap: {},
  });

  return (
    <NexusContext.Provider value={state}>
      <NexusDispatchContext.Provider value={dispatch}>
        {children}
      </NexusDispatchContext.Provider>
    </NexusContext.Provider>
  );
}

// ── Hooks ────────────────────────────────────────────────────────────

export function useNexus(): NexusState {
  const ctx = useContext(NexusContext);
  if (!ctx) throw new Error('useNexus must be used within NexusProvider');
  return ctx;
}

export function useNexusDispatch(): Dispatch<NexusAction> {
  const ctx = useContext(NexusDispatchContext);
  if (!ctx) throw new Error('useNexusDispatch must be used within NexusProvider');
  return ctx;
}

// ── Convenience action creators ──────────────────────────────────────

export function useNexusActions() {
  const dispatch = useNexusDispatch();

  const selectNode = useCallback(
    (nodeId: string | null) => dispatch({ type: 'SELECT_NODE', nodeId }),
    [dispatch],
  );

  const setPathway = useCallback(
    (nodes: PathwayNode[], edges: PathwayEdge[]) =>
      dispatch({ type: 'SET_PATHWAY', nodes, edges }),
    [dispatch],
  );

  const resetPathway = useCallback(
    (defaultNodes: PathwayNode[], defaultEdges: PathwayEdge[]) =>
      dispatch({ type: 'RESET_PATHWAY', defaultNodes, defaultEdges }),
    [dispatch],
  );

  const selectResidue = useCallback(
    (residueId: number | null, relatedNodeId?: string, pubmedId?: string) =>
      dispatch({ type: 'SELECT_RESIDUE', residueId, relatedNodeId, pubmedId }),
    [dispatch],
  );

  const showEvidencePopover = useCallback(
    (anchor: EvidenceAnchor | null) =>
      dispatch({ type: 'SHOW_EVIDENCE_POPOVER', anchor }),
    [dispatch],
  );

  const setEdgeFlux = useCallback(
    (fluxMap: Record<string, number>) =>
      dispatch({ type: 'SET_EDGE_FLUX', fluxMap }),
    [dispatch],
  );

  return {
    selectNode,
    setPathway,
    resetPathway,
    selectResidue,
    showEvidencePopover,
    setEdgeFlux,
  };
}
