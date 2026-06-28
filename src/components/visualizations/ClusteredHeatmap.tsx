"use client";
/**
 * ClusteredHeatmap — d3-based heatmap with UPGMA dendrograms.
 *
 * Renders a clustered heatmap where rows and columns are independently
 * reordered by UPGMA hierarchical clustering. Dendrograms are drawn on
 * the top and left margins. Supports zoom/pan and click-to-select cells.
 *
 * Design follows Nexus-Bio dark theme (#050505 canvas) and viridis palette
 * per CLAUDE.md visualization standards.
 *
 * @scientific_provenance
 * VALIDITY_TIER: real (UPGMA from src/utils/clustering, Euclidean distance)
 */

import { interpolateRgb } from "d3-interpolate";
import { scaleLinear, type ScaleLinear } from "d3-scale";
import { select } from "d3-selection";
import { zoom } from "d3-zoom";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ClusterNode, calculateDistanceMatrix, getLeafOrder, getMaxDistance, upgma } from "../../utils/clustering";
import { THEME } from "../../theme";

// ── Public types ─────────────────────────────────────────────────────────────

export interface ClusteredHeatmapProps {
  /** 2D numeric matrix — data[row][col]. */
  data: number[][];
  /** Labels for each row (must match data.length). */
  rowLabels: string[];
  /** Labels for each column (must match data[0].length). */
  colLabels: string[];
  /** SVG width in pixels (default 900). */
  width?: number;
  /** SVG height in pixels (default 700). */
  height?: number;
  /** Callback when a cell is clicked. */
  onCellClick?: (row: number, col: number, value: number) => void;
}

// ── Viridis color scale ──────────────────────────────────────────────────────

const VIRIDIS_STOPS: Array<[number, string]> = [
  [0.0, "#440154"],
  [0.1, "#482878"],
  [0.2, "#3e4989"],
  [0.3, "#31688e"],
  [0.4, "#26828e"],
  [0.5, "#1f9e89"],
  [0.6, "#35b779"],
  [0.7, "#6ece58"],
  [0.8, "#b5de2b"],
  [0.9, "#fde725"],
  [1.0, "#fde725"],
];

function viridisScale(domain: [number, number]): ScaleLinear<string, string> {
  return scaleLinear<string, number>()
    .domain(VIRIDIS_STOPS.map(([d]) => domain[0] + d * (domain[1] - domain[0])))
    .range(VIRIDIS_STOPS.map(([, c]) => c))
    .interpolate(interpolateRgb.gamma(2.2));
}

// ── Margins ──────────────────────────────────────────────────────────────────

const MARGIN = {
  top: 120, // space for column dendrogram + labels
  right: 40,
  bottom: 20,
  left: 120, // space for row dendrogram + labels
};

const DENDROGRAM_SIZE = 80; // px allocated to each dendrogram

// ── Component ────────────────────────────────────────────────────────────────

