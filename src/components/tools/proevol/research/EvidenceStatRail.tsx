'use client';

import type { ReactNode } from 'react';
import { T } from '../../../ide/tokens';
import { PROEVOL_THEME } from '../shared';
import type {
  ConfidenceInterval,
  ProEvolResearchSummary,
} from '../../../../services/proevolAnalysis';
import type { ProEvolBandSemantic } from '../../../../domain/proevolArtifact';

interface EvidenceStatRailProps {
  research: ProEvolResearchSummary;
  bandSemantic: ProEvolBandSemantic;
}

function formatBand(ci: ConfidenceInterval | null, formatter: (value: number) => string) {
  if (!ci) return '—';
  return `${formatter(ci.lower)} – ${formatter(ci.upper)}`;
}

/**
 * Read-only statistical rail that lives next to the trajectory hero. It shows
 * only what is computable from the artifact, never recommendations. Band labels
 * adapt to `bandSemantic` so the rail never claims a CI it doesn't have.
 */
export default function EvidenceStatRail({ research, bandSemantic }: EvidenceStatRailProps) {
  const bandLabel = bandSemantic === 'measurement' ? '95% CI' : 'model spread';

  const lastDiversity = research.diversity[research.diversity.length - 1];
  const effectiveN = lastDiversity ? lastDiversity.effectiveVariantCount : null;
  const observedN = lastDiversity ? lastDiversity.observedVariantCount : null;
  const shannonDeltaTone =
    research.shannonDelta < -0.15
      ? PROEVOL_THEME.riskMedium
      : research.shannonDelta > 0.15
        ? PROEVOL_THEME.successHigh
        : PROEVOL_THEME.muted;

  return (
    <div
      style={{
        display: 'grid',
        gap: '10px',
        gridAutoRows: 'min-content',
        padding: '14px 14px 12px',
        borderRadius: '14px',
        border: `1px solid ${PROEVOL_THEME.border}`,
        background: 'rgba(255,255,255,0.02)',
        minWidth: 0,
        alignSelf: 'stretch',
      }}
    >
      <div style={kickerStyle}>last-round signal</div>
      <Row
        label="Shannon entropy"
        value={
          research.lastRoundShannon
            ? `${research.lastRoundShannon.mean.toFixed(2)} bits`
            : '—'
        }
        detail={`${bandLabel} ${formatBand(
          research.lastRoundShannon,
          (value) => value.toFixed(2),
        )}`}
        accent={PROEVOL_THEME.mint}
      />
      <Row
        label="Top-1 share"
        value={
          research.lastRoundTopShare
            ? `${(research.lastRoundTopShare.mean * 100).toFixed(1)}%`
            : '—'
        }
        detail={`${bandLabel} ${formatBand(
          research.lastRoundTopShare,
          (value) => `${(value * 100).toFixed(1)}%`,
        )}`}
        accent={PROEVOL_THEME.coral}
      />
      <Row
        label="Effective variants"
        value={effectiveN != null ? effectiveN.toFixed(1) : '—'}
        detail={observedN != null ? `${observedN} observed with reads > 0` : '—'}
        accent={PROEVOL_THEME.sky}
      />
      <Row
        label="Δ Shannon last round"
        value={`${research.shannonDelta >= 0 ? '+' : ''}${research.shannonDelta.toFixed(2)} bits`}
        detail={
          research.shannonDelta < -0.15
            ? 'sharp narrowing'
            : research.shannonDelta > 0.15
              ? 'still broadening'
              : 'stable'
        }
        accent={shannonDeltaTone}
      />
    </div>
  );
}

const kickerStyle = {
  fontFamily: T.MONO,
  fontSize: '9px',
  letterSpacing: '0.14em',
  color: PROEVOL_THEME.label,
  textTransform: 'uppercase' as const,
};

function Row({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string | ReactNode;
  accent: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '3px',
        padding: '8px 0 10px',
        borderTop: `1px solid ${PROEVOL_THEME.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '999px',
            background: accent,
          }}
        />
        <span
          style={{
            fontFamily: T.MONO,
            fontSize: '9px',
            color: PROEVOL_THEME.label,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontFamily: T.SANS,
          fontSize: '15px',
          fontWeight: 700,
          color: PROEVOL_THEME.value,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: T.SANS,
          fontSize: '10.5px',
          color: PROEVOL_THEME.muted,
          lineHeight: 1.5,
        }}
      >
        {detail}
      </div>
    </div>
  );
}
