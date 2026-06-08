'use client';
import React from 'react';

/**
 * SVGChartContainer — canonical dark-background SVG wrapper for all inline charts.
 *
 * Eliminates the repeated `<svg viewBox={...}><rect fill="#050505" rx={...}>` pattern
 * found in every tool page chart. Provides a consistent dark canvas with proper
 * aria labeling.
 *
 * @example
 * <SVGChartContainer W={520} H={380} ariaLabel="Volcano plot">
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
  /** Corner radius for the background rect (default 12) */
  rx?: number;
  /** Background fill (default '#050505') */
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
  rx = 12,
  fill = '#050505',
  style,
  svgRef,
  children,
}: SVGChartContainerProps) {
  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: '100%', ...style }}
    >
      <rect width={W} height={H} fill={fill} rx={rx} />
      {children}
    </svg>
  );
}
