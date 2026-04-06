'use client';
import { useState, useMemo, useCallback, useEffect } from 'react';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import { FITNESS_LANDSCAPE, generateEvolutionTrajectory, STARTING_SEQUENCE } from '../../data/mockProEvol';
import type { FitnessPoint } from '../../types';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { T } from '../ide/tokens';
import WorkbenchInlineContext from '../workbench/WorkbenchInlineContext';
import ScientificHero from './shared/ScientificHero';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import ScientificMethodStrip from './shared/ScientificMethodStrip';

// Dark theme tokens
const PANEL_BG = PATHD_THEME.sepiaPanelMuted;
const BORDER = PATHD_THEME.paperBorder;
const LABEL = PATHD_THEME.paperLabel;
const VALUE = PATHD_THEME.paperValue;
const INPUT_BG = PATHD_THEME.paperSurfaceStrong;
const INPUT_BORDER = PATHD_THEME.paperBorder;
const INPUT_TEXT = PATHD_THEME.paperValue;

function viridisColor(t: number): string {
  const stops: [number, number, number][] = [
    [68, 1, 84], [49, 104, 142], [53, 183, 121], [144, 215, 67], [253, 231, 37],
  ];
  const scaled = Math.max(0, Math.min(1, t)) * 4;
  const lo = Math.floor(scaled), hi = Math.min(4, lo + 1), f = scaled - lo;
  const [r1, g1, b1] = stops[lo], [r2, g2, b2] = stops[hi];
  return `rgb(${Math.round(r1 + (r2 - r1) * f)},${Math.round(g1 + (g2 - g1) * f)},${Math.round(b1 + (b2 - b1) * f)})`;
}

