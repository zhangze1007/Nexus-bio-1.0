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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
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
            label="Predicted expression"
            value={lead.predictedExpression.toFixed(1)}
            detail={`Δ vs WT ${formatSigned(lead.predictedExpression - campaign.wildType.predictedExpression, 1)}`}
            accent={PROEVOL_THEME.apricot}
          />
          <MetricBadge
            label="Predicted specificity"
            value={lead.predictedSpecificity.toFixed(1)}
            detail={`Δ vs WT ${formatSigned(lead.predictedSpecificity - campaign.wildType.predictedSpecificity, 1)}`}
            accent={PROEVOL_THEME.lilac}
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

        {/* Score breakdown */}
        <ScoreBreakdown score={lead.score} />
      </div>
    </ProEvolCard>
  );
}

function ScoreBreakdown({ score }: { score: import('../../../services/ProEvolCampaignEngine').VariantScore }) {
  const terms = [
    { label: 'Activity', value: score.activityTerm, color: PROEVOL_THEME.mint },
    { label: 'Stability', value: score.stabilityTerm, color: PROEVOL_THEME.sky },
    { label: 'Expression', value: score.expressionTerm, color: PROEVOL_THEME.apricot },
    { label: 'Specificity', value: score.specificityTerm, color: PROEVOL_THEME.lilac },
  ];
  const penalties = [
    { label: 'Burden', value: score.burdenPenalty, color: PROEVOL_THEME.coral },
    { label: 'Risk', value: score.riskPenalty, color: PROEVOL_THEME.coral },
  ];
  const maxVal = Math.max(...terms.map((t) => t.value), ...penalties.map((p) => p.value), 1);
  const barMax = 100;

  return (
    <div
      style={{
        padding: '12px',
        borderRadius: '14px',
        border: `1px solid ${PROEVOL_THEME.border}`,
        background: 'rgba(255,255,255,0.02)',
        display: 'grid',
        gap: '6px',
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
        Score breakdown
      </div>
      {terms.map((term) => (
        <div key={term.label} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 44px', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontFamily: T.MONO, fontSize: '10px', color: PROEVOL_THEME.muted }}>{term.label}</span>
          <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(term.value / maxVal) * barMax}%`,
                height: '100%',
                borderRadius: '3px',
                background: term.color,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span style={{ fontFamily: T.MONO, fontSize: '10px', color: PROEVOL_THEME.value, textAlign: 'right', fontFeatureSettings: "'tnum' 1" }}>
            {term.value.toFixed(1)}
          </span>
        </div>
      ))}
      {penalties.map((pen) => (
        <div key={pen.label} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 44px', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontFamily: T.MONO, fontSize: '10px', color: PROEVOL_THEME.muted }}>{pen.label}</span>
          <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(pen.value / maxVal) * barMax}%`,
                height: '100%',
                borderRadius: '3px',
                background: pen.color,
                opacity: 0.7,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span style={{ fontFamily: T.MONO, fontSize: '10px', color: PROEVOL_THEME.coral, textAlign: 'right', fontFeatureSettings: "'tnum' 1" }}>
            −{pen.value.toFixed(1)}
          </span>
        </div>
      ))}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '72px 1fr 44px',
          gap: '8px',
          alignItems: 'center',
          paddingTop: '4px',
          borderTop: `1px solid ${PROEVOL_THEME.border}`,
        }}
      >
        <span style={{ fontFamily: T.MONO, fontSize: '10px', color: PROEVOL_THEME.value, fontWeight: 600 }}>Composite</span>
        <div />
        <span style={{ fontFamily: T.MONO, fontSize: '11px', color: PROEVOL_THEME.value, textAlign: 'right', fontWeight: 600, fontFeatureSettings: "'tnum' 1" }}>
          {score.composite.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
