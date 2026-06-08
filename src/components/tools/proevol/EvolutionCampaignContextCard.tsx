'use client';

import WorkbenchRangeSlider from '../shared/WorkbenchRangeSlider';
import type { ProteinEvolutionCampaign } from '../../../services/ProEvolCampaignEngine';
import {
  PROEVOL_THEME,
  StatusPill,
  formatPercent,
} from './shared';
import { THEME } from '../../../theme';

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
    <div style={{ display: 'grid', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{
          fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.label,
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>Parameters</span>
        <StatusPill tone={campaign.provenance === 'simulated' ? 'warm' : 'cool'}>
          {campaign.provenance}
        </StatusPill>
      </div>

      <div style={{ display: 'grid', gap: '5px' }}>
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

      <div style={{
        padding: '6px 8px', borderRadius: 'var(--nb-radius-sm)',
        border: `1px solid ${PROEVOL_THEME.border}`, background: PROEVOL_THEME.inset,
      }}>
        <div style={{
          fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.label,
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px',
        }}>
          Starting sequence
        </div>
        <div style={{
          fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.muted,
          lineHeight: 1.5, wordBreak: 'break-all', maxHeight: '60px', overflow: 'auto',
        }}>
          {campaign.startingSequence}
        </div>
      </div>
    </div>
  );
}
