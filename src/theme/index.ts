/**
 * Nexus-Bio Unified Design Theme
 *
 * Single source of truth for all design tokens.
 * Consolidates PATHD_THEME (workbenchTheme.ts) and T (ide/tokens.ts).
 *
 * Naming convention: SCREAMING_SNAKE for all tokens.
 * Backward-compatible re-exports in workbenchTheme.ts and ide/tokens.ts.
 */

export const THEME = {
  // ── Fonts ──────────────────────────────────────────────────────────
  SANS: "'Public Sans',-apple-system,sans-serif",
  MONO: "'IBM Plex Mono','JetBrains Mono','Fira Code',monospace",
  BRAND: "'Space Grotesk',-apple-system,sans-serif",

  // ── Typography scale (px) ──────────────────────────────────────────
  FS_XS: "11px", // Apple HIG minimum (was 10px)
  FS_SM: "12px",
  FS_MD: "14px",
  FS_LG: "18px",
  FS_XL: "24px",
  FS_XXL: "32px", // Page hero titles

  // ── Spacing scale (px) ─────────────────────────────────────────────
  SP_XS: 4,
  SP_SM: 8,
  SP_MD: 16,
  SP_LG: 24,
  SP_XL: 32,

  // ── Canonical 5-color accent palette ───────────────────────────────
  CORAL: "#E8A3A1",
  APRICOT: "#E7C7A9",
  MINT: "#BFDCCD",
  SKY: "#AFC3D6",
  LILAC: "#CFC4E3",

  // ── Pastel aliases (from T) ────────────────────────────────────────
  P_MINT: "#BFDCCD",
  P_SKY: "#AFC3D6",
  P_LAVEN: "#CFC4E3",
  P_PEACH: "#E7C7A9",
  P_ROSE: "#E8A3A1",

  // ── NEON compatibility accents ─────────────────────────────────────
  NEON_BLUE: "#AFC3D6",
  NEON_ORANGE: "#E7C7A9",
  NEON_SUCCESS: "#BFDCCD",
  NEON_DANGER: "#E8A3A1",

  // ── Semantic colors ────────────────────────────────────────────────
  RISK_LOW: "#D9BC5D",
  RISK_MEDIUM: "#E58F46",
  RISK_HIGH: "#D96562",
  SUCCESS_LOW: "#88A9C8",
  SUCCESS_MEDIUM: "#86C2C6",
  SUCCESS_HIGH: "#9ECE7E",

  // ── Backgrounds (dark theme) ───────────────────────────────────────
  BG_SHELL: "#0d0f14",
  BG_SIDEBAR: "#10131a",
  BG_TOPBAR: "#0d0f14",
  BG_PANEL: "#10131a",
  BG_CANVAS: "#050505",

  // ── Panel surfaces ─────────────────────────────────────────────────
  PANEL_BG: "#050505",
  PANEL_STRONG: "#111318",
  PANEL_MUTED: "#050505",
  PANEL_SURFACE: "rgba(26, 31, 37, 0.88)",
  PANEL_INSET: "rgba(31, 37, 44, 0.92)",
  PANEL_GRADIENT: "linear-gradient(180deg, rgba(31, 37, 44, 0.96) 0%, rgba(22, 27, 32, 0.94) 100%)",
  PANEL_GRADIENT_STRONG: "linear-gradient(180deg, rgba(35, 41, 49, 0.98) 0%, rgba(24, 29, 35, 0.96) 100%)",
  PANEL_GRADIENT_SOFT: "linear-gradient(180deg, rgba(36, 43, 51, 0.9) 0%, rgba(24, 29, 35, 0.88) 100%)",
  PANEL_GLASS: "rgba(28, 34, 40, 0.92)",
  PANEL_GLASS_STRONG: "rgba(22, 27, 32, 0.96)",
  PANEL_SHEEN:
    "linear-gradient(135deg, rgba(232,163,161,0.08) 0%, rgba(231,199,169,0.05) 24%, rgba(191,220,205,0.05) 52%, rgba(175,195,214,0.05) 76%, rgba(207,196,227,0.06) 100%)",
  FIGURE_BACKDROP:
    "radial-gradient(circle at top, rgba(207,196,227,0.08), transparent 42%), radial-gradient(circle at bottom right, rgba(191,220,205,0.07), transparent 38%)",

  // ── Borders ────────────────────────────────────────────────────────
  BORDER: "rgba(255,255,255,0.08)",
  BORDER_ACTIVE: "rgba(255,255,255,0.15)",
  BORDER_STRONG: "rgba(224, 230, 238, 0.28)",

  // ── Typography colors ──────────────────────────────────────────────
  LABEL: "rgba(217, 225, 235, 0.68)",
  VALUE: "rgba(250, 246, 240, 0.96)",
  INK: "rgba(250, 246, 240, 0.96)",
  INK_SOFT: "rgba(217, 225, 235, 0.45)",
  DIM: "rgba(217, 225, 235, 0.45)",

  // ── Surface aliases (backward compat with PATHD_THEME lowercase) ──
  PAPER: "#0d0f14",
  PAPER_WARM: "#10131a",
  PAPER_ELEVATED: "rgba(255,255,255,0.06)",
  PAPER_BORDER: "rgba(255, 255, 255, 0.08)",
  PAPER_LABEL: "rgba(217, 225, 235, 0.68)",
  PAPER_VALUE: "rgba(250, 246, 240, 0.96)",
  PAPER_MUTED: "rgba(234, 240, 248, 0.72)",

  // ── Input fields ───────────────────────────────────────────────────
  INPUT_BG: "rgba(31, 37, 44, 0.92)",
  INPUT_BORDER: "rgba(255, 255, 255, 0.08)",
  INPUT_TEXT: "rgba(250, 246, 240, 0.96)",
  /** @deprecated Use BORDER */
  PANEL_BORDER: "rgba(255, 255, 255, 0.08)",

  // ── Squircle radii ────────────────────────────────────────────────
  R_SM: "8px",
  R_MD: "12px",
  R_LG: "16px",
  R_XL: "20px",

  // ── Elevation shadows ──────────────────────────────────────────────
  SHADOW_LOW: "0 1px 4px rgba(0,0,0,0.15)",
  SHADOW_MEDIUM: "0 4px 12px rgba(0,0,0,0.2)",
  SHADOW_HIGH: "0 8px 24px rgba(0,0,0,0.25)",

  // ── Progress bar ───────────────────────────────────────────────────
  PROGRESS_GRADIENT: "linear-gradient(90deg, #BFDCCD 0%, #AFC3D6 42%, #CFC4E3 72%, #E8A3A1 100%)",
  PROGRESS_TRACK: "rgba(191, 220, 205, 0.18)",
  PROGRESS_GLOW: "0 0 10px rgba(191,220,205,0.2), 0 0 12px rgba(175,195,214,0.14), 0 0 16px rgba(232,163,161,0.1)",
  PROGRESS_HEIGHT: 6,
  PROGRESS_RADIUS: 999,

  // ── Chips ──────────────────────────────────────────────────────────
  CHIP_NEUTRAL: "rgba(255, 255, 255, 0.52)",
  CHIP_COOL: "rgba(175, 195, 214, 0.16)",
  CHIP_WARM: "rgba(231, 199, 169, 0.16)",
  CHIP_MINT: "rgba(191, 220, 205, 0.16)",
  CHIP_LILAC: "rgba(207, 196, 227, 0.16)",
  CHIP_BORDER: "rgba(175, 195, 214, 0.22)",
  CHIP_BORDER_WARM: "rgba(231, 199, 169, 0.28)",
  CHIP_TEXT: "rgba(250, 246, 240, 0.96)",

  // ── Tool result accent colors ──────────────────────────────────────
  RESULT_MINT: "#BFDCCD",
  RESULT_CORAL: "#E8A3A1",
  RESULT_YELLOW: "#E7C7A9",
  RESULT_ORANGE: "#E7C7A9",
  RESULT_INDIGO: "#CFC4E3",
  RESULT_GREEN: "#BFDCCD",
  RESULT_MAGENTA: "#CFC4E3",
  RESULT_MOCHA: "#AFC3D6",
  RESULT_COCOA: "#8C8177",

  // ── Legacy aliases (deprecated — for FORBIDDEN files) ──────────────
  /** @deprecated Use SKY */
  blue: "#AFC3D6",
  /** @deprecated Use APRICOT */
  orange: "#E7C7A9",
  /** @deprecated Use LILAC */
  indigo: "#CFC4E3",
  /** @deprecated Use CORAL */
  liveRed: "#E8A3A1",

  // ── Lowercase aliases (from PATHD_THEME — backward compat) ────────
  /** @deprecated Use CORAL */
  coral: "#E8A3A1",
  /** @deprecated Use APRICOT */
  apricot: "#E7C7A9",
  /** @deprecated Use MINT */
  mint: "#BFDCCD",
  /** @deprecated Use SKY */
  sky: "#AFC3D6",
  /** @deprecated Use LILAC */
  lilac: "#CFC4E3",
  /** @deprecated Use LABEL */
  label: "rgba(217, 225, 235, 0.68)",
  /** @deprecated Use VALUE */
  value: "rgba(250, 246, 240, 0.96)",
  /** @deprecated Use PANEL_SURFACE */
  panelSurface: "rgba(26, 31, 37, 0.88)",
  /** @deprecated Use PANEL_INSET */
  panelInset: "rgba(31, 37, 44, 0.92)",
  /** @deprecated Use BORDER */
  panelBorder: "rgba(224, 230, 238, 0.15)",
  /** @deprecated Use BORDER_STRONG */
  panelBorderStrong: "rgba(224, 230, 238, 0.28)",
  /** @deprecated Use PANEL_GRADIENT */
  panelGradient: "linear-gradient(180deg, rgba(31, 37, 44, 0.96) 0%, rgba(22, 27, 32, 0.94) 100%)",
  /** @deprecated Use PANEL_GRADIENT_STRONG */
  panelGradientStrong: "linear-gradient(180deg, rgba(35, 41, 49, 0.98) 0%, rgba(24, 29, 35, 0.96) 100%)",
  /** @deprecated Use PANEL_GRADIENT_SOFT */
  panelGradientSoft: "linear-gradient(180deg, rgba(36, 43, 51, 0.9) 0%, rgba(24, 29, 35, 0.88) 100%)",
  /** @deprecated Use PANEL_GLASS */
  panelGlass: "rgba(28, 34, 40, 0.92)",
  /** @deprecated Use PANEL_GLASS_STRONG */
  panelGlassStrong: "rgba(22, 27, 32, 0.96)",
  /** @deprecated Use PANEL_SHEEN */
  panelSheen:
    "linear-gradient(135deg, rgba(232,163,161,0.08) 0%, rgba(231,199,169,0.05) 24%, rgba(191,220,205,0.05) 52%, rgba(175,195,214,0.05) 76%, rgba(207,196,227,0.06) 100%)",
  /** @deprecated Use FIGURE_BACKDROP */
  figureBackdrop:
    "radial-gradient(circle at top, rgba(207,196,227,0.08), transparent 42%), radial-gradient(circle at bottom right, rgba(191,220,205,0.07), transparent 38%)",
  /** @deprecated Use INK */
  ink: "rgba(250, 246, 240, 0.96)",
  /** @deprecated Use INK_SOFT */
  inkSoft: "rgba(217, 225, 235, 0.45)",
  /** @deprecated Use RISK_LOW */
  riskLow: "#D9BC5D",
  /** @deprecated Use RISK_MEDIUM */
  riskMedium: "#E58F46",
  /** @deprecated Use RISK_HIGH */
  riskHigh: "#D96562",
  /** @deprecated Use SUCCESS_LOW */
  successLow: "#88A9C8",
  /** @deprecated Use SUCCESS_MEDIUM */
  successMedium: "#86C2C6",
  /** @deprecated Use SUCCESS_HIGH */
  successHigh: "#9ECE7E",
  /** @deprecated Use PAPER */
  paper: "#0d0f14",
  /** @deprecated Use PAPER_WARM */
  paperWarm: "#10131a",
  /** @deprecated Use PAPER_ELEVATED */
  paperElevated: "rgba(255,255,255,0.06)",
  /** @deprecated Use PAPER_BORDER */
  paperBorder: "rgba(255, 255, 255, 0.08)",
  /** @deprecated Use PAPER_LABEL */
  paperLabel: "rgba(217, 225, 235, 0.68)",
  /** @deprecated Use PAPER_VALUE */
  paperValue: "rgba(250, 246, 240, 0.96)",
  /** @deprecated Use PAPER_MUTED */
  paperMuted: "rgba(234, 240, 248, 0.72)",
  /** @deprecated Use PANEL_SURFACE */
  paperSurface: "rgba(26, 31, 37, 0.88)",
  /** @deprecated Use PANEL_STRONG */
  paperSurfaceStrong: "rgba(22, 27, 32, 0.92)",
  /** @deprecated Use PANEL_INSET */
  paperSurfaceMuted: "rgba(31, 37, 44, 0.92)",
  /** @deprecated Use BORDER_STRONG */
  paperBorderStrong: "rgba(255, 255, 255, 0.14)",
  /** @deprecated Use PANEL_BG */
  sepiaPanel: "#0A0A0A",
  /** @deprecated Use PANEL_STRONG */
  sepiaPanelStrong: "#111318",
  /** @deprecated Use PANEL_MUTED */
  sepiaPanelMuted: "#050505",
  /** @deprecated Use BORDER */
  sepiaPanelBorder: "rgba(255, 255, 255, 0.08)",
  /** @deprecated Use PROGRESS_GRADIENT */
  progressGradient: "linear-gradient(90deg, #BFDCCD 0%, #AFC3D6 42%, #CFC4E3 72%, #E8A3A1 100%)",
  /** @deprecated Use PROGRESS_TRACK */
  progressTrack: "rgba(191, 220, 205, 0.18)",
  /** @deprecated Use PROGRESS_GLOW */
  progressGlow: "0 0 10px rgba(191,220,205,0.2), 0 0 12px rgba(175,195,214,0.14), 0 0 16px rgba(232,163,161,0.1)",
  /** @deprecated Use PROGRESS_HEIGHT */
  progressHeight: 6,
  /** @deprecated Use PROGRESS_RADIUS */
  progressRadius: 999,
  /** @deprecated Use CHIP_NEUTRAL */
  chipNeutral: "rgba(255, 255, 255, 0.52)",
  /** @deprecated Use CHIP_COOL */
  chipCool: "rgba(175, 195, 214, 0.16)",
  /** @deprecated Use CHIP_WARM */
  chipWarm: "rgba(231, 199, 169, 0.16)",
  /** @deprecated Use CHIP_MINT */
  chipMint: "rgba(191, 220, 205, 0.16)",
  /** @deprecated Use CHIP_LILAC */
  chipLilac: "rgba(207, 196, 227, 0.16)",
  /** @deprecated Use CHIP_BORDER */
  chipBorder: "rgba(175, 195, 214, 0.22)",
  /** @deprecated Use CHIP_BORDER_WARM */
  chipBorderWarm: "rgba(231, 199, 169, 0.28)",
  /** @deprecated Use CHIP_TEXT */
  chipText: "rgba(250, 246, 240, 0.96)",

  // ── Glass CSS properties (from useToolTheme) ───────────────────────
  GLASS: {
    background: "rgba(17, 19, 24, 0.95)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "6px",
  },
} as const;

