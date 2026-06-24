'use client';
import React from 'react';
import { runRepressilator, runToggleSwitch, runLogicCascade } from '../../../data/mockGECAIR';
import type { GateType, RepressilatorState, ToggleSwitchState, LogicCascadeState } from '../../../data/mockGECAIR';
import type { GillespieResult } from '../../../server/gillespieSSA';
import { THEME } from '../../../theme';
import { PAPER_THEME } from '../../charts/chartTheme';
import ScientificFigureFrame from '../shared/ScientificFigureFrame';

/* ── ODE Mini Dynamics (sidebar compact view) ── */

export function ODEMiniDynamics({ circuitType, togglePerturbation }: {
  circuitType: 'repressilator' | 'toggle_switch' | 'logic_cascade';
  togglePerturbation: 'A' | 'B';
}) {
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
          {[0, 0.25, 0.5, 0.75, 1].map(f => (
            <g key={`srx-${f}`}>
              <line x1={f * w} y1={h} x2={f * w} y2={h - 3} stroke={PAPER_THEME.axis} strokeWidth="0.5" />
              <text x={f * w} y={h - 4} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize="7" fill={PAPER_THEME.tickColor}>
                {f === 0 ? '0' : f === 0.25 ? 'T/4' : f === 0.5 ? 'T/2' : f === 0.75 ? '3T/4' : 'T'}
              </text>
            </g>
          ))}
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
          {[0, 0.25, 0.5, 0.75, 1].map(f => (
            <g key={`slc-${f}`}>
              <line x1={f * w} y1={h} x2={f * w} y2={h - 3} stroke={PAPER_THEME.axis} strokeWidth="0.5" />
              <text x={f * w} y={h - 4} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize="7" fill={PAPER_THEME.tickColor}>
                {f === 0 ? '0' : f === 0.25 ? 'T/4' : f === 0.5 ? 'T/2' : f === 0.75 ? '3T/4' : 'T'}
              </text>
            </g>
          ))}
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
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <g key={`sts-${f}`}>
            <line x1={f * w} y1={h} x2={f * w} y2={h - 3} stroke={PAPER_THEME.axis} strokeWidth="0.5" />
            <text x={f * w} y={h - 4} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize="7" fill={PAPER_THEME.tickColor}>
              {f === 0 ? '0' : f === 0.25 ? 'T/4' : f === 0.5 ? 'T/2' : f === 0.75 ? '3T/4' : 'T'}
            </text>
          </g>
        ))}
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
}

