'use client';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { computeConvexHull, expandHull } from '../../utils/vizUtils';
import { SVGChartContainer, ChartGrid, ChartAxisLabels, ChartLegend } from '../charts/primitives';
import { PAPER_THEME, SCI_PASTEL_MUTED, SCI_SERIES } from '../charts/chartTheme';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import ActionButton from './shared/ActionButton';
import WorkbenchRangeSlider from './shared/WorkbenchRangeSlider';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import DataTable from '../ide/shared/DataTable';
import type { TableColumn } from '../ide/shared/DataTable';
import { OMICS_DATA } from '../../data/mockMultiO';
import { OmicsFoundationModel } from '../../services/OmicsIntegrator';
import {
  extractMOFAFactors,
  predictPerturbation as vaePredictPerturbation,
  computeMetabolicEfficiency,
  exportEmbeddingsWithEfficiency,
  computePCABiplot,
} from '../../services/MOIEngine';
import type {
  MOFAResult,
  VAETrainingResult,
  VAEPerturbationPrediction,
  MetabolicEfficiencyScore,
} from '../../services/MOIEngine';
import { runMOFA } from '../../server/mofaPlus';
import type { MOFAResult as MOFAPlusResultType } from '../../server/mofaPlus';
import type {
  OmicsRow,
  OmicsLayer,
  EmbeddingPoint,
  BottleneckSignal,
  PerturbationResult,
  InternalThought,
} from '../../types';
import type { ProvenanceEntry } from '../../types/assumptions';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { useUIStore } from '../../store/uiStore';
import { useVAEWorker } from '../../hooks/useVAEWorker';
import { createProvenanceEntry } from '../../utils/provenance';
import ScientificHero from './shared/ScientificHero';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import ToolShell from './shared/ToolShell';
import ToolTabBar, { type ToolTab } from './shared/ToolTabBar';
import ToolTabPanel from './shared/ToolTabPanel';
import FloatingControlRail from './shared/FloatingControlRail';
import InlineMetricOverlay from './shared/InlineMetricOverlay';

/* ── Design Tokens ────────────────────────────────────────────────── */

const LAYER_COLORS: Record<OmicsLayer, string> = {
  transcriptomics: THEME.LILAC,   // lilac
  proteomics:      THEME.SKY,     // sky
  metabolomics:    THEME.CORAL,   // coral
};

import { toolTokens } from '../../hooks/useToolTheme';
import { THEME, TOOL_RESULT_PALETTE } from '../../theme';
const { panelBg: PANEL_BG, border: BORDER, label: LABEL, value: VALUE,
        inputBg: INPUT_BG, inputBorder: INPUT_BORDER, inputText: INPUT_TEXT,
        glass: GLASS } = toolTokens;

const MULTIO_TABS: ToolTab[] = [
  { id: 'embedding', label: 'Embedding', accent: THEME.SKY },
  { id: 'volcano', label: 'Volcano', accent: THEME.LILAC },
  { id: 'factors', label: 'Factors', accent: THEME.APRICOT },
  { id: 'mofaplus', label: 'MOFA+', accent: THEME.MINT },
  { id: 'projection', label: 'Projection', accent: THEME.MINT },
  { id: 'efficiency', label: 'Efficiency', accent: THEME.CORAL },
];

