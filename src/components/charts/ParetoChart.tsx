'use client';

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer, ZAxis,
} from 'recharts';
import type { ParetoFrontResult, PathwayCandidate } from '../../services/CatalystDesignerEngine';
import {
  ACCENT, FONT, TOOLTIP_STYLE, CHART_CONTAINER,
  SECTION_LABEL, rechartsGrid, rechartsTick, rechartsAxisTitle,
  rechartsAxisLine, SCI_PALETTE, fmt2, axisLabel,
} from './chartTheme';

/* ── Glassmorphism Tooltip ────────────────────────────────────── */

function ParetoTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload as PathwayCandidate | undefined;
  if (!data) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ margin: 0, fontSize: 11, fontFamily: FONT.SANS, color: 'rgba(250,246,240,0.96)', fontWeight: 600 }}>
        {data.name}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', marginTop: 4 }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontFamily: FONT.SANS }}>Thermo</span>
        <span style={{ fontFamily: FONT.MONO, color: ACCENT.sky }}>{fmt2(data.scores.thermodynamic)}</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontFamily: FONT.SANS }}>Yield</span>
        <span style={{ fontFamily: FONT.MONO, color: ACCENT.mint }}>{fmt2(data.scores.yield)}</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontFamily: FONT.SANS }}>Cost</span>
        <span style={{ fontFamily: FONT.MONO, color: ACCENT.apricot }}>{fmt2(data.scores.metabolicCost)}</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontFamily: FONT.SANS }}>Rank</span>
        <span style={{ fontFamily: FONT.MONO, color: data.paretoRank === 0 ? SCI_PALETTE.green : 'rgba(250,246,240,0.96)' }}>
          {data.paretoRank === 0 ? 'Pareto-optimal' : `Rank ${data.paretoRank}`}
        </span>
      </div>
    </div>
  );
}

/* ── Legend Swatch ────────────────────────────────────────────── */

function LegendSwatch({ color, label, strong, muted }: { color: string; label: string; strong?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 10, height: 10, borderRadius: '50%',
        background: color, opacity: muted ? 0.6 : 1,
        border: strong ? '1px solid #ffffff' : 'none',
      }} />
      <span style={{
        fontFamily: FONT.SANS,
        fontSize: 10,
        color: muted ? 'rgba(232,238,248,0.62)' : 'rgba(232,238,248,0.88)',
        fontWeight: strong ? 600 : 500,
      }}>
        {label}
      </span>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

interface ParetoChartProps {
  result: ParetoFrontResult;
}

export default function ParetoChart({ result }: ParetoChartProps) {
  const { candidates, paretoFront, bestOverall } = result;
  const frontIds = new Set(paretoFront.map(c => c.id));

  /* Compute axis domains with padding */
  const thermoVals = candidates.map(c => c.scores.thermodynamic);
  const yieldVals = candidates.map(c => c.scores.yield);
  const xMin = Math.min(...thermoVals) - 0.05;
  const xMax = Math.max(...thermoVals) + 0.05;
  const yMin = Math.min(...yieldVals) - 0.05;
  const yMax = Math.max(...yieldVals) + 0.05;

  /* Scatter data with visual encoding */
  const scatterData = candidates.map(c => ({
    ...c,
    x: c.scores.thermodynamic,
    y: c.scores.yield,
    z: Math.max(60, Math.min(400, (1 / (c.scores.metabolicCost + 0.1)) * 80)),
    isFront: frontIds.has(c.id),
    isBest: c.id === bestOverall,
  }));

  /* Pareto front line (sorted by x) */
  const frontSorted = [...paretoFront].sort((a, b) => a.scores.thermodynamic - b.scores.thermodynamic);

  /* Semantic colors pulled from Okabe-Ito-adapted SCI palette. */
  const frontColor = SCI_PALETTE.blue;
  const bestColor = SCI_PALETTE.orange;
  const nonFrontColor = SCI_PALETTE.slate;

  return (
    <div style={{ ...CHART_CONTAINER, background: '#050505', padding: 16 }}>
      <p style={SECTION_LABEL}>PARETO FRONT — MULTI-OBJECTIVE RANKING</p>
      <p style={{ fontFamily: FONT.SANS, fontSize: 10, color: 'rgba(232,238,248,0.82)', margin: '-6px 0 4px' }}>
        Thermodynamic vs. yield score · circle area ∝ 1/(metabolic cost)
      </p>
      <p style={{ fontFamily: FONT.SANS, fontSize: 9, color: 'rgba(232,238,248,0.55)', margin: '0 0 12px' }}>
        Scores are single-point estimates from the design engine — no uncertainty is visualised here because the underlying engine does not emit replicate intervals.
      </p>

      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 14, right: 24, left: 12, bottom: 32 }}>
            <CartesianGrid {...rechartsGrid} />
            <XAxis
              dataKey="x"
              type="number"
              domain={[xMin, xMax]}
              tick={rechartsTick}
              axisLine={rechartsAxisLine}
              tickLine={false}
              name="Thermodynamic score"
              label={{
                value: axisLabel('Thermodynamic score', '0–1'),
                position: 'insideBottom',
                offset: -8,
                style: rechartsAxisTitle,
              }}
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={[yMin, yMax]}
              tick={rechartsTick}
              axisLine={rechartsAxisLine}
              tickLine={false}
              width={52}
              name="Yield score"
              label={{
                value: axisLabel('Yield score', '0–1'),
                angle: -90,
                position: 'insideLeft',
                offset: 4,
                style: rechartsAxisTitle,
              }}
            />
            <ZAxis dataKey="z" range={[60, 400]} />
            <Tooltip content={<ParetoTooltip />} cursor={false} />
            <Scatter data={scatterData} shape="circle">
              {scatterData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.isBest ? bestColor : entry.isFront ? frontColor : nonFrontColor}
                  fillOpacity={entry.isBest ? 0.92 : entry.isFront ? 0.78 : 0.28}
                  stroke={entry.isBest ? '#ffffff' : entry.isFront ? frontColor : 'rgba(184,196,214,0.35)'}
                  strokeWidth={entry.isBest ? 2 : entry.isFront ? 1.25 : 0.75}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* ── Legend: category + candidate names ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0 6px', flexWrap: 'wrap' }}>
        <LegendSwatch color={bestColor} label="Best overall" strong />
        <LegendSwatch color={frontColor} label="Pareto-optimal" />
        <LegendSwatch color={nonFrontColor} label="Dominated" muted />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {candidates.map(c => {
          const isFront = frontIds.has(c.id);
          const isBest = c.id === bestOverall;
          const chipColor = isBest ? bestColor : isFront ? frontColor : nonFrontColor;
          return (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '2px 10px', borderRadius: 8,
              background: `${chipColor}14`,
              border: `1px solid ${chipColor}${isFront || isBest ? '55' : '22'}`,
            }}>
              {isBest && <span style={{ fontSize: 10, color: bestColor }}>★</span>}
              <span style={{
                fontFamily: FONT.SANS,
                fontSize: 10,
                color: isFront ? 'rgba(232,238,248,0.92)' : 'rgba(232,238,248,0.6)',
              }}>
                {c.name}
              </span>
              <span style={{ fontFamily: FONT.MONO, fontSize: 9, color: 'rgba(232,238,248,0.48)' }}>
                R{c.paretoRank}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
