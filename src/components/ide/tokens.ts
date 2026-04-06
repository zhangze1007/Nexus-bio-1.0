/**
 * Nexus-Bio IDE Design Tokens
 *
 * Font rule:
 *   BRAND (Space Grotesk) — logo / brand text only
 *   MONO  (IBM Plex Mono) — numeric values, formulas, console output, code
 *   SANS  (Public Sans) — everything else: labels, buttons, descriptions, subtitles
 *
 * Scientific accent palette — constrained to the approved five-color family
 */

export const T = {
  // Fonts
  SANS:  "'Public Sans',-apple-system,sans-serif",
  MONO:  "'IBM Plex Mono','JetBrains Mono','Fira Code',monospace",
  BRAND: "'Space Grotesk',-apple-system,sans-serif",

  // Pastel palette
  P_MINT:  '#BFDCCD',
  P_SKY:   '#AFC3D6',
  P_LAVEN: '#CFC4E3',
  P_PEACH: '#E7C7A9',
  P_ROSE:  '#E8A3A1',
  P_LEMON: '#E7C7A9',

  // Compatibility accents mapped to the scientific palette
  NEON_BLUE:    '#AFC3D6',
  NEON_ORANGE:  '#E7C7A9',
  NEON_SUCCESS: '#BFDCCD',
  NEON_DANGER:  '#E8A3A1',

  // IDE shell backgrounds
  BG_SHELL:   '#F2F5F8',
  BG_SIDEBAR: '#FFFFFF',
  BG_TOPBAR:  '#FFFFFF',
  BG_PANEL:   '#FFFFFF',
  BG_CANVAS:  '#F4EFE7',

  // Borders
  BORDER:        'rgba(0,0,0,0.07)',
  BORDER_ACTIVE: 'rgba(0,0,0,0.15)',

  // Squircle radii
  R_SM: '8px',
  R_MD: '12px',
  R_LG: '16px',
  R_XL: '20px',
  // Tool result accent colors — only used inside tool pages for data differentiation
  RESULT_MINT:   '#BFDCCD',
  RESULT_CORAL:  '#E8A3A1',
  RESULT_YELLOW: '#E7C7A9',
  RESULT_ORANGE: '#E7C7A9',
  RESULT_INDIGO: '#CFC4E3',
  RESULT_GREEN:  '#BFDCCD',
  RESULT_MAGENTA:'#CFC4E3',
  RESULT_MOCHA:  '#AFC3D6',
  RESULT_COCOA:  '#8C8177',
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
