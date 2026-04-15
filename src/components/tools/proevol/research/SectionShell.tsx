'use client';

import type { ReactNode } from 'react';
import { T } from '../../../ide/tokens';
import { PROEVOL_THEME } from '../shared';

export type SectionTone = 'primary' | 'demoted';

interface SectionShellProps {
  index: number;
  kicker: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  tone?: SectionTone;
  children: ReactNode;
}

export default function SectionShell({
  index,
  kicker,
  title,
  description,
  actions,
  tone = 'primary',
  children,
}: SectionShellProps) {
  const isDemoted = tone === 'demoted';
  return (
    <section
      style={{
        display: 'grid',
        gap: isDemoted ? '10px' : '16px',
        padding: isDemoted ? '14px 18px' : '22px 24px',
        borderRadius: isDemoted ? '16px' : '22px',
        border: `1px solid ${isDemoted ? PROEVOL_THEME.border : PROEVOL_THEME.borderStrong}`,
        background: isDemoted
          ? 'rgba(10,12,16,0.55)'
          : 'rgba(11,13,18,0.78)',
        boxShadow: isDemoted
          ? '0 10px 24px rgba(0,0,0,0.18)'
          : '0 22px 52px rgba(0,0,0,0.30)',
      }}
    >
      <header
        style={{
          display: 'flex',
          gap: '14px',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          paddingBottom: isDemoted ? '8px' : '14px',
          borderBottom: `1px solid ${PROEVOL_THEME.border}`,
        }}
      >
        <div style={{ display: 'flex', gap: isDemoted ? '10px' : '14px', alignItems: 'flex-start', minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: isDemoted ? '26px' : '32px',
              height: isDemoted ? '26px' : '32px',
              borderRadius: isDemoted ? '8px' : '10px',
              border: `1px solid ${PROEVOL_THEME.border}`,
              background: 'rgba(255,255,255,0.03)',
              fontFamily: T.MONO,
              fontSize: isDemoted ? '10px' : '12px',
              fontWeight: 700,
              color: isDemoted ? PROEVOL_THEME.muted : PROEVOL_THEME.value,
              flexShrink: 0,
            }}
          >
            {index.toString().padStart(2, '0')}
          </div>
          <div style={{ display: 'grid', gap: '4px', minWidth: 0 }}>
            <div
              style={{
                fontFamily: T.MONO,
                fontSize: '9px',
                color: PROEVOL_THEME.label,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              {kicker}
            </div>
            <div
              style={{
                fontFamily: T.SANS,
                fontSize: isDemoted ? '15px' : '22px',
                fontWeight: 700,
                color: PROEVOL_THEME.value,
                letterSpacing: '-0.03em',
                lineHeight: 1.18,
              }}
            >
              {title}
            </div>
            {description ? (
              <div
                style={{
                  fontFamily: T.SANS,
                  fontSize: isDemoted ? '11px' : '12.5px',
                  color: PROEVOL_THEME.muted,
                  lineHeight: 1.6,
                  maxWidth: isDemoted ? '640px' : '780px',
                }}
              >
                {description}
              </div>
            ) : null}
          </div>
        </div>
        {actions ? <div style={{ flexShrink: 0 }}>{actions}</div> : null}
      </header>
      <div>{children}</div>
    </section>
  );
}
