"use client";

import React, { useCallback, useMemo, useState } from "react";
import { colors, spacing, typography } from "../../tokens";

// ============================================================================
// Types
// ============================================================================

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
  /** Optional sub-label (e.g. unit or secondary info) */
  subLabel?: string;
}

export interface BarSeries {
  id: string;
  label: string;
  data: BarDatum[];
  color?: string;
}

export interface BarChartProps {
  /** Single series (simple bar) or multi-series (grouped bar) */
  series: BarSeries[];
  /** Chart width in pixels */
  width?: number;
  /** Chart height in pixels */
  height?: number;
  /** Chart title */
  title?: string;
  /** Y-axis label */
  yLabel?: string;
  /** Bar layout mode */
  layout?: "grouped" | "stacked";
  /** Show grid lines */
  showGrid?: boolean;
  /** Show value labels above bars */
  showValues?: boolean;
  /** Show legend */
  showLegend?: boolean;
  /** Number of Y-axis ticks */
  yTickCount?: number;
  /** Custom Y domain [min, max] */
  yDomain?: [number, number];
  /** Y-axis value formatter */
  yFormat?: (value: number) => string;
  /** Bar corner radius in pixels */
  barRadius?: number;
  /** Gap between bar groups as fraction of group width (0-1) */
  groupGap?: number;
  /** Gap between bars within a group as fraction of bar width (0-1) */
  barGap?: number;
  /** Called when a bar is hovered */
  onHoverBar?: (seriesId: string, datum: BarDatum, index: number) => void;
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
  const fraction = range / 10 ** exponent;
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
  return niceFraction * 10 ** exponent;
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

export function BarChart({
  series,
  width = 600,
  height = 360,
  title,
  yLabel,
  layout = "grouped",
  showGrid = true,
  showValues = false,
  showLegend = true,
  yTickCount = 5,
  yDomain,
  yFormat = (v) => v.toFixed(v % 1 === 0 ? 0 : 2),
  barRadius = 3,
  groupGap = 0.2,
  barGap = 0.1,
  onHoverBar,
  className,
}: BarChartProps) {
  const [hoveredBar, setHoveredBar] = useState<{ seriesId: string; index: number } | null>(null);

  // Layout constants
  const margin = {
    top: title ? 40 : 24,
    right: 24,
    bottom: showLegend && series.length > 1 ? 52 : 36,
    left: yLabel ? 60 : 48,
  };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Group labels from first series
  const groupLabels = useMemo(() => series[0]?.data.map((d) => d.label) ?? [], [series]);

  // Compute Y domain
  const { yMin, yMax } = useMemo(() => {
    const ymn = 0; // bars start at 0
    let ymx = -Infinity;
    if (layout === "stacked") {
      for (let i = 0; i < groupLabels.length; i++) {
        let stack = 0;
        for (const s of series) {
          const v = s.data[i]?.value ?? 0;
          stack += v > 0 ? v : 0;
        }
        if (stack > ymx) ymx = stack;
      }
    } else {
      for (const s of series) {
        for (const d of s.data) {
          if (d.value > ymx) ymx = d.value;
        }
      }
    }
    if (ymx === -Infinity) ymx = 1;
    const pad = ymx * 0.08 || 1;
    return {
      yMin: yDomain?.[0] ?? ymn,
      yMax: yDomain?.[1] ?? ymx + pad,
    };
  }, [series, groupLabels, layout, yDomain]);

  const yScale = useMemo(() => niceScale(yMin, yMax, yTickCount), [yMin, yMax, yTickCount]);
  const yTicks = useMemo(() => generateTicks(yScale.min, yScale.max, yScale.step), [yScale]);

  const toY = useCallback(
    (v: number) => plotH - ((v - yScale.min) / (yScale.max - yScale.min)) * plotH,
    [yScale, plotH],
  );

  // Bar geometry
  const nGroups = groupLabels.length;
  const nSeries = series.length;
  const groupWidth = plotW / nGroups;
  const groupPadding = groupWidth * groupGap;

  const barGeometry = useMemo(() => {
    const rects: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      seriesId: string;
      datum: BarDatum;
      groupIndex: number;
      value: number;
    }> = [];

    for (let gi = 0; gi < nGroups; gi++) {
      const groupX = gi * groupWidth + groupPadding / 2;
      const usableGroupWidth = groupWidth - groupPadding;

      if (layout === "stacked") {
        let stackY = 0;
        for (let si = 0; si < nSeries; si++) {
          const s = series[si];
          const d = s.data[gi];
          if (!d) continue;
          const val = d.value;
          const barH = (val / (yScale.max - yScale.min)) * plotH;
          const barY = toY(stackY + val);
          const color = d.color ?? s.color ?? SERIES_PALETTE[si % SERIES_PALETTE.length];
          rects.push({
            x: groupX,
            y: barY,
            w: usableGroupWidth,
            h: Math.max(0, barH),
            color,
            seriesId: s.id,
            datum: d,
            groupIndex: gi,
            value: val,
          });
          stackY += val;
        }
      } else {
        // Grouped
        const barUnitWidth = usableGroupWidth / nSeries;
        const barPad = barUnitWidth * barGap;
        const barW = barUnitWidth - barPad;
        for (let si = 0; si < nSeries; si++) {
          const s = series[si];
          const d = s.data[gi];
          if (!d) continue;
          const val = d.value;
          const barH = ((val - yScale.min) / (yScale.max - yScale.min)) * plotH;
          const barX = groupX + si * barUnitWidth + barPad / 2;
          const barY = toY(val);
          const color = d.color ?? s.color ?? SERIES_PALETTE[si % SERIES_PALETTE.length];
          rects.push({
            x: barX,
            y: barY,
            w: Math.max(0, barW),
            h: Math.max(0, barH),
            color,
            seriesId: s.id,
            datum: d,
            groupIndex: gi,
            value: val,
          });
        }
      }
    }
    return rects;
  }, [nGroups, nSeries, groupWidth, groupPadding, layout, series, yScale, plotH, toY, barGap]);

