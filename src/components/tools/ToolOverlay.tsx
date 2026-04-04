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
        <span style={{ fontFamily: T.SANS, fontSize:'10px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:'rgba(255,255,255,0.35)' }}>
          {def.label}
        </span>
        <span style={{ fontFamily: T.MONO, fontSize:'13px', fontWeight:600, color:'rgba(255,255,255,0.75)', textAlign:'right', minWidth:'72px' }}>
          {value.toFixed(def.step < 1 ? 1 : 0)}<span style={{ fontSize:'9px', color:'rgba(255,255,255,0.28)', marginLeft:'2px' }}>{def.unit}</span>
        </span>
      </div>

      {/* Track */}
      <div style={{ position:'relative', height:'20px', display:'flex', alignItems:'center' }}>
        <div style={{ position:'absolute', left:0, right:0, height:'3px', borderRadius:'2px', background:'rgba(255,255,255,0.06)' }}>
          <div style={{ width:`${pct}%`, height:'100%', borderRadius:'2px', background:'linear-gradient(90deg, #00FFFF, #FF00FF)', boxShadow:'0 0 6px rgba(0,255,255,0.2), 0 0 6px rgba(255,0,255,0.2)', transition:'width 0.08s' }} />
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
          border-radius:50%; background:rgba(255,255,255,0.85);
          box-shadow:0 0 6px rgba(255,255,255,0.3);
          border:none; cursor:pointer;
        }
        input[type=range]::-moz-range-thumb{
          width:12px; height:12px; border-radius:50%;
          background:rgba(255,255,255,0.85); border:none; cursor:pointer;
          box-shadow:0 0 6px rgba(255,255,255,0.3);
        }
      `}</style>
    </div>
  );
}

// ── Action button ──────────────────────────────────────────────────────

function ActionBtn({ label, brightness = 0.7, onClick, disabled = false }: {
  label: string; brightness?: number; onClick: () => void; disabled?: boolean;
}) {
  const alpha = disabled ? 0.15 : brightness;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex:1, padding:'8px 0', borderRadius:'8px', cursor: disabled ? 'not-allowed' : 'pointer',
        background: `rgba(255,255,255,${disabled ? 0.03 : 0.05})`,
        border: `0.5px solid rgba(255,255,255,${disabled ? 0.05 : alpha * 0.4})`,
        color: `rgba(255,255,255,${alpha})`,
        fontFamily: T.MONO, fontSize:'10px', fontWeight:600,
        textTransform:'uppercase', letterSpacing:'0.08em',
        transition:'all 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
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
      animate={panelVariants[state]}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position:'absolute', left:'20px', top:'50%',
        transform:'translateY(-50%)',
        width:'240px', zIndex:10,
        background:'rgba(0,0,0,0.72)',
        backdropFilter:'blur(40px)',
        WebkitBackdropFilter:'blur(40px)',
        borderRadius:'14px',
        border:'1px solid rgba(255,255,255,0.1)',
        borderTop:'1.5px solid rgba(255,255,255,0.22)',
        boxShadow:'0 0 0 0.5px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
        padding:'18px 16px',
        userSelect:'none',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontFamily: T.MONO, fontSize:'9px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.12em', color:'rgba(255,255,255,0.25)' }}>
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
              background:'rgba(255,255,255,0.05)',
              border:'0.5px solid rgba(255,255,255,0.12)',
            }}
          >
            <motion.div
              animate={{ opacity:[0.4, 1, 0.4] }}
              transition={{ duration:1.5, repeat:Infinity }}
              style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#39FF14', boxShadow:'0 0 6px rgba(57,255,20,0.5)' }}
            />
            <span style={{ fontFamily: T.MONO, fontSize:'8px', fontWeight:600, color:'rgba(255,255,255,0.65)', letterSpacing:'0.1em' }}>
              {stateLabel}
            </span>
          </motion.div>
        </div>
        <div style={{ marginTop:'8px', borderBottom:'0.5px solid rgba(255,255,255,0.06)', paddingBottom:'12px' }}>
          <span style={{ fontFamily: T.SANS, fontSize:'12px', fontWeight:600, color:'rgba(255,255,255,0.6)' }}>
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
      <div style={{ borderTop:'0.5px solid rgba(255,255,255,0.06)', margin:'12px 0' }} />

      {/* Action buttons */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'8px' }}>
        {state === 'idle' && (
          <ActionBtn label="▶ Start" brightness={0.85} onClick={onStart} />
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
      <div style={{ marginTop:'14px', padding:'10px', borderRadius:'10px', background:'rgba(255,255,255,0.02)', border:'0.5px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontFamily: T.MONO, fontSize:'9px', color:'rgba(255,255,255,0.22)', display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.08em' }}>
          Kinetics Preview
        </span>
        <span style={{ fontFamily: T.MONO, fontSize:'10px', color:'rgba(255,255,255,0.5)' }}>
          v = Vmax·[S] / (Km+[S])
        </span>
        <br />
        <span style={{ fontFamily: T.MONO, fontSize:'10px', color:'rgba(255,255,255,0.28)' }}>
          = {params.vmax.toFixed(1)} · {params.substrate} / ({params.km.toFixed(1)} + {params.substrate})
        </span>
      </div>
    </motion.div>
  );
}
