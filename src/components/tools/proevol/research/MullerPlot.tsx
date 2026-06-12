'use client';

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { PAPER_THEME, PAPER_TOOLTIP_STYLE, FONT, SCI_SERIES } from '../../../charts/chartTheme';
import { PROEVOL_THEME } from '../shared';
import type { ChartTooltipProps, ChartEntryProps } from '../../../../types/charts';
import type { familyShareCurve } from '../../../../services/proevolAnalysis';

type FamilyShareCurve = ReturnType<typeof familyShareCurve>;

interface MullerPlotProps {
  data: FamilyShareCurve;
}

interface MullerRow {
  roundNumber: number;
  [familyId: string]: number;
}

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={PAPER_TOOLTIP_STYLE}>
      <div style={{ marginBottom: 4, fontFamily: FONT.MONO, color: PAPER_THEME.tickColor, fontSize: 10 }}>
        Round {label}
      </div>
      {payload.map((entry: ChartEntryProps) => (
        <div key={entry.dataKey} style={{ fontFamily: FONT.MONO, color: entry.color, fontSize: 11 }}>
          {entry.name}: {((entry.value as number) * 100).toFixed(1)}%
        </div>
      ))}
    </div>
  );
}

export default function MullerPlot({ data }: MullerPlotProps) {
  const rows = useMemo<MullerRow[]>(() => {
    return data.rounds.map((round) => {
      const row: MullerRow = { roundNumber: round.roundNumber };
      data.families.forEach((family) => {
        row[family.id] = round.shareByFamily[family.id] ?? 0;
      });
      return row;
    });
  }, [data]);

  if (!data.families.length || !rows.length) {
    return (
      <div
        style={{
          height: 220,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT.SANS,
          fontSize: 12,
          color: PROEVOL_THEME.muted,
        }}
      >
        No family-level frequency data available.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 240, background: PAPER_THEME.bg, border: `1px solid ${PAPER_THEME.border}`, borderRadius: PAPER_THEME.borderRadius }}>
      <ResponsiveContainer>
        <AreaChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 4 }} stackOffset="expand">
          <CartesianGrid stroke={PAPER_THEME.grid} strokeDasharray="2 4" />
          <XAxis
            dataKey="roundNumber"
            tick={{ fontSize: PAPER_THEME.tickSize, fontFamily: PAPER_THEME.tickFont, fill: PAPER_THEME.tickColor }}
            stroke={PAPER_THEME.axis}
            label={{
              value: 'Selection round',
              position: 'insideBottom',
              offset: -2,
              fill: PAPER_THEME.labelColor,
              fontSize: PAPER_THEME.labelSize,
              fontFamily: PAPER_THEME.labelFont,
            }}
          />
          <YAxis
            tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`}
            tick={{ fontSize: PAPER_THEME.tickSize, fontFamily: PAPER_THEME.tickFont, fill: PAPER_THEME.tickColor }}
            stroke={PAPER_THEME.axis}
            label={{
              value: 'Family share',
              angle: -90,
              position: 'insideLeft',
              fill: PAPER_THEME.labelColor,
              fontSize: PAPER_THEME.labelSize,
              fontFamily: PAPER_THEME.labelFont,
              offset: 10,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          {data.families.map((family, index) => {
            const color = SCI_SERIES[index % SCI_SERIES.length];
            return (
              <Area
                key={family.id}
                type="monotone"
                dataKey={family.id}
                name={family.label}
                stackId="muller"
                stroke={color}
                strokeWidth={1}
                fill={color}
                fillOpacity={0.55}
                isAnimationActive={false}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
