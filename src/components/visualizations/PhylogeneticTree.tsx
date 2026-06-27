"use client";
/**
 * PhylogeneticTree — d3-based rectangular phylogram visualization.
 *
 * Renders a phylogenetic tree from Newick format using d3's hierarchy layout.
 * Supports:
 *   - Rectangular (cladogram / phylogram) rendering
 *   - Branch length scaling (proportional) or uniform (cladogram mode)
 *   - Leaf labels with branch-length annotations
 *   - Zoom and pan via d3-zoom
 *   - Click-to-select nodes with highlight
 *   - Responsive SVG
 *
 * Dark theme follows Nexus-Bio design tokens.
 */

import { hierarchy, type HierarchyNode } from "d3-hierarchy";
import { scaleLinear, scalePoint } from "d3-scale";
import { zoom } from "d3-zoom";
import { select } from "d3-selection";
import { symbol, symbolDiamond } from "d3-shape";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { THEME } from "../../theme";
import {
  type ParseResult,
  type PhyloNode,
  parseNewick,
} from "../../utils/newickParser";

// ── Public types ──────────────────────────────────────────────────────────────

export interface PhylogeneticTreeProps {
  /** Newick string to render. */
  newick: string;
  /** Render width in pixels (default 800). */
  width?: number;
  /** Render height in pixels (default 600). */
  height?: number;
  /** If true, all branches have equal length (cladogram). Default: false (phylogram). */
  cladogramMode?: boolean;
  /** Callback when a leaf node is clicked. */
  onNodeClick?: (node: PhyloNode) => void;
  /** Margin around the tree area. */
  margin?: { top: number; right: number; bottom: number; left: number };
}

// ── Layout node ───────────────────────────────────────────────────────────────

interface TreeNode {
  /** Original PhyloNode data. */
  data: PhyloNode;
  /** x position (horizontal = root-to-leaf distance). */
  x: number;
  /** y position (vertical = leaf ordering). */
  y: number;
  /** Parent in the layout tree. */
  parent: TreeNode | null;
  /** Children in the layout tree. */
  children: TreeNode[];
  /** Depth (root = 0). */
  depth: number;
}

// ── Build d3 hierarchy-compatible structure ───────────────────────────────────