function canonicalGeneToken(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function findPreferredGene(candidates: string[]) {
  const availableGenes = OMICS_DATA.map((row) => row.gene);
  const availableTokens = new Map(availableGenes.map((gene) => [canonicalGeneToken(gene), gene]));
  for (const candidate of candidates) {
    const token = canonicalGeneToken(candidate);
    if (!token) continue;
    const exact = availableTokens.get(token);
    if (exact) return exact;
    const partial = availableGenes.find((gene) => token.includes(canonicalGeneToken(gene)) || canonicalGeneToken(gene).includes(token));
    if (partial) return partial;
  }
  return availableGenes[0] ?? '';
}

/* ── VolcanoPlot (preserved) ──────────────────────────────────────── */

function VolcanoPlot({ data, fcThreshold, pvThreshold, highlightedGene }: {
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

/* ── DataTable COLUMNS (preserved) ────────────────────────────────── */

const COLUMNS: TableColumn<OmicsRow>[] = [
  { key: 'gene',        header: 'Gene',        width: 80  },
  { key: 'transcript',  header: 'RNA',         width: 55, render: v => typeof v === 'number' ? v.toFixed(1) : '—' },
  { key: 'protein',     header: 'Prot.',       width: 55, render: v => typeof v === 'number' ? v.toFixed(1) : '—' },
  { key: 'metabolite',  header: 'Met.',        width: 55, render: v => typeof v === 'number' ? v.toFixed(1) : '—' },
  { key: 'fold_change', header: 'FC',          width: 55, render: v => typeof v === 'number'
    ? <span style={{ color: (v as number) > 0 ? 'rgba(147,203,82,0.85)' : 'rgba(250,128,114,0.8)', fontFamily: "'JetBrains Mono',monospace", fontSize: 'var(--nb-fs-xs)' }}>
        {(v as number) > 0 ? '+' : ''}{(v as number).toFixed(2)}
      </span>
    : '—'
  },
  { key: 'pValue',      header: 'p-val',       width: 60, render: v => typeof v === 'number'
    ? <span style={{ color: (v as number) < 0.05 ? 'rgba(255,139,31,0.85)' : PAPER_THEME.tickColor, fontFamily: "'JetBrains Mono',monospace", fontSize: 'var(--nb-fs-xs)' }}>
        {(v as number).toFixed(3)}
      </span>
    : '—'
  },
];

/* ── Shared helpers for tri-panel ────────────────────────────────── */

const CLUSTER_PAL = SCI_SERIES.slice(0, 8);

function divergingColor(t: number): string {
  const n = (t + 1) / 2;
  if (n < 0.5) {
    const f = n * 2;
    return `rgb(${Math.round(33+(247-33)*f)},${Math.round(102+(247-102)*f)},${Math.round(172+(247-172)*f)})`;
  }
  const f = (n - 0.5) * 2;
  return `rgb(${Math.round(247+(214-247)*f)},${Math.round(247+(96-247)*f)},${Math.round(247+(77-247)*f)})`;
}

function pearsonR(v1: number[], v2: number[]): number {
  const n = v1.length;
  if (n === 0) return 0;
  const m1 = v1.reduce((a, b) => a + b, 0) / n;
  const m2 = v2.reduce((a, b) => a + b, 0) / n;
  const num = v1.reduce((s, x, i) => s + (x - m1) * (v2[i] - m2), 0);
  const d1 = Math.sqrt(v1.reduce((s, x) => s + (x - m1) ** 2, 0));
  const d2 = Math.sqrt(v2.reduce((s, x) => s + (x - m2) ** 2, 0));
  return d1 === 0 || d2 === 0 ? 0 : num / (d1 * d2);
}

/* ── Tri-Panel Embedding: PCA biplot + correlation heatmap + volcano ─ */

function TriPanelEmbedding({ embeddings, data, fcThreshold, pvThreshold, activeLayers, highlightedGene }: {
  embeddings: EmbeddingPoint[];
  data: OmicsRow[];
  fcThreshold: number;
  pvThreshold: number;
  activeLayers: Record<OmicsLayer, boolean>;
  highlightedGene?: string;
}) {
  // ── PCA Biplot (left) ──────────────────────────────────────────────
  const pcaW = 280, pcaH = 320, pcaPAD = 36;
  const visible = embeddings.filter(p => activeLayers[p.layer]);

  // Real PCA from eigenvectors (MOIEngine.computePCABiplot)
  const pcaResult = useMemo(() => computePCABiplot(data), [data]);

  // Gene→index map for correct score lookup (visible has 3 entries/gene, scores has 1)
  const geneIdxMap = useMemo(() => {
    const m = new Map<string, number>();
    data.forEach((g, i) => m.set(g.gene, i));
    return m;
  }, [data]);

  // Gabriel biplot scaling: loadings × sqrt(λ), scores / max, shared coordinate system
  const { pcaProjected, loadingArrows } = useMemo(() => {
    const ev = pcaResult.eigenvalues;
    const totalVar = ev.reduce((s, v) => s + v, 0);
    const pct = (v: number) => totalVar > 0 ? ((v / totalVar) * 100).toFixed(1) : '0.0';
    const labels = ['Transcriptomics', 'Proteomics', 'Metabolomics'];

    // Scale loadings by sqrt(eigenvalue) — standard biplot scaling
    const sqrtEv0 = Math.sqrt(Math.max(0, ev[0] ?? 0));
    const sqrtEv1 = Math.sqrt(Math.max(0, ev[1] ?? 0));
    const rawLoadings = labels.map((label, varIdx) => ({
      label,
      pc1: (pcaResult.loadings[0]?.[varIdx] ?? 0) * sqrtEv0,
      pc2: (pcaResult.loadings[1]?.[varIdx] ?? 0) * sqrtEv1,
    }));

    // Compute shared scale: find max extent of both scores and scaled loadings
    const scores = pcaResult.scores;
    const scoreXs = scores.map(s => Math.abs(s[0] ?? 0));
    const scoreYs = scores.map(s => Math.abs(s[1] ?? 0));
    const loadXs = rawLoadings.map(l => Math.abs(l.pc1));
    const loadYs = rawLoadings.map(l => Math.abs(l.pc2));
    const maxScore = Math.max(...scoreXs, ...scoreYs, 1e-10);
    const maxLoad = Math.max(...loadXs, ...loadYs, 1e-10);
    const plotExtent = Math.min(pcaW, pcaH) / 2 - pcaPAD - 10;
    // Uniform scale so both scores and loadings fit within plotExtent
    const scoreScale = plotExtent / maxScore;
    const loadScale = plotExtent / maxLoad;

    // Project scores using gene→index map (fixes index misalignment with 3-per-gene visible)
    const projected = visible.map(p => {
      const idx = geneIdxMap.get(p.gene) ?? -1;
      const sc = idx >= 0 ? scores[idx] : undefined;
      return {
        ...p,
        sx: pcaPAD + ((sc?.[0] ?? 0) * scoreScale + plotExtent),
        sy: pcaPAD + (plotExtent - (sc?.[1] ?? 0) * scoreScale),
      };
    });

    // Scale loading arrows preserving relative magnitudes
    const arrows = rawLoadings.map(a => ({
      ...a,
      x: a.pc1 * loadScale,
      y: a.pc2 * loadScale,
    }));

    return {
      pcaProjected: projected,
      loadingArrows: {
        pc1Pct: pct(ev[0] ?? 0),
        pc2Pct: pct(ev[1] ?? 0),
        arrows,
      },
    };
  }, [visible, pcaResult, geneIdxMap]);

  // Layer color map (use cluster palette)
  const layerColorMap: Record<OmicsLayer, string> = {
    transcriptomics: CLUSTER_PAL[0],
    proteomics:      CLUSTER_PAL[1],
    metabolomics:    CLUSTER_PAL[2],
  };

  const cx = pcaW / 2, cy = pcaH / 2;

  // ── Correlation Heatmap (center) ───────────────────────────────────
  const N_GENES = 20;
  const hmW = 300, hmH = 320, hmPAD = { top: 60, left: 60, right: 20, bottom: 8 };
  const hmInner = hmW - hmPAD.left - hmPAD.right;
  const cellW = hmInner / N_GENES;

  const genes20 = useMemo(() => data.slice(0, N_GENES), [data]);
  const corrMatrix = useMemo(() => {
    return genes20.map(g1 => {
      const v1 = [g1.transcript ?? 0, g1.protein ?? 0, g1.metabolite ?? 0, (g1.fold_change ?? 0) * 2];
      return genes20.map(g2 => {
        const v2 = [g2.transcript ?? 0, g2.protein ?? 0, g2.metabolite ?? 0, (g2.fold_change ?? 0) * 2];
        return pearsonR(v1, v2);
      });
    });
  }, [genes20]);

  // ── Volcano (right) — reuse existing VolcanoPlot ───────────────────
  // Colors updated below in render using data

  return (
    <div style={{ display: 'flex', gap: '12px', width: '100%', height: '100%', padding: '8px' }}>

      {/* LEFT: PCA Biplot */}
      <div style={{ flex: '0 0 auto' }}>
        <SVGChartContainer W={pcaW} H={pcaH} ariaLabel="PCA Biplot" variant="paper" style={{ width: `${pcaW}px`, height: `${pcaH}px` }}>
          <text x={pcaW / 2} y={14} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>PCA BIPLOT</text>
          <text x={pcaW / 2} y={pcaH - 4} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>PC1 ({loadingArrows.pc1Pct}% var)</text>
          <text x={8} y={pcaH / 2} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}
            transform={`rotate(-90,8,${pcaH / 2})`}>PC2 ({loadingArrows.pc2Pct}% var)</text>
          <line x1={pcaPAD} y1={pcaH - pcaPAD} x2={pcaW - pcaPAD} y2={pcaH - pcaPAD} stroke={PAPER_THEME.axis} strokeWidth={PAPER_THEME.axisWidth} />
          <line x1={pcaPAD} y1={pcaPAD} x2={pcaPAD} y2={pcaH - pcaPAD} stroke={PAPER_THEME.axis} strokeWidth={PAPER_THEME.axisWidth} />
          <defs>
            <marker id="pca-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
              <polygon points="0 0.5, 4.5 2.5, 0 4.5" fill={PAPER_THEME.axis} />
            </marker>
          </defs>
          {/* Loading arrows from eigenvectors (one per omics variable) */}
          {loadingArrows.arrows.map((a, i) => {
            const ax = cx + a.x, ay = cy - a.y; // flip y for SVG
            const labelAngle = Math.atan2(-a.y, a.x);
            const labelDist = 10;
            const lx = ax + Math.cos(labelAngle) * labelDist;
            const ly = ay + Math.sin(labelAngle) * labelDist;
            const color = layerColorMap[(['transcriptomics', 'proteomics', 'metabolomics'] as OmicsLayer[])[i]] ?? PAPER_THEME.axis;
            return (
              <g key={a.label}>
                <line x1={cx} y1={cy} x2={ax} y2={ay}
                  stroke={color} strokeWidth="1.5" markerEnd="url(#pca-arrow)" opacity={0.75} />
                <text x={lx} y={ly + 3}
                  textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={color} opacity={0.7}>
                  {a.label.slice(0, 6)}
                </text>
              </g>
            );
          })}
          {/* Sample points */}
          {pcaProjected.map((p, i) => (
            <circle key={p.id ?? i}
              cx={p.sx} cy={p.sy} r={p.gene === highlightedGene ? 5.5 : 3.5}
              fill={layerColorMap[p.layer] ?? CLUSTER_PAL[0]}
              opacity={0.8}
            />
          ))}
          {/* Layer legend */}
          {(['transcriptomics', 'proteomics', 'metabolomics'] as OmicsLayer[]).map((layer, i) => (
            activeLayers[layer] && (
              <g key={layer} transform={`translate(${pcaPAD},${pcaH - pcaPAD + 10 + i * 12})`}>
                <circle cx={4} cy={4} r={4} fill={layerColorMap[layer]} />
                <text x={12} y={8} fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>{layer.slice(0,6)}</text>
              </g>
            )
          ))}
        </SVGChartContainer>
      </div>

      {/* CENTER: 20×20 Correlation Heatmap */}
      <div style={{ flex: '0 0 auto' }}>
        <SVGChartContainer W={hmW} H={hmH} ariaLabel="Correlation matrix" variant="paper" style={{ width: `${hmW}px`, height: `${hmH}px` }}>
          <text x={hmW / 2} y={12} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
            CORRELATION MATRIX (20×20)
          </text>
          {corrMatrix.map((row, yi) =>
            row.map((r, xi) => (
              <rect key={`cm-${xi}-${yi}`}
                x={hmPAD.left + xi * cellW}
                y={hmPAD.top + yi * cellW}
                width={cellW}
                height={cellW}
                fill={divergingColor(r)}
              />
            ))
          )}
          {/* Gene labels on X axis (rotated) */}
          {genes20.map((g, i) => (
            <text key={`xl-${i}`}
              x={hmPAD.left + i * cellW + cellW / 2}
              y={hmPAD.top - 4}
              textAnchor="start"
              fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.labelColor}
              transform={`rotate(-60,${hmPAD.left + i * cellW + cellW / 2},${hmPAD.top - 4})`}
            >{g.gene.slice(0, 5)}</text>
          ))}
          {/* Gene labels on Y axis */}
          {genes20.map((g, i) => (
            <text key={`yl-${i}`}
              x={hmPAD.left - 2}
              y={hmPAD.top + i * cellW + cellW * 0.65}
              textAnchor="end"
              fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.labelColor}
            >{g.gene.slice(0, 5)}</text>
          ))}
          {/* ── Publication colorbar — RdBu diverging scale ── */}
          {/* Standard for fold-change / z-score heatmaps (Nature, Science) */}
          <defs>
            <linearGradient id="multio-div" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={divergingColor(1)} />
              <stop offset="50%"  stopColor={divergingColor(0)} />
              <stop offset="100%" stopColor={divergingColor(-1)} />
            </linearGradient>
          </defs>
          <rect x={hmW - 16} y={hmPAD.top} width="8" height={hmInner} fill="url(#multio-div)" rx="2" />
          {/* Tick marks at +1, 0, -1 */}
          {[{t: 0, label: '+1'}, {t: 0.5, label: '0'}, {t: 1, label: '−1'}].map(({t, label}) => {
            const y = hmPAD.top + t * hmInner;
            return (
              <g key={label}>
                <line x1={hmW - 8} y1={y} x2={hmW - 5} y2={y} stroke={PAPER_THEME.axis} strokeWidth={0.7} />
                <text x={hmW - 3} y={y + 3} fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>{label}</text>
              </g>
            );
          })}
          {/* Unit label */}
          <text x={hmW - 12} y={hmPAD.top - 6} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
            r
          </text>
        </SVGChartContainer>
      </div>

      {/* RIGHT: Volcano plot — updated colors */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <VolcanoPlot data={data} fcThreshold={fcThreshold} pvThreshold={pvThreshold} highlightedGene={highlightedGene} />
      </div>
    </div>
  );
}

/* ── 3D→2D Embedding Scatter (SVG) ───────────────────────────────── */

function EmbeddingScatter({ embeddings, fcThreshold, activeLayers, highlightedGene, bottleneckGene }: {
  embeddings: EmbeddingPoint[];
  fcThreshold: number;
  activeLayers: Record<OmicsLayer, boolean>;
  highlightedGene?: string;
  bottleneckGene?: string;
}) {
  const W = 520, H = 420, PAD = 44;

  const visible = useMemo(
    () => embeddings.filter(p => activeLayers[p.layer]),
    [embeddings, activeLayers],
  );

  const projected = useMemo(() => {
    const pts = visible.map(p => ({
      ...p,
      px: p.coords[0] * 0.866 - p.coords[2] * 0.866,
      py: -p.coords[1] + p.coords[0] * 0.5 + p.coords[2] * 0.5,
    }));
    if (pts.length === 0) return [];
    const xs = pts.map(p => p.px);
    const ys = pts.map(p => p.py);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    return pts.map(p => ({
      ...p,
      sx: PAD + ((p.px - xMin) / xRange) * (W - PAD * 2),
      sy: PAD + ((p.py - yMin) / yRange) * (H - PAD * 2),
    }));
  }, [visible, W, H]);

  const geneFC = useMemo(() => {
    const map: Record<string, number> = {};
    OMICS_DATA.forEach(r => { map[r.gene] = Math.abs(r.fold_change ?? 0); });
    return map;
  }, []);

  const GRID_COUNT = 8;
  const centroids = useMemo(() => {
    const groups: Record<OmicsLayer, { sx: number; sy: number; n: number }> = {
      transcriptomics: { sx: 0, sy: 0, n: 0 },
      proteomics: { sx: 0, sy: 0, n: 0 },
      metabolomics: { sx: 0, sy: 0, n: 0 },
    };
    projected.forEach((point) => {
      groups[point.layer].sx += point.sx;
      groups[point.layer].sy += point.sy;
      groups[point.layer].n += 1;
    });
    return groups;
  }, [projected]);

  return (
    <SVGChartContainer W={W} H={H} ariaLabel="Embedding scatter plot" variant="paper">
      <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} fill={PAPER_THEME.bgAlt} stroke={PAPER_THEME.grid} rx={PAPER_THEME.borderRadius} />
      {/* Grid */}
      {Array.from({ length: GRID_COUNT + 1 }).map((_, i) => {
        const x = PAD + (i / GRID_COUNT) * (W - PAD * 2);
        const y = PAD + (i / GRID_COUNT) * (H - PAD * 2);
        return (
          <g key={i}>
            <line x1={x} y1={PAD} x2={x} y2={H - PAD} stroke={PAPER_THEME.grid} strokeWidth={0.5} />
            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke={PAPER_THEME.grid} strokeWidth={0.5} />
          </g>
        );
      })}
      {/* Axes */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke={PAPER_THEME.axis} strokeWidth={PAPER_THEME.axisWidth} />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke={PAPER_THEME.axis} strokeWidth={PAPER_THEME.axisWidth} />
      <text x={W / 2} y={H - 6} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={LABEL}>
        Embed-1 (linear projection)
      </text>
      <text x={12} y={H / 2} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={LABEL}
        transform={`rotate(-90,12,${H / 2})`}>
        Embed-2 (linear projection)
      </text>
      {/* Omics-layer convex hull territories */}
      {(() => {
        type Layer = 'transcriptomics' | 'proteomics' | 'metabolomics';
        const byLayer: Record<Layer, Array<{sx: number; sy: number}>> = {
          transcriptomics: [], proteomics: [], metabolomics: [],
        };
        projected.forEach(p => byLayer[p.layer as Layer]?.push({ sx: p.sx, sy: p.sy }));
        return (Object.entries(byLayer) as Array<[Layer, Array<{sx: number; sy: number}>]>)
          .filter(([layer, pts]) => pts.length >= 3 && activeLayers[layer])
          .map(([layer, pts]) => {
            const color = LAYER_COLORS[layer];
            const hull = expandHull(computeConvexHull(pts), 14);
            const poly = hull.map(p => `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(' ');
            return (
              <g key={`hull-${layer}`}>
                <defs>
                  <filter id={`omics-blur-${layer}`} x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="6" />
                  </filter>
                </defs>
                <polygon points={poly} fill={color} opacity={0.13} filter={`url(#omics-blur-${layer})`} />
                <polygon points={poly} fill={color} opacity={0.04} stroke={color} strokeWidth={1.2} strokeOpacity={0.30} />
              </g>
            );
          });
      })()}
      {/* Points */}
      {projected.map(p => {
        const sig = (geneFC[p.gene] ?? 0) > fcThreshold;
        const isHighlighted = p.gene === highlightedGene || p.gene === bottleneckGene;
        return (
          <g key={p.id}>
            {isHighlighted && (
              <circle
                cx={p.sx}
                cy={p.sy}
                r={10}
                fill="none"
                stroke={p.gene === bottleneckGene ? 'rgba(255,139,31,0.88)' : 'rgba(240,253,250,0.8)'}
                strokeWidth={1.4}
              />
            )}
            <circle
              cx={p.sx}
              cy={p.sy}
              r={isHighlighted ? 7 : sig ? 6 : 4}
              fill={LAYER_COLORS[p.layer]}
              opacity={sig || isHighlighted ? 1.0 : 0.7}
              style={{ transition: 'opacity 0.2s' }}
            >
              <title>{p.gene} [{p.layer}] val={p.normalizedValue.toFixed(2)}</title>
            </circle>
          </g>
        );
      })}
      {(['transcriptomics', 'proteomics', 'metabolomics'] as OmicsLayer[]).map((layer) => {
        const centroid = centroids[layer];
        if (!centroid.n || !activeLayers[layer]) return null;
        return (
          <g key={`centroid-${layer}`}>
            <circle cx={centroid.sx / centroid.n} cy={centroid.sy / centroid.n} r={11} fill="none" stroke={`${LAYER_COLORS[layer]}`} strokeWidth={1.1} strokeDasharray="4 3" />
            <text x={centroid.sx / centroid.n} y={centroid.sy / centroid.n - 14} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={LAYER_COLORS[layer]}>
              {layer.slice(0, 5)}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      {(['transcriptomics', 'proteomics', 'metabolomics'] as OmicsLayer[]).map((layer, i) => (
        <g key={layer} transform={`translate(${W - PAD - 110}, ${PAD + 6 + i * 16})`}>
          <circle cx={0} cy={0} r={4} fill={LAYER_COLORS[layer]} opacity={activeLayers[layer] ? 1 : 0.25} />
          <text x={10} y={3.5} fontFamily={THEME.SANS} fontSize="10" fill={activeLayers[layer] ? VALUE : LABEL}>
            {layer.charAt(0).toUpperCase() + layer.slice(1)}
          </text>
        </g>
      ))}
      <text x={PAD} y={PAD - 12} fontFamily={THEME.MONO} fontSize="10" fill={LABEL}>
        Highlight ring = current bottleneck or selected sensitivity gene
      </text>
    </SVGChartContainer>
  );
}

/* ── Main Component ───────────────────────────────────────────────── */

export default React.memo(function MultiOPage() {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const cellfreePayload = useWorkbenchStore((s) => s.toolPayloads.cellfree);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const fbaPayload = useWorkbenchStore((s) => s.toolPayloads.fbasim);
  const scspatialPayload = useWorkbenchStore((s) => s.toolPayloads.scspatial);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);
  const devMode = useUIStore((s) => s.devMode);
  const [activeTab, setActiveTab] = useState('embedding');
  /* Layer toggles */
  const [showTranscript, setShowTranscript] = useState(true);
  const [showProtein, setShowProtein] = useState(true);
  const [showMetabolite, setShowMetabolite] = useState(true);

  /* Thresholds */
  const [fcThreshold, setFcThreshold] = useState(1.5);
  const [pvThreshold, setPvThreshold] = useState(0.05);

  /* Perturbation state */
  const [selectedGene, setSelectedGene] = useState<string>(OMICS_DATA[0]?.gene ?? '');
  const [perturbedExpr, setPerturbedExpr] = useState<number>(4);
  const [perturbResult, setPerturbResult] = useState<PerturbationResult | null>(null);

  /* Deterministic local integration model */
  const { data: model, error: simError } = useMemo(() => {
    try { return { data: new OmicsFoundationModel(OMICS_DATA), error: null as string | null }; }
    catch (e) { return { data: new OmicsFoundationModel(OMICS_DATA), error: e instanceof Error ? e.message : 'Model init failed' }; }
  }, []);
  const embeddings = useMemo(() => model.computeEmbeddings(), [model]);
  const bottleneck = useMemo(() => model.analyzeBottleneck(), [model]);
  const correlations = useMemo(() => model.computeCorrelationMatrix(), [model]);

  /* MOI Engine — ALS factors / linear embedding / Efficiency (see MOIEngine.ts header for honest method names) */
  const mofaResult = useMemo(() => extractMOFAFactors(OMICS_DATA, 5), []);

  /* MOFA+ variational Bayes factor analysis */
  const [mofaPlusResult, setMofaPlusResult] = useState<MOFAPlusResultType | null>(null);
  const [mofaPlusLoading, setMofaPlusLoading] = useState(false);
  const handleRunMOFA = useCallback(() => {
    setMofaPlusLoading(true);
    try {
      const views: Record<string, number[][]> = {};
      views.transcriptomics = OMICS_DATA.map(r => [r.transcript ?? 0]);
      views.proteomics = OMICS_DATA.map(r => [r.protein ?? 0]);
      views.metabolomics = OMICS_DATA.map(r => [r.metabolite ?? 0]);
      const result = runMOFA({ views, nFactors: 5 });
      setMofaPlusResult(result);
    } finally {
      setMofaPlusLoading(false);
    }
  }, []);
  const { result: vaeResult, loading: vaeLoading, error: vaeError, train: trainVAE } = useVAEWorker({
    data: OMICS_DATA,
    latentDim: 8,
    beta: 0.5,
    epochs: 100,
    lr: 0.005,
  });

  /* Auto-train VAE on mount */
  useEffect(() => { trainVAE(); }, [trainVAE]);
  const efficiencyScores = useMemo(() => computeMetabolicEfficiency(OMICS_DATA), []);
  const vaeEmbeddings = useMemo(
    () => vaeResult ? exportEmbeddingsWithEfficiency(vaeResult, efficiencyScores) : [],
    [vaeResult, efficiencyScores],
  );

  /* Local embedding perturbation state; API names are retained for compatibility. */
  const [vaePerturbGene, setVaePerturbGene] = useState<string>(OMICS_DATA[0]?.gene ?? '');
  const [vaePerturbFC, setVaePerturbFC] = useState<number>(2.0);
  const [vaePerturbResult, setVaePerturbResult] = useState<VAEPerturbationPrediction | null>(null);

  /* Derived data */
  const filtered = useMemo(
    () => OMICS_DATA.filter(r => Math.abs(r.fold_change ?? 0) > 0),
    [],
  );

  const significant = filtered.filter(
    r => (r.pValue ?? 1) < pvThreshold && Math.abs(r.fold_change ?? 0) > fcThreshold,
  );
  const upregulated = significant.filter(r => (r.fold_change ?? 0) > 0).length;
  const downregulated = significant.filter(r => (r.fold_change ?? 0) < 0).length;

  const thoughts = useMemo(() => model.getThoughts(), [model, perturbResult]);

  const activeLayers: Record<OmicsLayer, boolean> = {
    transcriptomics: showTranscript,
    proteomics: showProtein,
    metabolomics: showMetabolite,
  };

  /* Layer signal scores aggregated per layer */
  const layerSignals = useMemo(() => {
    const acc: Record<OmicsLayer, number> = { transcriptomics: 0, proteomics: 0, metabolomics: 0 };
    bottleneck.layer_signals.forEach(h => { acc[h.layer] += h.weight; });
    return acc;
  }, [bottleneck]);
  const maxSignal = Math.max(...Object.values(layerSignals), 0.01);

  /* Gene list for perturbation dropdown */
  const geneNames = useMemo(() => [...new Set(OMICS_DATA.map(r => r.gene))], []);
  const preferredGene = useMemo(
    () => findPreferredGene([
      analyzeArtifact?.bottleneckAssumptions?.[0]?.label ?? '',
      analyzeArtifact?.enzymeCandidates?.[0]?.label ?? '',
      analyzeArtifact?.targetProduct ?? '',
      project?.targetProduct ?? '',
    ]),
    [
      analyzeArtifact?.bottleneckAssumptions,
      analyzeArtifact?.enzymeCandidates,
      analyzeArtifact?.targetProduct,
      project?.targetProduct,
    ],
  );

  /* Correlation label helper */
  const corrLabel = (a: OmicsLayer, b: OmicsLayer) => {
    const short: Record<OmicsLayer, string> = { transcriptomics: 'T', proteomics: 'P', metabolomics: 'M' };
    return `${short[a]}↔${short[b]}`;
  };

  // FBA flux weighting: high-flux reactions amplify perturbation effects
  const fbaFluxWeight = useMemo(() => {
    if (!fbaPayload?.result.topFluxes?.length) return 1;
    const REACTION_TO_GENES: Record<string, string[]> = {
      PFK: ['pfkA', 'pfkB'], PYK: ['pykF', 'pykA'], GAPD: ['gapA'],
      PGI: ['zwf'], ENO: ['eno'], PDH: ['ppc'], CS: ['sdhA'], MDH: ['sucA'], FBA: ['gpmA'],
    };
    const geneUpper = selectedGene.toUpperCase();
    for (const { reactionId, flux } of fbaPayload.result.topFluxes) {
      const genes = REACTION_TO_GENES[reactionId];
      if (genes?.some((g) => g.toUpperCase() === geneUpper)) {
        return 1 + Math.abs(flux) * 0.02;
      }
    }
    return 1;
  }, [fbaPayload?.result.topFluxes, selectedGene]);

  const handleSimulate = useCallback(() => {
    // High-flux reactions from FBA produce stronger perturbation effects in the simulation
    const weightedExpr = perturbedExpr * fbaFluxWeight;
    const result = model.simulatePerturbation(selectedGene, weightedExpr);
    setPerturbResult(result);
  }, [model, selectedGene, perturbedExpr, fbaFluxWeight]);

  useEffect(() => {
    if (preferredGene) {
      setSelectedGene(preferredGene);
      setVaePerturbGene(preferredGene);
    }
  }, [preferredGene]);

  useEffect(() => {
    const now = Date.now();
    const topEfficiency = [...efficiencyScores].sort((left, right) => right.score - left.score)[0];
    const upstreamProvenance = [cellfreePayload?.runProvenance, dbtlPayload?.runProvenance, fbaPayload?.runProvenance, scspatialPayload?.runProvenance]
      .filter((entry): entry is ProvenanceEntry => Boolean(entry))
      .map((entry) => `${entry.toolId}:${entry.timestamp}`);
    setToolPayload('multio', {
      validity: 'demo',
      runProvenance: createProvenanceEntry({
        toolId: 'multio',
        outputAssumptions: [
          'multio.deterministic_demo_only',
          'multio.no_reference_model',
          'multio.no_bayesian_gp_posterior',
          'multio.not_mofa_plus',
          'multio.not_vae',
          'multio.no_umap',
          'multio.deterministic_no_uncertainty',
          'multio.linear_perturbation',
        ],
        evidence: [{
          id: `multio-${now}`,
          source: 'computation',
          reference: 'Deterministic local computation: linear factor decomposition, linear projection, and sensitivity-style perturbation.',
          confidence: 'demo',
          notes: 'Uncertainty fields are placeholders from deterministic losses, not Bayesian posterior uncertainty.',
        }],
        upstreamProvenance,
      }),
      toolId: 'multio',
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
      sourceArtifactId: analyzeArtifact?.id,
      selectedGene,
      activeView: activeTab,
      thresholds: {
        fc: fcThreshold,
        pv: pvThreshold,
      },
      result: {
        significantCount: significant.length,
        dominantLayer: bottleneck.dominant_layer,
        bottleneckGene: selectedGene,
        bottleneckConfidence: bottleneck.confidence,
        mofaVarianceExplained: mofaResult.totalVarianceExplained,
        topEfficiencyGene: topEfficiency?.gene ?? '—',
        topEfficiencyScore: topEfficiency?.score ?? 0,
        vaeElbo: vaeResult?.elbo ?? 0,
      },
      updatedAt: now,
    });
  }, [
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    bottleneck.confidence,
    bottleneck.dominant_layer,
    cellfreePayload?.runProvenance,
    dbtlPayload?.runProvenance,
    fbaPayload?.runProvenance,
    scspatialPayload?.runProvenance,
    efficiencyScores,
    fcThreshold,
    mofaResult.totalVarianceExplained,
    project?.targetProduct,
    project?.title,
    pvThreshold,
    selectedGene,
    setToolPayload,
    significant.length,
    vaeResult?.elbo,
  ]);

  /* Section label helper */
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p style={{
      fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase',
      letterSpacing: '0.1em', color: THEME.LABEL, margin: '0 0 10px',
    }}>
      {children}
    </p>
  );

  return (
    <ToolShell
      moduleId="multio"
      title="Deterministic Multi-Omics Integration"
      formula="z-score + ALS factors + linear projection | sensitivity Δ"
      tabs={MULTIO_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={['factors', 'mofaplus', 'projection', 'efficiency']}
      hero={
        <ScientificHero
            eyebrow="Stage 4 · Deterministic Multi-Omics Demo"
            title="Result-centered omics synthesis instead of isolated plots"
            summary="MULTIO behaves as an exploratory integration surface: significant genes, deterministic layer signals, sensitivity sketches, and efficiency context sit above the visualization layer without claiming posterior uncertainty or a reference-model backend."
            aside={
              <>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Current analytical lens
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, fontWeight: 700 }}>
                  {MULTIO_TABS.find(t => t.id === activeTab)?.label ?? 'Embedding'} · {Object.values(activeLayers).filter(Boolean).length}/3 omics layers active
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.LABEL, lineHeight: 1.55 }}>
                  The current lens is anchored to {analyzeArtifact?.targetProduct ?? project?.targetProduct ?? project?.title ?? 'the active project object'}, so bottleneck claims stay attached to the same scientific context.
                </div>
              </>
            }
            signals={[
              {
                label: 'Significant Signals',
                value: `${significant.length}`,
                detail: `${upregulated} upregulated · ${downregulated} downregulated under current thresholds`,
                tone: significant.length > 12 ? 'warm' : 'cool',
              },
              {
                label: 'Dominant Layer',
                value: bottleneck.dominant_layer,
                detail: `Deterministic score ${(bottleneck.confidence * 100).toFixed(0)}% for the leading bottleneck interpretation`,
                tone: 'cool',
              },
              {
                label: 'Lead Gene',
                value: significant[0]?.gene ?? selectedGene,
                detail: perturbResult
                  ? `Sensitivity sketch estimates ${perturbResult.predicted_yield_change_percent >= 0 ? '+' : ''}${perturbResult.predicted_yield_change_percent.toFixed(1)}% demo yield shift`
                  : 'Use the sensitivity sketch to explore how omics signals might relate to pathway context.',
                tone: perturbResult && perturbResult.predicted_yield_change_percent < 0 ? 'alert' : 'neutral',
              },
              {
                label: 'Best Efficiency Score',
                value: `${Math.max(...efficiencyScores.map((entry) => entry.score)).toFixed(2)}`,
                detail: 'Efficiency scores let omics interpretation stay tied to production relevance, not just statistical significance.',
                tone: 'neutral',
              },
            ]}
          />
      }
      footer={
        <div style={{ display: 'flex', gap: '8px' }}>
          <ExportButton label="Export All CSV" data={OMICS_DATA} filename="multio-all" format="csv" />
          <ExportButton label="Export Significant JSON" data={significant} filename="multio-significant" format="json" />
        </div>
      }
    >
      {simError && (
        <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={simError} /></div>
      )}

      {/* ── Embedding Tab ── */}
      <ToolTabPanel tabId="embedding" activeId={activeTab}>
        <div style={{ display: 'flex', gap: '0', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <FloatingControlRail label="Omics Controls">
            {/* Data Layers */}
            <SectionLabel>Data Layers</SectionLabel>
            {([
              { label: 'Transcriptomics', layer: 'transcriptomics' as OmicsLayer, val: showTranscript, set: setShowTranscript },
              { label: 'Proteomics',      layer: 'proteomics' as OmicsLayer,      val: showProtein,    set: setShowProtein },
              { label: 'Metabolomics',    layer: 'metabolomics' as OmicsLayer,    val: showMetabolite, set: setShowMetabolite },
            ]).map(({ label, layer, val, set }) => (
              <button aria-label={`Toggle ${label} layer`} key={label} onClick={() => set(!val)}
                className={`nb-tool-toggle ${val ? 'nb-tool-toggle--active' : ''}`}
                style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '7px 10px', marginBottom: '6px',
                background: val ? 'rgba(175,195,214,0.22)' : undefined,
                borderColor: val ? 'rgba(175,195,214,0.34)' : undefined,
                borderRadius: 'var(--nb-radius-sm)',
                color: val ? INPUT_TEXT : undefined,
                textAlign: 'left',
              }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: val ? LAYER_COLORS[layer] : 'transparent',
                  border: `1.5px solid ${LAYER_COLORS[layer]}`, flexShrink: 0,
                }} />
                {label}
              </button>
            ))}

            {/* Thresholds */}
            <SectionLabel>Thresholds</SectionLabel>
            <WorkbenchRangeSlider label="|FC| >" value={fcThreshold} min={0.5} max={5} step={0.1} formatValue={v => v.toFixed(1)} onChange={setFcThreshold} />
            <WorkbenchRangeSlider label="p <" value={pvThreshold} min={0.001} max={0.1} step={0.001} formatValue={v => v.toFixed(3)} onChange={setPvThreshold} />

            {/* Sensitivity sketch */}
            <SectionLabel>Sensitivity Sketch</SectionLabel>
            <select
              value={selectedGene}
              onChange={e => setSelectedGene(e.target.value)}
              style={{
                width: '100%', padding: '6px 8px', marginBottom: '8px',
                background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)',
                color: INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                outline: '2px solid rgba(175,195,214,0.5)', outlineOffset: '2px', appearance: 'auto' as React.CSSProperties['appearance'],
              }}
            >
              {geneNames.map(g => (
                <option key={g} value={g} style={{ background: THEME.BG_PANEL }}>{g}</option>
              ))}
            </select>
            <WorkbenchRangeSlider label="Expression" value={perturbedExpr} min={-4} max={8} step={0.1} formatValue={v => v.toFixed(1)} onChange={setPerturbedExpr} />
            <ActionButton
              variant="primary"
              size="sm"
              aria-label="Run sensitivity analysis"
              onClick={handleSimulate}
              style={{ width: '100%' }}
            >
              Run Sensitivity
            </ActionButton>

            {/* Sensitivity Results */}
            {perturbResult && (
              <div style={{ marginTop: '14px' }}>
                <SectionLabel>Sensitivity Result</SectionLabel>
                <div style={{
                  ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '10px', marginBottom: '10px',
                }}>
                  {/* Yield change */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Demo Yield Δ</span>
                    <span style={{
                      fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', fontWeight: 700,
                      color: perturbResult.predicted_yield_change_percent >= 0
                        ? THEME.MINT : THEME.CORAL,
                    }}>
                      {perturbResult.predicted_yield_change_percent >= 0 ? '+' : ''}
                      {perturbResult.predicted_yield_change_percent.toFixed(1)}%
                    </span>
                  </div>
                  {/* Metabolite shifts */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                    {perturbResult.metabolite_shifts.map(ms => (
                      <span key={ms.metabolite} style={{
                        fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '2px 6px', borderRadius: '6px',
                        background: ms.direction === 'up' ? `${THEME.MINT}26` : `${THEME.CORAL}26`,
                        color: ms.direction === 'up' ? `${THEME.MINT}E6` : `${THEME.CORAL}E6`,
                        border: `1px solid ${ms.direction === 'up' ? `${THEME.MINT}33` : `${THEME.CORAL}33`}`,
                      }}>
                        {ms.metabolite} {ms.direction === 'up' ? '↑' : '↓'}{Math.abs(ms.delta).toFixed(1)}
                      </span>
                    ))}
                  </div>
                  {/* Reasoning chain */}
                  {perturbResult.reasoning_chain.map((step, i) => (
                    <div key={i} style={{
                      padding: '4px 0',
                      borderTop: i > 0 ? `1px solid ${BORDER}` : 'none',
                    }}>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LAYER_COLORS.proteomics }}>
                        {i + 1}. {step.step}
                      </span>
                      <p style={{
                        fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL,
                        margin: '2px 0 0', lineHeight: '1.35',
                      }}>
                        {step.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </FloatingControlRail>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: '16px', overflow: 'auto' }}>
            <ScientificFigureFrame
              eyebrow="Cross-Layer Projection"
              title="Transcript, protein, and metabolite structure aligned in one figure field"
              caption="Deterministic projection first, bottleneck signal second, and pathway relevance always visible."
              minHeight="100%"
              legend={[
                { label: 'Bottleneck', value: bottleneck.dominant_layer, accent: LAYER_COLORS[bottleneck.dominant_layer] },
                { label: 'Gene', value: selectedGene, accent: THEME.LILAC },
                { label: 'Significant', value: `${significant.length}`, accent: THEME.MINT },
              ]}
            >
                <div style={{ minHeight: '520px', overflow: 'auto' }}>
                  <TriPanelEmbedding
                    embeddings={embeddings}
                    data={filtered}
                    fcThreshold={fcThreshold}
                    pvThreshold={pvThreshold}
                    activeLayers={activeLayers}
                    highlightedGene={selectedGene}
                  />
                </div>
            </ScientificFigureFrame>
            <InlineMetricOverlay
              position="top-right"
              metrics={[
                { label: 'Bottleneck', value: bottleneck.dominant_layer, accent: THEME.SKY },
                { label: 'Gene', value: selectedGene, accent: THEME.LILAC },
                { label: 'Significant', value: `${significant.length}`, accent: THEME.MINT },
              ]}
            />
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Volcano Tab ── */}
      <ToolTabPanel tabId="volcano" activeId={activeTab}>
        <div style={{ display: 'flex', gap: '0', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <FloatingControlRail label="Controls">
            <SectionLabel>Thresholds</SectionLabel>
            <WorkbenchRangeSlider label="|FC| >" value={fcThreshold} min={0.5} max={5} step={0.1} formatValue={v => v.toFixed(1)} onChange={setFcThreshold} />
            <WorkbenchRangeSlider label="p <" value={pvThreshold} min={0.001} max={0.1} step={0.001} formatValue={v => v.toFixed(3)} onChange={setPvThreshold} />
            <SectionLabel>Gene</SectionLabel>
            <select value={selectedGene} onChange={e => setSelectedGene(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', outline: '2px solid rgba(175,195,214,0.5)', outlineOffset: '2px', appearance: 'auto' as React.CSSProperties['appearance'] }}>
              {geneNames.map(g => (<option key={g} value={g} style={{ background: '#1a1d24' }}>{g}</option>))}
            </select>
          </FloatingControlRail>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: '16px', overflow: 'auto' }}>
            <ScientificFigureFrame
              eyebrow="Differential Signal Map"
              title={`${selectedGene} highlighted against fold-change and significance thresholds`}
              caption="Volcano view emphasizes threshold logic and current bottleneck focus."
              minHeight="100%"
              legend={[
                { label: 'Gene', value: selectedGene, accent: THEME.LILAC },
                { label: 'Significant', value: `${significant.length}`, accent: THEME.MINT },
              ]}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '520px' }}>
                <div style={{ width: '100%', maxWidth: '560px', aspectRatio: '360/300' }}>
                  <VolcanoPlot data={filtered} fcThreshold={fcThreshold} pvThreshold={pvThreshold} highlightedGene={selectedGene} />
                </div>
              </div>
            </ScientificFigureFrame>
            <InlineMetricOverlay
              position="top-right"
              metrics={[
                { label: 'Up', value: `${upregulated}`, accent: THEME.MINT },
                { label: 'Down', value: `${downregulated}`, accent: THEME.CORAL },
                { label: 'Total Sig', value: `${significant.length}`, accent: THEME.LILAC },
              ]}
            />
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Factors Tab ── */}
      <ToolTabPanel tabId="factors" activeId={activeTab}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <ScientificFigureFrame
            eyebrow="Factor Decomposition"
            title="Cross-layer factors explaining multi-omics variance"
            caption="Per-layer contribution, top genes, and interpretation in one frame."
            minHeight="100%"
            legend={[
              { label: 'Var Explained', value: `${(mofaResult.totalVarianceExplained * 100).toFixed(1)}%`, accent: THEME.SKY },
              { label: 'Factors', value: `${mofaResult.factors.length}`, accent: THEME.LILAC },
            ]}
          >
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px 16px', flex: '1 0 120px' }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, display: 'block' }}>Total Var. Explained</span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: LAYER_COLORS.transcriptomics }}>{(mofaResult.totalVarianceExplained * 100).toFixed(1)}%</span>
              </div>
              <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px 16px', flex: '1 0 120px' }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, display: 'block' }}>Optimization Steps</span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: VALUE }}>{mofaResult.convergenceIterations} iter</span>
              </div>
              <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px 16px', flex: '1 0 120px' }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, display: 'block' }}>Recon. Error</span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: VALUE }}>{mofaResult.reconstructionError.toFixed(4)}</span>
              </div>
            </div>
            {mofaResult.factors.map(f => (
              <div key={f.id} style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '14px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', fontWeight: 600, color: VALUE }}>{f.name}</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>{(f.varianceExplained.total * 100).toFixed(1)}% var</span>
                </div>
                {(['transcriptomics', 'proteomics', 'metabolomics'] as OmicsLayer[]).map(layer => {
                  const pct = f.varianceExplained[layer] * 100;
                  return (
                    <div key={layer} style={{ marginBottom: '5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>{layer.slice(0, 5)}</span>
                        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{pct.toFixed(1)}%</span>
                      </div>
                      <div style={{ width: '100%', height: '5px', borderRadius: '3px', background: THEME.PANEL_INSET }}>
                        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', borderRadius: '3px', background: LAYER_COLORS[layer] }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {f.topGenes.slice(0, 4).map(g => (
                    <span key={g.gene} style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '2px 6px', borderRadius: '6px', background: THEME.PANEL_INSET, color: VALUE }}>{g.gene} ({g.loading.toFixed(2)})</span>
                  ))}
                </div>
                <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, margin: '6px 0 0', lineHeight: '1.3' }}>{f.interpretation}</p>
              </div>
            ))}
            {/* Spatial cluster assignments inform factor decomposition (ScSpatial → MultiO) */}
            {scspatialPayload?.result?.clusterSummaries && scspatialPayload.result.clusterSummaries.length > 0 && (
              <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '14px', marginTop: '12px' }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                  Spatial Cluster Correlation
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, marginBottom: '10px', lineHeight: 1.45 }}>
                  Spatial cluster assignments inform factor decomposition — clusters with high mean expression may align with dominant MOFA factors.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {scspatialPayload.result.clusterSummaries.map((cs) => (
                    <div key={cs.clusterId} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: cs.fate === 'productive' ? THEME.MINT : cs.fate === 'stressed' ? THEME.CORAL : THEME.APRICOT,
                      }} />
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, width: '100px' }}>{cs.clusterLabel}</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>{cs.cellCount} cells</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>expr: {cs.meanExpression.toFixed(2)}</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: cs.fate === 'productive' ? THEME.MINT : THEME.LABEL }}>{cs.fate}</span>
                      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                        {cs.topGenes.slice(0, 3).map((g) => (
                          <span key={g} style={{ fontFamily: THEME.MONO, fontSize: '9px', padding: '1px 4px', borderRadius: '4px', background: THEME.PANEL_INSET, color: VALUE }}>{g}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScientificFigureFrame>
        </div>
      </ToolTabPanel>

      {/* ── MOFA+ Tab ── */}
      <ToolTabPanel tabId="mofaplus" activeId={activeTab}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <ScientificFigureFrame
            eyebrow="MOFA+ Variational Bayes"
            title="Multi-omics factor analysis via coordinate ascent variational inference"
            caption="ARD-penalized factor decomposition across transcriptomics, proteomics, and metabolomics views. Reference: Argelaguet et al. (2020) Mol Syst Biol 16:e9918."
            minHeight="100%"
            legend={[
              { label: 'Status', value: mofaPlusResult ? (mofaPlusResult.converged ? 'Converged' : 'Max iter') : 'Not run', accent: mofaPlusResult?.converged ? THEME.MINT : THEME.CORAL },
              { label: 'Factors', value: `${mofaPlusResult?.factors[0]?.length ?? 0}`, accent: THEME.SKY },
            ]}
          >
            {/* Run button */}
            <div style={{ marginBottom: '16px' }}>
              <ActionButton
                variant="primary"
                size="sm"
                aria-label="Run MOFA+ factor analysis"
                onClick={handleRunMOFA}
                disabled={mofaPlusLoading}
                style={{ minWidth: '160px' }}
              >
                {mofaPlusLoading ? 'Running MOFA+...' : 'Run MOFA+'}
              </ActionButton>
            </div>

            {!mofaPlusResult && !mofaPlusLoading && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '48px 24px', color: LABEL, fontFamily: THEME.SANS,
                fontSize: 'var(--nb-fs-sm)', textAlign: 'center', lineHeight: 1.6,
              }}>
                Click "Run MOFA+" to perform variational Bayes factor analysis across all three omics views.
                <br />The model uses ARD priors for sparsity and coordinate ascent for inference.
              </div>
            )}

            {mofaPlusLoading && (
              <div style={{ display: 'grid', gap: '8px', padding: '16px' }}>
                <div style={{ height: '14px', width: '40%', borderRadius: '4px', background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                <div style={{ height: '200px', borderRadius: '12px', background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                <div style={{ textAlign: 'center', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginTop: '4px' }}>
                  Running variational Bayes inference...
                </div>
              </div>
            )}

            {mofaPlusResult && (
              <>
                {/* Summary metrics */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px 16px', flex: '1 0 120px' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, display: 'block' }}>Converged</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: mofaPlusResult.converged ? THEME.MINT : THEME.CORAL }}>
                      {mofaPlusResult.converged ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px 16px', flex: '1 0 120px' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, display: 'block' }}>Iterations</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: VALUE }}>{mofaPlusResult.iterations}</span>
                  </div>
                  <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px 16px', flex: '1 0 120px' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, display: 'block' }}>Factors</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: THEME.SKY }}>{mofaPlusResult.factors[0]?.length ?? 0}</span>
                  </div>
                  <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px 16px', flex: '1 0 120px' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, display: 'block' }}>Samples</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: VALUE }}>{mofaPlusResult.factors.length}</span>
                  </div>
                </div>

                {/* Variance Explained per view (bar chart) */}
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                    Variance Explained per View
                  </div>
                  {(() => {
                    const viewNames = Object.keys(mofaPlusResult.varianceExplained);
                    const nFactors = mofaPlusResult.factors[0]?.length ?? 0;
                    const barH = 18;
                    const gapY = 28;
                    const chartH = viewNames.length * gapY + 40;
                    const chartW = 400;
                    const PAD_L = 100;
                    const PAD_R = 30;
                    const barAreaW = chartW - PAD_L - PAD_R;
                    // Compute total variance per view
                    const totalPerView = viewNames.map(vn =>
                      mofaPlusResult.varianceExplained[vn].reduce((s, r2) => s + r2, 0)
                    );
                    const maxVar = Math.max(...totalPerView, 0.01);
                    return (
                      <SVGChartContainer W={chartW} H={chartH} ariaLabel="Variance explained per view" variant="paper">
                        {viewNames.map((vn, vi) => {
                          const total = totalPerView[vi];
                          const barW = (total / maxVar) * barAreaW;
                          const y = 20 + vi * gapY;
                          const viewColor = vn === 'transcriptomics' ? LAYER_COLORS.transcriptomics
                            : vn === 'proteomics' ? LAYER_COLORS.proteomics
                            : LAYER_COLORS.metabolomics;
                          return (
                            <g key={vn}>
                              <text x={PAD_L - 6} y={y + barH * 0.75} textAnchor="end"
                                fontFamily={THEME.MONO} fontSize="10" fill={LABEL}>
                                {vn.slice(0, 8)}
                              </text>
                              <rect x={PAD_L} y={y} width={barAreaW} height={barH}
                                fill={THEME.PANEL_INSET} rx={3} />
                              <rect x={PAD_L} y={y} width={Math.max(0, barW)} height={barH}
                                fill={viewColor} opacity={0.75} rx={3} />
                              <text x={PAD_L + barW + 6} y={y + barH * 0.75}
                                fontFamily={THEME.MONO} fontSize="10" fill={VALUE}>
                                {(total * 100).toFixed(1)}%
                              </text>
                            </g>
                          );
                        })}
                        {/* Factor breakdown stacked within each bar */}
                        {viewNames.map((vn, vi) => {
                          const y = 20 + vi * gapY;
                          let xOffset = 0;
                          return mofaPlusResult.varianceExplained[vn].map((r2, fi) => {
                            const segW = (r2 / maxVar) * barAreaW;
                            const x = PAD_L + xOffset;
                            xOffset += segW;
                            return (
                              <rect key={`${vn}-f${fi}`}
                                x={x} y={y} width={Math.max(0, segW)} height={barH}
                                fill={SCI_SERIES[fi % SCI_SERIES.length]}
                                opacity={0.2} rx={fi === 0 ? 3 : 0}
                              />
                            );
                          });
                        })}
                      </SVGChartContainer>
                    );
                  })()}
                </div>

                {/* Factor Loadings Heatmap (view x factor) */}
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                    Factor Loadings Heatmap (View x Factor)
                  </div>
                  {(() => {
                    const viewNames = Object.keys(mofaPlusResult.loadings);
                    const nFactors = mofaPlusResult.factors[0]?.length ?? 0;
                    // Compute mean absolute loading per view per factor
                    const meanLoadings: number[][] = viewNames.map(vn => {
                      const W = mofaPlusResult.loadings[vn]; // [features x factors]
                      const nf = W.length;
                      return Array.from({ length: nFactors }, (_, fi) => {
                        let sum = 0;
                        for (let j = 0; j < nf; j++) sum += Math.abs(W[j]?.[fi] ?? 0);
                        return nf > 0 ? sum / nf : 0;
                      });
                    });
                    const allVals = meanLoadings.flat();
                    const maxL = Math.max(...allVals, 0.01);
                    const cellW = 48;
                    const cellH = 36;
                    const PAD_L = 100;
                    const PAD_T = 28;
                    const hmW = PAD_L + nFactors * cellW + 60;
                    const hmH = PAD_T + viewNames.length * cellH + 10;
                    return (
                      <SVGChartContainer W={hmW} H={hmH} ariaLabel="Factor loadings heatmap" variant="paper">
                        {/* Factor labels */}
                        {Array.from({ length: nFactors }, (_, fi) => (
                          <text key={`fl-${fi}`}
                            x={PAD_L + fi * cellW + cellW / 2} y={PAD_T - 8}
                            textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={LABEL}>
                            F{fi + 1}
                          </text>
                        ))}
                        {/* Cells */}
                        {viewNames.map((vn, vi) => {
                          const y = PAD_T + vi * cellH;
                          const viewColor = vn === 'transcriptomics' ? LAYER_COLORS.transcriptomics
                            : vn === 'proteomics' ? LAYER_COLORS.proteomics
                            : LAYER_COLORS.metabolomics;
                          return (
                            <g key={vn}>
                              <text x={PAD_L - 6} y={y + cellH * 0.65} textAnchor="end"
                                fontFamily={THEME.MONO} fontSize="10" fill={viewColor}>
                                {vn.slice(0, 8)}
                              </text>
                              {meanLoadings[vi].map((val, fi) => {
                                const intensity = val / maxL;
                                return (
                                  <g key={`${vn}-${fi}`}>
                                    <rect
                                      x={PAD_L + fi * cellW} y={y}
                                      width={cellW - 2} height={cellH - 2}
                                      fill={viewColor} opacity={0.15 + intensity * 0.7}
                                      rx={3}
                                    />
                                    <text
                                      x={PAD_L + fi * cellW + cellW / 2 - 1}
                                      y={y + cellH * 0.6}
                                      textAnchor="middle" fontFamily={THEME.MONO} fontSize="9"
                                      fill={intensity > 0.5 ? '#fff' : VALUE}>
                                      {val.toFixed(3)}
                                    </text>
                                  </g>
                                );
                              })}
                            </g>
                          );
                        })}
                        {/* Colorbar */}
                        <defs>
                          <linearGradient id="mofa-load-grad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={THEME.SKY} stopOpacity={0.15} />
                            <stop offset="100%" stopColor={THEME.SKY} stopOpacity={0.85} />
                          </linearGradient>
                        </defs>
                        <rect x={PAD_L + nFactors * cellW + 8} y={PAD_T} width="8" height={viewNames.length * cellH - 2}
                          fill="url(#mofa-load-grad)" rx="2" />
                        <text x={PAD_L + nFactors * cellW + 12} y={PAD_T - 4} fontFamily={THEME.MONO} fontSize="9" fill={LABEL}>0</text>
                        <text x={PAD_L + nFactors * cellW + 12} y={PAD_T + viewNames.length * cellH + 10} fontFamily={THEME.MONO} fontSize="9" fill={LABEL}>{maxL.toFixed(2)}</text>
                      </SVGChartContainer>
                    );
                  })()}
                </div>

                {/* Top contributing features per factor */}
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '14px' }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                    Top Contributing Features per Factor
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(() => {
                      const viewNames = Object.keys(mofaPlusResult.loadings);
                      const nFactors = mofaPlusResult.factors[0]?.length ?? 0;
                      const geneNames = OMICS_DATA.map(r => r.gene);
                      return Array.from({ length: nFactors }, (_, fi) => {
                        // Collect top features across all views for this factor
                        const topFeatures: { gene: string; view: string; loading: number }[] = [];
                        for (const vn of viewNames) {
                          const W = mofaPlusResult.loadings[vn];
                          for (let j = 0; j < W.length; j++) {
                            const loading = Math.abs(W[j]?.[fi] ?? 0);
                            if (j < geneNames.length) {
                              topFeatures.push({ gene: geneNames[j], view: vn, loading });
                            }
                          }
                        }
                        topFeatures.sort((a, b) => b.loading - a.loading);
                        const top5 = topFeatures.slice(0, 5);
                        const viewColor = (vn: string) => vn === 'transcriptomics' ? LAYER_COLORS.transcriptomics
                          : vn === 'proteomics' ? LAYER_COLORS.proteomics
                          : LAYER_COLORS.metabolomics;
                        return (
                          <div key={`factor-${fi}`} style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: '8px' }}>
                            <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', fontWeight: 600, color: VALUE, marginBottom: '6px' }}>
                              Factor {fi + 1}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {top5.map((f, idx) => (
                                <span key={`${f.gene}-${f.view}-${idx}`} style={{
                                  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                                  padding: '3px 8px', borderRadius: '6px',
                                  background: `${viewColor(f.view)}1A`,
                                  color: viewColor(f.view),
                                  border: `1px solid ${viewColor(f.view)}33`,
                                }}>
                                  {f.gene} <span style={{ opacity: 0.6 }}>({f.view.slice(0, 4)})</span> {f.loading.toFixed(3)}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </>
            )}
          </ScientificFigureFrame>
        </div>
      </ToolTabPanel>

      {/* ── Projection Tab ── */}
      <ToolTabPanel tabId="projection" activeId={activeTab}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '16px', overflow: 'auto' }}>
          <ScientificFigureFrame
            eyebrow="Projected Embedding"
            title="Projected embedding and optimization trace"
            caption="Embedding geometry above, optimization trace below."
            minHeight="100%"
            legend={[
              { label: 'Dim', value: `${vaeResult?.latentDim ?? 8}D`, accent: THEME.SKY },
              { label: 'ELBO', value: vaeResult?.elbo?.toFixed(3) ?? '—', accent: THEME.MINT },
            ]}
          >
            {vaeLoading && (
              <div style={{ display: 'grid', gap: '8px', padding: '16px' }}>
                <div style={{ height: '14px', width: '50%', borderRadius: '4px', background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                <div style={{ height: '240px', borderRadius: '12px', background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1,2,3,4].map(i => <div key={i} style={{ height: '36px', flex: 1, borderRadius: '8px', background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />)}
                </div>
                <div style={{ textAlign: 'center', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginTop: '4px' }}>
                  Training VAE embedding model…
                </div>
              </div>
            )}
            {vaeError && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', color: THEME.CORAL, fontSize: 'var(--nb-fs-sm)', fontFamily: 'monospace' }}>
                VAE error: {vaeError}
              </div>
            )}
            {!vaeLoading && !vaeError && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                <div style={{ width: '100%', maxWidth: '560px' }}>
                  {(() => {
                    const W = 520, H = 380, PAD = 44;
                    const pts = vaeResult?.latentPoints ?? [];
                    const xs = pts.map(p => p.z_mean[0] ?? 0);
                    const ys = pts.map(p => p.z_mean[1] ?? 0);
                    const xMin = Math.min(...xs), xMax = Math.max(...xs);
                    const yMin = Math.min(...ys), yMax = Math.max(...ys);
                    const xR = xMax - xMin || 1, yR = yMax - yMin || 1;
                    return (
                      <SVGChartContainer W={W} H={H} ariaLabel="VAE latent space projection">
                        <ChartGrid W={W} H={H} PAD={PAD} gridCount={0} showGrid={false} />
                        <ChartAxisLabels W={W} H={H} PAD={PAD} xLabel="Projection 1" yLabel="Projection 2" />
                        {pts.map((p, i) => {
                          const cx = PAD + ((xs[i] - xMin) / xR) * (W - PAD * 2);
                          const cy = H - PAD - ((ys[i] - yMin) / yR) * (H - PAD * 2);
                          const eff = p.metabolicEfficiency;
                          const r = Math.round(60 + (1 - eff) * 195);
                          const g = Math.round(120 + eff * 100);
                          const b = Math.round(100 + eff * 80);
                          return (
                            <circle key={p.id} cx={cx} cy={cy} r={5} fill={`rgb(${r},${g},${b})`} opacity={0.85}>
                              <title>{p.gene}: eff={eff.toFixed(3)}</title>
                            </circle>
                          );
                        })}
                      </SVGChartContainer>
                    );
                  })()}
                </div>
              </div>
              <div style={{ height: '100px', padding: '0 20px 12px', flexShrink: 0 }}>
                {(() => {
                  const hist = vaeResult?.convergenceHistory ?? [];
                  if (hist.length === 0) return null;
                  const W = 480, H = 80, PAD = 30;
                  const maxL = Math.max(...hist.map(h => h.loss), 0.01);
                  return (
                    <SVGChartContainer W={W} H={H} ariaLabel="VAE convergence history" fill="transparent">
                      <text x={PAD - 4} y={12} fontFamily={THEME.MONO} fontSize="10" fill={LABEL} textAnchor="end">Loss</text>
                      <polyline points={hist.map((h, i) => { const x = PAD + (i / (hist.length - 1)) * (W - PAD * 2); const y = H - 8 - (h.loss / maxL) * (H - 20); return `${x},${y}`; }).join(' ')} fill="none" stroke={LAYER_COLORS.proteomics} strokeWidth={1.5} />
                      <text x={W / 2} y={H - 1} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={LABEL}>Epoch</text>
                    </SVGChartContainer>
                  );
                })()}
              </div>
            </div>
            )}
          </ScientificFigureFrame>
        </div>
      </ToolTabPanel>

      {/* ── Efficiency Tab ── */}
      <ToolTabPanel tabId="efficiency" activeId={activeTab}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <ScientificFigureFrame
            eyebrow="Metabolic Efficiency Ledger"
            title="Ranked entities ordered by production-relevant efficiency"
            caption="Efficiency ranking connects deterministic integration back to exploratory prioritization."
            minHeight="100%"
            legend={[
              { label: 'Avg Eff', value: `${(efficiencyScores.reduce((s, e) => s + e.score, 0) / Math.max(1, efficiencyScores.length) * 100).toFixed(1)}%`, accent: THEME.MINT },
              { label: 'Top Gene', value: [...efficiencyScores].sort((a, b) => b.score - a.score)[0]?.gene ?? '—', accent: THEME.SKY },
            ]}
          >
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px 16px', flex: '1 0 140px' }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, display: 'block' }}>Avg Efficiency</span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700, color: THEME.MINT }}>{(efficiencyScores.reduce((s, e) => s + e.score, 0) / Math.max(1, efficiencyScores.length) * 100).toFixed(1)}%</span>
              </div>
              <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px 16px', flex: '1 0 140px' }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, display: 'block' }}>Top Gene</span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-md)', fontWeight: 700, color: VALUE }}>{[...efficiencyScores].sort((a, b) => b.score - a.score)[0]?.gene ?? '—'}</span>
              </div>
            </div>
            {[...efficiencyScores].sort((a, b) => b.score - a.score).map((e, i) => {
              const pct = e.score * 100;
              const color = pct > 60 ? THEME.MINT : pct > 35 ? THEME.RISK_LOW : THEME.CORAL;
              return (
                <div key={e.geneId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL, width: '20px', textAlign: 'right' }}>{i + 1}</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, width: '70px' }}>{e.gene}</span>
                  <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: PAPER_THEME.grid }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: color, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color, width: '45px', textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '1px 4px', borderRadius: '4px', background: `${LAYER_COLORS.transcriptomics}20`, color: LAYER_COLORS.transcriptomics }}>F:{e.fluxUtilization.toFixed(2)}</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '1px 4px', borderRadius: '4px', background: `${LAYER_COLORS.proteomics}20`, color: LAYER_COLORS.proteomics }}>E:{e.expressionBalance.toFixed(2)}</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '1px 4px', borderRadius: '4px', background: `${LAYER_COLORS.metabolomics}20`, color: LAYER_COLORS.metabolomics }}>Y:{e.metaboliteYield.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </ScientificFigureFrame>
        </div>
      </ToolTabPanel>
    </ToolShell>
  );
});
