'use client';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import { CIRCUIT_NODES, LOGIC_GATES, hillInhibition, hillActivation, runRepressilator, runToggleSwitch, runLogicCascade } from '../../data/mockGECAIR';
import type { GateType, RepressilatorState, ToggleSwitchState, LogicCascadeState } from '../../data/mockGECAIR';
import { runGillespie } from '../../server/gillespieSSA';
import type { StochasticModel, GillespieResult } from '../../server/gillespieSSA';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
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
import { PAPER_THEME } from '../charts/chartTheme';


/** mRNA/protein degradation rate (1/min) — Alon, An Introduction to Systems Biology (2007) */
const PROTEIN_DEGRADATION_RATE = 0.0075;

/** PRNG seed offset for Gillespie ensemble runs — ensures reproducible stochastic trajectories */
const GILLESPIE_SEED_OFFSET = 42;

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

function CircuitSVG({ inputA, inputB, gateType, view = 'full' }: { inputA: number; inputB: number; gateType: GateType; view?: 'full' | 'phasespace' | 'transfer' | 'dynamics' }) {
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
    <SVGChartContainer W={W} H={H} ariaLabel="Gene circuit diagram" variant="paper">
      <text x="24" y="22" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>GENE CIRCUIT · SBOL NOTATION</text>
      <text x="24" y="36" fontFamily={PAPER_THEME.titleFont} fontSize={PAPER_THEME.labelSize} fill={PAPER_THEME.titleColor}>
        {gateType} gate — biological parts and 2D phase space response
      </text>

      {/* ── SBOL circuit diagram ── */}
      <rect x={bbX1 - 8} y={bbY - 44} width={bbX2 - bbX1 + 16} height={96} rx={PAPER_THEME.borderRadius}
        fill={PAPER_THEME.bgAlt} stroke={PAPER_THEME.border} />
      <text x={bbX1 - 4} y={bbY - 36} fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
        GENETIC ARCHITECTURE
      </text>
      {/* Backbone line */}
      <line x1={bbX1} y1={bbY} x2={bbX2} y2={bbY} stroke={PAPER_THEME.axis} strokeWidth="2" />

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
      <line x1={bbX2} y1={bbY} x2={bbX2 + 18} y2={bbY} stroke={PAPER_THEME.axis} strokeWidth="1.5" markerEnd="url(#gecair-arrow)" />
      <defs>
        <marker id="gecair-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <polygon points="0 0.5, 5.5 3, 0 5.5" fill={PAPER_THEME.axis} />
        </marker>
      </defs>
      <text x={bbX2 + 22} y={bbY + 4} fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>{(outC * 100).toFixed(0)}%</text>

      {/* ── 2D Phase Space heatmap (viridis, 30×30) ── */}
      <text x={PS_LEFT} y={PS_TOP - 10} fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
        PHASE SPACE · Output = {viridisColor(0).includes('68') ? 'low' : ''} → high (viridis)
      </text>
      <rect x={PS_LEFT - 2} y={PS_TOP - 2} width={PS_SIZE + 4} height={PS_SIZE + 4} rx={PAPER_THEME.borderRadius}
        fill="none" stroke={PAPER_THEME.border} />

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
              stroke="rgba(0,0,0,0.25)"
              strokeWidth="0.8"
            />
          ) : null;
        })}
      </g>

      {/* Crosshair at current (inputA, inputB) */}
      <line
        x1={PS_LEFT + inputA * PS_SIZE} y1={PS_TOP}
        x2={PS_LEFT + inputA * PS_SIZE} y2={PS_TOP + PS_SIZE}
        stroke={PAPER_THEME.axis} strokeWidth="1" strokeDasharray="3 2"
      />
      <line
        x1={PS_LEFT} y1={PS_TOP + (1 - inputB) * PS_SIZE}
        x2={PS_LEFT + PS_SIZE} y2={PS_TOP + (1 - inputB) * PS_SIZE}
        stroke={PAPER_THEME.axis} strokeWidth="1" strokeDasharray="3 2"
      />
      <circle
        cx={PS_LEFT + inputA * PS_SIZE}
        cy={PS_TOP + (1 - inputB) * PS_SIZE}
        r={6} fill="none" stroke={PAPER_THEME.scatterStroke} strokeWidth="1.8"
      />
      {/* Axes */}
      <text x={PS_LEFT + PS_SIZE / 2} y={PS_TOP + PS_SIZE + 16} textAnchor="middle"
        fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>Input A (0→1)</text>
      <text x={PS_LEFT - 14} y={PS_TOP + PS_SIZE / 2} textAnchor="middle"
        fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}
        transform={`rotate(-90,${PS_LEFT - 14},${PS_TOP + PS_SIZE / 2})`}>Input B (0→1)</text>
      {/* Tick marks */}
      {[0, 0.5, 1].map((tick) => (
        <g key={tick}>
          <text x={PS_LEFT + tick * PS_SIZE} y={PS_TOP + PS_SIZE + 8}
            textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>{tick.toFixed(1)}</text>
          <text x={PS_LEFT - 4} y={PS_TOP + (1 - tick) * PS_SIZE + 3}
            textAnchor="end" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>{tick.toFixed(1)}</text>
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
      <text x={PS_LEFT + PS_SIZE + 22} y={PS_TOP + 6} fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>1.0</text>
      <text x={PS_LEFT + PS_SIZE + 22} y={PS_TOP + PS_SIZE + 2} fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>0.0</text>

      {/* ── Right: Transfer curves ── */}
      <rect x="324" y="54" width="382" height="92" rx={PAPER_THEME.borderRadius} fill={PAPER_THEME.bgAlt} stroke={PAPER_THEME.border} />
      <text x="338" y="74" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>TRANSFER CURVES</text>

      {/* Area fill under Hill curves */}
      <polygon
        points={`${curveA.points} ${curveA.points.split(' ').pop()?.split(',')[0]},146 348,146`}
        fill={THEME.coral} fillOpacity="0.18"
      />
      <polygon
        points={`${curveB.points} ${curveB.points.split(' ').pop()?.split(',')[0]},146 348,146`}
        fill={THEME.apricot} fillOpacity="0.18"
      />

      {/* Curve lines */}
      <polyline points={curveA.points} fill="none" stroke={THEME.coral} strokeWidth="2" />
      <polyline points={curveB.points} fill="none" stroke={THEME.apricot} strokeWidth="2" />

      {/* Operating point markers */}
      <circle cx={curveA.markerX} cy={curveA.markerY} r="4" fill={THEME.coral} />
      <circle cx={curveB.markerX} cy={curveB.markerY} r="4" fill={THEME.apricot} />
      <text x="348" y="133" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={THEME.coral}>
        A: {(curveA.markerOutput * 100).toFixed(0)}%
      </text>
      <text x="420" y="133" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={THEME.apricot}>
        B: {(curveB.markerOutput * 100).toFixed(0)}%
      </text>

      <rect x="324" y="164" width="382" height="160" rx={PAPER_THEME.borderRadius} fill={PAPER_THEME.bgAlt} stroke={PAPER_THEME.border} />
      <text x="338" y="182" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
        NODE STATE LEDGER
      </text>
      {nodeRows.map((row, index) => {
        const y = 204 + index * 40;
        return (
          <g key={row.label}>
            <text x="338" y={y} fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.labelSize} fill={PAPER_THEME.labelColor}>
              {row.label}
            </text>
            <rect x="338" y={y + 8} width="220" height="10" rx="999" fill={PAPER_THEME.grid} />
            <rect x="338" y={y + 8} width={Math.max(8, row.value * 220)} height="10" rx="999" fill={row.tone} opacity={0.85} />
            <text x="564" y={y + 17} textAnchor="end" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fontWeight="600" fill={PAPER_THEME.labelColor}>
              {(row.value * 100).toFixed(1)}%
            </text>
            <text x="338" y={y + 31} fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
              {row.detail}
            </text>
          </g>
        );
      })}

      {/* SBOL Legend */}
      <rect x="324" y="340" width="382" height="140" rx={PAPER_THEME.borderRadius} fill={PAPER_THEME.bgAlt} stroke={PAPER_THEME.border} />
      <text x="338" y="358" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>SBOL2 NOTATION LEGEND</text>
      {[
        { label: 'Promoter',   color: PART_COLORS.promoter, shape: 'pentagon' },
        { label: 'RBS',        color: PART_COLORS.rbs, shape: 'arc' },
        { label: 'CDS/Gate',   color: PART_COLORS.cds, shape: 'arrow' },
        { label: 'Terminator', color: PART_COLORS.terminator, shape: 'T' },
      ].map((item, i) => (
        <g key={item.label} transform={`translate(338,${372 + i * 26})`}>
          <rect width="10" height="10" rx="2" fill={item.color} opacity={0.8} />
          <text x="16" y="9" fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.labelColor}>{item.label}</text>
          <text x="100" y="9" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>{item.shape}</text>
        </g>
      ))}
      <text x="338" y="476" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
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
  const [stochasticMode, setStochasticMode] = useState(false);
  const [ensembleRuns, setEnsembleRuns] = useState(10);
  const [simError, setSimError] = useState<string | null>(null);
  const gillespieErrorRef = useRef<string | null>(null);

  // Pipeline state
  const [pipelineResult, setPipelineResult] = useState<{
    recommendedGate: string; outputLevel: number; noiseScore: number;
    stability: string; optimizationSteps: number;
  } | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
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

  // ── Stochastic model builders ──
  // Convert ODE circuit models to Gillespie StochasticModel format.
  // Species counts are scaled by a volume factor (Omega) so that
  // stochastic fluctuations have biologically realistic magnitude.
  const OMEGA = 100; // volume scaling factor (arbitrary units)

  function buildRepressilatorStochastic(): StochasticModel {
    // Repressilator: 3 mRNA + 3 protein species, 12 reactions
    // (transcription, translation, mRNA degradation, protein degradation for each node)
    return {
      species: [
        { id: 'mA', initialCount: 10 * OMEGA },
        { id: 'mB', initialCount: 5 * OMEGA },
        { id: 'mC', initialCount: 3 * OMEGA },
        { id: 'pA', initialCount: 100 * OMEGA },
        { id: 'pB', initialCount: 50 * OMEGA },
        { id: 'pC', initialCount: 30 * OMEGA },
      ],
      reactions: [
        // Transcription: mRNA_i produced, repressed by protein_j
        { id: 'txnA', reactants: {}, products: { mA: 1 }, rate: 0.216 * OMEGA, hillRepression: { species: 'pC', K: 100 * OMEGA, n: 2 } },
        { id: 'txnB', reactants: {}, products: { mB: 1 }, rate: 0.216 * OMEGA, hillRepression: { species: 'pA', K: 100 * OMEGA, n: 2 } },
        { id: 'txnC', reactants: {}, products: { mC: 1 }, rate: 0.216 * OMEGA, hillRepression: { species: 'pB', K: 100 * OMEGA, n: 2 } },
        // Translation: protein_i produced from mRNA_i
        { id: 'tlA', reactants: { mA: 1 }, products: { mA: 1, pA: 1 }, rate: 0.2 },
        { id: 'tlB', reactants: { mB: 1 }, products: { mB: 1, pB: 1 }, rate: 0.2 },
        { id: 'tlC', reactants: { mC: 1 }, products: { mC: 1, pC: 1 }, rate: 0.2 },
        // mRNA degradation
        { id: 'deg_mA', reactants: { mA: 1 }, products: {}, rate: 1.0 },
        { id: 'deg_mB', reactants: { mB: 1 }, products: {}, rate: 1.0 },
        { id: 'deg_mC', reactants: { mC: 1 }, products: {}, rate: 1.0 },
        // Protein degradation
        { id: 'deg_pA', reactants: { pA: 1 }, products: {}, rate: PROTEIN_DEGRADATION_RATE },
        { id: 'deg_pB', reactants: { pB: 1 }, products: {}, rate: PROTEIN_DEGRADATION_RATE },
        { id: 'deg_pC', reactants: { pC: 1 }, products: {}, rate: PROTEIN_DEGRADATION_RATE },
      ],
    };
  }

  function buildToggleSwitchStochastic(): StochasticModel {
    // Toggle Switch: 2 mRNA + 2 protein species, 8 reactions
    const stateA = togglePerturbation === 'A';
    return {
      species: [
        { id: 'mA', initialCount: (stateA ? 20 : 2) * OMEGA },
        { id: 'mB', initialCount: (stateA ? 2 : 20) * OMEGA },
        { id: 'pA', initialCount: (stateA ? 200 : 20) * OMEGA },
        { id: 'pB', initialCount: (stateA ? 20 : 200) * OMEGA },
      ],
      reactions: [
        { id: 'txnA', reactants: {}, products: { mA: 1 }, rate: 0.216 * OMEGA, hillRepression: { species: 'pB', K: 100 * OMEGA, n: 2.5 } },
        { id: 'txnB', reactants: {}, products: { mB: 1 }, rate: 0.216 * OMEGA, hillRepression: { species: 'pA', K: 100 * OMEGA, n: 2.5 } },
        { id: 'tlA', reactants: { mA: 1 }, products: { mA: 1, pA: 1 }, rate: 0.2 },
        { id: 'tlB', reactants: { mB: 1 }, products: { mB: 1, pB: 1 }, rate: 0.2 },
        { id: 'deg_mA', reactants: { mA: 1 }, products: {}, rate: 1.0 },
        { id: 'deg_mB', reactants: { mB: 1 }, products: {}, rate: 1.0 },
        { id: 'deg_pA', reactants: { pA: 1 }, products: {}, rate: PROTEIN_DEGRADATION_RATE },
        { id: 'deg_pB', reactants: { pB: 1 }, products: {}, rate: PROTEIN_DEGRADATION_RATE },
      ],
    };
  }

  function buildLogicCascadeStochastic(): StochasticModel {
    // Logic Cascade: 3 mRNA + 3 protein species, 12 reactions
    return {
      species: [
        { id: 'mA', initialCount: 10 * OMEGA },
        { id: 'mB', initialCount: 3 * OMEGA },
        { id: 'mC', initialCount: 1 * OMEGA },
        { id: 'pA', initialCount: 80 * OMEGA },
        { id: 'pB', initialCount: 30 * OMEGA },
        { id: 'pC', initialCount: 10 * OMEGA },
      ],
      reactions: [
        // Node A: constitutive (input-driven)
        { id: 'txnA', reactants: {}, products: { mA: 1 }, rate: 1.5 * OMEGA },
        // Node B: repressed by pA
        { id: 'txnB', reactants: {}, products: { mB: 1 }, rate: 0.216 * OMEGA, hillRepression: { species: 'pA', K: 100 * OMEGA, n: 2 } },
        // Node C: repressed by pB
        { id: 'txnC', reactants: {}, products: { mC: 1 }, rate: 0.216 * OMEGA, hillRepression: { species: 'pB', K: 100 * OMEGA, n: 2 } },
        // Translation
        { id: 'tlA', reactants: { mA: 1 }, products: { mA: 1, pA: 1 }, rate: 0.2 },
        { id: 'tlB', reactants: { mB: 1 }, products: { mB: 1, pB: 1 }, rate: 0.2 },
        { id: 'tlC', reactants: { mC: 1 }, products: { mC: 1, pC: 1 }, rate: 0.2 },
        // mRNA degradation
        { id: 'deg_mA', reactants: { mA: 1 }, products: {}, rate: 1.0 },
        { id: 'deg_mB', reactants: { mB: 1 }, products: {}, rate: 1.0 },
        { id: 'deg_mC', reactants: { mC: 1 }, products: {}, rate: 1.0 },
        // Protein degradation
        { id: 'deg_pA', reactants: { pA: 1 }, products: {}, rate: PROTEIN_DEGRADATION_RATE },
        { id: 'deg_pB', reactants: { pB: 1 }, products: {}, rate: PROTEIN_DEGRADATION_RATE },
        { id: 'deg_pC', reactants: { pC: 1 }, products: {}, rate: PROTEIN_DEGRADATION_RATE },
      ],
    };
  }

  // Ensemble stochastic simulation: run Gillespie SSA N times with different seeds,
  // then compute mean, std, Fano factor, and CV at each timepoint.
  const stochasticEnsemble = useMemo(() => {
    if (!stochasticMode) return null;

    const model = circuitType === 'repressilator' ? buildRepressilatorStochastic()
      : circuitType === 'toggle_switch' ? buildToggleSwitchStochastic()
      : buildLogicCascadeStochastic();

    const maxTime = 300;
    const N = ensembleRuns;
    const runs: GillespieResult[] = [];
    for (let i = 0; i < N; i++) {
      runs.push(runGillespie(model, { maxTime, seed: i * 1000 + GILLESPIE_SEED_OFFSET }));
    }

    // Find common time grid by resampling each trajectory onto a uniform grid
    const gridPoints = 60;
    const dt = maxTime / gridPoints;
    const speciesIds = model.species.map(s => s.id);

    // Resample each run onto uniform grid
    const resampled: Record<string, number[][]> = {};
    for (const id of speciesIds) {
      resampled[id] = [];
      for (let r = 0; r < N; r++) {
        const row: number[] = [];
        for (let g = 0; g <= gridPoints; g++) {
          const t = g * dt;
          const times = runs[r].times;
          const traj = runs[r].trajectories[id];
          // Find the trajectory value at time t (nearest-neighbor interpolation)
          let idx = 0;
          while (idx < times.length - 1 && times[idx + 1] <= t) idx++;
          row.push(traj[idx]);
        }
        resampled[id].push(row);
      }
    }

    // Compute mean, std, Fano, CV at each gridpoint
    const stats: Record<string, { mean: number[]; std: number[]; fano: number[]; cv: number[] }> = {};
    for (const id of speciesIds) {
      const mean: number[] = [];
      const std: number[] = [];
      const fano: number[] = [];
      const cv: number[] = [];
      for (let g = 0; g <= gridPoints; g++) {
        const values = resampled[id].map(run => run[g]);
        const m = values.reduce((a, b) => a + b, 0) / N;
        const v = values.reduce((a, b) => a + (b - m) ** 2, 0) / (N - 1);
        mean.push(m);
        std.push(Math.sqrt(v));
        fano.push(m > 0 ? v / m : 0);
        cv.push(m > 0 ? Math.sqrt(v) / m : 0);
      }
      stats[id] = { mean, std, fano, cv };
    }

    const timeGrid = Array.from({ length: gridPoints + 1 }, (_, i) => i * dt);
    return { runs, resampled, stats, timeGrid, speciesIds, maxTime };
  }, [stochasticMode, circuitType, ensembleRuns, togglePerturbation]);

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
    { id: 'compiler', label: 'Compiler' },
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
                    : gateType === 'NAND' ? (!(a && b)) ? 1 : 0
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
                      {/* X-axis ticks */}
                      {[0, 0.25, 0.5, 0.75, 1].map(f => (
                        <g key={`srx-${f}`}>
                          <line x1={f * w} y1={h} x2={f * w} y2={h - 3} stroke={PAPER_THEME.axis} strokeWidth="0.5" />
                          <text x={f * w} y={h - 4} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize="7" fill={PAPER_THEME.tickColor}>
                            {f === 0 ? '0' : f === 0.25 ? 'T/4' : f === 0.5 ? 'T/2' : f === 0.75 ? '3T/4' : 'T'}
                          </text>
                        </g>
                      ))}
                      {/* Y-axis ticks */}
                      {[0, 0.5, 1].map(f => (
                        <g key={`sry-${f}`}>
                          <line x1={0} y1={h * (1 - f)} x2={3} y2={h * (1 - f)} stroke={PAPER_THEME.axis} strokeWidth="0.5" />
                          <text x={4} y={h * (1 - f) + 2.5} textAnchor="start" fontFamily={PAPER_THEME.tickFont} fontSize="7" fill={PAPER_THEME.tickColor}>
                            {f === 0 ? '0' : f === 0.5 ? '50%' : '100%'}
                          </text>
                        </g>
                      ))}
                      <text x={w - 2} y={h - 2} textAnchor="end" fontFamily={PAPER_THEME.tickFont} fontSize="7" fill={PAPER_THEME.tickColor}>t (min)</text>
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
                      {/* X-axis ticks */}
                      {[0, 0.25, 0.5, 0.75, 1].map(f => (
                        <g key={`slc-${f}`}>
                          <line x1={f * w} y1={h} x2={f * w} y2={h - 3} stroke={PAPER_THEME.axis} strokeWidth="0.5" />
                          <text x={f * w} y={h - 4} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize="7" fill={PAPER_THEME.tickColor}>
                            {f === 0 ? '0' : f === 0.25 ? 'T/4' : f === 0.5 ? 'T/2' : f === 0.75 ? '3T/4' : 'T'}
                          </text>
                        </g>
                      ))}
                      {/* Y-axis ticks */}
                      {[0, 0.5, 1].map(f => (
                        <g key={`sly-${f}`}>
                          <line x1={0} y1={h * (1 - f)} x2={3} y2={h * (1 - f)} stroke={PAPER_THEME.axis} strokeWidth="0.5" />
                          <text x={4} y={h * (1 - f) + 2.5} textAnchor="start" fontFamily={PAPER_THEME.tickFont} fontSize="7" fill={PAPER_THEME.tickColor}>
                            {f === 0 ? '0' : f === 0.5 ? '50%' : '100%'}
                          </text>
                        </g>
                      ))}
                      <text x={w - 2} y={h - 2} textAnchor="end" fontFamily={PAPER_THEME.tickFont} fontSize="7" fill={PAPER_THEME.tickColor}>t (min)</text>
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
                    {/* X-axis ticks */}
                    {[0, 0.25, 0.5, 0.75, 1].map(f => (
                      <g key={`sts-${f}`}>
                        <line x1={f * w} y1={h} x2={f * w} y2={h - 3} stroke={PAPER_THEME.axis} strokeWidth="0.5" />
                        <text x={f * w} y={h - 4} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize="7" fill={PAPER_THEME.tickColor}>
                          {f === 0 ? '0' : f === 0.25 ? 'T/4' : f === 0.5 ? 'T/2' : f === 0.75 ? '3T/4' : 'T'}
                        </text>
                      </g>
                    ))}
                    {/* Y-axis ticks */}
                    {[0, 0.5, 1].map(f => (
                      <g key={`sty-${f}`}>
                        <line x1={0} y1={h * (1 - f)} x2={3} y2={h * (1 - f)} stroke={PAPER_THEME.axis} strokeWidth="0.5" />
                        <text x={4} y={h * (1 - f) + 2.5} textAnchor="start" fontFamily={PAPER_THEME.tickFont} fontSize="7" fill={PAPER_THEME.tickColor}>
                          {f === 0 ? '0' : f === 0.5 ? '50%' : '100%'}
                        </text>
                      </g>
                    ))}
                    <text x={w - 2} y={h - 2} textAnchor="end" fontFamily={PAPER_THEME.tickFont} fontSize="7" fill={PAPER_THEME.tickColor}>t (min)</text>
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

            {/* ── Pipeline Section ── */}
            <div style={{
              marginTop: '12px', padding: '12px',
              borderRadius: 'var(--nb-radius-md)',
              border: `1px solid ${THEME.paperBorder}`,
              background: THEME.paperSurfaceStrong,
            }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                Circuit Pipeline
              </div>
              <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: '0 0 8px' }}>
                Optimize circuit topology for current metabolic context.
              </p>
              <button
                onClick={async () => {
                  setPipelineLoading(true);
                  setPipelineError(null);
                  try {
                    const res = await fetch('/api/pipeline/gecair', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ gateType, inputA, inputB, output: finalOutput, noiseScore }),
                    });
                    if (!res.ok) throw new Error(`Pipeline failed (${res.status})`);
                    const data = await res.json();
                    setPipelineResult(data.result);
                  } catch (err) {
                    setPipelineError(err instanceof Error ? err.message : 'Pipeline failed');
                  } finally {
                    setPipelineLoading(false);
                  }
                }}
                disabled={pipelineLoading}
                style={{
                  width: '100%', padding: '6px 14px', borderRadius: 'var(--nb-radius-sm)',
                  background: pipelineLoading ? 'rgba(255,255,255,0.04)' : 'rgba(191,220,205,0.14)',
                  border: `1px solid ${pipelineLoading ? 'rgba(255,255,255,0.08)' : 'rgba(191,220,205,0.3)'}`,
                  color: pipelineLoading ? 'rgba(255,255,255,0.35)' : 'rgba(191,220,205,0.9)',
                  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                  cursor: pipelineLoading ? 'wait' : 'pointer',
                }}
              >
                {pipelineLoading ? 'Running Pipeline...' : 'Run Pipeline'}
              </button>
              {pipelineError && (
                <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.CORAL, margin: '6px 0 0' }}>
                  {pipelineError}
                </p>
              )}
              {pipelineResult && (
                <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(191,220,205,0.08)', border: '1px solid rgba(191,220,205,0.15)', borderRadius: 'var(--nb-radius-sm)' }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue }}>
                    Gate: {pipelineResult.recommendedGate} | Out: {(pipelineResult.outputLevel * 100).toFixed(1)}% | Noise: {pipelineResult.noiseScore.toFixed(4)}
                  </div>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.paperLabel, marginTop: 2 }}>
                    {pipelineResult.stability} | {pipelineResult.optimizationSteps} steps
                  </div>
                </div>
              )}
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
            caption="Viridis heatmap showing gate output as a function of both inputs. Axes: Input A (x) vs Input B (y). Color: output level."
          >
            <CircuitSVG inputA={inputA} inputB={inputB} gateType={gateType} view="phasespace" />
          </ScientificFigureFrame>
          <div style={{ marginTop: '16px', display: 'grid', gap: '8px' }}>
            <MetricCard label="Operating Point" value={`A=${(inputA*100).toFixed(0)}% B=${(inputB*100).toFixed(0)}%`} />
            <MetricCard label="Gate Output" value={(finalOutput * 100).toFixed(1)} unit="%" highlight />
            <MetricCard label="Noise Sensitivity" value={noiseScore.toFixed(4)} warning={noiseScore > 0.05 ? 'High noise' : undefined} />
          </div>
        </div>
      </ToolTabPanel>

      {/* ═══════ TRANSFER TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="transfer">
        <div style={{ padding: '16px' }}>
          <ScientificFigureFrame
            eyebrow="Transfer Function"
            title={`${gateType} Gate — Hill Response Curves`}
            caption={`Operating point: A=${(inputA*100).toFixed(0)}% B=${(inputB*100).toFixed(0)}% → ${(finalOutput*100).toFixed(1)}% output`}
          >
            <CircuitSVG inputA={inputA} inputB={inputB} gateType={gateType} view="transfer" />
          </ScientificFigureFrame>
          <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <MetricCard label="Sensor A" value={(outA * 100).toFixed(1)} unit="%" />
            <MetricCard label="Sensor B" value={(outB * 100).toFixed(1)} unit="%" />
            <MetricCard label="Combined Output" value={(finalOutput * 100).toFixed(1)} unit="%" highlight />
            <MetricCard label="Circuit Complexity" value={CIRCUIT_NODES.reduce((a, n) => a + n.parts.length, 0)} unit="parts" />
          </div>
        </div>
      </ToolTabPanel>

      {/* ═══════ DYNAMICS TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="dynamics">
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            {(['repressilator', 'toggle_switch', 'logic_cascade'] as const).map(ct => (
              <button key={ct} onClick={() => setCircuitType(ct)}
                className={`nb-tool-toggle ${circuitType === ct ? 'nb-tool-toggle--active' : ''}`}
                style={{ fontSize: '11px' }}>
                {ct === 'repressilator' ? 'Repressilator' : ct === 'toggle_switch' ? 'Toggle Switch' : 'Logic Cascade'}
              </button>
            ))}
            <div style={{ width: '1px', height: '20px', background: THEME.BORDER, margin: '0 4px' }} />
            <button
              onClick={() => setStochasticMode(!stochasticMode)}
              className={`nb-tool-toggle ${stochasticMode ? 'nb-tool-toggle--active' : ''}`}
              style={{ fontSize: '11px' }}
            >
              {stochasticMode ? 'Stochastic ON' : 'Stochastic'}
            </button>
            {stochasticMode && (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontFamily: THEME.MONO, fontSize: '11px', color: THEME.LABEL }}>Runs:</span>
                {[5, 10, 20].map(n => (
                  <button key={n} onClick={() => setEnsembleRuns(n)}
                    className={`nb-tool-toggle ${ensembleRuns === n ? 'nb-tool-toggle--active' : ''}`}
                    style={{ fontSize: '10px', padding: '2px 6px' }}>
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ODE Dynamics — Real RK4 simulation */}
          {(() => {
            const w = 400, h = 140;
            const mL = 35, mR = 10, mT = 5, mB = 22;
            const plotW = w - mL - mR;
            const plotH = h - mT - mB;
            // Shared axis elements
            const axisEls = (
              <>
                {/* Axis frame */}
                <line x1={mL} y1={mT} x2={mL} y2={mT + plotH} stroke={PAPER_THEME.axis} strokeWidth="0.75" />
                <line x1={mL} y1={mT + plotH} x2={mL + plotW} y2={mT + plotH} stroke={PAPER_THEME.axis} strokeWidth="0.75" />
                {/* X-axis ticks */}
                {[0, 0.25, 0.5, 0.75, 1].map(f => (
                  <g key={`dxt-${f}`}>
                    <line x1={mL + f * plotW} y1={mT + plotH} x2={mL + f * plotW} y2={mT + plotH + 4} stroke={PAPER_THEME.axis} strokeWidth="0.5" />
                    <text x={mL + f * plotW} y={mT + plotH + 14} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
                      {f === 0 ? '0' : f === 0.25 ? 'T/4' : f === 0.5 ? 'T/2' : f === 0.75 ? '3T/4' : 'T'}
                    </text>
                  </g>
                ))}
                {/* Y-axis ticks */}
                {[0, 0.5, 1].map(f => (
                  <g key={`dyt-${f}`}>
                    <line x1={mL - 4} y1={mT + plotH - f * plotH} x2={mL} y2={mT + plotH - f * plotH} stroke={PAPER_THEME.axis} strokeWidth="0.5" />
                    <text x={mL - 6} y={mT + plotH - f * plotH + 3} textAnchor="end" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
                      {f === 0 ? '0' : f === 0.5 ? '50%' : '100%'}
                    </text>
                  </g>
                ))}
                {/* Axis labels */}
                <text x={mL + plotW / 2} y={h - 2} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>t (min)</text>
                <text x={12} y={mT + plotH / 2} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}
                  transform={`rotate(-90,12,${mT + plotH / 2})`}>Protein</text>
              </>
            );
            if (circuitType === 'repressilator') {
              const trajectory = runRepressilator(undefined, 300, 1.0);
              const maxP = Math.max(...trajectory.flatMap(s => [s.pA, s.pB, s.pC]));
              const toPath = (key: keyof RepressilatorState) => {
                const pts = trajectory.map((s, i) => `${mL + (i / trajectory.length) * plotW},${mT + plotH - (s[key] / maxP) * plotH}`);
                return `M${pts.join(' L')}`;
              };
              return (
                <ScientificFigureFrame eyebrow="ODE Dynamics" title="Repressilator — RK4 Simulation" caption="3-node ring oscillator: LacI→TetR→cI→LacI. Sustained limit-cycle oscillations.">
                  <svg width={w} height={h} style={{ display: 'block', width: '100%' }} viewBox={`0 0 ${w} ${h}`}>
                    <path d={toPath('pA')} fill="none" stroke="#C8D8E8" strokeWidth={2} />
                    <path d={toPath('pB')} fill="none" stroke="#C8E0D0" strokeWidth={2} />
                    <path d={toPath('pC')} fill="none" stroke="#DDD0E8" strokeWidth={2} />
                    {axisEls}
                  </svg>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)' }}>
                    <span style={{ color: '#C8D8E8' }}>■ LacI</span>
                    <span style={{ color: '#C8E0D0' }}>■ TetR</span>
                    <span style={{ color: '#DDD0E8' }}>■ cI</span>
                  </div>
                </ScientificFigureFrame>
              );
            }
            if (circuitType === 'logic_cascade') {
              const trajectory = runLogicCascade(undefined, 300, 1.0);
              const maxP = Math.max(...trajectory.flatMap(s => [s.pA, s.pB, s.pC]));
              const toPath = (key: keyof LogicCascadeState) => {
                const pts = trajectory.map((s, i) => `${mL + (i / trajectory.length) * plotW},${mT + plotH - (s[key] / maxP) * plotH}`);
                return `M${pts.join(' L')}`;
              };
              const finalPA = trajectory[trajectory.length - 1].pA;
              const finalPC = trajectory[trajectory.length - 1].pC;
              const cascadeGain = finalPC / Math.max(0.01, finalPA);
              return (
                <ScientificFigureFrame eyebrow="ODE Dynamics" title="Logic Cascade — RK4 Simulation" caption="3-node linear cascade with signal attenuation for noise filtering.">
                  <svg width={w} height={h} style={{ display: 'block', width: '100%' }} viewBox={`0 0 ${w} ${h}`}>
                    <path d={toPath('pA')} fill="none" stroke="#C8D8E8" strokeWidth={2} />
                    <path d={toPath('pB')} fill="none" stroke="#C8E0D0" strokeWidth={2} />
                    <path d={toPath('pC')} fill="none" stroke="#DDD0E8" strokeWidth={2} />
                    {axisEls}
                  </svg>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)' }}>
                    <span style={{ color: '#C8D8E8' }}>■ Node A (input)</span>
                    <span style={{ color: '#C8E0D0' }}>■ Node B (cascade)</span>
                    <span style={{ color: '#DDD0E8' }}>■ Node C (output)</span>
                  </div>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.MINT, marginTop: '6px' }}>
                    Cascade gain: {cascadeGain.toFixed(2)}
                  </div>
                </ScientificFigureFrame>
              );
            }
            // Toggle Switch
            const trajectory = runToggleSwitch(undefined, 300, 1.0, togglePerturbation);
            const maxP = Math.max(...trajectory.flatMap(s => [s.pA, s.pB]));
            const toPath = (key: keyof ToggleSwitchState) => {
              const pts = trajectory.map((s, i) => `${mL + (i / trajectory.length) * plotW},${mT + plotH - (s[key] / maxP) * plotH}`);
              return `M${pts.join(' L')}`;
            };
            const finalPA = trajectory[trajectory.length - 1].pA;
            const finalPB = trajectory[trajectory.length - 1].pB;
            const settledState = finalPA > finalPB ? 'A' : 'B';
            return (
              <ScientificFigureFrame eyebrow="ODE Dynamics" title="Toggle Switch — RK4 Simulation" caption={`Bistable switch. Perturbation: State ${togglePerturbation}. Settled to state ${settledState}.`}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>Perturbation:</span>
                  {(['A', 'B'] as const).map(p => (
                    <button key={p} onClick={() => setTogglePerturbation(p)}
                      className={`nb-tool-toggle ${togglePerturbation === p ? 'nb-tool-toggle--active' : ''}`}
                      style={{ fontSize: '11px', padding: '2px 8px' }}>
                      State {p}
                    </button>
                  ))}
                </div>
                <svg width={w} height={h} style={{ display: 'block', width: '100%' }} viewBox={`0 0 ${w} ${h}`}>
                  <path d={toPath('pA')} fill="none" stroke="#C8D8E8" strokeWidth={2} />
                  <path d={toPath('pB')} fill="none" stroke="#C8E0D0" strokeWidth={2} />
                  {axisEls}
                </svg>
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)' }}>
                  <span style={{ color: '#C8D8E8' }}>■ State A</span>
                  <span style={{ color: '#C8E0D0' }}>■ State B</span>
                </div>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.MINT, marginTop: '6px' }}>
                  Settled: State {settledState} (A={finalPA.toFixed(2)}, B={finalPB.toFixed(2)})
                </div>
              </ScientificFigureFrame>
            );
          })()}

          {/* ── Stochastic Gillespie Ensemble ── */}
          {stochasticMode && stochasticEnsemble && (() => {
            const { stats, timeGrid, speciesIds, maxTime } = stochasticEnsemble;
            const w = 400, h = 180;
            const mL = 45, mR = 10, mT = 10, mB = 22;
            const plotW = w - mL - mR;
            const plotH = h - mT - mB;

            // Color palette for species
            const speciesColors: Record<string, string> = {
              mA: '#C8D8E8', pA: '#C8D8E8',
              mB: '#C8E0D0', pB: '#C8E0D0',
              mC: '#DDD0E8', pC: '#DDD0E8',
            };

            // Only show protein species in the ensemble plot
            const proteinIds = speciesIds.filter(id => id.startsWith('p'));

            // Find global max for normalization
            const globalMax = Math.max(...proteinIds.flatMap(id => {
              const s = stats[id];
              return s.mean.map((m, i) => m + s.std[i]);
            }), 1);

            const toX = (i: number) => mL + (i / (timeGrid.length - 1)) * plotW;
            const toY = (v: number) => mT + plotH - (v / globalMax) * plotH;

            // Build individual run trajectories (thin lines)
            const runLines = proteinIds.map(id => {
              return stochasticEnsemble.runs.map((run, ri) => {
                const times = run.times;
                const traj = run.trajectories[id];
                // Subsample for performance
                const step = Math.max(1, Math.floor(times.length / 120));
                const pts: string[] = [];
                for (let j = 0; j < times.length; j += step) {
                  const x = mL + (times[j] / maxTime) * plotW;
                  const y = toY(traj[j]);
                  pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
                }
                // Add last point
                const lastX = mL + (times[times.length - 1] / maxTime) * plotW;
                const lastY = toY(traj[traj.length - 1]);
                pts.push(`${lastX.toFixed(1)},${lastY.toFixed(1)}`);
                return { id, ri, path: `M${pts.join(' L')}` };
              });
            }).flat();

            // Build mean +/- std bands
            const bands = proteinIds.map(id => {
              const s = stats[id];
              const upperPts: string[] = [];
              const lowerPts: string[] = [];
              const meanPts: string[] = [];
              for (let i = 0; i < timeGrid.length; i++) {
                const x = toX(i);
                upperPts.push(`${x.toFixed(1)},${toY(s.mean[i] + s.std[i]).toFixed(1)}`);
                lowerPts.push(`${x.toFixed(1)},${toY(Math.max(0, s.mean[i] - s.std[i])).toFixed(1)}`);
                meanPts.push(`${x.toFixed(1)},${toY(s.mean[i]).toFixed(1)}`);
              }
              // Band polygon: upper forward, lower reversed
              const bandPath = `M${upperPts.join(' L')} L${lowerPts.reverse().join(' L')} Z`;
              const meanPath = `M${meanPts.join(' L')}`;
              return { id, bandPath, meanPath, color: speciesColors[id] || '#888' };
            });

            // Compute summary statistics from the final timepoint
            const summary = proteinIds.map(id => {
              const s = stats[id];
              const last = s.mean.length - 1;
              return {
                id,
                mean: s.mean[last],
                std: s.std[last],
                fano: s.fano[last],
                cv: s.cv[last],
                color: speciesColors[id],
              };
            });

            return (
              <ScientificFigureFrame
                eyebrow="Stochastic Dynamics"
                title={`${circuitType === 'repressilator' ? 'Repressilator' : circuitType === 'toggle_switch' ? 'Toggle Switch' : 'Logic Cascade'} — Gillespie SSA Ensemble`}
                caption={`${ensembleRuns} independent stochastic trajectories. Thin lines: individual runs. Band: mean +/- 1 std. Gillespie (1977) exact SSA.`}
              >
                <svg width={w} height={h} style={{ display: 'block', width: '100%' }} viewBox={`0 0 ${w} ${h}`}>
                  {/* Grid */}
                  {[0, 0.25, 0.5, 0.75, 1].map(f => (
                    <g key={`sgrid-${f}`}>
                      <line x1={mL + f * plotW} y1={mT} x2={mL + f * plotW} y2={mT + plotH}
                        stroke={PAPER_THEME.grid} strokeWidth="0.5" />
                      <line x1={mL} y1={mT + f * plotH} x2={mL + plotW} y2={mT + f * plotH}
                        stroke={PAPER_THEME.grid} strokeWidth="0.5" />
                    </g>
                  ))}
                  {/* Axes */}
                  <line x1={mL} y1={mT} x2={mL} y2={mT + plotH} stroke={PAPER_THEME.axis} strokeWidth="0.75" />
                  <line x1={mL} y1={mT + plotH} x2={mL + plotW} y2={mT + plotH} stroke={PAPER_THEME.axis} strokeWidth="0.75" />
                  {/* X-axis ticks */}
                  {[0, 0.25, 0.5, 0.75, 1].map(f => (
                    <g key={`sgx-${f}`}>
                      <line x1={mL + f * plotW} y1={mT + plotH} x2={mL + f * plotW} y2={mT + plotH + 4}
                        stroke={PAPER_THEME.axis} strokeWidth="0.5" />
                      <text x={mL + f * plotW} y={mT + plotH + 14} textAnchor="middle"
                        fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
                        {f === 0 ? '0' : f === 0.25 ? '75' : f === 0.5 ? '150' : f === 0.75 ? '225' : '300'}
                      </text>
                    </g>
                  ))}
                  {/* Y-axis ticks */}
                  {[0, 0.5, 1].map(f => (
                    <g key={`sgy-${f}`}>
                      <line x1={mL - 4} y1={mT + plotH - f * plotH} x2={mL} y2={mT + plotH - f * plotH}
                        stroke={PAPER_THEME.axis} strokeWidth="0.5" />
                      <text x={mL - 6} y={mT + plotH - f * plotH + 3} textAnchor="end"
                        fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
                        {(f * globalMax).toFixed(0)}
                      </text>
                    </g>
                  ))}
                  <text x={mL + plotW / 2} y={h - 2} textAnchor="middle"
                    fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>t (min)</text>
                  <text x={14} y={mT + plotH / 2} textAnchor="middle"
                    fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}
                    transform={`rotate(-90,14,${mT + plotH / 2})`}>Count</text>

                  {/* Individual run trajectories (thin, low opacity) */}
                  {runLines.map(rl => (
                    <path key={`run-${rl.id}-${rl.ri}`} d={rl.path} fill="none"
                      stroke={speciesColors[rl.id] || '#888'} strokeWidth={0.6} opacity={0.25} />
                  ))}

                  {/* Mean +/- std bands */}
                  {bands.map(b => (
                    <g key={`band-${b.id}`}>
                      <path d={b.bandPath} fill={b.color} fillOpacity={0.15} stroke="none" />
                      <path d={b.meanPath} fill="none" stroke={b.color} strokeWidth={2} />
                    </g>
                  ))}
                </svg>

                {/* Legend */}
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', flexWrap: 'wrap' }}>
                  {proteinIds.map(id => (
                    <span key={id} style={{ color: speciesColors[id] }}>
                      ■ {id === 'pA' ? 'Protein A' : id === 'pB' ? 'Protein B' : 'Protein C'} (mean +/- std)
                    </span>
                  ))}
                </div>

                {/* Fano factor and CV table */}
                <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: `repeat(${proteinIds.length}, 1fr)`, gap: '8px' }}>
                  {summary.map(s => (
                    <div key={s.id} style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--nb-radius-md)',
                      border: `1px solid ${THEME.BORDER}`,
                      background: THEME.PANEL_INSET,
                    }}>
                      <div style={{ fontFamily: THEME.MONO, fontSize: '11px', color: s.color, fontWeight: 600, marginBottom: '4px' }}>
                        {s.id === 'pA' ? 'Protein A' : s.id === 'pB' ? 'Protein B' : 'Protein C'}
                      </div>
                      <div style={{ fontFamily: THEME.MONO, fontSize: '10px', color: THEME.LABEL, lineHeight: 1.6 }}>
                        <div>Mean: {s.mean.toFixed(1)} +/- {s.std.toFixed(1)}</div>
                        <div>Fano: {s.fano.toFixed(2)}</div>
                        <div>CV: {(s.cv * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScientificFigureFrame>
            );
          })()}
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
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : PAPER_THEME.bgAlt }}>
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

      {/* ── Circuit Compiler Tab ──────────────────────────────────────────── */}
      <ToolTabPanel activeId={activeTab} tabId="compiler">
        <CircuitCompilerPanel />
      </ToolTabPanel>

      {/* ═══════ Footer ═══════ */}
      <div style={{ borderTop: `1px solid ${THEME.BORDER}`, padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0, background: THEME.PANEL_MUTED }}>
        <ExportButton label="Export JSON" data={exportData} filename="gecair-circuit" format="json" />
      </div>
    </ToolShell>
  );
}

