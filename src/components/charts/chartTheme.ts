/**
 * Unified Chart Theme — Nexus-Bio CATDES
 *
 * Shared color palette, typography, and styling constants
 * for all Recharts + Nivo charts across CATDES tool panels.
 *
 * Now backed by design-system/tokens.ts for single-source-of-truth colors,
 * spacing, and typography. The chart-specific palettes (SCI_PALETTE, ACCENT,
 * etc.) remain here because they are domain-specific categorical scales that
 * the design system intentionally does not prescribe.
 */

import { colors, spacing, typography } from '../../design-system/tokens';

/* ── Color Palette ────────────────────────────────────────────── */

/** Cool gradient: deep blue → cyan (positive values) */
export const COOL = {
  deep:   '#1a1a2e',
  mid:    '#16213e',
  bright: '#0f3460',
  cyan:   '#00d2ff',
  light:  '#53e0ff',
} as const;

/** Warm gradient: orange → red (negative values / warnings) */
export const WARM = {
  orange: '#ff6b35',
  red:    '#ff0844',
  amber:  '#ffab40',
} as const;

/** Phase-specific accent palette (matches PATHD_THEME) */
export const ACCENT = {
  mint:      colors.chart.green,    // '#C8E0D0' via tokens
  sky:       colors.chart.blue,     // '#C8D8E8' via tokens
  apricot:   colors.chart.gold,     // '#E8DCC8' via tokens
  coral:     colors.chart.salmon,   // '#FA8072' via tokens
  lilac:     colors.chart.purple,   // '#DDD0E8' via tokens
  green:     colors.chart.lime,     // '#93CB52' via tokens
  yellow:    '#FFFB1F',
} as const;

/**
 * Scientific categorical palette — Okabe-Ito (2008) adapted for dark backgrounds.
 *
 * Derived from the colorblind-safe Wong/Okabe-Ito qualitative palette. Each hue
 * holds ≥ 4.5:1 contrast against `#050505` and remains distinguishable under
 * deuteranopia and protanopia simulation. Ordering is stable: use by index for
 * reproducible series-to-color assignment across charts.
 */
export const SCI_PALETTE = {
  blue:      '#56B4E9', // sky blue
  orange:    '#E69F00', // amber
  green:     '#009E73', // bluish green
  yellow:    '#F0E442', // soft yellow
  navy:      '#0072B2', // blue
  vermilion: '#D55E00', // vermilion
  magenta:   '#CC79A7', // reddish purple
  slate:     '#B8C4D6', // neutral pale (for non-front / muted series)
} as const;

/**
 * Ordered categorical palette — used wherever series color must be stable
 * across a chart. First five hues are the most distinguishable pairing under
 * color-vision deficiency; keep earliest slots for most-important series.
 */
export const SCI_SERIES = [
  SCI_PALETTE.blue,
  SCI_PALETTE.orange,
  SCI_PALETTE.green,
  SCI_PALETTE.magenta,
  SCI_PALETTE.yellow,
  SCI_PALETTE.vermilion,
  SCI_PALETTE.navy,
  SCI_PALETTE.slate,
] as const;

/**
 * Pastel categorical palette — Plotly-"Pastel" inspired, tuned for dark bg.
 *
 * Complements `SCI_PALETTE` for exploratory / design-forward charts where
 * aesthetic softness matters more than CVD-safe distinguishability. For
 * statistical / publication-grade work prefer `SCI_PALETTE` / `SCI_SERIES`.
 * Each hue still clears ≥ 3:1 contrast against `#050505`.
 */
export const SCI_PASTEL = {
  teal:        '#7FC7C9',
  lavender:    '#C9A8E8',
  coral:       '#F0A58A',
  periwinkle:  '#A8BEEF',
  olive:       '#9FCC7A',
  pink:        '#F29BBC',
  butter:      '#F0D884',
  mauve:       '#C6A890',
} as const;

/**
 * Ordered pastel palette — use when stable series-to-color mapping is desired
 * under the pastel aesthetic (e.g. CellFree yield curves, DYNCON multi-lane
 * time series, exploratory overlays).
 */
export const SCI_PASTEL_SERIES = [
  SCI_PASTEL.teal,
  SCI_PASTEL.lavender,
  SCI_PASTEL.coral,
  SCI_PASTEL.periwinkle,
  SCI_PASTEL.olive,
  SCI_PASTEL.pink,
  SCI_PASTEL.butter,
  SCI_PASTEL.mauve,
] as const;

