'use client';

import type { MetabolicDrainResult } from '../../services/CatalystDesignerEngine';
import {
  FONT, CHART_CONTAINER, SECTION_LABEL,
  SCI_PALETTE, fmt2,
} from './chartTheme';
import { ErrorBarChart } from './primitives';

/* ── Progress Bar ─────────────────────────────────────────────── */

function ProgressBar({ value, max, color, limitAt }: { value: number; max: number; color: string; limitAt?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const limitPct = limitAt != null ? Math.min(100, (limitAt / max) * 100) : null;
  return (
    <div style={{ position: 'relative', width: '100%', height: 14, borderRadius: 7, background: 'rgba(255,255,255,0.05)', overflow: 'visible' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 7, background: color, transition: 'width 0.4s ease' }} />
      {limitPct != null && (
        <div style={{
          position: 'absolute', left: `${limitPct}%`, top: -3, bottom: -3, width: 1,
          borderLeft: '2px dashed rgba(232,238,248,0.55)',
        }}>
          <span style={{
            position: 'absolute', top: -14, left: -16, fontFamily: FONT.MONO,
            fontSize: 8, color: 'rgba(232,238,248,0.6)', whiteSpace: 'nowrap',
          }}>viability limit</span>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

interface FluxCostChartProps {
  result: MetabolicDrainResult;
}

export default function FluxCostChart({ result }: FluxCostChartProps) {
  /**
   * Burden series rendered in distinct, accessible colors.
   *
   * IMPORTANT: MetabolicDrainResult is a single-point estimate — there are
   * no replicates on the engine side, so we do not pass `lower`/`upper`.
   * ErrorBarChart respects that and renders without whiskers. If the
   * engine later emits replicate-aware intervals, populating `lower/upper`
   * here is the only change needed.
   */
  const burdenData = [
    { name: 'ATP', value: result.atpCost, color: SCI_PALETTE.orange },
    { name: 'NADPH', value: result.nadphCost, color: SCI_PALETTE.magenta },
    { name: 'Ribosome', value: result.ribosomeBurden * 100, color: SCI_PALETTE.blue },
  ];

  const viabilityColor = result.isViable
    ? result.growthPenalty < 10 ? SCI_PALETTE.green : SCI_PALETTE.yellow
    : SCI_PALETTE.vermilion;

  const drainPct = result.totalMetabolicDrain * 100;

  return (
    <div style={{ ...CHART_CONTAINER, background: '#050505', padding: 16 }}>

      {/* ── Resource Burden Ledger ── */}
      <p style={SECTION_LABEL}>RESOURCE BURDEN LEDGER</p>
      <p style={{ fontFamily: FONT.SANS, fontSize: 10, color: 'rgba(232,238,248,0.82)', margin: '-6px 0 4px' }}>
        ATP (mol/mol enzyme) · NADPH (mol/mol enzyme) · Ribosome (% pool × 100)
      </p>
      <p style={{ fontFamily: FONT.SANS, fontSize: 9, color: 'rgba(232,238,248,0.55)', margin: '0 0 10px' }}>
        Bars share an axis for visual comparison but carry heterogeneous units — hover each bar for its native quantity. Engine emits single-point estimates, so no whiskers are drawn.
      </p>

      <ErrorBarChart
        data={burdenData}
        yQuantity="Burden"
        yUnit="native units · see caption"
        height={160}
        showValueLabels
        formatValue={fmt2}
      />

      {/* ── Drain & Viability ── */}
      <div style={{
        marginTop: 16, padding: '12px 16px', borderRadius: 14,
        background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <p style={SECTION_LABEL}>DRAIN AND VIABILITY</p>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginBottom: 14 }}>
          <div>
            <p style={{ fontFamily: FONT.MONO, fontSize: 28, color: 'rgba(250,246,240,0.96)', margin: 0, lineHeight: 1 }}>
              {fmt2(drainPct)}%
            </p>
            <p style={{ fontFamily: FONT.SANS, fontSize: 9, color: 'rgba(217,225,235,0.68)', margin: '2px 0 0' }}>
              total metabolic drain
            </p>
          </div>
          <div style={{
            padding: '6px 12px', borderRadius: 10,
            background: `${viabilityColor}14`, border: `1px solid ${viabilityColor}40`,
          }}>
            <p style={{ fontFamily: FONT.MONO, fontSize: 9, color: viabilityColor, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {result.isViable ? 'Prototype viable' : 'Redesign required'}
            </p>
          </div>
        </div>

        {/* Drain progress bar */}
        <p style={{ fontFamily: FONT.SANS, fontSize: 10, color: 'rgba(232,238,248,0.78)', margin: '0 0 4px' }}>Metabolic drain (%)</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <ProgressBar value={drainPct} max={100} color={SCI_PALETTE.orange} limitAt={82} />
          </div>
          <span style={{ fontFamily: FONT.MONO, fontSize: 10, color: 'rgba(240,244,252,0.92)', flexShrink: 0 }}>
            {fmt2(drainPct)}%
          </span>
        </div>

        {/* Growth penalty bar */}
        <p style={{ fontFamily: FONT.SANS, fontSize: 10, color: 'rgba(232,238,248,0.78)', margin: '0 0 4px' }}>Growth penalty (%)</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <ProgressBar value={result.growthPenalty} max={30} color={viabilityColor} />
          </div>
          <span style={{ fontFamily: FONT.MONO, fontSize: 10, color: 'rgba(250,246,240,0.96)', flexShrink: 0 }}>
            {fmt2(result.growthPenalty)}%
          </span>
        </div>

        {/* Recommendation */}
        {result.recommendation && (
          <p style={{ fontFamily: FONT.SANS, fontSize: 10, color: 'rgba(250,246,240,0.96)', margin: '10px 0 0', lineHeight: 1.4 }}>
            {result.recommendation}
          </p>
        )}
      </div>
    </div>
  );
}
