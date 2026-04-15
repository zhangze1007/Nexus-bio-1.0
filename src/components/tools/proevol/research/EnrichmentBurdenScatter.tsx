'use client';

import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { rechartsGrid, rechartsTick, TOOLTIP_STYLE, FONT, SERIES_PALETTE } from '../../../charts/chartTheme';
import { PROEVOL_THEME } from '../shared';
import type { VariantEnrichmentEntry } from '../../../../services/proevolAnalysis';

interface EnrichmentBurdenScatterProps {
  entries: VariantEnrichmentEntry[];
  highlightVariantId?: string | null;
  onSelectVariant?: (variantId: string) => void;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as {
    label: string;
    mutationString: string;
    familyLabel: string;
    log2EnrichmentVsWildType: number;
    mutationBurden: number;
    finalFrequency: number;
  };
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ fontFamily: FONT.SANS, fontWeight: 600, fontSize: 11 }}>{point.label}</div>
      <div style={{ fontFamily: FONT.MONO, color: 'rgba(255,255,255,0.55)', fontSize: 10 }}>
        {point.mutationString}
      </div>
      <div style={{ fontFamily: FONT.MONO, fontSize: 10, marginTop: 4 }}>
        family · {point.familyLabel}
      </div>
      <div style={{ fontFamily: FONT.MONO, fontSize: 10 }}>
        log₂ enrichment vs WT · {point.log2EnrichmentVsWildType.toFixed(2)}
      </div>
      <div style={{ fontFamily: FONT.MONO, fontSize: 10 }}>
        mutation burden · {point.mutationBurden}
      </div>
      <div style={{ fontFamily: FONT.MONO, fontSize: 10 }}>
        final frequency · {(point.finalFrequency * 100).toFixed(2)}%
      </div>
    </div>
  );
}

export default function EnrichmentBurdenScatter({
  entries,
  highlightVariantId,
  onSelectVariant,
}: EnrichmentBurdenScatterProps) {
  const grouped = useMemo(() => {
    const families = new Map<string, { id: string; label: string; points: any[] }>();
    entries.forEach((entry) => {
      const list = families.get(entry.familyId) ?? { id: entry.familyId, label: entry.familyLabel, points: [] };
      list.points.push({
        ...entry,
        zSize: Math.max(40, entry.finalFrequency * 1200),
      });
      families.set(entry.familyId, list);
    });
    return [...families.values()];
  }, [entries]);

  if (!entries.length) {
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
        No enrichment data available.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 10, right: 24, left: 0, bottom: 4 }}>
          <CartesianGrid {...rechartsGrid} />
          <XAxis
            type="number"
            dataKey="mutationBurden"
            name="Mutation burden"
            tick={rechartsTick}
            stroke="rgba(255,255,255,0.18)"
            domain={[0, 'dataMax + 1']}
            label={{
              value: 'Mutation burden',
              position: 'insideBottom',
              offset: -2,
              fill: 'rgba(255,255,255,0.5)',
              fontSize: 10,
              fontFamily: FONT.SANS,
            }}
          />
          <YAxis
            type="number"
            dataKey="log2EnrichmentVsWildType"
            name="log2 enrichment vs WT"
            tick={rechartsTick}
            stroke="rgba(255,255,255,0.18)"
            label={{
              value: 'log₂ enrichment vs WT',
              angle: -90,
              position: 'insideLeft',
              fill: 'rgba(255,255,255,0.5)',
              fontSize: 10,
              fontFamily: FONT.SANS,
              offset: 10,
            }}
          />
          <ZAxis type="number" dataKey="zSize" range={[40, 220]} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.22)" strokeDasharray="4 4" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
          {grouped.map((family, index) => {
            const color = SERIES_PALETTE[index % SERIES_PALETTE.length];
            return (
              <Scatter
                key={family.id}
                name={family.label}
                data={family.points}
                fill={color}
                stroke={color}
                strokeWidth={1.2}
                fillOpacity={0.6}
                shape={(props: any) => {
                  const { cx, cy, payload } = props;
                  const isHighlighted =
                    !highlightVariantId || highlightVariantId === payload.variantId;
                  const radius = Math.sqrt(payload.zSize / Math.PI);
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius}
                      fill={color}
                      fillOpacity={isHighlighted ? 0.7 : 0.25}
                      stroke={color}
                      strokeWidth={isHighlighted ? 1.6 : 0.8}
                      style={{ cursor: onSelectVariant ? 'pointer' : 'default' }}
                      onClick={() => onSelectVariant?.(payload.variantId)}
                    />
                  );
                }}
                isAnimationActive={false}
              />
            );
          })}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
