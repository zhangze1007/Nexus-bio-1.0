'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import ConfidenceBadge from './shared/ConfidenceBadge';
import ParameterPanel from './shared/ParameterPanel';
import ResultSummaryPanel from './shared/ResultSummaryPanel';
import { CRISPRI_TARGETS, greedyKnockdownSchedule, computeOffTargetScore } from '../../data/mockGenMIM';
import { designgRNAs, type CasProtein } from '../../server/grnaDesigner';
import type { CRISPRiTarget } from '../../types';
import { getToolValidity } from '../../config/toolValidity';
import DataUpload from '../shared/DataUpload';
import DataPreview from '../shared/DataPreview';
import DataSourceBadge from '../ide/shared/DataSourceBadge';

/**
 * Generate a deterministic pseudo-sequence from a numeric seed.
 * Used to demonstrate sgRNA design when real coding sequences are not available.
 * In production, this would be replaced by actual genome sequence lookup.
 */
function generatePseudoSequence(seed: number, length: number): string {
  const bases = 'ACGT';
  let s = seed;
  let seq = '';
  for (let i = 0; i < length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    seq += bases[s % 4];
  }
  return seq;
}

// FBA reaction → gene mapping for flux-driven CRISPRi prioritization
// Targets aligned with FBA-identified flux bottlenecks receive a score boost
const REACTION_TO_GENES: Record<string, string[]> = {
  PFK: ['pfkA', 'pfkB'],
  PYK: ['pykF', 'pykA'],
  GAPD: ['gapA'],
  PGI: ['zwf'],
  ENO: ['eno'],
  PDH: ['ppc'],
  CS: ['sdhA'],
  MDH: ['sucA'],
  FBA: ['gpmA'],
};
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
import { PAPER_THEME } from '../charts/chartTheme';
import NextStepButton from '../NextStepButton';
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
    <SVGChartContainer W={W} H={H} ariaLabel="IGV-style E. coli genome map" variant="paper">

      {/* Title */}
      <text x={PAD.left} y={22} fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor} letterSpacing="0.08em">
        E. COLI K-12 · 4.64 Mb · IGV STYLE
      </text>
      <text x={PAD.left} y={38} fontFamily={THEME.SANS} fontSize="11" fill={PAPER_THEME.labelColor}>
        CRISPRi target landscape — horizontal arrow gene bodies
      </text>

      {/* Chromosome ideogram (thin line) */}
      <line
        x1={PAD.left} y1={PAD.top + innerH / 2}
        x2={PAD.left + innerW} y2={PAD.top + innerH / 2}
        stroke={PAPER_THEME.axis} strokeWidth={2}
      />

      {/* Tick marks and labels */}
      {[0, 1000, 2000, 3000, 4000, 4641].map(kb => {
        const x = xScale(kb);
        return (
          <g key={kb}>
            <line
              x1={x} y1={PAD.top + innerH / 2 - 4}
              x2={x} y2={PAD.top + innerH / 2 + 4}
              stroke={PAPER_THEME.grid} strokeWidth={1}
            />
            <text
              x={x} y={PAD.top + innerH + 16}
              textAnchor="middle" fontFamily={THEME.MONO} fontSize="9"
              fill={PAPER_THEME.tickColor}
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
              stroke={prominent ? PAPER_THEME.axis : 'none'}
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
              fill={PAPER_THEME.labelColor}
              style={{ paintOrder: 'stroke', stroke: PAPER_THEME.bg, strokeWidth: 2 }}
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
            <text x={12} y={7} fontFamily={THEME.SANS} fontSize="9" fill={PAPER_THEME.tickColor}>
              {l.label}
            </text>
          </g>
        ))}
      </g>

      {/* Viability indicator */}
      <g transform={`translate(${W - 100}, ${PAD.top + innerH + 20})`}>
        <text fontFamily={THEME.MONO} fontSize="9" fill={PAPER_THEME.tickColor} textAnchor="end">
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
  { id: 'multiplex', label: 'Multiplex Strategy', accent: THEME.LILAC },
  { id: 'synthetic', label: 'Synthetic', accent: THEME.APRICOT },
  { id: 'biosafety', label: 'Biosafety', accent: THEME.CORAL },
  { id: 'gem', label: 'GEM Reconstruction', accent: THEME.MINT },
];

const VALIDITY_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  real:    { bg: 'rgba(147, 203, 82, 0.16)',  border: 'rgba(147, 203, 82, 0.45)',  color: '#5d8a2f', label: 'REAL' },
  partial: { bg: 'rgba(232, 220, 200, 0.32)', border: 'rgba(180, 150, 100, 0.50)', color: '#8a6a30', label: 'PARTIAL' },
  demo:    { bg: 'rgba(250, 128, 114, 0.16)', border: 'rgba(250, 128, 114, 0.50)', color: '#a8453a', label: 'DEMO' },
};

function FrontierEngineBadge({ engineId }: { engineId: string }) {
  const validity = getToolValidity(engineId);
  if (!validity) return null;
  const style = VALIDITY_STYLES[validity.level] ?? VALIDITY_STYLES.partial;
  return (
    <div
      title={validity.caption}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        marginLeft: 'auto', marginRight: 16,
        fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', fontWeight: 700,
        letterSpacing: '0.10em', padding: '5px 9px',
        borderRadius: 'var(--nb-radius-md)',
        background: style.bg, border: `1px solid ${style.border}`, color: style.color,
        cursor: 'help', flexShrink: 0,
      }}
    >
      {style.label}
      <span style={{ fontWeight: 400, opacity: 0.7, letterSpacing: 0 }}>/ {engineId}</span>
    </div>
  );
}

