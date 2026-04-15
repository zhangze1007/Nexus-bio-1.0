'use client';

import { T } from '../../../ide/tokens';
import { PROEVOL_THEME } from '../shared';
import type { ProEvolValidity } from '../../../../domain/proevolArtifact';

interface ValidityIndicatorProps {
  validity: ProEvolValidity;
  source: string;
  replicateCount: number;
  compact?: boolean;
}

const VALIDITY_COPY: Record<ProEvolValidity, { label: string; tone: string; explanation: string }> = {
  real: {
    label: 'REAL DATA',
    tone: PROEVOL_THEME.successHigh,
    explanation: 'Frequencies and confidence intervals are derived from supplied per-replicate read counts.',
  },
  partial: {
    label: 'PARTIAL · INFERRED',
    tone: PROEVOL_THEME.riskLow,
    explanation: 'Counts inferred from upstream Nexus-Bio context. Statistical bands use synthesized replicate variance.',
  },
  demo: {
    label: 'DEMO · SIMULATED',
    tone: PROEVOL_THEME.riskMedium,
    explanation: 'Counts are deterministically synthesized from the engine model. Not experimental measurement.',
  },
};

export default function ValidityIndicator({
  validity,
  source,
  replicateCount,
  compact = false,
}: ValidityIndicatorProps) {
  const copy = VALIDITY_COPY[validity];
  return (
    <div
      style={{
        display: 'inline-grid',
        gap: compact ? '2px' : '6px',
        padding: compact ? '6px 10px' : '10px 14px',
        borderRadius: '12px',
        border: `1px solid ${copy.tone}55`,
        background: `${copy.tone}14`,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '999px',
            background: copy.tone,
            boxShadow: `0 0 8px ${copy.tone}aa`,
          }}
        />
        <span
          style={{
            fontFamily: T.MONO,
            fontSize: '9px',
            letterSpacing: '0.14em',
            color: copy.tone,
            fontWeight: 700,
          }}
        >
          {copy.label}
        </span>
        {!compact ? (
          <span
            style={{
              fontFamily: T.MONO,
              fontSize: '9px',
              letterSpacing: '0.08em',
              color: PROEVOL_THEME.muted,
            }}
          >
            n = {replicateCount} replicate{replicateCount === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
      {!compact ? (
        <div
          style={{
            fontFamily: T.SANS,
            fontSize: '11px',
            color: PROEVOL_THEME.value,
            lineHeight: 1.55,
          }}
        >
          {copy.explanation}
        </div>
      ) : null}
      {!compact ? (
        <div
          style={{
            fontFamily: T.SANS,
            fontSize: '10px',
            color: PROEVOL_THEME.muted,
            lineHeight: 1.5,
          }}
        >
          Source: {source}
        </div>
      ) : null}
    </div>
  );
}
