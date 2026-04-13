'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer, ReferenceLine, LabelList,
} from 'recharts';
import type { BindingAffinityResult } from '../../services/CatalystDesignerEngine';
import {
  ACCENT, COOL, FONT, TOOLTIP_STYLE, CHART_CONTAINER,
  SECTION_LABEL, rechartsGrid, rechartsTick, fmt2,
} from './chartTheme';

/* ── Glassmorphism Tooltip ────────────────────────────────────── */

function GlassTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: FONT.SANS }}>
        {label}
      </p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ margin: '2px 0 0', fontFamily: FONT.MONO, color: entry.color }}>
          {fmt2(entry.value)}
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
      <p style={{ fontFamily: FONT.SANS, fontSize: 9, color: 'rgba(217,225,235,0.68)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </p>
      <p style={{ fontFamily: FONT.MONO, fontSize: 18, color: color || 'rgba(250,246,240,0.96)', margin: 0, lineHeight: 1.1 }}>
        {value}
        {unit && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 3 }}>{unit}</span>}
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
    <div style={{ ...CHART_CONTAINER, background: '#050505', padding: 16 }}>

      {/* ── Active-Site Diagnostics ── */}
      <p style={SECTION_LABEL}>ACTIVE-SITE DIAGNOSTICS</p>
      <p style={{ fontFamily: FONT.SANS, fontSize: 10, color: 'rgba(250,246,240,0.96)', margin: '-6px 0 12px' }}>
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
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
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
            <ReferenceLine x={0.95} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 3" label={{ value: 'optimal', fill: 'rgba(255,255,255,0.3)', fontSize: 8, fontFamily: FONT.MONO, position: 'top' }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {diagnosticData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} fillOpacity={0.82} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: number) => fmt2(v)}
                style={{ fontFamily: FONT.MONO, fontSize: 10, fill: 'rgba(250,246,240,0.96)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Catalytic Fit Summary ── */}
      <div style={{
        margin: '16px 0',
        padding: '12px 16px',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        gap: 16,
        alignItems: 'flex-end',
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: '0 0 auto' }}>
          <p style={{ fontFamily: FONT.SANS, fontSize: 9, color: 'rgba(217,225,235,0.68)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            CATALYTIC FIT
          </p>
          <p style={{ fontFamily: FONT.MONO, fontSize: 32, color: 'rgba(247,249,255,0.92)', margin: 0, lineHeight: 1 }}>
            {fmt2(result.overallScore)}
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>± 0.05</span>
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
        <p style={{ fontFamily: FONT.SANS, fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '-8px 0 12px', fontStyle: 'italic' }}>
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
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              interval={0}
            />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tick={rechartsTick}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
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
                formatter={(v: number) => fmt2(v)}
                style={{ fontFamily: FONT.MONO, fontSize: 10, fill: 'rgba(250,246,240,0.96)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
