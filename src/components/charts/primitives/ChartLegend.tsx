'use client';
import React from 'react';
import { THEME } from '../../../theme';

/**
 * ChartLegend — reusable series legend for SVG charts.
 *
 * Renders colored indicators (circles or lines) with labels in a vertical stack.
 * Supports both dot-style (scatter plots) and line-style (line charts) indicators.
 *
 * @example
 * <ChartLegend
 *   x={W - PAD - 110} y={PAD + 6}
 *   items={[
 *     { label: 'Transcriptomics', color: '#CFC4E3' },
 *     { label: 'Proteomics', color: '#AFC3D6' },
 *   ]}
 * />
 */
export interface ChartLegendItem {
  /** Display label */
  label: string;
  /** Series color */
  color: string;
  /** Whether this item is active (default true). When false, renders at reduced opacity. */
  active?: boolean;
}

export interface ChartLegendProps {
  /** X position of the legend group */
  x: number;
  /** Y position of the legend group */
  y: number;
  /** Legend items */
  items: ChartLegendItem[];
  /** Indicator style: 'dot' for circle, 'line' for line segment (default 'dot') */
  variant?: 'dot' | 'line';
  /** Vertical spacing between items (default 15) */
  spacing?: number;
  /** Font family (default: THEME.SANS) */
  fontFamily?: string;
  /** Font size (default: '10') */
  fontSize?: string;
  /** Text fill color for active items (default: rgba(250,246,240,0.96)) */
  activeFill?: string;
  /** Text fill color for inactive items (default: rgba(217,225,235,0.68)) */
  inactiveFill?: string;
}

export default function ChartLegend({
  x,
  y,
  items,
  variant = 'dot',
  spacing = 15,
  fontFamily = THEME.SANS,
  fontSize = '10',
  activeFill = 'rgba(250,246,240,0.96)',
  inactiveFill = 'rgba(217,225,235,0.68)',
}: ChartLegendProps) {
  return (
    <g>
      {items.map((item, i) => {
        const active = item.active !== false;
        const opacity = active ? 1 : 0.25;
        return (
          <g key={item.label} transform={`translate(${x}, ${y + i * spacing})`}>
            {variant === 'line' ? (
              <line x1={0} y1={0} x2={13} y2={0} stroke={item.color} strokeWidth={2} opacity={opacity} />
            ) : (
              <circle cx={4} cy={0} r={4} fill={item.color} opacity={opacity} />
            )}
            <text
              x={variant === 'line' ? 17 : 12}
              y={3.5}
              fontFamily={fontFamily}
              fontSize={fontSize}
              fill={active ? activeFill : inactiveFill}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
