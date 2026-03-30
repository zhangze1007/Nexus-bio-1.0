'use client';
import { useState, useMemo, useCallback } from 'react';
import IDEShell from '../ide/IDEShell';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import { FITNESS_LANDSCAPE, generateEvolutionTrajectory, STARTING_SEQUENCE } from '../../data/mockProEvol';
import type { FitnessPoint } from '../../types';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";

function fitnessColor(v: number): string {
  const r = Math.round(30 + v * 180);
  const g = Math.round(10 + v * 200);
  const b = Math.round(60 + v * 60);
  return `rgb(${r},${g},${b})`;
}

function FitnessHeatmap({ trajectory }: { trajectory: FitnessPoint[] }) {
  const CELL = 16;
  const N = 20;
  const W = N * CELL + 2, H = N * CELL + 2;
  const lastPt = trajectory[trajectory.length - 1];
  const pathPts = trajectory.slice(-15);

  return (
    <svg viewBox={`0 0 ${W + 80} ${H + 60}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W + 80} height={H + 60} fill="#0d0f14" />
      {FITNESS_LANDSCAPE.map((row, y) =>
        row.map((v, x) => (
          <rect key={`${x}-${y}`}
            x={1 + x * CELL} y={1 + y * CELL}
            width={CELL - 1} height={CELL - 1}
            fill={fitnessColor(v)} fillOpacity={0.85}
          />
        ))
      )}
      {pathPts.length > 1 && (
        <polyline
          points={pathPts.map((_, i) => {
            const idx = trajectory.length - pathPts.length + i;
            const t = trajectory[idx];
            const x = 1 + (t.mutationCount % N) * CELL + CELL / 2;
            const y = 1 + Math.floor(t.mutationCount / N) * CELL + CELL / 2;
            return `${x},${y}`;
          }).join(' ')}
          fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={2}
          strokeDasharray="4 2"
        />
      )}
      {lastPt && (() => {
        const x = 1 + (lastPt.mutationCount % N) * CELL + CELL / 2;
        const y = 1 + Math.floor(lastPt.mutationCount / N) * CELL + CELL / 2;
        return (
          <>
            <circle cx={x} cy={y} r={6} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={2} />
            <circle cx={x} cy={y} r={2} fill="rgba(255,255,255,0.9)" />
          </>
        );
      })()}
      <defs>
        <linearGradient id="fitScale" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fitnessColor(1)} />
          <stop offset="100%" stopColor={fitnessColor(0)} />
        </linearGradient>
      </defs>
      <rect x={W + 10} y={1} width={16} height={H} fill="url(#fitScale)" />
      <text x={W + 30} y={8} fontFamily={MONO} fontSize="8" fill="rgba(255,255,255,0.4)">1.0</text>
      <text x={W + 30} y={H} fontFamily={MONO} fontSize="8" fill="rgba(255,255,255,0.4)">0.0</text>
      <text x={W + 10} y={H + 20} fontFamily={SANS} fontSize="9" fill="rgba(255,255,255,0.3)">Fitness</text>
      <text x={W / 2} y={H + 40} textAnchor="middle" fontFamily={MONO} fontSize="9" fill="rgba(255,255,255,0.25)">
        Mutation position (x)
      </text>
      <text x={-H / 2} y={W + 70} textAnchor="middle" fontFamily={MONO} fontSize="9" fill="rgba(255,255,255,0.25)"
        transform="rotate(-90)">
        Mutation position (y)
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
        <span style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(0,0,0,0.55)' }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(0,0,0,0.7)' }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'rgba(0,0,0,0.5)', cursor: 'pointer' }} />
    </div>
  );
}

export default function ProEvolPage() {
  const [mutationRate, setMutationRate] = useState(5);
  const [rounds, setRounds] = useState(100);
  const [running, setRunning] = useState(false);
  const [trajectory, setTrajectory] = useState<FitnessPoint[]>([{ mutationCount: 0, fitness: 0.08, sequence: STARTING_SEQUENCE.slice(0, 20) + '...' }]);

  const run = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const traj = generateEvolutionTrajectory(mutationRate / 100, rounds);
      setTrajectory(traj);
      setRunning(false);
    }, 0);
  }, [mutationRate, rounds]);

  const bestFitness = useMemo(() => Math.max(...trajectory.map(p => p.fitness)), [trajectory]);
  const beneficialMutations = useMemo(() =>
    trajectory.filter((p, i) => i > 0 && p.fitness > trajectory[i - 1].fitness).length,
    [trajectory]
  );
  const bestSequence = useMemo(() =>
    trajectory.find(p => p.fitness === bestFitness)?.sequence ?? '',
    [trajectory, bestFitness]
  );

  return (
    <IDEShell moduleId="proevol">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#F5F7FA' }}>
        <AlgorithmInsight
          title="Directed Evolution Simulator"
          description="Monte Carlo sampling traverses the fitness landscape via Metropolis criterion. Accepts unfavorable mutations with probability e^(ΔF/T)."
          formula="P(accept) = min(1, e^(ΔF/kT))"
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* Input panel */}
          <div style={{ width: '240px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderRight: '1px solid rgba(0,0,0,0.07)', background: '#FFFFFF' }}>
            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.35)', margin: '0 0 12px' }}>
              Evolution Parameters
            </p>

            <ParamSlider label="Mutation rate" value={mutationRate} min={1} max={20} onChange={setMutationRate} unit="%" />
            <ParamSlider label="Evolution rounds" value={rounds} min={20} max={500} step={10} onChange={setRounds} unit="" />

            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.35)', margin: '16px 0 8px' }}>
              Starting Sequence
            </p>
            <div style={{
              fontFamily: MONO, fontSize: '9px', color: 'rgba(0,0,0,0.5)',
              wordBreak: 'break-all', lineHeight: 1.5,
              background: 'rgba(0,0,0,0.04)', padding: '8px',
              border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px',
              marginBottom: '12px',
            }}>
              {STARTING_SEQUENCE.slice(0, 60)}...
            </div>

            <button onClick={run} disabled={running} style={{
              width: '100%', padding: '8px',
              background: running ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.06)',
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: '8px',
              color: running ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.7)',
              fontFamily: SANS, fontSize: '11px', cursor: running ? 'not-allowed' : 'pointer',
            }}>
              {running ? 'Evolving...' : 'Run Evolution'}
            </button>

            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.35)', margin: '20px 0 8px' }}>
              Best Sequence
            </p>
            <div style={{
              fontFamily: MONO, fontSize: '9px', color: 'rgba(20,140,80,0.8)',
              wordBreak: 'break-all', lineHeight: 1.5,
              background: 'rgba(200,240,224,0.2)', padding: '8px',
              border: '1px solid rgba(200,240,224,0.6)', borderRadius: '8px',
            }}>
              {bestSequence}
            </div>
          </div>

          {/* Engine view — heatmap */}
          <div style={{ flex: 1, overflow: 'hidden', background: '#0d0f14', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <FitnessHeatmap trajectory={trajectory} />
          </div>

          {/* Results panel */}
          <div style={{ width: '240px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderLeft: '1px solid rgba(0,0,0,0.07)', background: '#FFFFFF' }}>
            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.35)', margin: '0 0 12px' }}>
              Evolution Results
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <MetricCard label="Best Fitness" value={bestFitness.toFixed(4)} highlight />
              <MetricCard label="Beneficial Mutations" value={beneficialMutations} />
              <MetricCard label="Evolution Steps" value={trajectory.length} unit="pts" />
              <MetricCard label="Diversity Index" value={(trajectory.length > 1 ? (new Set(trajectory.map(p => Math.round(p.fitness * 100))).size / trajectory.length) : 0).toFixed(3)} />
            </div>

            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.35)', margin: '0 0 8px' }}>
              Fitness Trajectory
            </p>
            <svg viewBox="0 0 200 60" style={{ width: '100%', height: '60px' }}>
              <rect width="200" height="60" fill="rgba(0,0,0,0.03)" rx="4" />
              {trajectory.length > 1 && (
                <polyline
                  points={trajectory.map((p, i) => {
                    const x = (i / (trajectory.length - 1)) * 196 + 2;
                    const y = 58 - p.fitness * 54;
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none" stroke="rgba(20,140,80,0.6)" strokeWidth={1.5}
                />
              )}
              <text x="2" y="56" fontFamily={MONO} fontSize="7" fill="rgba(0,0,0,0.25)">0</text>
              <text x="2" y="8"  fontFamily={MONO} fontSize="7" fill="rgba(0,0,0,0.25)">1</text>
            </svg>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0, background: '#FFFFFF' }}>
          <ExportButton label="Export Trajectory JSON" data={trajectory} filename="proevol-trajectory" format="json" />
          <ExportButton label="Export CSV" data={trajectory} filename="proevol-trajectory" format="csv" />
        </div>
      </div>
    </IDEShell>
  );
}
