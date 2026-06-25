"use client";

import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProEvolBandSemantic } from "../../../../domain/proevolArtifact";
import type { DiversityRoundPoint } from "../../../../services/proevolAnalysis";
import type { ChartTooltipProps } from "../../../../types/charts";
import {
  axisLabel,
  BAND,
  FONT,
  LINE,
  MARKER,
  PAPER_THEME,
  PAPER_TOOLTIP_STYLE,
  SCI_PALETTE,
} from "../../../charts/chartTheme";
import { PROEVOL_THEME } from "../shared";

const SHANNON_COLOR = SCI_PALETTE.blue;
const TOP_SHARE_COLOR = SCI_PALETTE.orange;

interface DiversityConvergenceCurveProps {
  data: DiversityRoundPoint[];
  bandSemantic: ProEvolBandSemantic;
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

function buildTooltip(bandSemantic: ProEvolBandSemantic) {
  const bandLabel = bandSemantic === "measurement" ? "95% CI" : "model spread";
  return function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload as unknown as Row | undefined;
    if (!row) return null;
    return (
      <div style={PAPER_TOOLTIP_STYLE}>
        <div style={{ fontFamily: FONT.MONO, color: PAPER_THEME.tickColor, fontSize: 10 }}>Round {label}</div>
        <div style={{ fontFamily: FONT.MONO, fontSize: 11, color: SHANNON_COLOR }}>
          Shannon · {row.shannon.toFixed(2)} bits
          <span style={{ color: PAPER_THEME.labelColor }}>
            {" "}
            {bandLabel} [{row.shannonLower.toFixed(2)}–{row.shannonUpper.toFixed(2)}]
          </span>
        </div>
        <div style={{ fontFamily: FONT.MONO, fontSize: 11, color: TOP_SHARE_COLOR }}>
          Top-1 share · {(row.topShare * 100).toFixed(1)}%
          <span style={{ color: PAPER_THEME.labelColor }}>
            {" "}
            {bandLabel} [{(row.topShareLower * 100).toFixed(1)}–{(row.topShareUpper * 100).toFixed(1)}%]
          </span>
        </div>
      </div>
    );
  };
}

export default function DiversityConvergenceCurve({ data, bandSemantic }: DiversityConvergenceCurveProps) {
  const isModeled = bandSemantic === "modeled";
  if (!data.length) {
    return (
      <div
        style={{
          height: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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

  const bandLabel = isModeled ? "model spread" : "95% CI";

  return (
    <div
      style={{
        width: "100%",
        height: 260,
        background: PAPER_THEME.bg,
        border: `1px solid ${PAPER_THEME.border}`,
        borderRadius: PAPER_THEME.borderRadius,
      }}
    >
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 14, right: 56, left: 12, bottom: 28 }}>
          <CartesianGrid stroke={PAPER_THEME.grid} strokeDasharray="2 4" />
          <XAxis
            dataKey="roundNumber"
            tick={{ fontSize: PAPER_THEME.tickSize, fontFamily: PAPER_THEME.tickFont, fill: PAPER_THEME.tickColor }}
            axisLine={{ stroke: PAPER_THEME.axis }}
            tickLine={false}
            label={{
              value: axisLabel("Selection round"),
              position: "insideBottom",
              offset: -6,
              style: {
                fontSize: PAPER_THEME.labelSize,
                fontFamily: PAPER_THEME.labelFont,
                fill: PAPER_THEME.labelColor,
                letterSpacing: "0.04em",
                fontWeight: 600,
              },
            }}
          />
          <YAxis
            yAxisId="shannon"
            orientation="left"
            tick={{ fontSize: PAPER_THEME.tickSize, fontFamily: PAPER_THEME.tickFont, fill: SHANNON_COLOR }}
            stroke={SHANNON_COLOR}
            domain={[0, "auto"]}
            label={{
              value: axisLabel("Shannon entropy", "bits"),
              angle: -90,
              position: "insideLeft",
              offset: 6,
              style: {
                fontSize: PAPER_THEME.labelSize,
                fontFamily: PAPER_THEME.labelFont,
                fill: SHANNON_COLOR,
                letterSpacing: "0.04em",
                fontWeight: 600,
              },
            }}
          />
          <YAxis
            yAxisId="top"
            orientation="right"
            tick={{ fontSize: PAPER_THEME.tickSize, fontFamily: PAPER_THEME.tickFont, fill: TOP_SHARE_COLOR }}
            stroke={TOP_SHARE_COLOR}
            domain={[0, 1]}
            tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`}
            label={{
              value: axisLabel("Top-1 share", "%"),
              angle: 90,
              position: "insideRight",
              offset: 6,
              style: {
                fontSize: PAPER_THEME.labelSize,
                fontFamily: PAPER_THEME.labelFont,
                fill: TOP_SHARE_COLOR,
                letterSpacing: "0.04em",
                fontWeight: 600,
              },
            }}
          />
          <Tooltip content={buildTooltip(bandSemantic) as unknown as React.ReactElement} />
          <Legend
            wrapperStyle={{
              fontFamily: PAPER_THEME.legendFont,
              fontSize: PAPER_THEME.legendSize,
              color: PAPER_THEME.legendColor,
            }}
            iconSize={10}
          />
          <Area
            yAxisId="shannon"
            type="monotone"
            dataKey="shannonBand"
            stroke={isModeled ? SHANNON_COLOR : "none"}
            strokeWidth={isModeled ? LINE.bandStroke : 0}
            strokeDasharray={isModeled ? "3 3" : undefined}
            strokeOpacity={isModeled ? BAND.strokeOpacity : 0}
            fill={SHANNON_COLOR}
            fillOpacity={isModeled ? BAND.fillOpacityMuted : BAND.fillOpacity}
            isAnimationActive={false}
            legendType="none"
            name={`Shannon ${bandLabel}`}
          />
          <Line
            yAxisId="shannon"
            type="monotone"
            dataKey="shannon"
            name="Shannon entropy"
            stroke={SHANNON_COLOR}
            strokeWidth={LINE.primary}
            dot={{ r: MARKER.secondary, stroke: SHANNON_COLOR, fill: PAPER_THEME.bg, strokeWidth: 1.4 }}
            activeDot={{ r: MARKER.active }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="top"
            type="monotone"
            dataKey="topShare"
            name="Top-1 share"
            stroke={TOP_SHARE_COLOR}
            strokeWidth={LINE.primary}
            strokeDasharray="6 3"
            dot={{ r: MARKER.secondary, stroke: TOP_SHARE_COLOR, fill: PAPER_THEME.bg, strokeWidth: 1.4 }}
            activeDot={{ r: MARKER.active }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
