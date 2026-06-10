'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { colors, typography, spacing } from '../../tokens';

// ============================================================================
// Types
// ============================================================================

export interface DataPoint {
  x: number;
  y: number;
  label?: string;
}

export interface DataSeries {
  id: string;
  label: string;
  data: DataPoint[];
  color?: string;
  strokeWidth?: number;
  dashed?: boolean;
}

export interface LineChartProps {
  /** Array of data series to plot */
  series: DataSeries[];
  /** Chart width in pixels */
  width?: number;
  /** Chart height in pixels */
  height?: number;
  /** Chart title */
  title?: string;
  /** X-axis label */
  xLabel?: string;
  /** Y-axis label */
  yLabel?: string;
  /** Show grid lines */
  showGrid?: boolean;
  /** Show data point markers */
  showPoints?: boolean;
  /** Show legend */
  showLegend?: boolean;
  /** Show area fill under lines */
  showArea?: boolean;
  /** Number of grid lines on Y axis */
  yTickCount?: number;
  /** Number of grid lines on X axis */
  xTickCount?: number;
  /** Custom Y domain [min, max] */
  yDomain?: [number, number];
  /** Custom X domain [min, max] */
  xDomain?: [number, number];
  /** Y-axis value formatter */
  yFormat?: (value: number) => string;
  /** X-axis value formatter */
  xFormat?: (value: number) => string;
  /** Called when a data point is hovered */
  onHoverPoint?: (seriesId: string, point: DataPoint, index: number) => void;
  /** Additional CSS class */
  className?: string;
}

// ============================================================================
// Color Palette
// ============================================================================

const SERIES_PALETTE = [
  colors.chart.blue,
  colors.chart.green,
  colors.chart.purple,
  colors.chart.gold,
  colors.chart.salmon,
  colors.chart.indigo,
  colors.chart.lime,
];

// ============================================================================
// Helpers
// ============================================================================

function niceNum(range: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / Math.pow(10, exponent);
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * Math.pow(10, exponent);
}

