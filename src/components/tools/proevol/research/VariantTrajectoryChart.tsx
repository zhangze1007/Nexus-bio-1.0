'use client';

import { useMemo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { rechartsGrid, rechartsTick, TOOLTIP_STYLE, FONT, SERIES_PALETTE } from '../../../charts/chartTheme';
import { PROEVOL_THEME } from '../shared';
import type { VariantTrajectory } from '../../../../services/proevolAnalysis';
import type { ProEvolBandSemantic } from '../../../../domain/proevolArtifact';

interface VariantTrajectoryChartProps {
  trajectories: VariantTrajectory[];
  bandSemantic: ProEvolBandSemantic;
  highlightVariantId?: string | null;
  onSelectVariant?: (variantId: string) => void;
}

interface MergedRow {
  roundNumber: number;
  [key: string]: number;
}

function buildTooltip(bandSemantic: ProEvolBandSemantic) {
  const bandLabel = bandSemantic === 'measurement' ? '95% CI' : 'model spread';
  return function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const rows = payload.filter(
      (entry: any) =>
        !entry.dataKey?.endsWith('__band')
        && !entry.dataKey?.endsWith('__lower')
        && !entry.dataKey?.endsWith('__upper'),
    );
    return (
      <div style={TOOLTIP_STYLE}>
        <div style={{ marginBottom: 4, fontFamily: FONT.MONO, color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
          Round {label}
        </div>
        {rows.map((entry: any) => {
          const lower = entry.payload?.[`${entry.dataKey}__lower`];
          const upper = entry.payload?.[`${entry.dataKey}__upper`];
          return (
            <div key={entry.dataKey} style={{ fontFamily: FONT.MONO, color: entry.color, fontSize: 11 }}>
              {entry.name}: {(entry.value * 100).toFixed(2)}%
              {typeof lower === 'number' && typeof upper === 'number' ? (
                <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 6 }}>
                  {bandLabel} [{(lower * 100).toFixed(2)}–{(upper * 100).toFixed(2)}%]
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };
}

export default function VariantTrajectoryChart({
  trajectories,
  bandSemantic,
  highlightVariantId,
  onSelectVariant,
}: VariantTrajectoryChartProps) {
  const data = useMemo<MergedRow[]>(() => {
    const rounds = new Map<number, MergedRow>();
    trajectories.forEach((trajectory) => {
      trajectory.points.forEach((point) => {
        const row = rounds.get(point.roundNumber) ?? { roundNumber: point.roundNumber };
        row[trajectory.variantId] = point.frequency;
        row[`${trajectory.variantId}__lower`] = point.lower;
        row[`${trajectory.variantId}__upper`] = point.upper;
        // Recharts area expects [lower, upper] tuple keyed via two values; we stack via a band key
        row[`${trajectory.variantId}__band`] = point.upper - point.lower;
        rounds.set(point.roundNumber, row);
      });
    });
    return [...rounds.values()].sort((left, right) => left.roundNumber - right.roundNumber);
  }, [trajectories]);

  if (!trajectories.length) {
    return <EmptyState message="No top variants available for trajectory rendering." />;
  }

  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid {...rechartsGrid} />
            <XAxis
              dataKey="roundNumber"
              tick={rechartsTick}
              label={{
                value: 'Selection round',
                position: 'insideBottom',
                offset: -2,
                fill: 'rgba(255,255,255,0.5)',
                fontSize: 10,
                fontFamily: FONT.SANS,
              }}
              stroke="rgba(255,255,255,0.18)"
            />
            <YAxis
              tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`}
              tick={rechartsTick}
              stroke="rgba(255,255,255,0.18)"
              label={{
                value: 'Variant frequency',
                angle: -90,
                position: 'insideLeft',
                fill: 'rgba(255,255,255,0.5)',
                fontSize: 10,
                fontFamily: FONT.SANS,
                offset: 10,
              }}
            />
            <Tooltip content={buildTooltip(bandSemantic)} />
            {trajectories.map((trajectory, index) => {
              const color = SERIES_PALETTE[index % SERIES_PALETTE.length];
              const isHighlighted =
                !highlightVariantId || highlightVariantId === trajectory.variantId;
              return (
                <Line
                  key={trajectory.variantId}
                  type="monotone"
                  dataKey={trajectory.variantId}
                  name={trajectory.label}
                  stroke={color}
                  strokeWidth={isHighlighted ? 2.4 : 1.2}
                  strokeOpacity={isHighlighted ? 1 : 0.45}
                  dot={{ r: isHighlighted ? 3 : 2, stroke: color, fill: '#0a0a0a', strokeWidth: 1.4 }}
                  activeDot={{ r: 5, stroke: color, fill: '#0a0a0a', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
        }}
      >
        {trajectories.map((trajectory, index) => {
          const color = SERIES_PALETTE[index % SERIES_PALETTE.length];
          const isHighlighted = !highlightVariantId || highlightVariantId === trajectory.variantId;
          return (
            <button
              type="button"
              key={trajectory.variantId}
              onClick={() => onSelectVariant?.(trajectory.variantId)}
              style={{
                cursor: onSelectVariant ? 'pointer' : 'default',
                fontFamily: FONT.MONO,
                fontSize: 10,
                padding: '4px 8px',
                borderRadius: '999px',
                border: `1px solid ${color}55`,
                background: `${color}${isHighlighted ? '20' : '0a'}`,
                color: PROEVOL_THEME.value,
                opacity: isHighlighted ? 1 : 0.55,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
              <span>{trajectory.label}</span>
              <span style={{ color: PROEVOL_THEME.muted }}>
                · peak {(trajectory.peakFrequency * 100).toFixed(1)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        height: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT.SANS,
        fontSize: 12,
        color: PROEVOL_THEME.muted,
      }}
    >
      {message}
    </div>
  );
}
