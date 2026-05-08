/**
 * Workbench Design System — "Refined Laboratory"
 *
 * Apple-inspired frosted glass panels, purposeful motion,
 * and restrained typographic hierarchy for the workbench UI.
 *
 * Dark-theme only. Uses PATHD_THEME accent palette and T token fonts.
 */

import type { CSSProperties } from 'react';
import type { Variants } from 'framer-motion';
import { PATHD_THEME } from './workbenchTheme';
import { T } from '../ide/tokens';

// ─── Glass Panel Styles ─────────────────────────────────────────────

export const glassPanel: CSSProperties = {
  background: 'rgba(16, 19, 26, 0.72)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: '16px',
  padding: '16px 18px',
  display: 'grid',
  gap: '10px',
  position: 'relative',
  overflow: 'hidden',
  transition: 'border-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease',
};

export const glassPanelHover: CSSProperties = {
  borderColor: 'rgba(255, 255, 255, 0.12)',
  transform: 'translateY(-2px)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)',
};

export const glassPanelInset: CSSProperties = {
  background: 'rgba(13, 15, 20, 0.6)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.04)',
  borderRadius: '12px',
  padding: '12px 14px',
  display: 'grid',
  gap: '6px',
};

// ─── Typography Presets ─────────────────────────────────────────────

export const typography = {
  sectionTitle: {
    fontFamily: T.MONO,
    fontSize: '10px',
    color: PATHD_THEME.label,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    lineHeight: 1,
  } satisfies CSSProperties,

  cardTitle: {
    fontFamily: T.SANS,
    fontSize: '13px',
    color: PATHD_THEME.value,
    fontWeight: 600,
    lineHeight: 1.3,
  } satisfies CSSProperties,

  body: {
    fontFamily: T.SANS,
    fontSize: '12px',
    color: PATHD_THEME.label,
    lineHeight: 1.6,
  } satisfies CSSProperties,

  caption: {
    fontFamily: T.MONO,
    fontSize: '10px',
    color: PATHD_THEME.label,
    lineHeight: 1.4,
  } satisfies CSSProperties,

  metric: {
    fontFamily: T.MONO,
    fontSize: '10px',
    color: PATHD_THEME.value,
    lineHeight: 1,
  } satisfies CSSProperties,

  label: {
    fontFamily: T.SANS,
    fontSize: '12px',
    color: PATHD_THEME.value,
    fontWeight: 600,
    lineHeight: 1.3,
  } satisfies CSSProperties,

  overline: {
    fontFamily: T.MONO,
    fontSize: '9px',
    color: PATHD_THEME.label,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    lineHeight: 1,
  } satisfies CSSProperties,

  /** Key-value pair label (left side) */
  kvLabel: {
    fontFamily: T.MONO,
    fontSize: '10px',
    color: PATHD_THEME.label,
    minWidth: '80px',
    flexShrink: 0,
  } satisfies CSSProperties,

  /** Key-value pair value (right side) */
  kvValue: {
    fontFamily: T.MONO,
    fontSize: '10px',
    color: PATHD_THEME.value,
  } satisfies CSSProperties,
};

// ─── Status Chip Presets ────────────────────────────────────────────

const chipBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 10px',
  borderRadius: '999px',
  fontFamily: T.MONO,
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  transition: 'background 0.2s ease, border-color 0.2s ease',
};

export const statusChip = {
  base: chipBase,

  committed: {
    ...chipBase,
    border: `1px solid ${PATHD_THEME.chipBorder}`,
    background: PATHD_THEME.chipCool,
    color: PATHD_THEME.chipText,
  } satisfies CSSProperties,

  attention: {
    ...chipBase,
    border: `1px solid ${PATHD_THEME.chipBorderWarm}`,
    background: PATHD_THEME.chipWarm,
    color: 'rgba(255, 228, 194, 0.94)',
  } satisfies CSSProperties,

  draft: {
    ...chipBase,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: PATHD_THEME.value,
  } satisfies CSSProperties,

  success: {
    ...chipBase,
    border: '1px solid rgba(191, 220, 205, 0.22)',
    background: 'rgba(191, 220, 205, 0.12)',
    color: PATHD_THEME.mint,
  } satisfies CSSProperties,

  blocked: {
    ...chipBase,
    border: '1px solid rgba(232, 163, 161, 0.22)',
    background: 'rgba(232, 163, 161, 0.12)',
    color: PATHD_THEME.coral,
  } satisfies CSSProperties,

  neutral: {
    ...chipBase,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: PATHD_THEME.chipNeutral,
    color: 'rgba(255, 255, 255, 0.76)',
  } satisfies CSSProperties,
};

// ─── Icon Container ─────────────────────────────────────────────────

export function iconContainer(accent: string, size = 24): CSSProperties {
  return {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '999px',
    border: `1px solid ${accent}33`,
    background: `${accent}15`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.2s ease, border-color 0.2s ease',
  };
}

// ─── Framer Motion Variants ─────────────────────────────────────────

export const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  hover: {
    y: -2,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

export const chipVariants: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
};

// ─── Layout Helpers ─────────────────────────────────────────────────

export const sectionHeaderRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

export const metricRow: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '8px',
  flexWrap: 'wrap',
};

export const metricLabel: CSSProperties = {
  fontFamily: T.MONO,
  fontSize: '10px',
  color: PATHD_THEME.label,
  minWidth: '72px',
  flexShrink: 0,
};

export const metricValue: CSSProperties = {
  fontFamily: T.MONO,
  fontSize: '10px',
  color: PATHD_THEME.value,
};

export const kvGrid: CSSProperties = {
  display: 'grid',
  gap: '4px',
  fontFamily: T.MONO,
  fontSize: '10px',
  color: PATHD_THEME.label,
  lineHeight: 1.5,
};

export const chipRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexWrap: 'wrap',
};

export const cardGrid: CSSProperties = {
  display: 'grid',
  gap: '12px',
};

export const twoColumnGrid: CSSProperties = {
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
};

// ─── Accent Left Border ────────────────────────────────────────────

export function accentLeftBorder(accent: string, width = 3): CSSProperties {
  return {
    borderLeft: `${width}px solid ${accent}55`,
    paddingLeft: '14px',
  };
}

// ─── Utility: Format Timestamp ──────────────────────────────────────

export function formatTimestamp(ts: number): string {
  if (!ts) return 'Pending';
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Utility: Status → Accent Color ────────────────────────────────

export function statusAccent(status: string): string {
  switch (status) {
    case 'committed':
    case 'complete':
      return PATHD_THEME.mint;
    case 'ready':
      return PATHD_THEME.sky;
    case 'blocked':
      return PATHD_THEME.coral;
    case 'gated':
    case 'attention':
      return PATHD_THEME.apricot;
    case 'demoOnly':
      return PATHD_THEME.apricot;
    case 'draft':
      return PATHD_THEME.lilac;
    case 'recorded':
    default:
      return PATHD_THEME.label;
  }
}

// ─── Utility: Status → Chip Style ───────────────────────────────────

export function getChipStyle(status: 'recorded' | 'committed' | 'attention' | 'draft'): CSSProperties {
  switch (status) {
    case 'committed':
      return statusChip.committed;
    case 'attention':
      return statusChip.attention;
    case 'draft':
      return statusChip.draft;
    default:
      return statusChip.neutral;
  }
}
