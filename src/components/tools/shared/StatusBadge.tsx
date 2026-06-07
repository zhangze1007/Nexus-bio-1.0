'use client';

import { T } from '../../ide/tokens';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

/**
 * StatusBadge — Consistent status indicator across all tools.
 *
 * Variants:
 *   success — completed, feasible, positive (mint)
 *   warning — partial, caution, review needed (apricot)
 *   error   — failed, infeasible, blocked (coral)
 *   info    — neutral, informational, demo (sky)
 *   muted   — disabled, inactive, default
 */

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'muted';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  dot?: boolean;
}

const VARIANT_STYLES: Record<BadgeVariant, {
  bg: string; border: string; color: string; dotColor: string;
}> = {
  success: {
    bg: 'rgba(191,220,205,0.12)',
    border: 'rgba(191,220,205,0.25)',
    color: T.MINT,
    dotColor: T.MINT,
  },
  warning: {
    bg: 'rgba(231,199,169,0.12)',
    border: 'rgba(231,199,169,0.25)',
    color: T.APRICOT,
    dotColor: T.APRICOT,
  },
  error: {
    bg: 'rgba(232,163,161,0.12)',
    border: 'rgba(232,163,161,0.25)',
    color: T.CORAL,
    dotColor: T.CORAL,
  },
  info: {
    bg: 'rgba(175,195,214,0.12)',
    border: 'rgba(175,195,214,0.25)',
    color: T.SKY,
    dotColor: T.SKY,
  },
  muted: {
    bg: 'rgba(255,255,255,0.03)',
    border: PATHD_THEME.sepiaPanelBorder,
    color: PATHD_THEME.label,
    dotColor: PATHD_THEME.label,
  },
};

export default function StatusBadge({ label, variant = 'muted', dot = false }: StatusBadgeProps) {
  const v = VARIANT_STYLES[variant];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      minHeight: '22px',
      padding: '2px 8px',
      borderRadius: '999px',
      border: `1px solid ${v.border}`,
      background: v.bg,
      fontFamily: T.MONO,
      fontSize: T.FS_XS,
      fontWeight: 600,
      letterSpacing: '0.04em',
      color: v.color,
      whiteSpace: 'nowrap',
    }}>
      {dot && (
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: v.dotColor,
          flexShrink: 0,
        }} />
      )}
      {label}
    </span>
  );
}
