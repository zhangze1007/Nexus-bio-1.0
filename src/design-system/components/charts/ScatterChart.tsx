'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { colors, typography, spacing } from '../../tokens';

// ============================================================================
// Types
// ============================================================================

export interface ScatterPoint {
  x: number;
  y: number;
  label?: string;
  /** Custom point radius override */
  radius?: number;
  /** Custom color override */
  color?: string;
  /** Optional metadata for tooltip */
  meta?: Record<string, string | number>;
}

export interface ScatterSeries {
  id: string;
  label: string;
  data: ScatterPoint[];
  color?: string;
  /** Default point radius for this series */
  pointRadius?: number;
  /** Show convex hull around series */
  showHull?: boolean;
}

export interface ScatterChartProps {
  /** Array of scatter data series */
  series: ScatterSeries[];
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
  /** Show legend */
  showLegend?: boolean;
  /** Number of Y-axis ticks */
  yTickCount?: number;
  /** Number of X-axis ticks */
  xTickCount?: number;
  /** Custom Y domain [min, max] */
  yDomain?: [number, number];
  /** Custom X domain [min, max] */
  xDomain?: [number, number];
  /** Y-axis value formatter */
  yFormat?: (value: number) => string;
  /** X-axis value formatter */
  xFormat?: (value: number) => string;
  /** Default point radius */
  defaultPointRadius?: number;
  /** Called when a point is hovered */
  onHoverPoint?: (seriesId: string, point: ScatterPoint, index: number) => void;
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

// Convex hull (Graham scan)
function computeConvexHull(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (points.length < 3) return points;
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: typeof pts = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: typeof pts = [];
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function expandHull(hull: Array<{ x: number; y: number }>, amount: number): Array<{ x: number; y: number }> {
  if (hull.length < 2) return hull;
  // Compute centroid
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
  return hull.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: p.x + (dx / dist) * amount, y: p.y + (dy / dist) * amount };
  });
}

// ============================================================================
// Component
// ============================================================================

