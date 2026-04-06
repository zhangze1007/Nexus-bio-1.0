'use client';

import type { ReactNode } from 'react';
import { PATHD_THEME } from '../../workbench/workbenchTheme';
import { T } from '../../ide/tokens';

export interface ScientificFigureLegendItem {
  label: string;
  value: string;
  accent?: string;
}

interface ScientificFigureFrameProps {
  eyebrow: string;
  title: string;
  caption: string;
  legend?: ScientificFigureLegendItem[];
  children: ReactNode;
  footer?: ReactNode;
  minHeight?: string | number;
}

export default function ScientificFigureFrame({
  eyebrow,
  title,
  caption,
  legend = [],
  children,
  footer,
  minHeight,
}: ScientificFigureFrameProps) {
  return (
    <section
      style={{
        display: 'grid',
        gap: '12px',
        padding: '14px',
        borderRadius: '20px',
        border: `1px solid ${PATHD_THEME.paperBorder}`,
        background: PATHD_THEME.paperSurfaceStrong,
        boxShadow: '0 16px 34px rgba(96,74,56,0.08), inset 0 1px 0 rgba(255,255,255,0.82)',
        minHeight,
      }}
    >
      <div
        style={{
          display: 'grid',
          gap: '4px',
          paddingBottom: '10px',
          borderBottom: `1px solid ${PATHD_THEME.paperBorder}`,
        }}
      >
        <div
          style={{
            fontFamily: T.MONO,
            fontSize: '10px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: PATHD_THEME.paperLabel,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            fontFamily: T.SANS,
            fontSize: '15px',
            fontWeight: 700,
            color: PATHD_THEME.paperValue,
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: T.SANS,
            fontSize: '11px',
            lineHeight: 1.6,
            color: PATHD_THEME.paperMuted,
          }}
        >
          {caption}
        </div>
      </div>

      <div style={{ minHeight: 0 }}>{children}</div>

      {(legend.length > 0 || footer) && (
        <div
          style={{
            display: 'grid',
            gap: '10px',
            paddingTop: '10px',
            borderTop: `1px solid ${PATHD_THEME.paperBorder}`,
          }}
        >
          {legend.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {legend.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  style={{
                    minHeight: '28px',
                    padding: '0 10px',
                    borderRadius: '999px',
                    border: `1px solid ${PATHD_THEME.paperBorder}`,
                    background: PATHD_THEME.paperSurfaceMuted,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '999px',
                      background: item.accent ?? PATHD_THEME.apricot,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: T.MONO,
                      fontSize: '9px',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: PATHD_THEME.paperLabel,
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontFamily: T.SANS,
                      fontSize: '10px',
                      color: PATHD_THEME.paperValue,
                      fontWeight: 600,
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}
          {footer ? <div>{footer}</div> : null}
        </div>
      )}
    </section>
  );
}