/**
 * Legacy categorical palette — preserved for visual continuity in charts not
 * yet migrated to SCI_SERIES. New charts should prefer SCI_SERIES.
 */
export const SERIES_PALETTE = [
  ACCENT.mint,
  ACCENT.sky,
  ACCENT.apricot,
  ACCENT.lilac,
  ACCENT.coral,
  COOL.cyan,
  WARM.orange,
  ACCENT.green,
] as const;

/** Nivo heatmap diverging color scale: cool → neutral → warm */
export const HEATMAP_COLORS = {
  cool:    [COOL.deep, COOL.mid, COOL.bright, COOL.cyan],
  warm:    [WARM.amber, WARM.orange, WARM.red],
  diverging: [COOL.cyan, '#1a2a3e', '#2a1a1e', WARM.red],
  sequential: [COOL.deep, COOL.mid, COOL.bright, COOL.cyan, COOL.light],
} as const;

/* ── Typography ───────────────────────────────────────────────── */

export const FONT = {
  SANS:  typography.fontFamily.sans,
  MONO:  typography.fontFamily.mono,
} as const;

/* ── Axis & Grid Styling ──────────────────────────────────────── */

/** Axis label color — higher contrast than 0.6 for readability on dark bg. */
export const AXIS = {
  fontSize: Number(typography.fontSize.sm),
  fontFamily: FONT.SANS,
  fill: colors.text.primary,  // '#E8E8ED' via tokens
  tickSize: 4,
  tickPadding: 6,
} as const;

/** Axis title color — same family as AXIS.fill but at label weight. */
export const AXIS_TITLE = {
  fontSize: Number(typography.fontSize.xs),
  fontFamily: FONT.SANS,
  fill: colors.text.primary,
  letterSpacing: typography.letterSpacing.wide,
} as const;

export const GRID = {
  stroke: colors.border.subtle,  // 'rgba(255, 255, 255, 0.06)' via tokens
  strokeDasharray: '2 4',
} as const;

/* ── Line / Marker Defaults ───────────────────────────────────── */

/**
 * Default line widths. Raised from Recharts' 1–2 default so traces stay
 * readable at publication scale-down and under reduced-contrast viewing.
 */
export const LINE = {
  primary: 2.25,
  secondary: 1.75,
  muted: 1.25,
  bandStroke: 1,
} as const;

/** Marker sizes. Publication-aware — not decorative. */
export const MARKER = {
  primary: 3.5,
  secondary: 2.5,
  active: 5.5,
} as const;

/** Opacity scale for confidence bands — balanced against 0.06 grid. */
export const BAND = {
  fillOpacity: 0.22,
  fillOpacityMuted: 0.10,
  strokeOpacity: 0.55,
} as const;

/**
 * Semantic state colors — pass / fail / warn. Pulled from `SCI_PALETTE`
 * so red/green pairs survive deuteranopia and protanopia (the common CVDs).
 * Use these for pass/fail ledgers, exergonic/endergonic bars, feasibility
 * rejections — anywhere a binary or traffic-light state is encoded in hue.
 *
 * Paired `_RGB` triples let you compose `rgba(${SEMANTIC_RGB.pass}, 0.6)`
 * without a runtime hex-to-rgb converter.
 */
export const SEMANTIC = {
  pass: SCI_PALETTE.green,       // '#009E73'
  fail: SCI_PALETTE.vermilion,   // '#D55E00'
  warn: SCI_PALETTE.orange,      // '#E69F00'
} as const;

export const SEMANTIC_RGB = {
  pass: '0, 158, 115',
  fail: '213, 94, 0',
  warn: '230, 159, 0',
} as const;

/**
 * Scatter-point defaults. The thin white stroke lifts pastel / low-saturation
 * hues off a `#050505` canvas without overpowering the fill — apply as
 * Recharts `<Cell>` defaults or on hand-rolled SVG circles.
 */
export const SCATTER = {
  stroke: 'rgba(255,255,255,0.18)',
  strokeWidth: 0.75,
  fillOpacity: 0.72,
  activeStroke: 'rgba(255,255,255,0.6)',
  activeStrokeWidth: 1.25,
} as const;

