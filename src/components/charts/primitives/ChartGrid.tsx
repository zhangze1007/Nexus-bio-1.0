'use client';
import React from 'react';
import { THEME } from '../../../theme';

/**
 * ChartGrid — reusable grid lines + axis lines for SVG charts.
 *
 * Renders a grid of evenly-spaced horizontal and vertical lines inside a
 * chart region, plus the two primary axis lines (bottom horizontal, left vertical).
 * This is the most duplicated SVG pattern across all tool pages.
 *
 * @example
 * <SVGChartContainer W={520} H={380}>
 *   <ChartGrid W={520} H={380} PAD={44} gridCount={8} />
 * </SVGChartContainer>
 */
export interface ChartGridProps {
  /** Total SVG width */
  W: number;
  /** Total SVG height */
  H: number;
  /** Padding from edges to the plot area */
  PAD: number;
  /** Number of grid divisions (default 8) */
  gridCount?: number;
  /** Grid line color (default: rgba(255,255,255,0.04)) */
  gridColor?: string;
  /** Grid line stroke width (default 0.5) */
  gridStroke?: number;
  /** Axis line color (default: rgba(255,255,255,0.1)) */
  axisColor?: string;
  /** Show grid lines (default true) */
  showGrid?: boolean;
  /** Show axis lines (default true) */
  showAxes?: boolean;
}

export default function ChartGrid({
  W,
  H,
  PAD,
  gridCount = 8,
  gridColor = 'rgba(255,255,255,0.04)',
  gridStroke = 0.5,
  axisColor = 'rgba(255,255,255,0.1)',
  showGrid = true,
  showAxes = true,
}: ChartGridProps) {
  return (
    <g>
      {showGrid && Array.from({ length: gridCount + 1 }).map((_, i) => {
        const gx = PAD + (i / gridCount) * (W - PAD * 2);
        const gy = PAD + (i / gridCount) * (H - PAD * 2);
        return (
          <g key={i}>
            <line x1={gx} y1={PAD} x2={gx} y2={H - PAD} stroke={gridColor} strokeWidth={gridStroke} />
            <line x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke={gridColor} strokeWidth={gridStroke} />
          </g>
        );
      })}
      {showAxes && (
        <>
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke={axisColor} />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke={axisColor} />
        </>
      )}
    </g>
  );
}
