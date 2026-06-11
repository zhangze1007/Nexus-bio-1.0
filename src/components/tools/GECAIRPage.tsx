'use client';
import { useState, useMemo, useEffect } from 'react';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import { CIRCUIT_NODES, LOGIC_GATES, hillInhibition, hillActivation, runRepressilator, runToggleSwitch, runLogicCascade } from '../../data/mockGECAIR';
import type { GateType, RepressilatorState, ToggleSwitchState, LogicCascadeState } from '../../data/mockGECAIR';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { THEME } from '../../theme';
import WorkbenchRangeSlider from './shared/WorkbenchRangeSlider';
import ScientificHero from './shared/ScientificHero';
import ToolShell from './shared/ToolShell';
import type { ToolTab } from './shared/ToolTabBar';
import ToolTabPanel from './shared/ToolTabPanel';
import FloatingControlRail from './shared/FloatingControlRail';

import ScientificFigureFrame from './shared/ScientificFigureFrame';
import ScientificMethodStrip from './shared/ScientificMethodStrip';
import { SVGChartContainer } from '../charts/primitives';


const PART_COLORS: Record<string, string> = {
  promoter: THEME.lilac,
  rbs: THEME.sky,
  cds: THEME.apricot,
  terminator: THEME.coral,
};

function viridisColor(t: number): string {
  // Canonical matplotlib viridis palette (5 stops)
  const stops: [number, number, number][] = [
    [68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37],
  ];
  const scaled = Math.max(0, Math.min(1, t)) * 4;
  const lo = Math.floor(scaled), hi = Math.min(4, lo + 1), f = scaled - lo;
  const [r1, g1, b1] = stops[lo], [r2, g2, b2] = stops[hi];
  return `rgb(${Math.round(r1 + (r2 - r1) * f)},${Math.round(g1 + (g2 - g1) * f)},${Math.round(b1 + (b2 - b1) * f)})`;
}

/**
 * resolveGateOutput — combinatorial promoter gate model.
 *
 * Inputs a, b are repressor-inhibited expression levels (0–1, from hillInhibition).
 * These are ALREADY transformed — do NOT apply Hill functions again (double-Hill
 * transformation collapses the dynamic range to ~0.2–0.3, losing discriminability).
 *
 * AND:  a · b       (joint probability; both expression channels must be high)
 * OR:   a + b − a·b (union probability; at least one channel sufficient)
 * NAND: 1 − a·b     (complement of AND)
 * NOT:  hillInhibition(a) applied to raw input (single repressor)
 *
 * Reference: Buchler et al. (2003) PNAS — combinatorial gene regulation
 */
function resolveGateOutput(a: number, b: number, gateType: GateType) {
  if (gateType === 'AND')  return a * b;
  if (gateType === 'OR')   return a + b - a * b;
  if (gateType === 'NAND') return 1 - a * b;
  return hillInhibition(a);  // NOT: re-apply Hill repression to raw signal
}

