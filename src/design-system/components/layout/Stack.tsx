import type React from "react";
import { spacing } from "../../tokens";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GapToken = "xs" | "sm" | "md" | "lg" | "xl";

interface StackProps {
  /** Stack content */
  children: React.ReactNode;
  /** Flex direction (default: 'column') */
  direction?: "row" | "column";
  /** Gap between children — token key or pixel number (default: 'sm') */
  gap?: GapToken | number;
  /** CSS align-items value */
  align?: React.CSSProperties["alignItems"];
  /** CSS justify-content value */
  justify?: React.CSSProperties["justifyContent"];
  /** CSS flex-wrap value */
  wrap?: React.CSSProperties["flexWrap"];
  /** Additional CSS class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Gap token map (from design-system spacing tokens)
// ---------------------------------------------------------------------------

const gapTokenMap: Record<GapToken, string> = {
  xs: spacing.xs, // 4px
  sm: spacing.sm, // 8px
  md: spacing.md, // 12px
  lg: spacing.lg, // 20px
  xl: spacing.xl, // 24px
};

// ---------------------------------------------------------------------------
// Stack component
// ---------------------------------------------------------------------------

export function Stack({ children, direction = "column", gap = "sm", align, justify, wrap, className }: StackProps) {
  const resolvedGap = typeof gap === "number" ? `${gap}px` : gapTokenMap[gap];

  const style: React.CSSProperties = {
    display: "flex",
    flexDirection: direction,
    gap: resolvedGap,
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap,
  };

  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
