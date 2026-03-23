import { useState, useRef } from 'react';
import { Loader2, Play, Info, RotateCcw } from 'lucide-react';

interface ThermoPanelProps {
  nodeLabel: string;
  nodeId: string;
}

const R = 8.314e-3; // kJ/mol·K

function calcDeltaG(dG0: number, T: number, products: number[], reactants: number[]): number {
  const Q = products.reduce((a, b) => a * b, 1) / reactants.reduce((a, b) => a * b, 1);
  return dG0 + R * T * Math.log(Q || 1e-10);
}

function calcKeq(dG0: number, T: number): number {
  return Math.exp(-dG0 / (R * T));
}

function calcMassBalance(
  S0: number, dG: number, Keq: number, steps: number
): { time: number[]; S: number[]; P: number[] } {
  const time = [0];
  const S = [S0];
  const P = [0];

  const dt = 0.1;
  let s = S0, p = 0;

  for (let i = 0; i < steps; i++) {
    // Driving force proportional to ΔG
    const drivingForce = dG < 0 ? Math.abs(dG) * 0.01 : -Math.abs(dG) * 0.005;
    const rate = drivingForce * s / (s + 0.5);
    s = Math.max(0, s - rate * dt);
    p = Math.max(0, p + rate * dt);
    time.push(parseFloat(((i + 1) * dt).toFixed(2)));
    S.push(parseFloat(s.toFixed(4)));
    P.push(parseFloat(p.toFixed(4)));
  }
  return { time, S, P };
}

