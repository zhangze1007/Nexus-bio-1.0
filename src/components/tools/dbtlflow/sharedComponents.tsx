'use client';
import React from 'react';
import { THEME } from '../../../theme';
import { SEMANTIC_RGB } from '../../charts/chartTheme';
import type { DBTLPhase, FeedbackLoopResult, DBTLIteration } from '../../../types';
import type { DBTLLearnedFeedback } from '../../../types/dbtlFeedback';

/* ── Design Tokens ── */
export const PHASE_PASTEL: Record<string, string> = {
  Design: THEME.lilac,
  Build:  THEME.apricot,
  Test:   THEME.coral,
  Learn:  THEME.mint,
};

export const PHASES: DBTLPhase[] = ['Design', 'Build', 'Test', 'Learn'];
export const DBTL_DELTA_TARGET_TOOLS = ['fbasim', 'catdes', 'dyncon', 'cellfree'];

/* ── Utility Functions ── */
export function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.filter((item) => item.trim().length > 0)));
}

export function sourceExperimentRecordIdsFromFeedback(
  result: FeedbackLoopResult | null,
  feedback: DBTLLearnedFeedback,
): string[] {
  return uniqueStrings([
    ...(result?.sourceExperimentRecordIds ?? []),
    ...feedback.sources.flatMap((source) => [
      ...(source.sourceExperimentRecordIds ?? []),
      ...(source.experimentRecordId ? [source.experimentRecordId] : []),
    ]),
  ]);
}

export function sourceProvenanceIdsFromFeedback(feedback: DBTLLearnedFeedback): string[] {
  return uniqueStrings(feedback.sources.flatMap((source) =>
    source.provenanceEntryId ? [source.provenanceEntryId] : []
  ));
}

/* ── Timeline (preserved) ── */
export function Timeline({ iterations }: { iterations: DBTLIteration[] }) {
  const maxResult = Math.max(...iterations.map(i => i.result));
  const targetThreshold = maxResult * 0.72;

  return (
    <svg role="img" aria-label="Chart"
      viewBox={`0 0 520 ${Math.max(360, iterations.length * 60 + 40)}`}
      style={{ width: '100%', height: '100%' }}
    >
      <rect width="520" height={Math.max(360, iterations.length * 60 + 40)} fill="#05070b" rx="14" />
      <rect x="18" y="18" width="484" height={Math.max(320, iterations.length * 60)} rx="14" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" />
      <text x="36" y="14" fontFamily={THEME.SANS} fontSize="10" fill={THEME.paperLabel} letterSpacing="0.12em">DBTL AUDIT TIMELINE</text>
      <text x="36" y="28" fontFamily={THEME.SANS} fontSize="11" fill={THEME.paperValue}>Iteration trace with phase identity, result magnitude, and pass gate</text>
      {iterations.length > 1 && (
        <polyline
          points={iterations
            .map((it, i) => `${160 + (it.result / maxResult) * 280},${30 + i * 60 + 33}`)
            .join(' ')}
          fill="none"
          stroke="#FF7F00"
          strokeWidth={1.8}
          strokeDasharray="4 2"
          strokeOpacity={0.75}
        />
      )}
      <line x1={160} y1={20} x2={160} y2={30 + iterations.length * 60} stroke="rgba(255,255,255,0.08)" />
      <line x1={160 + (targetThreshold / maxResult) * 280} y1={20} x2={160 + (targetThreshold / maxResult) * 280} y2={30 + iterations.length * 60} stroke="rgba(255,139,31,0.24)" strokeDasharray="5 4" />
      {iterations.map((it, i) => {
        const y = 30 + i * 60;
        const barW = (it.result / maxResult) * 280;
        const phaseColor = PHASE_PASTEL[it.phase] ?? 'rgba(255,255,255,0.4)';
        return (
          <g key={it.id}>
            <rect x={4} y={y + 8} width={60} height={18} rx="3"
              fill={phaseColor} fillOpacity={0.15} stroke={phaseColor} strokeWidth={1} />
            <text x={34} y={y + 20} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={phaseColor}>
              {it.phase.toUpperCase()}
            </text>
            <text x={80} y={y + 20} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.3)">
              #{it.id}
            </text>
            <text x={100} y={y + 20} fontFamily={THEME.SANS} fontSize="10" fill="rgba(255,255,255,0.5)">
              {it.hypothesis.slice(0, 40)}{it.hypothesis.length > 40 ? '…' : ''}
            </text>
            <rect x={160} y={y + 28} width={barW} height={10} rx="2"
              fill={it.passed ? `rgba(${SEMANTIC_RGB.pass}, 0.42)` : `rgba(${SEMANTIC_RGB.fail}, 0.36)`}
              stroke={it.passed ? `rgba(${SEMANTIC_RGB.pass}, 0.72)` : `rgba(${SEMANTIC_RGB.fail}, 0.58)`}
              strokeWidth={1}
            />
            <text x={160 + barW + 6} y={y + 38} fontFamily={THEME.MONO} fontSize="10"
              fill={it.passed ? `rgba(${SEMANTIC_RGB.pass}, 0.85)` : `rgba(${SEMANTIC_RGB.fail}, 0.78)`}>
              {it.result} {it.unit}
            </text>
            <circle cx={440} cy={y + 22} r={5}
              fill={it.passed ? `rgba(${SEMANTIC_RGB.pass}, 0.75)` : `rgba(${SEMANTIC_RGB.fail}, 0.7)`} />
            <line x1={4} y1={y + 52} x2={480} y2={y + 52} stroke="rgba(255,255,255,0.04)" />
          </g>
        );
      })}
      <text x={160 + (targetThreshold / maxResult) * 280 + 4} y={18} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,139,31,0.78)">
        target band
      </text>
      <text x={160} y={30 + iterations.length * 60 + 16} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.2)">
        0
      </text>
      <text x={440} y={30 + iterations.length * 60 + 16} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.2)">
        {maxResult.toFixed(0)} {iterations[0]?.unit}
      </text>
    </svg>
  );
}