export function ClusteredHeatmap({
  data,
  rowLabels,
  colLabels,
  width = 900,
  height = 700,
  onCellClick,
}: ClusteredHeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);

  // ── Validation ─────────────────────────────────────────────────────────────
  const isValid =
    data.length > 0 && data[0].length > 0 && rowLabels.length === data.length && colLabels.length === data[0].length;

  // ── Clustering ─────────────────────────────────────────────────────────────
  const { rowOrder, colOrder, rowRoot, colRoot } = useMemo(() => {
    if (!isValid) {
      return { rowOrder: [], colOrder: [], rowRoot: null, colRoot: null };
    }

    // Cluster rows (each row is a feature vector).
    const rowDist = calculateDistanceMatrix(data);
    const rRoot = upgma(rowDist, rowLabels);
    const rOrder = getLeafOrder(rRoot);

    // Cluster columns (transpose: each column is a feature vector).
    const nRows = data.length;
    const nCols = data[0].length;
    const colVectors: number[][] = Array.from({ length: nCols }, (_, j) =>
      Array.from({ length: nRows }, (_, i) => data[i][j]),
    );
    const colDist = calculateDistanceMatrix(colVectors);
    const cRoot = upgma(colDist, colLabels);
    const cOrder = getLeafOrder(cRoot);

    return { rowOrder: rOrder, colOrder: cOrder, rowRoot: rRoot, colRoot: cRoot };
  }, [data, rowLabels, colLabels, isValid]);

  // ── Scales ─────────────────────────────────────────────────────────────────
  const { innerW, innerH, cellW, cellH, colorScale } = useMemo(() => {
    if (!isValid) {
      return {
        innerW: 0,
        innerH: 0,
        cellW: 0,
        cellH: 0,
        colorScale: viridisScale([0, 1]),
      };
    }
    const iw = width - MARGIN.left - MARGIN.right;
    const ih = height - MARGIN.top - MARGIN.bottom;
    const cw = Math.max(1, iw / data[0].length);
    const ch = Math.max(1, ih / data.length);

    const flat = data.flat();
    const minVal = Math.min(...flat);
    const maxVal = Math.max(...flat);
    const cs = viridisScale([minVal, maxVal]);

    return { innerW: iw, innerH: ih, cellW: cw, cellH: ch, colorScale: cs };
  }, [data, width, height, isValid]);

  // ── Render SVG ─────────────────────────────────────────────────────────────
  const renderChart = useCallback(() => {
    if (!svgRef.current || !isValid || !rowRoot || !colRoot) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    // Background
    svg.append("rect").attr("width", width).attr("height", height).attr("fill", "#050505");

    // Root group
    const g = svg.append("g");

    // ── Zoom ───────────────────────────────────────────────────────────────
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoomBehavior);

    // ── Row dendrogram (left) ──────────────────────────────────────────────
    const rowDendroG = g
      .append("g")
      .attr("class", "row-dendrogram")
      .attr("transform", `translate(${MARGIN.left - DENDROGRAM_SIZE - 4}, ${MARGIN.top})`);

    const rowMaxDist = getMaxDistance(rowRoot);
    const rowXScale = scaleLinear().domain([0, rowMaxDist]).range([DENDROGRAM_SIZE, 0]);

    // Map leaf index to y position in heatmap.
    const rowYMap = new Map<number, number>();
    rowOrder.forEach((idx, pos) => {
      rowYMap.set(idx, pos * cellH + cellH / 2);
    });

    function drawRowDendrogram(node: ClusterNode): number {
      if (node.index !== undefined) {
        return rowYMap.get(node.index) ?? 0;
      }
      const leftY = drawRowDendrogram(node.left!);
      const rightY = drawRowDendrogram(node.right!);
      const x = rowXScale(node.distance);
      const leftX = rowXScale(node.left!.distance);
      const rightX = rowXScale(node.right!.distance);

      // Elbow: horizontal to each child, vertical between them.
      rowDendroG
        .append("path")
        .attr(
          "d",
          `M${x},${leftY} L${leftX},${leftY} M${x},${rightY} L${rightX},${rightY} M${x},${leftY} L${x},${rightY}`,
        )
        .attr("fill", "none")
        .attr("stroke", THEME.SKY)
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.6);

      return (leftY + rightY) / 2;
    }
    drawRowDendrogram(rowRoot);

    // ── Column dendrogram (top) ────────────────────────────────────────────
    const colDendroG = g
      .append("g")
      .attr("class", "col-dendrogram")
      .attr("transform", `translate(${MARGIN.left}, ${MARGIN.top - DENDROGRAM_SIZE - 4})`);

    const colMaxDist = getMaxDistance(colRoot);
    const colYScale = scaleLinear().domain([0, colMaxDist]).range([DENDROGRAM_SIZE, 0]);

    const colXMap = new Map<number, number>();
    colOrder.forEach((idx, pos) => {
      colXMap.set(idx, pos * cellW + cellW / 2);
    });

    function drawColDendrogram(node: ClusterNode): number {
      if (node.index !== undefined) {
        return colXMap.get(node.index) ?? 0;
      }
      const leftX = drawColDendrogram(node.left!);
      const rightX = drawColDendrogram(node.right!);
      const y = colYScale(node.distance);
      const leftY = colYScale(node.left!.distance);
      const rightY = colYScale(node.right!.distance);

      colDendroG
        .append("path")
        .attr(
          "d",
          `M${leftX},${y} L${leftX},${leftY} M${rightX},${y} L${rightX},${rightY} M${leftX},${y} L${rightX},${y}`,
        )
        .attr("fill", "none")
        .attr("stroke", THEME.MINT)
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.6);

      return (leftX + rightX) / 2;
    }
    drawColDendrogram(colRoot);

    // ── Heatmap cells ──────────────────────────────────────────────────────
    const heatmapG = g
      .append("g")
      .attr("class", "heatmap-cells")
      .attr("transform", `translate(${MARGIN.left}, ${MARGIN.top})`);

    for (let ri = 0; ri < rowOrder.length; ri++) {
      for (let ci = 0; ci < colOrder.length; ci++) {
        const origRow = rowOrder[ri];
        const origCol = colOrder[ci];
        const value = data[origRow][origCol];

        heatmapG
          .append("rect")
          .attr("x", ci * cellW)
          .attr("y", ri * cellH)
          .attr("width", Math.max(1, cellW - 0.5))
          .attr("height", Math.max(1, cellH - 0.5))
          .attr("fill", colorScale(value))
          .attr("stroke", selectedCell?.row === origRow && selectedCell?.col === origCol ? THEME.CORAL : "none")
          .attr("stroke-width", selectedCell?.row === origRow && selectedCell?.col === origCol ? 2 : 0)
          .style("cursor", "pointer")
          .on("click", () => {
            setSelectedCell({ row: origRow, col: origCol });
            onCellClick?.(origRow, origCol, value);
          })
          .append("title")
          .text(`${rowLabels[origRow]} / ${colLabels[origCol]}: ${value.toFixed(3)}`);
      }
    }

    // ── Row labels (right side of heatmap) ─────────────────────────────────
    const rowLabelG = g
      .append("g")
      .attr("class", "row-labels")
      .attr("transform", `translate(${MARGIN.left}, ${MARGIN.top})`);

    rowOrder.forEach((origIdx, pos) => {
      rowLabelG
        .append("text")
        .attr("x", innerW + 4)
        .attr("y", pos * cellH + cellH / 2)
        .attr("dy", "0.35em")
        .attr("font-size", Math.min(10, cellH * 0.8))
        .attr("font-family", THEME.MONO)
        .attr("fill", THEME.INK_SOFT)
        .text(rowLabels[origIdx]);
    });

    // ── Column labels (bottom of dendrogram) ───────────────────────────────
    const colLabelG = g
      .append("g")
      .attr("class", "col-labels")
      .attr("transform", `translate(${MARGIN.left}, ${MARGIN.top})`);

    colOrder.forEach((origIdx, pos) => {
      colLabelG
        .append("text")
        .attr("x", pos * cellW + cellW / 2)
        .attr("y", -4)
        .attr("text-anchor", "start")
        .attr("transform", `rotate(-45, ${pos * cellW + cellW / 2}, -4)`)
        .attr("font-size", Math.min(10, cellW * 0.7))
        .attr("font-family", THEME.MONO)
        .attr("fill", THEME.INK_SOFT)
        .text(colLabels[origIdx]);
    });

    // ── Color legend ───────────────────────────────────────────────────────
    const legendW = 120;
    const legendH = 10;
    const legendX = width - MARGIN.right - legendW - 10;
    const legendY = height - MARGIN.bottom - legendH - 20;

    const legendG = g.append("g").attr("transform", `translate(${legendX}, ${legendY})`);

    // Gradient bar
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient").attr("id", "viridis-legend").attr("x1", "0%").attr("x2", "100%");

    VIRIDIS_STOPS.forEach(([offset, color]) => {
      gradient
        .append("stop")
        .attr("offset", `${offset * 100}%`)
        .attr("stop-color", color);
    });

    legendG
      .append("rect")
      .attr("width", legendW)
      .attr("height", legendH)
      .attr("rx", 2)
      .attr("fill", "url(#viridis-legend)");

    const flat = data.flat();
    const minVal = Math.min(...flat);
    const maxVal = Math.max(...flat);

    legendG
      .append("text")
      .attr("x", 0)
      .attr("y", -4)
      .attr("font-size", THEME.FS_XS)
      .attr("font-family", THEME.MONO)
      .attr("fill", THEME.INK_SOFT)
      .text(minVal.toFixed(2));

    legendG
      .append("text")
      .attr("x", legendW)
      .attr("y", -4)
      .attr("text-anchor", "end")
      .attr("font-size", THEME.FS_XS)
      .attr("font-family", THEME.MONO)
      .attr("fill", THEME.INK_SOFT)
      .text(maxVal.toFixed(2));
  }, [
    data,
    rowLabels,
    colLabels,
    rowOrder,
    colOrder,
    rowRoot,
    colRoot,
    width,
    height,
    innerW,
    cellW,
    cellH,
    colorScale,
    selectedCell,
    onCellClick,
    isValid,
  ]);

  useEffect(() => {
    renderChart();
  }, [renderChart]);

  // ── Error state ────────────────────────────────────────────────────────────
  if (!isValid) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050505",
          borderRadius: THEME.R_MD,
          border: `1px solid ${THEME.BORDER}`,
          padding: THEME.SP_MD,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              color: THEME.CORAL,
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_MD,
              marginBottom: THEME.SP_SM,
            }}
          >
            Invalid Data
          </div>
          <div
            style={{
              color: THEME.INK_SOFT,
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_SM,
              maxWidth: 400,
            }}
          >
            data, rowLabels, and colLabels must be non-empty and have matching dimensions.
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: "#050505",
        borderRadius: THEME.R_MD,
        border: `1px solid ${THEME.BORDER}`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Info bar */}
      <div
        style={{
          display: "flex",
          gap: THEME.SP_MD,
          padding: `${THEME.SP_SM}px ${THEME.SP_MD}px`,
          borderBottom: `1px solid ${THEME.BORDER}`,
          background: THEME.BG_PANEL,
        }}
      >
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
            color: THEME.INK_SOFT,
          }}
        >
          {data.length} rows
        </span>
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
            color: THEME.INK_SOFT,
          }}
        >
          {data[0].length} cols
        </span>
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
            color: THEME.INK_SOFT,
          }}
        >
          UPGMA clustered
        </span>
        {selectedCell && (
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              color: THEME.CORAL,
              marginLeft: "auto",
            }}
          >
            {rowLabels[selectedCell.row]} / {colLabels[selectedCell.col]}:{" "}
            {data[selectedCell.row][selectedCell.col].toFixed(3)}
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label="Clustered heatmap visualization"
        style={{ display: "block" }}
      />
    </div>
  );
}

export default ClusteredHeatmap;
