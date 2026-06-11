'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Loader2, Play, Info, RotateCcw, Database, Zap } from 'lucide-react';
import ActionButton from './tools/shared/ActionButton';
import { calcDeltaG, calcKeq, calcMassBalance_DEMO, R } from '../utils/thermodynamics';
import { calculateEnzymeKinetics, eyringRateConstant, estimateActivationEnergy } from '../utils/eyringKinetics';
import ResearchAnswerRenderer from './tools/shared/ResearchAnswerRenderer';
import { buildThermodynamicFallbackInterpretation } from '../utils/pathdAnalysisFallback';

interface BrendaKinetics {
  ecNumber: string;
  km?: { median: number | null; values: number[]; unit: string; substrates: string[]; n_observations: number };
  kcat?: { median: number | null; values: number[]; unit: string; n_observations: number };
  ki?: { median: number | null; values: number[]; unit: string; n_observations: number };
  specificActivity?: { median: number | null; values: number[]; unit: string; n_observations: number };
  source: string;
  citation: string;
}

interface ThermoPanelProps {
  nodeLabel: string;
  nodeId: string;
  ecNumber?: string;  // Optional EC number for BRENDA lookup
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
      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>{label}</p>
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

export default function ThermodynamicsPanel({ nodeLabel, nodeId, ecNumber: initialEcNumber }: ThermoPanelProps) {
  const [dG0, setDG0] = useState(-20.0);
  const [T, setT] = useState(310.15); // 37°C in Kelvin
  const [products, setProducts] = useState('0.001');
  const [reactants, setReactants] = useState('1.0');
  const [S0, setS0] = useState(1.0);
  const [ecNumber, setEcNumber] = useState(initialEcNumber || '');
  const [brendaData, setBrendaData] = useState<BrendaKinetics | null>(null);
  const [brendaLoading, setBrendaLoading] = useState(false);
  const [brendaError, setBrendaError] = useState<string | null>(null);
  const [enzymeConc, setEnzymeConc] = useState(1e-6); // 1 μM default
  const [result, setResult] = useState<{
    dG: number;
    Keq: number;
    spontaneous: boolean;
    sim: ReturnType<typeof calcMassBalance_DEMO>;
    kinetics?: ReturnType<typeof calculateEnzymeKinetics>;
    eyringRate?: number;
  } | null>(null);
  const [ai, setAi] = useState<{ text: string; loading: boolean }>({ text: '', loading: false });
  const abortRef = useRef<AbortController | null>(null);

  // Cancel in-flight request on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Fetch BRENDA data when EC number changes
  const fetchBrendaData = async (ec: string) => {
    if (!ec || ec.trim() === '') {
      setBrendaData(null);
      return;
    }

    setBrendaLoading(true);
    setBrendaError(null);

    try {
      const response = await fetch('/api/brenda/kinetics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ecNumber: ec.trim() }),
      });

      if (!response.ok) {
        throw new Error(`BRENDA API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setBrendaData(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setBrendaError(message);
      setBrendaData(null);
    } finally {
      setBrendaLoading(false);
    }
  };

  // Auto-fetch when ecNumber prop changes
  useEffect(() => {
    if (initialEcNumber) {
      setEcNumber(initialEcNumber);
      fetchBrendaData(initialEcNumber);
    }
  }, [initialEcNumber]);

  const run = async () => {
    const pArr = products.split(',').map(Number).filter(n => n > 0);
    const rArr = reactants.split(',').map(Number).filter(n => n > 0);
    if (!pArr.length) pArr.push(0.001);
    if (!rArr.length) rArr.push(1.0);

    const dGResult = calcDeltaG(dG0, T, pArr, rArr);
    const dG = dGResult.dG;
    const Keq = calcKeq(dG0, T);
    const sim = calcMassBalance_DEMO(S0, dG, Keq, 100);

    // Calculate real kinetics if BRENDA data is available
    let kinetics: ReturnType<typeof calculateEnzymeKinetics> | undefined;
    let eyringRate: number | undefined;

    if (brendaData) {
      const km = brendaData.km?.median ?? 1;
      const kcat = brendaData.kcat?.median ?? 10;
      const ki = brendaData.ki?.median;

      // Real kinetics calculation
      kinetics = calculateEnzymeKinetics({
        kcat,
        km,
        ki: ki ?? undefined,
        enzymeConc,
        substrate: S0,
        temperature: T,
        pH: 7.0, // Could be made configurable
      });

      // Eyring equation rate
      const deltaG_ddagger = estimateActivationEnergy(kcat, T);
      eyringRate = eyringRateConstant(deltaG_ddagger, T);
    }

    setResult({ dG, Keq, spontaneous: dG < 0, sim, kinetics, eyringRate });

    // AI interpretation
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
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

Address: (1) whether this reaction proceeds spontaneously under these conditions, (2) how far from equilibrium the system is, (3) what this means for flux through this metabolite in the pathway, (4) one practical implication for metabolic engineering or drug targeting.

Respond in short researcher-facing prose with the headings Summary, Key observations, Interpretation, and Recommended next steps.
Do not return JSON, code fences, or developer-style logs.` }] }],
          generationConfig: { maxOutputTokens: 280, temperature: 0.2 },
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Gemini request failed with ${res.status}`);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      setAi({
        text: text.trim() || buildThermodynamicFallbackInterpretation({
          dG,
          dG0,
          keq: Keq,
          nodeLabel,
          productConcentrations: pArr,
          reactantConcentrations: rArr,
          sim,
          spontaneous: dG < 0,
          substrateStart: S0,
          temperatureKelvin: T,
        }),
        loading: false,
      });
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
      setAi({
        text: buildThermodynamicFallbackInterpretation({
          dG,
          dG0,
          keq: Keq,
          nodeLabel,
          productConcentrations: pArr,
          reactantConcentrations: rArr,
          sim,
          spontaneous: dG < 0,
          substrateStart: S0,
          temperatureKelvin: T,
        }),
        loading: false,
      });
    }
  };

  const InputF = ({ label, value, unit, onChange, type = 'number', hint }: {
    label: string; value: string | number; unit: string;
    onChange: (v: string) => void; type?: string; hint?: string;
  }) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>{unit}</span>
      </div>
      <input type={type} value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '6px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#ffffff', fontSize: '12px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", outline: '2px solid rgba(175,195,214,0.5)', outlineOffset: '2px', boxSizing: 'border-box' }} />
      {hint && <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', margin: '3px 0 0', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>{hint}</p>}
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
        <InputF label="EC Number" value={ecNumber} unit="BRENDA"
          onChange={v => { setEcNumber(v); if (v.trim()) fetchBrendaData(v); }}
          type="text"
          hint="e.g. 2.7.1.1 for hexokinase" />
        <InputF label="[Enzyme]" value={enzymeConc * 1e6} unit="μM"
          onChange={v => setEnzymeConc((parseFloat(v) || 1) * 1e-6)}
          hint="Enzyme concentration" />
      </div>

      {/* BRENDA status */}
      {ecNumber && (
        <div style={{ padding: '8px 12px', borderRadius: '12px', background: brendaData ? 'rgba(200,224,208,0.05)' : 'rgba(200,200,200,0.05)', border: `1px solid ${brendaData ? 'rgba(200,224,208,0.1)' : 'rgba(200,200,200,0.1)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Database size={11} style={{ color: brendaData ? 'rgba(200,224,208,0.5)' : 'rgba(200,200,200,0.3)' }} />
            <span style={{ color: brendaData ? 'rgba(200,224,208,0.6)' : 'rgba(200,200,200,0.4)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {brendaLoading ? 'Loading BRENDA...' : brendaError ? 'BRENDA unavailable' : brendaData ? 'BRENDA data loaded' : 'Enter EC number'}
            </span>
          </div>
          {brendaData && (
            <div style={{ marginTop: '6px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {brendaData.km?.median && (
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>
                  Km: {brendaData.km.median.toFixed(3)} mM (n={brendaData.km.n_observations})
                </span>
              )}
              {brendaData.kcat?.median && (
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>
                  kcat: {brendaData.kcat.median.toFixed(2)} 1/s (n={brendaData.kcat.n_observations})
                </span>
              )}
              {brendaData.ki?.median && (
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>
                  Ki: {brendaData.ki.median.toFixed(3)} mM
                </span>
              )}
            </div>
          )}
          {brendaError && (
            <p style={{ color: 'rgba(232,200,212,0.5)', fontSize: '10px', margin: '4px 0 0', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>
              {brendaError} — Using default parameters
            </p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <ActionButton
          variant="primary"
          size="md"
          icon={<Play size={13} />}
          onClick={run}
          style={{ flex: 1 }}
        >
          Calculate ΔG
        </ActionButton>
        {result && (
          <ActionButton
            variant="secondary"
            size="md"
            icon={<RotateCcw size={13} />}
            onClick={() => { setResult(null); setAi({ text: '', loading: false }); }}
          />
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
              <div key={m.l} style={{ padding: '8px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 3px', textTransform: 'uppercase' }}>{m.l}</p>
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
            <MiniChart x={result.sim.time} y={result.sim.S} color="#C8D8E8" label="Substrate [S] over time (demo)" />
            <MiniChart x={result.sim.time} y={result.sim.P} color="#C8E0D0" label="Product [P] over time (demo)" />
          </div>

          {/* Real kinetics results (if BRENDA data available) */}
          {result.kinetics && (
            <div style={{ padding: '14px', borderRadius: '20px', background: 'rgba(200,224,208,0.04)', border: '1px solid rgba(200,224,208,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <Zap size={11} style={{ color: 'rgba(200,224,208,0.5)' }} />
                <span style={{ color: 'rgba(200,224,208,0.6)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Real Kinetics (BRENDA + Eyring)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {[
                  { l: 'Reaction Rate', v: `${result.kinetics.rate.toFixed(4)} mM/s`, col: '#C8E0D0' },
                  { l: 'Vmax', v: `${result.kinetics.vmax.toFixed(4)} mM/s`, col: 'rgba(255,255,255,0.6)' },
                  { l: 'Effective kcat', v: `${result.kinetics.kcat_eff.toFixed(2)} 1/s`, col: 'rgba(255,255,255,0.6)' },
                  { l: 'Effective Km', v: `${result.kinetics.km_eff.toFixed(4)} mM`, col: 'rgba(255,255,255,0.6)' },
                  ...(result.kinetics.inhibition > 0 ? [{ l: 'Inhibition', v: `${(result.kinetics.inhibition * 100).toFixed(1)}%`, col: '#E8C8D4' }] : []),
                  ...(result.eyringRate ? [{ l: 'Eyring k', v: `${result.eyringRate.toExponential(2)} 1/s`, col: 'rgba(255,255,255,0.5)' }] : []),
                ].map(m => (
                  <div key={m.l} style={{ padding: '6px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: '0 0 2px', textTransform: 'uppercase' }}>{m.l}</p>
                    <p style={{ color: m.col, fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0, fontWeight: 600 }}>{m.v}</p>
                  </div>
                ))}
              </div>

              <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '11px', margin: '8px 0 0', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>
                Source: {result.kinetics.source} · BRENDA: Chang et al. (2021) Nucleic Acids Res. 49:D498-D508
              </p>
            </div>
          )}
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
            : <ResearchAnswerRenderer answer={ai.text} />
          }
        </div>
      )}

      <p style={{ color: 'rgba(255,255,255,0.1)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", textAlign: 'center', margin: 0 }}>
        ΔG = ΔG° + RT ln(Q) · Based on user-provided concentrations
      </p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
