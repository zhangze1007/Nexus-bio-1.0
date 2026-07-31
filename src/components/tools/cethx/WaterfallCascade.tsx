"use client";
import { motion } from "framer-motion";
/**
 * WaterfallCascade — Breathing waterfall ΔG cascade visualization.
 *
 * Responsive rewrite (audit F1): the SVG maps 1:1 to the container width (no letterbox
 * whitespace), the duplicate in-SVG title is removed (the card's ScientificFigureFrame
 * already supplies eyebrow + title), the colour-key legend lives in a reserved bottom band
 * (never overlapping the plot), and x-axis labels are drawn HORIZONTALLY with collision
 * avoidance (interval thinning + <title> full name) instead of a fixed −38° rotation +
 * character truncation. Only rendering changed — the thermodynamic data/coordinates are
 * unchanged.
 */
import React, { useLayoutEffect, useRef, useState } from "react";
import type { computeThermo } from "../../../data/mockCETHX";
import { THEME } from "../../../theme";
import { catmullRomPath } from "../../../utils/svgPath";
import { PAPER_THEME, SEMANTIC, SEMANTIC_RGB } from "../../charts/chartTheme";
import { SVGChartContainer } from "../../charts/primitives";

type StepData = ReturnType<typeof computeThermo>["steps"][number] & { cumulative: number };

