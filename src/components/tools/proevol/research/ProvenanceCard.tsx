'use client';

import { T } from '../../../ide/tokens';
import { PROEVOL_THEME } from '../shared';
import type { ProEvolProvenance } from '../../../../domain/proevolArtifact';
import ValidityIndicator from './ValidityIndicator';

export default function ProvenanceCard({ provenance }: { provenance: ProEvolProvenance }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '12px',
        padding: '14px 16px',
        borderRadius: '16px',
        border: `1px solid ${PROEVOL_THEME.borderStrong}`,
        background: 'rgba(8,11,16,0.6)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '4px', minWidth: 0 }}>
          <div
            style={{
              fontFamily: T.MONO,
              fontSize: '9px',
              letterSpacing: '0.12em',
              color: PROEVOL_THEME.label,
              textTransform: 'uppercase',
            }}
          >
            Data Provenance
          </div>
          <div
            style={{
              fontFamily: T.SANS,
              fontSize: '13px',
              fontWeight: 600,
              color: PROEVOL_THEME.value,
              lineHeight: 1.5,
            }}
          >
            {provenance.source}
          </div>
        </div>
        <ValidityIndicator
          validity={provenance.validity}
          bandSemantic={provenance.bandSemantic}
          source={provenance.source}
          replicateCount={provenance.replicateCount}
          compact
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px',
        }}
      >
        <ProvenanceStat label="Provenance kind" value={provenance.kind} />
        <ProvenanceStat
          label={provenance.bandSemantic === 'modeled' ? 'Model draws' : 'Replicates'}
          value={`${provenance.replicateCount}`}
        />
        <ProvenanceStat
          label="Modeled depth"
          value={
            provenance.sequencingDepthPerSample
              ? `${(provenance.sequencingDepthPerSample / 1000).toFixed(0)}k reads / draw`
              : '—'
          }
        />
        <ProvenanceStat
          label="Band semantic"
          value={provenance.bandSemantic === 'measurement' ? '95% CI' : 'model spread'}
        />
      </div>

      {provenance.statisticalNotes.length > 0 ? (
        <ul style={{ display: 'grid', gap: '6px', margin: 0, paddingLeft: '16px' }}>
          {provenance.statisticalNotes.map((note) => (
            <li
              key={note}
              style={{
                fontFamily: T.SANS,
                fontSize: '11px',
                lineHeight: 1.55,
                color: PROEVOL_THEME.muted,
              }}
            >
              {note}
            </li>
          ))}
        </ul>
      ) : null}

      {provenance.notes ? (
        <div
          style={{
            fontFamily: T.SANS,
            fontSize: '11px',
            color: PROEVOL_THEME.riskMedium,
            lineHeight: 1.55,
            padding: '8px 10px',
            borderRadius: '10px',
            border: `1px solid ${PROEVOL_THEME.riskMedium}33`,
            background: `${PROEVOL_THEME.riskMedium}10`,
          }}
        >
          {provenance.notes}
        </div>
      ) : null}
    </div>
  );
}

function ProvenanceStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '3px',
        padding: '8px 10px',
        borderRadius: '10px',
        border: `1px solid ${PROEVOL_THEME.border}`,
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div
        style={{
          fontFamily: T.MONO,
          fontSize: '9px',
          letterSpacing: '0.08em',
          color: PROEVOL_THEME.label,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: T.SANS,
          fontSize: '12px',
          color: PROEVOL_THEME.value,
          fontWeight: 600,
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </div>
    </div>
  );
}
