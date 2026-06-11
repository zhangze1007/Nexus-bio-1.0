'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import { CRISPRI_TARGETS, greedyKnockdownSchedule } from '../../data/mockGenMIM';
import type { CRISPRiTarget } from '../../types';
import { useWorkbenchStore } from '../../store/workbenchStore';
import ScientificHero from './shared/ScientificHero';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import ToolShell from './shared/ToolShell';
import ToolTabPanel from './shared/ToolTabPanel';
import FloatingControlRail from './shared/FloatingControlRail';
import InlineMetricOverlay from './shared/InlineMetricOverlay';
import WorkbenchRangeSlider from './shared/WorkbenchRangeSlider';
import type { ToolTab } from './shared/ToolTabBar';
import { THEME, TOOL_RESULT_PALETTE } from '../../theme';
import { SVGChartContainer } from '../charts/primitives';

/**
 * IGV-style linear genome map with horizontal arrow gene bodies.
 *
 * Genes are rendered as directional arrows on a linear chromosome:
 * - Forward strand (+): arrows pointing right →
 * - Reverse strand (-): arrows pointing left ←
 * - Color-coded by status: essential (coral), below threshold (apricot), candidate (mint)
 */
function GenomeMap({
  targets,
  selected,
  efficiencyThreshold,
}: {
  targets: CRISPRiTarget[];
  selected: CRISPRiTarget[];
  efficiencyThreshold: number;
}) {
  const W = 700, H = 280;
  const PAD = { top: 50, right: 30, bottom: 40, left: 50 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const GENOME_KB = 4641;
  const GENE_KB = 80;

  const selectedIds = new Set(selected.map(t => t.gene));
  const growthImpact = selected.reduce((a, t) => a + (t.growth_impact ?? 0), 0);
  const viability = Math.max(0, Math.round((1 + growthImpact) * 100));

  // Scale: kb → x position
  const xScale = (kb: number) => PAD.left + (kb / GENOME_KB) * innerW;

  function geneColor(t: CRISPRiTarget): string {
    if (selectedIds.has(t.gene)) return 'rgba(175,195,214,0.6)';
    if (t.essential) return THEME.CORAL;
    if (t.knockdown_efficiency < efficiencyThreshold) return THEME.APRICOT;
    return THEME.MINT;
  }

  // Gene arrow path (IGV style)
  // CRISPRiTarget doesn't have strand info, so we alternate based on position
  function geneArrowPath(t: CRISPRiTarget, y: number, h: number, index: number): string {
    const x1 = xScale(t.position);
    const x2 = xScale(t.position + GENE_KB);
    const w = x2 - x1;
    const arrowW = Math.min(8, w * 0.15); // Arrow head width
    const isForward = index % 2 === 0; // Alternate strand direction

    if (isForward) {
      // Forward strand: →
      return `M ${x1} ${y} L ${x2 - arrowW} ${y} L ${x2} ${y + h / 2} L ${x2 - arrowW} ${y + h} L ${x1} ${y + h} Z`;
    } else {
      // Reverse strand: ←
      return `M ${x2} ${y} L ${x1 + arrowW} ${y} L ${x1} ${y + h / 2} L ${x1 + arrowW} ${y + h} L ${x2} ${y + h} Z`;
    }
  }

  const LEGEND = [
    { color: THEME.CORAL, label: 'Essential' },
    { color: THEME.APRICOT, label: 'Below threshold' },
    { color: THEME.MINT, label: 'Candidate' },
    { color: 'rgba(175,195,214,0.6)', label: 'Suppressed' },
  ];

  return (
    <SVGChartContainer W={W} H={H} ariaLabel="IGV-style E. coli genome map" rx={14}>

      {/* Title */}
      <text x={PAD.left} y={22} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.45)" letterSpacing="0.08em">
        E. COLI K-12 · 4.64 Mb · IGV STYLE
      </text>
      <text x={PAD.left} y={38} fontFamily={THEME.SANS} fontSize="11" fill="rgba(255,255,255,0.55)">
        CRISPRi target landscape — horizontal arrow gene bodies
      </text>

      {/* Chromosome ideogram (thin line) */}
      <line
        x1={PAD.left} y1={PAD.top + innerH / 2}
        x2={PAD.left + innerW} y2={PAD.top + innerH / 2}
        stroke="rgba(255,255,255,0.15)" strokeWidth={2}
      />

      {/* Tick marks and labels */}
      {[0, 1000, 2000, 3000, 4000, 4641].map(kb => {
        const x = xScale(kb);
        return (
          <g key={kb}>
            <line
              x1={x} y1={PAD.top + innerH / 2 - 4}
              x2={x} y2={PAD.top + innerH / 2 + 4}
              stroke="rgba(255,255,255,0.2)" strokeWidth={1}
            />
            <text
              x={x} y={PAD.top + innerH + 16}
              textAnchor="middle" fontFamily={THEME.MONO} fontSize="9"
              fill="rgba(255,255,255,0.35)"
            >
              {(kb / 1000).toFixed(1)} Mb
            </text>
          </g>
        );
      })}

      {/* Gene arrows — IGV style */}
      {targets.map((t, i) => {
        const color = geneColor(t);
        const prominent = t.essential || selectedIds.has(t.gene);
        const y = PAD.top + (i % 2 === 0 ? 0 : 25); // Stagger rows for readability
        const h = 18;

        return (
          <g key={t.gene}>
            <motion.path
              d={geneArrowPath(t, y, h, i)}
              fill={color}
              opacity={selectedIds.has(t.gene) ? 0.9 : 0.75}
              stroke={prominent ? 'rgba(255,255,255,0.4)' : 'none'}
              strokeWidth={prominent ? 0.8 : 0}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: selectedIds.has(t.gene) ? 0.9 : 0.75, x: 0 }}
              transition={{ duration: 0.4, delay: i * 0.03 }}
            />
            {/* Gene label */}
            <text
              x={xScale(t.position + GENE_KB / 2)}
              y={y - 4}
              textAnchor="middle" fontFamily={THEME.MONO} fontSize="8"
              fill="rgba(255,255,255,0.5)"
              style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.6)', strokeWidth: 2 }}
            >
              {t.gene.length > 8 ? `${t.gene.slice(0, 7)}…` : t.gene}
            </text>
          </g>
        );
      })}

      {/* Efficiency bars (below chromosome) */}
      {targets.map((t, i) => {
        const x = xScale(t.position);
        const w = xScale(t.position + GENE_KB) - x;
        const barH = Math.max(2, t.knockdown_efficiency * 30);
        const y = PAD.top + innerH - 10 - barH;
        return (
          <rect
            key={`eff-${t.gene}`}
            x={x} y={y} width={w} height={barH}
            fill={t.knockdown_efficiency >= efficiencyThreshold ? 'rgba(147,203,82,0.4)' : 'rgba(232,200,200,0.3)'}
            rx={1}
          />
        );
      })}

      {/* Legend */}
      <g transform={`translate(${PAD.left}, ${PAD.top + innerH + 24})`}>
        {LEGEND.map((l, i) => (
          <g key={l.label} transform={`translate(${i * 100}, 0)`}>
            <rect width={8} height={8} rx={2} fill={l.color} opacity={0.8} />
            <text x={12} y={7} fontFamily={THEME.SANS} fontSize="9" fill="rgba(255,255,255,0.35)">
              {l.label}
            </text>
          </g>
        ))}
      </g>

      {/* Viability indicator */}
      <g transform={`translate(${W - 100}, ${PAD.top + innerH + 20})`}>
        <text fontFamily={THEME.MONO} fontSize="9" fill="rgba(255,255,255,0.3)" textAnchor="end">
          VIABILITY
        </text>
        <text y={14} fontFamily={THEME.MONO} fontSize="16" fill={viability > 70 ? THEME.MINT : viability > 40 ? THEME.APRICOT : THEME.CORAL} textAnchor="end" fontWeight={700}>
          {viability}%
        </text>
      </g>
    </SVGChartContainer>
  );
}

