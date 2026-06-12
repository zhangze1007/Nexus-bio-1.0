'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer, LabelList, ReferenceLine,
} from 'recharts';
import type { MutagenesisResult, EnzymeStructure } from '../../services/CatalystDesignerEngine';
import type { ChartTooltipProps, ChartEntryProps } from '../../types/charts';
import {
  ACCENT, WARM, COOL, FONT, TOOLTIP_STYLE, CHART_CONTAINER,
  SECTION_LABEL, rechartsGrid, rechartsTick, fmt2,
} from './chartTheme';
import { colors, spacing } from '../../design-system/tokens';

/* ── Glassmorphism Tooltip ────────────────────────────────────── */

interface MutagenesisTooltipSite {
  wildTypeResidue?: string;
  position?: number;
  rationale?: string;
}

function GlassTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const site = payload[0]?.payload as unknown as MutagenesisTooltipSite | undefined;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ margin: 0, fontSize: 11, fontFamily: FONT.MONO, color: colors.text.primary, fontWeight: 600 }}>
        {site?.wildTypeResidue}{site?.position}
      </p>
      <p style={{ margin: '2px 0 0', fontFamily: FONT.SANS, fontSize: 9, color: colors.text.tertiary }}>
        {site?.rationale}
      </p>
      {payload.map((entry: ChartEntryProps, i: number) => (
        <p key={i} style={{ margin: '2px 0 0', fontFamily: FONT.MONO, color: entry.color || ACCENT.mint }}>
          {entry.name}: {fmt2(entry.value as number)}
        </p>
      ))}
    </div>
  );
}

/* ── Effect color helper ──────────────────────────────────────── */

function effectColor(e: string) {
  return e === 'beneficial' ? ACCENT.green : e === 'neutral' ? ACCENT.yellow : WARM.red;
}

/* ── Main Component ───────────────────────────────────────────── */

interface MutagenesisChartProps {
  result: MutagenesisResult;
  enzyme: EnzymeStructure;
}