/* ── Dynamics Tab Panel ── */
interface DynamicsTabProps {
  circuitType: 'repressilator' | 'toggle_switch' | 'logic_cascade';
  setCircuitType: (c: 'repressilator' | 'toggle_switch' | 'logic_cascade') => void;
  stochasticMode: boolean;
  setStochasticMode: (v: boolean) => void;
  ensembleRuns: number;
  setEnsembleRuns: (n: number) => void;
  togglePerturbation: 'A' | 'B';
  setTogglePerturbation: (p: 'A' | 'B') => void;
  stochasticEnsemble: {
    runs: GillespieResult[];
    resampled: Record<string, number[][]>;
    stats: Record<string, { mean: number[]; std: number[]; fano: number[]; cv: number[] }>;
    timeGrid: number[];
    speciesIds: string[];
    maxTime: number;
  } | null;
}
export function DynamicsTabPanel({
  circuitType, setCircuitType, stochasticMode, setStochasticMode,
  ensembleRuns, setEnsembleRuns, togglePerturbation, setTogglePerturbation,
  stochasticEnsemble,
}: DynamicsTabProps) {
  return (
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
        const axisEls = (
          <>
            <line x1={mL} y1={mT} x2={mL} y2={mT + plotH} stroke={PAPER_THEME.axis} strokeWidth="0.75" />
            <line x1={mL} y1={mT + plotH} x2={mL + plotW} y2={mT + plotH} stroke={PAPER_THEME.axis} strokeWidth="0.75" />
            {[0, 0.25, 0.5, 0.75, 1].map(f => (
              <g key={`dxt-${f}`}>
                <line x1={mL + f * plotW} y1={mT + plotH} x2={mL + f * plotW} y2={mT + plotH + 4} stroke={PAPER_THEME.axis} strokeWidth="0.5" />
                <text x={mL + f * plotW} y={mT + plotH + 14} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
                  {f === 0 ? '0' : f === 0.25 ? 'T/4' : f === 0.5 ? 'T/2' : f === 0.75 ? '3T/4' : 'T'}
                </text>
              </g>
            ))}
            {[0, 0.5, 1].map(f => (
              <g key={`dyt-${f}`}>
                <line x1={mL - 4} y1={mT + plotH - f * plotH} x2={mL} y2={mT + plotH - f * plotH} stroke={PAPER_THEME.axis} strokeWidth="0.5" />
                <text x={mL - 6} y={mT + plotH - f * plotH + 3} textAnchor="end" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
                  {f === 0 ? '0' : f === 0.5 ? '50%' : '100%'}
                </text>
              </g>
            ))}
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

        const speciesColors: Record<string, string> = {
          mA: '#C8D8E8', pA: '#C8D8E8',
          mB: '#C8E0D0', pB: '#C8E0D0',
          mC: '#DDD0E8', pC: '#DDD0E8',
        };
        const proteinIds = speciesIds.filter(id => id.startsWith('p'));
        const globalMax = Math.max(...proteinIds.flatMap(id => {
          const s = stats[id];
          return s.mean.map((m, i) => m + s.std[i]);
        }), 1);

        const toX = (i: number) => mL + (i / (timeGrid.length - 1)) * plotW;
        const toY = (v: number) => mT + plotH - (v / globalMax) * plotH;

        const runLines = proteinIds.map(id => {
          return stochasticEnsemble.runs.map((run, ri) => {
            const times = run.times;
            const traj = run.trajectories[id];
            const step = Math.max(1, Math.floor(times.length / 120));
            const pts: string[] = [];
            for (let j = 0; j < times.length; j += step) {
              const x = mL + (times[j] / maxTime) * plotW;
              const y = toY(traj[j]);
              pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
            }
            const lastX = mL + (times[times.length - 1] / maxTime) * plotW;
            const lastY = toY(traj[traj.length - 1]);
            pts.push(`${lastX.toFixed(1)},${lastY.toFixed(1)}`);
            return { id, ri, path: `M${pts.join(' L')}` };
          });
        }).flat();
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
          const bandPath = `M${upperPts.join(' L')} L${lowerPts.reverse().join(' L')} Z`;
          const meanPath = `M${meanPts.join(' L')}`;
          return { id, bandPath, meanPath, color: speciesColors[id] || '#888' };
        });

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
              {[0, 0.25, 0.5, 0.75, 1].map(f => (
                <g key={`sgrid-${f}`}>
                  <line x1={mL + f * plotW} y1={mT} x2={mL + f * plotW} y2={mT + plotH}
                    stroke={PAPER_THEME.grid} strokeWidth="0.5" />
                  <line x1={mL} y1={mT + f * plotH} x2={mL + plotW} y2={mT + f * plotH}
                    stroke={PAPER_THEME.grid} strokeWidth="0.5" />
                </g>
              ))}
              <line x1={mL} y1={mT} x2={mL} y2={mT + plotH} stroke={PAPER_THEME.axis} strokeWidth="0.75" />
              <line x1={mL} y1={mT + plotH} x2={mL + plotW} y2={mT + plotH} stroke={PAPER_THEME.axis} strokeWidth="0.75" />
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

              {runLines.map(rl => (
                <path key={`run-${rl.id}-${rl.ri}`} d={rl.path} fill="none"
                  stroke={speciesColors[rl.id] || '#888'} strokeWidth={0.6} opacity={0.25} />
              ))}

              {bands.map(b => (
                <g key={`band-${b.id}`}>
                  <path d={b.bandPath} fill={b.color} fillOpacity={0.15} stroke="none" />
                  <path d={b.meanPath} fill="none" stroke={b.color} strokeWidth={2} />
                </g>
              ))}
            </svg>

            <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', flexWrap: 'wrap' }}>
              {proteinIds.map(id => (
                <span key={id} style={{ color: speciesColors[id] }}>
                  ■ {id === 'pA' ? 'Protein A' : id === 'pB' ? 'Protein B' : 'Protein C'} (mean +/- std)
                </span>
              ))}
            </div>

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
  );
}
