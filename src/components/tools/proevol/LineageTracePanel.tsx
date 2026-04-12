'use client';

import { useMemo } from 'react';
import type { ProteinEvolutionCampaign, VariantCandidate } from '../../../services/ProEvolCampaignEngine';
import { T } from '../../ide/tokens';
import { ProEvolCard, PROEVOL_THEME, StatusPill } from './shared';

function buildLeadPath(campaign: ProteinEvolutionCampaign) {
  const path: VariantCandidate[] = [];
  let cursor: VariantCandidate | undefined = campaign.leadVariant;
  while (cursor) {
    path.unshift(cursor);
    cursor = cursor.parentId ? campaign.variantIndex[cursor.parentId] : undefined;
    if (cursor?.id === 'wt') {
      path.unshift(cursor);
      break;
    }
  }
  return path;
}

export default function LineageTracePanel({
  campaign,
  selectedVariantId,
  onSelectVariant,
}: {
  campaign: ProteinEvolutionCampaign;
  selectedVariantId: string | null;
  onSelectVariant: (variantId: string) => void;
}) {
  const lineageVariants = useMemo(() => {
    const selectedAcrossRounds = campaign.rounds.flatMap((roundResult) => roundResult.selectedSurvivors);
    const spotlightRejected = [...campaign.currentRoundResult.rejectedVariants]
      .sort((left, right) => right.score.composite - left.score.composite)
      .slice(0, 4);
    return [campaign.wildType, ...selectedAcrossRounds, ...spotlightRejected];
  }, [campaign]);
  const variantIds = new Set(lineageVariants.map((variant) => variant.id));
  const leadPath = buildLeadPath(campaign);
  const families = Array.from(new Set(lineageVariants.map((variant) => variant.familyLabel)));
  const width = 820;
  const height = 320;
  const padX = 70;
  const padY = 46;

  function xForRound(round: number) {
    return padX + (round / Math.max(campaign.totalRounds, 1)) * (width - padX * 2);
  }

  function yForVariant(variant: VariantCandidate) {
    const familyIndex = families.indexOf(variant.familyLabel);
    const laneHeight = (height - padY * 2) / Math.max(families.length - 1, 1);
    return padY + familyIndex * laneHeight + (variant.embedding.y - 0.5) * 18;
  }

  return (
    <ProEvolCard
      eyebrow="Lineage / Evolution Trace"
      title="Survivor families across selection rounds"
      subtitle="The lineage trace follows parent-child families, shows where branches persisted or died out, and keeps mutation accumulation visible as a campaign history rather than a generic trajectory."
    >
      <div style={{ display: 'grid', gap: '12px' }}>
        <svg role="img" aria-label="PROEVOL lineage trace" viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
          <rect width={width} height={height} rx={18} fill="#080b10" />
          {families.map((family, index) => {
            const laneHeight = (height - padY * 2) / Math.max(families.length - 1, 1);
            const y = padY + index * laneHeight;
            return (
              <g key={family}>
                <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="rgba(255,255,255,0.05)" />
                <text x="18" y={y + 4} fontFamily={T.SANS} fontSize="10" fill={PROEVOL_THEME.label}>
                  {family}
                </text>
              </g>
            );
          })}
          {Array.from({ length: campaign.totalRounds + 1 }, (_, round) => (
            <g key={round}>
              <line x1={xForRound(round)} y1={padY - 18} x2={xForRound(round)} y2={height - padY + 14} stroke="rgba(255,255,255,0.06)" />
              <text x={xForRound(round)} y="22" textAnchor="middle" fontFamily={T.MONO} fontSize="9" fill={PROEVOL_THEME.label}>
                {round === 0 ? 'WT' : `R${round}`}
              </text>
            </g>
          ))}

          {lineageVariants.map((variant) => {
            if (!variant.parentId || !variantIds.has(variant.parentId)) return null;
            const parent = campaign.variantIndex[variant.parentId];
            if (!parent || !variantIds.has(parent.id)) return null;
            const highlighted = leadPath.some((item) => item.id === variant.id) && leadPath.some((item) => item.id === parent.id);
            return (
              <path
                key={`${parent.id}-${variant.id}`}
                d={`M ${xForRound(parent.round)} ${yForVariant(parent)} C ${xForRound(parent.round) + 24} ${yForVariant(parent)}, ${xForRound(variant.round) - 24} ${yForVariant(variant)}, ${xForRound(variant.round)} ${yForVariant(variant)}`}
                fill="none"
                stroke={highlighted ? PROEVOL_THEME.mint : variant.status === 'selected' ? 'rgba(175,195,214,0.52)' : 'rgba(255,255,255,0.16)'}
                strokeWidth={highlighted ? 2.4 : 1.3}
                opacity={variant.status === 'selected' ? 1 : 0.62}
              />
            );
          })}

          {lineageVariants.map((variant) => {
            const selected = selectedVariantId === variant.id;
            const lead = variant.id === campaign.leadVariant.id;
            const fill =
              lead
                ? PROEVOL_THEME.mint
                : variant.status === 'selected'
                  ? PROEVOL_THEME.sky
                  : variant.status === 'rejected'
                    ? PROEVOL_THEME.coral
                    : 'rgba(255,255,255,0.42)';
            return (
              <g key={variant.id} onClick={() => onSelectVariant(variant.id)} style={{ cursor: 'pointer' }}>
                <circle
                  cx={xForRound(variant.round)}
                  cy={yForVariant(variant)}
                  r={lead ? 6 : selected ? 5 : variant.status === 'selected' ? 4 : 3.2}
                  fill={fill}
                  stroke={selected ? '#ffffff' : 'rgba(255,255,255,0.22)'}
                  strokeWidth={selected ? 1.8 : 1}
                />
                {(lead || selected) ? (
                  <text
                    x={xForRound(variant.round)}
                    y={yForVariant(variant) - 10}
                    textAnchor="middle"
                    fontFamily={T.MONO}
                    fontSize="8"
                    fill="rgba(255,255,255,0.86)"
                  >
                    {variant.name}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <StatusPill tone="cool">lead lineage</StatusPill>
          <StatusPill tone="neutral">survivor branch</StatusPill>
          <StatusPill tone="warm">rejected / dead branch</StatusPill>
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
            Mutation accumulation on the current lead path
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {leadPath.map((variant) => (
              <StatusPill
                key={variant.id}
                tone={variant.id === campaign.leadVariant.id ? 'cool' : 'neutral'}
              >
                {variant.round === 0 ? variant.name : `R${variant.round} ${variant.mutationString}`}
              </StatusPill>
            ))}
          </div>
        </div>
      </div>
    </ProEvolCard>
  );
}
