import type React from "react";
import { borderRadius, colors, spacing, transitions, typography } from "../../tokens";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChipVariant = "neutral" | "cool" | "warm" | "mint" | "lilac";

interface ChipProps {
  /** Color variant */
  variant?: ChipVariant;
  /** Content inside the chip */
  children: React.ReactNode;
  /** Click handler for the chip body */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Callback when the remove button is clicked; renders an X button when provided */
  onRemove?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Whether the chip is in selected (active) state */
  selected?: boolean;
  /** Disabled state — no interactions, reduced opacity */
  disabled?: boolean;
  /** Additional CSS class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Chip color tokens (derived from the design-system palette)
// ---------------------------------------------------------------------------

const CHIP_NEUTRAL = {
  bg: "rgba(255, 255, 255, 0.08)",
  bgSelected: "rgba(255, 255, 255, 0.18)",
  text: colors.text.secondary,
  textSelected: colors.text.primary,
  border: colors.border.subtle,
  borderSelected: colors.border.strong,
  removeHover: "rgba(255, 255, 255, 0.15)",
};

const CHIP_COOL = {
  bg: "rgba(96, 165, 250, 0.12)",
  bgSelected: "rgba(96, 165, 250, 0.28)",
  text: "#93C5FD",
  textSelected: "#BFDBFE",
  border: "rgba(96, 165, 250, 0.2)",
  borderSelected: "rgba(96, 165, 250, 0.45)",
  removeHover: "rgba(96, 165, 250, 0.2)",
};

const CHIP_WARM = {
  bg: "rgba(250, 128, 114, 0.12)",
  bgSelected: "rgba(250, 128, 114, 0.28)",
  text: "#FCA5A5",
  textSelected: "#FECACA",
  border: "rgba(250, 128, 114, 0.2)",
  borderSelected: "rgba(250, 128, 114, 0.45)",
  removeHover: "rgba(250, 128, 114, 0.2)",
};

const CHIP_MINT = {
  bg: "rgba(74, 222, 128, 0.12)",
  bgSelected: "rgba(74, 222, 128, 0.28)",
  text: "#86EFAC",
  textSelected: "#BBF7D0",
  border: "rgba(74, 222, 128, 0.2)",
  borderSelected: "rgba(74, 222, 128, 0.45)",
  removeHover: "rgba(74, 222, 128, 0.2)",
};

const CHIP_LILAC = {
  bg: "rgba(168, 85, 247, 0.12)",
  bgSelected: "rgba(168, 85, 247, 0.28)",
  text: "#D8B4FE",
  textSelected: "#E9D5FF",
  border: "rgba(168, 85, 247, 0.2)",
  borderSelected: "rgba(168, 85, 247, 0.45)",
  removeHover: "rgba(168, 85, 247, 0.2)",
};

interface ChipPalette {
  bg: string;
  bgSelected: string;
  text: string;
  textSelected: string;
  border: string;
  borderSelected: string;
  removeHover: string;
}

const chipColorMap: Record<ChipVariant, ChipPalette> = {
  neutral: CHIP_NEUTRAL,
  cool: CHIP_COOL,
  warm: CHIP_WARM,
  mint: CHIP_MINT,
  lilac: CHIP_LILAC,
};

// ---------------------------------------------------------------------------
// Chip component
// ---------------------------------------------------------------------------

export function Chip({
  variant = "neutral",
  children,
  onClick,
  onRemove,
  selected = false,
  disabled = false,
  className,
}: ChipProps) {
  const palette = chipColorMap[variant];

  const containerStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: spacing.xs,
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.sans,
    fontWeight: typography.fontWeight.medium,
    lineHeight: typography.lineHeight.tight,
    color: selected ? palette.textSelected : palette.text,
    backgroundColor: selected ? palette.bgSelected : palette.bg,
    border: `1px solid ${selected ? palette.borderSelected : palette.border}`,
    borderRadius: borderRadius.full,
    cursor: disabled ? "not-allowed" : onClick ? "pointer" : "default",
    opacity: disabled ? 0.45 : 1,
    userSelect: "none",
    whiteSpace: "nowrap",
    transition: [
      transitions.preset.bg,
      transitions.preset.color,
      transitions.preset.border,
      transitions.preset.opacity,
    ].join(", "),
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !onClick) return;
    onClick(e);
  };

  const handleRemoveClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (disabled || !onRemove) return;
    onRemove(e);
  };

  const handleContainerEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !onClick) return;
    e.currentTarget.style.backgroundColor = palette.bgSelected;
  };

  const handleContainerLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !onClick) return;
    e.currentTarget.style.backgroundColor = selected ? palette.bgSelected : palette.bg;
  };

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      style={containerStyle}
      className={className}
      onClick={handleContainerClick}
      onMouseEnter={handleContainerEnter}
      onMouseLeave={handleContainerLeave}
    >
      <span style={{ pointerEvents: "none" }}>{children}</span>

      {onRemove && (
        <button
          type="button"
          aria-label="Remove"
          onClick={handleRemoveClick}
          disabled={disabled}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 16,
            height: 16,
            padding: 0,
            border: "none",
            borderRadius: borderRadius.full,
            backgroundColor: "transparent",
            color: selected ? palette.textSelected : palette.text,
            cursor: disabled ? "not-allowed" : "pointer",
            lineHeight: 1,
            flexShrink: 0,
            transition: `background-color ${transitions.duration.fast}ms ${transitions.easing.default}`,
          }}
          onMouseEnter={(e) => {
            if (disabled) return;
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = palette.removeHover;
          }}
          onMouseLeave={(e) => {
            if (disabled) return;
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
          }}
        >
          {/* Simple X icon (8x8 viewBox) */}
          <svg width="10" height="10" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