export function ScatterChart({
  series,
  width = 600,
  height = 400,
  title,
  xLabel,
  yLabel,
  showGrid = true,
  showLegend = true,
  yTickCount = 5,
  xTickCount = 6,
  yDomain,
  xDomain,
  yFormat = (v) => v.toFixed(v % 1 === 0 ? 0 : 2),
  xFormat = (v) => v.toFixed(v % 1 === 0 ? 0 : 2),
  defaultPointRadius = 4,
  onHoverPoint,
  className,
}: ScatterChartProps) {
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
    const xPad = (xmx - xmn) * 0.05 || 1;
    const yPad = (ymx - ymn) * 0.05 || 1;
    return {
      xMin: xDomain?.[0] ?? (xmn - xPad),
      xMax: xDomain?.[1] ?? (xmx + xPad),
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

  // Compute hulls
  const hulls = useMemo(() => {
    return series
      .filter((s) => s.showHull && s.data.length >= 3)
      .map((s, si) => {
        const color = s.color ?? SERIES_PALETTE[si % SERIES_PALETTE.length];
        const screenPts = s.data.map((p) => ({ x: toX(p.x), y: toY(p.y) }));
        const hull = computeConvexHull(screenPts);
        const expanded = expandHull(hull, 8);
        const d = expanded.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
        return { id: s.id, d, color };
      });
  }, [series, toX, toY]);

  const handlePointEnter = useCallback((seriesId: string, point: ScatterPoint, index: number) => {
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
          {showGrid && yTicks.map((t) => (
            <line
              key={`yg-${t}`}
              x1={0}
              x2={plotW}
              y1={toY(t)}
              y2={toY(t)}
              stroke={colors.border.subtle}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ))}
          {showGrid && xTicks.map((t) => (
            <line
              key={`xg-${t}`}
              x1={toX(t)}
              x2={toX(t)}
              y1={0}
              y2={plotH}
              stroke={colors.border.subtle}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ))}

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

          {/* Convex hulls */}
          {hulls.map((h) => (
            <path
              key={`hull-${h.id}`}
              d={h.d}
              fill={h.color}
              fillOpacity={0.06}
              stroke={h.color}
              strokeWidth={1}
              strokeOpacity={0.25}
              strokeDasharray="4 3"
            />
          ))}

          {/* Data points — render in reverse order so first series is on top */}
          {[...series].reverse().map((s, rsi) => {
            const si = series.length - 1 - rsi;
            const color = s.color ?? SERIES_PALETTE[si % SERIES_PALETTE.length];
            const isSeriesHovered = hoveredSeries === s.id;
            const isOtherHovered = hoveredSeries !== null && !isSeriesHovered;
            return s.data.map((pt, i) => {
              const isPointHovered = isSeriesHovered && hoveredIndex === i;
              const r = pt.radius ?? s.pointRadius ?? defaultPointRadius;
              const ptColor = pt.color ?? color;
              return (
                <g key={`pt-${s.id}-${i}`}>
                  {/* Glow halo for hovered point */}
                  {isPointHovered && (
                    <circle
                      cx={toX(pt.x)}
                      cy={toY(pt.y)}
                      r={r + 6}
                      fill={ptColor}
                      fillOpacity={0.15}
                    />
                  )}
                  <circle
                    cx={toX(pt.x)}
                    cy={toY(pt.y)}
                    r={isPointHovered ? r + 2 : r}
                    fill={ptColor}
                    fillOpacity={isOtherHovered ? 0.2 : 0.75}
                    stroke={ptColor}
                    strokeWidth={isPointHovered ? 2 : 1}
                    strokeOpacity={isOtherHovered ? 0.2 : 0.9}
                    style={{ transition: 'fill-opacity 150ms ease, stroke-opacity 150ms ease, r 100ms ease', cursor: 'pointer' }}
                    onMouseEnter={() => handlePointEnter(s.id, pt, i)}
                    onMouseLeave={handlePointLeave}
                  />
                </g>
              );
            });
          })}

          {/* Hover tooltip */}
          {hoveredSeries !== null && hoveredIndex !== null && (() => {
            const s = series.find((s) => s.id === hoveredSeries);
            if (!s) return null;
            const pt = s.data[hoveredIndex];
            if (!pt) return null;
            const tx = toX(pt.x);
            const ty = toY(pt.y);
            const r = pt.radius ?? s.pointRadius ?? defaultPointRadius;
            const tooltipX = tx + (tx > plotW / 2 ? -(r + 12) : r + 12);
            const anchor = tx > plotW / 2 ? 'end' : 'start';
            const label = pt.label ?? `(${xFormat(pt.x)}, ${yFormat(pt.y)})`;
            const lines = [label];
            if (pt.meta) {
              for (const [k, v] of Object.entries(pt.meta)) {
                lines.push(`${k}: ${v}`);
              }
            }
            const tooltipH = lines.length * 16 + 8;
            const tooltipW = Math.max(80, Math.max(...lines.map((l) => l.length)) * 7 + 16);
            const tooltipY = ty - tooltipH / 2;
            return (
              <g>
                {/* Crosshair */}
                <line x1={tx} x2={tx} y1={0} y2={plotH} stroke={colors.border.strong} strokeWidth={1} strokeDasharray="2 2" />
                <line x1={0} x2={plotW} y1={ty} y2={ty} stroke={colors.border.strong} strokeWidth={1} strokeDasharray="2 2" />
                {/* Tooltip box */}
                <rect
                  x={anchor === 'end' ? tooltipX - tooltipW : tooltipX}
                  y={tooltipY}
                  width={tooltipW}
                  height={tooltipH}
                  rx={4}
                  fill={colors.bg.elevated}
                  stroke={colors.border.default}
                  strokeWidth={1}
                />
                {lines.map((line, li) => (
                  <text
                    key={li}
                    x={anchor === 'end' ? tooltipX - 8 : tooltipX + 8}
                    y={tooltipY + 14 + li * 16}
                    textAnchor={anchor}
                    fill={li === 0 ? (pt.color ?? s.color ?? SERIES_PALETTE[series.indexOf(s) % SERIES_PALETTE.length]) : colors.text.secondary}
                    fontFamily={li === 0 ? monoFont : sansFont}
                    fontSize={typography.fontSize.xs}
                    fontWeight={li === 0 ? typography.fontWeight.medium : typography.fontWeight.regular}
                  >
                    {line}
                  </text>
                ))}
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
                  <circle cx={6} cy={-3} r={4} fill={color} fillOpacity={0.75} stroke={color} strokeWidth={1} />
                  <text
                    x={18}
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

export default ScatterChart;
