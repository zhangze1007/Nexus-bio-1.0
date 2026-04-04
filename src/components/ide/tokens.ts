/**
 * Nexus-Bio IDE Design Tokens
 *
 * Font rule:
 *   BRAND (Space Grotesk) — logo / brand text only
 *   MONO  (JetBrains Mono) — numeric values, formulas, console output, code
 *   SANS  (Inter) — everything else: labels, buttons, descriptions, subtitles
 *
 * Pastel palette — 6 bio-themed Row 2 colors
 */

export const T = {
  // Fonts
  SANS:  "'Inter',-apple-system,sans-serif",
  MONO:  "'JetBrains Mono','Fira Code',monospace",
  BRAND: "'Space Grotesk',-apple-system,sans-serif",

  // Pastel palette
  P_MINT:  '#C8F0E0',
  P_SKY:   '#C8E4F8',
  P_LAVEN: '#E0D8F8',
  P_PEACH: '#F8ECD8',
  P_ROSE:  '#F8D8E4',
  P_LEMON: '#F4F0C0',

  // Neon accent colors
  NEON_CYAN:    '#00FFFF',
  NEON_MAGENTA: '#FF00FF',
  NEON_SUCCESS: '#39FF14',
  NEON_DANGER:  '#FF3131',

  // IDE shell backgrounds
  BG_SHELL:   '#F2F5F8',
  BG_SIDEBAR: '#FFFFFF',
  BG_TOPBAR:  '#FFFFFF',
  BG_PANEL:   '#FFFFFF',
  BG_CANVAS:  '#0d0f14',

  // Borders
  BORDER:        'rgba(0,0,0,0.07)',
  BORDER_ACTIVE: 'rgba(0,0,0,0.15)',

  // Squircle radii
  R_SM: '8px',
  R_MD: '12px',
  R_LG: '16px',
  R_XL: '20px',
  // Tool result accent colors — only used inside tool pages for data differentiation
  RESULT_MINT:   '#F0FDFA',
  RESULT_CORAL:  '#FA8072',
  RESULT_YELLOW: '#FFFB1F',
  RESULT_ORANGE: '#FF8B1F',
  RESULT_INDIGO: '#5151CD',
  RESULT_GREEN:  '#93CB52',
  RESULT_MAGENTA:'#FF1FFF',
  RESULT_MOCHA:  '#5F444A',
  RESULT_COCOA:  '#4E3737',
} as const;

/** All tool result accent colors as an ordered palette. */
export const TOOL_RESULT_PALETTE = [
  T.RESULT_MINT,
  T.RESULT_CORAL,
  T.RESULT_YELLOW,
  T.RESULT_ORANGE,
  T.RESULT_INDIGO,
  T.RESULT_GREEN,
  T.RESULT_MAGENTA,
  T.RESULT_MOCHA,
  T.RESULT_COCOA,
] as const;
