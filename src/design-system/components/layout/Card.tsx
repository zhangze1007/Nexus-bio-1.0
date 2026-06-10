import React from 'react';
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  transitions,
} from '../../tokens';

// ---------------------------------------------------------------------------
// Panel surface constants (mirrors THEME values for layout primitives)
// ---------------------------------------------------------------------------

const PANEL_BG = '#050505';
const PANEL_STRONG = '#111318';
const PANEL_GLASS = 'rgba(28, 34, 40, 0.84)';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CardVariant = 'default' | 'elevated' | 'glass';

interface CardProps {
  /** Card content */
  children: React.ReactNode;
  /** Additional CSS class names */
  className?: string;
  /** Padding size — maps to design-system spacing tokens (default: 'base') */
  padding?: 'sm' | 'md' | 'base' | 'lg' | 'xl';
  /** Enable hover elevation effect */
  hoverable?: boolean;
  /** Click handler — also sets cursor to pointer */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Visual variant */
  variant?: CardVariant;
}

// ---------------------------------------------------------------------------
// Padding map (from design-system spacing tokens)
// ---------------------------------------------------------------------------

const paddingMap: Record<NonNullable<CardProps['padding']>, string> = {
  sm: spacing.sm,
  md: spacing.md,
  base: spacing.base,
  lg: spacing.lg,
  xl: spacing.xl,
};

// ---------------------------------------------------------------------------
// Variant base styles
// ---------------------------------------------------------------------------

const variantBackgrounds: Record<CardVariant, string> = {
  default: PANEL_BG,
  elevated: PANEL_STRONG,
  glass: PANEL_GLASS,
};

const variantBorders: Record<CardVariant, string> = {
  default: `1px solid ${colors.border.subtle}`,
  elevated: `1px solid ${colors.border.default}`,
  glass: `1px solid rgba(255, 255, 255, 0.08)`,
};

const variantShadows: Record<CardVariant, string> = {
  default: 'none',
  elevated: shadows.sm,
  glass: 'none',
};

const variantHoverShadows: Record<CardVariant, string> = {
  default: shadows.sm,
  elevated: shadows.base,
  glass: shadows.sm,
};

const variantHoverBorders: Record<CardVariant, string> = {
  default: `1px solid ${colors.border.default}`,
  elevated: `1px solid ${colors.border.strong}`,
  glass: `1px solid rgba(255, 255, 255, 0.12)`,
};

// ---------------------------------------------------------------------------
// Card component
// ---------------------------------------------------------------------------

export function Card({
  children,
  className,
  padding = 'base',
  hoverable = false,
  onClick,
  variant = 'default',
}: CardProps) {
  const [hovered, setHovered] = React.useState(false);

  const isInteractive = hoverable || !!onClick;

  const baseStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    padding: paddingMap[padding],
    borderRadius: borderRadius.xl,
    backgroundColor: variantBackgrounds[variant],
    border: variantBorders[variant],
    boxShadow: variantShadows[variant],
    cursor: onClick ? 'pointer' : isInteractive ? 'pointer' : 'default',
    transition: [
      transitions.preset.shadow,
      transitions.preset.border,
      transitions.preset.transform,
    ].join(', '),

    // Hover elevation
    ...(hovered && isInteractive
      ? {
          boxShadow: variantHoverShadows[variant],
          border: variantHoverBorders[variant],
          transform: 'translateY(-1px)',
        }
      : {}),
  };

  // Glass variant gets backdrop-filter
  if (variant === 'glass') {
    (baseStyle as Record<string, unknown>).backdropFilter = 'blur(12px)';
    (baseStyle as Record<string, unknown>).WebkitBackdropFilter = 'blur(12px)';
  }

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={className}
      style={baseStyle}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
              }
            }
          : undefined
      }
      onMouseEnter={isInteractive ? () => setHovered(true) : undefined}
      onMouseLeave={isInteractive ? () => setHovered(false) : undefined}
    >
      {children}
    </div>
  );
}