function niceScale(min: number, max: number, ticks: number): { min: number; max: number; step: number } {
  const range = niceNum(max - min, false);
  const step = niceNum(range / (ticks - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  return { min: niceMin, max: niceMax, step };
}

function generateTicks(min: number, max: number, step: number): number[] {
  const ticks: number[] = [];
  for (let v = min; v <= max + step * 0.001; v += step) {
    ticks.push(parseFloat(v.toPrecision(12)));
  }
  return ticks;
}

// ============================================================================
// Component
// ============================================================================

export function LineChart({
  series,
  width = 600,
  height = 360,
  title,
  xLabel,
  yLabel,
  showGrid = true,
  showPoints = true,
  showLegend = true,
  showArea = false,
  yTickCount = 5,
  xTickCount = 6,
  yDomain,
  xDomain,
  yFormat = (v) => v.toFixed(v % 1 === 0 ? 0 : 2),
  xFormat = (v) => v.toFixed(v % 1 === 0 ? 0 : 2),
  onHoverPoint,
  className,
}: LineChartProps) {
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Layout constants
  const margin = { top: title ? 40 : 24, right: 24, bottom: xLabel ? 52 : 36, left: yLabel ? 60 : 48 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Compute domains
  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    let xmn = Infinity, xmx = -Infinity, ymn = Infinity, ymx = -Infinity;
    for (const s of series) {
      for (const p of s.data) {
        if (p.x < xmn) xmn = p.x;
        if (p.x > xmx) xmx = p.x;
        if (p.y < ymn) ymn = p.y;
        if (p.y > ymx) ymx = p.y;
      }
    }
    if (xmn === Infinity) { xmn = 0; xmx = 1; ymn = 0; ymx = 1; }
    // Add 5% padding to Y
    const yPad = (ymx - ymn) * 0.05 || 1;
    return {
      xMin: xDomain?.[0] ?? xmn,
      xMax: xDomain?.[1] ?? xmx,
      yMin: yDomain?.[0] ?? (ymn - yPad),
      yMax: yDomain?.[1] ?? (ymx + yPad),
    };
  }, [series, xDomain, yDomain]);

  const yScale = useMemo(() => niceScale(yMin, yMax, yTickCount), [yMin, yMax, yTickCount]);
  const xScale = useMemo(() => niceScale(xMin, xMax, xTickCount), [xMin, xMax, xTickCount]);

  const yTicks = useMemo(() => generateTicks(yScale.min, yScale.max, yScale.step), [yScale]);
  const xTicks = useMemo(() => generateTicks(xScale.min, xScale.max, xScale.step), [xScale]);

  const toX = useCallback((v: number) => ((v - xScale.min) / (xScale.max - xScale.min)) * plotW, [xScale, plotW]);
  const toY = useCallback((v: number) => plotH - ((v - yScale.min) / (yScale.max - yScale.min)) * plotH, [yScale, plotH]);

  // Build SVG path for each series
  const paths = useMemo(() => {
    return series.map((s, si) => {
      const color = s.color ?? SERIES_PALETTE[si % SERIES_PALETTE.length];
      const sorted = [...s.data].sort((a, b) => a.x - b.x);
      const d = sorted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x)} ${toY(p.y)}`).join(' ');

      // Area path
      let areaD = '';
      if (showArea && sorted.length > 0) {
        areaD = `M ${toX(sorted[0].x)} ${plotH} ` +
          sorted.map((p) => `L ${toX(p.x)} ${toY(p.y)}`).join(' ') +
          ` L ${toX(sorted[sorted.length - 1].x)} ${plotH} Z`;
      }

      return { id: s.id, color, d, areaD, sorted, label: s.label, strokeWidth: s.strokeWidth ?? 2, dashed: s.dashed ?? false };
    });
  }, [series, toX, toY, plotH, showArea]);

  const handlePointEnter = useCallback((seriesId: string, point: DataPoint, index: number) => {
    setHoveredSeries(seriesId);
    setHoveredIndex(index);
    onHoverPoint?.(seriesId, point, index);
  }, [onHoverPoint]);

  const handlePointLeave = useCallback(() => {
    setHoveredSeries(null);
    setHoveredIndex(null);
  }, []);

  // Font helpers
  const sansFont = typography.fontFamily.sans;
  const monoFont = typography.fontFamily.mono;

  return (
    <div
      className={className}
      style={{
        display: 'inline-block',
        background: colors.bg.primary,
        borderRadius: '12px',
        border: `1px solid ${colors.border.subtle}`,
        padding: spacing.md,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Title */}
        {title && (
          <text
            x={margin.left + plotW / 2}
            y={20}
            textAnchor="middle"
            fill={colors.text.primary}
            fontFamily={sansFont}
            fontSize={typography.fontSize.md}
            fontWeight={typography.fontWeight.semibold}
          >
            {title}
          </text>
        )}

        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Grid lines */}
          {showGrid && yTicks.map((t) => {
            const y = toY(t);
            return (
              <line
                key={`yg-${t}`}
                x1={0}
                x2={plotW}
                y1={y}
                y2={y}
                stroke={colors.border.subtle}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            );
          })}
          {showGrid && xTicks.map((t) => {
            const x = toX(t);
            return (
              <line
                key={`xg-${t}`}
                x1={x}
                x2={x}
                y1={0}
                y2={plotH}
                stroke={colors.border.subtle}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            );
          })}

          {/* Axes */}
          <line x1={0} x2={plotW} y1={plotH} y2={plotH} stroke={colors.border.default} strokeWidth={1} />
          <line x1={0} x2={0} y1={0} y2={plotH} stroke={colors.border.default} strokeWidth={1} />

          {/* Y tick labels */}
          {yTicks.map((t) => (
            <text
              key={`yl-${t}`}
              x={-8}
              y={toY(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fill={colors.text.tertiary}
              fontFamily={monoFont}
              fontSize={typography.fontSize.xs}
            >
              {yFormat(t)}
            </text>
          ))}

          {/* X tick labels */}
          {xTicks.map((t) => (
            <text
              key={`xl-${t}`}
              x={toX(t)}
              y={plotH + 18}
              textAnchor="middle"
              fill={colors.text.tertiary}
              fontFamily={monoFont}
              fontSize={typography.fontSize.xs}
            >
              {xFormat(t)}
            </text>
          ))}

          {/* Axis labels */}
          {xLabel && (
            <text
              x={plotW / 2}
              y={plotH + 38}
              textAnchor="middle"
              fill={colors.text.secondary}
              fontFamily={sansFont}
              fontSize={typography.fontSize.sm}
            >
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text
              x={-plotH / 2}
              y={-44}
              textAnchor="middle"
              fill={colors.text.secondary}
              fontFamily={sansFont}
              fontSize={typography.fontSize.sm}
              transform="rotate(-90)"
            >
              {yLabel}
            </text>
          )}

          {/* Area fills */}
          {paths.map((p) =>
            p.areaD ? (
              <path
                key={`area-${p.id}`}
                d={p.areaD}
                fill={p.color}
                opacity={0.08}
              />
            ) : null
          )}

          {/* Lines */}
          {paths.map((p) => (
            <path
              key={`line-${p.id}`}
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth={p.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={p.dashed ? '6 4' : undefined}
              opacity={hoveredSeries && hoveredSeries !== p.id ? 0.3 : 1}
              style={{ transition: 'opacity 150ms ease' }}
            />
          ))}

          {/* Data points */}
          {showPoints && paths.map((p) =>
            p.sorted.map((pt, i) => (
              <circle
                key={`pt-${p.id}-${i}`}
                cx={toX(pt.x)}
                cy={toY(pt.y)}
                r={hoveredSeries === p.id && hoveredIndex === i ? 5 : 3}
                fill={colors.bg.primary}
                stroke={p.color}
                strokeWidth={2}
                opacity={hoveredSeries && hoveredSeries !== p.id ? 0.3 : 1}
                style={{ transition: 'opacity 150ms ease, r 100ms ease', cursor: 'pointer' }}
                onMouseEnter={() => handlePointEnter(p.id, pt, i)}
                onMouseLeave={handlePointLeave}
              />
            ))
          )}

          {/* Hover tooltip */}
          {hoveredSeries !== null && hoveredIndex !== null && (() => {
            const s = paths.find((p) => p.id === hoveredSeries);
            if (!s) return null;
            const pt = s.sorted[hoveredIndex];
            if (!pt) return null;
            const tx = toX(pt.x);
            const ty = toY(pt.y);
            const tooltipX = tx + (tx > plotW / 2 ? -10 : 10);
            const anchor = tx > plotW / 2 ? 'end' : 'start';
            return (
              <g>
                <line x1={tx} x2={tx} y1={0} y2={plotH} stroke={colors.border.strong} strokeWidth={1} strokeDasharray="2 2" />
                <rect
                  x={anchor === 'end' ? tooltipX - 8 : tooltipX - 8}
                  y={ty - 28}
                  width={80}
                  height={22}
                  rx={4}
                  fill={colors.bg.elevated}
                  stroke={colors.border.default}
                  strokeWidth={1}
                />
                <text
                  x={tooltipX}
                  y={ty - 14}
                  textAnchor={anchor}
                  fill={s.color}
                  fontFamily={monoFont}
                  fontSize={typography.fontSize.xs}
                >
                  {pt.label ?? `(${xFormat(pt.x)}, ${yFormat(pt.y)})`}
                </text>
              </g>
            );
          })()}
        </g>

        {/* Legend */}
        {showLegend && series.length > 1 && (
          <g transform={`translate(${margin.left}, ${height - 8})`}>
            {series.map((s, si) => {
              const color = s.color ?? SERIES_PALETTE[si % SERIES_PALETTE.length];
              const offset = si * 120;
              return (
                <g key={s.id} transform={`translate(${offset}, 0)`}>
                  <line
                    x1={0}
                    x2={16}
                    y1={-3}
                    y2={-3}
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray={s.dashed ? '4 3' : undefined}
                  />
                  <text
                    x={22}
                    y={0}
                    fill={colors.text.secondary}
                    fontFamily={sansFont}
                    fontSize={typography.fontSize.xs}
                    dominantBaseline="middle"
                  >
                    {s.label}
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
}

export default LineChart;
