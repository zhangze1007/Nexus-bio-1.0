'use client';

import type { ProteinEvolutionCampaign } from '../../../services/ProEvolCampaignEngine';
import { T } from '../../ide/tokens';
import {
  MetricBadge,
  ProEvolCard,
  PROEVOL_THEME,
  StatusPill,
  formatSigned,
} from './shared';

export default function LeadVariantCard({ campaign }: { campaign: ProteinEvolutionCampaign }) {
  const lead = campaign.leadVariant;

  return (
    <ProEvolCard
      eyebrow="Lead Variant Summary"
      title={lead.name}
      subtitle="The current campaign lead is presented as a selection outcome: when it emerged, what mutation stack it carries, how it scores, and why it still leads the evolving population."
      actions={<StatusPill tone="cool">Current lead variant</StatusPill>}
    >
      <div style={{ display: 'grid', gap: '10px' }}>
        <div
          style={{
            display: 'grid',
            gap: '6px',
            padding: '12px',
            borderRadius: '14px',
            border: `1px solid ${PROEVOL_THEME.border}`,
            background: 'linear-gradient(135deg, rgba(191,220,205,0.10) 0%, rgba(175,195,214,0.08) 100%)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <StatusPill tone="cool">Round {lead.round}</StatusPill>
            <StatusPill tone={lead.riskFlags.length ? 'warm' : 'neutral'}>
              burden {lead.mutationBurden}
            </StatusPill>
            <StatusPill tone={lead.predictedStability < 55 ? 'warm' : 'cool'}>
              stability {lead.predictedStability.toFixed(1)}
            </StatusPill>
          </div>
          <div
            style={{
              fontFamily: T.MONO,
              fontSize: '13px',
              color: PROEVOL_THEME.value,
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}
          >
            {lead.mutationString}
          </div>
          <div
            style={{
              fontFamily: T.SANS,
              fontSize: '11px',
              color: PROEVOL_THEME.muted,
              lineHeight: 1.6,
            }}
          >
            {campaign.leadNarrative}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
          <MetricBadge
            label="Predicted activity"
            value={lead.predictedActivity.toFixed(1)}
            detail={`Δ vs WT ${formatSigned(lead.predictedActivity - campaign.wildType.predictedActivity, 1)}`}
            accent={PROEVOL_THEME.mint}
          />
          <MetricBadge
            label="Predicted stability"
            value={lead.predictedStability.toFixed(1)}
            detail={`Round floor defended by ${formatSigned(lead.predictedStability - 55, 1)}`}
            accent={PROEVOL_THEME.sky}
          />
          <MetricBadge
            label="Developability / burden"
            value={`${lead.developability.toFixed(1)} / ${lead.mutationBurden}`}
            detail={lead.riskFlags.length ? lead.riskFlags.join(', ') : 'No major modeled risk flags'}
            accent={PROEVOL_THEME.apricot}
          />
          <MetricBadge
            label="Confidence"
            value={`${lead.confidence.toFixed(1)}%`}
            detail={`Composite score ${lead.score.composite.toFixed(1)} · ΔWT ${formatSigned(lead.score.deltaFromWildType, 1)}`}
            accent={PROEVOL_THEME.lilac}
          />
        </div>
      </div>
    </ProEvolCard>
  );
}