  const handleBarEnter = useCallback(
    (seriesId: string, datum: BarDatum, index: number) => {
      setHoveredBar({ seriesId, index });
      onHoverBar?.(seriesId, datum, index);
    },
    [onHoverBar],
  );

  const handleBarLeave = useCallback(() => {
    setHoveredBar(null);
  }, []);

  // Font helpers
  const sansFont = typography.fontFamily.sans;
  const monoFont = typography.fontFamily.mono;

  return (
    <div
      className={className}
      style={{
        display: "inline-block",
        background: colors.bg.primary,
        borderRadius: "12px",
        border: `1px solid ${colors.border.subtle}`,
        padding: spacing.md,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", overflow: "visible" }}
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
          {showGrid &&
            yTicks.map((t) => (
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

          {/* X group labels */}
          {groupLabels.map((label, gi) => {
            const cx = gi * groupWidth + groupWidth / 2;
            return (
              <text
                key={`xl-${gi}`}
                x={cx}
                y={plotH + 18}
                textAnchor="middle"
                fill={colors.text.tertiary}
                fontFamily={sansFont}
                fontSize={typography.fontSize.xs}
              >
                {label.length > 12 ? label.slice(0, 11) + "…" : label}
              </text>
            );
          })}

          {/* Y-axis label */}
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

          {/* Bars */}
          {barGeometry.map((bar, i) => {
            const isHovered = hoveredBar?.seriesId === bar.seriesId && hoveredBar?.index === bar.groupIndex;
            const isDimmed = hoveredBar !== null && !isHovered;
            // Clamp radius so it doesn't exceed half the bar width/height
            const r = Math.min(barRadius, bar.w / 2, bar.h / 2);
            return (
              <g key={`bar-${i}`}>
                <rect
                  x={bar.x}
                  y={bar.y}
                  width={bar.w}
                  height={bar.h}
                  rx={r}
                  ry={r}
                  fill={bar.color}
                  opacity={isDimmed ? 0.3 : isHovered ? 1 : 0.85}
                  style={{ transition: "opacity 150ms ease", cursor: "pointer" }}
                  onMouseEnter={() => handleBarEnter(bar.seriesId, bar.datum, bar.groupIndex)}
                  onMouseLeave={handleBarLeave}
                />
                {/* Value label */}
                {showValues && bar.h > 14 && (
                  <text
                    x={bar.x + bar.w / 2}
                    y={bar.y - 4}
                    textAnchor="middle"
                    fill={colors.text.secondary}
                    fontFamily={monoFont}
                    fontSize={typography.fontSize.xs}
                    opacity={isDimmed ? 0.3 : 1}
                  >
                    {yFormat(bar.value)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Hover tooltip */}
          {hoveredBar &&
            (() => {
              const bar = barGeometry.find(
                (b) => b.seriesId === hoveredBar.seriesId && b.groupIndex === hoveredBar.index,
              );
              if (!bar) return null;
              const tx = bar.x + bar.w / 2;
              const ty = bar.y - 12;
              const text = `${bar.datum.label}: ${yFormat(bar.value)}${bar.datum.subLabel ? ` ${bar.datum.subLabel}` : ""}`;
              return (
                <g>
                  <rect
                    x={tx - 60}
                    y={ty - 22}
                    width={120}
                    height={20}
                    rx={4}
                    fill={colors.bg.elevated}
                    stroke={colors.border.default}
                    strokeWidth={1}
                  />
                  <text
                    x={tx}
                    y={ty - 9}
                    textAnchor="middle"
                    fill={bar.color}
                    fontFamily={monoFont}
                    fontSize={typography.fontSize.xs}
                  >
                    {text}
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
                  <rect x={0} y={-6} width={12} height={12} rx={2} fill={color} />
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

export default BarChart;