/* ── Tooltip (Glassmorphism) ─────────────────────────────────── */

export const TOOLTIP_STYLE: React.CSSProperties = {
  background: colors.bg.overlay,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${colors.border.default}`,
  borderRadius: 12,
  padding: `${spacing.sm} ${spacing.md}`,
  boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
  fontFamily: FONT.MONO,
  fontSize: Number(typography.fontSize.xs),
  color: colors.text.primary,
};

/* ── Container Styling ────────────────────────────────────────── */

export const CHART_CONTAINER: React.CSSProperties = {
  borderRadius: 20,
  overflow: 'hidden',
};

/* ── Section Label (11px Bold Uppercase, PATHD style) ─────────── */

export const SECTION_LABEL: React.CSSProperties = {
  fontFamily: FONT.SANS,
  fontSize: Number(typography.fontSize.xs),
  fontWeight: typography.fontWeight.bold,
  textTransform: 'uppercase',
  letterSpacing: typography.letterSpacing.widest,
  color: colors.text.secondary,
  margin: `0 0 ${spacing.sm}`,
};

/* ── Annotation Formatter ─────────────────────────────────────── */

/** Format numeric value to 2 decimal places */
export const fmt2 = (v: number) => v.toFixed(2);

/* ── Recharts Theme Helper ────────────────────────────────────── */

/** Default Recharts CartesianGrid props */
export const rechartsGrid = {
  stroke: GRID.stroke,
  strokeDasharray: GRID.strokeDasharray,
} as const;

/** Default Recharts XAxis/YAxis tick style */
export const rechartsTick = {
  fontSize: AXIS.fontSize,
  fontFamily: AXIS.fontFamily,
  fill: AXIS.fill,
} as const;

/** Recharts axis-title style (use inside `label={{ value, style }}`) */
export const rechartsAxisTitle = {
  fontSize: AXIS_TITLE.fontSize,
  fontFamily: AXIS_TITLE.fontFamily,
  fill: AXIS_TITLE.fill,
  letterSpacing: AXIS_TITLE.letterSpacing,
  fontWeight: 600,
} as const;

/** Recharts axis-line default — subtle but present for publication clarity. */
export const rechartsAxisLine = {
  stroke: colors.border.strong,  // 'rgba(255, 255, 255, 0.15)' via tokens
} as const;

/* ── Axis-Label Builder ───────────────────────────────────────── */

/**
 * Build a Recharts axis label with unit.
 * Use for every Phase-1 chart so units are never missing or ad-hoc.
 * Example: `axisLabel('ΔG', 'kJ/mol')` → `'ΔG (kJ/mol)'`.
 */
export function axisLabel(quantity: string, unit?: string): string {
  if (!unit) return quantity;
  return `${quantity} (${unit})`;
}

/* ── Legend Style ─────────────────────────────────────────────── */

export const LEGEND_STYLE: React.CSSProperties = {
  fontFamily: FONT.SANS,
  fontSize: Number(typography.fontSize.xs),
  color: colors.text.primary,
};

/* ── Nivo Theme ───────────────────────────────────────────────── */

export const nivoTheme = {
  background: 'transparent',
  text: {
    fontSize: Number(typography.fontSize.sm),
    fill: AXIS.fill,
    fontFamily: FONT.SANS,
  },
  axis: {
    ticks: {
      text: {
        fontSize: Number(typography.fontSize.sm),
        fill: AXIS.fill,
        fontFamily: FONT.SANS,
      },
    },
    legend: {
      text: {
        fontSize: Number(typography.fontSize.xs),
        fill: AXIS_TITLE.fill,
        fontFamily: FONT.SANS,
        fontWeight: 600,
      },
    },
  },
  grid: {
    line: {
      stroke: GRID.stroke,
      strokeDasharray: GRID.strokeDasharray,
    },
  },
  tooltip: {
    container: {
      background: colors.bg.overlay,
      backdropFilter: 'blur(16px)',
      border: `1px solid ${colors.border.default}`,
      borderRadius: 12,
      padding: `${spacing.sm} ${spacing.md}`,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      fontFamily: FONT.MONO,
      fontSize: Number(typography.fontSize.xs),
      color: colors.text.primary,
    },
  },
  labels: {
    text: {
      fontSize: 10,
      fill: colors.text.primary,
      fontFamily: FONT.MONO,
    },
  },
} as const;
