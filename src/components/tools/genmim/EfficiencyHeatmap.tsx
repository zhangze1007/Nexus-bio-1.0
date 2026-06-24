'use client';
import React from 'react';
import MetricCard from '../../ide/shared/MetricCard';
import { THEME } from '../../../theme';
import type { CRISPRiTarget } from '../../../types';

export function EfficiencyHeatmap({
  schedule,
  growthImpact,
  avgEfficiency,
  offTargetRisk,
  protectEssential,
}: {
  schedule: CRISPRiTarget[];
  growthImpact: number;
  avgEfficiency: number;
  offTargetRisk: number;
  protectEssential: boolean;
}) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
        <MetricCard label="Targets Selected" value={schedule.length} highlight />
        <MetricCard label="Total Growth Impact" value={(growthImpact * 100).toFixed(1)} unit="%"
          warning={Math.abs(growthImpact) > 0.4 ? 'Growth penalty >40%' : undefined} />
        <MetricCard label="Avg KD Efficiency" value={(avgEfficiency * 100).toFixed(1)} unit="%" />
        <MetricCard label="Off-target Risk" value={(offTargetRisk * 100).toFixed(0)} unit="%" />
      </div>

      <div style={{
        padding: '12px', borderRadius: 'var(--nb-radius-md)',
        border: `1px solid ${THEME.BORDER}`,
        background: THEME.PANEL_SURFACE, display: 'grid', gap: '6px',
      }}>
        <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Readout
        </div>
        <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, lineHeight: 1.55 }}>
          {protectEssential
            ? 'The current schedule is conservative enough to behave like a viable chassis-editing proposal rather than an aggressive pruning experiment.'
            : 'Aggressive pruning is enabled, so this schedule should be interpreted as a stress-test of the chassis boundary rather than a default plan.'}
        </div>
      </div>
    </div>
  );
}
