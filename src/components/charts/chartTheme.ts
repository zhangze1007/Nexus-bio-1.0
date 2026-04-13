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

/** Categorical palette for multi-series charts */
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

export const AXIS = {
  fontSize: 11,
  fontFamily: FONT.SANS,
  fill: 'rgba(255,255,255,0.6)',
  tickSize: 4,
  tickPadding: 6,
} as const;

export const GRID = {
  stroke: 'rgba(255,255,255,0.08)',
  strokeDasharray: '3 3',
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

/* ── Nivo Theme ───────────────────────────────────────────────── */

export const nivoTheme = {
  background: 'transparent',
  text: {
    fontSize: 11,
    fill: 'rgba(255,255,255,0.6)',
    fontFamily: FONT.SANS,
  },
  axis: {
    ticks: {
      text: {
        fontSize: 11,
        fill: 'rgba(255,255,255,0.6)',
        fontFamily: FONT.SANS,
      },
    },
    legend: {
      text: {
        fontSize: 11,
        fill: 'rgba(255,255,255,0.6)',
        fontFamily: FONT.SANS,
      },
    },
  },
  grid: {
    line: {
      stroke: 'rgba(255,255,255,0.08)',
      strokeDasharray: '3 3',
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
