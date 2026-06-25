"use client";
import React, { useMemo } from "react";
import { THEME } from "../../../theme";
import type { EmbeddingPoint, OmicsLayer } from "../../../types";
import { computeConvexHull, expandHull } from "../../../utils/vizUtils";
import { PAPER_THEME } from "../../charts/chartTheme";
import { SVGChartContainer } from "../../charts/primitives";
import { LAYER_COLORS } from "./multiOHelpers";

/* ── 3D→2D Embedding Scatter (SVG) ───────────────────────────────── */

const {
  panelBg: PANEL_BG,
  border: BORDER,
  label: LABEL,
  value: VALUE,
} = {
  panelBg: THEME.PANEL_BG,
  border: THEME.PANEL_BORDER,
  label: THEME.LABEL,
  value: THEME.VALUE,
};

export function EmbeddingScatter({
  embeddings,
  fcThreshold,
  activeLayers,
  highlightedGene,
  bottleneckGene,
  geneFC,
}: {
  embeddings: EmbeddingPoint[];
  fcThreshold: number;
  activeLayers: Record<OmicsLayer, boolean>;
  highlightedGene?: string;
  bottleneckGene?: string;
  geneFC: Record<string, number>;
}) {
  const W = 520,
    H = 420,
    PAD = 44;

  const visible = useMemo(() => embeddings.filter((p) => activeLayers[p.layer]), [embeddings, activeLayers]);

  const projected = useMemo(() => {
    const pts = visible.map((p) => ({
      ...p,
      px: p.coords[0] * 0.866 - p.coords[2] * 0.866,
      py: -p.coords[1] + p.coords[0] * 0.5 + p.coords[2] * 0.5,
    }));
    if (pts.length === 0) return [];
    const xs = pts.map((p) => p.px);
    const ys = pts.map((p) => p.py);
    const xMin = Math.min(...xs),
      xMax = Math.max(...xs);
    const yMin = Math.min(...ys),
      yMax = Math.max(...ys);
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    return pts.map((p) => ({
      ...p,
      sx: PAD + ((p.px - xMin) / xRange) * (W - PAD * 2),
      sy: PAD + ((p.py - yMin) / yRange) * (H - PAD * 2),
    }));
  }, [visible, W, H]);

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
      <rect
        x={PAD}
        y={PAD}
        width={W - PAD * 2}
        height={H - PAD * 2}
        fill={PAPER_THEME.bgAlt}
        stroke={PAPER_THEME.grid}
        rx={PAPER_THEME.borderRadius}
      />
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
      <line
        x1={PAD}
        y1={H - PAD}
        x2={W - PAD}
        y2={H - PAD}
        stroke={PAPER_THEME.axis}
        strokeWidth={PAPER_THEME.axisWidth}
      />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke={PAPER_THEME.axis} strokeWidth={PAPER_THEME.axisWidth} />
      <text x={W / 2} y={H - 6} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={LABEL}>
        Embed-1 (linear projection)
      </text>
      <text
        x={12}
        y={H / 2}
        textAnchor="middle"
        fontFamily={THEME.MONO}
        fontSize="10"
        fill={LABEL}
        transform={`rotate(-90,12,${H / 2})`}
      >
        Embed-2 (linear projection)
      </text>
      {/* Omics-layer convex hull territories */}
      {(() => {
        type Layer = "transcriptomics" | "proteomics" | "metabolomics";
        const byLayer: Record<Layer, Array<{ sx: number; sy: number }>> = {
          transcriptomics: [],
          proteomics: [],
          metabolomics: [],
        };
        projected.forEach((p) => byLayer[p.layer as Layer]?.push({ sx: p.sx, sy: p.sy }));
        return (Object.entries(byLayer) as Array<[Layer, Array<{ sx: number; sy: number }>]>)
          .filter(([layer, pts]) => pts.length >= 3 && activeLayers[layer])
          .map(([layer, pts]) => {
            const color = LAYER_COLORS[layer];
            const hull = expandHull(computeConvexHull(pts), 14);
            const poly = hull.map((p) => `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(" ");
            return (
              <g key={`hull-${layer}`}>
                <defs>
                  <filter id={`omics-blur-${layer}`} x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="6" />
                  </filter>
                </defs>
                <polygon points={poly} fill={color} opacity={0.13} filter={`url(#omics-blur-${layer})`} />
                <polygon
                  points={poly}
                  fill={color}
                  opacity={0.04}
                  stroke={color}
                  strokeWidth={1.2}
                  strokeOpacity={0.3}
                />
              </g>
            );
          });
      })()}
      {/* Points */}
      {projected.map((p) => {
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
                stroke={p.gene === bottleneckGene ? "rgba(255,139,31,0.88)" : "rgba(240,253,250,0.8)"}
                strokeWidth={1.4}
              />
            )}
            <circle
              cx={p.sx}
              cy={p.sy}
              r={isHighlighted ? 7 : sig ? 6 : 4}
              fill={LAYER_COLORS[p.layer]}
              opacity={sig || isHighlighted ? 1.0 : 0.7}
              style={{ transition: "opacity 0.2s" }}
            >
              <title>
                {p.gene} [{p.layer}] val={p.normalizedValue.toFixed(2)}
              </title>
            </circle>
          </g>
        );
      })}
      {(["transcriptomics", "proteomics", "metabolomics"] as OmicsLayer[]).map((layer) => {
        const centroid = centroids[layer];
        if (!centroid.n || !activeLayers[layer]) return null;
        return (
          <g key={`centroid-${layer}`}>
            <circle
              cx={centroid.sx / centroid.n}
              cy={centroid.sy / centroid.n}
              r={11}
              fill="none"
              stroke={`${LAYER_COLORS[layer]}`}
              strokeWidth={1.1}
              strokeDasharray="4 3"
            />
            <text
              x={centroid.sx / centroid.n}
              y={centroid.sy / centroid.n - 14}
              textAnchor="middle"
              fontFamily={THEME.MONO}
              fontSize="10"
              fill={LAYER_COLORS[layer]}
            >
              {layer.slice(0, 5)}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      {(["transcriptomics", "proteomics", "metabolomics"] as OmicsLayer[]).map((layer, i) => (
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
