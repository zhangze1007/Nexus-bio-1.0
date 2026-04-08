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

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMachine } from '@xstate/react';
import FluidSimCanvas from './FluidSimCanvas';
import type { FluidForce } from './FluidSimCanvas';
import ToolOverlay from './ToolOverlay';
import StatusOverlay from './StatusOverlay';
import ThreeScene from '../ThreeScene';
import NodePanel from '../NodePanel';
import WorkbenchInlineContext from '../workbench/WorkbenchInlineContext';
import ScientificHero from './shared/ScientificHero';
import ScientificMethodStrip from './shared/ScientificMethodStrip';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import { metabolicMachine } from '../../machines/metabolicMachine';
import type { FBAWorkerIn, FBAWorkerOut } from '../../workers/fbaWorker';
import { useUIStore } from '../../store/uiStore';
import { useWorkbenchStore } from '../../store/workbenchStore';
import pathwayNodes from '../../data/pathwayData.json';
import type { PathwayNode, PathwayEdge } from '../../types';
import { T } from '../ide/tokens';

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

// ── Main orchestrator ──────────────────────────────────────────────────

export default function MetabolicEngPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [snapshot, send] = useMachine(metabolicMachine);
  const { params, readouts, rateHistory } = snapshot.context;
  const state = snapshot.value as 'idle' | 'simulating' | 'stress_test' | 'equilibrium';
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);

  // ── Dismissible center dashboards — let user clear the view of the 3D canvas
  const [heroDismissed, setHeroDismissed] = useState(embedded);
  const [methodStripDismissed, setMethodStripDismissed] = useState(embedded);

  // ── Zustand: node selection + AI-generated pathway ───────────────
  const selectedNode    = useUIStore(s => s.selectedNode);
  const setSelectedNode = useUIStore(s => s.setSelectedNode);
  const aiNodes         = useUIStore(s => s.aiNodes);
  const aiEdges         = useUIStore(s => s.aiEdges);

  // Use AI-generated pathway when available; fall back to demo Artemisinin data
  const activeNodes = (aiNodes && aiNodes.length > 0) ? aiNodes : (pathwayNodes as PathwayNode[]);
  const activeEdges = (aiEdges && aiEdges.length > 0) ? aiEdges : DEMO_EDGES;
  const derivedTarget = useMemo(
    () => analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || inferPathwayTarget(activeNodes),
    [activeNodes, analyzeArtifact?.targetProduct, project?.targetProduct, project?.title],
  );
  const activeRouteLabel = useMemo(
    () => analyzeArtifact?.pathwayCandidates[0]?.label || inferRouteLabel(activeNodes),
    [activeNodes, analyzeArtifact?.pathwayCandidates],
  );

  useEffect(() => {
    setToolPayload('pathd', {
      toolId: 'pathd',
      targetProduct: derivedTarget,
      sourceArtifactId: analyzeArtifact?.id,
      activeRouteLabel,
      nodeCount: activeNodes.length,
      edgeCount: activeEdges.length,
      selectedNodeId: selectedNode?.id ?? null,
      result: {
        pathwayCandidates: analyzeArtifact?.pathwayCandidates.length ?? 1,
        bottleneckCount: analyzeArtifact?.bottleneckAssumptions.length ?? 0,
        enzymeCandidates: analyzeArtifact?.enzymeCandidates.length ?? 0,
        thermodynamicConcerns: analyzeArtifact?.thermodynamicConcerns.length ?? 0,
        highlightedNode: selectedNode?.label ?? null,
        recommendedNextTool: analyzeArtifact?.recommendedNextTools[0] ?? 'fbasim',
        evidenceLinked: Boolean(analyzeArtifact?.id),
      },
      updatedAt: Date.now(),
    });
  }, [
    activeEdges.length,
    activeNodes.length,
    activeRouteLabel,
    analyzeArtifact?.bottleneckAssumptions.length,
    analyzeArtifact?.enzymeCandidates.length,
    analyzeArtifact?.id,
    analyzeArtifact?.pathwayCandidates.length,
    analyzeArtifact?.recommendedNextTools,
    analyzeArtifact?.thermodynamicConcerns.length,
    derivedTarget,
    selectedNode?.id,
    selectedNode?.label,
    setToolPayload,
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

  const sceneOpticalInsets = useMemo(
    () => (embedded
      ? { top: 24, right: 332, bottom: 132, left: 40 }
      : undefined),
    [embedded],
  );

  // ── Fluid force ref — zero allocation on RAF ──────────────────────
  const forceRef = useRef<FluidForce | null>(null);

  // ── FBA Web Worker ─────────────────────────────────────────────────
  const workerRef = useRef<Worker | null>(null);

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
        if (snapshot.value === 'simulating') {
          send({ type: 'EQUILIBRATE' });
        }
      }
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

  const handleStress = useCallback(() => {
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

  return (
    <div style={{
      position: 'relative',
      minHeight: '860px',
      flex: 1,
      background: 'radial-gradient(circle at top, rgba(207,196,227,0.18), transparent 28%), radial-gradient(circle at bottom right, rgba(191,220,205,0.14), transparent 26%), linear-gradient(180deg, #0d0a09 0%, #050505 100%)',
      overflow:'hidden', userSelect:'none',
    }}>
      {/* ── Core viewport: fluid background ── */}
      <FluidSimCanvas
        forceRef={forceRef}
        reactionRate={readouts.reactionRate}
        stressIndex={readouts.stressIndex}
        state={state}
      />

      <div
        className="nb-pathd-hero-stack nb-pathd-hero-stack--rail"
        style={{
          position: 'absolute',
          top: '14px',
          right: '18px',
          left: 'auto',
          transform: 'none',
          width: 'clamp(276px, calc(100vw - 428px), 312px)',
          zIndex: 18,
          pointerEvents: 'none',
          display: 'grid',
          gap: '6px',
          maxHeight: embedded ? 'min(42vh, 340px)' : 'calc(100% - 28px)',
          overflowY: 'auto',
          paddingRight: '4px',
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <WorkbenchInlineContext
            toolId="pathd"
            title="Pathway & Enzyme Design"
            summary="PATHD is now an audited Stage 1 object generator: pathway routes, bottleneck assumptions, enzyme candidates, and the active node focus are written back into the workbench so simulation and control tools can inherit the current design state instead of replaying an old plan."
            compact
            isSimulated={!analyzeArtifact}
          />
        </div>
        {!heroDismissed && <div style={{ pointerEvents: 'auto' }}>
          <ScientificHero
            eyebrow="Stage 1 · Pathway & Enzyme Design"
            title={`${activeRouteLabel} is the current design object`}
            summary="PATHD should read like the front door to the whole scientific program. This page now surfaces the active route, bottleneck pressure, enzyme opportunity, and next tool handoff before the scientist dives into the 3D pathway graph."
            dismissible
            onDismiss={() => setHeroDismissed(true)}
            aside={
              <>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Current focus
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '13px', color: PATHD_THEME.value, fontWeight: 700 }}>
                  {selectedNode?.label ?? derivedTarget}
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.55 }}>
                  {selectedNode
                    ? 'A specific pathway node is in focus, so downstream interpretation should respect this current design emphasis.'
                    : 'No node is pinned yet; the route remains the active object at pathway scale.'}
                </div>
              </>
            }
            signals={[
              {
                label: 'Target Product',
                value: derivedTarget,
                detail: `${activeNodes.length} nodes · ${activeEdges.length} edges in the current executable route graph`,
                tone: 'cool',
              },
              {
                label: 'Bottlenecks',
                value: `${analyzeArtifact?.bottleneckAssumptions.length ?? 0}`,
                detail: analyzeArtifact?.bottleneckAssumptions[0]?.label ?? 'No structured bottleneck has been injected from Analyze yet.',
                tone: (analyzeArtifact?.bottleneckAssumptions.length ?? 0) > 0 ? 'warm' : 'neutral',
              },
              {
                label: 'Enzyme Candidates',
                value: `${analyzeArtifact?.enzymeCandidates.length ?? 0}`,
                detail: analyzeArtifact?.enzymeCandidates[0]?.label ?? 'No enzyme candidate has been prioritized yet.',
                tone: 'neutral',
              },
              {
                label: 'Next Tool',
                value: (analyzeArtifact?.recommendedNextTools[0] ?? 'fbasim').toUpperCase(),
                detail: 'PATHD now makes the next scientific handoff explicit instead of leaving the route as a dead-end visualization.',
                tone: 'warm',
              },
            ]}
          />
        </div>}
        {!methodStripDismissed && <div style={{ pointerEvents: 'auto' }}>
          <ScientificMethodStrip
            label="Pathway workbench"
            dismissible
            onDismiss={() => setMethodStripDismissed(true)}
            items={[
              {
                title: 'Route object',
                detail: 'The active route is treated as the canonical scientific object, so every downstream handoff inherits the same graph rather than rebuilding assumptions from scratch.',
                accent: PATHD_THEME.apricot,
                note: `${activeNodes.length} nodes · ${activeEdges.length} edges`,
              },
              {
                title: '3D scientific canvas',
                detail: 'The immersive pathway graph remains the main stage, but it is now framed by clear evidence and handoff language instead of reading like a standalone visual demo.',
                accent: PATHD_THEME.sky,
                note: selectedNode?.label ?? derivedTarget,
              },
              {
                title: 'Execution handoff',
                detail: 'Bottlenecks, enzyme candidates, and next-tool routing stay visible so the page behaves like the front door to the rest of the workbench.',
                accent: PATHD_THEME.mint,
                note: (analyzeArtifact?.recommendedNextTools[0] ?? 'fbasim').toUpperCase(),
              },
            ]}
          />
        </div>}
        {(heroDismissed || methodStripDismissed) && (
          <div style={{ pointerEvents: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => { setHeroDismissed(false); setMethodStripDismissed(false); }}
              style={{
                padding: '5px 12px',
                borderRadius: '100px',
                background: 'rgba(10,12,16,0.52)',
                border: '1px solid rgba(255,255,255,0.14)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                color: PATHD_THEME.label,
                fontFamily: T.MONO,
                fontSize: '9px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(10,12,16,0.72)';
                (e.currentTarget as HTMLElement).style.color = PATHD_THEME.value;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(10,12,16,0.52)';
                (e.currentTarget as HTMLElement).style.color = PATHD_THEME.label;
              }}
            >
              ↺ Restore dashboard
            </button>
          </div>
        )}
      </div>

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
            tracePlacement="top-left"
          />
        </div>
      </div>

      {/* ── Left tool panel ── */}
      <div style={{ position:'absolute', inset:0, zIndex:10, pointerEvents:'none' }}>
        <div style={{ pointerEvents:'auto' }}>
          <ToolOverlay
            params={params}
            state={state}
            onParam={handleParam}
            onStart={handleStart}
            onPause={handlePause}
            onReset={handleReset}
            onStress={handleStress}
            onResume={handleResume}
            forceRef={forceRef}
          />
        </div>
      </div>

      {/* ── Right status panel ── */}
      <div style={{ position:'absolute', inset:0, zIndex:10, pointerEvents:'none' }}>
        <div style={{ pointerEvents:'auto' }}>
          <StatusOverlay
            readouts={readouts}
            rateHistory={rateHistory}
            params={params}
            state={state}
          />
        </div>
      </div>

      {/* ── Idle prompt — clickable start button ── */}
      <AnimatePresence>
        {state === 'idle' && (
          <motion.button
            initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }}
            onClick={handleStart}
            style={{
              position:'absolute', bottom:'28px', left:'50%', transform:'translateX(-50%)',
              fontFamily: T.MONO, fontSize:'10px', color:'#111318',
              textTransform:'uppercase', letterSpacing:'0.15em', zIndex:25,
              background:'rgba(255,255,255,0.88)', border:'none',
              borderRadius:'100px', padding:'8px 20px', cursor:'pointer',
              transition:'background 0.2s, box-shadow 0.2s',
              boxShadow:'0 12px 28px rgba(0,0,0,0.32)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = '#ffffff';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 34px rgba(0,0,0,0.4)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.88)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 28px rgba(0,0,0,0.32)';
            }}
          >
            ▶ Start Simulation
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Node detail panel (Overview / Structure / Analysis) ── */}
      <AnimatePresence>
        {selectedNode && (
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
}
