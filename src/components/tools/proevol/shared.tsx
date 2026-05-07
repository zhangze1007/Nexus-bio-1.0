'use client';

import type { CSSProperties, ReactNode } from 'react';
import { PATHD_THEME } from '../../workbench/workbenchTheme';
import { T } from '../../ide/tokens';

export const PROEVOL_THEME = {
  border: 'rgba(255, 235, 210, 0.10)',
  borderStrong: 'rgba(255, 235, 210, 0.18)',
  label: 'rgba(225, 215, 200, 0.60)',
  value: 'rgba(255, 248, 240, 0.96)',
  muted: 'rgba(225, 215, 200, 0.55)',
  surface: 'rgba(28, 24, 20, 0.92)',
  inset: 'rgba(34, 28, 22, 0.94)',
  glass: 'rgba(30, 26, 22, 0.88)',
  pageBg: '#080706',
  mint: PATHD_THEME.mint,
  coral: PATHD_THEME.coral,
  apricot: PATHD_THEME.apricot,
  sky: PATHD_THEME.sky,
  lilac: PATHD_THEME.lilac,
  riskLow: PATHD_THEME.riskLow,
  riskMedium: PATHD_THEME.riskMedium,
  riskHigh: PATHD_THEME.riskHigh,
  successLow: PATHD_THEME.successLow,
  successMedium: PATHD_THEME.successMedium,
  successHigh: PATHD_THEME.successHigh,
};

export function formatSigned(value: number, digits = 1) {
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}` : rounded;
}

export function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

export function toneColor(tone: 'neutral' | 'cool' | 'warm' | 'alert') {
  if (tone === 'cool') return PROEVOL_THEME.successHigh;
  if (tone === 'warm') return PROEVOL_THEME.riskMedium;
  if (tone === 'alert') return PROEVOL_THEME.riskHigh;
  return PROEVOL_THEME.sky;
}

export function surfaceCardStyle(options?: {
  minHeight?: number | string;
  padding?: string;
  inset?: boolean;
}): CSSProperties {
  return {
    display: 'grid',
    gap: '10px',
    padding: options?.padding ?? '12px',
    borderRadius: '14px',
    border: `1px solid ${options?.inset ? PROEVOL_THEME.borderStrong : PROEVOL_THEME.border}`,
    background: options?.inset ? PROEVOL_THEME.inset : PROEVOL_THEME.surface,
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    minHeight: options?.minHeight,
  };
}

export function sectionKickerStyle(): CSSProperties {
  return {
    fontFamily: T.MONO,
    fontSize: '9px',
    color: PROEVOL_THEME.label,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  };
}

export function tableHeaderStyle(): CSSProperties {
  return {
    fontFamily: T.MONO,
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: PROEVOL_THEME.label,
    padding: '8px 10px',
    textAlign: 'left',
    borderBottom: `1px solid ${PROEVOL_THEME.borderStrong}`,
    whiteSpace: 'nowrap',
  };
}

export function tableCellStyle(): CSSProperties {
  return {
    fontFamily: T.SANS,
    fontSize: '11px',
    color: PROEVOL_THEME.value,
    padding: '8px 10px',
    verticalAlign: 'top',
  };
}

export function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'cool' | 'warm' | 'alert';
}) {
  const color = toneColor(tone);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        minHeight: '24px',
        padding: '0 10px',
        borderRadius: '999px',
        border: `1px solid ${color}44`,
        background: `${color}18`,
        color,
        fontFamily: T.MONO,
        fontSize: '9px',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

export function MetricBadge({
  label,
  value,
  detail,
  accent = PROEVOL_THEME.sky,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: '10px 12px',
        borderRadius: '14px',
        border: `1px solid ${PROEVOL_THEME.border}`,
        background: 'rgba(255,255,255,0.03)',
        display: 'grid',
        gap: '4px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '999px',
            background: accent,
            flexShrink: 0,
          }}
        />
        <span style={sectionKickerStyle()}>{label}</span>
      </div>
      <div
        style={{
          fontFamily: T.SANS,
          fontSize: '17px',
          fontWeight: 700,
          color: PROEVOL_THEME.value,
          letterSpacing: '-0.03em',
        }}
      >
        {value}
      </div>
      {detail ? (
        <div
          style={{
            fontFamily: T.SANS,
            fontSize: '10px',
            lineHeight: 1.5,
            color: PROEVOL_THEME.muted,
          }}
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}

export function ProEvolCard({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  minHeight,
  inset = false,
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  minHeight?: number | string;
  inset?: boolean;
}) {
  return (
    <section style={surfaceCardStyle({ minHeight, inset })}>
      {(eyebrow || title || actions) ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', paddingBottom: '6px', borderBottom: `1px solid ${PROEVOL_THEME.border}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
            {eyebrow ? <div style={sectionKickerStyle()}>{eyebrow}</div> : null}
            {title ? (
              <div style={{ fontFamily: T.SANS, fontSize: '13px', fontWeight: 600, color: PROEVOL_THEME.value, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {title}
              </div>
            ) : null}
          </div>
          {actions ? <div style={{ flexShrink: 0 }}>{actions}</div> : null}
        </div>
      ) : null}
      <div style={{ minHeight: 0 }}>{children}</div>
    </section>
  );
}
