/**
 * Nexus-Bio Design System Tokens
 *
 * Apple-inspired design tokens with dark theme foundation.
 * Built for synthetic biology AI platform aesthetics.
 */

// ============================================================================
// COLORS
// ============================================================================

export const colors = {
  // Background hierarchy
  bg: {
    primary: '#050505',      // Deepest background
    secondary: '#0d0f14',    // Card/panel backgrounds
    tertiary: '#10131a',     // Elevated surfaces
    elevated: '#161920',     // Modals, popovers
    overlay: 'rgba(0, 0, 0, 0.7)', // Backdrop overlays
  },

  // Text hierarchy
  text: {
    primary: '#E8E8ED',      // High-emphasis text
    secondary: '#A0A0AB',    // Medium-emphasis text
    tertiary: '#6B6B76',     // Low-emphasis text
    disabled: '#3D3D44',     // Disabled text
    inverse: '#050505',      // Text on light backgrounds
  },

  // Accent colors (brand palette)
  accent: {
    primary: '#5151CD',      // Primary brand blue
    primaryHover: '#6363D6', // Hover state
    secondary: '#93CB52',    // Success green accent
    tertiary: '#DDD0E8',     // Soft purple
  },

  // State colors
  state: {
    success: '#4ADE80',
    successMuted: 'rgba(74, 222, 128, 0.15)',
    warning: '#FBBF24',
    warningMuted: 'rgba(251, 191, 36, 0.15)',
    error: '#FA8072',
    errorMuted: 'rgba(250, 128, 114, 0.15)',
    info: '#60A5FA',
    infoMuted: 'rgba(96, 165, 250, 0.15)',
  },

  // Border colors
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    default: 'rgba(255, 255, 255, 0.1)',
    strong: 'rgba(255, 255, 255, 0.15)',
    accent: 'rgba(81, 81, 205, 0.4)',
  },

  // Chart/Data visualization palette (pastel)
  chart: {
    blue: '#C8D8E8',
    green: '#C8E0D0',
    purple: '#DDD0E8',
    gold: '#E8DCC8',
    salmon: '#FA8072',
    indigo: '#5151CD',
    lime: '#93CB52',
  },
} as const;

// ============================================================================
// SPACING (8px grid system)
// ============================================================================

export const spacing = {
  /** 2px - Micro spacing */
  '2xs': '2px',
  /** 4px - Extra extra small */
  xs: '4px',
  /** 8px - Extra small */
  sm: '8px',
  /** 12px - Small */
  md: '12px',
  /** 16px - Medium (base) */
  base: '16px',
  /** 20px - Medium large */
  lg: '20px',
  /** 24px - Large */
  xl: '24px',
  /** 32px - Extra large */
  '2xl': '32px',
  /** 40px - Extra extra large */
  '3xl': '40px',
  /** 48px - Huge */
  '4xl': '48px',
  /** 64px - Massive */
  '5xl': '64px',
  /** 80px - Giant */
  '6xl': '80px',
  /** 96px - Colossal */
  '7xl': '96px',
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  // Font families
  fontFamily: {
    sans: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    mono: "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
    display: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },

  // Font sizes
  fontSize: {
    /** 11px - Caption */
    xs: '11px',
    /** 12px - Small */
    sm: '12px',
    /** 13px - Body small */
    base: '13px',
    /** 14px - Body */
    md: '14px',
    /** 15px - Body large */
    lg: '15px',
    /** 16px - Subheading */
    xl: '16px',
    /** 18px - Heading 4 */
    '2xl': '18px',
    /** 20px - Heading 3 */
    '3xl': '20px',
    /** 24px - Heading 2 */
    '4xl': '24px',
    /** 28px - Heading 1 */
    '5xl': '28px',
    /** 34px - Display small */
    '6xl': '34px',
    /** 40px - Display */
    '7xl': '40px',
    /** 48px - Display large */
    '8xl': '48px',
  },

  // Font weights
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,     // Headings
    snug: 1.3,      // Subheadings
    normal: 1.5,    // Body text
    relaxed: 1.625, // Long-form content
    loose: 1.75,    // Extra spacing
  },

  // Letter spacing
  letterSpacing: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.02em',
    wider: '0.04em',
    widest: '0.08em',
  },
} as const;

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const borderRadius = {
  /** 4px - Subtle rounding */
  sm: '4px',
  /** 6px - Small elements */
  md: '6px',
  /** 8px - Default */
  base: '8px',
  /** 10px - Medium */
  lg: '10px',
  /** 12px - Cards */
  xl: '12px',
  /** 16px - Large cards */
  '2xl': '16px',
  /** 20px - Modals */
  '3xl': '20px',
  /** 9999px - Pill shape */
  full: '9999px',
} as const;

// ============================================================================
// SHADOWS
// ============================================================================

export const shadows = {
  /** Subtle shadow for cards */
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  /** Default shadow for elevated elements */
  base: '0 2px 8px rgba(0, 0, 0, 0.4)',
  /** Medium shadow for dropdowns */
  md: '0 4px 12px rgba(0, 0, 0, 0.5)',
  /** Large shadow for modals */
  lg: '0 8px 24px rgba(0, 0, 0, 0.6)',
  /** Extra large shadow for popovers */
  xl: '0 12px 40px rgba(0, 0, 0, 0.7)',
  /** Glow effect for primary actions */
  glowPrimary: '0 0 20px rgba(81, 81, 205, 0.3)',
  /** Glow effect for success states */
  glowSuccess: '0 0 20px rgba(74, 222, 128, 0.3)',
  /** Glow effect for error states */
  glowError: '0 0 20px rgba(250, 128, 114, 0.3)',
  /** Inner shadow for inputs */
  inner: 'inset 0 1px 2px rgba(0, 0, 0, 0.3)',
} as const;

// ============================================================================
// TRANSITIONS
// ============================================================================

export const transitions = {
  // Duration
  duration: {
    instant: '0ms',
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '400ms',
    slowest: '500ms',
  },

  // Easing functions (Apple-inspired)
  easing: {
    /** Standard ease */
    default: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    /** Ease in for exits */
    easeIn: 'cubic-bezier(0.42, 0, 1, 1)',
    /** Ease out for entrances */
    easeOut: 'cubic-bezier(0, 0, 0.58, 1)',
    /** Ease in and out */
    easeInOut: 'cubic-bezier(0.42, 0, 0.58, 1)',
    /** Spring-like bounce */
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    /** Apple's signature ease */
    apple: 'cubic-bezier(0.28, 0.11, 0.32, 1)',
  },

  // Pre-built transitions
  preset: {
    /** Background color change */
    bg: 'background-color 200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
    /** Text color change */
    color: 'color 200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
    /** Opacity change */
    opacity: 'opacity 200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
    /** Transform change */
    transform: 'transform 200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
    /** Shadow change */
    shadow: 'box-shadow 200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
    /** Border change */
    border: 'border-color 200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
    /** All properties */
    all: 'all 200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
    /** Fade in/out */
    fade: 'opacity 300ms cubic-bezier(0.42, 0, 0.58, 1)',
    /** Scale up/down */
    scale: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

// ============================================================================
// Z-INDEX SCALE
// ============================================================================

export const zIndex = {
  base: 0,
  raised: 1,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  popover: 500,
  toast: 600,
  tooltip: 700,
  commandPalette: 800,
} as const;

// ============================================================================
// BREAKPOINTS
// ============================================================================

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ============================================================================
// COMBINED TOKENS EXPORT
// ============================================================================

export const tokens = {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
  zIndex,
  breakpoints,
} as const;

export type Tokens = typeof tokens;
