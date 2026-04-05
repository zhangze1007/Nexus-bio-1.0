'use client';
import { useState, useMemo, useEffect } from 'react';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import { CIRCUIT_NODES, LOGIC_GATES, hillInhibition, hillActivation } from '../../data/mockGECAIR';
import type { GateType } from '../../data/mockGECAIR';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { T, TOOL_RESULT_PALETTE} from '../ide/tokens';
import WorkbenchInlineContext from '../workbench/WorkbenchInlineContext';
import ScientificHero from './shared/ScientificHero';
import { PATHD_THEME } from '../workbench/workbenchTheme';

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

function resolveGateOutput(a: number, b: number, gateType: GateType) {
  if (gateType === 'AND') return hillActivation(Math.min(a, b));
  if (gateType === 'OR') return hillActivation(Math.max(a, b));
  if (gateType === 'NAND') return hillInhibition(Math.min(a, b));
  return hillInhibition(a);
}

function CircuitSVG({ inputA, inputB, gateType }: { inputA: number; inputB: number; gateType: GateType }) {
  const outA = hillInhibition(inputA);
  const outB = hillInhibition(inputB);
  const outC = resolveGateOutput(outA, outB, gateType);
  const finalOutput = outC;
  const W = 720;
  const H = 430;
  const heatLeft = 42;
  const heatTop = 54;
  const heatSize = 246;
  const grid = 12;

  const heat = Array.from({ length: grid }, (_, yi) =>
    Array.from({ length: grid }, (_, xi) => {
      const a = xi / (grid - 1);
      const b = 1 - yi / (grid - 1);
      return resolveGateOutput(hillInhibition(a), hillInhibition(b), gateType);
    }),
  );

  function signalColor(value: number) {
    const warm = 255 * value;
    const cool = 140 + 80 * (1 - value);
    return `rgba(${Math.round(90 + warm * 0.6)}, ${Math.round(120 + warm * 0.35)}, ${Math.round(cool)}, ${0.25 + value * 0.6})`;
  }

  function responseCurve(inputId: 'A' | 'B') {
    const pts: string[] = [];
    for (let i = 0; i <= 48; i += 1) {
      const xValue = i / 48;
      const yValue = hillInhibition(xValue);
      const x = 348 + xValue * 148;
      const y = 118 - yValue * 72;
      pts.push(`${x},${y}`);
    }
    const markerInput = inputId === 'A' ? inputA : inputB;
    const markerOutput = hillInhibition(markerInput);
    return {
      points: pts.join(' '),
      markerX: 348 + markerInput * 148,
      markerY: 118 - markerOutput * 72,
      markerOutput,
    };
  }

  const curveA = responseCurve('A');
  const curveB = responseCurve('B');
  const nodeRows = [
    { label: 'Sensor A', value: outA, tone: 'rgba(81,81,205,0.9)', detail: 'Hill repression from input A' },
    { label: 'Sensor B', value: outB, tone: 'rgba(255,139,31,0.9)', detail: 'Hill repression from input B' },
    { label: `${gateType} Output`, value: outC, tone: 'rgba(120,255,180,0.9)', detail: 'Combined gate expression state' },
  ];

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx="18" />
      <text x="24" y="26" fontFamily={T.MONO} fontSize="10" fill="rgba(255,255,255,0.26)">
        LOGIC OPERATING SURFACE
      </text>
      <text x="24" y="42" fontFamily={T.SANS} fontSize="12" fill="rgba(255,255,255,0.72)">
        {gateType} gate response across the current two-input regime
      </text>

      <rect x={heatLeft} y={heatTop} width={heatSize} height={heatSize} rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" />
      {heat.map((row, yi) =>
        row.map((value, xi) => {
          const cell = heatSize / grid;
          return (
            <rect
              key={`${xi}-${yi}`}
              x={heatLeft + xi * cell + 1}
              y={heatTop + yi * cell + 1}
              width={cell - 2}
              height={cell - 2}
              rx="3"
              fill={signalColor(value)}
            />
          );
        }),
      )}
      <circle
        cx={heatLeft + inputA * heatSize}
        cy={heatTop + (1 - inputB) * heatSize}
        r="7"
        fill="none"
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="2"
      />
      <circle
        cx={heatLeft + inputA * heatSize}
        cy={heatTop + (1 - inputB) * heatSize}
        r="2.5"
        fill="rgba(255,255,255,0.95)"
      />
      <text x={heatLeft + heatSize / 2} y={heatTop + heatSize + 26} textAnchor="middle" fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.28)">
        Input A fraction
      </text>
      <text x={16} y={heatTop + heatSize / 2} textAnchor="middle" fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.28)" transform={`rotate(-90, 16, ${heatTop + heatSize / 2})`}>
        Input B fraction
      </text>
      {[0, 0.5, 1].map((tick, i) => (
        <g key={i}>
          <text x={heatLeft + tick * heatSize} y={heatTop + heatSize + 12} textAnchor={tick === 0 ? 'start' : tick === 1 ? 'end' : 'middle'} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.2)">
            {(tick * 100).toFixed(0)}%
          </text>
          <text x={heatLeft - 8} y={heatTop + (1 - tick) * heatSize + 3} textAnchor="end" fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.2)">
            {(tick * 100).toFixed(0)}%
          </text>
        </g>
      ))}

      <rect x="324" y="54" width="180" height="92" rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" />
      <text x="338" y="74" fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.24)">
        TRANSFER CURVES
      </text>
      <polyline points={curveA.points} fill="none" stroke="rgba(81,81,205,0.95)" strokeWidth="2" />
      <polyline points={curveB.points} fill="none" stroke="rgba(255,139,31,0.95)" strokeWidth="2" />
      <circle cx={curveA.markerX} cy={curveA.markerY} r="4" fill="rgba(81,81,205,1)" />
      <circle cx={curveB.markerX} cy={curveB.markerY} r="4" fill="rgba(255,139,31,1)" />
      <text x="348" y="133" fontFamily={T.MONO} fontSize="8" fill="rgba(81,81,205,0.95)">
        A sensor {(curveA.markerOutput * 100).toFixed(0)}%
      </text>
      <text x="430" y="133" fontFamily={T.MONO} fontSize="8" fill="rgba(255,139,31,0.95)">
        B sensor {(curveB.markerOutput * 100).toFixed(0)}%
      </text>

      <rect x="324" y="164" width="180" height="136" rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" />
      <text x="338" y="184" fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.24)">
        NODE STATE LEDGER
      </text>
      {nodeRows.map((row, index) => {
        const y = 208 + index * 34;
        return (
          <g key={row.label}>
            <text x="338" y={y} fontFamily={T.SANS} fontSize="11" fill="rgba(255,255,255,0.68)">
              {row.label}
            </text>
            <rect x="338" y={y + 8} width="132" height="8" rx="999" fill="rgba(255,255,255,0.08)" />
            <rect x="338" y={y + 8} width={Math.max(6, row.value * 132)} height="8" rx="999" fill={row.tone} />
            <text x="476" y={y + 15} textAnchor="end" fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.55)">
              {(row.value * 100).toFixed(1)}%
            </text>
            <text x="338" y={y + 27} fontFamily={T.SANS} fontSize="9" fill="rgba(255,255,255,0.32)">
              {row.detail}
            </text>
          </g>
        );
      })}

      <rect x="42" y="330" width="462" height="76" rx="18" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" />
      <text x="58" y="350" fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.24)">
        GENETIC ARCHITECTURE
      </text>
      {CIRCUIT_NODES.slice(0, 3).map((node, ni) => {
        const y = 365 + ni * 16;
        return (
          <g key={node.id}>
            <text x="58" y={y} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.38)">
              {['Sensor A', 'Sensor B', 'Output cassette'][ni]}
            </text>
            {node.parts.map((part, pi) => (
              <g key={part.id}>
                <rect
                  x={132 + pi * 70}
                  y={y - 10}
                  width="62"
                  height="12"
                  rx="6"
                  fill="rgba(0,0,0,0.28)"
                  stroke={PART_COLORS[part.type] ?? 'rgba(255,255,255,0.2)'}
                  strokeWidth="1.1"
                />
                <text x={163 + pi * 70} y={y - 1} textAnchor="middle" fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.7)">
                  {part.label}
                </text>
              </g>
            ))}
          </g>
        );
      })}
      <path d="M 286 361 C 312 361, 318 361, 338 361" stroke="rgba(81,81,205,0.55)" strokeWidth="1.5" fill="none" />
      <path d="M 286 377 C 312 377, 318 377, 338 377" stroke="rgba(255,139,31,0.55)" strokeWidth="1.5" fill="none" />
      <path d="M 338 361 C 364 361, 380 377, 404 377" stroke="rgba(120,255,180,0.45)" strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
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
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const catalystPayload = useWorkbenchStore((s) => s.toolPayloads.catdes);
  const dynconPayload = useWorkbenchStore((s) => s.toolPayloads.dyncon);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);
  const [inputA, setInputA] = useState(0.8);
  const [inputB, setInputB] = useState(0.3);
  const [gateType, setGateType] = useState<GateType>('NOT');
  const recommendedGate = useMemo<GateType>(() => {
    if ((catalystPayload?.result.totalMetabolicDrain ?? 0) > 0.45) return 'NAND';
    if (dynconPayload?.result.stable && catalystPayload?.result.isViable) return 'AND';
    if ((dynconPayload?.result.doRmse ?? 0) > 0.08) return 'OR';
    return 'NOT';
  }, [catalystPayload?.result.isViable, catalystPayload?.result.totalMetabolicDrain, dynconPayload?.result.doRmse, dynconPayload?.result.stable]);
  const recommendedInputA = useMemo(
    () => Math.min(1, Math.max(0, dynconPayload?.controller.setpoint ?? 0.6)),
    [dynconPayload?.controller.setpoint],
  );
  const recommendedInputB = useMemo(
    () => Math.min(1, Math.max(0, (catalystPayload?.result.totalMetabolicDrain ?? 0.3) + 0.15)),
    [catalystPayload?.result.totalMetabolicDrain],
  );

  useEffect(() => {
    setInputA(recommendedInputA);
    setInputB(recommendedInputB);
    setGateType(recommendedGate);
  }, [recommendedGate, recommendedInputA, recommendedInputB]);

  const outA = hillInhibition(inputA);
  const outB = hillInhibition(inputB);
  const finalOutput = resolveGateOutput(outA, outB, gateType);

  const noiseScore = Math.max(
    Math.abs(resolveGateOutput(hillInhibition(Math.min(1, inputA + 0.05)), outB, gateType) - finalOutput),
    Math.abs(resolveGateOutput(outA, hillInhibition(Math.min(1, inputB + 0.05)), gateType) - finalOutput),
  );

  const exportData = useMemo(() => ({
    gateType,
    inputA: inputA.toFixed(3),
    inputB: inputB.toFixed(3),
    output: finalOutput.toFixed(3),
    noiseScore: noiseScore.toFixed(4),
  }), [gateType, inputA, inputB, finalOutput, noiseScore]);

  useEffect(() => {
    setToolPayload('gecair', {
      toolId: 'gecair',
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
      sourceArtifactId: analyzeArtifact?.id,
      gateType,
      inputA,
      inputB,
      result: {
        outputLevel: finalOutput,
        nodeAOutput: outA,
        nodeBOutput: outB,
        noiseScore,
        circuitComplexity: CIRCUIT_NODES.reduce((sum, node) => sum + node.parts.length, 0),
      },
      updatedAt: Date.now(),
    });
  }, [
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    finalOutput,
    gateType,
    inputA,
    inputB,
    noiseScore,
    outA,
    outB,
    project?.targetProduct,
    project?.title,
    setToolPayload,
  ]);

  return (
    <>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', background: '#050505', minHeight: '100%', flex: 1 }}>
        <AlgorithmInsight
          title="Gene Circuit AI Reasoner"
          description="Hill-function kinetics model promoter activity. Inhibition gates use Hill repression; activation uses Hill induction."
          formula="f(x) = Kⁿ/(Kⁿ+xⁿ)"
        />

        <div style={{ padding: '0 16px 10px' }}>
          <ScientificHero
            eyebrow="Stage 3 · Gene Circuit Programming"
            title={`${gateType} logic for the current chassis objective`}
            summary="GECAIR now reads as a control-design page rather than a circuit toy. The important question is whether the selected logic stabilizes the current pathway and burden context, not just whether the gate truth table looks correct."
            aside={
              <>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Recommended logic
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '13px', color: PATHD_THEME.value, fontWeight: 700 }}>
                  {recommendedGate} gate from current burden and control context
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.55 }}>
                  Catalyst burden and controller stability are already being used here to bias the circuit topology instead of leaving logic selection arbitrary.
                </div>
              </>
            }
            signals={[
              {
                label: 'Output Expression',
                value: `${(finalOutput * 100).toFixed(1)}%`,
                detail: `Node A ${(outA * 100).toFixed(0)}% · Node B ${(outB * 100).toFixed(0)}% through the present gate sequence`,
                tone: finalOutput > 0.5 ? 'cool' : 'warm',
              },
              {
                label: 'Noise Sensitivity',
                value: noiseScore.toFixed(4),
                detail: noiseScore > 0.05 ? 'Circuit is sensitive to small input perturbations and may need insulation.' : 'Noise remains in a manageable range for this design.',
                tone: noiseScore > 0.05 ? 'alert' : 'cool',
              },
              {
                label: 'Input Envelope',
                value: `A ${(inputA * 100).toFixed(0)} · B ${(inputB * 100).toFixed(0)}`,
                detail: 'These inputs are seeded from the current control and catalyst state, not manually invented defaults.',
                tone: 'neutral',
              },
              {
                label: 'Circuit Complexity',
                value: `${CIRCUIT_NODES.reduce((sum, node) => sum + node.parts.length, 0)} parts`,
                detail: 'Part count remains visible so logic ambition stays grounded in buildability.',
                tone: 'neutral',
              },
            ]}
          />
        </div>

        <div className="nb-tool-panels" style={{ flex: 1 }}>
          {/* Input panel */}
          <div className="nb-tool-sidebar" style={{ width: '240px', borderRight: `1px solid ${BORDER}`, background: PANEL_BG }}>
            <WorkbenchInlineContext
              toolId="gecair"
              title="Gene Circuit AI Reasoner"
              summary="Turn bottleneck and control objectives into interpretable circuit logic so Stage 3 design decisions stay connected to upstream evidence and downstream control work."
              compact
              isSimulated={!analyzeArtifact}
            />

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
          <div className="nb-tool-center" style={{ flex: 1, background: '#050505', padding: '8px', minWidth: 0 }}>
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
