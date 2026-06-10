import React from 'react';
import { colors, spacing, typography, borderRadius } from '../../tokens';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  success: {
    bg: colors.state.successMuted,
    text: colors.state.success,
  },
  warning: {
    bg: colors.state.warningMuted,
    text: colors.state.warning,
  },
  error: {
    bg: colors.state.errorMuted,
    text: colors.state.error,
  },
  info: {
    bg: colors.state.infoMuted,
    text: colors.state.info,
  },
  neutral: {
    bg: 'rgba(255, 255, 255, 0.08)',
    text: colors.text.secondary,
  },
};

const sizeStyles: Record<BadgeSize, { padding: string; fontSize: string; lineHeight: string }> = {
  sm: {
    padding: `${spacing['2xs']} ${spacing.xs}`,
    fontSize: typography.fontSize.xs,
    lineHeight: String(typography.lineHeight.tight),
  },
  md: {
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.fontSize.sm,
    lineHeight: String(typography.lineHeight.snug),
  },
};

export function Badge({ variant, size = 'sm', children, className }: BadgeProps) {
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: sizeStyle.padding,
    fontSize: sizeStyle.fontSize,
    lineHeight: sizeStyle.lineHeight,
    fontFamily: typography.fontFamily.sans,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: typography.letterSpacing.wide,
    color: variantStyle.text,
    backgroundColor: variantStyle.bg,
    borderRadius: borderRadius.full,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  };

  return (
    <span style={style} className={className}>
      {children}
    </span>
  );
}
