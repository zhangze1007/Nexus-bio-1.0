'use client';

/**
 * FVAPanel — Flux Variability Analysis visualization.
 *
 * Calls /api/fba with action='fva' to get min/max flux ranges for each
 * reaction, then renders a bar chart (recharts) showing which reactions
 * are variable vs fixed.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { THEME } from '../../../theme';
import {
  FONT, TOOLTIP_STYLE, rechartsGrid, rechartsTick,
  rechartsAxisLine, SCI_PALETTE,
} from '../../charts/chartTheme';
import { colors } from '../../../design-system/tokens';
import type { FVAOutput } from '../../../server/fbaFVA';
import type { FBAObjective } from '../../../services/FBAAuthorityClient';
import MetricCard from '../../ide/shared/MetricCard';
import SimErrorBanner from '../../ide/shared/SimErrorBanner';
import { SimSkeleton } from '../../shared/Skeleton';

// ── Types ─────────────────────────────────────────────────────────────

interface FVAPanelProps {
  objective: FBAObjective;
  glucoseUptake: number;
  oxygenUptake: number;
  knockouts: string[];
}

interface ChartDatum {
  reactionId: string;
  min: number;
  max: number;
  range: number;
  isFixed: boolean;
}

// ── Tooltip ───────────────────────────────────────────────────────────

function FVATooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDatum }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ fontFamily: FONT.SANS, fontSize: 11, color: colors.text.primary, fontWeight: 600, marginBottom: 4 }}>
        {d.reactionId}
      </div>
      <div style={{ fontFamily: FONT.MONO, fontSize: 10, color: colors.text.secondary }}>
        min: {d.min.toFixed(4)} | max: {d.max.toFixed(4)}
      </div>
      <div style={{ fontFamily: FONT.MONO, fontSize: 10, color: d.isFixed ? SCI_PALETTE.orange : SCI_PALETTE.green, marginTop: 2 }}>
        {d.isFixed ? 'Fixed' : `Variable (range ${d.range.toFixed(4)})`}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export default React.memo(function FVAPanel({ objective, glucoseUptake, oxygenUptake, knockouts }: FVAPanelProps) {
  const [fvaResult, setFvaResult] = useState<FVAOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch('/api/fba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
      body: JSON.stringify({
        action: 'fva',
        species: 'ecoli',
        objective,
        glucoseUptake,
        oxygenUptake,
        knockouts,
      }),
    })
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.error ?? 'FVA solve failed');
        }
        setFvaResult(payload.result as FVAOutput);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'FVA solve failed');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [objective, glucoseUptake, oxygenUptake, knockouts]);

  // Sort by range (largest variability first), take top 25 for readability
  const chartData = useMemo<ChartDatum[]>(() => {
    if (!fvaResult) return [];
    return fvaResult.results
      .map((r) => ({
        reactionId: r.reactionId,
        min: r.min,
        max: r.max,
        range: r.max - r.min,
        isFixed: Math.abs(r.max - r.min) < 1e-6,
      }))
      .sort((a, b) => b.range - a.range)
      .slice(0, 25);
  }, [fvaResult]);

  const variableCount = fvaResult?.results.filter((r) => Math.abs(r.max - r.min) >= 1e-6).length ?? 0;
  const fixedCount = fvaResult ? fvaResult.results.length - variableCount : 0;

  const maxFlux = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map((d) => Math.max(Math.abs(d.min), Math.abs(d.max)))) || 1;
  }, [chartData]);

  return (
    <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0, overflow: 'auto', padding: '12px' }}>
      {/* Left: Summary metrics */}
      <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p style={{
          fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          color: 'rgba(255,255,255,0.55)', margin: '0 0 4px',
        }}>
          FVA Summary
        </p>
        {error && <SimErrorBanner message={error} />}
        {loading ? (
          <SimSkeleton />
        ) : fvaResult && (
          <>
            <MetricCard label="Objective Value" value={fvaResult.objectiveValue} unit="h⁻¹" highlight />
            <MetricCard label="Solve Time" value={fvaResult.solveTime} unit="ms" />
            <MetricCard label="Variable Reactions" value={variableCount} />
            <MetricCard label="Fixed Reactions" value={fixedCount} />
            <MetricCard label="Total Analyzed" value={fvaResult.results.length} />
          </>
        )}
      </div>

      {/* Right: Bar chart */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          color: 'rgba(255,255,255,0.55)', margin: '0 0 10px',
        }}>
          Flux Variability (top 25 by range)
        </p>
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <SimSkeleton />
          </div>
        ) : chartData.length > 0 ? (
          <div style={{ width: '100%', height: 420 }}>
            <ResponsiveContainer>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 80, bottom: 8 }}
                barSize={12}
              >
                <CartesianGrid horizontal={false} {...rechartsGrid} />
                <XAxis
                  type="number"
                  domain={['auto', 'auto']}
                  tick={rechartsTick}
                  axisLine={rechartsAxisLine}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="reactionId"
                  tick={rechartsTick}
                  axisLine={rechartsAxisLine}
                  tickLine={false}
                  width={72}
                />
                <Tooltip content={<FVATooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <ReferenceLine x={0} stroke="rgba(255,255,255,0.15)" />
                <Bar dataKey="min" radius={[2, 0, 0, 2]} fill={SCI_PALETTE.vermilion} fillOpacity={0.7} />
                <Bar dataKey="max" radius={[0, 2, 2, 0]} fill={SCI_PALETTE.blue} fillOpacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)' }}>
            No FVA data available.
          </div>
        )}

        {/* Legend */}
        {!loading && fvaResult && (
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', justifyContent: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.6)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: SCI_PALETTE.vermilion, opacity: 0.7 }} />
              Min flux
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.6)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: SCI_PALETTE.blue, opacity: 0.7 }} />
              Max flux
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.6)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: SCI_PALETTE.orange, opacity: 0.7 }} />
              Fixed (range &lt; 1e-6)
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
