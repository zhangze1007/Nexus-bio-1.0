/**
 * Nexus-Bio 2.0 — Zustand UI Store
 *
 * Centralized UI state — NO React Context, NO prop-drilling.
 * subscribeWithSelector enables granular subscription to prevent re-render cascades.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { PathwayNode, PathwayEdge, ConsoleEntry } from '../types';

// ── Types ──────────────────────────────────────────────────────────────

export type RendererMode = 'loading' | 'webgpu' | 'webgl2' | 'webgl' | 'error';

export interface FluidPointer {
  x: number;   // NDC -1..1
  y: number;
  dx: number;  // delta per frame
  dy: number;
  active: boolean;
}

// ── Full store shape ───────────────────────────────────────────────────

interface UIState {
  // Pathway data
  aiNodes: PathwayNode[] | null;
  aiEdges: PathwayEdge[] | null;

  // Selection
  selectedNode: PathwayNode | null;

  // Panels
  auditTrailOpen: boolean;
  auditTrailNodeId: string | null;
  sidebarOpen: boolean;

  // Renderer telemetry
  rendererMode: RendererMode;

  // Fluid background pointer (written by global mouse handler)
  fluidPointer: FluidPointer;

  // Dev mode
  devMode: boolean;

  // ── IDE Console ───────────────────────────────────────────────────────
  consoleEntries: ConsoleEntry[];
  consoleOpen: boolean;

  // ── IDE Sidebar ───────────────────────────────────────────────────────
  sidebarCollapsed: boolean;

  // ── Copilot slide-over ──────────────────────────────────────────────
  copilotOpen: boolean;

  // ── Actions ──────────────────────────────────────────────────────────
  setSelectedNode: (node: PathwayNode | null) => void;
  setAiPathway: (nodes: PathwayNode[], edges: PathwayEdge[]) => void;
  resetPathway: () => void;
  openAuditTrail: (nodeId: string) => void;
  closeAuditTrail: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setRendererMode: (mode: RendererMode) => void;
  setFluidPointer: (p: FluidPointer) => void;
  toggleDevMode: () => void;
  appendConsole: (entry: Omit<ConsoleEntry, 'id' | 'timestamp'>) => void;
  clearConsole: () => void;
  toggleConsole: () => void;
  toggleSidebarCollapsed: () => void;
  setCopilotOpen: (open: boolean) => void;
  toggleCopilot: () => void;
}

// ── Store ──────────────────────────────────────────────────────────────

export const useUIStore = create<UIState>()(
  subscribeWithSelector((set) => ({
    // Pathway
    aiNodes: null,
    aiEdges: null,

    // Selection — opening NodePanel is side-effect of setting a node
    selectedNode: null,

    // Panels
    auditTrailOpen: false,
    auditTrailNodeId: null,
    sidebarOpen: false,

    // Renderer
    rendererMode: 'loading',

    // Fluid
    fluidPointer: { x: 0, y: 0, dx: 0, dy: 0, active: false },

    // Dev
    devMode: false,

    // IDE Console
    consoleEntries: [],
    consoleOpen: false,

    // IDE Sidebar — starts collapsed (icon strip only)
    sidebarCollapsed: true,

    // Copilot slide-over — closed by default
    copilotOpen: false,

    // ── Actions ────────────────────────────────────────────────────────

    setSelectedNode: (node) =>
      set({ selectedNode: node, sidebarOpen: node !== null }),

    setAiPathway: (nodes, edges) =>
      set({ aiNodes: nodes, aiEdges: edges, selectedNode: null }),

    resetPathway: () =>
      set({ aiNodes: null, aiEdges: null, selectedNode: null }),

    openAuditTrail: (nodeId) =>
      set({ auditTrailOpen: true, auditTrailNodeId: nodeId }),

    closeAuditTrail: () =>
      set({ auditTrailOpen: false, auditTrailNodeId: null }),

    setSidebarOpen: (open) => set({ sidebarOpen: open }),

    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

    setRendererMode: (mode) => set({ rendererMode: mode }),

    setFluidPointer: (p) => set({ fluidPointer: p }),

    toggleDevMode: () => set((s) => ({ devMode: !s.devMode })),

    appendConsole: (entry) => set((s) => ({
      consoleEntries: [...s.consoleEntries, {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
      }],
    })),

    clearConsole: () => set({ consoleEntries: [] }),

    toggleConsole: () => set((s) => ({ consoleOpen: !s.consoleOpen })),

    toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

    setCopilotOpen: (open) => set({ copilotOpen: open }),
    toggleCopilot: () => set((s) => ({ copilotOpen: !s.copilotOpen })),
  }))
);

// ── Granular selectors (use these to avoid subscribing to whole store) ─

export const selectAiNodes       = (s: UIState) => s.aiNodes;
export const selectAiEdges       = (s: UIState) => s.aiEdges;
export const selectSelectedNode  = (s: UIState) => s.selectedNode;
export const selectRendererMode  = (s: UIState) => s.rendererMode;
export const selectFluidPointer  = (s: UIState) => s.fluidPointer;
export const selectSidebarOpen   = (s: UIState) => s.sidebarOpen;
export const selectAuditTrail    = (s: UIState) => ({
  open: s.auditTrailOpen,
  nodeId: s.auditTrailNodeId,
});
export const selectConsole       = (s: UIState) => ({ open: s.consoleOpen, entries: s.consoleEntries });