function MiniChart({ x, y, color, label }: { x: number[]; y: number[]; color: string; label: string }) {
  const W = 280, H = 80, PAD = { t: 6, r: 8, b: 20, l: 38 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;
  const xMin = x[0], xMax = x[x.length-1] || 1;
  const yMin = 0, yMax = Math.max(...y) * 1.15 || 1;
  const px = (v: number) => PAD.l + ((v - xMin) / (xMax - xMin)) * iW;
  const py = (v: number) => PAD.t + iH - ((v - yMin) / (yMax - yMin)) * iH;
  const pts = x.map((xi, i) => `${px(xi)},${py(y[i])}`).join(' ');

  return (
    <div>
      <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>{label}</p>
      <svg width={W} height={H}>
        {[0.33, 0.66, 1].map(f => (
          <line key={f} x1={PAD.l} x2={W-PAD.r} y1={PAD.t+iH*(1-f)} y2={PAD.t+iH*(1-f)} stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />
        ))}
        {[0, 0.5, 1].map(f => (
          <text key={f} x={PAD.l-4} y={PAD.t+iH*(1-f)+3} textAnchor="end" fill="rgba(255,255,255,0.18)" fontSize={7} fontFamily="Public Sans, sans-serif">
            {(yMax*f).toFixed(2)}
          </text>
        ))}
        {[0, 0.5, 1].map(f => (
          <text key={f} x={PAD.l+iW*f} y={H-3} textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize={7} fontFamily="Public Sans, sans-serif">
            {((xMax-xMin)*f).toFixed(0)}s
          </text>
        ))}
        {pts && <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />}
        {pts && (
          <polygon points={`${px(x[0])},${PAD.t+iH} ${pts} ${px(x[x.length-1])},${PAD.t+iH}`}
            fill={color} fillOpacity={0.08} />
        )}
      </svg>
    </div>
  );
}

export default function ThermodynamicsPanel({ nodeLabel, nodeId }: ThermoPanelProps) {
  const [dG0, setDG0] = useState(-20.0);
  const [T, setT] = useState(310.15); // 37°C in Kelvin
  const [products, setProducts] = useState('0.001');
  const [reactants, setReactants] = useState('1.0');
  const [S0, setS0] = useState(1.0);
  const [result, setResult] = useState<{ dG: number; Keq: number; spontaneous: boolean; sim: ReturnType<typeof calcMassBalance> } | null>(null);
  const [ai, setAi] = useState<{ text: string; loading: boolean }>({ text: '', loading: false });
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    const pArr = products.split(',').map(Number).filter(n => n > 0);
    const rArr = reactants.split(',').map(Number).filter(n => n > 0);
    if (!pArr.length) pArr.push(0.001);
    if (!rArr.length) rArr.push(1.0);

    const dG = calcDeltaG(dG0, T, pArr, rArr);
    const Keq = calcKeq(dG0, T);
    const sim = calcMassBalance(S0, dG, Keq, 100);

    setResult({ dG, Keq, spontaneous: dG < 0, sim });

    // AI interpretation
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setAi({ text: '', loading: true });

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a biochemist. Interpret this thermodynamic analysis for the metabolite ${nodeLabel}:

ΔG° = ${dG0} kJ/mol, Temperature = ${(T - 273.15).toFixed(1)}°C
Actual ΔG = ${dG.toFixed(2)} kJ/mol
Keq = ${Keq.toExponential(3)}
Reaction is ${dG < 0 ? 'spontaneous (exergonic)' : 'non-spontaneous (endergonic)'}

In 3-4 sentences explain: (1) whether this reaction proceeds spontaneously under these conditions, (2) how far from equilibrium the system is, (3) what this means for flux through this metabolite in the pathway, (4) one practical implication for metabolic engineering or drug targeting.` }] }],
          generationConfig: { maxOutputTokens: 280, temperature: 0.2 },
        }),
        signal: abortRef.current.signal,
      });
      const data = await res.json();
      setAi({ text: data.candidates?.[0]?.content?.parts?.[0]?.text || '', loading: false });
    } catch { setAi({ text: '', loading: false }); }
  };

  const InputF = ({ label, value, unit, onChange, type = 'number', hint }: {
    label: string; value: string | number; unit: string;
    onChange: (v: string) => void; type?: string; hint?: string;
  }) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>{unit}</span>
      </div>
      <input type={type} value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '6px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', color: '#ffffff', fontSize: '12px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", outline: 'none', boxSizing: 'border-box' }} />
      {hint && <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '9px', margin: '3px 0 0', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>{hint}</p>}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      <div style={{ padding: '10px 12px', borderRadius: '16px', background: 'rgba(200,224,208,0.05)', border: '1px solid rgba(200,224,208,0.1)' }}>
        <p style={{ color: 'rgba(200,224,208,0.6)', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0 }}>
          Gibbs free energy · Mass balance · Thermodynamic spontaneity
        </p>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', margin: '3px 0 0' }}>
          ΔG = ΔG° + RT ln(Q) — calculate whether this reaction proceeds spontaneously.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <InputF label="ΔG°" value={dG0} unit="kJ/mol"
          onChange={v => setDG0(parseFloat(v) || 0)}
          hint="Standard free energy change" />
        <InputF label="Temperature" value={(T - 273.15).toFixed(1)} unit="°C"
          onChange={v => setT((parseFloat(v) || 37) + 273.15)}
          hint="Physiological = 37°C" />
        <InputF label="[Products]" value={products} unit="mM (comma-sep)"
          onChange={setProducts} type="text"
          hint="e.g. 0.001 or 0.001,0.005" />
        <InputF label="[Reactants]" value={reactants} unit="mM (comma-sep)"
          onChange={setReactants} type="text"
          hint="e.g. 1.0 or 1.0,0.5" />
        <InputF label="Initial [S]₀" value={S0} unit="mM"
          onChange={v => setS0(parseFloat(v) || 1)}
          hint="Starting metabolite conc." />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={run}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '10px', borderRadius: '16px', background: '#ffffff', color: '#0a0a0a', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e5e5e5'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#ffffff'; }}>
          <Play size={13} /> Calculate ΔG
        </button>
        {result && (
          <button onClick={() => { setResult(null); setAi({ text: '', loading: false }); }}
            style={{ padding: '10px 14px', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      {result && (
        <>
          {/* Result metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {[
              { l: 'Actual ΔG', v: `${result.dG.toFixed(2)} kJ/mol`, col: result.spontaneous ? '#C8E0D0' : '#E8C8D4' },
              { l: 'Equilibrium Keq', v: result.Keq.toExponential(3), col: 'rgba(255,255,255,0.6)' },
              { l: 'Spontaneous', v: result.spontaneous ? 'Yes (exergonic)' : 'No (endergonic)', col: result.spontaneous ? '#C8E0D0' : '#E8C8D4' },
              { l: 'T (Kelvin)', v: `${T.toFixed(2)} K`, col: 'rgba(255,255,255,0.5)' },
            ].map(m => (
              <div key={m.l} style={{ padding: '8px 10px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 3px', textTransform: 'uppercase' }}>{m.l}</p>
                <p style={{ color: m.col, fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0, fontWeight: 600 }}>{m.v}</p>
              </div>
            ))}
          </div>

          {/* Equation display */}
          <div style={{ padding: '10px 12px', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 4px' }}>ΔG = ΔG° + RT ln(Q)</p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0 }}>
              {result.dG.toFixed(2)} = {dG0} + {(R * T).toFixed(3)} × ln(Q)
            </p>
          </div>

          {/* Mass balance charts */}
          <div style={{ padding: '14px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <MiniChart x={result.sim.time} y={result.sim.S} color="#C8D8E8" label="Substrate [S] over time" />
            <MiniChart x={result.sim.time} y={result.sim.P} color="#C8E0D0" label="Product [P] over time" />
          </div>
        </>
      )}

      {(ai.loading || ai.text) && (
        <div style={{ padding: '14px', borderRadius: '20px', background: 'rgba(200,224,208,0.04)', border: '1px solid rgba(200,224,208,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Info size={11} style={{ color: 'rgba(200,224,208,0.5)' }} />
            <span style={{ color: 'rgba(200,224,208,0.5)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI Interpretation</span>
          </div>
          {ai.loading
            ? <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Loader2 size={12} style={{ color: 'rgba(200,224,208,0.4)', animation: 'spin 1s linear infinite' }} />
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px' }}>Analysing thermodynamics...</span>
              </div>
            : <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', lineHeight: 1.7, margin: 0 }}>{ai.text}</p>
          }
        </div>
      )}

      <p style={{ color: 'rgba(255,255,255,0.1)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textAlign: 'center', margin: 0 }}>
        ΔG = ΔG° + RT ln(Q) · Based on user-provided concentrations
      </p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
