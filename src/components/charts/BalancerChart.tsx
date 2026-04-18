'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { PathwayBalanceResult } from '../../services/CatalystDesignerEngine';
import {
  ACCENT, FONT, TOOLTIP_STYLE, CHART_CONTAINER,
  SECTION_LABEL, rechartsGrid, rechartsTick, rechartsAxisTitle,
  rechartsAxisLine, SCI_PALETTE, LINE, MARKER, fmt2, axisLabel,
} from './chartTheme';

/* ── Glassmorphism Tooltip ────────────────────────────────────── */

function GlassTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ margin: 0, fontSize: 10, color: 'rgba(232,238,248,0.65)', fontFamily: FONT.SANS }}>
        Iteration {label}
      </p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ margin: '2px 0 0', fontFamily: FONT.MONO, fontSize: 11, color: entry.color }}>
          {entry.name}: {fmt2(entry.value as number)} mM
        </p>
      ))}
    </div>
  );
}

/* ── Pipeline Node ────────────────────────────────────────────── */

function PipelineNode({ enzyme, adjustedKcat, toxRatio, intermediateConc, isLast, flux }:
  { enzyme: string; adjustedKcat: number; toxRatio: number; intermediateConc: number; isLast: boolean; flux: number }) {
  const intColor = toxRatio > 0.8 ? SCI_PALETTE.vermilion : toxRatio > 0.5 ? SCI_PALETTE.yellow : SCI_PALETTE.green;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
      {/* Enzyme node */}
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        border: `1.5px solid ${SCI_PALETTE.blue}`,
        background: `${SCI_PALETTE.blue}10`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: FONT.MONO, fontSize: 9, color: 'rgba(240,244,252,0.96)', fontWeight: 600 }}>
          {enzyme.toUpperCase()}
        </span>
        <span style={{ fontFamily: FONT.MONO, fontSize: 8, color: 'rgba(232,238,248,0.72)' }}>
          k<sub>cat</sub> {fmt2(adjustedKcat)} s⁻¹
        </span>
      </div>

      {/* Intermediate connector */}
      {!isLast && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
          {/* Arrow line */}
          <div style={{ width: 16, height: 1, background: 'rgba(255,255,255,0.12)' }} />
          {/* Intermediate box */}
          <div style={{
            padding: '3px 6px', borderRadius: 4,
            background: 'rgba(255,255,255,0.03)', border: `1px solid ${intColor}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <span style={{ fontFamily: FONT.MONO, fontSize: 7, color: intColor }}>{fmt2(intermediateConc)}</span>
            <span style={{ fontFamily: FONT.MONO, fontSize: 6, color: 'rgba(217,225,235,0.48)' }}>mM</span>
          </div>
          {/* Arrow line + head */}
          <div style={{ width: 12, height: 1, background: 'rgba(255,255,255,0.12)' }} />
          <div style={{
            width: 0, height: 0, borderLeft: '4px solid rgba(255,255,255,0.2)',
            borderTop: '3px solid transparent', borderBottom: '3px solid transparent',
          }} />
          {/* Flux label */}
          <span style={{
            position: 'absolute', marginTop: -18, fontFamily: FONT.MONO,
            fontSize: 6, color: 'rgba(217,225,235,0.48)',
          }}>
            {fmt2(flux)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

interface BalancerChartProps {
  result: PathwayBalanceResult;
}

export default function BalancerChart({ result }: BalancerChartProps) {
  const steps = result.steps;

  /* Convergence data for Recharts */
  const convergenceData = result.convergenceHistory.map(c => ({
    iter: c.iter,
    maxConc: c.maxConc,
    flux: c.flux,
  }));

  return (
    <div style={{ ...CHART_CONTAINER, background: '#050505', padding: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <p style={SECTION_LABEL}>PATHWAY PIPELINE — {steps.length} STEPS</p>
        </div>
        <div style={{
          padding: '3px 10px', borderRadius: 10,
          background: result.isBalanced ? `${SCI_PALETTE.green}1f` : `${SCI_PALETTE.vermilion}1f`,
          border: `1px solid ${result.isBalanced ? SCI_PALETTE.green : SCI_PALETTE.vermilion}`,
        }}>
          <span style={{ fontFamily: FONT.MONO, fontSize: 10, color: result.isBalanced ? SCI_PALETTE.green : SCI_PALETTE.vermilion }}>
            {result.isBalanced ? 'Balanced' : 'Imbalanced'}
          </span>
        </div>
      </div>

      {/* ── Pipeline visualization ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto',
        padding: '8px 0 16px', position: 'relative',
      }}>
        {steps.map((s, i) => (
          <PipelineNode
            key={i}
            enzyme={s.enzyme}
            adjustedKcat={s.adjustedKcat}
            toxRatio={s.intermediateConc / s.toxicityThreshold}
            intermediateConc={s.intermediateConc}
            isLast={i === steps.length - 1}
            flux={s.currentFlux}
          />
        ))}
      </div>

      {/* ── Convergence Chart ── */}
      {convergenceData.length > 1 && (
        <>
          <p style={{ ...SECTION_LABEL, marginTop: 12 }}>CONVERGENCE HISTORY</p>
          <p style={{ fontFamily: FONT.SANS, fontSize: 10, color: 'rgba(232,238,248,0.82)', margin: '-6px 0 4px' }}>
            LP iterations vs. max intermediate concentration
          </p>
          <p style={{ fontFamily: FONT.SANS, fontSize: 9, color: 'rgba(232,238,248,0.55)', margin: '0 0 10px' }}>
            Single deterministic optimization trace — no confidence band is drawn because a confidence band would imply repeated runs that do not exist.
          </p>

          <div style={{ width: '100%', height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={convergenceData} margin={{ top: 8, right: 20, left: 12, bottom: 24 }}>
                <CartesianGrid {...rechartsGrid} />
                <XAxis
                  dataKey="iter"
                  tick={rechartsTick}
                  axisLine={rechartsAxisLine}
                  tickLine={false}
                  label={{
                    value: axisLabel('LP iteration'),
                    position: 'insideBottom',
                    offset: -6,
                    style: rechartsAxisTitle,
                  }}
                />
                <YAxis
                  tick={rechartsTick}
                  axisLine={rechartsAxisLine}
                  tickLine={false}
                  width={56}
                  label={{
                    value: axisLabel('Max [intermediate]', 'mM'),
                    angle: -90,
                    position: 'insideLeft',
                    offset: 4,
                    style: rechartsAxisTitle,
                  }}
                />
                <Tooltip content={<GlassTooltip />} />
                <Line
                  type="monotone"
                  dataKey="maxConc"
                  name="Max [intermediate]"
                  stroke={SCI_PALETTE.vermilion}
                  strokeWidth={LINE.primary}
                  dot={{ fill: SCI_PALETTE.vermilion, r: MARKER.secondary, strokeWidth: 0 }}
                  activeDot={{ r: MARKER.active, fill: SCI_PALETTE.vermilion, stroke: '#fff', strokeWidth: 1.5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
