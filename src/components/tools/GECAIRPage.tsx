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

function viridisColor(t: number): string {
  const stops: [number, number, number][] = [
    [68, 1, 84], [49, 104, 142], [53, 183, 121], [144, 215, 67], [253, 231, 37],
  ];
  const scaled = Math.max(0, Math.min(1, t)) * 4;
  const lo = Math.floor(scaled), hi = Math.min(4, lo + 1), f = scaled - lo;
  const [r1, g1, b1] = stops[lo], [r2, g2, b2] = stops[hi];
  return `rgb(${Math.round(r1 + (r2 - r1) * f)},${Math.round(g1 + (g2 - g1) * f)},${Math.round(b1 + (b2 - b1) * f)})`;
}

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
  const W = 720;
  const H = 500;

  // ── SBOL circuit layout ──
  const bbY = 108;   // backbone Y center
  const bbX1 = 52, bbX2 = 308;
  const exprLevel = outC; // expression level 0-1

  // Phase space heatmap (30×30 viridis)
  const PS_LEFT = 42, PS_TOP = 158, PS_SIZE = 260, GRID = 30;
  const cellSize = PS_SIZE / GRID;
  const phaseHeat = Array.from({ length: GRID }, (_, yi) =>
    Array.from({ length: GRID }, (_, xi) => {
      const a = xi / (GRID - 1);
      const b = 1 - yi / (GRID - 1);
      return resolveGateOutput(hillInhibition(a), hillInhibition(b), gateType);
    })
  );

  // Right panel: transfer curves
  function responseCurve(inputId: 'A' | 'B') {
    const pts: string[] = [];
    for (let i = 0; i <= 48; i++) {
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
    { label: 'Sensor A', value: outA, tone: '#E41A1C', detail: 'Hill repression from input A' },
    { label: 'Sensor B', value: outB, tone: '#FF7F00', detail: 'Hill repression from input B' },
    { label: `${gateType} Output`, value: outC, tone: '#4DAF4A', detail: 'Combined gate expression state' },
  ];

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx="18" />
      <text x="24" y="22" fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.26)">GENE CIRCUIT · SBOL NOTATION</text>
      <text x="24" y="36" fontFamily={T.SANS} fontSize="11" fill="rgba(255,255,255,0.72)">
        {gateType} gate — biological parts and 2D phase space response
      </text>

      {/* ── SBOL circuit diagram ── */}
      <rect x={bbX1 - 8} y={bbY - 44} width={bbX2 - bbX1 + 16} height={96} rx="12"
        fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.07)" />
      <text x={bbX1 - 4} y={bbY - 36} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.25)">
        GENETIC ARCHITECTURE
      </text>
      {/* Backbone line */}
      <line x1={bbX1} y1={bbY} x2={bbX2} y2={bbY} stroke="rgba(255,255,255,0.3)" strokeWidth="2" />

      {/* Promoter — purple filled pentagon/arrow at x=65 */}
      <polygon
        points={`65,${bbY} 80,${bbY} 80,${bbY - 22} 90,${bbY - 12} 80,${bbY - 2} 80,${bbY - 22}`}
        fill="rgba(152,78,163,0.85)" stroke="#984EA3" strokeWidth="1"
      />
      <text x={77} y={bbY + 14} textAnchor="middle" fontFamily={T.MONO} fontSize="7" fill="#984EA3">P</text>

      {/* RBS — blue half-circle arc above backbone at x=116 */}
      <path d={`M 106,${bbY} A 10 10 0 0 1 126,${bbY}`}
        fill="rgba(55,126,184,0.8)" stroke="#377EB8" strokeWidth="1" />
      <text x={116} y={bbY + 14} textAnchor="middle" fontFamily={T.MONO} fontSize="7" fill="#377EB8">RBS</text>

      {/* CDS — orange arrow rectangle at x=148 */}
      <polygon
        points={`138,${bbY - 16} 190,${bbY - 16} 206,${bbY} 190,${bbY + 16} 138,${bbY + 16}`}
        fill={`rgba(255,127,0,${0.3 + exprLevel * 0.55})`}
        stroke="#FF7F00" strokeWidth="1.2"
      />
      <text x={172} y={bbY + 4} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill="#FF7F00">{gateType}</text>

      {/* Terminator — red T-shape at x=252 */}
      <line x1={252} y1={bbY - 20} x2={252} y2={bbY + 2} stroke="#E41A1C" strokeWidth="2.5" />
      <line x1={240} y1={bbY - 20} x2={264} y2={bbY - 20} stroke="#E41A1C" strokeWidth="2.5" />
      <text x={252} y={bbY + 14} textAnchor="middle" fontFamily={T.MONO} fontSize="7" fill="#E41A1C">T</text>

      {/* Output arrow at right end */}
      <line x1={bbX2} y1={bbY} x2={bbX2 + 18} y2={bbY} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" markerEnd="url(#gecair-arrow)" />
      <defs>
        <marker id="gecair-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <polygon points="0 0.5, 5.5 3, 0 5.5" fill="rgba(255,255,255,0.3)" />
        </marker>
      </defs>
      <text x={bbX2 + 22} y={bbY + 4} fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.28)">{(outC * 100).toFixed(0)}%</text>

      {/* ── 2D Phase Space heatmap (viridis, 30×30) ── */}
      <text x={PS_LEFT} y={PS_TOP - 10} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.26)">
        PHASE SPACE · Output = {viridisColor(0).includes('68') ? 'low' : ''} → high (viridis)
      </text>
      <rect x={PS_LEFT - 2} y={PS_TOP - 2} width={PS_SIZE + 4} height={PS_SIZE + 4} rx="10"
        fill="none" stroke="rgba(255,255,255,0.07)" />
      {phaseHeat.map((row, yi) =>
        row.map((val, xi) => (
          <rect
            key={`ps-${xi}-${yi}`}
            x={PS_LEFT + xi * cellSize}
            y={PS_TOP + yi * cellSize}
            width={cellSize}
            height={cellSize}
            fill={viridisColor(val)}
            opacity={0.9}
          />
        ))
      )}
      {/* Crosshair at current (inputA, inputB) */}
      <line
        x1={PS_LEFT + inputA * PS_SIZE} y1={PS_TOP}
        x2={PS_LEFT + inputA * PS_SIZE} y2={PS_TOP + PS_SIZE}
        stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeDasharray="3 2"
      />
      <line
        x1={PS_LEFT} y1={PS_TOP + (1 - inputB) * PS_SIZE}
        x2={PS_LEFT + PS_SIZE} y2={PS_TOP + (1 - inputB) * PS_SIZE}
        stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeDasharray="3 2"
      />
      <circle
        cx={PS_LEFT + inputA * PS_SIZE}
        cy={PS_TOP + (1 - inputB) * PS_SIZE}
        r={6} fill="none" stroke="white" strokeWidth="1.8"
      />
      {/* Axes */}
      <text x={PS_LEFT + PS_SIZE / 2} y={PS_TOP + PS_SIZE + 16} textAnchor="middle"
        fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.28)">Input A (0→1)</text>
      <text x={PS_LEFT - 14} y={PS_TOP + PS_SIZE / 2} textAnchor="middle"
        fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.28)"
        transform={`rotate(-90,${PS_LEFT - 14},${PS_TOP + PS_SIZE / 2})`}>Input B (0→1)</text>
      {/* Tick marks */}
      {[0, 0.5, 1].map((tick) => (
        <g key={tick}>
          <text x={PS_LEFT + tick * PS_SIZE} y={PS_TOP + PS_SIZE + 8}
            textAnchor="middle" fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.2)">{tick.toFixed(1)}</text>
          <text x={PS_LEFT - 4} y={PS_TOP + (1 - tick) * PS_SIZE + 3}
            textAnchor="end" fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.2)">{tick.toFixed(1)}</text>
        </g>
      ))}
      {/* Viridis color bar */}
      <defs>
        <linearGradient id="gecair-viridis" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={viridisColor(0)} />
          <stop offset="25%" stopColor={viridisColor(0.25)} />
          <stop offset="50%" stopColor={viridisColor(0.5)} />
          <stop offset="75%" stopColor={viridisColor(0.75)} />
          <stop offset="100%" stopColor={viridisColor(1)} />
        </linearGradient>
      </defs>
      <rect x={PS_LEFT + PS_SIZE + 8} y={PS_TOP} width="10" height={PS_SIZE}
        fill="url(#gecair-viridis)" rx="3" />
      <text x={PS_LEFT + PS_SIZE + 22} y={PS_TOP + 6} fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.3)">1.0</text>
      <text x={PS_LEFT + PS_SIZE + 22} y={PS_TOP + PS_SIZE + 2} fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.3)">0.0</text>

      {/* ── Right: Transfer curves ── */}
      <rect x="324" y="54" width="382" height="92" rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" />
      <text x="338" y="74" fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.24)">TRANSFER CURVES</text>
      <polyline points={curveA.points} fill="none" stroke="#E41A1C" strokeWidth="2" />
      <polyline points={curveB.points} fill="none" stroke="#FF7F00" strokeWidth="2" />
      <circle cx={curveA.markerX} cy={curveA.markerY} r="4" fill="#E41A1C" />
      <circle cx={curveB.markerX} cy={curveB.markerY} r="4" fill="#FF7F00" />
      <text x="348" y="133" fontFamily={T.MONO} fontSize="8" fill="rgba(228,26,28,0.9)">
        A: {(curveA.markerOutput * 100).toFixed(0)}%
      </text>
      <text x="420" y="133" fontFamily={T.MONO} fontSize="8" fill="rgba(255,127,0,0.9)">
        B: {(curveB.markerOutput * 100).toFixed(0)}%
      </text>

      <rect x="324" y="164" width="382" height="160" rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" />
      <text x="338" y="182" fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.24)">
        NODE STATE LEDGER
      </text>
      {nodeRows.map((row, index) => {
        const y = 204 + index * 40;
        return (
          <g key={row.label}>
            <text x="338" y={y} fontFamily={T.SANS} fontSize="11" fill="rgba(255,255,255,0.68)">
              {row.label}
            </text>
            <rect x="338" y={y + 8} width="220" height="10" rx="999" fill="rgba(255,255,255,0.06)" />
            <rect x="338" y={y + 8} width={Math.max(8, row.value * 220)} height="10" rx="999" fill={row.tone} opacity={0.85} />
            <text x="564" y={y + 17} textAnchor="end" fontFamily={T.MONO} fontSize="9" fontWeight="600" fill="rgba(255,255,255,0.65)">
              {(row.value * 100).toFixed(1)}%
            </text>
            <text x="338" y={y + 31} fontFamily={T.SANS} fontSize="9" fill="rgba(255,255,255,0.28)">
              {row.detail}
            </text>
          </g>
        );
      })}

      {/* SBOL Legend */}
      <rect x="324" y="340" width="382" height="140" rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.07)" />
      <text x="338" y="358" fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.24)">SBOL2 NOTATION LEGEND</text>
      {[
        { label: 'Promoter',   color: '#984EA3', shape: 'pentagon' },
        { label: 'RBS',        color: '#377EB8', shape: 'arc' },
        { label: 'CDS/Gate',   color: '#FF7F00', shape: 'arrow' },
        { label: 'Terminator', color: '#E41A1C', shape: 'T' },
      ].map((item, i) => (
        <g key={item.label} transform={`translate(338,${372 + i * 26})`}>
          <rect width="10" height="10" rx="2" fill={item.color} opacity={0.8} />
          <text x="16" y="9" fontFamily={T.SANS} fontSize="10" fill="rgba(255,255,255,0.55)">{item.label}</text>
          <text x="100" y="9" fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.28)">{item.shape}</text>
        </g>
      ))}
      <text x="338" y="476" fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.2)">
        Expression level → CDS height · Phase space → viridis output
      </text>
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
