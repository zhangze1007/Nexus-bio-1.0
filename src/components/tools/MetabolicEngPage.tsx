'use client';
/**
 * Nexus-Bio — Metabolic Engineering Lab
 * Route: /tools/metabolic-eng
 *
 * Orchestration:
 *   XState FSM (metabolicMachine) drives all UI state
 *   FBA Web Worker runs at 60 Hz, posts readouts to machine TICK event
 *   FluidForce injected via forceRef (zero allocation on RAF path)
 *   Mouse velocity dP/dt → forceRef on mousemove (passive, throttled to RAF)
 *   ThreeScene center layer — glowMultiplier/flowSpeed driven by params
 *
 * Performance targets:
 *   Desktop: 60 FPS  |  Mobile MatePad 11.5: 45 FPS (dpr capped at 1.2)
 */

import React, { useEffect, useRef, useCallback, useMemo, useState, useLayoutEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { useMachine } from '@xstate/react';
import FluidSimCanvas from './FluidSimCanvas';
import type { FluidForce } from './FluidSimCanvas';
import ToolOverlay from './ToolOverlay';
import StatusOverlay from './StatusOverlay';
import ThreeScene from '../ThreeScene';
import NodePanel from '../NodePanel';
import type { ToolTab } from './shared/ToolTabBar';
import { metabolicMachine } from '../../machines/metabolicMachine';
import type { FBAWorkerIn, FBAWorkerOut } from '../../workers/fbaWorker';
import { deriveAnalyzeCompatibilityProjection } from '../../domain/workflowArtifactAdapters';
import type { WorkflowArtifact } from '../../domain/workflowArtifact';
import { useUIStore } from '../../store/uiStore';
import { useWorkbenchStore } from '../../store/workbenchStore';
import pathwayNodes from '../../data/pathwayData.json';
import type { PathwayNode, PathwayEdge } from '../../types';
import ArtifactRouteState from './metabolic-eng/ArtifactRouteState';
import EmbeddedSupportDock from './metabolic-eng/EmbeddedSupportDock';
import EvidenceTabRail from './metabolic-eng/EvidenceTabRail';
import DBTLIntegrationPanel from './metabolic-eng/DBTLIntegrationPanel';
import FloatingTabBar from './metabolic-eng/FloatingTabBar';
import IdleStartButton from './metabolic-eng/IdleStartButton';
import { THEME } from '../../theme';
import SimErrorBanner from '../ide/shared/SimErrorBanner';

const PATHD_TABS: ToolTab[] = [
  { id: 'lab', label: '3D Lab', accent: THEME.SKY },
  { id: 'node', label: 'Node Panel', accent: THEME.LILAC },
  { id: 'dbtl', label: 'DBTL', accent: THEME.APRICOT },
  { id: 'evidence', label: 'Evidence', accent: THEME.MINT },
  { id: 'digitalcell', label: 'Digital Cell', accent: THEME.CORAL },
];

// ── Demo pathway edges (Artemisinin biosynthesis — Ro et al. 2006) ─────
const DEMO_EDGES: PathwayEdge[] = [
  { start: 'acetyl_coa',         end: 'hmg_coa',             direction: 'forward' },
  { start: 'hmg_coa',            end: 'mevalonate',           direction: 'forward' },
  { start: 'mevalonate',         end: 'fpp',                  direction: 'forward' },
  { start: 'fpp',                end: 'amorpha_4_11_diene',   direction: 'forward' },
  { start: 'amorpha_4_11_diene', end: 'artemisinic_acid',     direction: 'forward' },
  { start: 'artemisinic_acid',   end: 'artemisinin',          direction: 'forward' },
];

function inferPathwayTarget(nodes: PathwayNode[]) {
  const preferred = [...nodes].reverse().find((node) => node.nodeType !== 'enzyme' && node.nodeType !== 'gene');
  return preferred?.label ?? nodes[nodes.length - 1]?.label ?? 'Target Product';
}

function inferRouteLabel(nodes: PathwayNode[]) {
  const terminal = inferPathwayTarget(nodes);
  return `${terminal} route`;
}

const PATHD_LEFT_PANEL_WIDTH = 228;
const PATHD_RIGHT_PANEL_WIDTH = 218;
const PATHD_SUPPORT_RAIL_WIDTH = 272;
const PATHD_SCENE_GUTTER = 20;
const PATHD_PANEL_BOTTOM = 18;
type PathdSceneInsets = { top: number; right: number; bottom: number; left: number };

const PATHD_SAFE_FRAME_GUTTER = 16;

function getFallbackSceneInsets(embedded: boolean): PathdSceneInsets {
  return embedded
    ? {
        top: 18,
        right: 18 + PATHD_RIGHT_PANEL_WIDTH + PATHD_SAFE_FRAME_GUTTER,
        bottom: PATHD_PANEL_BOTTOM + 150,
        left: 20 + PATHD_LEFT_PANEL_WIDTH + PATHD_SAFE_FRAME_GUTTER,
      }
    : {
        top: 18,
        right: 18 + PATHD_SUPPORT_RAIL_WIDTH + PATHD_SAFE_FRAME_GUTTER,
        bottom: PATHD_PANEL_BOTTOM + 150,
        left: 20 + PATHD_LEFT_PANEL_WIDTH + PATHD_SAFE_FRAME_GUTTER,
      };
}

function getBaseMeasuredInsets(): PathdSceneInsets {
  return { top: 18, right: 18, bottom: PATHD_PANEL_BOTTOM + 18, left: 18 };
}

function sceneInsetsEqual(a: PathdSceneInsets | null, b: PathdSceneInsets) {
  return a !== null && a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}

// ── Main orchestrator ──────────────────────────────────────────────────

export default React.memo(function MetabolicEngPage({ embedded = false }: { embedded?: boolean } = {}) {
  const searchParams = useSearchParams();
  const routeArtifactId = searchParams.get('artifact');
  const [snapshot, send] = useMachine(metabolicMachine);
  const { params, readouts, rateHistory } = snapshot.context;
  const state = snapshot.value as 'idle' | 'simulating' | 'stress_test' | 'equilibrium';
  const project = useWorkbenchStore((s) => s.project);
  const workflowArtifact = useWorkbenchStore((s) => s.workflowArtifact);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const artifactLoadState = useWorkbenchStore((s) => s.artifactLoadState);
  const artifactLoadError = useWorkbenchStore((s) => s.artifactLoadError);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);

  // ── Dismissible center dashboards — let user clear the view of the 3D canvas
  const [activeTab, setActiveTab] = useState('lab');
  const stageRef = useRef<HTMLDivElement | null>(null);
  const supportFrameRef = useRef<HTMLDivElement | null>(null);
  const leftPanelFrameRef = useRef<HTMLDivElement | null>(null);
  const rightPanelFrameRef = useRef<HTMLDivElement | null>(null);
  const [embeddedStageHeight, setEmbeddedStageHeight] = useState<number | null>(null);
  const fallbackSceneInsets = useMemo(() => getFallbackSceneInsets(embedded), [embedded]);
  const [measuredSceneInsets, setMeasuredSceneInsets] = useState<PathdSceneInsets | null>(null);

  // ── Zustand: node selection + AI-generated pathway ───────────────
  const selectedNode    = useUIStore(s => s.selectedNode);
  const setSelectedNode = useUIStore(s => s.setSelectedNode);
  const setAiPathway    = useUIStore(s => s.setAiPathway);
  const aiNodes         = useUIStore(s => s.aiNodes);
  const aiEdges         = useUIStore(s => s.aiEdges);
  const compiledWorkflowArtifact = workflowArtifact?.status === 'compiled' ? workflowArtifact : null;
  const routeObservedArtifact = routeArtifactId && workflowArtifact?.id === routeArtifactId ? workflowArtifact : null;
  const routeCompiledArtifact = routeArtifactId && compiledWorkflowArtifact?.id === routeArtifactId
    ? compiledWorkflowArtifact
    : null;
  const localCompiledArtifact = !routeArtifactId ? compiledWorkflowArtifact : null;
  const compatibilityGraph = analyzeArtifact && analyzeArtifact.nodes.length > 0
    ? { nodes: analyzeArtifact.nodes, edges: analyzeArtifact.edges }
    : null;
  const uiGraph = aiNodes && aiNodes.length > 0 && aiEdges && aiEdges.length > 0
    ? { nodes: aiNodes, edges: aiEdges }
    : null;
  const demoGraph = { nodes: pathwayNodes as PathwayNode[], edges: DEMO_EDGES };
  const resolvedGraph = useMemo(() => {
    if (routeArtifactId) {
      if (routeCompiledArtifact?.atomicPathwayGraph) {
        return {
          source: artifactLoadState === 'loading' ? 'in-memory' : 'persisted',
          nodes: routeCompiledArtifact.atomicPathwayGraph.nodes as PathwayNode[],
          edges: routeCompiledArtifact.atomicPathwayGraph.edges as PathwayEdge[],
          workflowArtifact: routeCompiledArtifact,
        };
      }
      return {
        source: 'none' as const,
        nodes: [] as PathwayNode[],
        edges: [] as PathwayEdge[],
        workflowArtifact: null,
      };
    }

    if (localCompiledArtifact?.atomicPathwayGraph) {
      return {
        source: 'in-memory' as const,
        nodes: localCompiledArtifact.atomicPathwayGraph.nodes as PathwayNode[],
        edges: localCompiledArtifact.atomicPathwayGraph.edges as PathwayEdge[],
        workflowArtifact: localCompiledArtifact,
      };
    }

    if (compatibilityGraph) {
      return {
        source: 'compatibility-projection' as const,
        nodes: compatibilityGraph.nodes,
        edges: compatibilityGraph.edges,
        workflowArtifact: null,
      };
    }

    if (uiGraph) {
      return {
        source: 'ui-graph' as const,
        nodes: uiGraph.nodes,
        edges: uiGraph.edges,
        workflowArtifact: null,
      };
    }

    return {
      source: 'demo' as const,
      nodes: demoGraph.nodes,
      edges: demoGraph.edges,
      workflowArtifact: null,
    };
  }, [
    artifactLoadState,
    compatibilityGraph,
    demoGraph.edges,
    demoGraph.nodes,
    localCompiledArtifact,
    routeArtifactId,
    routeCompiledArtifact,
    uiGraph,
  ]);
  const activeWorkflowArtifact = resolvedGraph.workflowArtifact;
  const activeAnalyzeArtifact = useMemo(
    () => activeWorkflowArtifact ? deriveAnalyzeCompatibilityProjection(activeWorkflowArtifact) : analyzeArtifact,
    [activeWorkflowArtifact, analyzeArtifact],
  );
  const graphSource = resolvedGraph.source;
  const activeNodes = resolvedGraph.nodes;
  const activeEdges = resolvedGraph.edges;
  const routeArtifactState = useMemo(() => {
    if (!routeArtifactId) return null;
    if (artifactLoadState === 'loading' && !routeCompiledArtifact) {
      return {
        title: 'Loading canonical artifact',
        message: `PATHD is resolving artifact ${routeArtifactId}. Demo and UI graph fallbacks are disabled while a canonical artifact route is active.`,
      };
    }
    if (artifactLoadState === 'empty') {
      return {
        title: 'Artifact not found',
        message: `No persisted workflow artifact was found for ${routeArtifactId}. PATHD will not reconstruct a missing artifact route from local UI state or demo data.`,
      };
    }
    if (artifactLoadState === 'error') {
      return {
        title: 'Artifact load failed',
        message: artifactLoadError ?? `PATHD could not load canonical artifact ${routeArtifactId}.`,
      };
    }
    if (!routeObservedArtifact) {
      return {
        title: 'Artifact unavailable',
        message: `Artifact ${routeArtifactId} has not resolved into a canonical PATHD object yet.`,
      };
    }
    if (routeObservedArtifact.status !== 'compiled') {
      return {
        title: 'Artifact not compiled',
        message: `Artifact ${routeArtifactId} is currently ${routeObservedArtifact.status}. Analyze must compile and save successfully before PATHD can open it.`,
      };
    }
    if (!routeObservedArtifact.atomicPathwayGraph || routeObservedArtifact.atomicPathwayGraph.nodes.length === 0) {
      return {
        title: 'Artifact graph is empty',
        message: `Artifact ${routeArtifactId} does not contain an atomic pathway graph yet, so PATHD cannot render the route.`,
      };
    }
    return null;
  }, [artifactLoadError, artifactLoadState, routeArtifactId, routeCompiledArtifact, routeObservedArtifact]);
  const derivedTarget = useMemo(
    () => activeAnalyzeArtifact?.targetProduct || project?.targetProduct || project?.title || inferPathwayTarget(activeNodes),
    [activeAnalyzeArtifact?.targetProduct, activeNodes, project?.targetProduct, project?.title],
  );
  const activeRouteLabel = useMemo(
    () => activeAnalyzeArtifact?.pathwayCandidates[0]?.label || inferRouteLabel(activeNodes),
    [activeAnalyzeArtifact?.pathwayCandidates, activeNodes],
  );
  const recommendedNextTool = (activeAnalyzeArtifact?.recommendedNextTools[0] ?? 'fbasim').toUpperCase();
  const supportCards = useMemo(
    () => [
      {
        eyebrow: 'Stage 1 Context',
        value: derivedTarget,
        body: activeWorkflowArtifact
          ? `Canonical artifact route active · ${activeRouteLabel}`
          : activeAnalyzeArtifact
            ? `Compatibility projection active · ${activeRouteLabel}`
            : graphSource === 'ui-graph'
              ? 'Renderer-local UI graph active until a canonical artifact is attached.'
              : 'Simulated route active until an Analyze artifact is attached.',
        chips: [
          activeWorkflowArtifact ? 'Canonical artifact' : activeAnalyzeArtifact ? 'Compatibility projection' : graphSource === 'ui-graph' ? 'UI graph' : 'Simulated context',
          'Pathway hero',
        ],
      },
      {
        eyebrow: 'Route Object',
        value: selectedNode?.label ?? activeRouteLabel,
        body: selectedNode
          ? 'Node focus stays explicit while the pathway remains the main scientific figure.'
          : 'Route-level focus remains visible without turning the dashboard into the main stage.',
        chips: [`${activeNodes.length} nodes`, `${activeEdges.length} edges`],
      },
      {
        eyebrow: 'Next Handoff',
        value: recommendedNextTool,
        body: activeAnalyzeArtifact?.bottleneckAssumptions[0]?.label ?? 'No structured bottleneck has been injected yet; use PATHD to choose the next simulation handoff.',
        chips: [
          `${activeAnalyzeArtifact?.bottleneckAssumptions.length ?? 0} bottlenecks`,
          `${activeAnalyzeArtifact?.enzymeCandidates.length ?? 0} enzyme candidates`,
        ],
      },
    ],
    [
      activeEdges.length,
      activeAnalyzeArtifact,
      activeNodes.length,
      activeRouteLabel,
      activeWorkflowArtifact,
      derivedTarget,
      graphSource,
      recommendedNextTool,
      selectedNode?.label,
    ],
  );

  useEffect(() => {
    if (!activeWorkflowArtifact?.atomicPathwayGraph) return;
    setAiPathway(
      activeWorkflowArtifact.atomicPathwayGraph.nodes,
      activeWorkflowArtifact.atomicPathwayGraph.edges,
    );
  }, [activeWorkflowArtifact?.atomicPathwayGraph, activeWorkflowArtifact?.id, activeWorkflowArtifact?.version, setAiPathway]);

  useEffect(() => {
    if (!selectedNode) return;
    if (activeNodes.some((node) => node.id === selectedNode.id)) return;
    setSelectedNode(null);
  }, [activeNodes, selectedNode, setSelectedNode]);

  useEffect(() => {
    setToolPayload('pathd', {
      validity: graphSource === 'demo' ? 'demo' : 'partial',
      toolId: 'pathd',
      targetProduct: derivedTarget,
      sourceArtifactId: activeWorkflowArtifact?.id ?? activeAnalyzeArtifact?.id,
      activeRouteLabel,
      nodeCount: activeNodes.length,
      edgeCount: activeEdges.length,
      selectedNodeId: selectedNode?.id ?? null,
      result: {
        pathwayCandidates: activeAnalyzeArtifact?.pathwayCandidates.length ?? 1,
        bottleneckCount: activeAnalyzeArtifact?.bottleneckAssumptions.length ?? 0,
        enzymeCandidates: activeAnalyzeArtifact?.enzymeCandidates.length ?? 0,
        thermodynamicConcerns: activeAnalyzeArtifact?.thermodynamicConcerns.length ?? 0,
        highlightedNode: selectedNode?.label ?? null,
        recommendedNextTool: activeAnalyzeArtifact?.recommendedNextTools[0] ?? 'fbasim',
        evidenceLinked: Boolean(activeWorkflowArtifact?.id ?? activeAnalyzeArtifact?.id),
      },
      updatedAt: Date.now(),
    });
  }, [
    activeEdges.length,
    activeAnalyzeArtifact?.bottleneckAssumptions.length,
    activeAnalyzeArtifact?.enzymeCandidates.length,
    activeAnalyzeArtifact?.id,
    activeNodes.length,
    activeRouteLabel,
    activeAnalyzeArtifact?.pathwayCandidates.length,
    activeAnalyzeArtifact?.recommendedNextTools,
    activeAnalyzeArtifact?.thermodynamicConcerns.length,
    activeWorkflowArtifact?.id,
    derivedTarget,
    selectedNode?.id,
    selectedNode?.label,
    setToolPayload,
  ]);

  useLayoutEffect(() => {
    if (!embedded) return;

    const updateStageHeight = () => {
      const stage = stageRef.current;
      if (!stage) return;

      const availableHeight = window.innerHeight - stage.getBoundingClientRect().top - 16;
      const nextHeight = Math.max(560, Math.min(860, Math.floor(availableHeight)));
      setEmbeddedStageHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    updateStageHeight();
    const rafId = window.requestAnimationFrame(updateStageHeight);
    window.addEventListener('resize', updateStageHeight);

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateStageHeight())
      : null;

    if (resizeObserver && stageRef.current?.parentElement) {
      resizeObserver.observe(stageRef.current.parentElement);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateStageHeight);
      resizeObserver?.disconnect();
    };
  }, [embedded]);

  const measureSceneInsets = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const stageRect = stage.getBoundingClientRect();
    const next = getBaseMeasuredInsets();
    const stageCenterX = stageRect.left + stageRect.width / 2;
    const stageCenterY = stageRect.top + stageRect.height / 2;

    const includeOverlay = (element: HTMLElement | null) => {
      if (!element) return;
      const elementRect = element.getBoundingClientRect();
      const measurable = elementRect.width > 0 && elementRect.height > 0
        ? element
        : element.firstElementChild instanceof HTMLElement
          ? element.firstElementChild
          : element;
      const rect = measurable.getBoundingClientRect();
      const overlaps =
        rect.right > stageRect.left &&
        rect.left < stageRect.right &&
        rect.bottom > stageRect.top &&
        rect.top < stageRect.bottom;
      if (!overlaps) return;

      const overlayCenterX = rect.left + rect.width / 2;
      const overlayCenterY = rect.top + rect.height / 2;

      if (overlayCenterX <= stageCenterX) {
        next.left = Math.max(next.left, Math.round(rect.right - stageRect.left + PATHD_SAFE_FRAME_GUTTER));
      } else {
        next.right = Math.max(next.right, Math.round(stageRect.right - rect.left + PATHD_SAFE_FRAME_GUTTER));
      }

      if (overlayCenterY <= stageCenterY) {
        next.top = Math.max(next.top, Math.round(rect.bottom - stageRect.top + PATHD_SAFE_FRAME_GUTTER));
      } else {
        next.bottom = Math.max(next.bottom, Math.round(stageRect.bottom - rect.top + PATHD_SAFE_FRAME_GUTTER));
      }
    };

    includeOverlay(supportFrameRef.current);
    includeOverlay(leftPanelFrameRef.current);
    includeOverlay(rightPanelFrameRef.current);

    setMeasuredSceneInsets((current) => (sceneInsetsEqual(current, next) ? current : next));
  }, []);

  useLayoutEffect(() => {
    let rafId = window.requestAnimationFrame(measureSceneInsets);
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          window.cancelAnimationFrame(rafId);
          rafId = window.requestAnimationFrame(measureSceneInsets);
        })
      : null;

    const observed = [
      stageRef.current,
      supportFrameRef.current,
      leftPanelFrameRef.current,
      leftPanelFrameRef.current?.firstElementChild,
      rightPanelFrameRef.current,
      rightPanelFrameRef.current?.firstElementChild,
    ].filter((element): element is HTMLElement => element instanceof HTMLElement);

    observed.forEach((element) => resizeObserver?.observe(element));
    window.addEventListener('resize', measureSceneInsets);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measureSceneInsets);
    };
  }, [
    embedded,
    embeddedStageHeight,
    measureSceneInsets,
    state,
    supportCards.length,
  ]);

  // ── ThreeScene: computed props from simulation params ─────────────
  // glowMultiplier: default enzyme=5 → 1.0 (mid); enzyme=20 → 2.0 (max); pH/temp deviate → dims
  const glowMultiplier = useMemo(() => {
    const tempF = Math.exp(-((params.temperature - 37) ** 2) / 200);
    const phF   = Math.exp(-((params.pH - 7.4) ** 2) / 1.2);
    return Math.max(0.3, Math.min(2.0, tempF * phF * (params.enzyme / 10) * 2));
  }, [params.temperature, params.pH, params.enzyme]);

  // flowSpeed: default substrate=50, km=5 → ~1.0 (mid); max substrate + low km → 2.5
  const flowSpeed = useMemo(() =>
    Math.max(0.3, Math.min(2.5, (params.substrate / 100) * (10 / Math.max(0.5, params.km)) * 1.25)),
    [params.substrate, params.km]
  );

  const sceneOpticalInsets = measuredSceneInsets ?? fallbackSceneInsets;

  // ── Fluid force ref — zero allocation on RAF ──────────────────────
  const forceRef = useRef<FluidForce | null>(null);

  // ── FBA Web Worker ─────────────────────────────────────────────────
  const workerRef = useRef<Worker | null>(null);
  const snapshotValueRef = useRef(snapshot.value);
  snapshotValueRef.current = snapshot.value;

  useEffect(() => {
    if (typeof Worker === 'undefined') return;
    workerRef.current = new Worker(
      new URL('../../workers/fbaWorker.ts', import.meta.url),
      { type: 'module' }
    );
    const w = workerRef.current;
    w.onmessage = (e: MessageEvent<FBAWorkerOut>) => {
      const msg = e.data;
      if (msg.type === 'TICK') {
        send({ type: 'TICK', readouts: msg.readouts });
      }
      if (msg.type === 'EQUILIBRIUM_REACHED') {
        if (snapshotValueRef.current === 'simulating') {
          send({ type: 'EQUILIBRATE' });
        }
      }
    };
    w.onerror = (e: ErrorEvent) => {
      console.error('[FBA Worker]', e.message);
    };
    return () => w.terminate();
  }, []); // intentional — worker created once

  // Sync params to worker whenever they change
  useEffect(() => {
    if (!workerRef.current) return;
    if (state === 'idle') {
      workerRef.current.postMessage({ type: 'STOP' } satisfies FBAWorkerIn);
    } else {
      workerRef.current.postMessage({ type: 'UPDATE', params } satisfies FBAWorkerIn);
    }
  }, [params, state]);

  // ── FSM actions ────────────────────────────────────────────────────

  const handleStart = useCallback(() => {
    send({ type: 'START' });
    workerRef.current?.postMessage({
      type: 'START', params, mode: 'simulating',
    } satisfies FBAWorkerIn);
    forceRef.current = { x: 0.5, y: 0.5, dx: 0.08, dy: 0.04, strength: 1.4 };
  }, [send, params]);

  const handlePause = useCallback(() => {
    send({ type: 'PAUSE' });
    workerRef.current?.postMessage({ type: 'STOP' } satisfies FBAWorkerIn);
  }, [send]);

  const handleReset = useCallback(() => {
    send({ type: 'RESET' });
    workerRef.current?.postMessage({ type: 'STOP' } satisfies FBAWorkerIn);
  }, [send]);

  // Parameter Oscillation: applies sinusoidal perturbation to model parameters.
  // NOT a biological stress model — tests simulation robustness under parameter drift.
  const handleParameterOscillation = useCallback(() => {
    send({ type: 'STRESS' });
    workerRef.current?.postMessage({
      type: 'START', params, mode: 'stress_test',
    } satisfies FBAWorkerIn);
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        forceRef.current = {
          x: 0.3 + Math.random() * 0.4,
          y: 0.3 + Math.random() * 0.4,
          dx: (Math.random() - 0.5) * 0.2,
          dy: (Math.random() - 0.5) * 0.2,
          strength: 2.5,
          color: [0.6, 0.05, 0.05],
        };
      }, i * 100);
    }
  }, [send, params]);

  const handleResume = useCallback(() => {
    send({ type: 'RESUME' });
    workerRef.current?.postMessage({
      type: 'START', params, mode: 'simulating',
    } satisfies FBAWorkerIn);
  }, [send, params]);

  const handleParam = useCallback((key: keyof typeof params, value: number) => {
    send({ type: 'SET_PARAM', key, value });
    if (state !== 'idle' && workerRef.current) {
      workerRef.current.postMessage({
        type: 'UPDATE', params: { ...params, [key]: value },
      } satisfies FBAWorkerIn);
    }
  }, [send, params, state]);

  // ── Mouse velocity → fluid force injection (dP/dt) ────────────────
  const lastMouseRef = useRef<{ x: number; y: number; t: number }>({ x: 0, y: 0, t: 0 });
  const pendingMouseRef = useRef(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (state === 'idle') return;
      const now = performance.now();
      const last = lastMouseRef.current;
      const dt = Math.max(now - last.t, 1);
      const nx = e.clientX / window.innerWidth;
      const ny = 1 - e.clientY / window.innerHeight;
      const dx = Math.min(Math.max((nx - last.x) / dt * 12, -0.3), 0.3);
      const dy = Math.min(Math.max((ny - last.y) / dt * 12, -0.3), 0.3);

      if (!pendingMouseRef.current && (Math.abs(dx) + Math.abs(dy)) > 0.002) {
        pendingMouseRef.current = true;
        requestAnimationFrame(() => {
          forceRef.current = { x: nx, y: ny, dx, dy, strength: 0.5 };
          pendingMouseRef.current = false;
        });
      }
      lastMouseRef.current = { x: nx, y: ny, t: now };
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [state]);

  if (routeArtifactState) {
    return (
      <ArtifactRouteState
        title={routeArtifactState.title}
        message={routeArtifactState.message}
        artifact={routeObservedArtifact}
        embedded={embedded}
      />
    );
  }

  return (
    <div
      ref={stageRef}
      style={{
        position: 'relative',
        minHeight: embedded ? `${embeddedStageHeight ?? 560}px` : '860px',
        height: embedded ? `${embeddedStageHeight ?? 560}px` : undefined,
        flex: 1,
        background: 'radial-gradient(circle at top, rgba(207,196,227,0.18), transparent 28%), radial-gradient(circle at bottom right, rgba(191,220,205,0.14), transparent 26%), linear-gradient(180deg, #0d0a09 0%, #050505 100%)',
        overflow:'hidden', userSelect:'none',
      }}
    >
      {/* ── Core viewport: fluid background ── */}
      <FluidSimCanvas
        reactionRate={readouts.reactionRate}
        stressIndex={readouts.stressIndex}
        state={state}
      />

      {/* ── Floating tab bar ── */}
      <FloatingTabBar
        tabs={PATHD_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        visible={!embedded}
      />

      {embedded ? (
        <EmbeddedSupportDock supportCards={supportCards} innerRef={supportFrameRef} />
      ) : activeTab === 'evidence' ? (
        <EvidenceTabRail
          activeRouteLabel={activeRouteLabel}
          selectedNodeLabel={selectedNode?.label}
          derivedTarget={derivedTarget}
          activeNodes={activeNodes}
          activeEdges={activeEdges}
          activeAnalyzeArtifact={activeAnalyzeArtifact}
          recommendedNextTool={recommendedNextTool}
          embedded={embedded}
          width={PATHD_SUPPORT_RAIL_WIDTH}
        />
      ) : activeTab === 'node' ? (
        <div style={{
          position: 'absolute', top: '16px', right: '18px', left: 'auto',
          width: `${PATHD_SUPPORT_RAIL_WIDTH}px`, zIndex: 14,
          pointerEvents: 'auto',
        }}>
          {selectedNode ? (
            <NodePanel
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              allNodes={activeNodes}
              allEdges={activeEdges}
            />
          ) : (
            <div style={{
              padding: '16px', borderRadius: 'var(--nb-radius-md)',
              background: 'rgba(10,12,16,0.72)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: THEME.LABEL, fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)',
              textAlign: 'center', lineHeight: 1.6,
            }}>
              Click a node in the 3D pathway to inspect its overview, structure, and analysis.
            </div>
          )}
        </div>
      ) : activeTab === 'dbtl' ? (
        <DBTLIntegrationPanel
          activeRouteLabel={activeRouteLabel}
          nodeCount={activeNodes.length}
          bottleneckCount={activeAnalyzeArtifact?.bottleneckAssumptions.length ?? 0}
          recommendedNextTool={recommendedNextTool}
        />
      ) : activeTab === 'digitalcell' ? (
        <DigitalCellPanel />
      ) : null}

      {/* ── Center: 3D Pathway Visualization — full-screen, panels float over ── */}
      <div style={{ position:'absolute', inset:0, zIndex:5, pointerEvents:'auto' }}>
        <div style={{ position:'absolute', inset:0 }}>
          <ThreeScene
            nodes={activeNodes}
            edges={activeEdges}
            onNodeClick={setSelectedNode}
            selectedNodeId={selectedNode?.id ?? null}
            glowMultiplier={glowMultiplier}
            flowSpeed={flowSpeed}
            stressIndex={readouts.stressIndex}
            fullscreen
            opticalInsets={sceneOpticalInsets}
            debugFrameName="PATHD"
            tracePlacement="top-left"
            traceLayout={embedded ? { top: 16, left: PATHD_SCENE_GUTTER, width: PATHD_LEFT_PANEL_WIDTH } : undefined}
          />
        </div>
      </div>

      {/* ── Left tool panel ── */}
      {(embedded || activeTab === 'lab') && (
      <div style={{ position:'absolute', inset:0, zIndex:10, pointerEvents:'none' }}>
        <div ref={leftPanelFrameRef} style={{ pointerEvents:'auto' }}>
          <ToolOverlay
            params={params}
            state={state}
            onParam={handleParam}
            onStart={handleStart}
            onPause={handlePause}
            onReset={handleReset}
            onStress={handleParameterOscillation}
            onResume={handleResume}
            forceRef={forceRef}
            width={PATHD_LEFT_PANEL_WIDTH}
            bottomOffset={PATHD_PANEL_BOTTOM}
          />
        </div>
      </div>
      )}

      {/* ── Right status panel ── */}
      {(embedded || activeTab === 'lab') && (
      <div style={{ position:'absolute', inset:0, zIndex:10, pointerEvents:'none' }}>
        <div ref={rightPanelFrameRef} style={{ pointerEvents:'auto' }}>
          <StatusOverlay
            readouts={readouts}
            rateHistory={rateHistory}
            params={params}
            state={state}
            width={PATHD_RIGHT_PANEL_WIDTH}
            bottomOffset={PATHD_PANEL_BOTTOM}
          />
        </div>
      </div>
      )}

      {/* ── Idle prompt — clickable start button ── */}
      <IdleStartButton onStart={handleStart} visible={state === 'idle'} />

      {/* ── Node detail panel (Overview / Structure / Analysis) — hidden on Node tab ── */}
      <AnimatePresence>
        {selectedNode && activeTab !== 'node' && (
          <NodePanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            allNodes={activeNodes}
            allEdges={activeEdges}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

/* ── Digital Cell Panel ──────────────────────────────────────────────────── */

function DigitalCellPanel() {
  const [duration, setDuration] = useState(4);
  const [glucose, setGlucose] = useState(10);
  const [result, setResult] = useState<import('../../server/digitalCellEngine').SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSimulate = React.useCallback(async () => {
    setLoading(true);
    try {
      const { simulateDigitalCell } = await import('../../server/digitalCellEngine');
      const config = {
        duration,
        dt: 0.1,
        stochasticGeneExpression: false,
        includeDivision: true,
        environmentConditions: { glucose, oxygen: 100, temperature: 37 },
      };
      const res = simulateDigitalCell(config);
      setResult(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Digital cell simulation failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [duration, glucose]);

  return (
    <div style={{
      position: 'absolute', top: 16, right: 18, width: 280, zIndex: 14,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{
        background: 'rgba(10,12,16,0.92)', borderRadius: 'var(--nb-radius-lg)', padding: 14,
        border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)',
      }}>
        <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Digital Cell Simulation
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: 'rgba(255,255,255,0.4)' }}>Duration (h)</div>
            <input type="number" min={1} max={24} value={duration} onChange={(e) => setDuration(Number(e.target.value))}
              style={{ width: 50, padding: '3px 6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--nb-radius-sm)', color: 'rgba(255,255,255,0.85)', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', outline: 'none' }}
            />
          </div>
          <div>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: 'rgba(255,255,255,0.4)' }}>Glucose (mM)</div>
            <input type="number" min={1} max={50} value={glucose} onChange={(e) => setGlucose(Number(e.target.value))}
              style={{ width: 50, padding: '3px 6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--nb-radius-sm)', color: 'rgba(255,255,255,0.85)', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', outline: 'none' }}
            />
          </div>
        </div>
        <button onClick={handleSimulate} disabled={loading} className="nb-tool-toggle"
          style={{ width: '100%', padding: '6px', fontSize: 'var(--nb-fs-sm)', opacity: loading ? 0.4 : 1 }}
        >
          {loading ? 'Simulating...' : 'Simulate Cell'}
        </button>
      </div>

      {error && <SimErrorBanner message={error} onRetry={() => setError(null)} />}

      {result && (
        <div style={{
          background: 'rgba(10,12,16,0.92)', borderRadius: 'var(--nb-radius-lg)', padding: 14,
          border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)',
        }}>
          <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginBottom: 6 }}>Results</div>
          {[
            { label: 'Genes', value: result.finalState.genes.length, color: THEME.SKY },
            { label: 'Mass', value: `${result.finalState.mass.toFixed(3)} pg`, color: THEME.MINT },
            { label: 'Divisions', value: result.divisionEvents, color: THEME.APRICOT },
            { label: 'Doubling', value: `${result.doublingTime.toFixed(1)}h`, color: THEME.LILAC },
            { label: 'μ avg', value: `${result.metrics.avgGrowthRate.toFixed(4)}`, color: THEME.CORAL },
            { label: 'ATP', value: `${result.finalState.atp.toFixed(1)} mM`, color: THEME.SKY },
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: 'rgba(255,255,255,0.4)' }}>{m.label}</span>
              <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: m.color }}>{m.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
