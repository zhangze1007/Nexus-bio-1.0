'use client';

import { PATHD_THEME } from '../../workbench/workbenchTheme';
import { T } from '../../ide/tokens';

interface ScientificMethodStripItem {
  title: string;
  detail: string;
  accent?: string;
  note?: string;
}

interface ScientificMethodStripProps {
  label: string;
  items: ScientificMethodStripItem[];
}

export default function ScientificMethodStrip({ label, items }: ScientificMethodStripProps) {
  return (
    <section
      className="nb-method-strip"
      style={{
        display: 'grid',
        gap: '10px',
        padding: '12px 16px',
        borderRadius: '18px',
        border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
        background: PATHD_THEME.panelSurface,
        boxShadow: '0 14px 30px rgba(96,74,56,0.07), inset 0 1px 0 rgba(255,255,255,0.78)',
      }}
    >
      <div
        style={{
          fontFamily: T.MONO,
          fontSize: '10px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: PATHD_THEME.label,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {items.map((item, index) => (
          <div
            key={`${item.title}-${index}`}
            style={{
              borderRadius: '14px',
              border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
              background: PATHD_THEME.panelInset,
              padding: '12px',
              display: 'grid',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '999px',
                  background: item.accent ?? PATHD_THEME.sky,
                  color: PATHD_THEME.value,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: T.MONO,
                  fontSize: '10px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {String.fromCharCode(65 + index)}
              </span>
              <span
                style={{
                  fontFamily: T.SANS,
                  fontSize: '12px',
                  fontWeight: 700,
                  color: PATHD_THEME.value,
                }}
              >
                {item.title}
              </span>
            </div>
            <div
              style={{
                fontFamily: T.SANS,
                fontSize: '11px',
                lineHeight: 1.55,
                color: PATHD_THEME.paperMuted,
              }}
            >
              {item.detail}
            </div>
            {item.note ? (
              <div
                style={{
                  fontFamily: T.MONO,
                  fontSize: '9px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: PATHD_THEME.label,
                }}
              >
                {item.note}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
