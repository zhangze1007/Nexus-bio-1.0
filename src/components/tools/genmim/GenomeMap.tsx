"use client";
import { motion } from "framer-motion";
import React from "react";
import { THEME } from "../../../theme";
import type { CRISPRiTarget } from "../../../types";
import { PAPER_THEME } from "../../charts/chartTheme";
import { SVGChartContainer } from "../../charts/primitives";
import FloatingControlRail from "../shared/FloatingControlRail";
import InlineMetricOverlay from "../shared/InlineMetricOverlay";
import ScientificFigureFrame from "../shared/ScientificFigureFrame";
import WorkbenchRangeSlider from "../shared/WorkbenchRangeSlider";

/**
 * IGV-style linear genome map with horizontal arrow gene bodies.
 *
 * Genes are rendered as directional arrows on a linear chromosome:
 * - Forward strand (+): arrows pointing right →
 * - Reverse strand (-): arrows pointing left ←
 * - Color-coded by status: essential (coral), below threshold (apricot), candidate (mint)
 */
export function GenomeMap({
  targets,
  selected,
  efficiencyThreshold,
}: {
  targets: CRISPRiTarget[];
  selected: CRISPRiTarget[];
  efficiencyThreshold: number;
}) {
  const W = 700,
    H = 280;
  const PAD = { top: 50, right: 30, bottom: 40, left: 50 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const GENOME_KB = 4641;
  const GENE_KB = 80;

  const selectedIds = new Set(selected.map((t) => t.gene));
  const growthImpact = selected.reduce((a, t) => a + (t.growth_impact ?? 0), 0);
  const viability = Math.max(0, Math.round((1 + growthImpact) * 100));

  // Scale: kb → x position
  const xScale = (kb: number) => PAD.left + (kb / GENOME_KB) * innerW;

  function geneColor(t: CRISPRiTarget): string {
    if (selectedIds.has(t.gene)) return "rgba(175,195,214,0.6)";
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
    { color: THEME.CORAL, label: "Essential" },
    { color: THEME.APRICOT, label: "Below threshold" },
    { color: THEME.MINT, label: "Candidate" },
    { color: "rgba(175,195,214,0.6)", label: "Suppressed" },
  ];

  return (
    <SVGChartContainer W={W} H={H} ariaLabel="IGV-style E. coli genome map" variant="paper">
      {/* Title */}
      <text
        x={PAD.left}
        y={22}
        fontFamily={PAPER_THEME.tickFont}
        fontSize="10"
        fill={PAPER_THEME.tickColor}
        letterSpacing="0.08em"
      >
        E. COLI K-12 · 4.64 Mb · IGV STYLE
      </text>
      <text x={PAD.left} y={38} fontFamily={THEME.SANS} fontSize="11" fill={PAPER_THEME.labelColor}>
        CRISPRi target landscape — horizontal arrow gene bodies
      </text>

      {/* Chromosome ideogram (thin line) */}
      <line
        x1={PAD.left}
        y1={PAD.top + innerH / 2}
        x2={PAD.left + innerW}
        y2={PAD.top + innerH / 2}
        stroke={PAPER_THEME.axis}
        strokeWidth={2}
      />

      {/* Tick marks and labels */}
      {[0, 1000, 2000, 3000, 4000, 4641].map((kb) => {
        const x = xScale(kb);
        return (
          <g key={kb}>
            <line
              x1={x}
              y1={PAD.top + innerH / 2 - 4}
              x2={x}
              y2={PAD.top + innerH / 2 + 4}
              stroke={PAPER_THEME.grid}
              strokeWidth={1}
            />
            <text
              x={x}
              y={PAD.top + innerH + 16}
              textAnchor="middle"
              fontFamily={THEME.MONO}
              fontSize="9"
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
              stroke={prominent ? PAPER_THEME.axis : "none"}
              strokeWidth={prominent ? 0.8 : 0}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: selectedIds.has(t.gene) ? 0.9 : 0.75, x: 0 }}
              transition={{ duration: 0.4, delay: i * 0.03 }}
            />
            {/* Gene label */}
            <text
              x={xScale(t.position + GENE_KB / 2)}
              y={y - 4}
              textAnchor="middle"
              fontFamily={THEME.MONO}
              fontSize="8"
              fill={PAPER_THEME.labelColor}
              style={{ paintOrder: "stroke", stroke: PAPER_THEME.bg, strokeWidth: 2 }}
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
            x={x}
            y={y}
            width={w}
            height={barH}
            fill={t.knockdown_efficiency >= efficiencyThreshold ? "rgba(147,203,82,0.4)" : "rgba(232,200,200,0.3)"}
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
        <text
          y={14}
          fontFamily={THEME.MONO}
          fontSize="16"
          fill={viability > 70 ? THEME.MINT : viability > 40 ? THEME.APRICOT : THEME.CORAL}
          textAnchor="end"
          fontWeight={700}
        >
          {viability}%
        </text>
      </g>
    </SVGChartContainer>
  );
}

/** Wrapper for the Genome Map tab: control rail + figure frame + inline metrics */
export function GenomeMapView({
  targets,
  schedule,
  efficiency,
  maxTargets,
  protectEssential,
  avgEfficiency,
  growthImpact,
  offTargetRisk,
  recommendedTargets,
  recommendedEfficiency,
  onEfficiencyChange,
  onMaxTargetsChange,
  onToggleProtect,
}: {
  targets: CRISPRiTarget[];
  schedule: CRISPRiTarget[];
  efficiency: number;
  maxTargets: number;
  protectEssential: boolean;
  avgEfficiency: number;
  growthImpact: number;
  offTargetRisk: number;
  recommendedTargets: number;
  recommendedEfficiency: number;
  onEfficiencyChange: (v: number) => void;
  onMaxTargetsChange: (v: number) => void;
  onToggleProtect: () => void;
}) {
  const figureMeta = {
    eyebrow: "Genome minimization map",
    title: "CRISPRi target landscape, selected schedule, and viability ledger are read as one chassis figure",
    caption:
      "The page now treats chassis minimization as a genome-scale scientific figure rather than a parameter form, so suppression logic, viability, and target evidence stay in one reading surface.",
  };

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <FloatingControlRail label="CRISPRi Parameters" defaultCollapsed={false}>
        <WorkbenchRangeSlider
          label="Min. knockdown efficiency"
          value={efficiency}
          min={0.5}
          max={1.0}
          step={0.01}
          formatValue={(v) => `${(v * 100).toFixed(0)}%`}
          onChange={onEfficiencyChange}
        />
        <WorkbenchRangeSlider
          label="Max targets"
          value={maxTargets}
          min={1}
          max={15}
          step={1}
          formatValue={(v) => `${v}`}
          onChange={(v) => onMaxTargetsChange(v as number)}
        />

        <button
          onClick={onToggleProtect}
          className={`nb-tool-toggle${protectEssential ? " nb-tool-toggle--active" : ""}`}
          aria-pressed={protectEssential}
          aria-label="Toggle protect essential genes"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
            padding: "7px 10px",
            marginBottom: "16px",
            borderRadius: "var(--nb-radius-sm)",
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-sm)",
            textAlign: "left",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: protectEssential ? THEME.APRICOT : "transparent",
              border: `1px solid ${THEME.APRICOT}`,
              flexShrink: 0,
            }}
          />
          Protect essential genes
        </button>
      </FloatingControlRail>

      <div
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          padding: "12px",
        }}
      >
        <ScientificFigureFrame
          eyebrow={figureMeta.eyebrow}
          title={figureMeta.title}
          caption={figureMeta.caption}
          legend={[
            { label: "Targets", value: `${schedule.length}`, accent: THEME.CORAL },
            { label: "Protection", value: protectEssential ? "Essential on" : "Aggressive", accent: THEME.APRICOT },
            { label: "Avg KD", value: `${(avgEfficiency * 100).toFixed(1)}%`, accent: THEME.MINT },
            { label: "Growth", value: `${(growthImpact * 100).toFixed(1)}%`, accent: THEME.SKY },
          ]}
          footer={
            <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL }}>
              baseline {recommendedTargets} targets · {(recommendedEfficiency * 100).toFixed(0)}% KD · off-target{" "}
              {(offTargetRisk * 100).toFixed(0)}%
            </div>
          }
          minHeight="100%"
        >
          <GenomeMap targets={targets} selected={schedule} efficiencyThreshold={efficiency} />
        </ScientificFigureFrame>

        <InlineMetricOverlay
          position="top-right"
          metrics={[
            { label: "Targets", value: `${schedule.length}`, accent: THEME.CORAL },
            { label: "Avg KD", value: `${(avgEfficiency * 100).toFixed(1)}%`, accent: THEME.SKY },
            {
              label: "Growth",
              value: `${(growthImpact * 100).toFixed(1)}%`,
              accent: Math.abs(growthImpact) > 0.4 ? THEME.CORAL : THEME.MINT,
            },
          ]}
        />
      </div>
    </div>
  );
}
