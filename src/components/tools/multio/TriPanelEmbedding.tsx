'use client';
import React, { useMemo } from 'react';
import { SVGChartContainer } from '../../charts/primitives';
import { PAPER_THEME } from '../../charts/chartTheme';
import { THEME } from '../../../theme';
import { computePCABiplot } from '../../../services/MOIEngine';
import type { OmicsRow, OmicsLayer, EmbeddingPoint } from '../../../types';
import { LAYER_COLORS, CLUSTER_PAL, divergingColor, pearsonR } from './multiOHelpers';
import { VolcanoPlot } from './VolcanoPlot';

/* ── Tri-Panel Embedding: PCA biplot + correlation heatmap + volcano ─ */

export function TriPanelEmbedding({ embeddings, data, fcThreshold, pvThreshold, activeLayers, highlightedGene }: {
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
            const ax = cx + a.x, ay = cy - a.y;
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

      {/* RIGHT: Volcano plot */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <VolcanoPlot data={data} fcThreshold={fcThreshold} pvThreshold={pvThreshold} highlightedGene={highlightedGene} />
      </div>
    </div>
  );
}
