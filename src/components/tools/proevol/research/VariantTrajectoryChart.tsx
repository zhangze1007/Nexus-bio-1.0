'use client';

import { useMemo } from 'react';
import { FONT, SCI_SERIES } from '../../../charts/chartTheme';
import { ConfidenceLineChart } from '../../../charts/primitives';
import type { ConfidenceSeries } from '../../../charts/primitives';
import { PROEVOL_THEME } from '../shared';
import type { VariantTrajectory } from '../../../../services/proevolAnalysis';
import type { ProEvolBandSemantic } from '../../../../domain/proevolArtifact';

interface VariantTrajectoryChartProps {
  trajectories: VariantTrajectory[];
  bandSemantic: ProEvolBandSemantic;
  highlightVariantId?: string | null;
  onSelectVariant?: (variantId: string) => void;
}

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
const formatTickPercent = (value: number) => `${(value * 100).toFixed(0)}%`;

export default function VariantTrajectoryChart({
  trajectories,
  bandSemantic,
  highlightVariantId,
  onSelectVariant,
}: VariantTrajectoryChartProps) {
  const bandLabel = bandSemantic === 'measurement' ? '95% CI' : 'model spread';

  /**
   * Map `VariantTrajectory` points into the primitive's series schema.
   * `lower`/`upper` come directly from `ciFromReplicates` — we preserve
   * them intact; no synthesis happens here.
   */
  const series = useMemo<ConfidenceSeries[]>(() => {
    return trajectories.map((trajectory, index) => ({
      id: trajectory.variantId,
      label: trajectory.label,
      color: SCI_SERIES[index % SCI_SERIES.length],
      highlighted: !highlightVariantId || highlightVariantId === trajectory.variantId,
      points: trajectory.points.map((point) => ({
        x: point.roundNumber,
        mean: point.frequency,
        lower: point.lower,
        upper: point.upper,
      })),
    }));
  }, [trajectories, highlightVariantId]);

  if (!trajectories.length) {
    return <EmptyState message="No top variants available for trajectory rendering." />;
  }

  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      <ConfidenceLineChart
        series={series}
        xQuantity="Selection round"
        yQuantity="Variant frequency"
        yUnit="%"
        formatY={formatTickPercent}
        formatValue={formatPercent}
        bandLabel={bandLabel}
        yDomain={[0, 'auto']}
        height={280}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {trajectories.map((trajectory, index) => {
          const color = SCI_SERIES[index % SCI_SERIES.length];
          const isHighlighted = !highlightVariantId || highlightVariantId === trajectory.variantId;
          return (
            <button
              type="button"
              key={trajectory.variantId}
              onClick={() => onSelectVariant?.(trajectory.variantId)}
              style={{
                cursor: onSelectVariant ? 'pointer' : 'default',
                fontFamily: FONT.MONO,
                fontSize: 10,
                padding: '4px 10px',
                borderRadius: '999px',
                border: `1px solid ${color}66`,
                background: `${color}${isHighlighted ? '24' : '0c'}`,
                color: PROEVOL_THEME.value,
                opacity: isHighlighted ? 1 : 0.55,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
              <span>{trajectory.label}</span>
              <span style={{ color: PROEVOL_THEME.muted }}>
                · peak {(trajectory.peakFrequency * 100).toFixed(1)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        height: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT.SANS,
        fontSize: 12,
        color: PROEVOL_THEME.muted,
      }}
    >
      {message}
    </div>
  );
}
