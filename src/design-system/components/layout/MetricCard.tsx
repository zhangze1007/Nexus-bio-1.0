'use client';

import React from 'react';
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
} from '../../tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Trend = 'up' | 'down' | 'neutral';

interface MetricCardProps {
  /** Metric label displayed above the value */
  label: string;
  /** Primary metric value */
  value: string | number;
  /** Optional unit displayed after the value */
  unit?: string;
  /** Trend direction */
  trend?: Trend;
  /** Trend value (e.g. "+12%" or "5.2") */
  trendValue?: string | number;
  /** Optional icon element rendered before the label */
  icon?: React.ReactNode;
  /** Additional CSS class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Trend helpers
// ---------------------------------------------------------------------------

const trendColors: Record<Trend, string> = {
  up: colors.state.success,
  down: colors.state.error,
  neutral: colors.text.tertiary,
};

const trendArrows: Record<Trend, string> = {
  up: '▲',   // black up-pointing triangle
  down: '▼', // black down-pointing triangle
  neutral: '◆', // diamond
};

// ---------------------------------------------------------------------------
// Glass-morphism surface constant
// ---------------------------------------------------------------------------

const GLASS_BG = 'rgba(28, 34, 40, 0.72)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.08)';
const GLASS_BORDER_HOVER = 'rgba(255, 255, 255, 0.12)';

// ---------------------------------------------------------------------------
// MetricCard component
// ---------------------------------------------------------------------------

export function MetricCard({
  label,
  value,
  unit,
  trend,
  trendValue,
  icon,
  className,
}: MetricCardProps) {
  const [hovered, setHovered] = React.useState(false);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    padding: `${spacing.base} ${spacing.lg}`,
    borderRadius: borderRadius.xl,
    backgroundColor: GLASS_BG,
    border: `1px solid ${hovered ? GLASS_BORDER_HOVER : GLASS_BORDER}`,
    boxShadow: hovered ? shadows.sm : 'none',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    transition: transitions.preset.all,
    overflow: 'hidden',
    cursor: 'default',
  };

  const labelRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
    lineHeight: String(typography.lineHeight.tight),
    margin: 0,
  };

  const iconStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '14px',
    height: '14px',
    color: colors.text.tertiary,
    flexShrink: 0,
  };

  const valueRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: spacing.xs,
    minWidth: 0,
  };

  const valueStyle: React.CSSProperties = {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
    lineHeight: String(typography.lineHeight.tight),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    margin: 0,
  };

  const unitStyle: React.CSSProperties = {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    flexShrink: 0,
  };

  const trendBadgeStyle: React.CSSProperties = trend
    ? {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        fontFamily: typography.fontFamily.mono,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.medium,
        color: trendColors[trend],
        marginLeft: spacing.sm,
        padding: `${spacing['2xs']} ${spacing.xs}`,
        borderRadius: borderRadius.sm,
        backgroundColor:
          trend === 'up'
            ? colors.state.successMuted
            : trend === 'down'
            ? colors.state.errorMuted
            : 'rgba(107, 107, 118, 0.15)',
        lineHeight: String(typography.lineHeight.tight),
        whiteSpace: 'nowrap',
      }
    : {};

  const formattedValue =
    typeof value === 'number'
      ? value < 10
        ? value.toFixed(3)
        : value < 100
        ? value.toFixed(2)
        : value.toFixed(1)
      : value;

  return (
    <div
      className={className}
      style={containerStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Label row */}
      <p style={labelRowStyle}>
        {icon && <span style={iconStyle}>{icon}</span>}
        {label}
      </p>

      {/* Value row */}
      <div style={valueRowStyle}>
        <span style={valueStyle}>{formattedValue}</span>
        {unit && <span style={unitStyle}>{unit}</span>}
        {trend && (
          <span style={trendBadgeStyle}>
            <span style={{ fontSize: '8px' }}>{trendArrows[trend]}</span>
            {trendValue !== undefined && (
              <span>
                {typeof trendValue === 'number'
                  ? `${trendValue > 0 ? '+' : ''}${trendValue.toFixed(1)}%`
                  : trendValue}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