export default function MutagenesisChart({ result, enzyme }: MutagenesisChartProps) {
  /* Bar chart data: ΔKcat for each site */
  const siteData = result.sites.map(s => ({
    ...s,
    name: `${s.wildTypeResidue}${s.position}`,
    deltaKcat: s.predictedDeltaKcat ?? 0,  // null → 0 (no prediction)
    confidence: s.confidence * 100,
  }));

  /* Sequence bar data for position mapping */
  const seqLen = enzyme.length;

  return (
    <div style={{ ...CHART_CONTAINER, background: colors.bg.primary, padding: Number(spacing.base) }}>
      <p style={{ fontFamily: FONT.SANS, fontSize: 9, color: colors.text.tertiary, margin: '0 0 8px', fontStyle: 'italic' }}>
        Mutagenesis effects require external tools (FoldX, Rosetta ddg_monomer, ProteinMPNN) — no quantitative predictions available.
      </p>

      {/* ── Sequence Position Map (keep as SVG — not a chart type) ── */}
      <p style={SECTION_LABEL}>SEQUENCE POSITION MAP</p>
      <svg role="img" aria-label="Mutagenesis sequence bar" viewBox={`0 0 500 56`} style={{ width: '100%', marginBottom: 8 }}>
        <rect x="0" y="16" width="500" height="22" rx="4" fill="rgba(255,255,255,0.04)" stroke={colors.border.subtle} />
        {/* Position markers */}
        {Array.from({ length: Math.ceil(seqLen / 50) + 1 }).map((_, i) => {
          const pos = i * 50;
          if (pos > seqLen) return null;
          const tx = (pos / seqLen) * 500;
          return (
            <g key={pos}>
              <line x1={tx} y1={38} x2={tx} y2={42} stroke={colors.border.strong} strokeWidth={0.5} />
              <text x={tx} y={52} textAnchor="middle" fontFamily={FONT.MONO} fontSize="10" fill={colors.text.disabled}>{pos}</text>
            </g>
          );
        })}
        {/* Catalytic residues */}
        {enzyme.catalyticResidues.map(r => {
          const rx = (r.position / seqLen) * 500;
          return <rect key={`cat-${r.position}`} x={rx - 1.5} y={18} width={3} height={18} fill={`${colors.state.error}99`} rx={1} />;
        })}
        {/* Mutagenesis sites */}
        {result.sites.map(s => {
          const sx = (s.position / seqLen) * 500;
          return (
            <g key={`mut-${s.position}`}>
              <rect x={sx - 2} y={18} width={4} height={18} fill={`${colors.chart.lime}80`} rx={1} />
              <polygon points={`${sx},8 ${sx - 4},14 ${sx + 4},14`} fill={ACCENT.mint} />
            </g>
          );
        })}
        {/* Legend */}
        <rect x="0" y="0" width="6" height="6" fill={`${colors.state.error}99`} rx={1} />
        <text x="10" y="6" fontFamily={FONT.SANS} fontSize="10" fill={colors.text.secondary}>Catalytic</text>
        <rect x="60" y="0" width="6" height="6" fill={ACCENT.mint} rx={1} />
        <text x="70" y="6" fontFamily={FONT.SANS} fontSize="10" fill={colors.text.secondary}>Mutagenesis</text>
      </svg>

      {/* ── Top Combination ── */}
      <div style={{
        padding: '6px 12px', borderRadius: 10, marginBottom: 12,
        background: 'rgba(255,255,255,0.025)', border: `1px solid ${colors.border.subtle}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontFamily: FONT.SANS, fontSize: 9, color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top Combination</span>
        <span style={{ fontFamily: FONT.MONO, fontSize: 11, color: ACCENT.mint }}>
          {result.topCombination.positions.join(', ')}
        </span>
        <span style={{ fontFamily: FONT.MONO, fontSize: 11, color: colors.text.primary }}>
          {result.topCombination.predictedImprovement != null ? `+${(result.topCombination.predictedImprovement * 100).toFixed(0)}% predicted` : 'No prediction available'}
        </span>
      </div>

      {/* ── ΔKcat Bar Chart ── */}
      <p style={SECTION_LABEL}>PREDICTED ΔKcat BY SITE</p>

      <div style={{ width: '100%', height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={siteData} margin={{ top: 8, right: 16, left: 10, bottom: 4 }} barSize={28}>
            <CartesianGrid vertical={false} {...rechartsGrid} />
            <XAxis dataKey="name" tick={rechartsTick} axisLine={{ stroke: colors.border.default }} tickLine={false} />
            <YAxis tick={rechartsTick} axisLine={{ stroke: colors.border.default }} tickLine={false} width={36} />
            <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <ReferenceLine y={1} stroke={colors.border.default} strokeDasharray="4 3" label={{ value: 'WT', fill: colors.text.disabled, fontSize: 8, fontFamily: FONT.MONO, position: 'right' }} />
            <Bar dataKey="deltaKcat" name="ΔKcat" radius={[6, 6, 0, 0]}>
              {siteData.map((entry, i) => (
                <Cell key={i} fill={effectColor(entry.predictedEffect)} fillOpacity={0.82} />
              ))}
              <LabelList
                dataKey="deltaKcat"
                position="top"
                formatter={(v) => `${fmt2(Number(v))}×`}
                style={{ fontFamily: FONT.MONO, fontSize: 9, fill: colors.text.primary }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Data Table ── */}
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Pos', 'WT', 'Mutants', 'Cons.', 'Effect', 'ΔKcat*', 'ΔKm*', 'Conf.', 'Rationale'].map(h => (
                <th key={h} style={{
                  fontFamily: FONT.MONO, fontSize: 8, color: colors.text.secondary, textAlign: 'left',
                  padding: '4px 5px', borderBottom: `1px solid ${colors.border.subtle}`,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.sites.map(s => (
              <tr key={s.position} style={{ borderBottom: `1px solid ${colors.border.subtle}` }}>
                <td style={{ fontFamily: FONT.MONO, fontSize: 10, color: ACCENT.mint, padding: '4px 5px' }}>{s.position}</td>
                <td style={{ fontFamily: FONT.MONO, fontSize: 10, color: colors.text.primary, padding: '4px 5px', textAlign: 'center' }}>{s.wildTypeResidue}</td>
                <td style={{ fontFamily: FONT.MONO, fontSize: 9, color: colors.text.primary, padding: '4px 5px' }}>{s.suggestedMutants.join(', ')}</td>
                <td style={{ fontFamily: FONT.MONO, fontSize: 10, color: colors.text.primary, padding: '4px 5px', textAlign: 'right' }}>{fmt2(s.conservationScore)}</td>
                <td style={{ fontFamily: FONT.SANS, fontSize: 9, padding: '4px 5px', color: effectColor(s.predictedEffect) }}>{s.predictedEffect}</td>
                <td style={{ fontFamily: FONT.MONO, fontSize: 10, color: colors.text.primary, padding: '4px 5px', textAlign: 'right' }}>{s.predictedDeltaKcat != null ? `${fmt2(s.predictedDeltaKcat)}x` : 'N/A'}</td>
                <td style={{ fontFamily: FONT.MONO, fontSize: 10, color: colors.text.primary, padding: '4px 5px', textAlign: 'right' }}>{s.predictedDeltaKm != null ? `${fmt2(s.predictedDeltaKm)}x` : 'N/A'}</td>
                <td style={{ fontFamily: FONT.MONO, fontSize: 10, color: colors.text.primary, padding: '4px 5px', textAlign: 'right' }}>{(s.confidence * 100).toFixed(0)}%</td>
                <td style={{ fontFamily: FONT.SANS, fontSize: 8, color: colors.text.secondary, padding: '4px 5px', maxWidth: 120 }}>{s.rationale}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontFamily: FONT.SANS, fontSize: 8, color: colors.text.disabled, margin: '6px 0 0', fontStyle: 'italic' }}>
          * No quantitative kinetic predictions available — use FoldX, Rosetta, or directed evolution for ΔΔG estimates.
        </p>
      </div>
    </div>
  );
}
