'use client';

import type { ProteinEvolutionCampaign, VariantCandidate } from '../../../services/ProEvolCampaignEngine';
import { T } from '../../ide/tokens';
import {
  MetricBadge,
  ProEvolCard,
  PROEVOL_THEME,
  StatusPill,
  formatSigned,
} from './shared';

function burdenRiskLabel(variant: VariantCandidate) {
  if (variant.mutationBurden >= 4 || variant.riskFlags.includes('mutation burden')) return 'elevated';
  if (variant.mutationBurden >= 3) return 'watch';
  return 'controlled';
}

export default function SelectionDecisionCard({
  campaign,
  focusedVariant,
}: {
  campaign: ProteinEvolutionCampaign;
  focusedVariant: VariantCandidate;
}) {
  const currentRound = campaign.currentRoundResult;
  const burdenRisk = burdenRiskLabel(campaign.leadVariant);
  const improvementOverWildType = campaign.leadVariant.score.deltaFromWildType;

  return (
    <ProEvolCard
      eyebrow="Selection Decision"
      title="Campaign decision support"
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
        <MetricBadge
          label="Lead variant score"
          value={campaign.leadVariant.score.composite.toFixed(1)}
          detail={campaign.leadVariant.name}
          accent={PROEVOL_THEME.mint}
        />
        <MetricBadge
          label="Selected this round"
          value={`${currentRound.selectedSurvivors.length}`}
          detail={`${currentRound.rejectedVariants.length} rejected`}
          accent={PROEVOL_THEME.sky}
        />
        <MetricBadge
          label="Library diversity index"
          value={campaign.diversitySummary.index.toFixed(2)}
          detail={campaign.diversitySummary.classification}
          accent={PROEVOL_THEME.lilac}
        />
        <MetricBadge
          label="Improvement over wild type"
          value={formatSigned(improvementOverWildType, 1)}
          detail={`Lead activity ${campaign.leadVariant.predictedActivity.toFixed(1)}`}
          accent={PROEVOL_THEME.apricot}
        />
        <MetricBadge
          label="Stability floor"
          value={campaign.leadVariant.predictedStability.toFixed(1)}
          detail={campaign.leadVariant.predictedStability < 55 ? 'Approaching floor' : 'Above floor'}
          accent={campaign.leadVariant.predictedStability < 55 ? PROEVOL_THEME.coral : PROEVOL_THEME.mint}
        />
        <MetricBadge
          label="Lead expression"
          value={campaign.leadVariant.predictedExpression.toFixed(1)}
          detail={`Δ vs WT ${formatSigned(campaign.leadVariant.predictedExpression - campaign.wildType.predictedExpression, 1)}`}
          accent={PROEVOL_THEME.apricot}
        />
        <MetricBadge
          label="Lead specificity"
          value={campaign.leadVariant.predictedSpecificity.toFixed(1)}
          detail={`Δ vs WT ${formatSigned(campaign.leadVariant.predictedSpecificity - campaign.wildType.predictedSpecificity, 1)}`}
          accent={PROEVOL_THEME.lilac}
        />
        <MetricBadge
          label="Mutation burden risk"
          value={burdenRisk}
          detail={`${campaign.leadVariant.mutationBurden} substitutions`}
          accent={burdenRisk === 'elevated' ? PROEVOL_THEME.coral : PROEVOL_THEME.sky}
        />
        <MetricBadge
          label="Convergence signal"
          value={campaign.convergenceSignal.state}
          detail={`Family concentration ${(campaign.convergenceSignal.familyConcentration * 100).toFixed(0)}%`}
          accent={campaign.convergenceSignal.state === 'productive-convergence' ? PROEVOL_THEME.mint : PROEVOL_THEME.apricot}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gap: '8px',
          padding: '8px 10px',
          borderRadius: '12px',
          border: `1px solid ${PROEVOL_THEME.border}`,
          background: 'linear-gradient(135deg, rgba(232,163,161,0.10) 0%, rgba(191,220,205,0.08) 100%)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <StatusPill tone="cool">{campaign.selectionDecision.recommendedAction}</StatusPill>
          <StatusPill tone={campaign.nextRoundRecommendation.stopSuggested ? 'warm' : 'neutral'}>
            confidence {(campaign.selectionDecision.confidence * 100).toFixed(0)}%
          </StatusPill>
        </div>
        <div style={{ fontFamily: T.SANS, fontSize: '12px', color: PROEVOL_THEME.value, fontWeight: 600, lineHeight: 1.45 }}>
          {campaign.selectionDecision.summary}
        </div>
        <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PROEVOL_THEME.muted, lineHeight: 1.65 }}>
          {campaign.selectionDecision.researchBrief}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '8px',
          padding: '8px 10px',
          borderRadius: '12px',
          border: `1px solid ${PROEVOL_THEME.border}`,
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        <div
          style={{
            fontFamily: T.MONO,
            fontSize: '10px',
            color: PROEVOL_THEME.label,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Focused variant
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <StatusPill tone={focusedVariant.status === 'selected' ? 'cool' : 'warm'}>
            {focusedVariant.status}
          </StatusPill>
          <StatusPill tone="neutral">round {focusedVariant.round}</StatusPill>
        </div>
        <div style={{ fontFamily: T.SANS, fontSize: '13px', color: PROEVOL_THEME.value, fontWeight: 600 }}>
          {focusedVariant.name}
        </div>
        <div style={{ fontFamily: T.MONO, fontSize: '11px', color: PROEVOL_THEME.value, lineHeight: 1.5 }}>
          {focusedVariant.mutationString}
        </div>
        <div style={{ display: 'grid', gap: '3px', fontFamily: T.SANS, fontSize: '10px', color: PROEVOL_THEME.muted, lineHeight: 1.5 }}>
          <div>Parent: {focusedVariant.parentId ?? 'WT'} · {focusedVariant.status === 'selected' ? focusedVariant.selectionReason : focusedVariant.rejectionReason}</div>
          <div style={{ fontFamily: T.MONO, fontSize: '10px' }}>
            score {focusedVariant.score.composite.toFixed(1)} · act {focusedVariant.predictedActivity.toFixed(1)} · stab {focusedVariant.predictedStability.toFixed(1)} · expr {focusedVariant.predictedExpression.toFixed(1)} · spec {focusedVariant.predictedSpecificity.toFixed(1)} · conf {focusedVariant.confidence.toFixed(0)}%
          </div>
          <div style={{ fontSize: '10px', color: PROEVOL_THEME.muted }}>{focusedVariant.rationale}</div>
        </div>
      </div>
    </ProEvolCard>
  );
}
