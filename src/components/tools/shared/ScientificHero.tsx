'use client';

import type { ReactNode } from 'react';
import { PATHD_THEME } from '../../workbench/workbenchTheme';
import { T } from '../../ide/tokens';

export type ScientificSignalTone = 'neutral' | 'cool' | 'warm' | 'alert';

export interface ScientificSignal {
  label: string;
  value: string;
  detail?: string;
  tone?: ScientificSignalTone;
}

interface ScientificHeroProps {
  eyebrow: string;
  title: string;
  summary: string;
  signals: ScientificSignal[];
  actions?: ReactNode;
  aside?: ReactNode;
}

function toneStyle(tone: ScientificSignalTone = 'neutral') {
  if (tone === 'cool') {
    return {
      border: PATHD_THEME.chipBorder,
      background: PATHD_THEME.chipCool,
      color: PATHD_THEME.chipText,
    };
  }
  if (tone === 'warm') {
    return {
      border: PATHD_THEME.chipBorderWarm,
      background: PATHD_THEME.chipWarm,
      color: 'rgba(255,228,194,0.94)',
    };
  }
  if (tone === 'alert') {
    return {
      border: 'rgba(255,0,51,0.28)',
      background: 'rgba(255,0,51,0.12)',
      color: 'rgba(255,222,230,0.96)',
    };
  }
  return {
    border: PATHD_THEME.panelBorder,
    background: PATHD_THEME.chipNeutral,
    color: PATHD_THEME.value,
  };
}

export default function ScientificHero({
  eyebrow,
  title,
  summary,
  signals,
  actions,
  aside,
}: ScientificHeroProps) {
  return (
    <section
      className="nb-scientific-hero"
      style={{
        borderRadius: '22px',
        border: `1px solid ${PATHD_THEME.panelBorder}`,
        background: PATHD_THEME.panelGradient,
        boxShadow: '0 18px 48px rgba(0,0,0,0.22)',
        padding: '16px 18px',
        display: 'grid',
        gap: '14px',
      }}
    >
      <div
        className="nb-scientific-hero__top"
        style={{
          display: 'grid',
          gap: '14px',
          gridTemplateColumns: aside ? 'minmax(0, 1.3fr) minmax(260px, 0.7fr)' : 'minmax(0, 1fr)',
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ display: 'grid', gap: '6px' }}>
            <div
              style={{
                fontFamily: T.MONO,
                fontSize: '10px',
                color: PATHD_THEME.label,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
              }}
            >
              {eyebrow}
            </div>
            <div
              style={{
                fontFamily: T.SANS,
                fontSize: '24px',
                fontWeight: 700,
                color: PATHD_THEME.value,
                letterSpacing: '-0.04em',
                lineHeight: 1.05,
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontFamily: T.SANS,
                fontSize: '13px',
                color: PATHD_THEME.label,
                lineHeight: 1.7,
                maxWidth: '72ch',
              }}
            >
              {summary}
            </div>
          </div>

          {actions ? (
            <div className="nb-scientific-hero__actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {actions}
            </div>
          ) : null}
        </div>

        {aside ? (
          <div
            className="nb-scientific-hero__aside"
            style={{
              borderRadius: '18px',
              border: `1px solid ${PATHD_THEME.panelBorder}`,
              background: PATHD_THEME.panelGradientSoft,
              padding: '12px 14px',
              display: 'grid',
              gap: '8px',
              minWidth: 0,
            }}
          >
            {aside}
          </div>
        ) : null}
      </div>

      <div
        className="nb-scientific-hero__signals"
        style={{
          display: 'grid',
          gap: '10px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        {signals.map((signal) => {
          const style = toneStyle(signal.tone);
          return (
            <div
              key={`${signal.label}-${signal.value}`}
              className="nb-scientific-hero__signal"
              style={{
                borderRadius: '16px',
                border: `1px solid ${style.border}`,
                background: style.background,
                padding: '12px 14px',
                display: 'grid',
                gap: '6px',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontFamily: T.MONO,
                  fontSize: '10px',
                  color: PATHD_THEME.label,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {signal.label}
              </div>
              <div
                style={{
                  fontFamily: T.SANS,
                  fontSize: '15px',
                  fontWeight: 700,
                  color: style.color,
                  letterSpacing: '-0.02em',
                }}
              >
                {signal.value}
              </div>
              {signal.detail ? (
                <div
                  style={{
                    fontFamily: T.SANS,
                    fontSize: '11px',
                    color: PATHD_THEME.label,
                    lineHeight: 1.55,
                  }}
                >
                  {signal.detail}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
