"use client";
import { THEME } from "../../theme";

/* ── CSS shimmer keyframes (injected once) ────────────────────────── */
let shimmerInjected = false;
function ensureShimmerKeyframes() {
  if (shimmerInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.textContent = `@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`;
  document.head.appendChild(style);
  shimmerInjected = true;
}

/* ── Shared constants ─────────────────────────────────────────────── */
const BASE_COLOR = "#10131a";
const SHIMMER_COLOR = "#1a1d24";
const SHIMMER_GRADIENT = `linear-gradient(90deg, ${BASE_COLOR} 25%, ${SHIMMER_COLOR} 37%, ${BASE_COLOR} 63%)`;
const SHIMMER_STYLE: React.CSSProperties = {
  backgroundSize: "400% 100%",
  animation: "shimmer 1.6s ease-in-out infinite",
};

/* ── Primitive building block ─────────────────────────────────────── */

interface BoneProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  style?: React.CSSProperties;
  className?: string;
}

function Bone({ width = "100%", height = "20px", borderRadius = THEME.R_SM, style, className }: BoneProps) {
  ensureShimmerKeyframes();
  const w = typeof width === "number" ? `${width}px` : width;
  const h = typeof height === "number" ? `${height}px` : height;
  return (
    <div
      className={className}
      data-testid="skeleton-bone"
      style={{
        width: w,
        height: h,
        borderRadius,
        background: SHIMMER_GRADIENT,
        ...SHIMMER_STYLE,
        ...style,
      }}
    />
  );
}

/* ── SkeletonLine — text placeholder ──────────────────────────────── */

export interface SkeletonLineProps {
  /** Width of the line (CSS value or px number). Default "100%". */
  width?: string | number;
  /** Height of the line. Default 14. */
  height?: number;
  /** Number of lines to render. Default 1. */
  count?: number;
  /** Gap between lines in px. Default 8. */
  gap?: number;
}

export function SkeletonLine({ width = "100%", height = 14, count = 1, gap = 8 }: SkeletonLineProps) {
  if (count <= 1) return <Bone width={width} height={height} borderRadius="4px" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap }} data-testid="skeleton-line-group">
      {Array.from({ length: count }, (_, i) => (
        <Bone
          key={i}
          /* Last line is typically shorter */
          width={i === count - 1 ? "70%" : width}
          height={height}
          borderRadius="4px"
        />
      ))}
    </div>
  );
}

/* ── SkeletonCard — card placeholder ──────────────────────────────── */

export interface SkeletonCardProps {
  /** Card width. Default "100%". */
  width?: string | number;
  /** Card height. Default 180. */
  height?: number;
  /** Whether to show a header skeleton line inside. Default true. */
  showHeader?: boolean;
  /** Number of body skeleton lines. Default 3. */
  bodyLines?: number;
}

export function SkeletonCard({ width = "100%", height = 180, showHeader = true, bodyLines = 3 }: SkeletonCardProps) {
  return (
    <div
      data-testid="skeleton-card"
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height,
        borderRadius: THEME.R_MD,
        border: `1px solid ${THEME.BORDER}`,
        background: BASE_COLOR,
        padding: THEME.SP_MD,
        display: "flex",
        flexDirection: "column",
        gap: THEME.SP_SM,
        overflow: "hidden",
      }}
    >
      {showHeader && (
        <div style={{ display: "flex", alignItems: "center", gap: THEME.SP_SM }}>
          <Bone width={32} height={32} borderRadius="50%" />
          <Bone width="55%" height={14} borderRadius="4px" />
        </div>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, marginTop: showHeader ? 4 : 0 }}>
        {Array.from({ length: bodyLines }, (_, i) => (
          <Bone
            key={i}
            width={i === bodyLines - 1 ? "60%" : "100%"}
            height={12}
            borderRadius="4px"
          />
        ))}
      </div>
    </div>
  );
}

/* ── SkeletonTable — table with rows ──────────────────────────────── */

export interface SkeletonTableProps {
  /** Number of columns. Default 4. */
  columns?: number;
  /** Number of data rows (excluding header). Default 5. */
  rows?: number;
  /** Width of the table. Default "100%". */
  width?: string | number;
  /** Whether to render a header row. Default true. */
  showHeader?: boolean;
}

