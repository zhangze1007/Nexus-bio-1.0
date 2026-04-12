'use client';

import { useMemo } from 'react';
import type { ProteinEvolutionCampaign } from '../../../services/ProEvolCampaignEngine';
import { T } from '../../ide/tokens';
import {
  MetricBadge,
  ProEvolCard,
  PROEVOL_THEME,
  StatusPill,
} from './shared';

export default function DiversityConvergencePanel({ campaign }: { campaign: ProteinEvolutionCampaign }) {
  const currentRound = campaign.currentRoundResult;
  const familyDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    currentRound.selectedSurvivors.forEach((variant) => {
      counts.set(variant.familyLabel, (counts.get(variant.familyLabel) ?? 0) + 1);
    });
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [currentRound.selectedSurvivors]);
  const trendPoints = useMemo(() => {
    const width = 250;
    const height = 76;
    return campaign.rounds.map((roundResult, index) => {
      const x = campaign.rounds.length > 1 ? (index / (campaign.rounds.length - 1)) * (width - 8) + 4 : width / 2;
      const y = height - 8 - (roundResult.selectedSurvivors[0]?.score.composite ?? 0) / 100 * (height - 16);
      return `${x},${y}`;
    }).join(' ');
  }, [campaign.rounds]);

  return (
    <ProEvolCard
      eyebrow="Diversity and Convergence"
      title="Population health across the campaign"
      subtitle="PROEVOL should explain whether the campaign is still exploring useful sequence space, converging productively, or collapsing too early around one family."
    >
      <div style={{ display: 'grid', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
          <MetricBadge
            label="Diversity index"
            value={campaign.diversitySummary.index.toFixed(2)}
            detail={campaign.diversitySummary.classification}
            accent={PROEVOL_THEME.sky}
          />
          <MetricBadge
            label="Convergence signal"
            value={campaign.convergenceSignal.state}
            detail={`Family concentration ${(campaign.convergenceSignal.familyConcentration * 100).toFixed(0)}%`}
            accent={PROEVOL_THEME.apricot}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gap: '10px',
            padding: '12px',
            borderRadius: '14px',
            border: `1px solid ${PROEVOL_THEME.border}`,
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <StatusPill tone={campaign.diversitySummary.classification === 'over-collapsing early' ? 'alert' : 'cool'}>
              {campaign.diversitySummary.classification}
            </StatusPill>
            <StatusPill tone={campaign.convergenceSignal.state === 'productive-convergence' ? 'cool' : 'warm'}>
              {campaign.convergenceSignal.state}
            </StatusPill>
          </div>
          <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PROEVOL_THEME.muted, lineHeight: 1.6 }}>
            {campaign.diversitySummary.narrative} {campaign.convergenceSignal.narrative}
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
            Current survivor family distribution
          </div>
          {familyDistribution.map(([familyLabel, count]) => {
            const width = `${(count / Math.max(currentRound.selectedSurvivors.length, 1)) * 100}%`;
            return (
              <div key={familyLabel} style={{ display: 'grid', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ fontFamily: T.SANS, fontSize: '11px', color: PROEVOL_THEME.value }}>{familyLabel}</span>
                  <span style={{ fontFamily: T.MONO, fontSize: '10px', color: PROEVOL_THEME.label }}>{count}</span>
                </div>
                <div
                  style={{
                    height: '8px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                  }}
                >
                <div
                  style={{
                    width,
                    height: '100%',
                    borderRadius: '999px',
                    background: 'linear-gradient(90deg, #BFDCCD 0%, #AFC3D6 42%, #CFC4E3 72%, #E8A3A1 100%)',
                  }}
                />
              </div>
            </div>
          );
          })}
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
            Lead score trend across rounds
          </div>
          <svg role="img" aria-label="Lead score trend" viewBox="0 0 250 76" style={{ width: '100%', height: '76px' }}>
            <rect width="250" height="76" rx="12" fill="rgba(255,255,255,0.02)" />
            <polyline points={trendPoints} fill="none" stroke={PROEVOL_THEME.mint} strokeWidth="2.2" />
            {campaign.rounds.map((roundResult, index) => {
              const x = campaign.rounds.length > 1 ? (index / (campaign.rounds.length - 1)) * 242 + 4 : 125;
              const y = 68 - (roundResult.selectedSurvivors[0]?.score.composite ?? 0) / 100 * 60;
              return (
                <g key={roundResult.roundNumber}>
                  <circle cx={x} cy={y} r="3.2" fill={PROEVOL_THEME.sky} />
                  <text x={x} y="73" textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={PROEVOL_THEME.label}>
                    R{roundResult.roundNumber}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </ProEvolCard>
  );
}
