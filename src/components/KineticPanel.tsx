'use client';

import { useState, useRef, useCallback } from 'react';
import { Loader2, Play, RotateCcw, Info } from 'lucide-react';

interface KineticPanelProps {
  nodeLabel: string;
  nodeId: string;
}

interface SimResult {
  time: number[];
  substrate: number[];
  product: number[];
  velocity: number[];
}

interface AIInterpretation {
  text: string;
  loading: boolean;
}

// ── Michaelis-Menten velocity ──────────────────────────────────────────
function mmVelocity(S: number, Vmax: number, Km: number, Ki?: number, I?: number): number {
  const denominator = Ki && I ? Km * (1 + I / Ki) + S : Km + S;
  return (Vmax * S) / denominator;
}

// ── RK4 ODE solver for single-enzyme pathway ──────────────────────────
// dS/dt = -v(S) + formation_rate
// dP/dt = +v(S) - degradation_rate
function runRK4(
  S0: number, P0: number,
  Vmax: number, Km: number,
  formationRate: number, degradationRate: number,
  Ki: number | undefined, I: number | undefined,
  duration: number, steps: number
): SimResult {
  const dt = duration / steps;
  const time = [0];
  const substrate = [S0];
  const product = [P0];
  const velocity = [mmVelocity(S0, Vmax, Km, Ki, I)];

  let S = S0, P = P0;

  for (let i = 0; i < steps; i++) {
    const v = (s: number) => mmVelocity(Math.max(0, s), Vmax, Km, Ki, I);

    // RK4 for substrate
    const k1s = formationRate - v(S);
    const k2s = formationRate - v(S + dt * k1s / 2);
    const k3s = formationRate - v(S + dt * k2s / 2);
    const k4s = formationRate - v(S + dt * k3s);
    S = Math.max(0, S + (dt / 6) * (k1s + 2 * k2s + 2 * k3s + k4s));

    // RK4 for product
    const k1p = v(substrate[i]) - degradationRate * P;
    const k2p = v(substrate[i]) - degradationRate * (P + dt * k1p / 2);
    const k3p = v(substrate[i]) - degradationRate * (P + dt * k2p / 2);
    const k4p = v(substrate[i]) - degradationRate * (P + dt * k3p);
    P = Math.max(0, P + (dt / 6) * (k1p + 2 * k2p + 2 * k3p + k4p));

    time.push(parseFloat(((i + 1) * dt).toFixed(3)));
    substrate.push(parseFloat(S.toFixed(4)));
    product.push(parseFloat(P.toFixed(4)));
    velocity.push(parseFloat(v(S).toFixed(4)));
  }

  return { time, substrate, product, velocity };
}

// ── Simple SVG line chart ──────────────────────────────────────────────
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
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>{unit}</span>
      </div>
      <input
        type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{ width: '100%', padding: '6px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', color: '#ffffff', fontSize: '12px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", outline: 'none' }}
      />
      {hint && <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '9px', margin: '3px 0 0', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>{hint}</p>}
    </div>
  );
}

