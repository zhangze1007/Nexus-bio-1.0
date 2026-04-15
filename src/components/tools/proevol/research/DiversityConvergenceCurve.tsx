'use client';

import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { rechartsGrid, rechartsTick, TOOLTIP_STYLE, FONT, ACCENT } from '../../../charts/chartTheme';
import { PROEVOL_THEME } from '../shared';
import type { DiversityRoundPoint } from '../../../../services/proevolAnalysis';

interface DiversityConvergenceCurveProps {
  data: DiversityRoundPoint[];
}

interface Row {
  roundNumber: number;
  shannon: number;
  shannonLower: number;
  shannonUpper: number;
  shannonBand: [number, number];
  topShare: number;
  topShareLower: number;
  topShareUpper: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as Row | undefined;
  if (!row) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ fontFamily: FONT.MONO, color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
        Round {label}
      </div>
      <div style={{ fontFamily: FONT.MONO, fontSize: 11, color: ACCENT.mint }}>
        Shannon · {row.shannon.toFixed(2)} bits
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>
          {' '}[{row.shannonLower.toFixed(2)}–{row.shannonUpper.toFixed(2)}]
        </span>
      </div>
      <div style={{ fontFamily: FONT.MONO, fontSize: 11, color: ACCENT.coral }}>
        Top-1 share · {(row.topShare * 100).toFixed(1)}%
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>
          {' '}[{(row.topShareLower * 100).toFixed(1)}–{(row.topShareUpper * 100).toFixed(1)}%]
        </span>
      </div>
    </div>
  );
}

export default function DiversityConvergenceCurve({ data }: DiversityConvergenceCurveProps) {
  if (!data.length) {
    return (
      <div
        style={{
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT.SANS,
          fontSize: 12,
          color: PROEVOL_THEME.muted,
        }}
      >
        No diversity data available.
      </div>
    );
  }

  const rows: Row[] = data.map((point) => ({
    roundNumber: point.roundNumber,
    shannon: point.shannonBits.mean,
    shannonLower: point.shannonBits.lower,
    shannonUpper: point.shannonBits.upper,
    shannonBand: [point.shannonBits.lower, point.shannonBits.upper],
    topShare: point.topShare.mean,
    topShareLower: point.topShare.lower,
    topShareUpper: point.topShare.upper,
  }));

  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 12, right: 36, left: 0, bottom: 4 }}>
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
            yAxisId="shannon"
            orientation="left"
            tick={rechartsTick}
            stroke={ACCENT.mint}
            domain={[0, 'auto']}
            label={{
              value: 'Shannon (bits)',
              angle: -90,
              position: 'insideLeft',
              fill: ACCENT.mint,
              fontSize: 10,
              fontFamily: FONT.SANS,
              offset: 10,
            }}
          />
          <YAxis
            yAxisId="top"
            orientation="right"
            tick={rechartsTick}
            stroke={ACCENT.coral}
            domain={[0, 1]}
            tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`}
            label={{
              value: 'Top-1 share',
              angle: 90,
              position: 'insideRight',
              fill: ACCENT.coral,
              fontSize: 10,
              fontFamily: FONT.SANS,
              offset: 10,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontFamily: FONT.MONO, fontSize: 10, color: 'rgba(255,255,255,0.55)' }}
            iconSize={8}
          />
          <Area
            yAxisId="shannon"
            type="monotone"
            dataKey="shannonBand"
            stroke="none"
            fill={ACCENT.mint}
            fillOpacity={0.16}
            isAnimationActive={false}
            legendType="none"
          />
          <Line
            yAxisId="shannon"
            type="monotone"
            dataKey="shannon"
            name="Shannon entropy"
            stroke={ACCENT.mint}
            strokeWidth={2.2}
            dot={{ r: 3, stroke: ACCENT.mint, fill: '#0a0a0a', strokeWidth: 1.4 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="top"
            type="monotone"
            dataKey="topShare"
            name="Top-1 frequency"
            stroke={ACCENT.coral}
            strokeWidth={2.2}
            strokeDasharray="6 3"
            dot={{ r: 3, stroke: ACCENT.coral, fill: '#0a0a0a', strokeWidth: 1.4 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
