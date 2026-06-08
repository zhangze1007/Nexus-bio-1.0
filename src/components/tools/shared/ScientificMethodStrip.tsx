import { THEME } from '../../../theme';
'use client';

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
        borderRadius: 'var(--nb-radius-lg)',
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
            color: THEME.LABEL,
            cursor: 'pointer',
            fontFamily: THEME.MONO,
            fontSize: 'var(--nb-fs-sm)',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
            transition: 'background 0.15s, color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.16)';
            (e.currentTarget as HTMLElement).style.color = THEME.VALUE;
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.28)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
            (e.currentTarget as HTMLElement).style.color = THEME.LABEL;
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)';
          }}
        >
          ×
        </button>
      ) : null}
      <div
        style={{
          fontFamily: THEME.MONO,
          fontSize: 'var(--nb-fs-xs)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: THEME.LABEL,
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
              borderRadius: 'var(--nb-radius-md)',
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
                  background: item.accent ?? THEME.SKY,
                  color: '#111318',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: THEME.MONO,
                  fontSize: 'var(--nb-fs-xs)',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {String.fromCharCode(65 + index)}
              </span>
              <span
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: 'var(--nb-fs-sm)',
                  fontWeight: 700,
                  color: THEME.VALUE,
                }}
              >
                {item.title}
              </span>
            </div>
            <div
              style={{
                fontFamily: THEME.SANS,
                fontSize: 'var(--nb-fs-sm)',
                lineHeight: 1.55,
                color: 'rgba(234,240,248,0.76)',
              }}
            >
              {item.detail}
            </div>
            {item.note ? (
              <div
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: 'var(--nb-fs-xs)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: THEME.LABEL,
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