// ── Bio node type colors (from ThreeScene — pastel tones per CLAUDE.md) ──
export const BIO_THEME_COLORS = {
  CYAN: "#C8E8F0", // Metabolite — pastel sky blue
  GREEN: "#C8E0D0", // Gene / target yield — pastel mint green
  RED: "#F0C8C8", // Impurity / risk — pastel rose red
  AMBER: "#E8DCC8", // Enzyme — pastel warm amber
  PURPLE: "#DDD0E8", // Intermediate / complex — pastel lavender
  PINK: "#F0D0E4", // Cofactor — pastel pink
} as const;

/** All tool result accent colors as an ordered palette. */
export const TOOL_RESULT_PALETTE = [
  THEME.RESULT_MINT,
  THEME.RESULT_CORAL,
  THEME.RESULT_YELLOW,
  THEME.RESULT_ORANGE,
  THEME.RESULT_INDIGO,
  THEME.RESULT_GREEN,
  THEME.RESULT_MAGENTA,
  THEME.RESULT_MOCHA,
  THEME.RESULT_COCOA,
] as const;

// ── Backward-compatible re-exports ─────────────────────────────────
// These allow existing code to keep working during migration.

/** @deprecated Import THEME from '@/theme' instead */
export const PATHD_THEME = THEME;

/** @deprecated Import THEME from '@/theme' instead */
export const T = THEME;
