'use client';
/**
 * Nexus-Bio — ToolOverlay (Left Panel)
 *
 * Design language:
 *   - B&W silicon aesthetic: #000 base, white text at opacity tiers
 *   - JetBrains Mono for ALL numeric values (right-aligned)
 *   - Framer Motion non-linear displacement on state change
 *
 * Parameter changes inject a velocity force into the fluid background
 * proportional to delta magnitude (Raycaster-equivalent via forceRef)
 */

import { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import type { SimParams } from '../../machines/metabolicMachine';
import type { FluidForce } from './FluidSimCanvas';
import type { MachineState } from '../../machines/metabolicMachine';
import { STATE_LABELS } from '../../machines/metabolicMachine';
import { T } from '../ide/tokens';
import { PATHD_THEME } from '../workbench/workbenchTheme';

// ── Parameter definitions ──────────────────────────────────────────────

interface ParamDef {
  key:        keyof SimParams;
  label:      string;
  unit:       string;
  min:        number;
  max:        number;
  step:       number;
  /** Force inject color when this slider moves */
  fluidColor: [number, number, number];
}

const PARAM_DEFS: ParamDef[] = [
  { key:'substrate',   label:'[S] Substrate',   unit:'mM',       min:0,   max:200, step:1,   fluidColor:[0, 0.55, 0.65] },
  { key:'enzyme',      label:'[E] Enzyme',      unit:'nM',       min:0,   max:20,  step:0.1, fluidColor:[0.55, 0.03, 0.70] },
  { key:'temperature', label:'Temperature',     unit:'°C',       min:20,  max:50,  step:0.5, fluidColor:[0.72, 0.42, 0.02] },
  { key:'pH',          label:'pH',              unit:'',         min:5.5, max:9.0, step:0.1, fluidColor:[0.02, 0.60, 0.38] },
  { key:'vmax',        label:'Vmax',            unit:'μmol/min', min:0.5, max:20,  step:0.1, fluidColor:[0.45, 0.15, 0.70] },
  { key:'km',          label:'Km',              unit:'mM',       min:0.5, max:50,  step:0.5, fluidColor:[0.65, 0.35, 0] },
];

// ── Panel variant animations ───────────────────────────────────────────

const panelVariants = {
  idle:        { x: 0, opacity: 1, scale: 1 },
  simulating:  { x: 0, opacity: 1, scale: 1 },
  stress_test: { x: [-4, 4, -2, 2, 0], opacity: 1, scale: 1.01 },
  equilibrium: { x: 0, opacity: 0.92, scale: 0.995 },
};

// ── Props ──────────────────────────────────────────────────────────────

interface ToolOverlayProps {
  params:     SimParams;
  state:      MachineState;
  onParam:    (key: keyof SimParams, value: number) => void;
  onStart:    () => void;
  onPause:    () => void;
  onReset:    () => void;
  onStress:   () => void;
  onResume:   () => void;
  forceRef:   React.MutableRefObject<FluidForce | null>;
}

// ── Slider component ───────────────────────────────────────────────────

interface SliderProps {
  def:      ParamDef;
  value:    number;
  onChange: (v: number) => void;
  forceRef: React.MutableRefObject<FluidForce | null>;
}

function ParamSlider({ def, value, onChange, forceRef }: SliderProps) {
  const prevRef = useRef(value);
  const pct = ((value - def.min) / (def.max - def.min)) * 100;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseFloat(e.target.value);
    const delta = next - prevRef.current;
    const norm  = Math.abs(delta) / (def.max - def.min);

    if (norm > 0.002) {
      forceRef.current = {
        x: 0.3 + Math.random() * 0.4,
        y: 0.3 + Math.random() * 0.4,
        dx: delta > 0 ? norm * 0.3 : -norm * 0.3,
        dy: (Math.random() - 0.5) * norm * 0.15,
        strength: 0.4 + norm * 2,
        color: def.fluidColor,
      };
    }
    prevRef.current = next;
    onChange(next);
  }, [def, onChange, forceRef]);

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
        <span style={{ fontFamily: T.SANS, fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:PATHD_THEME.label }}>
          {def.label}
        </span>
        <span style={{ fontFamily: T.MONO, fontSize:'13px', fontWeight:600, color:PATHD_THEME.value, textAlign:'right', minWidth:'72px' }}>
          {value.toFixed(def.step < 1 ? 1 : 0)}<span style={{ fontSize:'9px', color:PATHD_THEME.label, marginLeft:'2px' }}>{def.unit}</span>
        </span>
      </div>

      {/* Track */}
      <div style={{ position:'relative', height:'20px', display:'flex', alignItems:'center' }}>
        <div style={{ position:'absolute', left:0, right:0, height:`${PATHD_THEME.progressHeight}px`, borderRadius:`${PATHD_THEME.progressRadius}px`, background:PATHD_THEME.progressTrack }}>
          <div style={{ width:`${pct}%`, height:'100%', borderRadius:`${PATHD_THEME.progressRadius}px`, background:PATHD_THEME.progressGradient, boxShadow:PATHD_THEME.progressGlow, transition:'width 0.08s' }} />
        </div>
        <input
          type="range"
          min={def.min} max={def.max} step={def.step}
          value={value}
          onChange={handleChange}
          style={{
            position:'relative', width:'100%', height:'20px',
            appearance:'none', WebkitAppearance:'none',
            background:'transparent', cursor:'pointer', zIndex:1,
          }}
        />
      </div>

      <style>{`
        input[type=range]::-webkit-slider-thumb{
          -webkit-appearance:none; width:12px; height:12px;
          border-radius:50%; background:${PATHD_THEME.paperElevated};
          box-shadow:0 0 0 1px rgba(34,40,48,0.12), 0 0 8px rgba(175,195,214,0.24);
          border:none; cursor:pointer;
        }
        input[type=range]::-moz-range-thumb{
          width:12px; height:12px; border-radius:50%;
          background:${PATHD_THEME.paperElevated}; border:none; cursor:pointer;
          box-shadow:0 0 0 1px rgba(34,40,48,0.12), 0 0 8px rgba(175,195,214,0.24);
        }
      `}</style>
    </div>
  );
}

