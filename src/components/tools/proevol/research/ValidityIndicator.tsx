'use client';

import { T } from '../../../ide/tokens';
import { PROEVOL_THEME } from '../shared';
import type {
  ProEvolBandSemantic,
  ProEvolValidity,
} from '../../../../domain/proevolArtifact';

interface ValidityIndicatorProps {
  validity: ProEvolValidity;
  bandSemantic: ProEvolBandSemantic;
  source: string;
  replicateCount: number;
  compact?: boolean;
}

interface ValidityCopy {
  label: string;
  tone: string;
  explanation: string;
}

function copyFor(validity: ProEvolValidity, bandSemantic: ProEvolBandSemantic): ValidityCopy {
  // Truth boundary: 'EXPERIMENT-BACKED' is reserved for actual measurement.
  // Modeled artifacts always read as 'MODEL-DERIVED', regardless of validity tier,
  // so the UI never accidentally claims wet-lab uncertainty.
  if (bandSemantic === 'measurement' && validity === 'real') {
    return {
      label: 'EXPERIMENT-BACKED',
      tone: PROEVOL_THEME.successHigh,
      explanation:
        'Frequencies and bands are derived from supplied per-replicate read counts. Bands are 95% CIs across biological replicates.',
    };
  }
  if (validity === 'partial') {
    return {
      label: 'MODEL-DERIVED · CONTEXT',
      tone: PROEVOL_THEME.riskLow,
      explanation:
        'Counts are model draws shaped by upstream Nexus-Bio context. Bands represent spread across model draws, not biological replicates.',
    };
  }
  return {
    label: 'MODEL-DERIVED · DEMO',
    tone: PROEVOL_THEME.riskMedium,
    explanation:
      'No upstream context. Counts and bands come from the campaign engine only — treat as illustrative, not measurement.',
  };
}

export default function ValidityIndicator({
  validity,
  bandSemantic,
  source,
  replicateCount,
  compact = false,
}: ValidityIndicatorProps) {
  const copy = copyFor(validity, bandSemantic);
  const isModeled = bandSemantic === 'modeled';
  const replicateNoun = isModeled ? 'model draw' : 'replicate';
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
            n = {replicateCount} {replicateNoun}{replicateCount === 1 ? '' : 's'}
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
