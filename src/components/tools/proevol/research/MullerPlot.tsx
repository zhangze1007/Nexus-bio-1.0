'use client';

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { rechartsGrid, rechartsTick, TOOLTIP_STYLE, FONT, SERIES_PALETTE } from '../../../charts/chartTheme';
import { PROEVOL_THEME } from '../shared';
import type { familyShareCurve } from '../../../../services/proevolAnalysis';

type FamilyShareCurve = ReturnType<typeof familyShareCurve>;

interface MullerPlotProps {
  data: FamilyShareCurve;
}

interface MullerRow {
  roundNumber: number;
  [familyId: string]: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ marginBottom: 4, fontFamily: FONT.MONO, color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
        Round {label}
      </div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} style={{ fontFamily: FONT.MONO, color: entry.color, fontSize: 11 }}>
          {entry.name}: {(entry.value * 100).toFixed(1)}%
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
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <AreaChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 4 }} stackOffset="expand">
          <CartesianGrid {...rechartsGrid} />
          <XAxis
            dataKey="roundNumber"
            tick={rechartsTick}
            stroke="rgba(255,255,255,0.18)"
            label={{
              value: 'Selection round',
              position: 'insideBottom',
              offset: -2,
              fill: 'rgba(255,255,255,0.5)',
              fontSize: 10,
              fontFamily: FONT.SANS,
            }}
          />
          <YAxis
            tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`}
            tick={rechartsTick}
            stroke="rgba(255,255,255,0.18)"
            label={{
              value: 'Family share',
              angle: -90,
              position: 'insideLeft',
              fill: 'rgba(255,255,255,0.5)',
              fontSize: 10,
              fontFamily: FONT.SANS,
              offset: 10,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          {data.families.map((family, index) => {
            const color = SERIES_PALETTE[index % SERIES_PALETTE.length];
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