export default function BreathingWaterfall({ steps }: { steps: StepData[] }) {
  // Measure the container so the SVG viewBox maps 1:1 to the rendered width → no letterbox.
  const hostRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width ?? 0;
      if (cw > 0) setW(Math.round(cw));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Height derives from width but is clamped so the chart stays well-proportioned.
  const H = Math.round(Math.min(440, Math.max(300, W * 0.5)));
  const LEGEND_H = 26; // reserved band at the very bottom for the colour key
  const XLABEL_H = 30; // reserved band for horizontal step labels + ΔG values
  const PAD = { top: 22, right: 24, bottom: XLABEL_H + LEGEND_H + 8, left: 54 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const minG = Math.min(0, ...steps.map((s) => s.cumulative));
  const maxG = Math.max(0, ...steps.map((s) => s.cumulative), ...steps.map((s) => s.deltaG));
  const range = maxG - minG || 1;
  function yPos(v: number) {
    return PAD.top + innerH - ((v - minG) / range) * innerH;
  }
  const slot = innerW / steps.length;
  const barW = Math.max(14, slot - 12);
  const limitingStep = [...steps].sort((left, right) => right.deltaG - left.deltaG)[0];

  // x-label collision avoidance: show a label only every `stride` slots so horizontal
  // labels never overlap. No truncation — full name is always in a <title>.
  const est = (txt: string) => txt.length * PAPER_THEME.tickSize * 0.6;
  const widest = Math.max(...steps.map((s) => est(s.step)));
  const stride = Math.max(1, Math.ceil((widest + 6) / slot));
  // A bar's data label ("INFEASIBLE" / "ATP +N") is drawn ONLY when it fits its own slot
  // without colliding with neighbours; otherwise the same info stays reachable via the
  // bar's <title> tooltip (+ colour + legend). Not hidden — moved to a non-overlapping channel.
  const infeasFits = slot >= est("INFEASIBLE") + 6;
  const atpFits = slot >= est("ATP +9") + 6;

  const splinePts: [number, number][] = steps.map((s, i) => [
    PAD.left + (i / steps.length) * innerW + barW / 2,
    yPos(s.cumulative),
  ]);

  const legend = [
    { color: `rgba(${SEMANTIC_RGB.pass}, 0.82)`, label: "Exergonic" },
    { color: SEMANTIC.fail, label: "Infeasible (ΔG>0)" },
    { color: THEME.APRICOT, label: "ATP-coupled" },
    { color: THEME.APRICOT, label: "Energy landscape", line: true },
  ];

  return (
    <div ref={hostRef} style={{ width: "100%" }}>
      <SVGChartContainer W={W} H={H} ariaLabel="Thermodynamic waterfall" variant="paper" style={{ height: `${H}px` }}>
        <rect
          x={PAD.left - 22}
          y={PAD.top - 14}
          width={innerW + 34}
          height={innerH + 24}
          rx="14"
          fill={PAPER_THEME.bgAlt}
          stroke={PAPER_THEME.border}
        />
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = PAD.top + tick * innerH;
          return (
            <line
              key={`grid-${tick}`}
              x1={PAD.left}
              y1={y}
              x2={W - PAD.right}
              y2={y}
              stroke={PAPER_THEME.grid}
              strokeWidth={0.5}
            />
          );
        })}
        <line x1={PAD.left} y1={yPos(0)} x2={W - PAD.right} y2={yPos(0)} stroke={PAPER_THEME.axis} strokeWidth={0.75} />

        <motion.polyline
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          points={steps
            .map((s, i) => `${PAD.left + (i / steps.length) * innerW + barW / 2},${yPos(s.cumulative)}`)
            .join(" ")}
          fill="none"
          stroke={PAPER_THEME.axis}
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />

        {steps.map((step, i) => {
          const x = PAD.left + (i / steps.length) * innerW + (slot - barW) / 2;
          const isNeg = step.deltaG < 0;
          const isInfeasible = step.deltaG > 0;
          const color = step.atpYield > 0 ? THEME.APRICOT : isNeg ? `rgba(${SEMANTIC_RGB.pass}, 0.82)` : SEMANTIC.fail;
          const topY = Math.min(yPos(step.cumulative), yPos(step.cumulative - step.deltaG));
          const h = Math.abs(yPos(step.cumulative) - yPos(step.cumulative - step.deltaG));
          const cx = x + barW / 2;
          const isLimiting = step.step === limitingStep?.step;
          return (
            <g key={step.step + i}>
              <rect x={x} y={topY} width={barW} height={h} rx={4} fill={color} opacity={0.82}>
                <title>{`${step.step} · ΔG ${step.deltaG > 0 ? "+" : ""}${step.deltaG.toFixed(1)} kJ/mol${isInfeasible ? " · INFEASIBLE (ΔG>0)" : ""}${step.atpYield > 0 ? ` · ATP +${step.atpYield.toFixed(0)}` : ""}`}</title>
              </rect>
              <rect
                x={x}
                y={topY}
                width={barW}
                height={h}
                rx={4}
                fill="none"
                stroke={
                  isLimiting
                    ? PAPER_THEME.titleColor
                    : isInfeasible
                      ? `rgba(${SEMANTIC_RGB.fail}, 0.55)`
                      : PAPER_THEME.border
                }
                strokeWidth={isLimiting ? 1.4 : 0.8}
              />
              <circle cx={cx} cy={yPos(step.cumulative)} r={3.5} fill={PAPER_THEME.scatterStroke} />
              {/* Data labels only when they fit their slot without colliding; else via the bar tooltip. */}
              {isInfeasible && infeasFits && (
                <text
                  x={cx}
                  y={topY - 5}
                  textAnchor="middle"
                  fontFamily={PAPER_THEME.tickFont}
                  fontSize={PAPER_THEME.tickSize}
                  fill={SEMANTIC.fail}
                >
                  INFEASIBLE
                </text>
              )}
              {step.atpYield > 0 && !isInfeasible && atpFits && (
                <text
                  x={cx}
                  y={topY - 6}
                  textAnchor="middle"
                  fontFamily={PAPER_THEME.tickFont}
                  fontSize={PAPER_THEME.tickSize}
                  fill={THEME.APRICOT}
                >
                  ATP +{step.atpYield.toFixed(0)}
                </text>
              )}
              {isLimiting && (
                <>
                  <line
                    x1={cx}
                    y1={topY - 10}
                    x2={cx}
                    y2={PAD.top - 4}
                    stroke={PAPER_THEME.grid}
                    strokeDasharray="4 3"
                  />
                  <text
                    x={cx}
                    y={PAD.top - 9}
                    textAnchor="middle"
                    fontFamily={PAPER_THEME.tickFont}
                    fontSize={PAPER_THEME.tickSize}
                    fill={PAPER_THEME.labelColor}
                  >
                    LIMITING
                  </text>
                </>
              )}
            </g>
          );
        })}

        {splinePts.length > 1 && (
          <path d={catmullRomPath(splinePts)} fill="none" stroke={THEME.APRICOT} strokeWidth={2} strokeOpacity={0.85} />
        )}

        {/* x-axis: horizontal step labels (thinned to avoid overlap) + ΔG value; full name in <title>. */}
        {steps.map((step, i) => {
          const x = PAD.left + (i / steps.length) * innerW + barW / 2 + (slot - barW) / 2;
          const showName = i % stride === 0;
          return (
            <g key={`lbl${i}`}>
              <text
                x={x}
                y={PAD.top + innerH + 14}
                textAnchor="middle"
                fontFamily={PAPER_THEME.tickFont}
                fontSize={PAPER_THEME.tickSize}
                fill={step.deltaG < 0 ? `rgba(${SEMANTIC_RGB.pass}, 0.85)` : `rgba(${SEMANTIC_RGB.fail}, 0.85)`}
              >
                {step.deltaG > 0 ? "+" : ""}
                {step.deltaG.toFixed(1)}
              </text>
              {showName && (
                <text
                  x={x}
                  y={PAD.top + innerH + 27}
                  textAnchor="middle"
                  fontFamily={PAPER_THEME.tickFont}
                  fontSize={PAPER_THEME.tickSize}
                  fill={PAPER_THEME.tickColor}
                >
                  {step.step}
                  <title>{step.step}</title>
                </text>
              )}
            </g>
          );
        })}

        {[-40, -20, 0, 20].map((v) =>
          v >= minG && v <= maxG ? (
            <g key={v}>
              <line x1={PAD.left - 4} y1={yPos(v)} x2={PAD.left} y2={yPos(v)} stroke={PAPER_THEME.grid} />
              <text
                x={PAD.left - 8}
                y={yPos(v) + 3}
                textAnchor="end"
                fontFamily={PAPER_THEME.tickFont}
                fontSize={PAPER_THEME.tickSize}
                fill={PAPER_THEME.tickColor}
              >
                {v}
              </text>
            </g>
          ) : null,
        )}
        <text
          x={14}
          y={PAD.top + innerH / 2}
          textAnchor="middle"
          fontFamily={PAPER_THEME.tickFont}
          fontSize={PAPER_THEME.tickSize}
          fill={PAPER_THEME.labelColor}
          transform={`rotate(-90,14,${PAD.top + innerH / 2})`}
        >
          ΔG (kJ/mol)
        </text>

        {/* Colour-key legend — reserved bottom band, horizontal, never overlaps the plot. */}
        {legend.map((l, i) => {
          const lx = PAD.left + i * Math.max(120, innerW / legend.length);
          const ly = H - LEGEND_H + 8;
          return (
            <g key={l.label} transform={`translate(${lx},${ly})`}>
              {l.line ? (
                <line x1={0} y1={4} x2={12} y2={4} stroke={l.color} strokeWidth={2} />
              ) : (
                <rect width={12} height={9} rx={2} fill={l.color} opacity={0.82} />
              )}
              <text
                x={17}
                y={9}
                fontFamily={PAPER_THEME.legendFont}
                fontSize={PAPER_THEME.legendSize}
                fill={PAPER_THEME.legendColor}
              >
                {l.label}
              </text>
            </g>
          );
        })}
      </SVGChartContainer>
    </div>
  );
}
