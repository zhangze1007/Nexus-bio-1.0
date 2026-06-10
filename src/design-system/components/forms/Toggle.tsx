import React, { useMemo } from 'react';
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

export interface ToggleProps {
  /** Whether the toggle is on */
  checked: boolean;
  /** Callback when toggle state changes */
  onChange: (checked: boolean) => void;
  /** Label displayed to the right of the toggle */
  label?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Toggle size */
  size?: 'sm' | 'md';
  /** Additional class names for the wrapper */
  className?: string;
}

// ---------------------------------------------------------------------------
// Size maps (derived from design tokens)
// ---------------------------------------------------------------------------

interface SizeConfig {
  trackWidth: number;
  trackHeight: number;
  thumbSize: number;
  thumbOffset: number;
  fontSize: string;
  gap: string;
}

const sizeMap: Record<'sm' | 'md', SizeConfig> = {
  sm: {
    trackWidth: 32,
    trackHeight: 18,
    thumbSize: 14,
    thumbOffset: 2,
    fontSize: typography.fontSize.sm,
    gap: spacing.sm,
  },
  md: {
    trackWidth: 40,
    trackHeight: 22,
    thumbSize: 18,
    thumbOffset: 2,
    fontSize: typography.fontSize.md,
    gap: spacing.md,
  },
};

// ---------------------------------------------------------------------------
// Toggle component
// ---------------------------------------------------------------------------

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md',
  className,
}: ToggleProps) {
  const cfg = sizeMap[size];

  const thumbLeft = checked
    ? cfg.trackWidth - cfg.thumbSize - cfg.thumbOffset
    : cfg.thumbOffset;

  // ---- Inline style objects (all derived from tokens) ---------------------

  const wrapperStyle: React.CSSProperties = useMemo(
    () => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: cfg.gap,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      userSelect: 'none',
    }),
    [cfg.gap, disabled],
  );

  const trackStyle: React.CSSProperties = useMemo(
    () => ({
      position: 'relative',
      width: cfg.trackWidth,
      height: cfg.trackHeight,
      borderRadius: borderRadius.full,
      backgroundColor: checked
        ? colors.accent.primary
        : colors.bg.tertiary,
      border: `1px solid ${
        checked
          ? colors.accent.primary
          : colors.border.default
      }`,
      boxShadow: checked ? shadows.glowPrimary : shadows.inner,
      transition: [
        `background-color ${transitions.duration.normal} ${transitions.easing.apple}`,
        `border-color ${transitions.duration.normal} ${transitions.easing.apple}`,
        `box-shadow ${transitions.duration.normal} ${transitions.easing.apple}`,
      ].join(', '),
      flexShrink: 0,
    }),
    [checked, cfg.trackWidth, cfg.trackHeight],
  );

  const thumbStyle: React.CSSProperties = useMemo(
    () => ({
      position: 'absolute',
      top: cfg.thumbOffset,
      left: thumbLeft,
      width: cfg.thumbSize,
      height: cfg.thumbSize,
      borderRadius: borderRadius.full,
      backgroundColor: colors.text.primary,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
      transition: `left ${transitions.duration.normal} ${transitions.easing.apple}`,
    }),
    [cfg.thumbOffset, cfg.thumbSize, thumbLeft],
  );

  const labelStyle: React.CSSProperties = useMemo(
    () => ({
      fontFamily: typography.fontFamily.sans,
      fontSize: cfg.fontSize,
      fontWeight: typography.fontWeight.regular,
      lineHeight: typography.lineHeight.normal,
      color: disabled ? colors.text.disabled : colors.text.primary,
      letterSpacing: typography.letterSpacing.normal,
    }),
    [cfg.fontSize, disabled],
  );

  // ---- Handlers -----------------------------------------------------------

  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  // ---- Render -------------------------------------------------------------

  return (
    <div
      style={wrapperStyle}
      className={className}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div style={trackStyle}>
        <div style={thumbStyle} />
      </div>
      {label && <span style={labelStyle}>{label}</span>}
    </div>
  );
}
