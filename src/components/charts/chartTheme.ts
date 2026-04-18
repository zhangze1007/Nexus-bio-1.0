/**
 * Unified Chart Theme — Nexus-Bio CATDES
 *
 * Shared color palette, typography, and styling constants
 * for all Recharts + Nivo charts across CATDES tool panels.
 */

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
  mint:      '#BFDCCD',
  sky:       '#AFC3D6',
  apricot:   '#E7C7A9',
  coral:     '#E8A3A1',
  lilac:     '#CFC4E3',
  green:     '#93CB52',
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
  SANS:  "'Public Sans',-apple-system,sans-serif",
  MONO:  "'IBM Plex Mono','JetBrains Mono','Fira Code',monospace",
} as const;

/* ── Axis & Grid Styling ──────────────────────────────────────── */

/** Axis label color — higher contrast than 0.6 for readability on dark bg. */
export const AXIS = {
  fontSize: 12,
  fontFamily: FONT.SANS,
  fill: 'rgba(232,238,248,0.78)',
  tickSize: 4,
  tickPadding: 6,
} as const;

/** Axis title color — same family as AXIS.fill but at label weight. */
export const AXIS_TITLE = {
  fontSize: 11,
  fontFamily: FONT.SANS,
  fill: 'rgba(232,238,248,0.92)',
  letterSpacing: '0.02em',
} as const;

export const GRID = {
  stroke: 'rgba(255,255,255,0.06)',
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
  background: 'rgba(13, 15, 20, 0.85)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: '8px 12px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
  fontFamily: FONT.MONO,
  fontSize: 11,
  color: 'rgba(250,246,240,0.96)',
};

/* ── Container Styling ────────────────────────────────────────── */

export const CHART_CONTAINER: React.CSSProperties = {
  borderRadius: 20,
  overflow: 'hidden',
};

/* ── Section Label (11px Bold Uppercase, PATHD style) ─────────── */

export const SECTION_LABEL: React.CSSProperties = {
  fontFamily: FONT.SANS,
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'rgba(217,225,235,0.68)',
  margin: '0 0 10px',
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
  stroke: 'rgba(255,255,255,0.18)',
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
  fontSize: 11,
  color: 'rgba(232,238,248,0.82)',
};

/* ── Nivo Theme ───────────────────────────────────────────────── */

export const nivoTheme = {
  background: 'transparent',
  text: {
    fontSize: 12,
    fill: AXIS.fill,
    fontFamily: FONT.SANS,
  },
  axis: {
    ticks: {
      text: {
        fontSize: 12,
        fill: AXIS.fill,
        fontFamily: FONT.SANS,
      },
    },
    legend: {
      text: {
        fontSize: 11,
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
      background: 'rgba(13, 15, 20, 0.85)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 12,
      padding: '8px 12px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      fontFamily: FONT.MONO,
      fontSize: 11,
      color: 'rgba(250,246,240,0.96)',
    },
  },
  labels: {
    text: {
      fontSize: 10,
      fill: 'rgba(250,246,240,0.96)',
      fontFamily: FONT.MONO,
    },
  },
} as const;
