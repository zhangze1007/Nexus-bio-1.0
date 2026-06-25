"use client";
import { motion } from "framer-motion";
/**
 * WaterfallCascade — Breathing waterfall ΔG cascade visualization.
 * Extracted from CETHXPage.tsx for modularity.
 */
import React from "react";
import type { computeThermo } from "../../../data/mockCETHX";
import { THEME } from "../../../theme";
import { catmullRomPath } from "../../../utils/svgPath";
import { PAPER_THEME, SEMANTIC, SEMANTIC_RGB } from "../../charts/chartTheme";
import { SVGChartContainer } from "../../charts/primitives";

type StepData = ReturnType<typeof computeThermo>["steps"][number] & { cumulative: number };

export default function BreathingWaterfall({ steps }: { steps: StepData[] }) {
  const W = 520,
    H = 356,
    PAD = { top: 42, right: 26, bottom: 62, left: 58 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const minG = Math.min(0, ...steps.map((s) => s.cumulative));
  const maxG = Math.max(0, ...steps.map((s) => s.cumulative), ...steps.map((s) => s.deltaG));
  const range = maxG - minG || 1;
  function yPos(v: number) {
    return PAD.top + innerH - ((v - minG) / range) * innerH;
  }
  const barW = Math.max(18, innerW / steps.length - 10);
  const limitingStep = [...steps].sort((left, right) => right.deltaG - left.deltaG)[0];

  // Energy landscape Catmull-Rom spline through cumulative ΔG points
  const splinePts: [number, number][] = steps.map((s, i) => [
    PAD.left + (i / steps.length) * innerW + barW / 2,
    yPos(s.cumulative),
  ]);

  return (
    <SVGChartContainer W={W} H={H} ariaLabel="Thermodynamic waterfall" variant="paper">
      <rect
        x={PAD.left - 22}
        y={PAD.top - 18}
        width={innerW + 34}
        height={innerH + 30}
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

      <text
        x={PAD.left}
        y={18}
        fontFamily={PAPER_THEME.labelFont}
        fontSize={PAPER_THEME.tickSize}
        fill={PAPER_THEME.labelColor}
        letterSpacing="0.12em"
      >
        THERMODYNAMIC WATERFALL
      </text>
      <text
        x={PAD.left}
        y={30}
        fontFamily={PAPER_THEME.labelFont}
        fontSize={PAPER_THEME.labelSize}
        fill={PAPER_THEME.titleColor}
      >
        Stepwise free-energy burden with cumulative load and ATP-coupled events
      </text>

      <motion.polyline
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        points={steps
          .map((s, i) => {
            const x = PAD.left + (i / steps.length) * innerW + barW / 2;
            return `${x},${yPos(s.cumulative)}`;
          })
          .join(" ")}
        fill="none"
        stroke={PAPER_THEME.axis}
        strokeWidth={1.5}
        strokeDasharray="4 2"
      />

      {steps.map((step, i) => {
        const x = PAD.left + (i / steps.length) * innerW + 2;
        const isNeg = step.deltaG < 0;
        const isInfeasible = step.deltaG > 0;
        const color = step.atpYield > 0 ? THEME.APRICOT : isNeg ? `rgba(${SEMANTIC_RGB.pass}, 0.82)` : SEMANTIC.fail;
        const topY = Math.min(yPos(step.cumulative), yPos(step.cumulative - step.deltaG));
        const h = Math.abs(yPos(step.cumulative) - yPos(step.cumulative - step.deltaG));
        const cx = x + (barW - 4) / 2;
        const isLimiting = step.step === limitingStep?.step;

        return (
          <g key={step.step + i}>
            <rect x={x} y={topY} width={barW - 4} height={h} rx={4} fill={color} opacity={0.82} />
            <rect
              x={x}
              y={topY}
              width={barW - 4}
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
            {isInfeasible && (
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
            {step.atpYield > 0 && !isInfeasible && (
              <text
                x={cx}
                y={topY - 8}
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
                <line x1={cx} y1={topY - 10} x2={cx} y2={PAD.top - 6} stroke={PAPER_THEME.grid} strokeDasharray="4 3" />
                <text
                  x={cx}
                  y={PAD.top - 14}
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

      {/* Energy landscape spline overlay */}
      {splinePts.length > 1 && (
        <path d={catmullRomPath(splinePts)} fill="none" stroke={THEME.APRICOT} strokeWidth={2} strokeOpacity={0.85} />
      )}

      {steps.map((step, i) => {
        const x = PAD.left + (i / steps.length) * innerW + barW / 2;
        return (
          <g key={`lbl${i}`}>
            <text
              x={x}
              y={H - 18}
              textAnchor="middle"
              fontFamily={PAPER_THEME.tickFont}
              fontSize={PAPER_THEME.tickSize}
              fill={PAPER_THEME.tickColor}
              transform={`rotate(-38,${x},${H - 18})`}
            >
              {step.step.slice(0, 12)}
            </text>
            <text
              x={x}
              y={H - 34}
              textAnchor="middle"
              fontFamily={PAPER_THEME.tickFont}
              fontSize={PAPER_THEME.tickSize}
              fill={step.deltaG < 0 ? `rgba(${SEMANTIC_RGB.pass}, 0.85)` : `rgba(${SEMANTIC_RGB.fail}, 0.85)`}
            >
              {step.deltaG > 0 ? "+" : ""}
              {step.deltaG.toFixed(1)}
            </text>
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
        x={10}
        y={H / 2}
        textAnchor="middle"
        fontFamily={PAPER_THEME.tickFont}
        fontSize={PAPER_THEME.tickSize}
        fill={PAPER_THEME.labelColor}
        transform={`rotate(-90,10,${H / 2})`}
      >
        ΔG (kJ/mol)
      </text>

      <g transform={`translate(${W - 174}, 14)`}>
        <rect
          width="154"
          height="54"
          rx={PAPER_THEME.borderRadius}
          fill={PAPER_THEME.bgAlt}
          stroke={PAPER_THEME.border}
        />
        <text
          x="12"
          y="17"
          fontFamily={PAPER_THEME.tickFont}
          fontSize={PAPER_THEME.tickSize}
          fill={PAPER_THEME.labelColor}
        >
          CURRENT LIMITING STEP
        </text>
        <text
          x="12"
          y="31"
          fontFamily={PAPER_THEME.labelFont}
          fontSize={PAPER_THEME.labelSize}
          fill={PAPER_THEME.titleColor}
        >
          {limitingStep?.step ?? "—"}
        </text>
        <text
          x="12"
          y="45"
          fontFamily={PAPER_THEME.tickFont}
          fontSize={PAPER_THEME.tickSize}
          fill={`rgba(${SEMANTIC_RGB.fail}, 0.85)`}
        >
          ΔG {limitingStep ? `${limitingStep.deltaG > 0 ? "+" : ""}${limitingStep.deltaG.toFixed(1)} kJ/mol` : "—"}
        </text>
      </g>

      {[
        { color: `rgba(${SEMANTIC_RGB.pass}, 0.82)`, label: "Exergonic" },
        { color: SEMANTIC.fail, label: "Infeasible (ΔG>0)" },
        { color: THEME.APRICOT, label: "ATP-coupled" },
        { color: THEME.APRICOT, label: "Energy landscape", line: true },
      ].map((l, i) => (
        <g key={l.label} transform={`translate(${PAD.left + i * 100},${PAD.top - 16})`}>
          {l.line ? (
            <line x1={0} y1={4} x2={10} y2={4} stroke={l.color} strokeWidth={2} />
          ) : (
            <rect width={10} height={8} rx={2} fill={l.color} opacity={0.78} />
          )}
          <text
            x={14}
            y={8}
            fontFamily={PAPER_THEME.legendFont}
            fontSize={PAPER_THEME.legendSize}
            fill={PAPER_THEME.legendColor}
          >
            {l.label}
          </text>
        </g>
      ))}
    </SVGChartContainer>
  );
}
