'use client';

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer, ZAxis, ReferenceLine,
} from 'recharts';
import type { ParetoFrontResult, PathwayCandidate } from '../../services/CatalystDesignerEngine';
import {
  ACCENT, COOL, FONT, TOOLTIP_STYLE, CHART_CONTAINER,
  SECTION_LABEL, rechartsGrid, rechartsTick, fmt2,
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
        <span style={{ fontFamily: FONT.MONO, color: data.paretoRank === 0 ? ACCENT.green : 'rgba(250,246,240,0.96)' }}>
          {data.paretoRank === 0 ? 'Pareto-optimal' : `Rank ${data.paretoRank}`}
        </span>
      </div>
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

  return (
    <div style={{ ...CHART_CONTAINER, background: '#050505', padding: 16 }}>
      <p style={SECTION_LABEL}>PARETO FRONT — MULTI-OBJECTIVE RANKING</p>
      <p style={{ fontFamily: FONT.SANS, fontSize: 10, color: 'rgba(250,246,240,0.96)', margin: '-6px 0 12px' }}>
        Thermodynamic score vs. yield (circle size ∝ 1/metabolic cost)
      </p>

      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 20, left: 10, bottom: 24 }}>
            <CartesianGrid {...rechartsGrid} />
            <XAxis
              dataKey="x"
              type="number"
              domain={[xMin, xMax]}
              tick={rechartsTick}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              name="Thermodynamic"
              label={{ value: 'Thermodynamic Score', position: 'insideBottom', offset: -8, style: { ...rechartsTick, fontSize: 9 } }}
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={[yMin, yMax]}
              tick={rechartsTick}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              width={40}
              name="Yield"
              label={{ value: 'Yield Score', angle: -90, position: 'insideLeft', offset: 4, style: { ...rechartsTick, fontSize: 9 } }}
            />
            <ZAxis dataKey="z" range={[60, 400]} />
            <Tooltip content={<ParetoTooltip />} cursor={false} />
            <Scatter data={scatterData} shape="circle">
              {scatterData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.isBest ? ACCENT.yellow : entry.isFront ? ACCENT.lilac : 'rgba(255,255,255,0.15)'}
                  fillOpacity={entry.isFront ? 0.85 : 0.35}
                  stroke={entry.isBest ? '#fff' : entry.isFront ? ACCENT.lilac : 'none'}
                  strokeWidth={entry.isBest ? 2 : entry.isFront ? 1 : 0}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* ── Legend: candidate names ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {candidates.map(c => {
          const isFront = frontIds.has(c.id);
          const isBest = c.id === bestOverall;
          return (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 8,
              background: isBest ? 'rgba(255,251,31,0.1)' : isFront ? 'rgba(207,196,227,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isBest ? 'rgba(255,251,31,0.3)' : isFront ? 'rgba(207,196,227,0.2)' : 'rgba(255,255,255,0.06)'}`,
            }}>
              {isBest && <span style={{ fontSize: 10 }}>★</span>}
              <span style={{ fontFamily: FONT.SANS, fontSize: 9, color: isFront ? 'rgba(250,246,240,0.96)' : 'rgba(217,225,235,0.68)' }}>
                {c.name}
              </span>
              <span style={{ fontFamily: FONT.MONO, fontSize: 8, color: 'rgba(217,225,235,0.48)' }}>
                R{c.paretoRank}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