/* ── Apple-style Cycle Progress Ring ── */
export function CycleProgressRing({
  currentPhase,
  iterationCount,
}: {
  currentPhase: DBTLPhase;
  iterationCount: number;
}) {
  const phaseIndex = PHASES.indexOf(currentPhase);
  const progress = (phaseIndex + 1) / PHASES.length; // 0.25 → 1.0
  const size = 140;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0' }}>
      <svg role="img" aria-label="Chart" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="pathd-progress-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={THEME.blue} />
            <stop offset="50%" stopColor={THEME.indigo} />
            <stop offset="100%" stopColor={THEME.orange} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={THEME.progressTrack} strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="url(#pathd-progress-ring)" strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        />
      </svg>
      {/* Center labels (overlaid) */}
      <div style={{
        marginTop: -size + stroke,
        width: size,
        height: size - stroke * 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{
          fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', fontWeight: 600,
          color: THEME.orange, letterSpacing: '0.04em',
        }}>
          {currentPhase.toUpperCase()}
        </span>
        <span style={{
          fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700,
          color: THEME.paperValue, marginTop: '2px',
        }}>
          {iterationCount}
        </span>
        <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>
          iterations
        </span>
      </div>
    </div>
  );
}

/* ── Shared Input Styles ── */
export const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  boxSizing: 'border-box',
  background: THEME.paperSurfaceStrong,
  border: `1px solid ${THEME.paperBorder}`,
  borderRadius: 'var(--nb-radius-sm)',
  color: THEME.paperValue,
  fontFamily: THEME.MONO,
  fontSize: 'var(--nb-fs-sm)',
  outline: '2px solid rgba(175,195,214,0.5)',
  outlineOffset: '2px',
};

export const sectionLabel: React.CSSProperties = {
  fontFamily: THEME.SANS,
  fontSize: 'var(--nb-fs-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: THEME.paperLabel,
  margin: '0 0 12px',
};
