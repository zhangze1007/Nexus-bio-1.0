'use client';
/**
 * Nexus-Bio — ToolOverlay (Left Glassmorphism Panel)
 *
 * Design language:
 *   - Glassmorphism 2.0: no hard border, frosted backdrop, #0A0D14 base
 *   - JetBrains Mono for ALL numeric values (right-aligned)
 *   - Framer Motion non-linear displacement on state change
 *
 * Parameter changes inject a velocity force into the fluid background
 * proportional to delta magnitude (Raycaster-equivalent via forceRef)
 */

import { useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SimParams } from '../../machines/metabolicMachine';
import type { FluidForce } from './FluidSimCanvas';
import type { MachineState } from '../../machines/metabolicMachine';
import { STATE_LABELS, STATE_COLORS } from '../../machines/metabolicMachine';

const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const SANS = "'Inter', -apple-system, sans-serif";

// ── Parameter definitions ──────────────────────────────────────────────

interface ParamDef {
  key:   keyof SimParams;
  label: string;
  unit:  string;
  min:   number;
  max:   number;
  step:  number;
  color: string;
  /** Force inject color when this slider moves */
  fluidColor: [number, number, number];
}

const PARAM_DEFS: ParamDef[] = [
  { key:'substrate',   label:'[S] Substrate',   unit:'mM',      min:0,    max:200,  step:1,    color:'#22D3EE', fluidColor:[0, 0.55, 0.65] },
  { key:'enzyme',      label:'[E] Enzyme',      unit:'nM',      min:0,    max:20,   step:0.1,  color:'#E879F9', fluidColor:[0.55, 0.03, 0.70] },
  { key:'temperature', label:'Temperature',     unit:'°C',      min:20,   max:50,   step:0.5,  color:'#F59E0B', fluidColor:[0.72, 0.42, 0.02] },
  { key:'pH',          label:'pH',              unit:'',        min:5.5,  max:9.0,  step:0.1,  color:'#10B981', fluidColor:[0.02, 0.60, 0.38] },
  { key:'vmax',        label:'Vmax',            unit:'μmol/min',min:0.5,  max:20,   step:0.1,  color:'#A78BFA', fluidColor:[0.45, 0.15, 0.70] },
  { key:'km',          label:'Km',              unit:'mM',      min:0.5,  max:50,   step:0.5,  color:'#F59E0B', fluidColor:[0.65, 0.35, 0] },
];

// ── Panel variant animations (non-linear Framer Motion) ───────────────

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
  def:     ParamDef;
  value:   number;
  onChange:(v: number) => void;
  forceRef:React.MutableRefObject<FluidForce | null>;
}

function ParamSlider({ def, value, onChange, forceRef }: SliderProps) {
  const prevRef = useRef(value);
  const pct = ((value - def.min) / (def.max - def.min)) * 100;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseFloat(e.target.value);
    const delta = next - prevRef.current;
    const norm  = Math.abs(delta) / (def.max - def.min);

    // Inject fluid force proportional to parameter delta
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
        <span style={{ fontFamily: SANS, fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'rgba(226,232,240,0.45)' }}>
          {def.label}
        </span>
        <span style={{ fontFamily: MONO, fontSize:'13px', fontWeight:600, color: def.color, textAlign:'right', minWidth:'72px' }}>
          {value.toFixed(def.step < 1 ? 1 : 0)}<span style={{ fontSize:'9px', color:'rgba(226,232,240,0.3)', marginLeft:'2px' }}>{def.unit}</span>
        </span>
      </div>

      {/* Track */}
      <div style={{ position:'relative', height:'20px', display:'flex', alignItems:'center' }}>
        <div style={{ position:'absolute', left:0, right:0, height:'3px', borderRadius:'2px', background:'rgba(255,255,255,0.06)' }}>
          <div style={{ width:`${pct}%`, height:'100%', borderRadius:'2px', background: def.color, opacity:0.7, transition:'width 0.08s' }} />
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
          border-radius:50%; background:${def.color};
          box-shadow:0 0 8px ${def.color}80;
          border:none; cursor:pointer;
        }
        input[type=range]::-moz-range-thumb{
          width:12px; height:12px; border-radius:50%;
          background:${def.color}; border:none; cursor:pointer;
          box-shadow:0 0 8px ${def.color}80;
        }
      `}</style>
    </div>
  );
}

// ── Action button ──────────────────────────────────────────────────────

function ActionBtn({ label, color, onClick, disabled = false }: {
  label: string; color: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex:1, padding:'8px 0', borderRadius:'8px', cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? 'rgba(255,255,255,0.03)' : `rgba(${hexToRgb(color)},0.1)`,
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.05)' : color+'44'}`,
        color: disabled ? 'rgba(255,255,255,0.2)' : color,
        fontFamily: MONO, fontSize:'10px', fontWeight:600,
        textTransform:'uppercase', letterSpacing:'0.08em',
        transition:'all 0.15s',
        boxShadow: disabled ? 'none' : `0 0 8px ${color}22`,
      }}
      onMouseEnter={e => { if (!disabled) { (e.currentTarget as HTMLElement).style.background = `rgba(${hexToRgb(color)},0.2)`; } }}
      onMouseLeave={e => { if (!disabled) { (e.currentTarget as HTMLElement).style.background = `rgba(${hexToRgb(color)},0.1)`; } }}
    >
      {label}
    </button>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

