'use client';
import React from 'react';
import { colors, typography } from '../../../design-system/tokens';

/**
 * HeatmapGrid — rect-based heatmap for SVG charts.
 *
 * Renders a 2D grid of colored rectangles from a matrix of values, with optional
 * axis labels and a vertical colorbar. Used for correlation heatmaps, phase-space
 * heatmaps, and similar 2D data visualizations.
 *
 * @example
 * <HeatmapGrid
 *   matrix={correlationMatrix}
 *   colorFn={divergingColor}
 *   x={60} y={60} width={240} height={240}
 *   xLabels={geneNames} yLabels={geneNames}
 *   colorbar={{ x: 308, y: 60, height: 240 }}
 * />
 */
export interface HeatmapGridProps {
  /** 2D matrix of values (rows x cols) */
  matrix: number[][];
  /** Function mapping a value (typically -1..1 or 0..1) to a CSS color string */
  colorFn: (value: number) => string;
  /** X position of the grid */
  x: number;
  /** Y position of the grid */
  y: number;
  /** Total grid width */
  width: number;
  /** Total grid height */
  height: number;
  /** Optional labels for the X axis (displayed above, rotated) */
  xLabels?: string[];
  /** Optional labels for the Y axis (displayed left) */
  yLabels?: string[];
  /** Optional colorbar configuration */
  colorbar?: {
    /** X position of the colorbar */
    x: number;
    /** Y position of the colorbar */
    y: number;
    /** Height of the colorbar */
    height: number;
    /** Width of the colorbar (default 8) */
    width?: number;
    /** Gradient stops as [offset, value] pairs for the colorFn */
    stops?: Array<{ offset: string; value: number }>;
    /** Tick marks as [position_fraction, label] pairs */
    ticks?: Array<{ t: number; label: string }>;
    /** Unit label above the colorbar */
    unitLabel?: string;
  };
  /** Font family for labels (default: typography.fontFamily.mono) */
  fontFamily?: string;
  /** Font size for labels (default: typography.fontSize.xs) */
  fontSize?: string;
  /** Label fill color (default: colors.text.tertiary) */
  labelFill?: string;
  /** Gradient ID prefix (default: 'hm') — must be unique per chart instance */
  gradientId?: string;
}

export default function HeatmapGrid({
  matrix,
  colorFn,
  x,
  y,
  width,
  height,
  xLabels,
  yLabels,
  colorbar,
  fontFamily = typography.fontFamily.mono,
  fontSize = typography.fontSize.xs,
  labelFill = colors.text.tertiary,
  gradientId = 'hm',
}: HeatmapGridProps) {
  const rows = matrix.length;
  if (rows === 0) return null;
  const cols = matrix[0]?.length ?? 0;
  if (cols === 0) return null;

  const cellW = width / cols;
  const cellH = height / rows;

  return (
    <g>
      {/* Heatmap cells */}
      {matrix.map((row, yi) =>
        row.map((val, xi) => (
          <rect
            key={`${xi}-${yi}`}
            x={x + xi * cellW}
            y={y + yi * cellH}
            width={cellW}
            height={cellH}
            fill={colorFn(val)}
          />
        ))
      )}

      {/* X-axis labels (rotated) */}
      {xLabels?.map((label, i) => (
        <text
          key={`xl-${i}`}
          x={x + i * cellW + cellW / 2}
          y={y - 4}
          textAnchor="start"
          fontFamily={fontFamily}
          fontSize={fontSize}
          fill={labelFill}
          transform={`rotate(-60,${x + i * cellW + cellW / 2},${y - 4})`}
        >
          {label}
        </text>
      ))}

      {/* Y-axis labels */}
      {yLabels?.map((label, i) => (
        <text
          key={`yl-${i}`}
          x={x - 2}
          y={y + i * cellH + cellH * 0.65}
          textAnchor="end"
          fontFamily={fontFamily}
          fontSize={fontSize}
          fill={labelFill}
        >
          {label}
        </text>
      ))}

      {/* Colorbar */}
      {colorbar && (
        <g>
          <defs>
            <linearGradient id={`${gradientId}-grad`} x1="0" y1="0" x2="0" y2="1">
              {(colorbar.stops ?? [
                { offset: '0%', value: 1 },
                { offset: '50%', value: 0 },
                { offset: '100%', value: -1 },
              ]).map((stop) => (
                <stop
                  key={stop.offset}
                  offset={stop.offset}
                  stopColor={colorFn(stop.value)}
                />
              ))}
            </linearGradient>
          </defs>
          <rect
            x={colorbar.x}
            y={colorbar.y}
            width={colorbar.width ?? 8}
            height={colorbar.height}
            fill={`url(#${gradientId}-grad)`}
            rx="2"
          />
          {colorbar.ticks?.map(({ t, label }) => {
            const tickY = colorbar.y + t * colorbar.height;
            return (
              <g key={label}>
                <line
                  x1={colorbar.x + (colorbar.width ?? 8)}
                  y1={tickY}
                  x2={colorbar.x + (colorbar.width ?? 8) + 3}
                  y2={tickY}
                  stroke={colors.text.tertiary}
                  strokeWidth={0.7}
                />
                <text
                  x={colorbar.x + (colorbar.width ?? 8) + 5}
                  y={tickY + 3}
                  fontFamily={fontFamily}
                  fontSize={fontSize}
                  fill={labelFill}
                >
                  {label}
                </text>
              </g>
            );
          })}
          {colorbar.unitLabel && (
            <text
              x={colorbar.x + (colorbar.width ?? 8) / 2}
              y={colorbar.y - 6}
              textAnchor="middle"
              fontFamily={fontFamily}
              fontSize={fontSize}
              fill={colors.text.tertiary}
            >
              {colorbar.unitLabel}
            </text>
          )}
        </g>
      )}
    </g>
  );
}
