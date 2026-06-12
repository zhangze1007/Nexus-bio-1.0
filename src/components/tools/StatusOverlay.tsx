'use client';
/**
 * Nexus-Bio — StatusOverlay (Right sidebar data readouts)
 *
 * Design:
 *   - B&W silicon aesthetic: pure black panel, white text at opacity tiers
 *   - JetBrains Mono for ALL numeric values, right-aligned
 *   - Sparkline rate history chart (SVG, no external dep)
 *   - Animated counter transitions (Framer Motion)
 */

import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SimReadouts, SimParams } from '../../machines/metabolicMachine';
import { STATE_LABELS, michaelisRate } from '../../machines/metabolicMachine';
import type { MachineState } from '../../machines/metabolicMachine';
import { PATHD_FLOATING_PANEL_SHEEN, PATHD_FLOATING_PANEL_SURFACE } from './shared/pathdFloatingPanelStyles';
import { usePathdFloatingPanelScroll } from './shared/usePathdFloatingPanelScroll';
import { THEME } from '../../theme';

// ── Sparkline SVG ──────────────────────────────────────────────────────

function Sparkline({ data, height = 36 }: {
  data: number[]; height?: number;
}) {
  if (data.length < 2) return (
    <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <span style={{ fontFamily: THEME.MONO, fontSize:'var(--nb-fs-xs)', color:THEME.LABEL }}>AWAITING DATA</span>
    </div>
  );

  const w = 200, h = height;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const lastX = w, lastY = h - ((data[data.length-1] - min) / range) * (h - 4) - 2;
  const sparkColor = THEME.VALUE;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width:'100%', height, display:'block' }}>
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={THEME.SKY} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={THEME.SKY} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polyline
        points={`0,${h} ${pts} ${w},${h}`}
        fill="url(#spark-grad)"
        stroke="none"
      />
      <polyline
        points={pts}
        fill="none"
        stroke={sparkColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.8}
      />
      {/* Live cursor dot */}
      <circle cx={lastX} cy={lastY} r="2.5" fill={THEME.CORAL}>
        <animate attributeName="r" values="2.5;4;2.5" dur="1.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1.5s" repeatCount="indefinite"/>
      </circle>
    </svg>
  );
}

// ── Data row ───────────────────────────────────────────────────────────

function DataRow({ label, value, unit, decimals = 2 }: {
  label: string; value: number; unit?: string; decimals?: number;
}) {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.06)',
    }}>
      <span style={{ fontFamily: THEME.SANS, fontSize:'var(--nb-fs-xs)', color:THEME.LABEL, fontWeight:500 }}>
        {label}
      </span>
      <div style={{ display:'flex', alignItems:'baseline', gap:'3px' }}>
        <motion.span
          key={Math.round(value * 10)}
          initial={{ opacity:0.4, y:-4 }}
          animate={{ opacity:1, y:0 }}
          transition={{ duration:0.15 }}
          style={{
            fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', fontWeight:600,
            color:THEME.VALUE,
            textAlign:'right',
            fontVariantNumeric:'tabular-nums',
          }}
        >
          {value.toFixed(decimals)}
        </motion.span>
        {unit && (
          <span style={{ fontFamily: THEME.MONO, fontSize:'var(--nb-fs-xs)', color:THEME.LABEL }}>{unit}</span>
        )}
      </div>
    </div>
  );
}

// ── ATP / cofactor matrix ──────────────────────────────────────────────

