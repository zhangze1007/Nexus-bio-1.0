'use client';

import type { ReactNode } from 'react';
import { PROEVOL_THEME } from '../shared';
import type { ProEvolProvenance } from '../../../../domain/proevolArtifact';
import ValidityIndicator from './ValidityIndicator';
import { THEME } from '../../../../theme';

interface TruthHeaderProps {
  campaignName: string;
  targetProduct: string;
  provenance: ProEvolProvenance;
  /** Optional inline actions (e.g., quick-export). */
  actions?: ReactNode;
}

/**
 * Persistent truth strip rendered above every PROEVOL section. It is the page's
 * honesty boundary: validity, source, replicate semantic, and a one-line
 * disclaimer when bands are modeled. Designed to be impossible to scroll past
 * before reading any chart.
 */
export default function TruthHeader({
  campaignName,
  targetProduct,
  provenance,
  actions,
}: TruthHeaderProps) {
  const isModeled = provenance.bandSemantic === 'modeled';
  const accent = isModeled ? PROEVOL_THEME.riskLow : PROEVOL_THEME.successHigh;

  return (
    <div
      style={{
        display: 'grid',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: 'var(--nb-radius-md)',
        border: `1px solid ${accent}33`,
        background: PROEVOL_THEME.surface,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr) auto',
          gap: '14px',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'grid', gap: '4px', minWidth: 0 }}>
          <div
            style={{
              fontFamily: THEME.MONO,
              fontSize: 'var(--nb-fs-xs)',
              color: PROEVOL_THEME.label,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            PROEVOL · Directed Evolution Workbench
          </div>
          <div
            style={{
              fontFamily: THEME.SANS,
              fontSize: 'var(--nb-fs-md)',
              fontWeight: 700,
              color: PROEVOL_THEME.value,
              letterSpacing: '-0.02em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {campaignName}
          </div>
          <div
            style={{
              fontFamily: THEME.SANS,
              fontSize: 'var(--nb-fs-sm)',
              color: PROEVOL_THEME.muted,
              lineHeight: 1.5,
            }}
          >
            Target product · {targetProduct}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '4px', minWidth: 0 }}>
          <ValidityIndicator
            validity={provenance.validity}
            bandSemantic={provenance.bandSemantic}
            source={provenance.source}
            replicateCount={provenance.replicateCount}
            compact
          />
          <div
            style={{
              fontFamily: THEME.SANS,
              fontSize: '10.5px',
              color: PROEVOL_THEME.muted,
              lineHeight: 1.5,
            }}
          >
            {provenance.source}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          {actions}
        </div>
      </div>

      {isModeled ? (
        <div
          style={{
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            padding: '5px 8px',
            borderRadius: 'var(--nb-radius-sm)',
            border: `1px solid ${accent}33`,
            background: `${accent}10`,
          }}
        >
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: 'var(--nb-fs-xs)',
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: accent,
              flexShrink: 0,
            }}
          >
            MODELED
          </span>
          <span
            style={{
              fontFamily: THEME.SANS,
              fontSize: 'var(--nb-fs-xs)',
              color: PROEVOL_THEME.muted,
              lineHeight: 1.4,
            }}
          >
            Deterministic model draws — bands show model spread, not biological CIs.
          </span>
        </div>
      ) : null}
    </div>
  );
}