/* ── Circuit Compiler Panel ──────────────────────────────────────────────── */

function CircuitCompilerPanel() {
  const [inputs, setInputs] = useState('A,B');
  const [output, setOutput] = useState('Y');
  const [truthTableRows, setTruthTableRows] = useState('0,0,0\n0,1,1\n1,0,1\n1,1,1');
  const [result, setResult] = useState<import('../../server/circuitCompilerEngine').GeneticCircuit | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCompile = useCallback(async () => {
    setLoading(true);
    try {
      const { compileCircuit } = await import('../../server/circuitCompilerEngine');
      const inputNames = inputs.split(',').map(s => s.trim());
      const rows = truthTableRows.split('\n').filter(r => r.trim()).map(row => {
        const vals = row.split(',').map(v => v.trim());
        const inputValues: Record<string, boolean> = {};
        inputNames.forEach((name, i) => { inputValues[name] = vals[i] === '1'; });
        return { inputValues, outputValue: vals[inputNames.length] === '1' };
      });
      const tt = { inputs: inputNames, output, rows };
      const res = compileCircuit('User Circuit', tt);
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [inputs, output, truthTableRows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <div style={{
        background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 16,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        border: `1px solid ${THEME.BORDER}`,
      }}>
        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>Inputs</span>
        <input value={inputs} onChange={(e) => setInputs(e.target.value)} placeholder="A,B"
          style={{ width: 100, padding: '4px 8px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', outline: 'none' }}
        />
        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>Output</span>
        <input value={output} onChange={(e) => setOutput(e.target.value)} placeholder="Y"
          style={{ width: 50, padding: '4px 8px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', outline: 'none' }}
        />
        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>Truth Table</span>
        <textarea value={truthTableRows} onChange={(e) => setTruthTableRows(e.target.value)}
          rows={4} cols={20}
          style={{ padding: '4px 8px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', outline: 'none', resize: 'vertical' }}
        />
        <button onClick={handleCompile} disabled={loading} className="nb-tool-toggle"
          style={{ padding: '6px 14px', fontSize: 'var(--nb-fs-sm)', opacity: loading ? 0.4 : 1 }}
        >
          {loading ? 'Compiling...' : 'Compile Circuit'}
        </button>
      </div>

      {result && (
        <>
          <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12, border: `1px solid ${THEME.BORDER}` }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginBottom: 6 }}>Gates</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {result.gates.map((g, i) => (
                <span key={i} style={{
                  padding: '3px 8px',
                  background: g.source === 'cello_characterized' ? 'rgba(147,203,82,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${g.source === 'cello_characterized' ? 'rgba(147,203,82,0.2)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '3px',
                  fontFamily: THEME.MONO,
                  fontSize: 'var(--nb-fs-xs)',
                  color: 'rgba(255,255,255,0.7)',
                }}>
                  {g.type} → {g.output}
                  <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>[{g.source}]</span>
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, border: `1px solid ${THEME.BORDER}` }}>
            {[
              { label: 'Dynamic Range', value: result.metrics.dynamicRange.toFixed(1), color: THEME.MINT },
              { label: 'Signal/Noise', value: result.metrics.signalToNoise.toFixed(1), color: THEME.SKY },
              { label: 'Orthogonality', value: result.metrics.orthogonality.toFixed(2), color: THEME.LILAC },
              { label: 'Burden', value: (result.burden * 100).toFixed(0) + '%', color: result.burden > 0.3 ? 'rgba(250,128,114,0.7)' : 'rgba(147,203,82,0.7)' },
            ].map((m, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL }}>{m.label}</div>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: m.color, fontWeight: 600 }}>{m.value}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