export default React.memo(function GenMIMPage() {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const fbaPayload = useWorkbenchStore((s) => s.toolPayloads.fbasim);
  const dynconPayload = useWorkbenchStore((s) => s.toolPayloads.dyncon);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);
  const [efficiency, setEfficiency] = useState(0.8);
  const [maxTargets, setMaxTargets] = useState(5);
  const [protectEssential, setProtectEssential] = useState(true);

  // Custom gene targets upload
  const [customTargets, setCustomTargets] = useState<Array<{ geneId: string; geneName: string; essentiality: number; flux: number }> | null>(null);
  const [customTargetHeaders, setCustomTargetHeaders] = useState<string[]>([]);
  const [customTargetRows, setCustomTargetRows] = useState<Record<string, string>[]>([]);
  const [customTargetError, setCustomTargetError] = useState<string | null>(null);
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

  // Flux-boosted CRISPRi targets: boost knockdown_efficiency for genes
  // whose corresponding FBA reactions carry high flux (bottleneck candidates)
  // Merges custom uploaded targets with default CRISPRI_TARGETS
  const fluxBoostedTargets = useMemo(() => {
    // Build base targets: merge custom + default
    let baseTargets: CRISPRiTarget[] = [...CRISPRI_TARGETS];
    if (customTargets && customTargets.length > 0) {
      const defaultGeneIds = new Set(CRISPRI_TARGETS.map(t => t.gene));
      const customAsTargets: CRISPRiTarget[] = customTargets.map(ct => ({
        gene: ct.geneId,
        position: 0,
        essential: ct.essentiality > 0.5,
        knockdown_efficiency: 0.8,
        phenotype: ct.geneName || ct.geneId,
        growth_impact: -0.05,
      }));
      // Add custom targets that don't already exist in defaults
      const newCustom = customAsTargets.filter(t => !defaultGeneIds.has(t.gene));
      baseTargets = [...CRISPRI_TARGETS, ...newCustom];
    }

    if (!fbaPayload?.result.topFluxes?.length) return baseTargets;
    const geneFluxBoost = new Map<string, number>();
    for (const { reactionId, flux } of fbaPayload.result.topFluxes) {
      const genes = REACTION_TO_GENES[reactionId];
      if (genes) {
        for (const gene of genes) {
          geneFluxBoost.set(gene, (geneFluxBoost.get(gene) ?? 0) + Math.abs(flux));
        }
      }
    }
    if (geneFluxBoost.size === 0) return baseTargets;
    const maxFlux = Math.max(...geneFluxBoost.values(), 1);
    return baseTargets.map((t) => {
      const boost = geneFluxBoost.get(t.gene);
      if (boost === undefined) return t;
      // Boost knockdown_efficiency by up to 0.08 for high-flux genes
      const normalizedBoost = (boost / maxFlux) * 0.08;
      return { ...t, knockdown_efficiency: Math.min(1, t.knockdown_efficiency + normalizedBoost) };
    });
  }, [fbaPayload?.result.topFluxes, customTargets]);

  const { data: schedule, error: simError } = useMemo(() => {
    try {
      return { data: greedyKnockdownSchedule(fluxBoostedTargets, maxTargets, efficiency, protectEssential), error: null as string | null };
    } catch (e) {
      return { data: [] as ReturnType<typeof greedyKnockdownSchedule>, error: e instanceof Error ? e.message : 'Knockdown scheduling failed' };
    }
  }, [fluxBoostedTargets, efficiency, maxTargets, protectEssential]);

  const growthImpact = schedule.reduce((a, t) => a + (t.growth_impact ?? 0), 0);
  const avgEfficiency = schedule.length > 0
    ? schedule.reduce((a, t) => a + t.knockdown_efficiency, 0) / schedule.length : 0;
  // sgRNA sequences computed from gene coding sequences using designgRNAs()
  // Uses Rule Set 2 (Doench 2016) on-target scoring + CFD off-target scoring.
  // For genes without a provided coding sequence, we use the gene name as a seed
  // and generate a deterministic pseudo-sequence for demonstration purposes.
  const sgRNASequences: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of schedule) {
      const seed = t.gene.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      const pseudoSeq = generatePseudoSequence(seed, 60);
      const result = designgRNAs(pseudoSeq, 'SpCas9', 1, t.gene);
      map[t.gene] = result.candidates[0]?.spacer ?? t.gene.toUpperCase().padEnd(20, 'A').slice(0, 20);
    }
    return map;
  }, [schedule]);
  const offTargetRisk = schedule.length > 0
    ? Math.round(schedule.reduce((sum, t) => sum + computeOffTargetScore(sgRNASequences[t.gene] ?? ''), 0) / schedule.length * 100) / 100
    : 0;
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
        <>
          <FrontierEngineBadge engineId="multiplexcrispr" />
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
        </>
      }
      footer={
        <>
          <DataSourceBadge source={fbaPayload || dynconPayload ? 'live' : 'mock'} label={fbaPayload || dynconPayload ? 'Upstream Data' : 'Default Targets'} />
          <ExportButton label="Export Schedule JSON" data={schedule} filename="genmim-schedule" format="json" />
          <ExportButton label="Export All Targets CSV" data={fluxBoostedTargets} filename="genmim-targets" format="csv" />
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
              <GenomeMap targets={fluxBoostedTargets} selected={schedule} efficiencyThreshold={efficiency} />
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
          {/* Upload Gene Targets Section */}
          <div style={{
            padding: '12px', marginBottom: '16px', borderRadius: 'var(--nb-radius-md)',
            border: `1px solid ${THEME.BORDER}`, background: THEME.PANEL_INSET,
          }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Upload Gene Targets
            </div>
            <DataUpload
              accept=".csv,.tsv"
              label="Upload custom gene targets"
              onUpload={(rows, headers) => {
                const lowerHeaders = headers.map(h => h.toLowerCase());
                const geneIdCol = lowerHeaders.findIndex(h => h === 'gene_id' || h === 'geneid' || h === 'gene');
                const geneNameCol = lowerHeaders.findIndex(h => h === 'gene_name' || h === 'genename' || h === 'name');
                const essentialityCol = lowerHeaders.findIndex(h => h === 'essentiality' || h === 'essential');
                const fluxCol = lowerHeaders.findIndex(h => h === 'flux');
                if (geneIdCol === -1) {
                  setCustomTargetError('CSV must have a gene_id column');
                  return;
                }
                const parsed = rows.map(row => {
                  const vals = Object.values(row);
                  return {
                    geneId: vals[geneIdCol],
                    geneName: geneNameCol >= 0 ? vals[geneNameCol] : vals[geneIdCol],
                    essentiality: essentialityCol >= 0 ? parseFloat(vals[essentialityCol]) || 0 : 0,
                    flux: fluxCol >= 0 ? parseFloat(vals[fluxCol]) || 0 : 0,
                  };
                }).filter(d => d.geneId);
                if (parsed.length === 0) {
                  setCustomTargetError('No valid gene targets found');
                  return;
                }
                setCustomTargets(parsed);
                setCustomTargetHeaders(headers);
                setCustomTargetRows(rows);
                setCustomTargetError(null);
              }}
              onError={(err) => setCustomTargetError(err)}
            />
            {customTargetError && (
              <p style={{ margin: '6px 0 0', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.CORAL }}>
                {customTargetError}
              </p>
            )}
            {customTargets && customTargets.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.MINT }}>
                    {customTargets.length} custom gene targets loaded — merged with {CRISPRI_TARGETS.length} defaults
                  </span>
                  <button
                    onClick={() => { setCustomTargets(null); setCustomTargetHeaders([]); setCustomTargetRows([]); }}
                    style={{
                      fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xxs)',
                      color: THEME.CORAL, background: 'rgba(250,128,114,0.08)',
                      border: `1px solid rgba(250,128,114,0.2)`,
                      borderRadius: 4, padding: '2px 6px', cursor: 'pointer',
                    }}
                  >
                    Clear
                  </button>
                </div>
                <DataPreview headers={customTargetHeaders} rows={customTargetRows} maxRows={5} />
              </div>
            )}
          </div>

          <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.LABEL, marginBottom: '10px' }}>
            All CRISPRi Targets
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${THEME.BORDER_STRONG}` }}>
                  {['Gene', 'Position', 'Essential', 'KD Eff.', 'sgRNA Score', 'Phenotype', 'Growth ΔΔ'].map(h => (
                    <th key={h} style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: THEME.LABEL, padding: '5px 8px', textAlign: 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fluxBoostedTargets.map((t, i) => {
                  const isSelected = schedule.some(s => s.gene === t.gene);
                  return (
                    <tr key={t.gene} style={{ background: isSelected ? 'rgba(232,163,161,0.10)' : i % 2 === 0 ? 'transparent' : THEME.PANEL_INSET }}>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: THEME.VALUE }}>{t.gene}</td>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: THEME.LABEL }}>{t.position.toLocaleString()}</td>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: t.essential ? THEME.APRICOT : THEME.LABEL }}>{t.essential ? 'YES' : 'no'}</td>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: THEME.VALUE }}>{t.essential ? '—' : `${(t.knockdown_efficiency * 100).toFixed(0)}%`}</td>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: THEME.LABEL }}>{t.essential ? '—' : computeOffTargetScore(sgRNASequences[t.gene] ?? t.gene.toUpperCase().padEnd(20, 'A').slice(0, 20)).toFixed(2)}</td>
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

      {/* ── Multiplex Strategy Tab ────────────────────────────────────── */}
      <ToolTabPanel tabId="multiplex" activeId={activeTab}>
        <MultiplexCRISPRPanel />
      </ToolTabPanel>

      {/* ── Synthetic Genomics Tab ──────────────────────────────────────────── */}
      <ToolTabPanel tabId="synthetic" activeId={activeTab}>
        <SyntheticGenomicsPanel />
      </ToolTabPanel>

      {/* ── Biosafety Tab ────────────────────────────────────────────────────── */}
      <ToolTabPanel tabId="biosafety" activeId={activeTab}>
        <BiosafetyPanel schedule={schedule} />
      </ToolTabPanel>

      {/* ── GEM Reconstruction Tab ───────────────────────────────────────────── */}
      <ToolTabPanel tabId="gem" activeId={activeTab}>
        <GEMReconstructionPanel />
      </ToolTabPanel>
      <NextStepButton currentStepId="genmim" />
    </ToolShell>
  );
});

/* ── Multiplex CRISPR Strategy Panel ──────────────────────────────────── */

function MultiplexCRISPRPanel() {
  const [maxEdits, setMaxEdits] = useState(4);
  const [result, setResult] = useState<import('../../server/multiplexCRISPREngine').MultiplexCRISPRResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { runMultiplexCRISPR } = await import('../../server/multiplexCRISPREngine');
      // Use CRISPRI_TARGETS as gene pool
      const genes = CRISPRI_TARGETS.map((t: CRISPRiTarget) => ({
        geneId: t.gene,
        geneName: t.gene,
        essentiality: t.essential ? 0.8 : 0.2,
        flux: 2.0,
        subsystem: 'central_metabolism',
        maxKnockdown: t.knockdown_efficiency,
      }));
      const res = runMultiplexCRISPR({ genes, maxEdits, minFitness: 0.2, topN: 5 });
      setResult(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Simulation failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [maxEdits]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Controls */}
      <div style={{
        background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 16,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        border: `1px solid ${THEME.BORDER}`,
      }}>
        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Max Edits
        </span>
        <input type="number" min={2} max={8} value={maxEdits}
          onChange={(e) => setMaxEdits(Number(e.target.value))}
          style={{ width: 60, padding: '4px 8px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', outline: 'none' }}
        />
        <button onClick={handleRun} disabled={loading} className="nb-tool-toggle"
          style={{ padding: '6px 14px', fontSize: 'var(--nb-fs-sm)', opacity: loading ? 0.4 : 1 }}
        >
          {loading ? 'Computing...' : 'Design Strategy'}
        </button>
        {result && (
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.4)' }}>
            {result.strategies.length} strategies • {result.epistasisMatrix.length} epistatic pairs
          </span>
        )}
      </div>

      {error && <SimErrorBanner message={error} onRetry={() => setError(null)} />}

      {/* Gene ranking */}
      {result && result.geneRanking.length > 0 && (
        <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12, border: `1px solid ${THEME.BORDER}` }}>
          <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Gene Importance Ranking
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {result.geneRanking.slice(0, 10).map((g, i) => (
              <span key={i} style={{
                padding: '3px 8px', background: g.importance > 0.6 ? 'rgba(147,203,82,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${g.importance > 0.6 ? 'rgba(147,203,82,0.2)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '3px', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                color: g.importance > 0.6 ? 'rgba(147,203,82,0.8)' : 'rgba(255,255,255,0.5)',
              }}>
                {g.geneId} ({g.importance.toFixed(2)})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top strategies */}
      {result && result.strategies.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
          {result.strategies.map((s, i) => (
            <div key={i} style={{
              background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12,
              border: `1px solid ${i === 0 ? 'rgba(221,208,232,0.2)' : THEME.BORDER}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', marginBottom: 6 }}>
                <span style={{ color: i === 0 ? THEME.LILAC : 'rgba(255,255,255,0.6)', fontWeight: i === 0 ? 700 : 400 }}>
                  Strategy {i + 1}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {s.targetGenes.length} edits
                </span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: s.predictedFitness > 0.7 ? 'rgba(147,203,82,0.7)' : 'rgba(250,128,114,0.7)' }}>
                  fitness {s.predictedFitness.toFixed(3)}
                </span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.35)' }}>
                  titer {s.predictedTiterImprovement.toFixed(1)}x
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                {s.targetGenes.map((g, gi) => (
                  <React.Fragment key={gi}>
                    <span style={{
                      padding: '2px 6px', background: s.editTypes[g] === 'knockout' ? 'rgba(250,128,114,0.1)' : 'rgba(200,216,232,0.1)',
                      border: `1px solid ${s.editTypes[g] === 'knockout' ? 'rgba(250,128,114,0.2)' : 'rgba(200,216,232,0.2)'}`,
                      borderRadius: '3px', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.7)',
                    }}>
                      {g} ({s.editTypes[g]})
                    </span>
                    {gi < s.targetGenes.length - 1 && <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 'var(--nb-fs-xs)' }}>+</span>}
                  </React.Fragment>
                ))}
              </div>
              {s.notes.length > 0 && (
                <div style={{ marginTop: 6, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: 'rgba(250,128,114,0.5)' }}>
                  {s.notes.join(' • ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Synthetic Genomics Panel ────────────────────────────────────────────── */

function SyntheticGenomicsPanel() {
  const [host, setHost] = useState<'ecoli' | 'yeast'>('ecoli');
  const [caiResult, setCaiResult] = useState<{ cai: number; optimized: string } | null>(null);
  const [testSequence, setTestSequence] = useState('ATGAAACGCACCAGCAACAGCAACTAA');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { optimizeCodonsForHost, computeCAI } = await import('../../server/syntheticGenomicsEngine');
      const optimized = optimizeCodonsForHost(testSequence, host);
      const cai = computeCAI(optimized, host);
      setCaiResult({ cai, optimized });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Simulation failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [testSequence, host]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 14,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
        border: `1px solid ${THEME.BORDER}`,
      }}>
        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Codon Optimizer
        </span>
        <select value={host} onChange={(e) => setHost(e.target.value as 'ecoli' | 'yeast')}
          style={{ padding: '4px 8px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)' }}
        >
          <option value="ecoli">E. coli (Nakamura 2000)</option>
          <option value="yeast">S. cerevisiae (Nakamura 2000)</option>
        </select>
        <input value={testSequence} onChange={(e) => setTestSequence(e.target.value)} placeholder="ATG..."
          style={{ flex: 1, minWidth: 150, padding: '4px 8px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', outline: 'none' }}
        />
        <button onClick={handleOptimize} disabled={loading} className="nb-tool-toggle"
          style={{ padding: '6px 14px', fontSize: 'var(--nb-fs-sm)', opacity: loading ? 0.4 : 1 }}
        >
          {loading ? 'Optimizing...' : 'Optimize Codons'}
        </button>
      </div>

      {error && <SimErrorBanner message={error} onRetry={() => setError(null)} />}

      {caiResult && (
        <div style={{
          background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 14,
          border: `1px solid ${THEME.BORDER}`,
        }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL }}>CAI</div>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', color: caiResult.cai > 0.8 ? 'rgba(147,203,82,0.8)' : caiResult.cai > 0.5 ? 'rgba(200,216,232,0.8)' : 'rgba(250,128,114,0.8)', fontWeight: 700 }}>
                {caiResult.cai.toFixed(3)}
              </div>
            </div>
          </div>
          <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginBottom: 4 }}>Optimized Sequence</div>
          <div style={{
            fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.6)',
            wordBreak: 'break-all', maxHeight: 60, overflow: 'auto',
            padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px',
          }}>
            {caiResult.optimized}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Biosafety Assessment Panel ────────────────────────────────────────────── */

const BIOSAFETY_BSL_OPTIONS = [
  { value: 'BSL-1', label: 'BSL-1 — Standard microbiological practices' },
  { value: 'BSL-2', label: 'BSL-2 — Limited access, biohazard warning' },
  { value: 'BSL-3', label: 'BSL-3 — Controlled access, respiratory protection' },
  { value: 'BSL-4', label: 'BSL-4 — Maximum containment, positive-pressure suits' },
] as const;

const BIOSAFETY_HOST_OPTIONS = [
  { value: 'ecoli', label: 'E. coli K-12' },
  { value: 'yeast', label: 'S. cerevisiae' },
  { value: 'human', label: 'Human cell line' },
  { value: 'other', label: 'Other' },
] as const;

const BIOSAFETY_PURPOSE_OPTIONS = [
  { value: 'research', label: 'Research' },
  { value: 'production', label: 'Production' },
  { value: 'therapy', label: 'Therapy' },
  { value: 'environmental', label: 'Environmental release' },
] as const;

const BIOSAFETY_CONTAINMENT_OPTIONS = [
  { value: 'standard', label: 'Standard containment' },
  { value: 'enhanced', label: 'Enhanced containment' },
  { value: 'maximum', label: 'Maximum containment' },
] as const;

const RISK_LEVEL_COLORS: Record<string, string> = {
  low: THEME.MINT,
  moderate: THEME.APRICOT,
  elevated: '#fb923c',
  high: THEME.CORAL,
  blocked: '#dc2626',
};

const RISK_LEVEL_LABELS: Record<string, string> = {
  low: 'BSL-1',
  moderate: 'BSL-2',
  elevated: 'BSL-3',
  high: 'BSL-4',
  blocked: 'BLOCKED',
};

const CONTAINMENT_TYPE_LABELS: Record<string, string> = {
  auxotrophic: 'Auxotrophic strain',
  inducible_survival: 'Inducible kill switch',
  compartmentalization: 'Physical containment',
  safe_host: 'Safe host recommendation',
  research_only: 'Research-only mode',
};

function BiosafetyPanel({ schedule }: { schedule: CRISPRiTarget[] }) {
  const [host, setHost] = useState<'ecoli' | 'yeast' | 'human' | 'other'>('ecoli');
  const [purpose, setPurpose] = useState<'research' | 'production' | 'therapy' | 'environmental'>('research');
  const [bslLevel, setBslLevel] = useState<string>('BSL-1');
  const [containmentType, setContainmentType] = useState<string>('standard');
  const [result, setResult] = useState<import('../../modules/biosafety').BiosafetyOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAssess = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { assessBiosafety } = await import('../../modules/biosafety');
      // Build a synthetic DNA sequence from scheduled gene targets
      const geneSequence = schedule.map(t => {
        const seed = t.gene.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
        return generatePseudoSequence(seed, 21);
      }).join('');

      const riskTolerance = bslLevel === 'BSL-1' ? 0.8
        : bslLevel === 'BSL-2' ? 0.6
        : bslLevel === 'BSL-3' ? 0.4
        : 0.2;

      const res = assessBiosafety({
        dnaSequence: geneSequence,
        host,
        purpose,
        mode: purpose === 'production' ? 'production' : 'research',
        riskTolerance,
      });
      setResult(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Simulation failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [schedule, host, purpose, bslLevel]);

  const riskColor = result ? (RISK_LEVEL_COLORS[result.risk.level] ?? THEME.CORAL) : THEME.LABEL;
  const riskLabel = result ? (RISK_LEVEL_LABELS[result.risk.level] ?? result.risk.level) : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px', overflowY: 'auto', flex: 1 }}>
      {error && <SimErrorBanner message={error} onRetry={() => setError(null)} />}
      {/* Parameters */}
      <ParameterPanel title="Biosafety Parameters">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Host Organism
            </label>
            <select value={host} onChange={(e) => setHost(e.target.value as typeof host)}
              style={{ width: '100%', padding: '6px 10px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)' }}
            >
              {BIOSAFETY_HOST_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Purpose
            </label>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value as typeof purpose)}
              style={{ width: '100%', padding: '6px 10px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)' }}
            >
              {BIOSAFETY_PURPOSE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Biosafety Level
            </label>
            <select value={bslLevel} onChange={(e) => setBslLevel(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)' }}
            >
              {BIOSAFETY_BSL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Containment Type
            </label>
            <select value={containmentType} onChange={(e) => setContainmentType(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)' }}
            >
              {BIOSAFETY_CONTAINMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={handleAssess} disabled={loading || schedule.length === 0} className="nb-tool-toggle"
            style={{ padding: '6px 14px', fontSize: 'var(--nb-fs-sm)', opacity: loading ? 0.4 : 1 }}
          >
            {loading ? 'Assessing...' : 'Assess Biosafety'}
          </button>
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL }}>
            {schedule.length} gene targets in schedule
          </span>
        </div>
      </ParameterPanel>

      {/* Results */}
      {result && (
        <>
          {/* Risk overview */}
          <div style={{
            background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 14,
            border: `1px solid ${THEME.BORDER}`,
          }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Risk Assessment
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
              <div style={{
                padding: '8px 16px', borderRadius: 'var(--nb-radius-md)',
                background: `rgba(${hexToRgb(riskColor)}, 0.12)`,
                border: `1px solid rgba(${hexToRgb(riskColor)}, 0.35)`,
              }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginBottom: 2 }}>Risk Level</div>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: riskColor }}>
                  {riskLabel}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL }}>Risk Score</span>
                  <ConfidenceBadge value={1 - result.risk.score} label="Safety" thresholds={{ high: 0.7, low: 0.4 }} />
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, lineHeight: 1.5 }}>
                  {result.risk.reason}
                </div>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginTop: 4 }}>
                  Rule: {result.risk.triggerRule}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{
                padding: '3px 8px', borderRadius: 'var(--nb-radius-sm)',
                background: result.canProceed ? 'rgba(147,203,82,0.12)' : 'rgba(250,128,114,0.12)',
                border: `1px solid ${result.canProceed ? 'rgba(147,203,82,0.3)' : 'rgba(250,128,114,0.3)'}`,
                fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)',
                color: result.canProceed ? 'rgba(147,203,82,0.9)' : 'rgba(250,128,114,0.9)',
              }}>
                {result.canProceed ? 'CAN PROCEED' : 'BLOCKED'}
              </span>
              {result.requiresHumanReview && (
                <span style={{
                  padding: '3px 8px', borderRadius: 'var(--nb-radius-sm)',
                  background: 'rgba(232,220,200,0.12)', border: '1px solid rgba(180,150,100,0.3)',
                  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: 'rgba(232,220,200,0.8)',
                }}>
                  HUMAN REVIEW REQUIRED
                </span>
              )}
            </div>
          </div>

          {/* Containment recommendations */}
          {result.containment.length > 0 && (
            <div style={{
              background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 14,
              border: `1px solid ${THEME.BORDER}`,
            }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Containment Recommendations
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.containment.map((c, i) => (
                  <div key={i} style={{
                    padding: '8px 12px', borderRadius: 'var(--nb-radius-sm)',
                    background: 'rgba(200,216,232,0.06)', border: `1px solid ${THEME.BORDER}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', fontWeight: 700,
                        color: THEME.SKY, textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        {CONTAINMENT_TYPE_LABELS[c.type] ?? c.type}
                      </span>
                      <ConfidenceBadge value={c.confidence} thresholds={{ high: 0.8, low: 0.5 }} />
                    </div>
                    <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, lineHeight: 1.5 }}>
                      {c.description}
                    </div>
                    {c.reference && (
                      <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginTop: 4 }}>
                        Ref: {c.reference}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sequence matches */}
          {result.matches.length > 0 && (
            <div style={{
              background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 14,
              border: `1px solid ${THEME.BORDER}`,
            }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Sequence Hazard Matches ({result.matches.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.matches.map((m, i) => (
                  <div key={i} style={{
                    padding: '6px 10px', borderRadius: 'var(--nb-radius-sm)',
                    background: 'rgba(250,128,114,0.06)', border: '1px solid rgba(250,128,114,0.15)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.CORAL, fontWeight: 700, minWidth: 60 }}>
                      {m.source}
                    </span>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE, flex: 1 }}>
                      {m.matchName}
                    </span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL }}>
                      score: {m.score.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disposal protocol */}
          <div style={{
            background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 14,
            border: `1px solid ${THEME.BORDER}`,
          }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Disposal Protocol
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, lineHeight: 1.6 }}>
              {result.risk.level === 'blocked' ? (
                'Construct is BLOCKED. All materials must be autoclaved at 121 C for 30 min. Document destruction per institutional EHS protocol. Notify biosafety officer immediately.'
              ) : result.risk.level === 'high' ? (
                'High-risk construct. Autoclave all biological waste. Decontaminate work surfaces with 10% bleach. Double-bag all solid waste. Follow BSL-4 disposal procedures.'
              ) : result.risk.level === 'elevated' ? (
                'Elevated risk. Autoclave biological waste at 121 C. Decontaminate with 70% ethanol. Follow BSL-3 waste management guidelines.'
              ) : result.risk.level === 'moderate' ? (
                'Moderate risk. Standard biological waste disposal. Autoclave before disposal. Follow BSL-2 waste protocols.'
              ) : (
                'Low risk. Standard microbiological waste disposal. Autoclave or chemical inactivation per institutional guidelines. Follow BSL-1 protocols.'
              )}
            </div>
          </div>

          {/* Design notes */}
          <div style={{
            background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 14,
            border: `1px solid ${THEME.BORDER}`,
          }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Assessment Notes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {result.designNotes.map((note, i) => (
                <div key={i} style={{
                  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL,
                  padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px',
                }}>
                  {note}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && schedule.length === 0 && (
        <div style={{
          padding: '24px', textAlign: 'center',
          background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)',
          border: `1px solid ${THEME.BORDER}`,
        }}>
          <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.LABEL }}>
            No gene targets in schedule. Configure CRISPRi targets in the Genome Map tab first.
          </div>
        </div>
      )}
    </div>
  );
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

/* ── Default E. coli K-12 gene annotations for GEM demo ─────────────────── */

const DEFAULT_ANNOTATIONS = [
  // Glycolysis
  { geneId: 'b2388', ecNumber: '2.7.1.1', geneName: 'glk', organism: 'E. coli K-12' },
  { geneId: 'b4025', ecNumber: '5.3.1.9', geneName: 'pgi', organism: 'E. coli K-12' },
  { geneId: 'b3916', ecNumber: '2.7.1.11', geneName: 'pfkA', organism: 'E. coli K-12' },
  { geneId: 'b2925', ecNumber: '4.1.2.13', geneName: 'fbaA', organism: 'E. coli K-12' },
  { geneId: 'b3919', ecNumber: '5.3.1.1', geneName: 'tpiA', organism: 'E. coli K-12' },
  { geneId: 'b1779', ecNumber: '1.2.1.12', geneName: 'gapA', organism: 'E. coli K-12' },
  { geneId: 'b2926', ecNumber: '2.7.2.3', geneName: 'pgk', organism: 'E. coli K-12' },
  { geneId: 'b3612', ecNumber: '5.4.2.12', geneName: 'gpmA', organism: 'E. coli K-12' },
  { geneId: 'b2779', ecNumber: '4.2.1.11', geneName: 'eno', organism: 'E. coli K-12' },
  { geneId: 'b1854', ecNumber: '2.7.1.40', geneName: 'pykF', organism: 'E. coli K-12' },
  // TCA Cycle
  { geneId: 'b0720', ecNumber: '2.3.3.1', geneName: 'gltA', organism: 'E. coli K-12' },
  { geneId: 'b0118', ecNumber: '4.2.1.3', geneName: 'acnA', organism: 'E. coli K-12' },
  { geneId: 'b1136', ecNumber: '1.1.1.41', geneName: 'icd', organism: 'E. coli K-12' },
  { geneId: 'b0116', ecNumber: '1.2.4.2', geneName: 'sucA', organism: 'E. coli K-12' },
  { geneId: 'b0729', ecNumber: '6.2.1.5', geneName: 'sucC', organism: 'E. coli K-12' },
  { geneId: 'b4154', ecNumber: '1.3.5.1', geneName: 'sdhA', organism: 'E. coli K-12' },
  { geneId: 'b1612', ecNumber: '4.2.1.2', geneName: 'fumA', organism: 'E. coli K-12' },
  { geneId: 'b3236', ecNumber: '1.1.1.37', geneName: 'mdh', organism: 'E. coli K-12' },
  // Pentose Phosphate Pathway
  { geneId: 'b1852', ecNumber: '1.1.1.49', geneName: 'zwf', organism: 'E. coli K-12' },
  { geneId: 'b0767', ecNumber: '3.1.1.31', geneName: 'pgl', organism: 'E. coli K-12' },
  { geneId: 'b2029', ecNumber: '1.1.1.44', geneName: 'gnd', organism: 'E. coli K-12' },
  { geneId: 'b3386', ecNumber: '5.1.3.1', geneName: 'rpe', organism: 'E. coli K-12' },
  { geneId: 'b2914', ecNumber: '5.3.1.6', geneName: 'rpiA', organism: 'E. coli K-12' },
  { geneId: 'b2465', ecNumber: '2.2.1.1', geneName: 'tktA', organism: 'E. coli K-12' },
  { geneId: 'b2464', ecNumber: '2.2.1.2', geneName: 'talB', organism: 'E. coli K-12' },
  // Amino Acid Biosynthesis (selected)
  { geneId: 'b4053', ecNumber: '2.6.1.2', geneName: 'avtA', organism: 'E. coli K-12' },
  { geneId: 'b3744', ecNumber: '6.3.5.4', geneName: 'asnB', organism: 'E. coli K-12' },
  { geneId: 'b3213', ecNumber: '6.3.1.2', geneName: 'glnA', organism: 'E. coli K-12' },
  { geneId: 'b2551', ecNumber: '2.7.1.39', geneName: 'thrB', organism: 'E. coli K-12' },
  { geneId: 'b0002', ecNumber: '4.2.3.1', geneName: 'thrC', organism: 'E. coli K-12' },
  { geneId: 'b1260', ecNumber: '2.7.2.4', geneName: 'lysC', organism: 'E. coli K-12' },
  { geneId: 'b3433', ecNumber: '1.2.1.11', geneName: 'asd', organism: 'E. coli K-12' },
  // Nucleotide Biosynthesis (selected)
  { geneId: 'b1131', ecNumber: '6.3.4.13', geneName: 'purD', organism: 'E. coli K-12' },
  { geneId: 'b2508', ecNumber: '6.3.5.2', geneName: 'guaA', organism: 'E. coli K-12' },
  { geneId: 'b0523', ecNumber: '2.7.4.6', geneName: 'ndk', organism: 'E. coli K-12' },
  { geneId: 'b1064', ecNumber: '6.3.4.2', geneName: 'pyrG', organism: 'E. coli K-12' },
  // Cofactor Biosynthesis (selected)
  { geneId: 'b1740', ecNumber: '6.3.1.5', geneName: 'nadE', organism: 'E. coli K-12' },
  { geneId: 'b1147', ecNumber: '2.7.7.3', geneName: 'coaD', organism: 'E. coli K-12' },
  // Fatty Acid Biosynthesis (selected)
  { geneId: 'b3256', ecNumber: '6.4.1.2', geneName: 'accC', organism: 'E. coli K-12' },
  { geneId: 'b1093', ecNumber: '2.3.1.39', geneName: 'fabD', organism: 'E. coli K-12' },
  // Transport (selected)
  { geneId: 'b1101', ecNumber: '2.7.1.69', geneName: 'ptsG', organism: 'E. coli K-12' },
  { geneId: 'b3540', ecNumber: '7.5.2.1', geneName: 'malK', organism: 'E. coli K-12' },
];

/* ── GEM Reconstruction Panel ───────────────────────────────────────────── */

function GEMReconstructionPanel() {
  const [organism, setOrganism] = useState('E. coli K-12');
  const [gapFill, setGapFill] = useState(true);
  const [includeBiomass, setIncludeBiomass] = useState(true);
  const [result, setResult] = useState<import('../../modules/gem-automation').GEMOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReconstruct = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { automateGEM } = await import('../../modules/gem-automation');
      const res = automateGEM({
        annotations: DEFAULT_ANNOTATIONS,
        organism,
        gapFill,
        includeBiomass,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'GEM reconstruction failed');
    } finally {
      setLoading(false);
    }
  }, [organism, gapFill, includeBiomass]);

  const gapConfidence = result
    ? result.gapFilling.addedReactions.length > 0
      ? Math.max(0.5, 1 - result.gapFilling.addedReactions.length * 0.1)
      : 1
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px', overflowY: 'auto', flex: 1 }}>
      {/* Parameters */}
      <ParameterPanel title="GEM Parameters">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Organism
            </label>
            <select
              value={organism}
              onChange={(e) => setOrganism(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)' }}
            >
              <option value="E. coli K-12">E. coli K-12</option>
              <option value="S. cerevisiae">S. cerevisiae</option>
              <option value="B. subtilis">B. subtilis</option>
              <option value="Corynebacterium glutamicum">C. glutamicum</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Biomass Formula
            </label>
            <div style={{
              padding: '6px 10px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`,
              borderRadius: 'var(--nb-radius-sm)', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE,
            }}>
              Auto-derived from annotations
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Media Composition
            </label>
            <div style={{
              padding: '6px 10px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`,
              borderRadius: 'var(--nb-radius-sm)', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE,
            }}>
              M9 minimal + exchange reactions
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setGapFill(!gapFill)}
            className={`nb-tool-toggle${gapFill ? ' nb-tool-toggle--active' : ''}`}
            aria-pressed={gapFill}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '7px 10px', borderRadius: 'var(--nb-radius-sm)',
              fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: gapFill ? THEME.MINT : 'transparent', border: `1px solid ${THEME.MINT}`, flexShrink: 0 }} />
            Gap-filling
          </button>
          <button
            onClick={() => setIncludeBiomass(!includeBiomass)}
            className={`nb-tool-toggle${includeBiomass ? ' nb-tool-toggle--active' : ''}`}
            aria-pressed={includeBiomass}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '7px 10px', borderRadius: 'var(--nb-radius-sm)',
              fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: includeBiomass ? THEME.MINT : 'transparent', border: `1px solid ${THEME.MINT}`, flexShrink: 0 }} />
            Biomass reaction
          </button>
          <button onClick={handleReconstruct} disabled={loading} className="nb-tool-toggle"
            style={{ padding: '6px 14px', fontSize: 'var(--nb-fs-sm)', opacity: loading ? 0.4 : 1 }}
          >
            {loading ? 'Reconstructing...' : 'Reconstruct GEM'}
          </button>
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL }}>
            {DEFAULT_ANNOTATIONS.length} gene annotations loaded
          </span>
        </div>
      </ParameterPanel>

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--nb-radius-md)',
          background: 'rgba(250,128,114,0.12)', border: '1px solid rgba(250,128,114,0.35)',
          fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.CORAL,
        }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary metrics */}
          <ResultSummaryPanel
            metrics={[
              { label: 'Reactions', value: result.stats.nReactions, accent: THEME.SKY },
              { label: 'Metabolites', value: result.stats.nMetabolites, accent: THEME.LILAC },
              { label: 'Genes', value: result.stats.nGenes, accent: THEME.APRICOT },
              { label: 'Gaps Filled', value: result.stats.nGapFilled, accent: THEME.MINT },
              { label: 'Essential', value: result.stats.nEssential, accent: THEME.CORAL },
            ]}
            actions={<ConfidenceBadge value={gapConfidence} label="Gap confidence" />}
          />

          {/* Subsystem breakdown */}
          <div style={{
            background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 14,
            border: `1px solid ${THEME.BORDER}`,
          }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Subsystem Breakdown
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {(() => {
                const subsystems = new Map<string, number>();
                for (const rxn of result.model.reactions) {
                  subsystems.set(rxn.subsystem, (subsystems.get(rxn.subsystem) ?? 0) + 1);
                }
                return Array.from(subsystems.entries()).sort((a, b) => b[1] - a[1]).map(([sub, count]) => (
                  <div key={sub} style={{
                    padding: '8px 10px', borderRadius: 'var(--nb-radius-sm)',
                    background: THEME.PANEL_INSET, border: `1px solid ${THEME.BORDER}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sub}
                    </span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.MINT, fontWeight: 700, marginLeft: 8, flexShrink: 0 }}>
                      {count}
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Gap-filling details */}
          <div style={{
            background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 14,
            border: `1px solid ${THEME.BORDER}`,
          }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Gap-Filling Report
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE }}>
                {result.gapFilling.addedReactions.length} reactions added
              </span>
              <ConfidenceBadge value={gapConfidence} thresholds={{ high: 0.8, low: 0.5 }} />
            </div>
            {result.gapFilling.reason.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {result.gapFilling.reason.map((reason, i) => (
                  <div key={i} style={{
                    fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL,
                    padding: '4px 8px', background: 'rgba(191,220,205,0.06)', borderRadius: '3px',
                    borderLeft: `2px solid ${THEME.MINT}`,
                  }}>
                    {reason}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.LABEL }}>
                No gaps detected — model is complete.
              </div>
            )}
          </div>

          {/* Essential genes */}
          {result.essentialGenes.length > 0 && (
            <div style={{
              background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 14,
              border: `1px solid ${THEME.BORDER}`,
            }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Essential Genes ({result.essentialGenes.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                {result.essentialGenes.map((g, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 10px', borderRadius: 'var(--nb-radius-sm)',
                    background: 'rgba(232,163,161,0.06)', border: '1px solid rgba(232,163,161,0.15)',
                  }}>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.CORAL, fontWeight: 700, minWidth: 60 }}>
                      {g.geneId}
                    </span>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE, flex: 1 }}>
                      {g.reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Design notes */}
          <div style={{
            background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 14,
            border: `1px solid ${THEME.BORDER}`,
          }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Reconstruction Notes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {result.designNotes.map((note, i) => (
                <div key={i} style={{
                  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL,
                  padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px',
                }}>
                  {note}
                </div>
              ))}
            </div>
          </div>

          {/* Reaction table (top 20) */}
          <div style={{
            background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 14,
            border: `1px solid ${THEME.BORDER}`,
          }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Model Reactions (top 20 of {result.model.reactions.length})
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${THEME.BORDER_STRONG}` }}>
                    {['ID', 'Name', 'Subsystem', 'EC', 'Rev.'].map(h => (
                      <th key={h} style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: THEME.LABEL, padding: '5px 8px', textAlign: 'left' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.model.reactions.slice(0, 20).map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? 'transparent' : THEME.PANEL_INSET }}>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: THEME.MINT }}>{r.id}</td>
                      <td style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: THEME.VALUE }}>{r.name}</td>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: THEME.LABEL }}>{r.subsystem}</td>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: THEME.LABEL }}>{r.ecNumber || '—'}</td>
                      <td style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '4px 8px', color: r.reversible ? THEME.MINT : THEME.LABEL }}>{r.reversible ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div style={{
          padding: '32px', textAlign: 'center',
          background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)',
          border: `1px solid ${THEME.BORDER}`,
        }}>
          <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.LABEL, marginBottom: 8 }}>
            Reconstruct a genome-scale metabolic model from gene annotations.
          </div>
          <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.DIM }}>
            {DEFAULT_ANNOTATIONS.length} E. coli K-12 annotations loaded across glycolysis, TCA, PPP, amino acid, nucleotide, cofactor, fatty acid, and transport subsystems.
          </div>
        </div>
      )}
    </div>
  );
}
