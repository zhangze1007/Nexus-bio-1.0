'use client';

import type { ProteinEvolutionCampaign } from '../../../services/ProEvolCampaignEngine';
import { T } from '../../ide/tokens';
import { ProEvolCard, PROEVOL_THEME, StatusPill } from './shared';

export default function NextRoundRecommendationCard({ campaign }: { campaign: ProteinEvolutionCampaign }) {
  const recommendation = campaign.nextRoundRecommendation;

  return (
    <ProEvolCard
      eyebrow="Next-Round Recommendation"
      title={recommendation.title}
      subtitle="PROEVOL ends by turning round evidence into the next campaign action, so the page behaves like an evolution advisor rather than a static history report."
    >
      <div style={{ display: 'grid', gap: '12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <StatusPill tone={recommendation.downstreamTransfer ? 'cool' : 'neutral'}>
            {recommendation.action}
          </StatusPill>
          <StatusPill tone={recommendation.stopSuggested ? 'warm' : 'cool'}>
            {recommendation.stopSuggested ? 'stop suggested' : 'campaign active'}
          </StatusPill>
        </div>

        <div
          style={{
            display: 'grid',
            gap: '8px',
            padding: '14px',
            borderRadius: '16px',
            border: `1px solid ${PROEVOL_THEME.borderStrong}`,
            background: 'linear-gradient(135deg, rgba(191,220,205,0.10) 0%, rgba(207,196,227,0.08) 48%, rgba(231,199,169,0.08) 100%)',
          }}
        >
          <div style={{ fontFamily: T.SANS, fontSize: '13px', fontWeight: 600, color: PROEVOL_THEME.value, lineHeight: 1.45 }}>
            {recommendation.summary}
          </div>
          <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PROEVOL_THEME.muted, lineHeight: 1.65 }}>
            {recommendation.rationale}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gap: '8px',
            padding: '12px',
            borderRadius: '14px',
            border: `1px solid ${PROEVOL_THEME.border}`,
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          <div
            style={{
              fontFamily: T.MONO,
              fontSize: '9px',
              color: PROEVOL_THEME.label,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Recommended next actions
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {recommendation.directives.map((directive) => (
              <div
                key={directive}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '18px minmax(0, 1fr)',
                  gap: '8px',
                  alignItems: 'start',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${PROEVOL_THEME.border}`,
                    color: PROEVOL_THEME.value,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: T.MONO,
                    fontSize: '10px',
                  }}
                >
                  →
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PROEVOL_THEME.value, lineHeight: 1.55 }}>
                  {directive}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProEvolCard>
  );
}
