'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Loader2, Play, RotateCcw, Info, Plus, Trash2 } from 'lucide-react';
import ActionButton from './tools/shared/ActionButton';
import { type SimResult } from '../utils/kinetics';
import {
  competitiveInhibition,
  uncompetitiveInhibition,
  mixedInhibition,
  substrateInhibition,
  estimateParameters,
  type InhibitionModel,
  type KineticDataPoint,
  type ParameterEstimationResult,
} from '../services/kineticsEngine';
import ResearchAnswerRenderer from './tools/shared/ResearchAnswerRenderer';
import { buildKineticFallbackInterpretation } from '../utils/pathdAnalysisFallback';

// ── Types ────────────────────────────────────────────────────────

type InhibitionType = 'none' | 'competitive' | 'uncompetitive' | 'mixed' | 'substrate';
type ActiveTab = 'simulation' | 'estimation' | 'sensitivity';

interface KineticPanelProps {
  nodeLabel: string;
  nodeId: string;
}

// ── Velocity function builder ────────────────────────────────────

function buildVelocityFn(
  type: InhibitionType,
  vmax: number, km: number,
  ki: number, kiu: number, kis: number,
  inhibitorConc: number,
): (s: number) => number {
  switch (type) {
    case 'competitive':
      return (s) => competitiveInhibition(vmax, s, km, ki, inhibitorConc);
    case 'uncompetitive':
      return (s) => uncompetitiveInhibition(vmax, s, km, kiu, inhibitorConc);
    case 'mixed':
      return (s) => mixedInhibition(vmax, s, km, ki, kiu, inhibitorConc);
    case 'substrate':
      return (s) => substrateInhibition(vmax, s, km, kis);
    default:
      return (s) => {
        const sSafe = Math.max(0, s);
        const denom = km + sSafe;
        return denom <= 0 ? 0 : (vmax * sSafe) / denom;
      };
  }
}

/** Get the symbolic formula text for a given inhibition type. */
function getFormulaText(type: InhibitionType): string {
  switch (type) {
    case 'none': return 'v = Vmax × [S] / (Km + [S])';
    case 'competitive': return 'v = Vmax × [S] / (Km × (1 + [I]/Ki) + [S])';
    case 'uncompetitive': return 'v = Vmax × [S] / (Km + [S] × (1 + [I]/Kiu))';
    case 'mixed': return 'v = Vmax × [S] / (Km × (1 + [I]/Kic) + [S] × (1 + [I]/Kiu))';
    case 'substrate': return 'v = Vmax × [S] / (Km + [S] + [S]²/Kis)';
  }
}

/** Human-readable inhibition type label. */
function inhibitionLabel(type: InhibitionType): string {
  switch (type) {
    case 'none': return 'None';
    case 'competitive': return 'Competitive';
    case 'uncompetitive': return 'Uncompetitive';
    case 'mixed': return 'Mixed';
    case 'substrate': return 'Substrate';
  }
}

// ── Local ODE simulation (RK4, supports all inhibition models) ──

function simulateODE(
  S0: number, P0: number,
  velocityFn: (s: number) => number,
  formationRate: number, degradationRate: number,
  duration: number, steps: number,
): SimResult {
  if (steps <= 0 || duration <= 0) {
    return { time: [0], substrate: [S0], product: [P0], velocity: [velocityFn(Math.max(0, S0))] };
  }
  const dt = duration / steps;
  const time: number[] = [0];
  const substrate: number[] = [S0];
  const product: number[] = [P0];
  const velocity: number[] = [velocityFn(Math.max(0, S0))];

  let S = S0, P = P0;
  for (let i = 0; i < steps; i++) {
    const dS = (s: number) => -velocityFn(Math.max(0, s)) + formationRate;
    const dP = (_s: number, p: number) => velocityFn(Math.max(0, _s)) - degradationRate * Math.max(0, p);

    const k1s = dS(S), k1p = dP(S, P);
    const k2s = dS(S + dt / 2 * k1s), k2p = dP(S + dt / 2 * k1s, P + dt / 2 * k1p);
    const k3s = dS(S + dt / 2 * k2s), k3p = dP(S + dt / 2 * k2s, P + dt / 2 * k2p);
    const k4s = dS(S + dt * k3s), k4p = dP(S + dt * k3s, P + dt * k3p);

    S = Math.max(0, S + (dt / 6) * (k1s + 2 * k2s + 2 * k3s + k4s));
    P = Math.max(0, P + (dt / 6) * (k1p + 2 * k2p + 2 * k3p + k4p));

    const t = (i + 1) * dt;
    time.push(parseFloat(t.toFixed(3)));
    substrate.push(parseFloat(S.toFixed(4)));
    product.push(parseFloat(P.toFixed(4)));
    velocity.push(parseFloat(velocityFn(Math.max(0, S)).toFixed(4)));
  }
  return { time, substrate, product, velocity };
}