function FitnessHeatmap({ trajectory }: { trajectory: FitnessPoint[] }) {
  const CELL = 16;
  const N = 20;
  const W = 430;
  const H = 470;
  const LAND_H = 250;
  const TRACE_TOP = 304;
  const TRACE_H = 120;
  const tracePadX = 42;
  const tracePadY = 18;
  const heatX = 36;
  const heatY = 38;

  const lastPt = trajectory[trajectory.length - 1];
  const bestFitness = Math.max(...trajectory.map((point) => point.fitness), 0);
  const bestStep = trajectory.findIndex((point) => point.fitness === bestFitness);
  let basinX = 0;
  let basinY = 0;
  let basinValue = -1;
  FITNESS_LANDSCAPE.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value > basinValue) {
        basinValue = value;
        basinX = x;
        basinY = y;
      }
    });
  });

  // Compute contour segments (simplified marching squares)
  const CONTOUR_LEVELS = [0.2, 0.4, 0.6, 0.8];
  const contourSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  CONTOUR_LEVELS.forEach(level => {
    FITNESS_LANDSCAPE.forEach((row, y) => {
      row.forEach((v, x) => {
        const above = v >= level;
        if (x + 1 < row.length && (row[x + 1] >= level) !== above) {
          contourSegments.push({
            x1: heatX + (x + 1) * CELL, y1: heatY + y * CELL,
            x2: heatX + (x + 1) * CELL, y2: heatY + (y + 1) * CELL,
          });
        }
        if (y + 1 < FITNESS_LANDSCAPE.length && (FITNESS_LANDSCAPE[y + 1][x] >= level) !== above) {
          contourSegments.push({
            x1: heatX + x * CELL,       y1: heatY + (y + 1) * CELL,
            x2: heatX + (x + 1) * CELL, y2: heatY + (y + 1) * CELL,
          });
        }
      });
    });
  });

  const pathPoints = trajectory.map((point, index) => {
    const x = tracePadX + (index / Math.max(trajectory.length - 1, 1)) * (W - tracePadX * 2);
    const y = TRACE_TOP + TRACE_H - tracePadY - point.fitness * (TRACE_H - tracePadY * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} rx={14} fill="#05070b" />
      <rect x={22} y={24} width={W - 44} height={LAND_H} rx={14} fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.06)" />
      <text x={36} y={18} fontFamily={T.SANS} fontSize="9" fill={LABEL} letterSpacing="0.12em">
        FITNESS LANDSCAPE
      </text>
      <text x={36} y={30} fontFamily={T.SANS} fontSize="11" fill={VALUE}>
        Sequence ruggedness map with adaptive basin and realized fitness trace
      </text>

      {FITNESS_LANDSCAPE.map((row, y) =>
        row.map((v, x) => (
          <rect key={`${x}-${y}`}
            x={heatX + x * CELL} y={heatY + y * CELL}
            width={CELL - 1} height={CELL - 1}
            fill={viridisColor(v)} fillOpacity={0.9}
          />
        ))
      )}
      {contourSegments.map((seg, i) => (
        <line key={`cs-${i}`}
          x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
          stroke="rgba(255,255,255,0.35)" strokeWidth={0.8}
        />
      ))}

      <rect
        x={heatX + basinX * CELL - 3}
        y={heatY + basinY * CELL - 3}
        width={CELL + 5}
        height={CELL + 5}
        rx={5}
        fill="none"
        stroke="rgba(255,255,255,0.86)"
        strokeWidth={1.4}
      />
      <text x={heatX + basinX * CELL + CELL / 2} y={heatY + basinY * CELL - 8} textAnchor="middle" fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.82)">
        best basin
      </text>

      <rect x={22} y={TRACE_TOP} width={W - 44} height={TRACE_H + 26} rx={14} fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.06)" />
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
        const y = TRACE_TOP + TRACE_H - tracePadY - tick * (TRACE_H - tracePadY * 2);
        return (
          <g key={`tick-${tick}`}>
            <line x1={tracePadX} y1={y} x2={W - tracePadX} y2={y} stroke="rgba(255,255,255,0.05)" />
            <text x={tracePadX - 8} y={y + 3} textAnchor="end" fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.3)">
              {tick.toFixed(2)}
            </text>
          </g>
        );
      })}
      <polyline points={pathPoints} fill="none" stroke="rgba(147,203,82,0.9)" strokeWidth={2.2} />
      <line
        x1={tracePadX}
        y1={TRACE_TOP + TRACE_H - tracePadY - basinValue * (TRACE_H - tracePadY * 2)}
        x2={W - tracePadX}
        y2={TRACE_TOP + TRACE_H - tracePadY - basinValue * (TRACE_H - tracePadY * 2)}
        stroke="rgba(255,255,255,0.16)"
        strokeDasharray="5 4"
      />
      {trajectory.map((point, index) => {
        const x = tracePadX + (index / Math.max(trajectory.length - 1, 1)) * (W - tracePadX * 2);
        const y = TRACE_TOP + TRACE_H - tracePadY - point.fitness * (TRACE_H - tracePadY * 2);
        const isLead = index === bestStep;
        const isCurrent = index === trajectory.length - 1;
        return (
          <g key={`pt-${index}`}>
            <circle cx={x} cy={y} r={isLead || isCurrent ? 4 : 2.7} fill={isLead ? '#F0FDFA' : isCurrent ? '#FF8B1F' : 'rgba(147,203,82,0.68)'} />
            {(isLead || isCurrent) && (
              <text
                x={x}
                y={y - 8}
                textAnchor="middle"
                fontFamily={T.MONO}
                fontSize="7"
                fill={isLead ? 'rgba(240,253,250,0.88)' : 'rgba(255,139,31,0.88)'}
              >
                {isLead ? 'lead' : 'current'}
              </text>
            )}
          </g>
        );
      })}
      <text x={tracePadX} y={TRACE_TOP + 14} fontFamily={T.MONO} fontSize="7" fill={LABEL}>Fitness trace</text>
      <text x={W - tracePadX} y={TRACE_TOP + 14} textAnchor="end" fontFamily={T.MONO} fontSize="7" fill={LABEL}>
        best achievable {basinValue.toFixed(3)}
      </text>
      <text x={W / 2} y={H - 12} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.26)">
        Accepted evolution checkpoints
      </text>
      <defs>
        <linearGradient id="fitScale" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={viridisColor(1)} />
          <stop offset="25%"  stopColor={viridisColor(0.75)} />
          <stop offset="50%"  stopColor={viridisColor(0.5)} />
          <stop offset="75%"  stopColor={viridisColor(0.25)} />
          <stop offset="100%" stopColor={viridisColor(0)} />
        </linearGradient>
      </defs>
      <rect x={W - 48} y={48} width={12} height={130} fill="url(#fitScale)" rx={4} />
      <text x={W - 30} y={54} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.4)">1.0</text>
      <text x={W - 30} y={178} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.4)">0.0</text>
      <text x={W - 48} y={194} fontFamily={T.SANS} fontSize="9" fill="rgba(255,255,255,0.3)">Fitness</text>
      <text x={heatX + 72} y={LAND_H + 16} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.26)">
        Mutational coordinate X
      </text>
      <text x={22} y={LAND_H / 2 + 10} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.26)"
        transform={`rotate(-90,22,${LAND_H / 2 + 10})`}>
        Mutational coordinate Y
      </text>
      <text x={W - 42} y={TRACE_TOP + TRACE_H + 18} textAnchor="end" fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.28)">
        {lastPt ? `${lastPt.mutationCount} accepted rounds` : '0 accepted rounds'}
      </text>
    </svg>
  );
}

