'use client';

import WorkbenchRangeSlider from '../shared/WorkbenchRangeSlider';
import type { ProteinEvolutionCampaign } from '../../../services/ProEvolCampaignEngine';
import { T } from '../../ide/tokens';
import {
  ProEvolCard,
  PROEVOL_THEME,
  StatusPill,
  formatPercent,
} from './shared';

interface EvolutionCampaignContextCardProps {
  campaign: ProteinEvolutionCampaign;
  totalRounds: number;
  librarySize: number;
  survivorCount: number;
  selectionStringency: number;
  onTotalRoundsChange: (value: number) => void;
  onLibrarySizeChange: (value: number) => void;
  onSurvivorCountChange: (value: number) => void;
  onSelectionStringencyChange: (value: number) => void;
}

function detailRow(label: string, value: string) {
  return (
    <div
      key={label}
      style={{
        display: 'grid',
        gap: '4px',
        padding: '10px 0',
        borderBottom: `1px solid ${PROEVOL_THEME.border}`,
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
        {label}
      </div>
      <div
        style={{
          fontFamily: T.SANS,
          fontSize: '12px',
          color: PROEVOL_THEME.value,
          lineHeight: 1.55,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function EvolutionCampaignContextCard({
  campaign,
  totalRounds,
  librarySize,
  survivorCount,
  selectionStringency,
  onTotalRoundsChange,
  onLibrarySizeChange,
  onSurvivorCountChange,
  onSelectionStringencyChange,
}: EvolutionCampaignContextCardProps) {
  return (
    <ProEvolCard
      eyebrow="Campaign Context"
      title={campaign.name}
      subtitle="PROEVOL is framed here as a directed-evolution campaign brief: starting protein, assay pressure, host context, round state, and provenance are visible before any variant is interpreted."
      actions={
        <StatusPill tone={campaign.provenance === 'simulated' ? 'warm' : 'cool'}>
          {campaign.provenance}
        </StatusPill>
      }
    >
      <div style={{ display: 'grid', gap: '6px' }}>
        {detailRow('Target protein / enzyme', campaign.targetProtein)}
        {detailRow('Wild-type label', campaign.wildTypeLabel)}
        {detailRow('Optimization objective', campaign.optimizationObjective.summary)}
        {detailRow('Selection pressure / assay', `${campaign.selectionPressure} · ${campaign.assayCondition}`)}
        {detailRow('Host / screening system', `${campaign.hostSystem} · ${campaign.screeningSystem}`)}
        {detailRow('Round state', `Current round ${campaign.currentRound} of ${campaign.totalRounds}`)}
      </div>

      <div style={{ display: 'grid', gap: '10px', paddingTop: '6px' }}>
        <WorkbenchRangeSlider
          label="Selection rounds"
          value={totalRounds}
          min={3}
          max={8}
          step={1}
          onChange={onTotalRoundsChange}
          formatValue={(value) => `${value.toFixed(0)} rounds`}
        />
        <WorkbenchRangeSlider
          label="Library size"
          value={librarySize}
          min={10}
          max={24}
          step={2}
          onChange={onLibrarySizeChange}
          formatValue={(value) => `${value.toFixed(0)} variants`}
        />
        <WorkbenchRangeSlider
          label="Survivors / round"
          value={survivorCount}
          min={3}
          max={8}
          step={1}
          onChange={onSurvivorCountChange}
          formatValue={(value) => `${value.toFixed(0)} survivors`}
        />
        <WorkbenchRangeSlider
          label="Selection stringency"
          value={selectionStringency}
          min={0.35}
          max={0.9}
          step={0.05}
          onChange={onSelectionStringencyChange}
          formatValue={(value) => formatPercent(value * 100, 0)}
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
        <div
          style={{
            fontFamily: T.MONO,
            fontSize: '9px',
            color: PROEVOL_THEME.label,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Starting sequence
        </div>
        <div
          style={{
            fontFamily: T.MONO,
            fontSize: '10px',
            color: PROEVOL_THEME.value,
            lineHeight: 1.65,
            wordBreak: 'break-all',
            maxHeight: '172px',
            overflow: 'auto',
          }}
        >
          {campaign.startingSequence}
        </div>
        <div
          style={{
            fontFamily: T.SANS,
            fontSize: '10px',
            color: PROEVOL_THEME.muted,
            lineHeight: 1.5,
          }}
        >
          Wild type remains visible so each round is read as an evolving lineage against a fixed campaign reference, not as an abstract optimization point.
        </div>
      </div>
    </ProEvolCard>
  );
}
