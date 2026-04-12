'use client';

import type { ProteinEvolutionCampaign } from '../../../services/ProEvolCampaignEngine';
import { T } from '../../ide/tokens';
import {
  MetricBadge,
  ProEvolCard,
  PROEVOL_THEME,
  StatusPill,
} from './shared';

interface RoundResultsPanelProps {
  campaign: ProteinEvolutionCampaign;
  focusedRoundNumber: number;
  onFocusRoundChange: (roundNumber: number) => void;
}

export default function RoundResultsPanel({
  campaign,
  focusedRoundNumber,
  onFocusRoundChange,
}: RoundResultsPanelProps) {
  const focusedRound =
    campaign.rounds.find((roundResult) => roundResult.roundNumber === focusedRoundNumber)
    ?? campaign.currentRoundResult;

  return (
    <ProEvolCard
      eyebrow="Round Results"
      title={`Round ${focusedRound.roundNumber} library and selection outcome`}
      subtitle="The central story is the campaign library for each selection round: how many variants were generated, which ones survived, where the score moved, and whether diversity is still being preserved."
    >
      <div style={{ display: 'grid', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
          <MetricBadge
            label="Library size"
            value={`${focusedRound.librarySize}`}
            detail="Generated variants in the focused round"
            accent={PROEVOL_THEME.sky}
          />
          <MetricBadge
            label="Selected survivors"
            value={`${focusedRound.selectedSurvivors.length}`}
            detail="Variants carried forward into the next round"
            accent={PROEVOL_THEME.mint}
          />
          <MetricBadge
            label="Rejected variants"
            value={`${focusedRound.rejectedVariants.length}`}
            detail="Variants filtered out by score, floor, or burden"
            accent={PROEVOL_THEME.coral}
          />
          <MetricBadge
            label="Best lead delta"
            value={focusedRound.bestLeadDelta.toFixed(1)}
            detail={`Average round score ${focusedRound.averageScore.toFixed(1)}`}
            accent={PROEVOL_THEME.apricot}
          />
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <StatusPill tone={focusedRound.diversitySummary.classification === 'over-collapsing early' ? 'alert' : 'cool'}>
              {focusedRound.diversitySummary.classification}
            </StatusPill>
            <StatusPill tone={focusedRound.convergenceSummary.state === 'plateau' ? 'warm' : 'neutral'}>
              {focusedRound.convergenceSummary.state}
            </StatusPill>
          </div>
          <div
            style={{
              fontFamily: T.SANS,
              fontSize: '11px',
              lineHeight: 1.6,
              color: PROEVOL_THEME.muted,
            }}
          >
            {focusedRound.diversitySummary.narrative} {focusedRound.convergenceSummary.narrative}
          </div>
          <div
            style={{
              fontFamily: T.MONO,
              fontSize: '10px',
              color: PROEVOL_THEME.value,
              lineHeight: 1.5,
            }}
          >
            Persistent substitutions: {focusedRound.persistentMutations.join(', ') || 'none yet'}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gap: '8px',
            paddingTop: '4px',
          }}
        >
          <div
            style={{
              fontFamily: T.MONO,
              fontSize: '9px',
              color: PROEVOL_THEME.label,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Round history
          </div>
          {campaign.rounds.map((roundResult) => {
            const isActive = roundResult.roundNumber === focusedRound.roundNumber;
            return (
              <button
                key={roundResult.roundNumber}
                type="button"
                onClick={() => onFocusRoundChange(roundResult.roundNumber)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: `1px solid ${isActive ? `${PROEVOL_THEME.mint}55` : PROEVOL_THEME.border}`,
                  background: isActive ? 'rgba(191,220,205,0.12)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  display: 'grid',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                  <div
                    style={{
                      fontFamily: T.SANS,
                      fontSize: '12px',
                      fontWeight: 600,
                      color: PROEVOL_THEME.value,
                    }}
                  >
                    Round {roundResult.roundNumber}
                  </div>
                  <div
                    style={{
                      fontFamily: T.MONO,
                      fontSize: '10px',
                      color: PROEVOL_THEME.label,
                    }}
                  >
                    lead {roundResult.selectedSurvivors[0]?.score.composite.toFixed(1) ?? '0.0'}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    fontFamily: T.MONO,
                    fontSize: '9px',
                    color: PROEVOL_THEME.label,
                  }}
                >
                  <span>{roundResult.selectedSurvivors.length} selected</span>
                  <span>{roundResult.rejectedVariants.length} rejected</span>
                  <span>diversity {roundResult.diversitySummary.index.toFixed(2)}</span>
                  <span>delta {roundResult.scoreDeltaVsPrevious.toFixed(1)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </ProEvolCard>
  );
}