// ── Main export ────────────────────────────────────────────────────────

export default function ToolOverlay({
  params, state, onParam, onStart, onPause, onReset, onStress, onResume, forceRef,
}: ToolOverlayProps) {
  const stateColor = STATE_COLORS[state];
  const stateLabel = STATE_LABELS[state];

  return (
    <motion.div
      animate={panelVariants[state]}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position:'absolute', left:'20px', top:'50%',
        transform:'translateY(-50%)',
        width:'240px', zIndex:10,
        // Glassmorphism 2.0
        background:'rgba(10,13,20,0.72)',
        backdropFilter:'blur(32px) saturate(1.6)',
        WebkitBackdropFilter:'blur(32px) saturate(1.6)',
        borderRadius:'18px',
        border:'none',
        boxShadow:'0 8px 40px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.06)',
        padding:'18px 16px',
        userSelect:'none',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontFamily: MONO, fontSize:'9px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.12em', color:'rgba(226,232,240,0.3)' }}>
            TOOL CABINET
          </span>
          {/* FSM state indicator */}
          <motion.div
            key={state}
            initial={{ scale:1.3, opacity:0 }}
            animate={{ scale:1, opacity:1 }}
            style={{
              display:'flex', alignItems:'center', gap:'5px',
              padding:'2px 8px', borderRadius:'100px',
              background:`${stateColor}18`,
              border:`1px solid ${stateColor}44`,
            }}
          >
            <motion.div
              animate={{ opacity:[0.4, 1, 0.4] }}
              transition={{ duration:1.5, repeat:Infinity }}
              style={{ width:'5px', height:'5px', borderRadius:'50%', background:stateColor }}
            />
            <span style={{ fontFamily:MONO, fontSize:'8px', fontWeight:600, color:stateColor, letterSpacing:'0.1em' }}>
              {stateLabel}
            </span>
          </motion.div>
        </div>
        <div style={{ marginTop:'8px', borderBottom:'1px solid rgba(255,255,255,0.05)', paddingBottom:'12px' }}>
          <span style={{ fontFamily: SANS, fontSize:'12px', fontWeight:600, color:'rgba(226,232,240,0.7)' }}>
            Metabolic Parameters
          </span>
        </div>
      </div>

      {/* Parameter sliders */}
      <div>
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
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)', margin:'12px 0' }} />

      {/* Action buttons */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'8px' }}>
        {state === 'idle' && (
          <ActionBtn label="▶ Start" color="#22D3EE" onClick={onStart} />
        )}
        {state === 'simulating' && (
          <>
            <ActionBtn label="⏸ Pause"  color="#94A3B8" onClick={onPause}  />
            <ActionBtn label="⚡ Stress" color="#F87171" onClick={onStress} />
          </>
        )}
        {state === 'stress_test' && (
          <ActionBtn label="↩ Resume" color="#F59E0B" onClick={onResume} />
        )}
        {state === 'equilibrium' && (
          <ActionBtn label="↺ Restart" color="#10B981" onClick={onStart} />
        )}
      </div>
      <div style={{ display:'flex', gap:'6px' }}>
        <ActionBtn label="Reset" color="#4A5568" onClick={onReset} disabled={state === 'idle'} />
      </div>

      {/* Michaelis-Menten preview formula */}
      <div style={{ marginTop:'14px', padding:'10px', borderRadius:'10px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontFamily:MONO, fontSize:'9px', color:'rgba(226,232,240,0.25)', display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.08em' }}>
          Kinetics Preview
        </span>
        <span style={{ fontFamily:MONO, fontSize:'10px', color:'rgba(226,232,240,0.55)' }}>
          v = Vmax·[S] / (Km+[S])
        </span>
        <br />
        <span style={{ fontFamily:MONO, fontSize:'10px', color:'rgba(226,232,240,0.3)' }}>
          = {params.vmax.toFixed(1)} · {params.substrate} / ({params.km.toFixed(1)} + {params.substrate})
        </span>
      </div>
    </motion.div>
  );
}
