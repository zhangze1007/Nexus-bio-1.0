'use client';
import React from 'react';
import { SVGChartContainer } from '../../charts/primitives';
import { PAPER_THEME } from '../../charts/chartTheme';
import { THEME } from '../../../theme';
import type { OmicsRow } from '../../../types';

/* ── VolcanoPlot (preserved) ──────────────────────────────────────── */

export function VolcanoPlot({ data, fcThreshold, pvThreshold, highlightedGene }: {
  data: OmicsRow[]; fcThreshold: number; pvThreshold: number; highlightedGene?: string;
}) {
  const W = 360, H = 300, PAD = 36;
  const fcMax = 6, pvMax = 5;

  function xPos(fc: number) { return PAD + ((fc + fcMax) / (fcMax * 2)) * (W - PAD * 2); }
  function yPos(pv: number) { return H - PAD - (Math.min(Math.max(0, -Math.log10(Math.max(pv, 1e-5))), pvMax) / pvMax) * (H - PAD * 2); }

  const pvLine = H - PAD - (-Math.log10(pvThreshold) / pvMax) * (H - PAD * 2);
  const fcLineL = xPos(-fcThreshold);
  const fcLineR = xPos(fcThreshold);

  return (
    <SVGChartContainer W={W} H={H} ariaLabel="Volcano plot" variant="paper">
      <line x1={PAD} y1={pvLine} x2={W - PAD} y2={pvLine}
        stroke={PAPER_THEME.grid} strokeWidth={1} strokeDasharray="4 3" />
      <line x1={fcLineL} y1={PAD} x2={fcLineL} y2={H - PAD}
        stroke={PAPER_THEME.grid} strokeWidth={1} strokeDasharray="4 3" />
      <line x1={fcLineR} y1={PAD} x2={fcLineR} y2={H - PAD}
        stroke={PAPER_THEME.grid} strokeWidth={1} strokeDasharray="4 3" />
      <rect
        x={fcLineR}
        y={PAD}
        width={W - PAD - fcLineR}
        height={pvLine - PAD}
        fill="rgba(147,203,82,0.06)"
      />
      <rect
        x={PAD}
        y={PAD}
        width={fcLineL - PAD}
        height={pvLine - PAD}
        fill="rgba(250,128,114,0.06)"
      />
      {data.map(row => {
        const fc = row.fold_change ?? 0;
        const pv = row.pValue ?? 1;
        const sig = pv < pvThreshold && Math.abs(fc) > fcThreshold;
        const up = fc > 0;
        const isHighlighted = row.gene === highlightedGene;
        const color = sig
          ? (up ? 'rgba(147,203,82,0.85)' : 'rgba(250,128,114,0.85)')
          : PAPER_THEME.scatterStroke;
        return (
          <g key={row.id}>
            {isHighlighted && (
              <circle cx={xPos(fc)} cy={yPos(pv)} r={8} fill="none" stroke="rgba(255,139,31,0.9)" strokeWidth={1.4} />
            )}
            <circle
              cx={xPos(fc)}
              cy={yPos(pv)}
              r={isHighlighted ? 5.5 : sig ? 4 : 2.5}
              fill={color}
            >
              <title>{row.gene}: FC={fc.toFixed(2)}, p={pv.toFixed(4)}</title>
            </circle>
            {isHighlighted && (
              <text x={xPos(fc)} y={yPos(pv) - 10} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,139,31,0.92)">
                {row.gene}
              </text>
            )}
          </g>
        );
      })}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke={PAPER_THEME.axis} strokeWidth={PAPER_THEME.axisWidth} />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke={PAPER_THEME.axis} strokeWidth={PAPER_THEME.axisWidth} />
      <text x={W / 2} y={H - 4} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
        log₂ Fold Change
      </text>
      <text x={10} y={H / 2} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}
        transform={`rotate(-90,10,${H / 2})`}>
        -log₁₀(p)
      </text>
      <text x={W - PAD} y={H - PAD + 12} textAnchor="end" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>+{fcMax}</text>
      <text x={PAD} y={H - PAD + 12} textAnchor="start" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>-{fcMax}</text>
      <text x={W - PAD - 4} y={PAD + 12} textAnchor="end" fontFamily={THEME.MONO} fontSize="10" fill="rgba(147,203,82,0.74)">
        productive-significant
      </text>
    </SVGChartContainer>
  );
}
