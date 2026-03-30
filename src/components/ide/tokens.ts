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
} as const;
