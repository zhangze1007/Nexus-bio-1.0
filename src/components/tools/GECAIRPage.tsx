'use client';
import { useState, useMemo } from 'react';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import { CIRCUIT_NODES, LOGIC_GATES, hillInhibition, hillActivation } from '../../data/mockGECAIR';
import type { GateType } from '../../data/mockGECAIR';
import { T, TOOL_RESULT_PALETTE} from '../ide/tokens';

// Dark theme tokens
const PANEL_BG = '#000000';
const BORDER = 'rgba(255,255,255,0.06)';
const LABEL = 'rgba(255,255,255,0.45)';
const VALUE = 'rgba(255,255,255,0.65)';
const INPUT_BORDER = 'rgba(255,255,255,0.08)';

const PART_COLORS: Record<string, string> = {
  promoter: 'rgba(81,81,205,0.8)',
  rbs: 'rgba(255,139,31,0.8)',
  cds: 'rgba(120,255,180,0.8)',
  terminator: 'rgba(200,100,255,0.7)',
};

function CircuitSVG({ inputA, inputB, gateType }: { inputA: number; inputB: number; gateType: GateType }) {
  const outA = hillInhibition(inputA);
  const outB = hillInhibition(outA);
  const outC = hillInhibition(outB);
  const andOut = gateType === 'AND' ? hillActivation(Math.min(outA, outB)) :
    gateType === 'OR' ? hillActivation(Math.max(outA, outB)) :
    gateType === 'NAND' ? hillInhibition(Math.min(outA, outB)) :
    hillInhibition(inputA);
  const finalOutput = andOut;

  function sigBar(x: number, y: number, value: number, label: string) {
    return (
      <g>
        <rect x={x} y={y} width={40} height={8} fill="rgba(255,255,255,0.06)" rx="2" />
        <rect x={x} y={y} width={Math.max(2, value * 40)} height={8} fill="rgba(147,203,82,0.6)" rx="2" />
        <text x={x + 44} y={y + 7} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.5)">
          {label} {(value * 100).toFixed(0)}%
        </text>
      </g>
    );
  }

  return (
    <svg role="img" aria-label="Chart" viewBox="0 0 480 420" style={{ width: '100%', height: '100%' }}>
      <rect width="480" height="420" fill="#050505" />
      <text x="240" y="20" textAnchor="middle" fontFamily={T.MONO} fontSize="10" fill="rgba(255,255,255,0.3)">
        Synthetic Gene Circuit — {gateType} Gate Mode
      </text>
      <text x="20" y="70" fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.4)">INPUT A</text>
      {sigBar(20, 76, inputA, '')}
      <text x="20" y="115" fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.4)">INPUT B</text>
      {sigBar(20, 121, inputB, '')}
      {CIRCUIT_NODES.slice(0, 3).map((node, ni) => {
        const y = 160 + ni * 70;
        const levels = [outA, outB, outC];
        const lvl = levels[ni] ?? 0;
        return (
          <g key={node.id}>
            <text x="20" y={y - 4} fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.35)">
              {['Node A (LacI)', 'Node B (TetR)', 'Node C (cI)'][ni]}
            </text>
            {node.parts.map((part, pi) => (
              <rect key={part.id} x={20 + pi * 52} y={y} width={48} height={22}
                fill={PART_COLORS[part.type] ?? 'rgba(255,255,255,0.2)'}
                fillOpacity={0.2} stroke={PART_COLORS[part.type] ?? 'rgba(255,255,255,0.2)'}
                strokeWidth={1} rx="2"
              />
            ))}
            {node.parts.map((part, pi) => (
              <text key={`t-${part.id}`} x={44 + pi * 52} y={y + 14} textAnchor="middle"
                fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.55)">
                {part.label}
              </text>
            ))}
            {sigBar(240, y + 6, lvl, `→ ${(lvl * 100).toFixed(0)}%`)}
          </g>
        );
      })}
      <text x="20" y="382" fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.4)">OUTPUT (GFP)</text>
      {sigBar(20, 388, finalOutput, '')}
      <text x={20 + Math.max(2, finalOutput * 40) + 48} y="396" fontFamily={T.MONO} fontSize="11"
        fill={finalOutput > 0.5 ? 'rgba(120,255,180,0.9)' : 'rgba(255,255,255,0.3)'}>
        {(finalOutput * 100).toFixed(1)}% expression
      </text>
      <line x1="60" y1="84" x2="60" y2="155" stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
      <line x1="240" y1="182" x2="240" y2="225" stroke="rgba(255,255,255,0.08)" />
      <line x1="240" y1="252" x2="240" y2="295" stroke="rgba(255,255,255,0.08)" />
    </svg>
  );
}

function ParamSlider({ label, value, min, max, step = 0.05, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL }}>{label}</span>
        <span style={{ fontFamily: T.MONO, fontSize: '11px', color: VALUE }}>{(value * 100).toFixed(0)}%</span>
      </div>
      <input aria-label="Parameter slider" type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'rgba(120,180,255,0.8)', cursor: 'pointer' }} />
    </div>
  );
}

