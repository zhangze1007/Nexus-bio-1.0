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

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMachine } from '@xstate/react';
import { Dna, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import FluidSimCanvas from './FluidSimCanvas';
import type { FluidForce } from './FluidSimCanvas';
import ToolOverlay from './ToolOverlay';
import StatusOverlay from './StatusOverlay';
import ThreeScene from '../ThreeScene';
import NodePanel from '../NodePanel';
import { metabolicMachine, STATE_LABELS } from '../../machines/metabolicMachine';
import type { FBAWorkerIn, FBAWorkerOut } from '../../workers/fbaWorker';
import { useUIStore } from '../../store/uiStore';
import pathwayNodes from '../../data/pathwayData.json';
import type { PathwayNode, PathwayEdge } from '../../types';

const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const SANS = "'Inter', -apple-system, sans-serif";

// ── Demo pathway edges (Artemisinin biosynthesis — Ro et al. 2006) ─────
const DEMO_EDGES: PathwayEdge[] = [
  { start: 'acetyl_coa',         end: 'hmg_coa',             direction: 'forward' },
  { start: 'hmg_coa',            end: 'mevalonate',           direction: 'forward' },
  { start: 'mevalonate',         end: 'fpp',                  direction: 'forward' },
  { start: 'fpp',                end: 'amorpha_4_11_diene',   direction: 'forward' },
  { start: 'amorpha_4_11_diene', end: 'artemisinic_acid',     direction: 'forward' },
  { start: 'artemisinic_acid',   end: 'artemisinin',          direction: 'forward' },
];

// ── Top bar component ──────────────────────────────────────────────────

interface TopBarProps {
  state:      string;
  stateLabel: string;
  tick:       number;
}

function TopBar({ state, stateLabel, tick }: TopBarProps) {
  return (
    <div style={{
      position:'absolute', top:0, left:0, right:0, zIndex:20,
      height:'52px', display:'flex', alignItems:'center',
      justifyContent:'space-between', padding:'0 20px',
      background:'rgba(0,0,0,0.85)',
      backdropFilter:'blur(24px)',
      WebkitBackdropFilter:'blur(24px)',
      borderBottom:'1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Left: back + logo */}
      <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:'6px', textDecoration:'none', color:'rgba(226,232,240,0.35)', transition:'color 0.2s' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(226,232,240,0.8)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(226,232,240,0.35)'}
        >
          <ChevronLeft size={13} />
          <span style={{ fontFamily:SANS, fontSize:'10px', letterSpacing:'0.03em' }}>Home</span>
        </Link>
        <div style={{ width:'1px', height:'16px', background:'rgba(255,255,255,0.07)' }} />
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{ width:'22px', height:'22px', borderRadius:'7px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Dna size={11} style={{ color:'rgba(255,255,255,0.65)' }} />
          </div>
          <div>
            <div style={{ fontFamily:SANS, fontSize:'11px', fontWeight:600, color:'rgba(226,232,240,0.85)', letterSpacing:'-0.01em' }}>Metabolic Eng. Lab</div>
            <div style={{ fontFamily:MONO, fontSize:'8px', color:'rgba(226,232,240,0.25)', letterSpacing:'0.08em', textTransform:'uppercase' }}>nexus-bio · /tools/metabolic-eng</div>
          </div>
        </div>
      </div>

      {/* Center: state label */}
      <motion.div
        key={state}
        initial={{ opacity:0, y:-8, letterSpacing:'0.3em' }}
        animate={{ opacity:1, y:0, letterSpacing:'0.2em' }}
        transition={{ duration:0.55, ease:[0.22,1,0.36,1] }}
        style={{
          fontFamily:MONO, fontSize:'11px', fontWeight:700,
          textTransform:'uppercase', color:'rgba(255,255,255,0.75)',
          letterSpacing:'0.2em',
          padding:'4px 14px', borderRadius:'100px',
          background:'rgba(255,255,255,0.05)',
          border:'1px solid rgba(255,255,255,0.12)',
        }}
      >
        {stateLabel}
      </motion.div>

      {/* Right: system metrics */}
      <div style={{ display:'flex', gap:'20px', alignItems:'center' }}>
        {[
          { l:'TICK',     v: tick.toString().padStart(6,'0') },
          { l:'INSTANCE', v: '8K' },
          { l:'FSM',      v: state.toUpperCase() },
        ].map(({ l, v }) => (
          <div key={l} style={{ textAlign:'right' }}>
            <div style={{ fontFamily:MONO, fontSize:'8px', color:'rgba(226,232,240,0.2)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{l}</div>
            <div style={{ fontFamily:MONO, fontSize:'11px', color:'rgba(226,232,240,0.55)', fontVariantNumeric:'tabular-nums' }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main orchestrator ──────────────────────────────────────────────────

export default function MetabolicEngPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [snapshot, send] = useMachine(metabolicMachine);
  const { params, readouts, rateHistory } = snapshot.context;
  const state = snapshot.value as 'idle' | 'simulating' | 'stress_test' | 'equilibrium';

  // ── Zustand: node selection + AI-generated pathway ───────────────
  const selectedNode    = useUIStore(s => s.selectedNode);
  const setSelectedNode = useUIStore(s => s.setSelectedNode);
  const aiNodes         = useUIStore(s => s.aiNodes);
  const aiEdges         = useUIStore(s => s.aiEdges);

  // Use AI-generated pathway when available; fall back to demo Artemisinin data
  const activeNodes = (aiNodes && aiNodes.length > 0) ? aiNodes : (pathwayNodes as PathwayNode[]);
  const activeEdges = (aiEdges && aiEdges.length > 0) ? aiEdges : DEMO_EDGES;

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

  const stateLabel = STATE_LABELS[state];

  return (
    <div style={{
      position: embedded ? 'absolute' : 'fixed', inset:0,
      background:'#000000',
      overflow:'hidden', userSelect:'none',
    }}>
      {/* ── Core viewport: fluid background ── */}
      <FluidSimCanvas
        forceRef={forceRef}
        reactionRate={readouts.reactionRate}
        stressIndex={readouts.stressIndex}
        state={state}
      />

      {/* ── Top bar ── */}
      <TopBar
        state={state}
        stateLabel={stateLabel}
        tick={readouts.tick}
      />

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
          />
        </div>
      </div>

      {/* ── Left tool panel ── */}
      <div style={{ position:'absolute', inset:0, top:'52px', zIndex:10, pointerEvents:'none' }}>
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
      <div style={{ position:'absolute', inset:0, top:'52px', zIndex:10, pointerEvents:'none' }}>
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
              fontFamily:MONO, fontSize:'10px', color:'rgba(226,232,240,0.45)',
              textTransform:'uppercase', letterSpacing:'0.15em', zIndex:25,
              background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.12)',
              borderRadius:'100px', padding:'8px 20px', cursor:'pointer',
              transition:'color 0.2s, border-color 0.2s, background 0.2s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = '#fff';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = 'rgba(226,232,240,0.45)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
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
