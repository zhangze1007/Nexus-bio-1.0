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
  /** Render as a dismissible floating card with a close button. */
  dismissible?: boolean;
  onDismiss?: () => void;
}

export default function ScientificMethodStrip({ label, items, dismissible = false, onDismiss }: ScientificMethodStripProps) {
  return (
    <section
      className="nb-method-strip"
      style={{
        display: 'grid',
        gap: '10px',
        padding: '12px 16px',
        borderRadius: '18px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(10,12,16,0.52)',
        backdropFilter: 'blur(24px) saturate(140%)',
        WebkitBackdropFilter: 'blur(24px) saturate(140%)',
        boxShadow: '0 14px 30px rgba(0,0,0,0.32)',
        position: 'relative',
      }}
    >
      {dismissible && onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss method strip"
          onClick={onDismiss}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: PATHD_THEME.label,
            cursor: 'pointer',
            fontFamily: T.MONO,
            fontSize: '11px',
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
        style={{
          fontFamily: T.MONO,
          fontSize: '10px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: PATHD_THEME.label,
          paddingRight: dismissible ? '28px' : 0,
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
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.04)',
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
                  color: '#111318',
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
                color: 'rgba(234,240,248,0.76)',
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
