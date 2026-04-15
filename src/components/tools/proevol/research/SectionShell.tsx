'use client';

import type { ReactNode } from 'react';
import { T } from '../../../ide/tokens';
import { PROEVOL_THEME } from '../shared';

interface SectionShellProps {
  index: number;
  kicker: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function SectionShell({
  index,
  kicker,
  title,
  description,
  actions,
  children,
}: SectionShellProps) {
  return (
    <section
      style={{
        display: 'grid',
        gap: '14px',
        padding: '18px 20px',
        borderRadius: '22px',
        border: `1px solid ${PROEVOL_THEME.borderStrong}`,
        background: 'linear-gradient(180deg, rgba(14,17,22,0.92) 0%, rgba(9,11,15,0.92) 100%)',
        boxShadow: '0 24px 56px rgba(0,0,0,0.32)',
      }}
    >
      <header
        style={{
          display: 'flex',
          gap: '14px',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          paddingBottom: '12px',
          borderBottom: `1px solid ${PROEVOL_THEME.border}`,
        }}
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              borderRadius: '12px',
              border: `1px solid ${PROEVOL_THEME.borderStrong}`,
              background: 'rgba(255,255,255,0.04)',
              fontFamily: T.MONO,
              fontSize: '13px',
              fontWeight: 700,
              color: PROEVOL_THEME.value,
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
                fontSize: '20px',
                fontWeight: 700,
                color: PROEVOL_THEME.value,
                letterSpacing: '-0.03em',
                lineHeight: 1.2,
              }}
            >
              {title}
            </div>
            {description ? (
              <div
                style={{
                  fontFamily: T.SANS,
                  fontSize: '12px',
                  color: PROEVOL_THEME.muted,
                  lineHeight: 1.6,
                  maxWidth: '760px',
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
