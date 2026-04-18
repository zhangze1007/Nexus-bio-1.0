'use client';

/**
 * ConfidenceLineChart — reusable time-series primitive that draws a central
 * mean line with an optional confidence band. Band rendering is strictly
 * opt-in per series; callers that have no honest interval data must leave
 * `lower`/`upper` unset and the primitive will not render a band for that
 * series.
 *
 * The band semantic (e.g. "95% CI", "SEM", "model spread") is provided by
 * the caller via `bandLabel` and surfaced in the tooltip — never invented.
 */

import { useMemo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  FONT, TOOLTIP_STYLE, SCI_SERIES, rechartsGrid, rechartsTick,
  rechartsAxisTitle, rechartsAxisLine, LINE, MARKER, BAND,
  axisLabel as buildAxisLabel,
} from '../chartTheme';

export interface ConfidenceSeriesPoint {
  x: number;
  /** Central value (required). */
  mean: number;
  /** Optional absolute lower bound of the interval. */
  lower?: number;
  /** Optional absolute upper bound of the interval. */
  upper?: number;
}

export interface ConfidenceSeries {
  id: string;
  label: string;
  points: ConfidenceSeriesPoint[];
  /** Optional explicit color. Defaults to SCI_SERIES by index. */
  color?: string;
  /** When false, dim the series (used for interactive highlight). */
  highlighted?: boolean;
  /** Optional dash pattern — used to separate overlapping series in grayscale. */
  dashPattern?: string;
}

export interface ConfidenceLineChartProps {
  series: ConfidenceSeries[];
  xQuantity: string;
  xUnit?: string;
  yQuantity: string;
  yUnit?: string;
  /** Formatter applied to y-axis ticks. */
  formatY?: (value: number) => string;
  /** Formatter applied to tooltip values. */
  formatValue?: (value: number) => string;
  /** Human-readable interval semantic used in the tooltip. */
  bandLabel?: string;
  height?: number;
  /** Force Y-axis domain. */
  yDomain?: [number | 'auto', number | 'auto'];
}

interface MergedRow {
  x: number;
  [key: string]: number | [number, number] | undefined;
}

function mergeRows(series: ConfidenceSeries[]): MergedRow[] {
  const rows = new Map<number, MergedRow>();
  series.forEach((s) => {
    s.points.forEach((p) => {
      const row = rows.get(p.x) ?? { x: p.x };
      row[s.id] = p.mean;
      if (typeof p.lower === 'number' && typeof p.upper === 'number') {
        row[`${s.id}__band`] = [p.lower, p.upper];
        row[`${s.id}__lower`] = p.lower;
        row[`${s.id}__upper`] = p.upper;
      }
      rows.set(p.x, row);
    });
  });
  return [...rows.values()].sort((a, b) => a.x - b.x);
}

function buildTooltip(series: ConfidenceSeries[], bandLabel: string, formatValue?: (v: number) => string) {
  const fmt = formatValue ?? ((v: number) => v.toFixed(3));
  return function Tip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const meanRows = payload.filter(
      (entry: any) =>
        !entry.dataKey?.toString().endsWith('__band')
        && !entry.dataKey?.toString().endsWith('__lower')
        && !entry.dataKey?.toString().endsWith('__upper'),
    );
    return (
      <div style={TOOLTIP_STYLE}>
        <div style={{ marginBottom: 4, fontFamily: FONT.MONO, fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
          x = {label}
        </div>
        {meanRows.map((entry: any) => {
          const s = series.find((item) => item.id === entry.dataKey);
          const lower = entry.payload?.[`${entry.dataKey}__lower`];
          const upper = entry.payload?.[`${entry.dataKey}__upper`];
          const hasInterval = typeof lower === 'number' && typeof upper === 'number';
          return (
            <div key={entry.dataKey} style={{ fontFamily: FONT.MONO, fontSize: 11, color: entry.color }}>
              {s?.label ?? entry.dataKey} · {fmt(entry.value as number)}
              {hasInterval ? (
                <span style={{ color: 'rgba(255,255,255,0.55)', marginLeft: 6 }}>
                  {bandLabel} [{fmt(lower as number)}–{fmt(upper as number)}]
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };
}

export default function ConfidenceLineChart({
  series,
  xQuantity,
  xUnit,
  yQuantity,
  yUnit,
  formatY,
  formatValue,
  bandLabel = '95% CI',
  height = 260,
  yDomain,
}: ConfidenceLineChartProps) {
  const data = useMemo(() => mergeRows(series), [series]);

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 14, right: 24, left: 8, bottom: 24 }}>
          <CartesianGrid {...rechartsGrid} />
          <XAxis
            dataKey="x"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={rechartsTick}
            axisLine={rechartsAxisLine}
            tickLine={false}
            label={{
              value: buildAxisLabel(xQuantity, xUnit),
              position: 'insideBottom',
              offset: -6,
              style: rechartsAxisTitle,
            }}
          />
          <YAxis
            tick={rechartsTick}
            axisLine={rechartsAxisLine}
            tickLine={false}
            width={56}
            tickFormatter={formatY}
            domain={yDomain}
            label={{
              value: buildAxisLabel(yQuantity, yUnit),
              angle: -90,
              position: 'insideLeft',
              offset: 4,
              style: rechartsAxisTitle,
            }}
          />
          <Tooltip content={buildTooltip(series, bandLabel, formatValue)} />

          {/* Bands first, so mean lines render on top */}
          {series.map((s, i) => {
            const color = s.color ?? SCI_SERIES[i % SCI_SERIES.length];
            const bandKey = `${s.id}__band`;
            const hasBand = data.some((row) => Array.isArray(row[bandKey]));
            if (!hasBand) return null;
            const highlighted = s.highlighted !== false;
            return (
              <Area
                key={`${s.id}-band`}
                type="monotone"
                dataKey={bandKey}
                stroke="none"
                fill={color}
                fillOpacity={highlighted ? BAND.fillOpacity : BAND.fillOpacityMuted}
                isAnimationActive={false}
                activeDot={false}
                legendType="none"
              />
            );
          })}

          {series.map((s, i) => {
            const color = s.color ?? SCI_SERIES[i % SCI_SERIES.length];
            const highlighted = s.highlighted !== false;
            return (
              <Line
                key={`${s.id}-mean`}
                type="monotone"
                dataKey={s.id}
                name={s.label}
                stroke={color}
                strokeWidth={highlighted ? LINE.primary : LINE.muted}
                strokeOpacity={highlighted ? 1 : 0.5}
                strokeDasharray={s.dashPattern}
                dot={{
                  r: highlighted ? MARKER.secondary : 1.5,
                  stroke: color,
                  fill: '#0a0a0a',
                  strokeWidth: 1.4,
                }}
                activeDot={{ r: MARKER.active, stroke: color, fill: '#0a0a0a', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