const TRUTH_TABLE = [
  { A: 0, B: 0 }, { A: 0, B: 1 }, { A: 1, B: 0 }, { A: 1, B: 1 },
];

export default function GECAIRPage() {
  const [inputA, setInputA] = useState(0.8);
  const [inputB, setInputB] = useState(0.3);
  const [gateType, setGateType] = useState<GateType>('NOT');

  const outA = hillInhibition(inputA);
  const outB = hillInhibition(outA);
  const finalOutput = gateType === 'AND' ? hillActivation(Math.min(outA, outB))
    : gateType === 'OR' ? hillActivation(Math.max(outA, outB))
    : gateType === 'NAND' ? hillInhibition(Math.min(outA, outB))
    : hillInhibition(inputA);

  const noiseScore = Math.abs(hillInhibition(inputA + 0.05) - finalOutput);

  const exportData = useMemo(() => ({
    gateType,
    inputA: inputA.toFixed(3),
    inputB: inputB.toFixed(3),
    output: finalOutput.toFixed(3),
    noiseScore: noiseScore.toFixed(4),
  }), [gateType, inputA, inputB, finalOutput, noiseScore]);

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#050505' }}>
        <AlgorithmInsight
          title="Gene Circuit AI Reasoner"
          description="Hill-function kinetics model promoter activity. Inhibition gates use Hill repression; activation uses Hill induction."
          formula="f(x) = Kⁿ/(Kⁿ+xⁿ)"
        />

        <div className="nb-tool-panels" style={{ flex: 1 }}>
          {/* Input panel */}
          <div className="nb-tool-sidebar" style={{ width: '240px', borderRight: `1px solid ${BORDER}`, background: PANEL_BG }}>
            <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: LABEL, margin: '0 0 12px' }}>
              Input Signals
            </p>

            <ParamSlider label="Input A strength" value={inputA} min={0} max={1} onChange={setInputA} />
            <ParamSlider label="Input B strength" value={inputB} min={0} max={1} onChange={setInputB} />

            <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: LABEL, margin: '16px 0 8px' }}>
              Output Gate Type
            </p>
            {(['NOT', 'AND', 'OR', 'NAND'] as GateType[]).map(gate => (
              <button aria-label="Action" key={gate} onClick={() => setGateType(gate)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 10px', marginBottom: '4px',
                background: gateType === gate ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: `1px solid ${gateType === gate ? 'rgba(255,255,255,0.18)' : INPUT_BORDER}`,
                borderRadius: '8px',
                color: gateType === gate ? VALUE : LABEL,
                fontFamily: T.SANS, fontSize: '11px', cursor: 'pointer',
              }}>
                {gate} Gate
              </button>
            ))}

            <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: LABEL, margin: '16px 0 8px' }}>
              Truth Table
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['A', 'B', 'OUT'].map(h => (
                    <th key={h} style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL, padding: '3px 6px', textAlign: 'center', borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TRUTH_TABLE.map((row, i) => {
                  const a = row.A > 0.5 ? 1 : 0;
                  const b = row.B > 0.5 ? 1 : 0;
                  const out = gateType === 'AND' ? a && b
                    : gateType === 'OR' ? a || b
                    : gateType === 'NAND' ? !(a && b) ? 1 : 0
                    : 1 - a;
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      {[row.A, row.B, out].map((v, j) => (
                        <td key={j} style={{ fontFamily: T.MONO, fontSize: '10px', textAlign: 'center', padding: '4px', color: v ? 'rgba(120,220,160,0.85)' : 'rgba(255,255,255,0.25)' }}>
                          {v ? '1' : '0'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Engine view */}
          <div style={{ flex: 1, overflow: 'hidden', background: '#050505', padding: '8px' }}>
            <CircuitSVG inputA={inputA} inputB={inputB} gateType={gateType} />
          </div>

          {/* Results panel */}
          <div className="nb-tool-right" style={{ width: '240px', borderLeft: `1px solid ${BORDER}`, background: PANEL_BG }}>
            <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: LABEL, margin: '0 0 12px' }}>
              Circuit Readouts
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <MetricCard label="Output Level (GFP)" value={(finalOutput * 100).toFixed(1)} unit="%" highlight />
              <MetricCard label="Node A Output" value={(outA * 100).toFixed(1)} unit="%" />
              <MetricCard label="Node B Output" value={(outB * 100).toFixed(1)} unit="%" />
              <MetricCard label="Noise Sensitivity" value={noiseScore.toFixed(4)} warning={noiseScore > 0.05 ? 'High noise sensitivity — consider insulator parts' : undefined} />
              <MetricCard label="Circuit Complexity" value={CIRCUIT_NODES.reduce((a, n) => a + n.parts.length, 0)} unit="parts" />
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0, background: PANEL_BG }}>
          <ExportButton label="Export JSON" data={exportData} filename="gecair-circuit" format="json" />
        </div>
      </div>
    </>
  );
}