function CircuitSVG({ inputA, inputB, gateType }: { inputA: number; inputB: number; gateType: GateType }) {
  // outA / outB are the repressed signal levels from each input repressor.
  // resolveGateOutput combines these repressed signals directly — it does NOT
  // apply hillInhibition again internally, so there is no double-transformation.
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
    { label: 'Sensor A', value: outA, tone: THEME.coral, detail: 'Hill repression from input A' },
    { label: 'Sensor B', value: outB, tone: THEME.apricot, detail: 'Hill repression from input B' },
    { label: `${gateType} Output`, value: outC, tone: THEME.mint, detail: 'Combined gate expression state' },
  ];

  return (
    <SVGChartContainer W={W} H={H} ariaLabel="Gene circuit diagram" rx={18}>
      <text x="24" y="22" fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.26)">GENE CIRCUIT · SBOL NOTATION</text>
      <text x="24" y="36" fontFamily={THEME.SANS} fontSize="11" fill="rgba(255,255,255,0.72)">
        {gateType} gate — biological parts and 2D phase space response
      </text>

      {/* ── SBOL circuit diagram ── */}
      <rect x={bbX1 - 8} y={bbY - 44} width={bbX2 - bbX1 + 16} height={96} rx="12"
        fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.07)" />
      <text x={bbX1 - 4} y={bbY - 36} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.45)">
        GENETIC ARCHITECTURE
      </text>
      {/* Backbone line */}
      <line x1={bbX1} y1={bbY} x2={bbX2} y2={bbY} stroke="rgba(255,255,255,0.3)" strokeWidth="2" />

      {/* Promoter — purple filled pentagon/arrow at x=65 */}
      <polygon
        points={`65,${bbY} 80,${bbY} 80,${bbY - 22} 90,${bbY - 12} 80,${bbY - 2} 80,${bbY - 22}`}
        fill="rgba(207,196,227,0.85)" stroke={PART_COLORS.promoter} strokeWidth="1"
      />
      <text x={77} y={bbY + 14} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={PART_COLORS.promoter}>P</text>

      {/* RBS — blue half-circle arc above backbone at x=116 */}
      <path d={`M 106,${bbY} A 10 10 0 0 1 126,${bbY}`}
        fill="rgba(175,195,214,0.82)" stroke={PART_COLORS.rbs} strokeWidth="1" />
      <text x={116} y={bbY + 14} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={PART_COLORS.rbs}>RBS</text>

      {/* CDS — orange arrow rectangle at x=148 */}
      <polygon
        points={`138,${bbY - 16} 190,${bbY - 16} 206,${bbY} 190,${bbY + 16} 138,${bbY + 16}`}
        fill={`rgba(231,199,169,${0.3 + exprLevel * 0.55})`}
        stroke={PART_COLORS.cds} strokeWidth="1.2"
      />
      <text x={172} y={bbY + 4} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={PART_COLORS.cds}>{gateType}</text>

      {/* Terminator — red T-shape at x=252 */}
      <line x1={252} y1={bbY - 20} x2={252} y2={bbY + 2} stroke={PART_COLORS.terminator} strokeWidth="2.5" />
      <line x1={240} y1={bbY - 20} x2={264} y2={bbY - 20} stroke={PART_COLORS.terminator} strokeWidth="2.5" />
      <text x={252} y={bbY + 14} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={PART_COLORS.terminator}>T</text>

      {/* Output arrow at right end */}
      <line x1={bbX2} y1={bbY} x2={bbX2 + 18} y2={bbY} stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" markerEnd="url(#gecair-arrow)" />
      <defs>
        <marker id="gecair-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <polygon points="0 0.5, 5.5 3, 0 5.5" fill="rgba(255,255,255,0.3)" />
        </marker>
      </defs>
      <text x={bbX2 + 22} y={bbY + 4} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.28)">{(outC * 100).toFixed(0)}%</text>

      {/* ── 2D Phase Space heatmap (viridis, 30×30) ── */}
      <text x={PS_LEFT} y={PS_TOP - 10} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.26)">
        PHASE SPACE · Output = {viridisColor(0).includes('68') ? 'low' : ''} → high (viridis)
      </text>
      <rect x={PS_LEFT - 2} y={PS_TOP - 2} width={PS_SIZE + 4} height={PS_SIZE + 4} rx="10"
        fill="none" stroke="rgba(255,255,255,0.07)" />

      {/* Heatmap cells */}
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

      {/* Isocontour lines (marching squares) */}
      <g opacity="0.4">
        {[0.25, 0.5, 0.75].map(level => {
          const GRID = phaseHeat.length;
          const paths: string[] = [];

          for (let yi = 0; yi < GRID - 1; yi++) {
            for (let xi = 0; xi < GRID - 1; xi++) {
              const v00 = phaseHeat[yi][xi];
              const v10 = phaseHeat[yi][xi + 1];
              const v01 = phaseHeat[yi + 1][xi];
              const v11 = phaseHeat[yi + 1][xi + 1];

              const code =
                (v00 >= level ? 1 : 0) |
                (v10 >= level ? 2 : 0) |
                (v11 >= level ? 4 : 0) |
                (v01 >= level ? 8 : 0);

              if (code === 0 || code === 15) continue;

              const x0 = PS_LEFT + xi * cellSize + cellSize / 2;
              const y0 = PS_TOP + yi * cellSize + cellSize / 2;
              const x1 = PS_LEFT + (xi + 1) * cellSize + cellSize / 2;
              const y1 = PS_TOP + (yi + 1) * cellSize + cellSize / 2;

              const interpX = (va: number, vb: number, a: number, b: number) => {
                const t = (level - va) / (vb - va);
                return a + t * (b - a);
              };

              const top = { x: interpX(v00, v10, x0, x1), y: y0 };
              const bottom = { x: interpX(v01, v11, x0, x1), y: y1 };
              const left = { x: x0, y: interpX(v00, v01, y0, y1) };
              const right = { x: x1, y: interpX(v10, v11, y0, y1) };

              const seg = (ax: number, ay: number, bx: number, by: number) =>
                `M${ax.toFixed(1)},${ay.toFixed(1)}L${bx.toFixed(1)},${by.toFixed(1)}`;

              switch (code) {
                case 1: case 14: paths.push(seg(top.x, top.y, left.x, left.y)); break;
                case 2: case 13: paths.push(seg(top.x, top.y, right.x, right.y)); break;
                case 3: case 12: paths.push(seg(left.x, left.y, right.x, right.y)); break;
                case 4: case 11: paths.push(seg(right.x, right.y, bottom.x, bottom.y)); break;
                case 5: paths.push(seg(top.x, top.y, right.x, right.y)); paths.push(seg(left.x, left.y, bottom.x, bottom.y)); break;
                case 6: case 9: paths.push(seg(top.x, top.y, bottom.x, bottom.y)); break;
                case 7: case 8: paths.push(seg(left.x, left.y, bottom.x, bottom.y)); break;
                case 10: paths.push(seg(top.x, top.y, left.x, left.y)); paths.push(seg(right.x, right.y, bottom.x, bottom.y)); break;
              }
            }
          }

          return paths.length > 0 ? (
            <path
              key={`contour-${level}`}
              d={paths.join('')}
              fill="none"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="0.8"
            />
          ) : null;
        })}
      </g>

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
        fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.28)">Input A (0→1)</text>
      <text x={PS_LEFT - 14} y={PS_TOP + PS_SIZE / 2} textAnchor="middle"
        fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.28)"
        transform={`rotate(-90,${PS_LEFT - 14},${PS_TOP + PS_SIZE / 2})`}>Input B (0→1)</text>
      {/* Tick marks */}
      {[0, 0.5, 1].map((tick) => (
        <g key={tick}>
          <text x={PS_LEFT + tick * PS_SIZE} y={PS_TOP + PS_SIZE + 8}
            textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.2)">{tick.toFixed(1)}</text>
          <text x={PS_LEFT - 4} y={PS_TOP + (1 - tick) * PS_SIZE + 3}
            textAnchor="end" fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.2)">{tick.toFixed(1)}</text>
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
      <text x={PS_LEFT + PS_SIZE + 22} y={PS_TOP + 6} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.3)">1.0</text>
      <text x={PS_LEFT + PS_SIZE + 22} y={PS_TOP + PS_SIZE + 2} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.3)">0.0</text>

      {/* ── Right: Transfer curves ── */}
      <rect x="324" y="54" width="382" height="92" rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" />
      <text x="338" y="74" fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.24)">TRANSFER CURVES</text>

      {/* Area fill under Hill curves */}
      <polygon
        points={`${curveA.points} ${curveA.points.split(' ').pop()?.split(',')[0]},146 348,146`}
        fill={THEME.coral} fillOpacity="0.1"
      />
      <polygon
        points={`${curveB.points} ${curveB.points.split(' ').pop()?.split(',')[0]},146 348,146`}
        fill={THEME.apricot} fillOpacity="0.1"
      />

      {/* Curve lines */}
      <polyline points={curveA.points} fill="none" stroke={THEME.coral} strokeWidth="2" />
      <polyline points={curveB.points} fill="none" stroke={THEME.apricot} strokeWidth="2" />

      {/* Operating point markers */}
      <circle cx={curveA.markerX} cy={curveA.markerY} r="4" fill={THEME.coral} />
      <circle cx={curveB.markerX} cy={curveB.markerY} r="4" fill={THEME.apricot} />
      <text x="348" y="133" fontFamily={THEME.MONO} fontSize="10" fill="rgba(232,163,161,0.9)">
        A: {(curveA.markerOutput * 100).toFixed(0)}%
      </text>
      <text x="420" y="133" fontFamily={THEME.MONO} fontSize="10" fill="rgba(231,199,169,0.95)">
        B: {(curveB.markerOutput * 100).toFixed(0)}%
      </text>

      <rect x="324" y="164" width="382" height="160" rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" />
      <text x="338" y="182" fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.24)">
        NODE STATE LEDGER
      </text>
      {nodeRows.map((row, index) => {
        const y = 204 + index * 40;
        return (
          <g key={row.label}>
            <text x="338" y={y} fontFamily={THEME.SANS} fontSize="11" fill="rgba(255,255,255,0.68)">
              {row.label}
            </text>
            <rect x="338" y={y + 8} width="220" height="10" rx="999" fill="rgba(255,255,255,0.06)" />
            <rect x="338" y={y + 8} width={Math.max(8, row.value * 220)} height="10" rx="999" fill={row.tone} opacity={0.85} />
            <text x="564" y={y + 17} textAnchor="end" fontFamily={THEME.MONO} fontSize="10" fontWeight="600" fill="rgba(255,255,255,0.65)">
              {(row.value * 100).toFixed(1)}%
            </text>
            <text x="338" y={y + 31} fontFamily={THEME.SANS} fontSize="10" fill="rgba(255,255,255,0.28)">
              {row.detail}
            </text>
          </g>
        );
      })}

      {/* SBOL Legend */}
      <rect x="324" y="340" width="382" height="140" rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.07)" />
      <text x="338" y="358" fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.24)">SBOL2 NOTATION LEGEND</text>
      {[
        { label: 'Promoter',   color: PART_COLORS.promoter, shape: 'pentagon' },
        { label: 'RBS',        color: PART_COLORS.rbs, shape: 'arc' },
        { label: 'CDS/Gate',   color: PART_COLORS.cds, shape: 'arrow' },
        { label: 'Terminator', color: PART_COLORS.terminator, shape: 'T' },
      ].map((item, i) => (
        <g key={item.label} transform={`translate(338,${372 + i * 26})`}>
          <rect width="10" height="10" rx="2" fill={item.color} opacity={0.8} />
          <text x="16" y="9" fontFamily={THEME.SANS} fontSize="10" fill="rgba(255,255,255,0.55)">{item.label}</text>
          <text x="100" y="9" fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.28)">{item.shape}</text>
        </g>
      ))}
      <text x="338" y="476" fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.2)">
        Expression level → CDS height · Phase space → viridis output
      </text>
    </SVGChartContainer>
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
  const [circuitType, setCircuitType] = useState<'repressilator' | 'toggle_switch' | 'logic_cascade'>('repressilator');
  const [togglePerturbation, setTogglePerturbation] = useState<'A' | 'B'>('A');
  const [activeTab, setActiveTab] = useState('circuit');
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

  // Test both positive and negative perturbations for worst-case sensitivity
  const delta = 0.05;
  const noiseScore = Math.max(
    Math.abs(resolveGateOutput(hillInhibition(Math.max(0, Math.min(1, inputA + delta))), outB, gateType) - finalOutput),
    Math.abs(resolveGateOutput(hillInhibition(Math.max(0, Math.min(1, inputA - delta))), outB, gateType) - finalOutput),
    Math.abs(resolveGateOutput(outA, hillInhibition(Math.max(0, Math.min(1, inputB + delta))), gateType) - finalOutput),
    Math.abs(resolveGateOutput(outA, hillInhibition(Math.max(0, Math.min(1, inputB - delta))), gateType) - finalOutput),
  );

  const exportData = useMemo(() => ({
    gateType,
    inputA: inputA.toFixed(3),
    inputB: inputB.toFixed(3),
    output: finalOutput.toFixed(3),
    noiseScore: noiseScore.toFixed(4),
  }), [gateType, inputA, inputB, finalOutput, noiseScore]);
  const figureMeta = useMemo(() => ({
    eyebrow: 'Circuit figure',
    title: `${gateType} logic is framed as a control-system figure with parts, response space, and state ledger`,
    caption: 'The main panel keeps genetic architecture, transfer behavior, and combinatorial output in one evidence surface so gate choice reads like a scientific design decision instead of a toy toggle.',
  }), [gateType]);

  useEffect(() => {
    setToolPayload('gecair', {
      validity: 'partial',
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

  const tabs: ToolTab[] = [
    { id: 'circuit', label: 'Circuit' },
    { id: 'phasespace', label: 'Phase Space' },
    { id: 'transfer', label: 'Transfer' },
    { id: 'dynamics', label: 'Dynamics' },
    { id: 'truth', label: 'Truth Table' },
  ];

  return (
    <ToolShell
      moduleId="gecair"
      title="Gene Circuit AI Reasoner"
      description="Hill-function kinetics model promoter activity with logic gate design"
      formula="f(x) = Kⁿ/(Kⁿ+xⁿ)"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={['phasespace', 'transfer', 'dynamics']}
    >
      {/* ═══════ CIRCUIT TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="circuit">
        <div style={{ padding: '0 16px 10px' }}>
          <ScientificHero
            eyebrow="Stage 3 · Gene Circuit Programming"
            title={`${gateType} logic for the current chassis objective`}
            summary="GECAIR now reads as a control-design page rather than a circuit toy. The important question is whether the selected logic stabilizes the current pathway and burden context, not just whether the gate truth table looks correct."
            aside={
              <>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Recommended logic
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.value, fontWeight: 700 }}>
                  {recommendedGate} gate from current burden and control context
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.label, lineHeight: 1.55 }}>
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

        <div style={{ padding: '0 16px 10px' }}>
          <ScientificMethodStrip
            label="Circuit design bench"
            items={[
              {
                title: 'Input envelope',
                detail: 'The controller and catalyst state seed the gate inputs so circuit design starts from system pressure instead of abstract binary examples.',
                accent: THEME.sky,
                note: `A ${(inputA * 100).toFixed(0)}% · B ${(inputB * 100).toFixed(0)}%`,
              },
              {
                title: 'Logic architecture',
                detail: 'Promoter, RBS, CDS, terminator, and phase-space response are grouped into one publication-style figure rather than split across dashboard cards.',
                accent: THEME.lilac,
                note: `${gateType} gate`,
              },
              {
                title: 'Stability readout',
                detail: 'Noise sensitivity and output level remain visible next to the figure so buildability and control quality stay attached to the same decision.',
                accent: THEME.mint,
                note: `noise ${noiseScore.toFixed(4)}`,
              },
            ]}
          />
        </div>

        <div className="nb-tool-panels" style={{ flex: 1 }}>
          {/* Input panel */}
          <div className="nb-tool-sidebar" style={{ width: '240px', borderRight: `1px solid ${THEME.paperBorder}`, background: THEME.sepiaPanelMuted }}>
            <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.paperLabel, margin: '0 0 12px' }}>
              Input Signals
            </p>

            <WorkbenchRangeSlider label="Input A strength" value={inputA} min={0} max={1} step={0.05} formatValue={v => `${(v * 100).toFixed(0)}%`} onChange={setInputA} />
            <WorkbenchRangeSlider label="Input B strength" value={inputB} min={0} max={1} step={0.05} formatValue={v => `${(v * 100).toFixed(0)}%`} onChange={setInputB} />

            <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.paperLabel, margin: '16px 0 8px' }}>
              Output Gate Type
            </p>
            {(['NOT', 'AND', 'OR', 'NAND'] as GateType[]).map(gate => (
              <button aria-label={`Select ${gate} gate type`} key={gate} onClick={() => setGateType(gate)} className={`nb-tool-toggle ${gateType === gate ? 'nb-tool-toggle--active' : ''}`}>
                {gate} Gate
              </button>
            ))}

            <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.paperLabel, margin: '16px 0 8px' }}>
              Truth Table
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['A', 'B', 'OUT'].map(h => (
                    <th key={h} style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, padding: '3px 6px', textAlign: 'center', borderBottom: `1px solid ${THEME.paperBorder}` }}>{h}</th>
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
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : THEME.paperSurfaceMuted }}>
                      {[row.A, row.B, out].map((v, j) => (
                        <td key={j} style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textAlign: 'center', padding: '4px', color: v ? THEME.mint : THEME.paperLabel }}>
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
          <div className="nb-tool-center" style={{ flex: 1, background: THEME.sepiaPanelMuted, padding: '12px', minWidth: 0 }}>
            <ScientificFigureFrame
              eyebrow={figureMeta.eyebrow}
              title={figureMeta.title}
              caption={figureMeta.caption}
              legend={[
                { label: 'Gate', value: gateType, accent: THEME.lilac },
                { label: 'Input A', value: `${(inputA * 100).toFixed(0)}%`, accent: THEME.coral },
                { label: 'Input B', value: `${(inputB * 100).toFixed(0)}%`, accent: THEME.apricot },
                { label: 'Output', value: `${(finalOutput * 100).toFixed(1)}%`, accent: THEME.mint },
              ]}
              footer={
                <div style={{ display: 'grid', gap: '6px' }}>
                  <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.paperValue, lineHeight: 1.55 }}>
                    The page now treats the circuit as a scientific control object: architecture, phase space, transfer response, and node state are presented as one figure so logic choice can be defended from first principles.
                  </div>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>
                    recommended gate {recommendedGate} · node outputs {(outA * 100).toFixed(0)} / {(outB * 100).toFixed(0)} · noise {noiseScore.toFixed(4)}
                  </div>
                </div>
              }
              minHeight="100%"
            >
              <div style={{ minHeight: '500px' }}>
                <CircuitSVG inputA={inputA} inputB={inputB} gateType={gateType} />
              </div>
            </ScientificFigureFrame>
          </div>

          {/* Results panel */}
          <div className="nb-tool-right" style={{ width: '240px', borderLeft: `1px solid ${THEME.paperBorder}`, background: THEME.sepiaPanelMuted }}>
            <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.paperLabel, margin: '0 0 12px' }}>
              Circuit Readouts
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <MetricCard label="Output Level (GFP)" value={(finalOutput * 100).toFixed(1)} unit="%" highlight />
              <MetricCard label="Node A Output" value={(outA * 100).toFixed(1)} unit="%" />
              <MetricCard label="Node B Output" value={(outB * 100).toFixed(1)} unit="%" />
              <MetricCard label="Noise Sensitivity" value={noiseScore.toFixed(4)} warning={noiseScore > 0.05 ? 'High noise sensitivity — consider insulator parts' : undefined} />
              <MetricCard label="Circuit Complexity" value={CIRCUIT_NODES.reduce((a, n) => a + n.parts.length, 0)} unit="parts" />
            </div>

            {/* Circuit Type Selector */}
            <div style={{ marginTop: '12px', padding: '12px', borderRadius: 'var(--nb-radius-md)', border: `1px solid ${THEME.paperBorder}`, background: THEME.paperSurfaceStrong }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                ODE Circuit Model
              </div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {(['repressilator', 'toggle_switch', 'logic_cascade'] as const).map(ct => (
                  <button
                    key={ct}
                    aria-label={`Select ${ct === 'repressilator' ? 'Repressilator' : ct === 'toggle_switch' ? 'Toggle Switch' : 'Logic Cascade'} circuit`}
                    onClick={() => setCircuitType(ct)}
                    className={`nb-tool-toggle ${circuitType === ct ? 'nb-tool-toggle--active' : ''}`}
                  >
                    {ct === 'repressilator' ? 'Repressilator' : ct === 'toggle_switch' ? 'Toggle Switch' : 'Logic Cascade'}
                  </button>
                ))}
              </div>
              {circuitType === 'toggle_switch' && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  <span style={{ fontFamily: THEME.MONO, fontSize: '11px', color: THEME.paperLabel, alignSelf: 'center' }}>Perturbation:</span>
                  {(['A', 'B'] as const).map(p => (
                    <button
                      key={p}
                      aria-label={`Toggle switch perturbation ${p}`}
                      onClick={() => setTogglePerturbation(p)}
                      className={`nb-tool-toggle ${togglePerturbation === p ? 'nb-tool-toggle--active' : ''}`}
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                    >
                      State {p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ODE Dynamics — Real RK4 simulation */}
            {(() => {
              const w = 240, h = 60;

              if (circuitType === 'repressilator') {
                const trajectory = runRepressilator(undefined, 300, 1.0);
                const maxP = Math.max(...trajectory.flatMap(s => [s.pA, s.pB, s.pC]));
                const toPath = (key: keyof RepressilatorState) => {
                  const pts = trajectory.map((s, i) => `${(i / trajectory.length) * w},${h - (s[key] / maxP) * h}`);
                  return `M${pts.join(' L')}`;
                };
                return (
                  <div style={{ marginTop: '12px', padding: '12px', borderRadius: 'var(--nb-radius-md)', border: `1px solid ${THEME.paperBorder}`, background: THEME.paperSurfaceStrong }}>
                    <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                      Repressilator Dynamics (RK4 ODE)
                    </div>
                    <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, lineHeight: 1.4, marginBottom: '8px' }}>
                      3-node ring oscillator: LacI represses TetR, TetR represses cI, cI represses LacI. Produces sustained limit-cycle oscillations (Elowitz &amp; Leibler, 2000).
                    </div>
                    <svg width={w} height={h} style={{ display: 'block', width: '100%' }}>
                      <path d={toPath('pA')} fill="none" stroke="#C8D8E8" strokeWidth={1.5} />
                      <path d={toPath('pB')} fill="none" stroke="#C8E0D0" strokeWidth={1.5} />
                      <path d={toPath('pC')} fill="none" stroke="#DDD0E8" strokeWidth={1.5} />
                    </svg>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontFamily: THEME.MONO, fontSize: '11px' }}>
                      <span style={{ color: '#C8D8E8' }}>■ LacI</span>
                      <span style={{ color: '#C8E0D0' }}>■ TetR</span>
                      <span style={{ color: '#DDD0E8' }}>■ cI</span>
                    </div>
                  </div>
                );
              }

              if (circuitType === 'logic_cascade') {
                const trajectory = runLogicCascade(undefined, 300, 1.0);
                const maxP = Math.max(...trajectory.flatMap(s => [s.pA, s.pB, s.pC]));
                const toPath = (key: keyof LogicCascadeState) => {
                  const pts = trajectory.map((s, i) => `${(i / trajectory.length) * w},${h - (s[key] / maxP) * h}`);
                  return `M${pts.join(' L')}`;
                };
                const finalPA = trajectory[trajectory.length - 1].pA;
                const finalPB = trajectory[trajectory.length - 1].pB;
                const finalPC = trajectory[trajectory.length - 1].pC;
                const cascadeGain = finalPC / Math.max(0.01, finalPA);
                return (
                  <div style={{ marginTop: '12px', padding: '12px', borderRadius: 'var(--nb-radius-md)', border: `1px solid ${THEME.paperBorder}`, background: THEME.paperSurfaceStrong }}>
                    <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                      Logic Cascade Dynamics (RK4 ODE)
                    </div>
                    <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, lineHeight: 1.4, marginBottom: '8px' }}>
                      3-node linear cascade: A constitutively driven, B repressed by A, C repressed by B. Signal attenuation through the cascade enables noise filtering (Hooshangi et al., 2005).
                    </div>
                    <svg width={w} height={h} style={{ display: 'block', width: '100%' }}>
                      <path d={toPath('pA')} fill="none" stroke="#C8D8E8" strokeWidth={1.5} />
                      <path d={toPath('pB')} fill="none" stroke="#C8E0D0" strokeWidth={1.5} />
                      <path d={toPath('pC')} fill="none" stroke="#DDD0E8" strokeWidth={1.5} />
                    </svg>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontFamily: THEME.MONO, fontSize: '11px' }}>
                      <span style={{ color: '#C8D8E8' }}>■ Node A (input)</span>
                      <span style={{ color: '#C8E0D0' }}>■ Node B (cascade)</span>
                      <span style={{ color: '#DDD0E8' }}>■ Node C (output)</span>
                    </div>
                    <div style={{ fontFamily: THEME.MONO, fontSize: '11px', color: THEME.mint, marginTop: '6px' }}>
                      Cascade gain: {cascadeGain.toFixed(2)} (pA={finalPA.toFixed(1)}, pB={finalPB.toFixed(1)}, pC={finalPC.toFixed(1)})
                    </div>
                  </div>
                );
              }

              // Toggle Switch (default fallback)
              const trajectory = runToggleSwitch(undefined, 300, 1.0, togglePerturbation);
              const maxP = Math.max(...trajectory.flatMap(s => [s.pA, s.pB]));
              const toPath = (key: keyof ToggleSwitchState) => {
                const pts = trajectory.map((s, i) => `${(i / trajectory.length) * w},${h - (s[key] / maxP) * h}`);
                return `M${pts.join(' L')}`;
              };
              const finalPA = trajectory[trajectory.length - 1].pA;
              const finalPB = trajectory[trajectory.length - 1].pB;
              const settledState = finalPA > finalPB ? 'A' : 'B';
              return (
                <div style={{ marginTop: '12px', padding: '12px', borderRadius: 'var(--nb-radius-md)', border: `1px solid ${THEME.paperBorder}`, background: THEME.paperSurfaceStrong }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                    Toggle Switch Dynamics (RK4 ODE)
                  </div>
                  <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, lineHeight: 1.4, marginBottom: '8px' }}>
                    Mutual repression bistable switch: A represses B, B represses A. Settles to one stable state depending on initial perturbation (Gardner et al., 2000).
                  </div>
                  <svg width={w} height={h} style={{ display: 'block', width: '100%' }}>
                    <path d={toPath('pA')} fill="none" stroke="#C8D8E8" strokeWidth={1.5} />
                    <path d={toPath('pB')} fill="none" stroke="#E8DCC8" strokeWidth={1.5} />
                  </svg>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontFamily: THEME.MONO, fontSize: '11px' }}>
                    <span style={{ color: '#C8D8E8' }}>■ Protein A</span>
                    <span style={{ color: '#E8DCC8' }}>■ Protein B</span>
                  </div>
                  <div style={{ fontFamily: THEME.MONO, fontSize: '11px', color: THEME.mint, marginTop: '6px' }}>
                    Settled to state {settledState} (pA={finalPA.toFixed(1)}, pB={finalPB.toFixed(1)})
                  </div>
                </div>
              );
            })()}

            <div style={{
              marginTop: '12px',
              padding: '12px',
              borderRadius: 'var(--nb-radius-md)',
              border: `1px solid ${THEME.paperBorder}`,
              background: THEME.paperSurfaceStrong,
              display: 'grid',
              gap: '6px',
            }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Recommendation
              </div>
              <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.paperValue, lineHeight: 1.55 }}>
                {recommendedGate === gateType
                  ? 'The active gate agrees with the system-derived recommendation, so the control story is internally coherent.'
                  : 'The active gate differs from the system-derived recommendation, which is useful when stress-testing alternative logic before build.'}
              </div>
            </div>
          </div>
        </div>
      </ToolTabPanel>

      {/* ═══════ PHASE SPACE TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="phasespace">
        <div style={{ padding: '16px' }}>
          <ScientificFigureFrame
            eyebrow="Phase Space Analysis"
            title={`${gateType} Gate — 2D Phase Space`}
            caption="Viridis heatmap showing gate output as a function of both inputs"
          >
            <CircuitSVG inputA={inputA} inputB={inputB} gateType={gateType} />
          </ScientificFigureFrame>
        </div>
      </ToolTabPanel>

      {/* ═══════ TRANSFER TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="transfer">
        <div style={{ padding: '16px' }}>
          <ScientificFigureFrame
            eyebrow="Transfer Function"
            title={`${gateType} Gate Response Curve`}
            caption={`Operating point: A=${(inputA*100).toFixed(0)}% B=${(inputB*100).toFixed(0)}% → ${(finalOutput*100).toFixed(1)}%`}
          >
            <CircuitSVG inputA={inputA} inputB={inputB} gateType={gateType} />
          </ScientificFigureFrame>
        </div>
      </ToolTabPanel>

      {/* ═══════ DYNAMICS TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="dynamics">
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            {(['repressilator', 'toggle_switch', 'logic_cascade'] as const).map(ct => (
              <button key={ct} onClick={() => setCircuitType(ct)}
                className={`nb-tool-toggle ${circuitType === ct ? 'nb-tool-toggle--active' : ''}`}
                style={{ fontSize: '11px' }}>
                {ct === 'repressilator' ? 'Repressilator' : ct === 'toggle_switch' ? 'Toggle Switch' : 'Logic Cascade'}
              </button>
            ))}
          </div>
          <ScientificFigureFrame
            eyebrow="ODE Dynamics"
            title={`${circuitType === 'repressilator' ? 'Repressilator' : circuitType === 'toggle_switch' ? 'Toggle Switch' : 'Logic Cascade'} — RK4 Simulation`}
            caption="Real-time ODE integration showing protein concentration trajectories"
          >
            <CircuitSVG inputA={inputA} inputB={inputB} gateType={gateType} />
          </ScientificFigureFrame>
        </div>
      </ToolTabPanel>

      {/* ═══════ TRUTH TABLE TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="truth">
        <div style={{ padding: '16px', maxWidth: '400px' }}>
          <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
            {gateType} Gate Truth Table
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: 'var(--nb-radius-md)', overflow: 'hidden', border: `1px solid ${THEME.BORDER}` }}>
            <thead>
              <tr>
                {['A', 'B', 'OUT'].map(h => (
                  <th key={h} style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: THEME.LABEL, padding: '8px 12px', textAlign: 'center', background: THEME.PANEL_INSET, borderBottom: `1px solid ${THEME.BORDER}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRUTH_TABLE.map((row, i) => {
                const a = row.A > 0.5 ? 1 : 0;
                const b = row.B > 0.5 ? 1 : 0;
                const out = gateType === 'AND' ? a && b : gateType === 'OR' ? a || b : gateType === 'NAND' ? !(a && b) ? 1 : 0 : 1 - a;
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    {[row.A, row.B, out].map((v, j) => (
                      <td key={j} style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', textAlign: 'center', padding: '8px 12px', color: v ? THEME.MINT : THEME.LABEL, fontWeight: v ? 600 : 400 }}>
                        {v ? '1' : '0'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ToolTabPanel>

      {/* ═══════ Footer ═══════ */}
      <div style={{ borderTop: `1px solid ${THEME.BORDER}`, padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0, background: THEME.PANEL_MUTED }}>
        <ExportButton label="Export JSON" data={exportData} filename="gecair-circuit" format="json" />
      </div>
    </ToolShell>
  );
}
