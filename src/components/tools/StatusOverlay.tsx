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
import { T } from '../ide/tokens';
import { PATHD_THEME } from '../workbench/workbenchTheme';

// ── Sparkline SVG ──────────────────────────────────────────────────────

function Sparkline({ data, height = 36 }: {
  data: number[]; height?: number;
}) {
  if (data.length < 2) return (
    <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <span style={{ fontFamily: T.MONO, fontSize:'9px', color:'rgba(255,255,255,0.15)' }}>AWAITING DATA</span>
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
  const sparkColor = 'rgba(255,255,255,0.7)';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width:'100%', height, display:'block' }}>
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"/>
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
      <circle cx={lastX} cy={lastY} r="2.5" fill={PATHD_THEME.liveRed}>
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
      padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontFamily: T.SANS, fontSize:'10px', color:'rgba(255,255,255,0.35)', fontWeight:500 }}>
        {label}
      </span>
      <div style={{ display:'flex', alignItems:'baseline', gap:'3px' }}>
        <motion.span
          key={Math.round(value * 10)}
          initial={{ opacity:0.4, y:-4 }}
          animate={{ opacity:1, y:0 }}
          transition={{ duration:0.15 }}
          style={{
            fontFamily: T.MONO, fontSize:'13px', fontWeight:600,
            color:'rgba(255,255,255,0.75)',
            textAlign:'right',
            fontVariantNumeric:'tabular-nums',
          }}
        >
          {value.toFixed(decimals)}
        </motion.span>
        {unit && (
          <span style={{ fontFamily: T.MONO, fontSize:'9px', color:'rgba(255,255,255,0.25)' }}>{unit}</span>
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
        <div key={l} style={{ padding:'8px 6px', borderRadius:'8px', background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(255,255,255,0.07)', textAlign:'center' }}>
          <div style={{ fontFamily: T.MONO, fontSize:'11px', fontWeight:700, color:`rgba(255,255,255,${opacity})`, fontVariantNumeric:'tabular-nums' }}>
            {v.toFixed(1)}
          </div>
          <div style={{ fontFamily: T.SANS, fontSize:'8px', color:'rgba(255,255,255,0.28)', marginTop:'2px' }}>{l}</div>
          <div style={{ fontFamily: T.MONO, fontSize:'7px', color:'rgba(255,255,255,0.18)' }}>{u}</div>
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
        <span style={{ fontFamily: T.SANS, fontSize:'9px', color:'rgba(255,255,255,0.32)' }}>{label}</span>
        <span style={{ fontFamily: T.MONO, fontSize:'10px', color:'rgba(255,255,255,0.65)', fontWeight:700 }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ height:`${PATHD_THEME.progressHeight}px`, borderRadius:`${PATHD_THEME.progressRadius}px`, background:PATHD_THEME.progressTrack, overflow:'hidden' }}>
        <motion.div
          animate={{ width:`${pct}%` }}
          transition={{ duration:0.3 }}
          style={{ height:'100%', borderRadius:`${PATHD_THEME.progressRadius}px`, background:PATHD_THEME.progressGradient, boxShadow:PATHD_THEME.progressGlow }}
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
}

export default function StatusOverlay({
  readouts, rateHistory, params, state,
}: StatusOverlayProps) {
  const isStress   = state === 'stress_test';
  const previewRate = michaelisRate(params);

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
        position:'absolute', right:'20px', top:'50%',
        transform:'translateY(-50%)',
        width:'230px', zIndex:10,
        background: PATHD_THEME.panelGradientStrong,
        backdropFilter:'blur(40px)',
        WebkitBackdropFilter:'blur(40px)',
        borderRadius:'18px',
        border:`1px solid ${PATHD_THEME.panelBorder}`,
        borderTop:`1.5px solid ${PATHD_THEME.panelBorderStrong}`,
        boxShadow:'0 18px 42px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.05)',
        padding:'18px 16px',
      }}
    >
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
        <span style={{ fontFamily: T.MONO, fontSize:'9px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.12em', color:'rgba(255,255,255,0.25)' }}>
          READOUTS
        </span>
        <span style={{ fontFamily: T.MONO, fontSize:'8px', color:'rgba(255,255,255,0.2)', fontVariantNumeric:'tabular-nums' }}>
          T:{readouts.tick.toString().padStart(5,'0')}
        </span>
      </div>

      {/* Reaction rate sparkline */}
      <div style={{ marginBottom:'10px' }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:'4px' }}>
          <span style={{ fontFamily: T.SANS, fontSize:'9px', color:'rgba(255,255,255,0.32)' }}>Reaction Rate v</span>
          <div style={{ display:'flex', alignItems:'baseline', gap:'2px' }}>
            <motion.span
              key={Math.round(readouts.reactionRate * 10)}
              initial={{ opacity:0 }} animate={{ opacity:1 }}
              style={{ fontFamily: T.MONO, fontSize:'16px', fontWeight:700, color:'rgba(255,255,255,0.85)', fontVariantNumeric:'tabular-nums' }}
            >
              {readouts.reactionRate.toFixed(2)}
            </motion.span>
            <span style={{ fontFamily: T.MONO, fontSize:'9px', color:'rgba(255,255,255,0.28)' }}>μmol/min</span>
          </div>
        </div>
        <Sparkline data={rateHistory} height={40} />
      </div>

      <div style={{ borderTop:'0.5px solid rgba(255,255,255,0.06)', paddingTop:'10px', marginBottom:'8px' }}>
        <DataRow label="ATP Yield"   value={readouts.atpYield}         unit="mol/mol"  decimals={2} />
        <DataRow label="NADPH Rate"  value={readouts.nadphRate}        unit="μmol/min" decimals={2} />
        <DataRow label="Carbon Eff." value={readouts.carbonEfficiency} unit="%"        decimals={1} />
        <DataRow label="Stress Index" value={readouts.stressIndex}     unit=""         decimals={3} />
        <DataRow label="Preview Rate" value={previewRate}              unit="μmol/min" decimals={2} />
      </div>

      {/* Flux balance + stress gauges */}
      <FluxGauge value={readouts.fluxBalance}   label="Flux Balance" />
      <FluxGauge value={1-readouts.stressIndex} label="Cellular Fitness" />

      {/* Cofactor matrix */}
      <CofactorMatrix readouts={readouts} />

      {/* Equilibrium notice */}
      <AnimatePresence>
        {state === 'equilibrium' && (
          <motion.div
            initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            style={{
              marginTop:'12px', padding:'8px 10px', borderRadius:'10px',
              background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.10)',
              textAlign:'center',
            }}
          >
            <span style={{ fontFamily: T.MONO, fontSize:'9px', color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.1em' }}>
              ⬡ Steady State Reached
            </span>
            <div style={{ fontFamily: T.MONO, fontSize:'8px', color:'rgba(255,255,255,0.35)', marginTop:'2px' }}>
              σ² = {variance.toFixed(4)} (stable)
            </div>
          </motion.div>
        )}
        {isStress && (
          <motion.div
            initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            style={{
              marginTop:'12px', padding:'8px 10px', borderRadius:'10px',
              background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.10)',
              textAlign:'center',
            }}
          >
            <motion.span
              animate={{ opacity:[1,0.4,1] }} transition={{ duration:0.7, repeat:Infinity }}
              style={{ fontFamily: T.MONO, fontSize:'9px', color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.1em' }}
            >
              ⚡ STRESS TEST ACTIVE
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