function buildHierarchyData(node: PhyloNode): HierarchyNode<PhyloNode> {
  const root = hierarchy<PhyloNode>(node, (d) =>
    d.children.length > 0 ? d.children : null,
  );
  return root;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PhylogeneticTree({
  newick,
  width = 800,
  height = 600,
  cladogramMode = false,
  onNodeClick,
  margin = { top: 20, right: 180, bottom: 20, left: 60 },
}: PhylogeneticTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Parse Newick
  useEffect(() => {
    try {
      const result = parseNewick(newick);
      setParseResult(result);
      setParseError(null);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Unknown parse error",
      );
      setParseResult(null);
    }
  }, [newick]);

  // Layout computation
  const { nodes, links } = useMemo(() => {
    if (!parseResult) return { nodes: [], links: [] };

    const root = buildHierarchyData(parseResult.root);
    const leaves: Array<HierarchyNode<PhyloNode>> = [];
    root.each((n) => {
      if (n.children === undefined || n.children.length === 0) {
        leaves.push(n);
      }
    });

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    // y-scale: distribute leaves evenly
    const yScale = scalePoint<string>()
      .domain(leaves.map((l) => l.data.name || `node-${l.depth}`))
      .range([0, innerH])
      .padding(0.5);

    // x-scale: branch length proportional or uniform
    const maxX = cladogramMode
      ? (root.height ?? 0)
      : parseResult.maxRootDistance || 1;

    const xScale = scaleLinear().domain([0, maxX]).range([0, innerW]);

    // Compute positions
    const nodePositions: Map<
      HierarchyNode<PhyloNode>,
      { x: number; y: number }
    > = new Map();

    // First pass: assign y to leaves
    let leafIdx = 0;
    root.each((node) => {
      if (!node.children || node.children.length === 0) {
        nodePositions.set(node, {
          x: cladogramMode
            ? xScale(node.depth)
            : xScale(node.data.rootDistance),
          y: yScale(node.data.name || `leaf-${leafIdx}`) ?? 0,
        });
        leafIdx++;
      }
    });

    // Second pass: assign y to internal nodes (midpoint of children)
    function assignInternalY(
      node: HierarchyNode<PhyloNode>,
    ): number {
      if (node.children && node.children.length > 0) {
        const childYs = node.children.map((c) => assignInternalY(c));
        const midY = (Math.min(...childYs) + Math.max(...childYs)) / 2;
        nodePositions.set(node, {
          x: cladogramMode
            ? xScale(node.depth)
            : xScale(node.data.rootDistance),
          y: midY,
        });
        return midY;
      }
      return nodePositions.get(node)?.y ?? 0;
    }
    assignInternalY(root);

    // Build node list
    const nodeArr: Array<{
      x: number;
      y: number;
      data: PhyloNode;
      isLeaf: boolean;
    }> = [];
    root.each((node) => {
      const pos = nodePositions.get(node);
      if (pos) {
        nodeArr.push({
          x: pos.x,
          y: pos.y,
          data: node.data,
          isLeaf: !node.children || node.children.length === 0,
        });
      }
    });

    // Build links (rectangular: parent -> elbow -> child)
    const linkArr: Array<{
      source: { x: number; y: number };
      target: { x: number; y: number };
      data: PhyloNode;
    }> = [];

    root.each((node) => {
      const pos = nodePositions.get(node);
      if (!pos) return;
      if (node.children) {
        for (const child of node.children) {
          const childPos = nodePositions.get(child);
          if (childPos) {
            linkArr.push({
              source: { x: pos.x, y: pos.y },
              target: { x: childPos.x, y: childPos.y },
              data: child.data,
            });
          }
        }
      }
    });

    return { nodes: nodeArr, links: linkArr };
  }, [parseResult, width, height, cladogramMode, margin]);

  // Render SVG
  useEffect(() => {
    if (!svgRef.current || !parseResult) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Zoom
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoomBehavior);

    // ── Draw rectangular branches ─────────────────────────────────────────
    const branchGroup = g.append("g").attr("class", "branches");

    for (const link of links) {
      const { source, target } = link;
      // Rectangular path: horizontal then vertical (elbow)
      const path = `M${source.x},${source.y} L${target.x},${source.y} L${target.x},${target.y}`;

      branchGroup
        .append("path")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", THEME.SKY)
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.7);
    }

    // ── Draw nodes ────────────────────────────────────────────────────────
    const nodeGroup = g.append("g").attr("class", "nodes");

    for (const node of nodes) {
      const isSelected = selectedNode === node.data.name;

      if (node.isLeaf) {
        // Leaf node: circle
        nodeGroup
          .append("circle")
          .attr("cx", node.x)
          .attr("cy", node.y)
          .attr("r", 4)
          .attr("fill", isSelected ? THEME.CORAL : THEME.MINT)
          .attr("stroke", THEME.BORDER)
          .attr("stroke-width", 1)
          .style("cursor", "pointer")
          .on("click", () => {
            setSelectedNode(
              node.data.name === selectedNode ? null : node.data.name,
            );
            onNodeClick?.(node.data);
          });

        // Leaf label
        nodeGroup
          .append("text")
          .attr("x", node.x + 10)
          .attr("y", node.y)
          .attr("dy", "0.35em")
          .attr("font-size", THEME.FS_SM)
          .attr("font-family", THEME.MONO)
          .attr("fill", isSelected ? THEME.CORAL : THEME.INK)
          .text(node.data.name);

        // Branch length annotation
        if (node.data.branchLength > 0) {
          nodeGroup
            .append("text")
            .attr("x", (node.x + (node.x - node.data.branchLength)) / 2)
            .attr("y", node.y - 10)
            .attr("text-anchor", "middle")
            .attr("font-size", "9px")
            .attr("font-family", THEME.MONO)
            .attr("fill", THEME.INK_SOFT)
            .text(node.data.branchLength.toFixed(3));
        }
      } else {
        // Internal node: small diamond
        nodeGroup
          .append("path")
          .attr(
            "d",
            symbol<unknown>()
              .type(symbolDiamond)
              .size(40)(undefined) as string,
          )
          .attr("transform", `translate(${node.x},${node.y})`)
          .attr("fill", isSelected ? THEME.CORAL : THEME.LILAC)
          .attr("stroke", THEME.BORDER)
          .attr("stroke-width", 0.5)
          .style("cursor", "pointer")
          .on("click", () => {
            setSelectedNode(
              node.data.name === selectedNode ? null : node.data.name,
            );
            onNodeClick?.(node.data);
          });

        // Internal node label (if named)
        if (node.data.name) {
          nodeGroup
            .append("text")
            .attr("x", node.x)
            .attr("y", node.y - 12)
            .attr("text-anchor", "middle")
            .attr("font-size", THEME.FS_XS)
            .attr("font-family", THEME.SANS)
            .attr("fill", THEME.LILAC)
            .attr("font-style", "italic")
            .text(node.data.name);
        }
      }
    }

    // ── Scale bar ─────────────────────────────────────────────────────────
    if (!cladogramMode && parseResult.maxRootDistance > 0) {
      const barLen = parseResult.maxRootDistance * 0.1;
      const barY = height - margin.bottom - 10;
      const barG = g.append("g").attr("class", "scale-bar");

      barG
        .append("line")
        .attr("x1", 0)
        .attr("y1", barY)
        .attr("x2", barLen * ((width - margin.left - margin.right) / parseResult.maxRootDistance))
        .attr("y2", barY)
        .attr("stroke", THEME.INK_SOFT)
        .attr("stroke-width", 1.5);

      barG
        .append("text")
        .attr(
          "x",
          (barLen * ((width - margin.left - margin.right) / parseResult.maxRootDistance)) / 2,
        )
        .attr("y", barY + 14)
        .attr("text-anchor", "middle")
        .attr("font-size", THEME.FS_XS)
        .attr("font-family", THEME.MONO)
        .attr("fill", THEME.INK_SOFT)
        .text(`substitutions/site`);
    }
  }, [
    nodes,
    links,
    parseResult,
    width,
    height,
    margin,
    cladogramMode,
    selectedNode,
    onNodeClick,
  ]);

  // ── Error state ────────────────────────────────────────────────────────
  if (parseError) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: THEME.BG_CANVAS,
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
            Newick Parse Error
          </div>
          <div
            style={{
              color: THEME.INK_SOFT,
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_SM,
              maxWidth: 400,
              wordBreak: "break-word",
            }}
          >
            {parseError}
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────
  if (!parseResult || nodes.length === 0) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: THEME.BG_CANVAS,
          borderRadius: THEME.R_MD,
          border: `1px solid ${THEME.BORDER}`,
        }}
      >
        <div
          style={{
            color: THEME.INK_SOFT,
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_SM,
          }}
        >
          No tree data
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: THEME.BG_CANVAS,
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
          {parseResult.leaves.length} taxa
        </span>
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
            color: THEME.INK_SOFT,
          }}
        >
          {parseResult.nodeCount} nodes
        </span>
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
            color: THEME.INK_SOFT,
          }}
        >
          {cladogramMode ? "cladogram" : "phylogram"}
        </span>
        {selectedNode && (
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              color: THEME.CORAL,
              marginLeft: "auto",
            }}
          >
            selected: {selectedNode}
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ display: "block" }}
      />
    </div>
  );
}

export default PhylogeneticTree;