const GENMIM_TABS: ToolTab[] = [
  { id: 'genome', label: 'Genome Map', accent: THEME.SKY },
  { id: 'targets', label: 'Targets', accent: THEME.LILAC },
  { id: 'schedule', label: 'Schedule', accent: THEME.CORAL },
  { id: 'efficiency', label: 'Efficiency', accent: THEME.MINT },
];

export default React.memo(function GenMIMPage() {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const fbaPayload = useWorkbenchStore((s) => s.toolPayloads.fbasim);
  const dynconPayload = useWorkbenchStore((s) => s.toolPayloads.dyncon);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);
  const [efficiency, setEfficiency] = useState(0.8);
  const [maxTargets, setMaxTargets] = useState(5);
  const [protectEssential, setProtectEssential] = useState(true);
  const recommendedEfficiency = useMemo(() => {
    const value = 0.72
      + (fbaPayload?.result.feasible ? 0.08 : 0)
      + (dynconPayload?.result.stable ? 0.04 : -0.03);
    return Math.min(1, Math.max(0.5, Math.round(value * 100) / 100));
  }, [dynconPayload?.result.stable, fbaPayload?.result.feasible]);
  const recommendedTargets = useMemo(() => {
    const count = 3
      + (analyzeArtifact?.bottleneckAssumptions.length ?? 0)
      + ((fbaPayload?.result.carbonEfficiency ?? 0) > 60 ? 1 : 0);
    return Math.min(15, Math.max(1, count));
  }, [analyzeArtifact?.bottleneckAssumptions.length, fbaPayload?.result.carbonEfficiency]);

  useEffect(() => {
    setEfficiency(recommendedEfficiency);
    setMaxTargets(recommendedTargets);
    setProtectEssential((dynconPayload?.result.doRmse ?? 0.05) <= 0.08);
  }, [dynconPayload?.result.doRmse, recommendedEfficiency, recommendedTargets]);

  const { data: schedule, error: simError } = useMemo(() => {
    try {
      return { data: greedyKnockdownSchedule(CRISPRI_TARGETS, maxTargets, efficiency, protectEssential), error: null as string | null };
    } catch (e) {
      return { data: [] as ReturnType<typeof greedyKnockdownSchedule>, error: e instanceof Error ? e.message : 'Knockdown scheduling failed' };
    }
  }, [efficiency, maxTargets, protectEssential]);

  const growthImpact = schedule.reduce((a, t) => a + (t.growth_impact ?? 0), 0);
  const avgEfficiency = schedule.length > 0
    ? schedule.reduce((a, t) => a + t.knockdown_efficiency, 0) / schedule.length : 0;
  const offTargetRisk = schedule.filter(t => t.knockdown_efficiency < 0.9).length / Math.max(schedule.length, 1);
  const [activeTab, setActiveTab] = useState('genome');

  const figureMeta = useMemo(() => ({
    eyebrow: 'Genome minimization map',
    title: 'CRISPRi target landscape, selected schedule, and viability ledger are read as one chassis figure',
    caption: 'The page now treats chassis minimization as a genome-scale scientific figure rather than a parameter form, so suppression logic, viability, and target evidence stay in one reading surface.',
  }), []);

  useEffect(() => {
    setToolPayload('genmim', {
      validity: 'partial',
      toolId: 'genmim',
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
      sourceArtifactId: analyzeArtifact?.id,
      efficiencyThreshold: efficiency,
      maxTargets,
      protectEssential,
      result: {
        selectedTargets: schedule.length,
        growthImpact,
        avgEfficiency,
        offTargetRisk,
        topGenes: schedule.slice(0, 5).map((target) => target.gene),
      },
      updatedAt: Date.now(),
    });
  }, [
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    avgEfficiency,
    efficiency,
    growthImpact,
    maxTargets,
    offTargetRisk,
    project?.targetProduct,
    project?.title,
    protectEssential,
    schedule,
    setToolPayload,
  ]);

  const upstreamMissing: string[] = [];
  if (!fbaPayload) upstreamMissing.push('FBASim');
  if (!dynconPayload) upstreamMissing.push('DynCon');

  return (
    <ToolShell
      moduleId="genmim"
      title="Gene Minimization via CRISPRi"
      description="Greedy knockdown scheduling: ranks non-essential genes by knockdown efficiency, bounded by max targets and growth tolerance."
      formula="score = KD_eff + (1 + GI) × 0.3"
      tabs={GENMIM_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={['schedule', 'efficiency']}
      hero={
        <ScientificHero
          eyebrow="Stage 3 · Chassis Minimization"
          title="Minimal chassis decisions with explicit growth tradeoffs"
          summary="GENMIM now foregrounds the chassis question instead of burying it in a schedule table. You can read immediately how many targets are being proposed, how much growth is being sacrificed, and whether the current protection policy is conservative enough for the active project."
          signals={[
            { label: 'Selected Targets', value: `${schedule.length}`, detail: `Max budget ${maxTargets}`, tone: schedule.length > 6 ? 'warm' : 'cool' },
            { label: 'Growth Impact', value: `${(growthImpact * 100).toFixed(1)}%`, detail: Math.abs(growthImpact) > 0.4 ? 'Expensive in host fitness.' : 'Manageable band.', tone: Math.abs(growthImpact) > 0.4 ? 'alert' : 'cool' },
            { label: 'Average KD', value: `${(avgEfficiency * 100).toFixed(1)}%`, detail: `Off-target ${(offTargetRisk * 100).toFixed(0)}%`, tone: avgEfficiency > 0.85 ? 'cool' : 'warm' },
            { label: 'Lead Gene', value: schedule[0]?.gene ?? 'Pending', detail: schedule[0] ? `${schedule[0].phenotype}` : 'No schedule yet.', tone: 'neutral' },
          ]}
        />
      }
      footer={
        <>
          <ExportButton label="Export Schedule JSON" data={schedule} filename="genmim-schedule" format="json" />
          <ExportButton label="Export All Targets CSV" data={CRISPRI_TARGETS} filename="genmim-targets" format="csv" />
        </>
      }
    >
      {upstreamMissing.length > 0 && (
        <div style={{
          padding: '8px 12px', marginBottom: '8px',
          borderRadius: 'var(--nb-radius-md)', border: '1px solid rgba(180, 150, 100, 0.50)',
          background: 'rgba(232, 220, 200, 0.12)', color: THEME.VALUE,
          fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', lineHeight: 1.55,
        }}>
          <strong>Upstream payload missing:</strong>{' '}Run <em>{upstreamMissing.join(' and ')}</em> first.
        </div>
      )}
      {simError && (
        <div style={{ padding: '0 0 8px' }}><SimErrorBanner message={simError} /></div>
      )}

      {/* ── Genome Map Tab ── */}
      <ToolTabPanel tabId="genome" activeId={activeTab}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <FloatingControlRail label="CRISPRi Parameters" defaultCollapsed={false}>
            <WorkbenchRangeSlider
              label="Min. knockdown efficiency"
              value={efficiency}
              min={0.5}
              max={1.0}
              step={0.01}
              formatValue={v => `${(v * 100).toFixed(0)}%`}
              onChange={setEfficiency}
            />
            <WorkbenchRangeSlider
              label="Max targets"
              value={maxTargets}
              min={1}
              max={15}
              step={1}
              formatValue={v => `${v}`}
              onChange={v => setMaxTargets(v as number)}
            />

            <button
              onClick={() => setProtectEssential(!protectEssential)}
              className={`nb-tool-toggle${protectEssential ? ' nb-tool-toggle--active' : ''}`}
              aria-pressed={protectEssential}
              aria-label="Toggle protect essential genes"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '7px 10px', marginBottom: '16px',
                borderRadius: 'var(--nb-radius-sm)',
                fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', textAlign: 'left',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: protectEssential ? THEME.APRICOT : 'transparent', border: `1px solid ${THEME.APRICOT}`, flexShrink: 0 }} />
              Protect essential genes
            </button>
          </FloatingControlRail>

          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, padding: '12px' }}>
            <ScientificFigureFrame
              eyebrow={figureMeta.eyebrow}
              title={figureMeta.title}
              caption={figureMeta.caption}
              legend={[
                { label: 'Targets', value: `${schedule.length}`, accent: THEME.CORAL },
                { label: 'Protection', value: protectEssential ? 'Essential on' : 'Aggressive', accent: THEME.APRICOT },
                { label: 'Avg KD', value: `${(avgEfficiency * 100).toFixed(1)}%`, accent: THEME.MINT },
                { label: 'Growth', value: `${(growthImpact * 100).toFixed(1)}%`, accent: THEME.SKY },
              ]}
              footer={
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>
                  baseline {recommendedTargets} targets · {(recommendedEfficiency * 100).toFixed(0)}% KD · off-target {(offTargetRisk * 100).toFixed(0)}%
                </div>
              }
              minHeight="100%"
            >
              <GenomeMap targets={CRISPRI_TARGETS} selected={schedule} efficiencyThreshold={efficiency} />
            </ScientificFigureFrame>

            <InlineMetricOverlay
              position="top-right"
              metrics={[
                { label: 'Targets', value: `${schedule.length}`, accent: THEME.CORAL },
                { label: 'Avg KD', value: `${(avgEfficiency * 100).toFixed(1)}%`, accent: THEME.SKY },
                { label: 'Growth', value: `${(growthImpact * 100).toFixed(1)}%`, accent: Math.abs(growthImpact) > 0.4 ? THEME.CORAL : THEME.MINT },
              ]}
            />
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Targets Tab ── */}
      <ToolTabPanel tabId="targets" activeId={activeTab}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.LABEL, marginBottom: '10px' }}>
            All CRISPRi Targets
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${THEME.BORDER_STRONG}` }}>
                  {['Gene', 'Position', 'Essential', 'KD Eff.', 'Phenotype', 'Growth ΔΔ'].map(h => (
                    <th key={h} style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: THEME.LABEL, padding: '5px 8px', textAlign: 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CRISPRI_TARGETS.map((t, i) => {
                  const isSelected = schedule.some(s => s.gene === t.gene);
                  return (
                    <tr key={t.gene} style={{ background: isSelected ? 'rgba(232,163,161,0.10)' : i % 2 === 0 ? 'transparent' : THEME.PANEL_INSET }}>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: THEME.VALUE }}>{t.gene}</td>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: THEME.LABEL }}>{t.position.toLocaleString()}</td>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: t.essential ? THEME.APRICOT : THEME.LABEL }}>{t.essential ? 'YES' : 'no'}</td>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: THEME.VALUE }}>{t.essential ? '—' : `${(t.knockdown_efficiency * 100).toFixed(0)}%`}</td>
                      <td style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: THEME.LABEL }}>{t.phenotype}</td>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: THEME.LABEL }}>{t.essential ? '—' : `${((t.growth_impact ?? 0) * 100).toFixed(0)}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Schedule Tab ── */}
      <ToolTabPanel tabId="schedule" activeId={activeTab}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.LABEL, marginBottom: '10px' }}>
            Selected Schedule ({schedule.length} targets)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {schedule.map((t, i) => (
              <div key={t.gene} style={{
                padding: '8px 12px',
                background: 'rgba(232,163,161,0.12)', border: '1px solid rgba(232,163,161,0.28)', borderRadius: 'var(--nb-radius-sm)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', fontWeight: 600, color: THEME.VALUE }}>{t.gene}</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>{(t.knockdown_efficiency * 100).toFixed(0)}% KD</span>
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginTop: '2px' }}>
                  {t.phenotype} · GI: {((t.growth_impact ?? 0) * 100).toFixed(0)}%
                </div>
                <div style={{ marginTop: '6px', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                  <div style={{ height: '100%', borderRadius: '2px', width: `${t.knockdown_efficiency * 100}%`, background: THEME.CORAL, opacity: 0.6, transition: 'width 0.3s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Efficiency Tab ── */}
      <ToolTabPanel tabId="efficiency" activeId={activeTab}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
            <MetricCard label="Targets Selected" value={schedule.length} highlight />
            <MetricCard label="Total Growth Impact" value={(growthImpact * 100).toFixed(1)} unit="%"
              warning={Math.abs(growthImpact) > 0.4 ? 'Growth penalty >40%' : undefined} />
            <MetricCard label="Avg KD Efficiency" value={(avgEfficiency * 100).toFixed(1)} unit="%" />
            <MetricCard label="Off-target Risk" value={(offTargetRisk * 100).toFixed(0)} unit="%" />
          </div>

          <div style={{
            padding: '12px', borderRadius: 'var(--nb-radius-md)',
            border: `1px solid ${THEME.BORDER}`,
            background: THEME.PANEL_SURFACE, display: 'grid', gap: '6px',
          }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Readout
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, lineHeight: 1.55 }}>
              {protectEssential
                ? 'The current schedule is conservative enough to behave like a viable chassis-editing proposal rather than an aggressive pruning experiment.'
                : 'Aggressive pruning is enabled, so this schedule should be interpreted as a stress-test of the chassis boundary rather than a default plan.'}
            </div>
          </div>
        </div>
      </ToolTabPanel>
    </ToolShell>
  );
});
