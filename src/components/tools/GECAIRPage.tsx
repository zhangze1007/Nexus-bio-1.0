'use client';
import { useState, useMemo } from 'react';
import IDEShell from '../ide/IDEShell';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import { CIRCUIT_NODES, LOGIC_GATES, hillInhibition, hillActivation } from '../../data/mockGECAIR';
import type { GateType } from '../../data/mockGECAIR';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";

const PART_COLORS: Record<string, string> = {
  promoter: 'rgba(120,200,255,0.8)',
  rbs: 'rgba(255,200,80,0.8)',
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
        <rect x={x} y={y} width={Math.max(2, value * 40)} height={8} fill="rgba(120,220,180,0.6)" rx="2" />
        <text x={x + 44} y={y + 7} fontFamily={MONO} fontSize="8" fill="rgba(255,255,255,0.5)">
          {label} {(value * 100).toFixed(0)}%
        </text>
      </g>
    );
  }

  return (
    <svg viewBox="0 0 480 420" style={{ width: '100%', height: '100%' }}>
      <rect width="480" height="420" fill="#0d0f14" />

      {/* Title */}
      <text x="240" y="20" textAnchor="middle" fontFamily={MONO} fontSize="10" fill="rgba(255,255,255,0.3)">
        Synthetic Gene Circuit — {gateType} Gate Mode
      </text>

      {/* Input signals */}
      <text x="20" y="70" fontFamily={MONO} fontSize="9" fill="rgba(255,255,255,0.4)">INPUT A</text>
      {sigBar(20, 76, inputA, '')}
      <text x="20" y="115" fontFamily={MONO} fontSize="9" fill="rgba(255,255,255,0.4)">INPUT B</text>
      {sigBar(20, 121, inputB, '')}

      {/* Gene nodes as horizontal part stacks */}
      {CIRCUIT_NODES.slice(0, 3).map((node, ni) => {
        const y = 160 + ni * 70;
        const levels = [outA, outB, outC];
        const lvl = levels[ni] ?? 0;
        return (
          <g key={node.id}>
            <text x="20" y={y - 4} fontFamily={MONO} fontSize="9" fill="rgba(255,255,255,0.35)">
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
                fontFamily={MONO} fontSize="8" fill="rgba(255,255,255,0.55)">
                {part.label}
              </text>
            ))}
            {/* Output level bar */}
            {sigBar(240, y + 6, lvl, `→ ${(lvl * 100).toFixed(0)}%`)}
          </g>
        );
      })}

      {/* AND/OR gate output */}
      <text x="20" y="382" fontFamily={MONO} fontSize="9" fill="rgba(255,255,255,0.4)">OUTPUT (GFP)</text>
      {sigBar(20, 388, finalOutput, '')}
      <text x={20 + Math.max(2, finalOutput * 40) + 48} y="396" fontFamily={MONO} fontSize="11"
        fill={finalOutput > 0.5 ? 'rgba(120,255,180,0.9)' : 'rgba(255,255,255,0.3)'}>
        {(finalOutput * 100).toFixed(1)}% expression
      </text>

      {/* Connection lines */}
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
        <span style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(255,255,255,0.75)' }}>{(value * 100).toFixed(0)}%</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'rgba(255,255,255,0.6)', cursor: 'pointer' }} />
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
    <IDEShell moduleId="gecair">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#0a0c10' }}>
        <AlgorithmInsight
          title="Gene Circuit AI Reasoner"
          description="Hill-function kinetics model promoter activity. Inhibition gates use Hill repression; activation uses Hill induction."
          formula="f(x) = Kⁿ/(Kⁿ+xⁿ)"
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* Input panel */}
          <div style={{ width: '240px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderRight: '1px solid rgba(255,255,255,0.06)', background: '#0a0c10' }}>
            <p style={{ fontFamily: MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', margin: '0 0 12px' }}>
              Input Signals
            </p>

            <ParamSlider label="Input A strength" value={inputA} min={0} max={1} onChange={setInputA} />
            <ParamSlider label="Input B strength" value={inputB} min={0} max={1} onChange={setInputB} />

            <p style={{ fontFamily: MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', margin: '16px 0 8px' }}>
              Output Gate Type
            </p>
            {(['NOT', 'AND', 'OR', 'NAND'] as GateType[]).map(gate => (
              <button key={gate} onClick={() => setGateType(gate)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 10px', marginBottom: '4px',
                background: gateType === gate ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: `1px solid ${gateType === gate ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '3px',
                color: gateType === gate ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)',
                fontFamily: MONO, fontSize: '10px', cursor: 'pointer',
                letterSpacing: '0.06em',
              }}>
                {gate} Gate
              </button>
            ))}

            <p style={{ fontFamily: MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', margin: '16px 0 8px' }}>
              Truth Table
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['A', 'B', 'OUT'].map(h => (
                    <th key={h} style={{ fontFamily: MONO, fontSize: '9px', color: 'rgba(255,255,255,0.3)', padding: '3px 6px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{h}</th>
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
                        <td key={j} style={{ fontFamily: MONO, fontSize: '10px', textAlign: 'center', padding: '4px', color: v ? 'rgba(120,220,180,0.8)' : 'rgba(255,255,255,0.25)' }}>
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
          <div style={{ flex: 1, overflow: 'hidden', background: '#0d0f14', padding: '8px' }}>
            <CircuitSVG inputA={inputA} inputB={inputB} gateType={gateType} />
          </div>

          {/* Results panel */}
          <div style={{ width: '240px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderLeft: '1px solid rgba(255,255,255,0.06)', background: '#0a0c10' }}>
            <p style={{ fontFamily: MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', margin: '0 0 12px' }}>
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

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0 }}>
          <ExportButton label="Export JSON" data={exportData} filename="gecair-circuit" format="json" />
        </div>
      </div>
    </IDEShell>
  );
}
