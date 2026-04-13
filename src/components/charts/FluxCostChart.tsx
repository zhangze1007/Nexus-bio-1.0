'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer, LabelList,
} from 'recharts';
import type { MetabolicDrainResult } from '../../services/CatalystDesignerEngine';
import {
  ACCENT, WARM, FONT, TOOLTIP_STYLE, CHART_CONTAINER,
  SECTION_LABEL, rechartsGrid, rechartsTick, fmt2,
} from './chartTheme';

/* ── Glassmorphism Tooltip ────────────────────────────────────── */

function GlassTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: FONT.SANS }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ margin: '2px 0 0', fontFamily: FONT.MONO, color: entry.color || entry.fill }}>
          {typeof entry.value === 'number' ? fmt2(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

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
          borderLeft: '2px dashed rgba(255,255,255,0.3)',
        }}>
          <span style={{
            position: 'absolute', top: -14, left: -16, fontFamily: FONT.MONO,
            fontSize: 7, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap',
          }}>limit</span>
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
  const burdenData = [
    { name: 'ATP', value: result.atpCost, fill: ACCENT.apricot },
    { name: 'NADPH', value: result.nadphCost, fill: ACCENT.coral },
    { name: 'Ribosome', value: result.ribosomeBurden * 100, fill: ACCENT.lilac },
  ];

  const viabilityColor = result.isViable
    ? result.growthPenalty < 10 ? ACCENT.green : ACCENT.yellow
    : WARM.red;

  const drainPct = result.totalMetabolicDrain * 100;

  return (
    <div style={{ ...CHART_CONTAINER, background: '#050505', padding: 16 }}>

      {/* ── Resource Burden Ledger ── */}
      <p style={SECTION_LABEL}>RESOURCE BURDEN LEDGER</p>
      <p style={{ fontFamily: FONT.SANS, fontSize: 10, color: 'rgba(250,246,240,0.96)', margin: '-6px 0 12px' }}>
        ATP / NADPH / Ribosome allocation
      </p>

      <div style={{ width: '100%', height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={burdenData} margin={{ top: 8, right: 40, left: 10, bottom: 4 }} barSize={32}>
            <CartesianGrid vertical={false} {...rechartsGrid} />
            <XAxis dataKey="name" tick={rechartsTick} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
            <YAxis tick={rechartsTick} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} width={36} />
            <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {burdenData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} fillOpacity={0.82} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={(v: number) => fmt2(v)}
                style={{ fontFamily: FONT.MONO, fontSize: 10, fill: 'rgba(250,246,240,0.96)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

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
        <p style={{ fontFamily: FONT.SANS, fontSize: 9, color: 'rgba(217,225,235,0.68)', margin: '0 0 4px' }}>Metabolic drain</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <ProgressBar value={drainPct} max={100} color="rgba(255,139,31,0.82)" limitAt={82} />
          </div>
          <span style={{ fontFamily: FONT.MONO, fontSize: 10, color: 'rgba(250,246,240,0.96)', flexShrink: 0 }}>
            {fmt2(drainPct)}%
          </span>
        </div>

        {/* Growth penalty bar */}
        <p style={{ fontFamily: FONT.SANS, fontSize: 9, color: 'rgba(217,225,235,0.68)', margin: '0 0 4px' }}>Growth penalty</p>
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