export function SkeletonTable({ columns = 4, rows = 5, width = "100%", showHeader = true }: SkeletonTableProps) {
  const colTemplate = `repeat(${columns}, 1fr)`;

  return (
    <div
      data-testid="skeleton-table"
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        display: "flex",
        flexDirection: "column",
        gap: 0,
        borderRadius: THEME.R_SM,
        overflow: "hidden",
        border: `1px solid ${THEME.BORDER}`,
      }}
    >
      {/* Header row */}
      {showHeader && (
        <div
          data-testid="skeleton-table-header"
          style={{
            display: "grid",
            gridTemplateColumns: colTemplate,
            gap: THEME.SP_MD,
            padding: `${THEME.SP_SM}px ${THEME.SP_MD}px`,
            background: SHIMMER_COLOR,
            borderBottom: `1px solid ${THEME.BORDER}`,
          }}
        >
          {Array.from({ length: columns }, (_, i) => (
            <Bone key={i} width={`${60 + (i % 3) * 15}%`} height={12} borderRadius="4px" />
          ))}
        </div>
      )}

      {/* Data rows */}
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          data-testid="skeleton-table-row"
          style={{
            display: "grid",
            gridTemplateColumns: colTemplate,
            gap: THEME.SP_MD,
            padding: `${10}px ${THEME.SP_MD}px`,
            borderBottom: r < rows - 1 ? `1px solid ${THEME.BORDER}` : "none",
            background: r % 2 === 0 ? BASE_COLOR : "rgba(17,19,24,0.5)",
          }}
        >
          {Array.from({ length: columns }, (_, c) => (
            <Bone
              key={c}
              width={`${50 + ((r + c) % 4) * 12}%`}
              height={12}
              borderRadius="4px"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── SkeletonChart — chart area placeholder ───────────────────────── */

export interface SkeletonChartProps {
  /** Width of the chart area. Default "100%". */
  width?: string | number;
  /** Height of the chart area. Default 240. */
  height?: number;
  /** Show axis lines. Default true. */
  showAxes?: boolean;
  /** Number of bar placeholders (bar chart style). Default 6. */
  bars?: number;
}

export function SkeletonChart({ width = "100%", height = 240, showAxes = true, bars = 6 }: SkeletonChartProps) {
  /* Generate deterministic-ish bar heights that look like data */
  const barHeights = Array.from({ length: bars }, (_, i) => {
    const seed = ((i * 37 + 13) % 7) / 7; // simple hash 0..1
    return 30 + seed * 55; // 30%–85%
  });

  return (
    <div
      data-testid="skeleton-chart"
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height,
        borderRadius: THEME.R_SM,
        border: `1px solid ${THEME.BORDER}`,
        background: BASE_COLOR,
        padding: THEME.SP_MD,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Title placeholder */}
      <Bone width="35%" height={14} borderRadius="4px" />

      {/* Chart body */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
          marginTop: THEME.SP_SM,
          paddingLeft: showAxes ? 24 : 0,
          position: "relative",
        }}
      >
        {/* Y-axis */}
        {showAxes && (
          <div
            data-testid="skeleton-chart-yaxis"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 20,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "4px 0",
            }}
          >
            {Array.from({ length: 4 }, (_, i) => (
              <Bone key={i} width={16} height={8} borderRadius="2px" style={{ opacity: 0.5 }} />
            ))}
          </div>
        )}

        {/* Bars */}
        <div
          data-testid="skeleton-chart-bars"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "flex-end",
            gap: 6,
            height: "100%",
          }}
        >
          {barHeights.map((pct, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                height: "100%",
              }}
            >
              <Bone
                width="100%"
                height={`${pct}%`}
                borderRadius={`${THEME.R_SM} ${THEME.R_SM} 0 0`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* X-axis */}
      {showAxes && (
        <div
          data-testid="skeleton-chart-xaxis"
          style={{
            display: "flex",
            justifyContent: "space-between",
            paddingLeft: 24,
            marginTop: 6,
          }}
        >
          {Array.from({ length: Math.min(bars, 4) }, (_, i) => (
            <Bone key={i} width={24} height={8} borderRadius="2px" style={{ opacity: 0.5 }} />
          ))}
        </div>
      )}
    </div>
  );
}
