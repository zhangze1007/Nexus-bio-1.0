"use client";

import { useMemo } from "react";
import type { ScatterShapeProps } from "recharts";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { VariantEnrichmentEntry } from "../../../../services/proevolAnalysis";
import type { ChartTooltipProps } from "../../../../types/charts";
import { FONT, PAPER_THEME, PAPER_TOOLTIP_STYLE, SCI_SERIES } from "../../../charts/chartTheme";
import { PROEVOL_THEME } from "../shared";

interface EnrichmentBurdenScatterProps {
  entries: VariantEnrichmentEntry[];
  highlightVariantId?: string | null;
  onSelectVariant?: (variantId: string) => void;
}

function CustomTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as unknown as {
    label: string;
    mutationString: string;
    familyLabel: string;
    log2EnrichmentVsWildType: number;
    mutationBurden: number;
    finalFrequency: number;
  };
  return (
    <div style={PAPER_TOOLTIP_STYLE}>
      <div style={{ fontFamily: FONT.SANS, fontWeight: 600, fontSize: 11, color: PAPER_THEME.titleColor }}>
        {point.label}
      </div>
      <div style={{ fontFamily: FONT.MONO, color: PAPER_THEME.tickColor, fontSize: 10 }}>{point.mutationString}</div>
      <div style={{ fontFamily: FONT.MONO, fontSize: 10, marginTop: 4, color: PAPER_THEME.tooltipColor }}>
        family · {point.familyLabel}
      </div>
      <div style={{ fontFamily: FONT.MONO, fontSize: 10, color: PAPER_THEME.tooltipColor }}>
        log₂ enrichment vs WT · {point.log2EnrichmentVsWildType.toFixed(2)}
      </div>
      <div style={{ fontFamily: FONT.MONO, fontSize: 10, color: PAPER_THEME.tooltipColor }}>
        mutation burden · {point.mutationBurden}
      </div>
      <div style={{ fontFamily: FONT.MONO, fontSize: 10, color: PAPER_THEME.tooltipColor }}>
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
    const families = new Map<
      string,
      { id: string; label: string; points: Array<VariantEnrichmentEntry & { zSize: number }> }
    >();
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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
    <div
      style={{
        width: "100%",
        height: 280,
        background: PAPER_THEME.bg,
        border: `1px solid ${PAPER_THEME.border}`,
        borderRadius: PAPER_THEME.borderRadius,
      }}
    >
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 10, right: 24, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={PAPER_THEME.grid} strokeDasharray="2 4" />
          <XAxis
            type="number"
            dataKey="mutationBurden"
            name="Mutation burden"
            tick={{ fontSize: PAPER_THEME.tickSize, fontFamily: PAPER_THEME.tickFont, fill: PAPER_THEME.tickColor }}
            stroke={PAPER_THEME.axis}
            domain={[0, "dataMax + 1"]}
            label={{
              value: "Mutation burden",
              position: "insideBottom",
              offset: -2,
              fill: PAPER_THEME.labelColor,
              fontSize: PAPER_THEME.labelSize,
              fontFamily: PAPER_THEME.labelFont,
            }}
          />
          <YAxis
            type="number"
            dataKey="log2EnrichmentVsWildType"
            name="log2 enrichment vs WT"
            tick={{ fontSize: PAPER_THEME.tickSize, fontFamily: PAPER_THEME.tickFont, fill: PAPER_THEME.tickColor }}
            stroke={PAPER_THEME.axis}
            label={{
              value: "log₂ enrichment vs WT",
              angle: -90,
              position: "insideLeft",
              fill: PAPER_THEME.labelColor,
              fontSize: PAPER_THEME.labelSize,
              fontFamily: PAPER_THEME.labelFont,
              offset: 10,
            }}
          />
          <ZAxis type="number" dataKey="zSize" range={[40, 220]} />
          <ReferenceLine y={0} stroke={PAPER_THEME.axis} strokeDasharray="4 4" />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />
          {grouped.map((family, index) => {
            const color = SCI_SERIES[index % SCI_SERIES.length];
            return (
              <Scatter
                key={family.id}
                name={family.label}
                data={family.points}
                fill={color}
                stroke={color}
                strokeWidth={1.2}
                fillOpacity={0.6}
                shape={(props: ScatterShapeProps) => {
                  const { cx, cy } = props;
                  const payload = props.payload as VariantEnrichmentEntry & { zSize: number; variantId: string };
                  const isHighlighted = !highlightVariantId || highlightVariantId === payload.variantId;
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
                      style={{ cursor: onSelectVariant ? "pointer" : "default" }}
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
