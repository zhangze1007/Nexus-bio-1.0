import React, { useState, useCallback, useMemo } from 'react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InputProps {
  /** Label text shown above / floating above the input */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Controlled value */
  value?: string;
  /** Change handler */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Error message -- triggers error styling when truthy */
  error?: string;
  /** Disabled state */
  disabled?: boolean;
  /** HTML input type */
  type?: string;
  /** Optional leading icon (rendered as a React node) */
  icon?: React.ReactNode;
  /** Additional class names for the wrapper */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Input({
  label,
  placeholder,
  value,
  onChange,
  error,
  disabled = false,
  type = 'text',
  icon,
  className,
}: InputProps) {
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => setFocused(false), []);

  // Determine whether the label should float (focused or has content)
  const isFloating = focused || (value !== undefined && value.length > 0);

  // ---- Inline style objects (all derived from tokens) ---------------------

  const wrapperStyle: React.CSSProperties = useMemo(
    () => ({
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.xs,
      width: '100%',
    }),
    [],
  );

  const inputContainerStyle: React.CSSProperties = useMemo(
    () => ({
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: error
        ? colors.state.errorMuted
        : 'rgba(255, 255, 255, 0.04)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: `1px solid ${
        error
          ? colors.state.error
          : focused
            ? colors.border.accent
            : colors.border.default
      }`,
      borderRadius: borderRadius.md,
      padding: `${spacing.md} ${spacing.base}`,
      minHeight: '44px',
      boxShadow: focused
        ? error
          ? shadows.glowError
          : shadows.glowPrimary
        : shadows.inner,
      transition: [
        transitions.preset.border,
        transitions.preset.shadow,
      ].join(', '),
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'text',
    }),
    [error, focused, disabled],
  );

  const iconStyle: React.CSSProperties = useMemo(
    () => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      width: '18px',
      height: '18px',
      color: error
        ? colors.state.error
        : focused
          ? colors.accent.primary
          : colors.text.tertiary,
      transition: transitions.preset.color,
    }),
    [error, focused],
  );

  const inputStyle: React.CSSProperties = useMemo(
    () => ({
      flex: 1,
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: disabled ? colors.text.disabled : colors.text.primary,
      fontFamily: typography.fontFamily.sans,
      fontSize: typography.fontSize.md,
      fontWeight: typography.fontWeight.regular,
      lineHeight: typography.lineHeight.normal,
      letterSpacing: typography.letterSpacing.normal,
      caretColor: error ? colors.state.error : colors.accent.primary,
      width: '100%',
      // Push content down when label is floating so they don't overlap
      paddingTop: label ? spacing.lg : 0,
    }),
    [disabled, error, label],
  );

  const labelStyle: React.CSSProperties = useMemo(
    () => ({
      position: 'absolute',
      left: icon ? `calc(18px + ${spacing.sm} + ${spacing.sm})` : spacing.base,
      top: isFloating ? spacing.xs : '50%',
      transform: isFloating ? 'translateY(0)' : 'translateY(-50%)',
      fontSize: isFloating ? typography.fontSize.xs : typography.fontSize.md,
      fontWeight: isFloating
        ? typography.fontWeight.medium
        : typography.fontWeight.regular,
      color: error
        ? colors.state.error
        : focused
          ? colors.accent.primary
          : colors.text.tertiary,
      pointerEvents: 'none',
      transition: [
        `top ${transitions.duration.normal} ${transitions.easing.apple}`,
        `transform ${transitions.duration.normal} ${transitions.easing.apple}`,
        `font-size ${transitions.duration.normal} ${transitions.easing.apple}`,
        `color ${transitions.duration.normal} ${transitions.easing.apple}`,
      ].join(', '),
      fontFamily: typography.fontFamily.sans,
      lineHeight: typography.lineHeight.tight,
      letterSpacing: typography.letterSpacing.wide,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: `calc(100% - ${spacing['2xl']})`,
    }),
    [icon, isFloating, error, focused],
  );

  const errorStyle: React.CSSProperties = useMemo(
    () => ({
      color: colors.state.error,
      fontSize: typography.fontSize.xs,
      fontFamily: typography.fontFamily.sans,
      fontWeight: typography.fontWeight.regular,
      lineHeight: typography.lineHeight.normal,
      paddingLeft: spacing.xs,
      letterSpacing: typography.letterSpacing.wide,
    }),
    [],
  );

  // ---- Render -------------------------------------------------------------

  return (
    <div style={wrapperStyle} className={className}>
      <div style={inputContainerStyle}>
        {icon && <span style={iconStyle}>{icon}</span>}

        {label && (
          <label style={labelStyle} aria-hidden="true">
            {label}
          </label>
        )}

        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={focused ? placeholder : undefined}
          disabled={disabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={inputStyle}
          aria-label={label}
          aria-invalid={!!error}
          aria-describedby={error ? `${label}-error` : undefined}
        />
      </div>

      {error && (
        <span id={`${label}-error`} style={errorStyle} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