export default function KineticPanel({ nodeLabel, nodeId }: KineticPanelProps) {
  const [Vmax, setVmax] = useState(1.0);
  const [Km, setKm] = useState(0.5);
  const [S0, setS0] = useState(2.0);
  const [P0, setP0] = useState(0.0);
  const [formation, setFormation] = useState(0.1);
  const [degradation, setDegradation] = useState(0.05);
  const [Ki, setKi] = useState(0.0);
  const [I, setI] = useState(0.0);
  const [duration, setDuration] = useState(20);
  const [result, setResult] = useState<SimResult | null>(null);
  const [ai, setAi] = useState<AIInterpretation>({ text: '', loading: false });
  const abortRef = useRef<AbortController | null>(null);

  const runSimulation = useCallback(() => {
    const res = runRK4(
      S0, P0, Vmax, Km, formation, degradation,
      Ki > 0 ? Ki : undefined, I > 0 ? I : undefined,
      duration, 200
    );
    setResult(res);
    // After simulation, ask AI to interpret
    interpretWithAI(res);
  }, [S0, P0, Vmax, Km, formation, degradation, Ki, I, duration]);

  const interpretWithAI = async (res: SimResult) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setAi({ text: '', loading: true });

    const finalS = res.substrate[res.substrate.length - 1];
    const finalP = res.product[res.product.length - 1];
    const maxV = Math.max(...res.velocity);
    const steadyV = res.velocity[res.velocity.length - 1];
    const inhibited = Ki > 0 && I > 0;

    const prompt = `You are a biochemistry expert. Interpret this enzyme kinetics simulation result for ${nodeLabel}:

Parameters: Vmax=${Vmax} μmol/min/mg, Km=${Km} mM, Initial [S]=${S0} mM
${inhibited ? `Inhibitor: Ki=${Ki} mM, [I]=${I} mM (competitive inhibition)` : ''}
Results after ${duration} min: Final [Substrate]=${finalS.toFixed(3)} mM, Final [Product]=${finalP.toFixed(3)} mM
Peak velocity=${maxV.toFixed(4)}, Steady-state velocity=${steadyV.toFixed(4)} μmol/min/mg

In 3-4 sentences, explain: (1) what this means biologically for this enzyme, (2) whether the reaction reaches steady state, (3) how substrate saturation affects the pathway, ${inhibited ? '(4) the impact of the inhibitor on pathway flux.' : '(4) one practical implication for metabolic engineering.'}

Be specific and scientific. No generic statements.`;

    try {
      const res2 = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.2 },
        }),
        signal: abortRef.current.signal,
      });
      const data = await res2.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      setAi({ text, loading: false });
    } catch {
      setAi({ text: '', loading: false });
    }
  };

  const reset = () => {
    setResult(null);
    setAi({ text: '', loading: false });
    abortRef.current?.abort();
  };

  // Michaelis-Menten curve (v vs S)
  const mmCurve = {
    x: Array.from({ length: 50 }, (_, i) => (i / 49) * S0 * 3),
    y: [] as number[],
  };
  mmCurve.y = mmCurve.x.map(s => mmVelocity(s, Vmax, Km, Ki > 0 ? Ki : undefined, I > 0 ? I : undefined));

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

      {/* Inhibitor section */}
      <div>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
          Inhibitor (optional)
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <InputField label="Ki" value={Ki} unit="mM" onChange={setKi} min={0} max={100} step={0.01} hint="Inhibition constant (0 = none)" />
          <InputField label="[I]" value={I} unit="mM" onChange={setI} min={0} max={100} step={0.1} hint="Inhibitor concentration" />
        </div>
      </div>

      <InputField label="Simulation duration" value={duration} unit="min" onChange={setDuration} min={1} max={200} step={1} />

      {/* Run button */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={runSimulation}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '10px', borderRadius: '16px', background: '#ffffff', color: '#0a0a0a', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e5e5e5'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#ffffff'; }}>
          <Play size={13} />
          Run Simulation
        </button>
        {result && (
          <button onClick={reset}
            style={{ padding: '10px 14px', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      {/* MM curve — always visible */}
      <div style={{ padding: '14px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <LineChart data={mmCurve} color="#C8D8E8" label="Michaelis-Menten curve (v vs [S])" unit="mM" />
        <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '6px 0 0' }}>
          v = (Vmax × [S]) / (Km{Ki > 0 && I > 0 ? ` × (1 + [I]/Ki)` : ''} + [S])
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
              <div key={m.l} style={{ padding: '8px 10px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 3px', textTransform: 'uppercase' }}>{m.l}</p>
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
            : <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', lineHeight: 1.7, margin: 0 }}>{ai.text}</p>
          }
        </div>
      )}

      <p style={{ color: 'rgba(255,255,255,0.1)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textAlign: 'center', margin: 0 }}>
        Numerical integration via 4th-order Runge-Kutta · Based on user-provided experimental parameters
      </p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
