'use client';

/**
 * ErrorBarChart — reusable bar chart with symmetric or asymmetric error bars.
 *
 * Contract: callers MUST pass real interval data (`lower`, `upper`) derived
 * from actual replicates, bootstrap, or propagated uncertainty. This
 * component intentionally does not synthesize intervals — if `lower` and
 * `upper` are absent the bar renders without an error whisker rather than
 * fabricating one.
 */

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ErrorBar, ResponsiveContainer, LabelList,
} from 'recharts';
import {
  FONT, TOOLTIP_STYLE, rechartsGrid, rechartsTick,
  rechartsAxisTitle, rechartsAxisLine, SCI_SERIES, LINE, fmt2,
  axisLabel as buildAxisLabel,
} from '../chartTheme';

export interface ErrorBarDatum {
  name: string;
  value: number;
  /** Absolute lower bound of the interval (not a delta). Optional. */
  lower?: number;
  /** Absolute upper bound of the interval (not a delta). Optional. */
  upper?: number;
  /** Optional explicit color override. If absent, SCI_SERIES by index. */
  color?: string;
}

export interface ErrorBarChartProps {
  data: ErrorBarDatum[];
  /** Y-axis quantity name, e.g. "ΔG" */
  yQuantity: string;
  /** Y-axis unit, e.g. "kJ/mol". Omit if dimensionless. */
  yUnit?: string;
  /** Optional X-axis title override (defaults to categorical, no label). */
  xLabel?: string;
  height?: number;
  /** Optional value formatter for tooltip / data labels. */
  formatValue?: (value: number) => string;
  /** Show value labels above bars. Default: false. */
  showValueLabels?: boolean;
  /** Optional horizontal reference/threshold line. */
  referenceY?: { value: number; label?: string; color?: string };
  /** Marker describing the interval semantic (e.g. "95% CI", "SEM"). */
  intervalLabel?: string;
}

function ErrorBarTooltip({ active, payload, intervalLabel, formatValue }: any) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload as ErrorBarDatum;
  const fmt = formatValue ?? fmt2;
  const hasInterval = typeof datum.lower === 'number' && typeof datum.upper === 'number';
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ fontFamily: FONT.SANS, fontSize: 11, color: 'rgba(250,246,240,0.96)', fontWeight: 600 }}>
        {datum.name}
      </div>
      <div style={{ fontFamily: FONT.MONO, fontSize: 11, marginTop: 2 }}>
        {fmt(datum.value)}
      </div>
      {hasInterval ? (
        <div style={{ fontFamily: FONT.MONO, fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
          {intervalLabel ?? 'interval'} [{fmt(datum.lower!)}–{fmt(datum.upper!)}]
        </div>
      ) : null}
    </div>
  );
}

export default function ErrorBarChart({
  data,
  yQuantity,
  yUnit,
  xLabel,
  height = 180,
  formatValue,
  showValueLabels = false,
  referenceY,
  intervalLabel = '95% CI',
}: ErrorBarChartProps) {
  /** Recharts ErrorBar takes deltas (distance from center), not absolute bounds. */
  const prepared = data.map((d, i) => {
    const color = d.color ?? SCI_SERIES[i % SCI_SERIES.length];
    const hasInterval = typeof d.lower === 'number' && typeof d.upper === 'number';
    return {
      ...d,
      color,
      errorDelta: hasInterval ? [d.value - (d.lower as number), (d.upper as number) - d.value] : undefined,
    };
  });

  const hasAnyInterval = prepared.some((d) => d.errorDelta);

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={prepared} margin={{ top: 14, right: 24, left: 12, bottom: xLabel ? 24 : 8 }} barSize={32}>
          <CartesianGrid vertical={false} {...rechartsGrid} />
          <XAxis
            dataKey="name"
            tick={rechartsTick}
            axisLine={rechartsAxisLine}
            tickLine={false}
            label={
              xLabel
                ? { value: xLabel, position: 'insideBottom', offset: -4, style: rechartsAxisTitle }
                : undefined
            }
          />
          <YAxis
            tick={rechartsTick}
            axisLine={rechartsAxisLine}
            tickLine={false}
            width={52}
            label={{
              value: buildAxisLabel(yQuantity, yUnit),
              angle: -90,
              position: 'insideLeft',
              offset: 4,
              style: rechartsAxisTitle,
            }}
          />
          <Tooltip
            content={<ErrorBarTooltip intervalLabel={hasAnyInterval ? intervalLabel : undefined} formatValue={formatValue} />}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {prepared.map((d, i) => (
              <Cell key={i} fill={d.color} fillOpacity={0.88} />
            ))}
            {hasAnyInterval ? (
              <ErrorBar
                dataKey="errorDelta"
                width={8}
                strokeWidth={LINE.bandStroke}
                stroke="rgba(240,244,252,0.78)"
                direction="y"
              />
            ) : null}
            {showValueLabels ? (
              <LabelList
                dataKey="value"
                position="top"
                formatter={(formatValue ?? fmt2) as any}
                style={{ fontFamily: FONT.MONO, fontSize: 10, fill: 'rgba(240,244,252,0.86)' }}
              />
            ) : null}
          </Bar>
          {referenceY ? (
            <ReferenceLineFromValue {...referenceY} />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* Internal wrapper — keeps the public API tidy and avoids importing
 * ReferenceLine at call-sites. */
import { ReferenceLine } from 'recharts';
function ReferenceLineFromValue({ value, label, color }: { value: number; label?: string; color?: string }) {
  return (
    <ReferenceLine
      y={value}
      stroke={color ?? 'rgba(232,238,248,0.45)'}
      strokeDasharray="4 3"
      strokeWidth={1}
      label={
        label
          ? {
              value: label,
              position: 'right',
              fill: color ?? 'rgba(232,238,248,0.72)',
              fontSize: 10,
              fontFamily: FONT.SANS,
            }
          : undefined
      }
    />
  );
}
