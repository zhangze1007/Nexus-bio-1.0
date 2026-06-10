'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer, ReferenceLine, LabelList,
} from 'recharts';
import type { BindingAffinityResult } from '../../services/CatalystDesignerEngine';
import type { ChartTooltipProps, ChartEntryProps } from '../../types/charts';
import {
  ACCENT, COOL, FONT, TOOLTIP_STYLE, CHART_CONTAINER,
  SECTION_LABEL, rechartsGrid, rechartsTick, fmt2,
} from './chartTheme';
import { colors, spacing } from '../../design-system/tokens';

/* ── Glassmorphism Tooltip ────────────────────────────────────── */

function GlassTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ margin: 0, fontSize: 10, color: colors.text.tertiary, fontFamily: FONT.SANS }}>
        {label}
      </p>
      {payload.map((entry: ChartEntryProps, i: number) => (
        <p key={i} style={{ margin: '2px 0 0', fontFamily: FONT.MONO, color: entry.color }}>
          {fmt2(entry.value as number)}
        </p>
      ))}
    </div>
  );
}

/* ── Score Quality Badge ──────────────────────────────────────── */

function QualityBadge({ value, label }: { value: number; label: string }) {
  const color = value >= 0.8 ? ACCENT.green : value >= 0.5 ? ACCENT.yellow : ACCENT.coral;
  return (
    <span style={{
      fontFamily: FONT.MONO, fontSize: 10, color,
      background: `${color}18`, padding: '2px 6px', borderRadius: 6,
    }}>
      {label}
    </span>
  );
}

/* ── Metric Cell ──────────────────────────────────────────────── */

function MetricCell({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontFamily: FONT.SANS, fontSize: 9, color: colors.text.secondary, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </p>
      <p style={{ fontFamily: FONT.MONO, fontSize: 18, color: color || colors.text.primary, margin: 0, lineHeight: 1.1 }}>
        {value}
        {unit && <span style={{ fontSize: 10, color: colors.text.disabled, marginLeft: 3 }}>{unit}</span>}
      </p>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

interface BindingRadarChartProps {
  result: BindingAffinityResult;
}

const BAR_COLORS = [ACCENT.mint, ACCENT.sky, ACCENT.apricot, ACCENT.lilac];

export default function BindingRadarChart({ result }: BindingRadarChartProps) {
  /* Active-site diagnostic data */
  const diagnosticData = [
    { name: 'Distance',      value: result.distanceScore,      fill: ACCENT.mint },
    { name: 'Orientation',   value: result.orientationScore,   fill: ACCENT.sky },
    { name: 'vdW',           value: result.vdwScore,           fill: ACCENT.apricot },
    { name: 'Electrostatic', value: result.electrostaticScore, fill: ACCENT.lilac },
  ];

  /* Binding energy decomposition data */
  const decompositionData = [
    { name: 'Distance fit',       value: result.distanceScore,      fill: ACCENT.mint },
    { name: 'Orientation fit',    value: result.orientationScore,   fill: ACCENT.sky },
    { name: 'vdW packing',       value: result.vdwScore,           fill: ACCENT.apricot },
    { name: 'Electrostatic',     value: result.electrostaticScore, fill: ACCENT.lilac },
  ];

  const fitQuality = result.overallScore >= 0.8 ? 'Excellent'
    : result.overallScore >= 0.6 ? 'Moderate' : 'Weak';

  return (
    <div style={{ ...CHART_CONTAINER, background: colors.bg.primary, padding: Number(spacing.base) }}>

      {/* ── Active-Site Diagnostics ── */}
      <p style={SECTION_LABEL}>ACTIVE-SITE DIAGNOSTICS</p>
      <p style={{ fontFamily: FONT.SANS, fontSize: 10, color: colors.text.primary, margin: '-6px 0 12px' }}>
        Binding dimensions vs. optimal envelope
      </p>

      <div style={{ width: '100%', height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={diagnosticData}
            layout="vertical"
            margin={{ top: 4, right: 50, left: 10, bottom: 4 }}
            barSize={14}
          >
            <CartesianGrid horizontal={false} {...rechartsGrid} />
            <XAxis
              type="number"
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tick={rechartsTick}
              axisLine={{ stroke: colors.border.default }}
              tickLine={false}
            />
            <YAxis
              dataKey="name"
              type="category"
              tick={rechartsTick}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <ReferenceLine x={0.95} stroke={colors.border.strong} strokeDasharray="4 3" label={{ value: 'optimal', fill: colors.text.disabled, fontSize: 8, fontFamily: FONT.MONO, position: 'top' }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {diagnosticData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} fillOpacity={0.82} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v) => fmt2(Number(v))}
                style={{ fontFamily: FONT.MONO, fontSize: 10, fill: colors.text.primary }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Catalytic Fit Summary ── */}
      <div style={{
        margin: `${spacing.base} 0`,
        padding: `${spacing.md} ${spacing.base}`,
        borderRadius: 14,
        background: 'rgba(255,255,255,0.025)',
        border: `1px solid ${colors.border.subtle}`,
        display: 'flex',
        gap: Number(spacing.base),
        alignItems: 'flex-end',
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: '0 0 auto' }}>
          <p style={{ fontFamily: FONT.SANS, fontSize: 9, color: colors.text.secondary, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            CATALYTIC FIT
          </p>
          <p style={{ fontFamily: FONT.MONO, fontSize: 32, color: colors.text.primary, margin: 0, lineHeight: 1 }}>
            {fmt2(result.overallScore)}
            <span style={{ fontSize: 12, color: colors.text.disabled, marginLeft: 4 }}>± 0.05</span>
          </p>
          <QualityBadge value={result.overallScore} label={fitQuality} />
        </div>
        <MetricCell
          label="Predicted Kd"
          value={`${fmt2(result.predictedKd)} ± ${fmt2(result.predictedKd * 0.15)}`}
          unit="μM"
        />
        <MetricCell
          label="Binding energy"
          value={`${fmt2(result.bindingEnergy)} ± ${fmt2(Math.abs(result.bindingEnergy) * 0.10)}`}
          unit="kcal/mol"
          color={result.bindingEnergy < -8 ? ACCENT.green : result.bindingEnergy < -4 ? ACCENT.yellow : ACCENT.coral}
        />
      </div>
      {result.interpretation && (
        <p style={{ fontFamily: FONT.SANS, fontSize: 10, color: colors.text.disabled, margin: '-8px 0 12px', fontStyle: 'italic' }}>
          {result.interpretation.slice(0, 80)}
        </p>
      )}

      {/* ── Binding Energy Decomposition ── */}
      <p style={SECTION_LABEL}>BINDING ENERGY DECOMPOSITION</p>

      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={decompositionData}
            margin={{ top: 8, right: 16, left: 10, bottom: 4 }}
            barSize={40}
          >
            <CartesianGrid vertical={false} {...rechartsGrid} />
            <XAxis
              dataKey="name"
              tick={{ ...rechartsTick, fontSize: 9 }}
              axisLine={{ stroke: colors.border.default }}
              tickLine={false}
              interval={0}
            />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tick={rechartsTick}
              axisLine={{ stroke: colors.border.default }}
              tickLine={false}
              width={32}
            />
            <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {decompositionData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} fillOpacity={0.82} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={(v) => fmt2(Number(v))}
                style={{ fontFamily: FONT.MONO, fontSize: 10, fill: colors.text.primary }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