// ── Simple SVG line chart ────────────────────────────────────────
function LineChart({ data, color, label, unit }: {
  data: { x: number[]; y: number[] };
  color: string;
  label: string;
  unit: string;
}) {
  const W = 280, H = 100, PAD = { t: 8, r: 8, b: 24, l: 40 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const xMin = Math.min(...data.x), xMax = Math.max(...data.x);
  const yMin = 0, yMax = Math.max(...data.y) * 1.1 || 1;

  const px = (x: number) => PAD.l + ((x - xMin) / (xMax - xMin || 1)) * iW;
  const py = (y: number) => PAD.t + iH - ((y - yMin) / (yMax - yMin || 1)) * iH;

  const points = data.x.map((x, i) => `${px(x)},${py(data.y[i])}`).join(' ');

  return (
    <div>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        {/* Grid */}
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f} x1={PAD.l} x2={W - PAD.r}
            y1={PAD.t + iH * (1 - f)} y2={PAD.t + iH * (1 - f)}
            stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />
        ))}
        {/* Y axis labels */}
        {[0, 0.5, 1].map(f => (
          <text key={f} x={PAD.l - 4} y={PAD.t + iH * (1 - f) + 3}
            textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize={8} fontFamily="Public Sans, sans-serif">
            {(yMin + (yMax - yMin) * f).toFixed(1)}
          </text>
        ))}
        {/* X axis labels */}
        {[0, 0.5, 1].map(f => (
          <text key={f} x={PAD.l + iW * f} y={H - 4}
            textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={8} fontFamily="Public Sans, sans-serif">
            {(xMin + (xMax - xMin) * f).toFixed(1)}
          </text>
        ))}
        {/* X axis unit */}
        <text x={W - PAD.r} y={H - 4} textAnchor="end" fill="rgba(255,255,255,0.15)" fontSize={7} fontFamily="Public Sans, sans-serif">
          {unit}
        </text>
        {/* Line */}
        {data.x.length > 1 && (
          <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* Area under curve */}
        {data.x.length > 1 && (
          <polygon
            points={`${px(data.x[0])},${PAD.t + iH} ${points} ${px(data.x[data.x.length - 1])},${PAD.t + iH}`}
            fill={color} fillOpacity={0.08}
          />
        )}
      </svg>
    </div>
  );
}

// ── Estimation chart (data points + fitted curve) ────────────────

function EstimationChart({ data, fittedCurve, color }: {
  data: KineticDataPoint[];
  fittedCurve: { x: number[]; y: number[] };
  color: string;
}) {
  const W = 280, H = 140, PAD = { t: 8, r: 8, b: 24, l: 40 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const allX = [...data.map(d => d.s), ...fittedCurve.x];
  const allY = [...data.map(d => d.v), ...fittedCurve.y];
  const xMin = 0, xMax = Math.max(...allX) * 1.05 || 1;
  const yMin = 0, yMax = Math.max(...allY) * 1.1 || 1;

  const px = (x: number) => PAD.l + ((x - xMin) / (xMax - xMin || 1)) * iW;
  const py = (y: number) => PAD.t + iH - ((y - yMin) / (yMax - yMin || 1)) * iH;

  const curvePoints = fittedCurve.x.map((x, i) => `${px(x)},${py(fittedCurve.y[i])}`).join(' ');

  return (
    <div>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Data vs Fitted Curve
      </p>
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f} x1={PAD.l} x2={W - PAD.r}
            y1={PAD.t + iH * (1 - f)} y2={PAD.t + iH * (1 - f)}
            stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />
        ))}
        {[0, 0.5, 1].map(f => (
          <text key={f} x={PAD.l - 4} y={PAD.t + iH * (1 - f) + 3}
            textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize={8} fontFamily="Public Sans, sans-serif">
            {(yMin + (yMax - yMin) * f).toFixed(1)}
          </text>
        ))}
        {[0, 0.5, 1].map(f => (
          <text key={f} x={PAD.l + iW * f} y={H - 4}
            textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={8} fontFamily="Public Sans, sans-serif">
            {(xMin + (xMax - xMin) * f).toFixed(1)}
          </text>
        ))}
        <text x={W - PAD.r} y={H - 4} textAnchor="end" fill="rgba(255,255,255,0.15)" fontSize={7} fontFamily="Public Sans, sans-serif">
          mM
        </text>
        {fittedCurve.x.length > 1 && (
          <polyline points={curvePoints} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {data.map((d, i) => (
          <circle key={i} cx={px(d.s)} cy={py(d.v)} r={3.5}
            fill="none" stroke="#FA8072" strokeWidth={1.5} />
        ))}
      </svg>
      <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.3)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif" }}>
          <span style={{ width: '12px', height: '1.5px', background: color, display: 'inline-block' }} />
          Fitted
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.3)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif" }}>
          <span style={{ width: '7px', height: '7px', border: '1.5px solid #FA8072', borderRadius: '50%', display: 'inline-block' }} />
          Data
        </span>
      </div>
    </div>
  );
}