function ParamSlider({ label, value, min, max, step = 1, onChange, unit }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL }}>{label}</span>
        <span style={{ fontFamily: T.MONO, fontSize: '11px', color: VALUE }}>{value}{unit}</span>
      </div>
      <input aria-label="Parameter slider" type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'rgba(120,180,255,0.8)', cursor: 'pointer' }} />
    </div>
  );
}

export default function ProEvolPage() {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const catalystPayload = useWorkbenchStore((s) => s.toolPayloads.catdes);
  const cethxPayload = useWorkbenchStore((s) => s.toolPayloads.cethx);
  const fbaPayload = useWorkbenchStore((s) => s.toolPayloads.fbasim);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);
  const [mutationRate, setMutationRate] = useState(5);
  const [rounds, setRounds] = useState(100);
  const [running, setRunning] = useState(false);
  const [trajectory, setTrajectory] = useState<FitnessPoint[]>([{ mutationCount: 0, fitness: 0.08, sequence: STARTING_SEQUENCE.slice(0, 20) + '...' }]);
  const recommendedMutationRate = useMemo(() => {
    const rate = 4
      + (catalystPayload?.result.topMutationSites ?? 2) * 0.9
      + (cethxPayload?.result.efficiency ?? 0) / 35;
    return Math.min(20, Math.max(1, Math.round(rate)));
  }, [catalystPayload?.result.topMutationSites, cethxPayload?.result.efficiency]);
  const recommendedRounds = useMemo(() => {
    const depth = 80
      + (fbaPayload?.result.carbonEfficiency ?? 40)
      + (catalystPayload?.result.bestCAI ?? 0.6) * 60;
    return Math.min(500, Math.max(20, Math.round(depth / 10) * 10));
  }, [catalystPayload?.result.bestCAI, fbaPayload?.result.carbonEfficiency]);

  const run = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const traj = generateEvolutionTrajectory(mutationRate / 100, rounds);
      setTrajectory(traj);
      setRunning(false);
    }, 0);
  }, [mutationRate, rounds]);

  useEffect(() => {
    setMutationRate(recommendedMutationRate);
    setRounds(recommendedRounds);
    setTrajectory(generateEvolutionTrajectory(recommendedMutationRate / 100, recommendedRounds));
    setRunning(false);
  }, [recommendedMutationRate, recommendedRounds]);

  const bestFitness = useMemo(() => Math.max(...trajectory.map(p => p.fitness)), [trajectory]);
  const beneficialMutations = useMemo(() =>
    trajectory.filter((p, i) => i > 0 && p.fitness > trajectory[i - 1].fitness).length,
    [trajectory]
  );
  const bestSequence = useMemo(() =>
    trajectory.find(p => p.fitness === bestFitness)?.sequence ?? '',
    [trajectory, bestFitness]
  );
  const diversityIndex = useMemo(
    () => (trajectory.length > 1 ? (new Set(trajectory.map((point) => Math.round(point.fitness * 100))).size / trajectory.length) : 0),
    [trajectory],
  );
  const figureMeta = useMemo(() => ({
    eyebrow: 'Evolution landscape',
    title: 'Adaptive search is framed as a lead-candidate figure, not a simulator chart',
    caption: 'The ruggedness map, accepted path, best basin, and current winning sequence are read together so the scientist can decide whether directed evolution is still earning its place in the pipeline.',
  }), []);

  useEffect(() => {
    setToolPayload('proevol', {
      toolId: 'proevol',
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
      sourceArtifactId: analyzeArtifact?.id,
      mutationRate,
      rounds,
      result: {
        bestFitness,
        beneficialMutations,
        trajectoryLength: trajectory.length,
        bestSequence,
      },
      updatedAt: Date.now(),
    });
  }, [
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    bestFitness,
    bestSequence,
    beneficialMutations,
    mutationRate,
    project?.targetProduct,
    project?.title,
    rounds,
    setToolPayload,
    trajectory.length,
  ]);

  return (
    <>
      <div className="nb-tool-page" style={{ background: PANEL_BG }}>
        <AlgorithmInsight
          title="Directed Evolution Simulator"
          description="Monte Carlo sampling traverses the fitness landscape via Metropolis criterion. Accepts unfavorable mutations with probability e^(ΔF/T)."
          formula="P(accept) = min(1, e^(ΔF/kT))"
        />

        <div style={{ padding: '0 16px 10px' }}>
          <ScientificHero
            eyebrow="Stage 2 · Directed Evolution"
            title="Evolution search guided by current pathway pressure"
            summary="PROEVOL is no longer just a heatmap explorer. Mutation rate, rounds, beneficial hits, and best sequence are surfaced as a proper optimization story so the researcher can judge whether this enzyme is improving fast enough to deserve another iteration."
            aside={
              <>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Search policy
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '13px', color: PATHD_THEME.value, fontWeight: 700 }}>
                  {mutationRate}% mutation rate · {rounds} rounds
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.55 }}>
                  Search depth is already being seeded by catalyst and flux context, so evolution is tied to pathway need instead of arbitrary exploration.
                </div>
              </>
            }
            signals={[
              {
                label: 'Best Fitness',
                value: bestFitness.toFixed(4),
                detail: `Trajectory length ${trajectory.length} with ${beneficialMutations} beneficial steps`,
                tone: bestFitness > 0.6 ? 'cool' : 'warm',
              },
              {
                label: 'Beneficial Steps',
                value: `${beneficialMutations}`,
                detail: beneficialMutations > 10 ? 'The search is finding productive moves frequently enough to justify continued evolution.' : 'Improvement is sparse; consider redesigning mutational scope.',
                tone: beneficialMutations > 10 ? 'cool' : 'warm',
              },
              {
                label: 'Best Sequence',
                value: bestSequence.slice(0, 16) || 'Pending',
                detail: bestSequence ? 'The current lead sequence remains visible as the working evolutionary winner.' : 'No winner sequence recorded yet.',
                tone: 'neutral',
              },
              {
                label: 'Landscape Pressure',
                value: `${recommendedMutationRate}% recommended`,
                detail: `${recommendedRounds} recommended rounds derived from upstream catalyst and flux context`,
                tone: 'neutral',
              },
            ]}
          />
        </div>

        <div style={{ padding: '0 16px 10px' }}>
          <ScientificMethodStrip
            label="Evolution bench"
            items={[
              {
                title: 'Search policy',
                detail: 'Mutation rate and search depth are derived from catalyst and pathway pressure so exploration starts from the current engineering context.',
                accent: PATHD_THEME.apricot,
                note: `${mutationRate}% mutation · ${rounds} rounds`,
              },
              {
                title: 'Landscape figure',
                detail: 'The main canvas reads like a publication panel: basin geometry, accepted path, and lead checkpoint are exposed together.',
                accent: PATHD_THEME.sky,
                note: `${trajectory.length} accepted checkpoints`,
              },
              {
                title: 'Lead sequence',
                detail: 'Winning sequence and diversity stay visible as evidence, so improvement can be judged against exploration breadth rather than raw score alone.',
                accent: PATHD_THEME.mint,
                note: `${beneficialMutations} beneficial steps`,
              },
            ]}
          />
        </div>

        <div className="nb-tool-panels" style={{ flex: 1 }}>
          {/* Input panel */}
          <div className="nb-tool-sidebar" style={{ width: '240px', borderRight: `1px solid ${BORDER}`, background: PANEL_BG }}>
            <WorkbenchInlineContext
              toolId="proevol"
              title="Protein Evolution Simulator"
              summary="Push enzyme candidates from Analyze into directed-evolution hypotheses so mutation rounds stay connected to pathway bottlenecks instead of running as an isolated simulator."
              compact
              isSimulated={!analyzeArtifact}
            />

            <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: LABEL, margin: '0 0 12px' }}>
              Evolution Parameters
            </p>

            <ParamSlider label="Mutation rate" value={mutationRate} min={1} max={20} onChange={setMutationRate} unit="%" />
            <ParamSlider label="Evolution rounds" value={rounds} min={20} max={500} step={10} onChange={setRounds} unit="" />

            <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: LABEL, margin: '16px 0 8px' }}>
              Starting Sequence
            </p>
            <div style={{
              fontFamily: T.MONO, fontSize: '9px', color: LABEL,
              wordBreak: 'break-all', lineHeight: 1.5,
              background: INPUT_BG, padding: '8px',
              border: `1px solid ${INPUT_BORDER}`, borderRadius: '8px',
              marginBottom: '12px',
            }}>
              {STARTING_SEQUENCE.slice(0, 60)}...
            </div>

            <button aria-label="Action" onClick={run} disabled={running} style={{
              width: '100%', padding: '8px',
              background: running ? PATHD_THEME.paperSurfaceMuted : PATHD_THEME.paperSurfaceStrong,
              border: `1px solid ${INPUT_BORDER}`,
              borderRadius: '8px',
              color: running ? LABEL : VALUE,
              fontFamily: T.SANS, fontSize: '11px', cursor: running ? 'not-allowed' : 'pointer',
              boxShadow: running ? 'none' : '0 10px 20px rgba(96,74,56,0.08)',
            }}>
              {running ? 'Evolving...' : 'Run Evolution'}
            </button>

            <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: LABEL, margin: '20px 0 8px' }}>
              Best Sequence
            </p>
            <div style={{
              fontFamily: T.MONO, fontSize: '9px', color: VALUE,
              wordBreak: 'break-all', lineHeight: 1.5,
              background: 'rgba(191,220,205,0.2)', padding: '8px',
              border: `1px solid ${PATHD_THEME.chipBorder}`, borderRadius: '8px',
            }}>
              {bestSequence}
            </div>
          </div>

          {/* Engine view — heatmap */}
          <div className="nb-tool-center" style={{ flex: 1, background: PANEL_BG, display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: '16px', minWidth: 0 }}>
            <ScientificFigureFrame
              eyebrow={figureMeta.eyebrow}
              title={figureMeta.title}
              caption={figureMeta.caption}
              legend={[
                { label: 'Mutation rate', value: `${mutationRate}%`, accent: PATHD_THEME.apricot },
                { label: 'Rounds', value: `${rounds}`, accent: PATHD_THEME.lilac },
                { label: 'Best fitness', value: bestFitness.toFixed(4), accent: PATHD_THEME.mint },
                { label: 'Diversity', value: diversityIndex.toFixed(3), accent: PATHD_THEME.coral },
              ]}
              footer={
                <div style={{ display: 'grid', gap: '6px' }}>
                  <div style={{ fontFamily: T.SANS, fontSize: '11px', color: VALUE, lineHeight: 1.55 }}>
                    The figure emphasizes whether the current winning sequence is emerging from broad exploration or a narrow local basin. That distinction matters more than a single peak score when deciding whether to continue evolution or redesign the enzyme.
                  </div>
                  <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL, lineHeight: 1.5 }}>
                    current lead: {bestSequence.slice(0, 24) || 'pending'} · recommended baseline {recommendedMutationRate}% / {recommendedRounds} rounds
                  </div>
                </div>
              }
              minHeight="100%"
            >
              <div style={{ minHeight: '460px' }}>
                <FitnessHeatmap trajectory={trajectory} />
              </div>
            </ScientificFigureFrame>
          </div>

          {/* Results panel */}
          <div className="nb-tool-right" style={{ width: '240px', borderLeft: `1px solid ${BORDER}`, background: PANEL_BG }}>
            <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: LABEL, margin: '0 0 12px' }}>
              Evolution Results
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <MetricCard label="Best Fitness" value={bestFitness.toFixed(4)} highlight />
              <MetricCard label="Beneficial Mutations" value={beneficialMutations} />
              <MetricCard label="Evolution Steps" value={trajectory.length} unit="pts" />
              <MetricCard label="Diversity Index" value={diversityIndex.toFixed(3)} />
            </div>

            <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: LABEL, margin: '0 0 8px' }}>
              Fitness Trajectory
            </p>
            <svg role="img" aria-label="Chart" viewBox="0 0 200 60" style={{ width: '100%', height: '60px' }}>
              <rect width="200" height="60" fill={PATHD_THEME.paperSurfaceMuted} rx="4" />
              {trajectory.length > 1 && (
                <polyline
                  points={trajectory.map((p, i) => {
                    const x = (i / (trajectory.length - 1)) * 196 + 2;
                    const y = 58 - p.fitness * 54;
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none" stroke={PATHD_THEME.mint} strokeWidth={1.5}
                />
              )}
              <text x="2" y="56" fontFamily={T.MONO} fontSize="7" fill={LABEL}>0</text>
              <text x="2" y="8"  fontFamily={T.MONO} fontSize="7" fill={LABEL}>1</text>
            </svg>

            <div style={{
              marginTop: '12px',
              padding: '12px',
              borderRadius: '12px',
              border: `1px solid ${BORDER}`,
              background: PATHD_THEME.paperSurfaceStrong,
              display: 'grid',
              gap: '6px',
            }}>
              <div style={{ fontFamily: T.MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', color: LABEL }}>
                Interpretation
              </div>
              <div style={{ fontFamily: T.SANS, fontSize: '11px', color: VALUE, lineHeight: 1.55 }}>
                {beneficialMutations > 10
                  ? 'The search is still discovering enough improving moves to justify another directed-evolution cycle.'
                  : 'Improvement is flattening. The page now makes it easier to see when redesign may be more valuable than additional search.'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0, background: PANEL_BG }}>
          <ExportButton label="Export Trajectory JSON" data={trajectory} filename="proevol-trajectory" format="json" />
          <ExportButton label="Export CSV" data={trajectory} filename="proevol-trajectory" format="csv" />
        </div>
      </div>
    </>
  );
}
