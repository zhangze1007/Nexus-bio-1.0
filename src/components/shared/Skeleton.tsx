"use client";
import { THEME } from "../../theme";

/**
 * Skeleton loading placeholder — shimmer animation.
 * Use for async content while data is loading.
 *
 * For more advanced variants (SkeletonCard, SkeletonTable, SkeletonChart),
 * see SkeletonLoader.tsx in the same directory.
 */
export function Skeleton({
  width = "100%",
  height = "20px",
  borderRadius,
  variant = "rect",
  count = 1,
  style,
}: {
  width?: string;
  height?: string;
  borderRadius?: string;
  variant?: "text" | "rect" | "circle";
  count?: number;
  style?: React.CSSProperties;
}) {
  const resolvedRadius = borderRadius ?? (variant === "circle" ? "50%" : variant === "text" ? "4px" : THEME.R_SM);

  const baseStyle: React.CSSProperties = {
    width,
    height,
    borderRadius: resolvedRadius,
    background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`,
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s ease-in-out infinite",
    ...style,
  };

  if (count < 1) return null;

  if (count > 1) {
    return (
      <div style={{ display: "grid", gap: "8px" }}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} style={baseStyle} />
        ))}
      </div>
    );
  }

  return <div style={baseStyle} />;
}

/**
 * Skeleton group for sim loading states.
 * Shows shimmer bars mimicking metric cards.
 */
export function SimSkeleton() {
  return (
    <div style={{ display: "grid", gap: "8px", padding: "12px 16px" }}>
      <Skeleton height="14px" width="60%" variant="text" />
      <Skeleton height="32px" />
      <Skeleton height="14px" width="80%" variant="text" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginTop: "4px" }}>
        <Skeleton height="48px" borderRadius="12px" />
        <Skeleton height="48px" borderRadius="12px" />
        <Skeleton height="48px" borderRadius="12px" />
      </div>
    </div>
  );
}