// ── Input field ──────────────────────────────────────────────────

function InputField({ label, value, unit, onChange, min, max, step, hint }: {
  label: string; value: number; unit: string;
  onChange: (v: number) => void;
  min: number; max: number; step: number;
  hint?: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </label>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>{unit}</span>
      </div>
      <input
        type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{ width: '100%', padding: '6px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#ffffff', fontSize: '12px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", outline: '2px solid rgba(175,195,214,0.5)', outlineOffset: '2px' }}
      />
      {hint && <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', margin: '3px 0 0', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>{hint}</p>}
    </div>
  );
}

// ── Select field ─────────────────────────────────────────────────

function SelectField({ label, value, options, onChange, hint }: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void; hint?: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </label>
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '6px 10px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px', color: '#ffffff', fontSize: '12px',
          fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1",
          outline: '2px solid rgba(175,195,214,0.5)', outlineOffset: '2px',
          cursor: 'pointer', appearance: 'none' as const,
          backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'%3E%3Cpath d=\'M0 0l5 6 5-6z\' fill=\'rgba(255,255,255,0.3)\'/%3E%3C/svg%3E")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
          paddingRight: '28px',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: '#1a1d24', color: '#fff' }}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', margin: '3px 0 0', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>{hint}</p>}
    </div>
  );
}

// ── Sensitivity bar ──────────────────────────────────────────────

function SensitivityBar({ name, value, maxValue, color }: {
  name: string; value: number; maxValue: number; color: string;
}) {
  const barWidth = maxValue > 0 ? Math.min(100, (Math.abs(value) / maxValue) * 100) : 0;
  const isPositive = value >= 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", width: '36px', textAlign: 'right', fontWeight: 600 }}>
        {name}
      </span>
      <div style={{ flex: 1, height: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '7px', overflow: 'hidden', position: 'relative' }}>
        <div style={{
          width: `${barWidth}%`, height: '100%',
          background: isPositive ? color : '#FA8072',
          borderRadius: '7px', transition: 'width 0.3s ease',
          opacity: 0.7,
        }} />
      </div>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", width: '55px', textAlign: 'right' }}>
        {isPositive ? '+' : ''}{value.toFixed(3)}
      </span>
    </div>
  );
}

interface AIInterpretation { text: string; loading: boolean }

// ── Main component ───────────────────────────────────────────────

