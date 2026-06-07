'use client';

import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { T } from '../../ide/tokens';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

/**
 * ActionButton — Unified button primitive for all 14 tool pages.
 *
 * Three variants matching the interaction affordance hierarchy:
 *   primary   — Run, Calculate, Submit (high visual weight, mint accent)
 *   secondary — Reset, Export, Cancel (medium visual weight, glass)
 *   destructive — Delete, Clear, Remove (low visual weight, coral accent)
 *
 * Sizes:
 *   sm — 28px height, compact controls
 *   md — 36px height, standard actions
 *   lg — 44px height, primary CTAs
 */

type ButtonVariant = 'primary' | 'secondary' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  children?: ReactNode;
}

const SIZE_MAP: Record<ButtonSize, { height: string; padding: string; fontSize: string; gap: string; iconSize: number }> = {
  sm: { height: '28px', padding: '0 10px', fontSize: T.FS_XS, gap: '5px', iconSize: 12 },
  md: { height: '36px', padding: '0 14px', fontSize: T.FS_SM, gap: '6px', iconSize: 14 },
  lg: { height: '44px', padding: '0 20px', fontSize: T.FS_MD, gap: '8px', iconSize: 16 },
};

const VARIANT_STYLES: Record<ButtonVariant, {
  bg: string; bgHover: string; bgActive: string;
  border: string; borderHover: string; borderActive: string;
  color: string; colorHover: string;
}> = {
  primary: {
    bg: T.MINT,
    bgHover: '#A8CDB9',
    bgActive: '#96BDAA',
    border: 'transparent',
    borderHover: 'transparent',
    borderActive: 'transparent',
    color: '#0a0a0a',
    colorHover: '#0a0a0a',
  },
  secondary: {
    bg: 'rgba(255,255,255,0.04)',
    bgHover: 'rgba(255,255,255,0.08)',
    bgActive: 'rgba(255,255,255,0.12)',
    border: PATHD_THEME.sepiaPanelBorder,
    borderHover: 'rgba(255,255,255,0.12)',
    borderActive: 'rgba(255,255,255,0.16)',
    color: PATHD_THEME.label,
    colorHover: PATHD_THEME.value,
  },
  destructive: {
    bg: 'rgba(232,163,161,0.08)',
    bgHover: 'rgba(232,163,161,0.14)',
    bgActive: 'rgba(232,163,161,0.20)',
    border: 'rgba(232,163,161,0.15)',
    borderHover: 'rgba(232,163,161,0.25)',
    borderActive: 'rgba(232,163,161,0.35)',
    color: T.CORAL,
    colorHover: '#F0B0AE',
  },
};

export default function ActionButton({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  disabled,
  style: styleProp,
  ...rest
}: ActionButtonProps) {
  const s = SIZE_MAP[size];
  const v = VARIANT_STYLES[variant];

  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        height: s.height,
        padding: s.padding,
        borderRadius: T.R_MD,
        border: `1px solid ${v.border}`,
        background: v.bg,
        color: v.color,
        fontFamily: T.SANS,
        fontSize: s.fontSize,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background 80ms, border-color 80ms, color 80ms',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        ...styleProp,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          (e.currentTarget as HTMLElement).style.background = v.bgHover;
          (e.currentTarget as HTMLElement).style.borderColor = v.borderHover;
          (e.currentTarget as HTMLElement).style.color = v.colorHover;
        }
      }}
      onMouseLeave={e => {
        if (!disabled) {
          (e.currentTarget as HTMLElement).style.background = v.bg;
          (e.currentTarget as HTMLElement).style.borderColor = v.border;
          (e.currentTarget as HTMLElement).style.color = v.color;
        }
      }}
      onMouseDown={e => {
        if (!disabled) {
          (e.currentTarget as HTMLElement).style.background = v.bgActive;
          (e.currentTarget as HTMLElement).style.borderColor = v.borderActive;
        }
      }}
      onMouseUp={e => {
        if (!disabled) {
          (e.currentTarget as HTMLElement).style.background = v.bgHover;
          (e.currentTarget as HTMLElement).style.borderColor = v.borderHover;
        }
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
