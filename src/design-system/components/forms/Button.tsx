import type React from "react";
import { borderRadius, colors, shadows, spacing, transitions, typography } from "../../tokens";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  type?: "button" | "submit" | "reset";
}

// ---------------------------------------------------------------------------
// Size maps (derived entirely from design tokens)
// ---------------------------------------------------------------------------

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.fontSize.sm,
    height: "28px",
    gap: spacing.xs,
  },
  md: {
    padding: `${spacing.sm} ${spacing.base}`,
    fontSize: typography.fontSize.md,
    height: "36px",
    gap: spacing.sm,
  },
  lg: {
    padding: `${spacing.md} ${spacing.lg}`,
    fontSize: typography.fontSize.lg,
    height: "44px",
    gap: spacing.sm,
  },
};

// ---------------------------------------------------------------------------
// Variant maps (derived entirely from design tokens)
// ---------------------------------------------------------------------------

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: colors.accent.primary,
    color: colors.text.primary,
    border: `1px solid ${colors.accent.primary}`,
  },
  secondary: {
    backgroundColor: colors.bg.elevated,
    color: colors.text.primary,
    border: `1px solid ${colors.border.default}`,
  },
  ghost: {
    backgroundColor: "transparent",
    color: colors.text.secondary,
    border: "1px solid transparent",
  },
  danger: {
    backgroundColor: colors.state.errorMuted,
    color: colors.state.error,
    border: `1px solid ${colors.state.error}`,
  },
};

const variantHoverStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: colors.accent.primaryHover,
    boxShadow: shadows.glowPrimary,
  },
  secondary: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.strong,
  },
  ghost: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    color: colors.text.primary,
  },
  danger: {
    backgroundColor: "rgba(250, 128, 114, 0.25)",
    boxShadow: shadows.glowError,
  },
};

// ---------------------------------------------------------------------------
// Spinner (pure CSS, no external dependencies)
// ---------------------------------------------------------------------------

function Spinner({ size }: { size: ButtonSize }) {
  const spinnerSize = size === "sm" ? 12 : size === "md" ? 14 : 16;
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{
        display: "inline-block",
        width: spinnerSize,
        height: spinnerSize,
        border: "2px solid rgba(255, 255, 255, 0.2)",
        borderTopColor: colors.text.primary,
        borderRadius: borderRadius.full,
        animation: "nexus-btn-spin 0.6s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Button component
// ---------------------------------------------------------------------------

export function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon,
  children,
  onClick,
  className,
  type = "button",
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: typography.fontFamily.sans,
    fontWeight: typography.fontWeight.medium,
    lineHeight: typography.lineHeight.tight,
    letterSpacing: typography.letterSpacing.wide,
    borderRadius: borderRadius.md,
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isDisabled ? 0.5 : 1,
    outline: "none",
    textDecoration: "none",
    whiteSpace: "nowrap",
    userSelect: "none",
    transition: [
      transitions.preset.bg,
      transitions.preset.color,
      transitions.preset.shadow,
      transitions.preset.border,
    ].join(", "),
    ...sizeStyles[size],
    ...variantStyles[variant],
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) return;
    const el = e.currentTarget;
    const hover = variantHoverStyles[variant];
    Object.assign(el.style, hover);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) return;
    const el = e.currentTarget;
    const base = variantStyles[variant];
    el.style.backgroundColor = base.backgroundColor ?? "";
    el.style.boxShadow = "none";
    el.style.borderColor = (base.border as string)?.match(/(?:1px solid )(.+)/)?.[1] ?? "";
    el.style.color = base.color ?? "";
  };

  return (
    <>
      {/* Keyframe injection (once per page, idempotent) */}
      <style>{`@keyframes nexus-btn-spin{to{transform:rotate(360deg)}}`}</style>

      <button
        type={type}
        disabled={isDisabled}
        onClick={isDisabled ? undefined : onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={className}
        style={baseStyle}
      >
        {loading ? (
          <Spinner size={size} />
        ) : icon ? (
          <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
        ) : null}
        {children}
      </button>
    </>
  );
}