export default function KineticPanel({ nodeLabel, nodeId }: KineticPanelProps) {
  // Simulation parameters
  const [Vmax, setVmax] = useState(1.0);
  const [Km, setKm] = useState(0.5);
  const [S0, setS0] = useState(2.0);
  const [P0, setP0] = useState(0.0);
  const [formation, setFormation] = useState(0.1);
  const [degradation, setDegradation] = useState(0.05);
  const [duration, setDuration] = useState(20);

  // Inhibition parameters
  const [inhibitionType, setInhibitionType] = useState<InhibitionType>('none');
  const [Ki, setKi] = useState(0.5);
  const [Kiu, setKiu] = useState(0.5);
  const [Kis, setKis] = useState(5.0);
  const [I, setI] = useState(0.0);

  // Results
  const [result, setResult] = useState<SimResult | null>(null);
  const [ai, setAi] = useState<AIInterpretation>({ text: '', loading: false });
  const abortRef = useRef<AbortController | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>('simulation');

  // Parameter estimation state
  const [estModel, setEstModel] = useState<InhibitionModel>('competitive');
  const [estData, setEstData] = useState<KineticDataPoint[]>([]);
  const [estResult, setEstResult] = useState<ParameterEstimationResult | null>(null);
  const [estimating, setEstimating] = useState(false);

  // Cancel in-flight request on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // ── Velocity function (memoized) ─────────────────────────────

  const velocityFn = useMemo(
    () => buildVelocityFn(inhibitionType, Vmax, Km, Ki, Kiu, Kis, I),
    [inhibitionType, Vmax, Km, Ki, Kiu, Kis, I],
  );

  // ── MM curve (memoized) ──────────────────────────────────────

  const mmCurve = useMemo(() => {
    const x = Array.from({ length: 50 }, (_, i) => (i / 49) * S0 * 3);
    return { x, y: x.map(s => velocityFn(s)) };
  }, [S0, velocityFn]);

  // ── Sensitivity analysis (memoized) ──────────────────────────

  const sensitivities = useMemo(() => {
    const v0 = velocityFn(S0);
    if (v0 <= 0) return [];

    const entries: Array<{ name: string; baseValue: number; build: (delta: number) => (s: number) => number }> = [
      { name: 'Vmax', baseValue: Vmax, build: (d) => buildVelocityFn(inhibitionType, Vmax + d, Km, Ki, Kiu, Kis, I) },
      { name: 'Km', baseValue: Km, build: (d) => buildVelocityFn(inhibitionType, Vmax, Km + d, Ki, Kiu, Kis, I) },
    ];

    if (inhibitionType === 'competitive' || inhibitionType === 'mixed') {
      const base = Ki > 0 ? Ki : 0.5;
      entries.push({ name: 'Ki', baseValue: base, build: (d) => buildVelocityFn(inhibitionType, Vmax, Km, base + d, Kiu, Kis, I) });
    }
    if (inhibitionType === 'uncompetitive' || inhibitionType === 'mixed') {
      const base = Kiu > 0 ? Kiu : 0.5;
      entries.push({ name: 'Kiu', baseValue: base, build: (d) => buildVelocityFn(inhibitionType, Vmax, Km, Ki, base + d, Kis, I) });
    }
    if (inhibitionType === 'substrate') {
      const base = Kis > 0 ? Kis : 5;
      entries.push({ name: 'Kis', baseValue: base, build: (d) => buildVelocityFn(inhibitionType, Vmax, Km, Ki, Kiu, base + d, I) });
    }

    return entries.map(e => {
      const delta = Math.max(1e-6, e.baseValue * 0.01);
      const vPerturbed = e.build(delta)(S0);
      const sensitivity = ((vPerturbed - v0) / delta) * (e.baseValue / v0);
      return { name: e.name, sensitivity, value: e.baseValue };
    });
  }, [inhibitionType, Vmax, Km, Ki, Kiu, Kis, I, S0, velocityFn]);

  // ── Simulation ───────────────────────────────────────────────

  const runSimulation = useCallback(() => {
    const res = simulateODE(S0, P0, velocityFn, formation, degradation, duration, 200);
    setResult(res);
    interpretWithAI(res);
  }, [S0, P0, velocityFn, formation, degradation, duration]);

  const interpretWithAI = async (res: SimResult) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAi({ text: '', loading: true });

    const finalS = res.substrate[res.substrate.length - 1];
    const finalP = res.product[res.product.length - 1];
    const maxV = Math.max(...res.velocity);
    const steadyV = res.velocity[res.velocity.length - 1];
    const hasInhibition = inhibitionType !== 'none';

    let inhibitorDesc = '';
    if (inhibitionType === 'competitive') inhibitorDesc = `Competitive inhibition: Ki=${Ki} mM, [I]=${I} mM`;
    else if (inhibitionType === 'uncompetitive') inhibitorDesc = `Uncompetitive inhibition: Kiu=${Kiu} mM, [I]=${I} mM`;
    else if (inhibitionType === 'mixed') inhibitorDesc = `Mixed inhibition: Kic=${Ki} mM, Kiu=${Kiu} mM, [I]=${I} mM`;
    else if (inhibitionType === 'substrate') inhibitorDesc = `Substrate inhibition: Kis=${Kis} mM`;

    const prompt = `You are a biochemistry expert. Interpret this enzyme kinetics simulation result for ${nodeLabel}:

Parameters: Vmax=${Vmax} μmol/min/mg, Km=${Km} mM, Initial [S]=${S0} mM
${hasInhibition ? inhibitorDesc : ''}
Results after ${duration} min: Final [Substrate]=${finalS.toFixed(3)} mM, Final [Product]=${finalP.toFixed(3)} mM
Peak velocity=${maxV.toFixed(4)}, Steady-state velocity=${steadyV.toFixed(4)} μmol/min/mg

Address: (1) what this means biologically for this enzyme, (2) whether the reaction reaches steady state, (3) how substrate saturation affects the pathway, ${hasInhibition ? `(4) the impact of ${inhibitionLabel(inhibitionType).toLowerCase()} inhibition on pathway flux.` : '(4) one practical implication for metabolic engineering.'}

Respond in short researcher-facing prose with the headings Summary, Key observations, Interpretation, and Recommended next steps.
Do not return JSON, code fences, or developer-style logs.

Be specific and scientific. No generic statements.`;

    try {
      const res2 = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.2 },
        }),
        signal: controller.signal,
      });
      if (!res2.ok) throw new Error(`Gemini request failed with ${res2.status}`);
      const data = await res2.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      setAi({
        text: text.trim() || buildKineticFallbackInterpretation({
          nodeLabel,
          duration,
          finalProduct: finalP,
          finalSubstrate: finalS,
          inhibited: hasInhibition && I > 0,
          inhibitorConcentration: I,
          inhibitorStrength: Ki,
          km: Km,
          maxVelocity: maxV,
          peakVelocity: maxV,
          steadyVelocity: steadyV,
          substrate: S0,
          vmax: Vmax,
        }),
        loading: false,
      });
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
      setAi({
        text: buildKineticFallbackInterpretation({
          nodeLabel,
          duration,
          finalProduct: finalP,
          finalSubstrate: finalS,
          inhibited: hasInhibition && I > 0,
          inhibitorConcentration: I,
          inhibitorStrength: Ki,
          km: Km,
          maxVelocity: maxV,
          peakVelocity: maxV,
          steadyVelocity: steadyV,
          substrate: S0,
          vmax: Vmax,
        }),
        loading: false,
      });
    }
  };

  const reset = () => {
    setResult(null);
    setAi({ text: '', loading: false });
    abortRef.current?.abort();
  };

  // ── Parameter estimation ─────────────────────────────────────

  const addDataPoint = () => {
    setEstData(prev => [...prev, { s: 1, v: 0.5, i: I > 0 ? I : undefined }]);
  };

  const removeDataPoint = (index: number) => {
    setEstData(prev => prev.filter((_, i) => i !== index));
  };

  const updateDataPoint = (index: number, field: 's' | 'v' | 'i', value: number) => {
    setEstData(prev => prev.map((d, i) => {
      if (i !== index) return d;
      const updated = { ...d, [field]: value };
      if (field === 'i' && value <= 0) delete updated.i;
      return updated;
    }));
  };

  const runEstimation = useCallback(() => {
    if (estData.length < 3) return;
    setEstimating(true);

    // Use a small timeout so the UI updates before the (possibly synchronous) computation
    setTimeout(() => {
      try {
        const initialGuess: number[] = (() => {
          switch (estModel) {
            case 'competitive': return [Vmax, Km, Ki > 0 ? Ki : 0.5];
            case 'uncompetitive': return [Vmax, Km, Kiu > 0 ? Kiu : 0.5];
            case 'mixed': return [Vmax, Km, Ki > 0 ? Ki : 0.5, Kiu > 0 ? Kiu : 0.5];
          }
        })();

        const result = estimateParameters(estModel, estData, initialGuess);
        setEstResult(result);
      } catch {
        setEstResult(null);
      }
      setEstimating(false);
    }, 50);
  }, [estModel, estData, Vmax, Km, Ki, Kiu]);

  // Fitted curve for estimation chart
  const fittedCurve = useMemo(() => {
    if (!estResult || estData.length === 0) return null;

    const allS = estData.map(d => d.s);
    const sMin = Math.min(...allS);
    const sMax = Math.max(...allS);
    const padding = (sMax - sMin) * 0.15 || 1;
    const xStart = Math.max(0, sMin - padding);
    const xEnd = sMax + padding;

    const x = Array.from({ length: 50 }, (_, i) => xStart + ((xEnd - xStart) * i) / 49);
    const p = estResult.params;

    const y = x.map(s => {
      const avgI = estData.reduce((sum, d) => sum + (d.i ?? 0), 0) / estData.length;
      switch (estModel) {
        case 'competitive': return competitiveInhibition(p[0], s, p[1], p[2], avgI);
        case 'uncompetitive': return uncompetitiveInhibition(p[0], s, p[1], p[2], avgI);
        case 'mixed': return mixedInhibition(p[0], s, p[1], p[2], p[3], avgI);
      }
    });

    return { x, y };
  }, [estResult, estData, estModel]);

  // Apply estimated params to simulation
  const applyEstimation = useCallback(() => {
    if (!estResult) return;
    const p = estResult.params;
    setVmax(p[0]);
    setKm(p[1]);
    if (estModel === 'competitive') setKi(p[2]);
    else if (estModel === 'uncompetitive') setKiu(p[2]);
    else if (estModel === 'mixed') { setKi(p[2]); setKiu(p[3]); }
    setActiveTab('simulation');
  }, [estResult, estModel]);

  // ── Tab buttons ──────────────────────────────────────────────

  const tabs: Array<{ key: ActiveTab; label: string }> = [
    { key: 'simulation', label: 'Simulation' },
    { key: 'estimation', label: 'Estimation' },
    { key: 'sensitivity', label: 'Sensitivity' },
  ];

  // ── Estimation param names ───────────────────────────────────

  const estParamNames = useMemo(() => {
    switch (estModel) {
      case 'competitive': return ['Vmax', 'Km', 'Ki'];
      case 'uncompetitive': return ['Vmax', 'Km', 'Kiu'];
      case 'mixed': return ['Vmax', 'Km', 'Kic', 'Kiu'];
    }
  }, [estModel]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Header */}
      <div style={{ padding: '10px 12px', borderRadius: '16px', background: 'rgba(200,216,232,0.05)', border: '1px solid rgba(200,216,232,0.1)' }}>
        <p style={{ color: 'rgba(200,216,232,0.6)', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0 }}>
          Michaelis-Menten kinetics + RK4 ODE simulation
        </p>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', margin: '3px 0 0' }}>
          Enter your experimental parameters below. Results are calculated numerically in real-time.
        </p>
      </div>

      {/* Parameters grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <InputField label="Vmax" value={Vmax} unit="μmol/min/mg" onChange={setVmax} min={0.01} max={100} step={0.1} hint="Max reaction velocity" />
        <InputField label="Km" value={Km} unit="mM" onChange={setKm} min={0.001} max={100} step={0.01} hint="Michaelis constant" />
        <InputField label="[S]₀" value={S0} unit="mM" onChange={setS0} min={0.01} max={100} step={0.1} hint="Initial substrate" />
        <InputField label="[P]₀" value={P0} unit="mM" onChange={setP0} min={0} max={100} step={0.1} hint="Initial product" />
        <InputField label="Formation rate" value={formation} unit="mM/min" onChange={setFormation} min={0} max={10} step={0.01} hint="Upstream supply" />
        <InputField label="Degradation rate" value={degradation} unit="min⁻¹" onChange={setDegradation} min={0} max={1} step={0.001} hint="Product clearance" />
      </div>

      {/* Inhibition section */}
      <div>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
          Inhibition
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SelectField
            label="Type"
            value={inhibitionType}
            onChange={v => setInhibitionType(v as InhibitionType)}
            options={[
              { value: 'none', label: 'No inhibition' },
              { value: 'competitive', label: 'Competitive (E + I ↔ EI)' },
              { value: 'uncompetitive', label: 'Uncompetitive (ES + I ↔ ESI)' },
              { value: 'mixed', label: 'Mixed (E + I ↔ EI, ES + I ↔ ESI)' },
              { value: 'substrate', label: 'Substrate (excess [S] inhibition)' },
            ]}
            hint={inhibitionType !== 'none' ? getFormulaText(inhibitionType) : undefined}
          />

          {/* Dynamic inhibitor parameters */}
          {inhibitionType !== 'none' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {(inhibitionType === 'competitive' || inhibitionType === 'mixed') && (
                <InputField label={inhibitionType === 'mixed' ? 'Kic' : 'Ki'} value={Ki} unit="mM" onChange={setKi} min={0.001} max={100} step={0.01} hint={inhibitionType === 'mixed' ? 'Competitive inhibition constant' : 'Inhibition constant'} />
              )}
              {(inhibitionType === 'uncompetitive' || inhibitionType === 'mixed') && (
                <InputField label="Kiu" value={Kiu} unit="mM" onChange={setKiu} min={0.001} max={100} step={0.01} hint="Uncompetitive inhibition constant" />
              )}
              {inhibitionType === 'substrate' && (
                <InputField label="Kis" value={Kis} unit="mM" onChange={setKis} min={0.01} max={1000} step={0.1} hint="Substrate inhibition constant" />
              )}
              {inhibitionType !== 'substrate' && (
                <InputField label="[I]" value={I} unit="mM" onChange={setI} min={0} max={100} step={0.1} hint="Inhibitor concentration" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '2px', padding: '2px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '7px 8px', borderRadius: '10px', border: 'none',
              background: activeTab === tab.key ? 'rgba(200,216,232,0.1)' : 'transparent',
              color: activeTab === tab.key ? 'rgba(200,216,232,0.8)' : 'rgba(255,255,255,0.3)',
              fontSize: '10px', fontFamily: "'Public Sans',sans-serif",
              fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase',
              letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.15s ease',
              fontWeight: activeTab === tab.key ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════ SIMULATION TAB ════════ */}
      {activeTab === 'simulation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <InputField label="Simulation duration" value={duration} unit="min" onChange={setDuration} min={1} max={200} step={1} />

          {/* Run button */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <ActionButton
              variant="primary"
              size="md"
              icon={<Play size={13} />}
              onClick={runSimulation}
              style={{ flex: 1 }}
            >
              Run Simulation
            </ActionButton>
            {result && (
              <ActionButton
                variant="secondary"
                size="md"
                icon={<RotateCcw size={13} />}
                onClick={reset}
              />
            )}
          </div>

          {/* MM curve — always visible */}
          <div style={{ padding: '14px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <LineChart data={mmCurve} color="#C8D8E8" label={`Michaelis-Menten curve (${inhibitionLabel(inhibitionType)} model)`} unit="mM" />
            <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '6px 0 0' }}>
              {getFormulaText(inhibitionType)}
            </p>
          </div>

          {/* ODE results */}
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ padding: '14px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <LineChart
                  data={{ x: result.time, y: result.substrate }}
                  color="#C8D8E8" label="Substrate [S] over time" unit="min"
                />
              </div>
              <div style={{ padding: '14px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <LineChart
                  data={{ x: result.time, y: result.product }}
                  color="#C8E0D0" label="Product [P] over time" unit="min"
                />
              </div>
              <div style={{ padding: '14px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <LineChart
                  data={{ x: result.time, y: result.velocity }}
                  color="#E8DCC8" label="Reaction velocity over time" unit="min"
                />
              </div>

              {/* Key metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {[
                  { l: 'Final [S]', v: `${result.substrate[result.substrate.length-1].toFixed(3)} mM` },
                  { l: 'Final [P]', v: `${result.product[result.product.length-1].toFixed(3)} mM` },
                  { l: 'Peak velocity', v: `${Math.max(...result.velocity).toFixed(4)} μmol/min/mg` },
                  { l: 'Saturation', v: `${((S0 / (S0 + Km)) * 100).toFixed(1)}%` },
                ].map(m => (
                  <div key={m.l} style={{ padding: '8px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 3px', textTransform: 'uppercase' }}>{m.l}</p>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0, fontWeight: 600 }}>{m.v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI interpretation */}
          {(ai.loading || ai.text) && (
            <div style={{ padding: '14px', borderRadius: '20px', background: 'rgba(200,216,232,0.04)', border: '1px solid rgba(200,216,232,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Info size={11} style={{ color: 'rgba(200,216,232,0.5)' }} />
                <span style={{ color: 'rgba(200,216,232,0.5)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  AI Interpretation
                </span>
              </div>
              {ai.loading
                ? <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Loader2 size={12} style={{ color: 'rgba(200,216,232,0.4)', animation: 'spin 1s linear infinite' }} />
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px' }}>Analyzing results...</span>
                  </div>
                : <ResearchAnswerRenderer answer={ai.text} />
              }
            </div>
          )}
        </div>
      )}

      {/* ════════ ESTIMATION TAB ════════ */}
      {activeTab === 'estimation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Model selector */}
          <SelectField
            label="Fitting model"
            value={estModel}
            onChange={v => { setEstModel(v as InhibitionModel); setEstResult(null); }}
            options={[
              { value: 'competitive', label: 'Competitive (fits Vmax, Km, Ki)' },
              { value: 'uncompetitive', label: 'Uncompetitive (fits Vmax, Km, Kiu)' },
              { value: 'mixed', label: 'Mixed (fits Vmax, Km, Kic, Kiu)' },
            ]}
            hint="Substrate inhibition estimation not yet supported by the LM solver"
          />

          {/* Data table header */}
          <div>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
              Experimental Data ({estData.length} points)
            </p>

            {/* Column headers */}
            {estData.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: estModel !== 'competitive' ? '1fr 1fr 1fr 28px' : '1fr 1fr 28px', gap: '6px', marginBottom: '6px', padding: '0 2px' }}>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.04em' }}>[S] (mM)</span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.04em' }}>v (μmol/min)</span>
                {estModel !== 'competitive' && (
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.04em' }}>[I] (mM)</span>
                )}
                <span />
              </div>
            )}

            {/* Data rows */}
            {estData.map((d, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: estModel !== 'competitive' ? '1fr 1fr 1fr 28px' : '1fr 1fr 28px', gap: '6px', marginBottom: '4px' }}>
                <input
                  type="number" value={d.s} min={0} step={0.1}
                  onChange={e => updateDataPoint(i, 's', parseFloat(e.target.value) || 0)}
                  style={{ padding: '5px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", width: '100%', outline: 'none' }}
                />
                <input
                  type="number" value={d.v} min={0} step={0.01}
                  onChange={e => updateDataPoint(i, 'v', parseFloat(e.target.value) || 0)}
                  style={{ padding: '5px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", width: '100%', outline: 'none' }}
                />
                {estModel !== 'competitive' && (
                  <input
                    type="number" value={d.i ?? 0} min={0} step={0.1}
                    onChange={e => updateDataPoint(i, 'i', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    style={{ padding: '5px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", width: '100%', outline: 'none' }}
                  />
                )}
                <button
                  onClick={() => removeDataPoint(i)}
                  style={{ padding: '5px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                  title="Remove data point"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {/* Add data point button */}
            <button
              onClick={addDataPoint}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px',
                background: 'rgba(200,216,232,0.05)', border: '1px dashed rgba(200,216,232,0.15)',
                borderRadius: '10px', color: 'rgba(200,216,232,0.5)', fontSize: '10px',
                fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1",
                textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer',
                marginTop: estData.length > 0 ? '6px' : '0',
                width: '100%', justifyContent: 'center',
              }}
            >
              <Plus size={12} /> Add Data Point
            </button>

            {estData.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '8px 0 0', textAlign: 'center' }}>
                Add at least 3 data points to fit parameters
              </p>
            )}
          </div>

          {/* Fit button */}
          <ActionButton
            variant="primary"
            size="md"
            icon={estimating ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={13} />}
            onClick={runEstimation}
            disabled={estData.length < 3 || estimating}
            style={{ opacity: estData.length < 3 ? 0.4 : 1 }}
          >
            {estimating ? 'Fitting...' : 'Fit Parameters (Levenberg-Marquardt)'}
          </ActionButton>

          {/* Estimation results */}
          {estResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Fitted parameters */}
              <div style={{ padding: '14px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Fitted Parameters
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {estResult.params.map((p, i) => (
                    <div key={i} style={{ padding: '8px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 3px', textTransform: 'uppercase' }}>{estParamNames[i]}</p>
                      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0, fontWeight: 600 }}>{p.toFixed(4)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fit quality */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                {[
                  { l: 'RSS', v: estResult.rss.toFixed(6) },
                  { l: 'Iterations', v: `${estResult.iterations}` },
                  { l: 'Converged', v: estResult.converged ? 'Yes' : 'No' },
                ].map(m => (
                  <div key={m.l} style={{ padding: '8px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 3px', textTransform: 'uppercase' }}>{m.l}</p>
                    <p style={{ color: m.l === 'Converged' && !estResult.converged ? '#FA8072' : 'rgba(255,255,255,0.7)', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0, fontWeight: 600 }}>{m.v}</p>
                  </div>
                ))}
              </div>

              {/* Fitted curve chart */}
              {fittedCurve && (
                <div style={{ padding: '14px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <EstimationChart data={estData} fittedCurve={fittedCurve} color="#C8E0D0" />
                </div>
              )}

              {/* Apply button */}
              <ActionButton
                variant="secondary"
                size="md"
                onClick={applyEstimation}
              >
                Apply to Simulation Parameters
              </ActionButton>
            </div>
          )}
        </div>
      )}

      {/* ════════ SENSITIVITY TAB ════════ */}
      {activeTab === 'sensitivity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '10px 12px', borderRadius: '16px', background: 'rgba(200,216,232,0.05)', border: '1px solid rgba(200,216,232,0.1)' }}>
            <p style={{ color: 'rgba(200,216,232,0.6)', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0 }}>
              Normalized Sensitivity Coefficients
            </p>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', margin: '3px 0 0' }}>
              S = (∂v/∂p) × (p/v) at [S] = {S0.toFixed(2)} mM. A coefficient of 1.0 means a 1% change in the parameter causes a 1% change in velocity.
            </p>
          </div>

          {/* Current velocity at S0 */}
          <div style={{ padding: '8px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase' }}>v at [S]={S0.toFixed(2)} mM</span>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", fontWeight: 600 }}>{velocityFn(S0).toFixed(4)} μmol/min/mg</span>
          </div>

          {/* Sensitivity bars */}
          {sensitivities.length > 0 ? (
            <div style={{ padding: '14px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Parameter Sensitivity
              </p>
              {(() => {
                const maxSens = Math.max(...sensitivities.map(s => Math.abs(s.sensitivity)), 0.01);
                return sensitivities.map(s => (
                  <SensitivityBar
                    key={s.name}
                    name={s.name}
                    value={s.sensitivity}
                    maxValue={maxSens}
                    color="#C8D8E8"
                  />
                ));
              })()}
            </div>
          ) : (
            <div style={{ padding: '14px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>
                No sensitivity data. Ensure [S] &gt; 0 and parameters are non-zero.
              </p>
            </div>
          )}

          {/* Interpretation guide */}
          <div style={{ padding: '10px 12px', borderRadius: '16px', background: 'rgba(200,216,232,0.04)', border: '1px solid rgba(200,216,232,0.08)' }}>
            <p style={{ color: 'rgba(200,216,232,0.5)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Reading the chart
            </p>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0, lineHeight: 1.5 }}>
              Positive values (blue) mean velocity increases when the parameter increases. Negative values (red) mean velocity decreases. For competitive inhibition, increasing Ki reduces inhibition and increases velocity. The larger the absolute value, the more sensitive the system is to that parameter.
            </p>
          </div>

          {/* Sensitivity summary table */}
          {sensitivities.length > 0 && (
            <div style={{ padding: '14px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Parameter Values
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sensitivities.length, 3)}, 1fr)`, gap: '6px' }}>
                {sensitivities.map(s => (
                  <div key={s.name} style={{ padding: '8px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 3px', textTransform: 'uppercase' }}>{s.name}</p>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0, fontWeight: 600 }}>{s.value.toFixed(3)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p style={{ color: 'rgba(255,255,255,0.1)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textAlign: 'center', margin: 0 }}>
        Numerical integration via 4th-order Runge-Kutta · LM parameter estimation · Based on user-provided experimental parameters
      </p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