// ── Action button ──────────────────────────────────────────────────────

function ActionBtn({ label, brightness = 0.7, onClick, disabled = false, className }: {
  label: string; brightness?: number; onClick: () => void; disabled?: boolean; className?: string;
}) {
  const alpha = disabled ? 0.15 : brightness;
  return (
    <button
      className={className}
      onClick={onClick}
      disabled={disabled}
      style={{
        flex:1, padding:'8px 0', borderRadius:'8px', cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.88)',
        border: `0.5px solid rgba(255,255,255,${disabled ? 0.08 : 0.9})`,
        color: disabled ? 'rgba(255,255,255,0.35)' : '#111318',
        fontFamily: T.MONO, fontSize:'10px', fontWeight:600,
        textTransform:'uppercase', letterSpacing:'0.08em',
        transition:'all 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) { (e.currentTarget as HTMLElement).style.background = '#ffffff'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.22)'; }}}
      onMouseLeave={e => { if (!disabled) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.88)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}}
    >
      {label}
    </button>
  );
}

// ── Main export ────────────────────────────────────────────────────────

export default function ToolOverlay({
  params, state, onParam, onStart, onPause, onReset, onStress, onResume, forceRef,
}: ToolOverlayProps) {
  const stateLabel = STATE_LABELS[state];

  return (
    <motion.div
      className="nb-pathd-floating-panel nb-pathd-floating-panel--left"
      animate={panelVariants[state]}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position:'absolute', left:'20px', top:'50%',
        transform:'translateY(-50%)',
        width:'240px', zIndex:10,
        background: 'rgba(10,12,16,0.52)',
        backdropFilter:'blur(24px) saturate(140%)',
        WebkitBackdropFilter:'blur(24px) saturate(140%)',
        borderRadius:'20px',
        border:'1px solid rgba(255,255,255,0.12)',
        boxShadow:'0 18px 42px rgba(0,0,0,0.38)',
        padding:'18px 16px',
        userSelect:'none',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(191,220,205,0.06) 0%, rgba(175,195,214,0.04) 55%, rgba(207,196,227,0.06) 100%)',
          pointerEvents: 'none',
        }}
      />
      {/* Header */}
      <div style={{ marginBottom:'16px', position:'relative', zIndex:1 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontFamily: T.MONO, fontSize:'9px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.12em', color:PATHD_THEME.label }}>
            Method Rail
          </span>
          {/* FSM state indicator */}
          <motion.div
            key={state}
            initial={{ scale:1.3, opacity:0 }}
            animate={{ scale:1, opacity:1 }}
            style={{
              display:'flex', alignItems:'center', gap:'5px',
              padding:'2px 8px', borderRadius:'100px',
              background:'rgba(255,255,255,0.06)',
              border:'1px solid rgba(255,255,255,0.12)',
            }}
          >
            <motion.div
              animate={{ opacity:[0.4, 1, 0.4] }}
              transition={{ duration:1.5, repeat:Infinity }}
              style={{ width:'5px', height:'5px', borderRadius:'50%', background:PATHD_THEME.liveRed, boxShadow:'0 0 6px rgba(232,163,161,0.48)' }}
            />
            <span style={{ fontFamily: T.MONO, fontSize:'8px', fontWeight:600, color:PATHD_THEME.value, letterSpacing:'0.1em' }}>
              {stateLabel}
            </span>
          </motion.div>
        </div>
        <div style={{ marginTop:'8px', borderBottom:'1px solid rgba(255,255,255,0.08)', paddingBottom:'12px' }}>
          <span style={{ fontFamily: T.SANS, fontSize:'12px', fontWeight:600, color:PATHD_THEME.value }}>
            Metabolic Parameters
          </span>
        </div>
      </div>

      {/* Parameter sliders */}
      <div style={{ position:'relative', zIndex:1 }}>
        {PARAM_DEFS.map(def => (
          <ParamSlider
            key={def.key}
            def={def}
            value={params[def.key]}
            onChange={v => onParam(def.key, v)}
            forceRef={forceRef}
          />
        ))}
      </div>

      {/* Divider */}
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)', margin:'12px 0', position:'relative', zIndex:1 }} />

      {/* Action buttons */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'8px', position:'relative', zIndex:1 }}>
        {state === 'idle' && (
          <ActionBtn label="▶ Start" brightness={0.85} onClick={onStart} className="nb-pathd-overlay-idle-start" />
        )}
        {state === 'simulating' && (
          <>
            <ActionBtn label="⏸ Pause"  brightness={0.5} onClick={onPause}  />
            <ActionBtn label="⚡ Stress" brightness={0.4} onClick={onStress} />
          </>
        )}
        {state === 'stress_test' && (
          <ActionBtn label="↩ Resume" brightness={0.7} onClick={onResume} />
        )}
        {state === 'equilibrium' && (
          <ActionBtn label="↺ Restart" brightness={0.7} onClick={onStart} />
        )}
      </div>
      <div style={{ display:'flex', gap:'6px' }}>
        <ActionBtn label="Reset" brightness={0.3} onClick={onReset} disabled={state === 'idle'} />
      </div>

      {/* Michaelis-Menten preview formula */}
      <div style={{ marginTop:'14px', padding:'10px', borderRadius:'12px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.10)', position:'relative', zIndex:1 }}>
        <span style={{ fontFamily: T.MONO, fontSize:'9px', color:PATHD_THEME.label, display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.08em' }}>
          Kinetics Preview
        </span>
        <span style={{ fontFamily: T.MONO, fontSize:'10px', color:PATHD_THEME.value }}>
          v = Vmax·[S] / (Km+[S])
        </span>
        <br />
        <span style={{ fontFamily: T.MONO, fontSize:'10px', color:PATHD_THEME.label }}>
          = {params.vmax.toFixed(1)} · {params.substrate} / ({params.km.toFixed(1)} + {params.substrate})
        </span>
      </div>
    </motion.div>
  );
}