function CofactorMatrix({ readouts }: { readouts: SimReadouts }) {
  const items = [
    { l:'ATP',   v: readouts.atpYield,          u:'mol/mol',  opacity: 0.8 },
    { l:'NADPH', v: readouts.nadphRate,          u:'μmol/min', opacity: 0.6 },
    { l:'C%',    v: readouts.carbonEfficiency,   u:'%',        opacity: 0.45 },
  ];
  return (
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px', marginTop:'8px' }}>
      {items.map(({ l, v, u, opacity }) => (
        <div key={l} style={{ padding:'8px 6px', borderRadius:'var(--nb-radius-md)', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.10)', textAlign:'center' }}>
          <div style={{ fontFamily: THEME.MONO, fontSize:'var(--nb-fs-xs)', fontWeight:700, color:opacity > 0.7 ? THEME.VALUE : THEME.LABEL, fontVariantNumeric:'tabular-nums' }}>
            {v.toFixed(1)}
          </div>
          <div style={{ fontFamily: THEME.SANS, fontSize:'var(--nb-fs-xs)', color:THEME.LABEL, marginTop:'2px' }}>{l}</div>
          <div style={{ fontFamily: THEME.MONO, fontSize:'var(--nb-fs-xs)', color:THEME.LABEL }}>{u}</div>
        </div>
      ))}
    </div>
  );
}

// ── Flux balance gauge ─────────────────────────────────────────────────

function FluxGauge({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div style={{ marginTop:'6px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
        <span style={{ fontFamily: THEME.SANS, fontSize:'var(--nb-fs-xs)', color:THEME.LABEL }}>{label}</span>
        <span style={{ fontFamily: THEME.MONO, fontSize:'var(--nb-fs-xs)', color:THEME.VALUE, fontWeight:700 }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ height:`${THEME.PROGRESS_HEIGHT}px`, borderRadius:`${THEME.PROGRESS_RADIUS}px`, background:THEME.PROGRESS_TRACK, overflow:'hidden' }}>
        <motion.div
          animate={{ width:`${pct}%` }}
          transition={{ duration:0.3 }}
          style={{ height:'100%', borderRadius:`${THEME.PROGRESS_RADIUS}px`, background:THEME.PROGRESS_GRADIENT, boxShadow:THEME.PROGRESS_GLOW }}
        />
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────

interface StatusOverlayProps {
  readouts:    SimReadouts;
  rateHistory: number[];
  params:      SimParams;
  state:       MachineState;
  width?:      number;
  bottomOffset?: number;
}

export default function StatusOverlay({
  readouts, rateHistory, params, state, width = 230, bottomOffset = 18,
}: StatusOverlayProps) {
  const isStress   = state === 'stress_test';
  const previewRate = michaelisRate(params);
  const {
    containPanelInteraction,
    handlePanelWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    resetTouchState,
  } = usePathdFloatingPanelScroll();

  const variance = rateHistory.length > 10
    ? rateHistory.slice(-20).reduce((s, v, _, a) => {
        const mean = a.reduce((x,y) => x+y, 0) / a.length;
        return s + (v - mean)**2 / a.length;
      }, 0)
    : 999;

  return (
    <motion.div
      className="nb-pathd-floating-panel nb-pathd-floating-panel--right"
      animate={{ x: 0, opacity: 1 }}
      initial={{ x: 30, opacity: 0 }}
      transition={{ duration: 0.5, ease:[0.22,1,0.36,1] }}
      style={{
        position:'absolute', right:'20px', top:'auto',
        bottom:`${bottomOffset}px`,
        transform:'none',
        width:`${width}px`, zIndex:10,
        maxHeight:'min(39vh, 352px)',
        padding:'18px 16px',
        overflowX:'hidden',
        overflowY:'auto',
        WebkitOverflowScrolling:'touch',
        overscrollBehavior:'contain',
        touchAction:'pan-y',
        ...PATHD_FLOATING_PANEL_SURFACE,
      }}
      onWheelCapture={handlePanelWheel}
      onPointerDownCapture={containPanelInteraction}
      onTouchStartCapture={handleTouchStart}
      onTouchMoveCapture={handleTouchMove}
      onTouchEndCapture={handleTouchEnd}
      onTouchCancelCapture={resetTouchState}
    >
      <div
        aria-hidden
        style={{
          ...PATHD_FLOATING_PANEL_SHEEN,
        }}
      />
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', position:'relative', zIndex:1 }}>
        <span style={{ fontFamily: THEME.MONO, fontSize:'var(--nb-fs-xs)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.12em', color:THEME.LABEL }}>
          Readout Ledger
        </span>
        <span style={{ fontFamily: THEME.MONO, fontSize:'var(--nb-fs-xs)', color:THEME.LABEL, fontVariantNumeric:'tabular-nums' }}>
          T:{readouts.tick.toString().padStart(5,'0')}
        </span>
      </div>

      {/* Reaction rate sparkline */}
      <div style={{ marginBottom:'10px', position:'relative', zIndex:1 }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:'4px' }}>
          <span style={{ fontFamily: THEME.SANS, fontSize:'var(--nb-fs-xs)', color:THEME.LABEL }}>Reaction Rate v</span>
          <div style={{ display:'flex', alignItems:'baseline', gap:'2px' }}>
            <motion.span
              key={Math.round(readouts.reactionRate * 10)}
              initial={{ opacity:0 }} animate={{ opacity:1 }}
              style={{ fontFamily: THEME.MONO, fontSize:'16px', fontWeight:700, color:THEME.VALUE, fontVariantNumeric:'tabular-nums' }}
            >
              {readouts.reactionRate.toFixed(2)}
            </motion.span>
            <span style={{ fontFamily: THEME.MONO, fontSize:'var(--nb-fs-xs)', color:THEME.LABEL }}>μmol/min</span>
          </div>
        </div>
        <Sparkline data={rateHistory} height={40} />
      </div>

      <div style={{ borderTop:`1px solid ${THEME.BORDER}`, paddingTop:'10px', marginBottom:'8px', position:'relative', zIndex:1 }}>
        <DataRow label="ATP Yield"   value={readouts.atpYield}         unit="mol/mol"  decimals={2} />
        <DataRow label="NADPH Rate"  value={readouts.nadphRate}        unit="μmol/min" decimals={2} />
        <DataRow label="Carbon Eff." value={readouts.carbonEfficiency} unit="%"        decimals={1} />
        <DataRow label="Stress Index" value={readouts.stressIndex}     unit=""         decimals={3} />
        <DataRow label="Preview Rate" value={previewRate}              unit="μmol/min" decimals={2} />
      </div>

      {/* Flux balance + stress gauges */}
      <div style={{ position:'relative', zIndex:1 }}>
        <FluxGauge value={readouts.fluxBalance}   label="Flux Balance" />
        <FluxGauge value={1-readouts.stressIndex} label="Cellular Fitness" />
      </div>

      {/* Cofactor matrix */}
      <div style={{ position:'relative', zIndex:1 }}>
        <CofactorMatrix readouts={readouts} />
      </div>

      {/* Equilibrium notice */}
      <AnimatePresence>
        {state === 'equilibrium' && (
          <motion.div
            initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            style={{
              marginTop:'12px', padding:'8px 10px', borderRadius:'var(--nb-radius-md)',
              background:'rgba(191,220,205,0.14)', border:'1px solid rgba(191,220,205,0.28)',
              textAlign:'center',
            }}
          >
            <span style={{ fontFamily: THEME.MONO, fontSize:'var(--nb-fs-xs)', color:THEME.VALUE, textTransform:'uppercase', letterSpacing:'0.1em' }}>
              Steady State Reached
            </span>
            <div style={{ fontFamily: THEME.MONO, fontSize:'var(--nb-fs-xs)', color:THEME.LABEL, marginTop:'2px' }}>
              σ² = {variance.toFixed(4)} (stable)
            </div>
          </motion.div>
        )}
        {isStress && (
          <motion.div
            initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            style={{
              marginTop:'12px', padding:'8px 10px', borderRadius:'var(--nb-radius-md)',
              background:'rgba(232,163,161,0.14)', border:'1px solid rgba(232,163,161,0.28)',
              textAlign:'center',
            }}
          >
            <motion.span
              animate={{ opacity:[1,0.4,1] }} transition={{ duration:0.7, repeat:Infinity }}
              style={{ fontFamily: THEME.MONO, fontSize:'var(--nb-fs-xs)', color:THEME.VALUE, textTransform:'uppercase', letterSpacing:'0.1em' }}
            >
              Parameter Oscillation Active
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
