"use client";
import React from "react";
import { colors, typography } from "../../../design-system/tokens";
import { THEME } from "../../../theme";

/**
 * ChartAxisLabels — axis title labels for SVG charts.
 *
 * Renders the X-axis label (centered bottom) and Y-axis label (rotated, centered left).
 * This pattern appears in every chart across the codebase.
 *
 * @example
 * <ChartAxisLabels W={520} H={380} PAD={44} xLabel="Time (min)" yLabel="Concentration" />
 */
export interface ChartAxisLabelsProps {
  /** Total SVG width */
  W: number;
  /** Total SVG height */
  H: number;
  /** Padding from edges to the plot area */
  PAD: number;
  /** X-axis label text */
  xLabel?: string;
  /** Y-axis label text */
  yLabel?: string;
  /** Font family (default: THEME.MONO) */
  fontFamily?: string;
  /** Font size (default: typography.fontSize.xs) */
  fontSize?: string;
  /** Label fill color (default: colors.text.tertiary) */
  fill?: string;
  /** Y-axis label X position (default: 12) */
  yLabelX?: number;
  /** Extra bottom offset for x-label (default: 6 from bottom) */
  xLabelBottomOffset?: number;
}

export default function ChartAxisLabels({
  W,
  H,
  PAD,
  xLabel,
  yLabel,
  fontFamily = THEME.MONO,
  fontSize = typography.fontSize.xs,
  fill = colors.text.tertiary,
  yLabelX = 12,
  xLabelBottomOffset = 6,
}: ChartAxisLabelsProps) {
  return (
    <g>
      {xLabel && (
        <text
          x={W / 2}
          y={H - xLabelBottomOffset}
          textAnchor="middle"
          fontFamily={fontFamily}
          fontSize={fontSize}
          fill={fill}
        >
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text
          x={yLabelX}
          y={H / 2}
          textAnchor="middle"
          fontFamily={fontFamily}
          fontSize={fontSize}
          fill={fill}
          transform={`rotate(-90,${yLabelX},${H / 2})`}
        >
          {yLabel}
        </text>
      )}
    </g>
  );
}
