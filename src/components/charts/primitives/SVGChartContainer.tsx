'use client';
import React from 'react';
import { colors } from '../../../design-system/tokens';
import { PAPER_THEME } from '../chartTheme';

/**
 * SVGChartContainer — canonical SVG wrapper for all inline charts.
 *
 * Supports two variants:
 * - 'dark' (default): deep black canvas (#050505), rx=12
 * - 'paper': warm white canvas (#FAFAF8), rx=2, thin border — Nature/Science journal style
 *
 * @example
 * <SVGChartContainer W={520} H={380} variant="paper" ariaLabel="Volcano plot">
 *   <ChartGrid W={520} H={380} PAD={44} />
 *   {/* scatter points *\/}
 * </SVGChartContainer>
 */
export interface SVGChartContainerProps {
  /** Viewport width */
  W: number;
  /** Viewport height */
  H: number;
  /** Accessible label for the chart */
  ariaLabel?: string;
  /** Chart style variant — 'dark' (default) or 'paper' (white bg) */
  variant?: 'dark' | 'paper';
  /** Corner radius for the background rect (default: 12 dark, 2 paper) */
  rx?: number;
  /** Background fill (default: #050505 dark, #FAFAF8 paper) */
  fill?: string;
  /** Additional SVG style overrides */
  style?: React.CSSProperties;
  /** Optional SVG ref */
  svgRef?: React.RefObject<SVGSVGElement | null>;
  children: React.ReactNode;
}

export default function SVGChartContainer({
  W,
  H,
  ariaLabel = 'Chart',
  variant = 'dark',
  rx,
  fill,
  style,
  svgRef,
  children,
}: SVGChartContainerProps) {
  const isPaper = variant === 'paper';
  const resolvedFill = fill ?? (isPaper ? PAPER_THEME.bg : colors.bg.primary);
  const resolvedRx = rx ?? (isPaper ? PAPER_THEME.borderRadius : 12);

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${W} ${H}`}
      style={{
        width: '100%',
        height: '100%',
        ...(isPaper ? { border: `1px solid ${PAPER_THEME.border}` } : {}),
        ...style,
      }}
    >
      <rect width={W} height={H} fill={resolvedFill} rx={resolvedRx} />
      {children}
    </svg>
  );
}
