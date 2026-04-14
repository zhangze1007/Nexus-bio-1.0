'use client';

import type { CSSProperties, ReactNode } from 'react';
import { PATHD_THEME } from '../../workbench/workbenchTheme';
import { T } from '../../ide/tokens';

export const PROEVOL_THEME = {
  border: PATHD_THEME.paperBorder,
  borderStrong: PATHD_THEME.paperBorderStrong,
  label: PATHD_THEME.label,
  value: PATHD_THEME.value,
  muted: PATHD_THEME.paperMuted,
  surface: PATHD_THEME.panelSurface,
  inset: PATHD_THEME.panelInset,
  glass: PATHD_THEME.panelGlass,
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
    gap: '12px',
    padding: options?.padding ?? '14px',
    borderRadius: '18px',
    border: `1px solid ${options?.inset ? PROEVOL_THEME.borderStrong : PROEVOL_THEME.border}`,
    background: options?.inset ? PROEVOL_THEME.inset : PROEVOL_THEME.surface,
    boxShadow: '0 18px 36px rgba(0,0,0,0.24)',
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
      {(eyebrow || title || subtitle || actions) ? (
        <div
          style={{
            display: 'grid',
            gap: '6px',
            paddingBottom: '10px',
            borderBottom: `1px solid ${PROEVOL_THEME.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'grid', gap: '6px', minWidth: 0 }}>
              {eyebrow ? <div style={sectionKickerStyle()}>{eyebrow}</div> : null}
              {title ? (
                <div
                  style={{
                    fontFamily: T.SANS,
                    fontSize: '16px',
                    fontWeight: 700,
                    color: PROEVOL_THEME.value,
                    letterSpacing: '-0.03em',
                  }}
                >
                  {title}
                </div>
              ) : null}
              {subtitle ? (
                <div
                  style={{
                    fontFamily: T.SANS,
                    fontSize: '11px',
                    color: PROEVOL_THEME.muted,
                    lineHeight: 1.6,
                  }}
                >
                  {subtitle}
                </div>
              ) : null}
            </div>
            {actions ? <div style={{ flexShrink: 0 }}>{actions}</div> : null}
          </div>
        </div>
      ) : null}
      <div style={{ minHeight: 0 }}>{children}</div>
    </section>
  );
}
