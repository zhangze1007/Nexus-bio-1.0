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
  /** Render as a dismissible floating card with a close button. */
  dismissible?: boolean;
  onDismiss?: () => void;
}

function toneStyle(tone: ScientificSignalTone = 'neutral') {
  if (tone === 'cool') {
    return {
      border: 'rgba(175,195,214,0.34)',
      background: 'rgba(175,195,214,0.14)',
      color: 'rgba(234,242,252,0.96)',
    };
  }
  if (tone === 'warm') {
    return {
      border: 'rgba(231,199,169,0.34)',
      background: 'rgba(231,199,169,0.14)',
      color: 'rgba(248,228,196,0.96)',
    };
  }
  if (tone === 'alert') {
    return {
      border: 'rgba(232,163,161,0.34)',
      background: 'rgba(232,163,161,0.14)',
      color: 'rgba(252,222,220,0.96)',
    };
  }
  return {
    border: 'rgba(207,196,227,0.28)',
    background: 'rgba(207,196,227,0.10)',
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
  dismissible = false,
  onDismiss,
}: ScientificHeroProps) {
  return (
    <section
      className="nb-scientific-hero"
      style={{
        borderRadius: '24px',
        border: `1px solid rgba(255,255,255,0.12)`,
        background: 'rgba(10,12,16,0.52)',
        boxShadow: '0 18px 48px rgba(0,0,0,0.38)',
        backdropFilter: 'blur(24px) saturate(140%)',
        WebkitBackdropFilter: 'blur(24px) saturate(140%)',
        padding: '18px 20px',
        display: 'grid',
        gap: '16px',
        position: 'relative',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '24px',
          background: 'linear-gradient(135deg, rgba(191,220,205,0.06) 0%, rgba(175,195,214,0.04) 48%, rgba(207,196,227,0.06) 100%)',
          pointerEvents: 'none',
        }}
      />
      {dismissible && onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss hero panel"
          onClick={onDismiss}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: PATHD_THEME.label,
            cursor: 'pointer',
            fontFamily: T.MONO,
            fontSize: '12px',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
            transition: 'background 0.15s, color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.16)';
            (e.currentTarget as HTMLElement).style.color = PATHD_THEME.value;
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.28)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
            (e.currentTarget as HTMLElement).style.color = PATHD_THEME.label;
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)';
          }}
        >
          ×
        </button>
      ) : null}
      <div
        className="nb-scientific-hero__top"
        style={{
          display: 'grid',
          gap: '16px',
          gridTemplateColumns: aside ? 'minmax(0, 1.3fr) minmax(260px, 0.7fr)' : 'minmax(0, 1fr)',
          alignItems: 'start',
          position: 'relative',
          zIndex: 1,
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
                lineHeight: 1.08,
                paddingRight: dismissible ? '32px' : 0,
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontFamily: T.SANS,
                fontSize: '12px',
                color: 'rgba(234,240,248,0.78)',
                lineHeight: 1.62,
                maxWidth: '76ch',
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
              border: '1px solid rgba(175,195,214,0.22)',
              background: 'rgba(175,195,214,0.08)',
              padding: '14px 16px',
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
          position: 'relative',
          zIndex: 1,
        }}
      >
        {signals.map((signal) => {
          const style = toneStyle(signal.tone);
          return (
            <div
              key={`${signal.label}-${signal.value}`}
              className="nb-scientific-hero__signal"
              style={{
                borderRadius: '18px',
                border: `1px solid ${style.border}`,
                background: style.background,
                padding: '12px 14px',
                display: 'grid',
                gap: '5px',
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
                    fontSize: '10px',
                    color: 'rgba(234,240,248,0.7)',
                    lineHeight: 1.5,
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
