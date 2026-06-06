'use client';

import type { RefObject } from 'react';
import { PATHD_THEME } from '../../workbench/workbenchTheme';
import { T } from '../../ide/tokens';

export interface SupportCard {
  eyebrow: string;
  value: string;
  body: string;
  chips: string[];
}

export default function EmbeddedSupportDock({
  supportCards,
  innerRef,
}: {
  supportCards: SupportCard[];
  innerRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={innerRef} className="nb-pathd-support-dock">
      <div className="nb-pathd-support-dock__grid">
        {supportCards.map((card) => (
          <div
            key={card.eyebrow}
            className="nb-pathd-support-dock__card"
            style={{
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(247,250,253,0.08) 16%, rgba(10,12,16,0.58) 100%)',
              boxShadow: '0 18px 34px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.10)',
              backdropFilter: 'blur(18px) saturate(135%)',
              WebkitBackdropFilter: 'blur(18px) saturate(135%)',
              padding: '12px 13px',
              display: 'grid',
              gap: '8px',
            }}
          >
            <div style={{ display: 'grid', gap: '4px' }}>
              <div
                style={{
                  fontFamily: T.MONO,
                  fontSize: '10px',
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  color: PATHD_THEME.label,
                }}
              >
                {card.eyebrow}
              </div>
              <div
                style={{
                  fontFamily: T.SANS,
                  fontSize: '13px',
                  fontWeight: 700,
                  color: PATHD_THEME.value,
                  lineHeight: 1.2,
                }}
              >
                {card.value}
              </div>
            </div>
            <div
              style={{
                fontFamily: T.SANS,
                fontSize: '10.5px',
                lineHeight: 1.5,
                color: PATHD_THEME.label,
              }}
            >
              {card.body}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {card.chips.map((chip) => (
                <span
                  key={chip}
                  style={{
                    minHeight: '24px',
                    padding: '0 8px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.10)',
                    color: PATHD_THEME.value,
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontFamily: T.MONO,
                    fontSize: '10px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
