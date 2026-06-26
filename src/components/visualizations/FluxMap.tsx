"use client";
/**
 * FluxMap — Escher-style SVG metabolic flux visualization.
 *
 * Renders a d3-force-directed network of metabolite nodes and reaction edges.
 * Edge widths are proportional to |flux|, arrowheads indicate direction,
 * and subsystem background rectangles cluster related reactions.
 *
 * Props accept a generic metabolic model + flux dictionary so this component
 * can be reused across FBA, community FBA, and any other flux solver output.
 */

import * as d3 from "d3";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { THEME, TOOL_RESULT_PALETTE } from "../../theme";

// ── Public types ─────────────────────────────────────────────────────────────

export interface FluxMapMetabolite {
  id: string;
  name: string;
  compartment?: string;
}

export interface FluxMapReaction {
  id: string;
  name: string;
  /** metabolite_id -> stoichiometric coefficient (negative = reactant, positive = product). */
  stoichiometry: Record<string, number>;
  subsystem?: string;
  lowerBound?: number;
  upperBound?: number;
}

export interface FluxMapModel {
  metabolites: FluxMapMetabolite[];
  reactions: FluxMapReaction[];
}

export interface FluxMapProps {
  model: FluxMapModel;
  /** reaction_id -> flux value (mmol/gDW/h). */
  fluxes: Record<string, number>;
  width?: number;
  height?: number;
  onReactionClick?: (reactionId: string) => void;
  onMetaboliteClick?: (metaboliteId: string) => void;
}

// ── Subsystem palette ────────────────────────────────────────────────────────

const SUBSYSTEM_COLORS = [
  "#5151CD", // blue
  "#93CB52", // green
  "#DDD0E8", // lavender
  "#E8DCC8", // apricot
  "#C8D8E8", // sky
  "#C8E0D0", // mint
  "#FA8072", // salmon
  "#93CB52", // green2
];

// ── Flux direction colors ────────────────────────────────────────────────────

const FLUX_FWD = "#BFDCCD"; // mint
const FLUX_REV = "#E8A3A1"; // coral
const FLUX_ZERO = "#333"; // gray

// ── Force layout helper ──────────────────────────────────────────────────────

interface LayoutNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  isMetabolite: boolean;
  subsystem?: string;
  radius: number;
}

interface LayoutLink extends d3.SimulationLinkDatum<LayoutNode> {
  reactionId: string;
  reactionName: string;
  subsystem?: string;
  flux: number;
}

function buildGraph(model: FluxMapModel, fluxes: Record<string, number>): { nodes: LayoutNode[]; links: LayoutLink[] } {
  const metaboliteIds = new Set(model.metabolites.map((m) => m.id));
  const nodeMap = new Map<string, LayoutNode>();

  // Create metabolite nodes
  for (const m of model.metabolites) {
    nodeMap.set(m.id, {
      id: m.id,
      name: m.name,
      isMetabolite: true,
      subsystem: m.compartment,
      radius: 10,
    });
  }

  // Build links from stoichiometry: for each reaction, connect reactants to products
  const links: LayoutLink[] = [];
  for (const rxn of model.reactions) {
    const flux = fluxes[rxn.id] ?? 0;
    const reactants = Object.entries(rxn.stoichiometry)
      .filter(([, coeff]) => coeff < 0)
      .map(([id]) => id);
    const products = Object.entries(rxn.stoichiometry)
      .filter(([, coeff]) => coeff > 0)
      .map(([id]) => id);

    // Connect each reactant to each product
    for (const src of reactants) {
      for (const tgt of products) {
        if (!metaboliteIds.has(src) || !metaboliteIds.has(tgt)) continue;
        links.push({
          source: src,
          target: tgt,
          reactionId: rxn.id,
          reactionName: rxn.name,
          subsystem: rxn.subsystem,
          flux,
        });
      }
    }
  }

  return { nodes: Array.from(nodeMap.values()), links };
}

// ── Edge width scale ─────────────────────────────────────────────────────────

function edgeWidth(absFlux: number, maxFlux: number): number {
  if (maxFlux <= 0) return 1;
  const t = Math.min(absFlux / maxFlux, 1);
  return 1 + t * 19; // 1px to 20px
}

// ── Bezier path between two points ───────────────────────────────────────────

function bezierPath(sx: number, sy: number, tx: number, ty: number, curvature = 0.15): string {
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const mx = (sx + tx) / 2 + (-dy / len) * len * curvature;
  const my = (sy + ty) / 2 + (dx / len) * len * curvature;
  return `M ${sx},${sy} Q ${mx},${my} ${tx},${ty}`;
}

// ── Main component ───────────────────────────────────────────────────────────

export function FluxMap({
  model,
  fluxes,
  width = 900,
  height = 600,
  onReactionClick,
  onMetaboliteClick,
}: FluxMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null);
  const [hoveredMetabolite, setHoveredMetabolite] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  // Build graph data
  const { nodes, links } = useMemo(() => buildGraph(model, fluxes), [model, fluxes]);

  // Compute max flux for scaling
  const maxFlux = useMemo(() => Math.max(...links.map((l) => Math.abs(l.flux)), 1), [links]);

  // Run d3-force layout
  const positions = useMemo(() => {
    if (nodes.length === 0) return new Map<string, { x: number; y: number }>();

    const simNodes: LayoutNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: LayoutLink[] = links.map((l) => ({
      ...l,
      source: typeof l.source === "object" ? l.source.id : l.source,
      target: typeof l.target === "object" ? l.target.id : l.target,
    }));

    const simulation = d3
      .forceSimulation<LayoutNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<LayoutNode, LayoutLink>(simLinks)
          .id((d) => d.id)
          .distance(80)
          .strength(0.4),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3.forceCollide().radius((d) => (d as LayoutNode).radius + 8),
      )
      .stop();

    // Run simulation to convergence
    simulation.tick(300);

    const posMap = new Map<string, { x: number; y: number }>();
    for (const n of simNodes) {
      posMap.set(n.id, {
        x: Math.max(40, Math.min(width - 40, n.x ?? width / 2)),
        y: Math.max(40, Math.min(height - 40, n.y ?? height / 2)),
      });
    }
    return posMap;
  }, [nodes, links, width, height]);

  // Compute subsystem bounding boxes
  const subsystemBounds = useMemo(() => {
    const groups = new Map<string, { minX: number; minY: number; maxX: number; maxY: number; color: string }>();
    const colorMap = new Map<string, string>();
    let colorIdx = 0;

    for (const link of links) {
      const sub = link.subsystem;
      if (!sub) continue;
      if (!colorMap.has(sub)) {
        colorMap.set(sub, SUBSYSTEM_COLORS[colorIdx % SUBSYSTEM_COLORS.length]);
        colorIdx++;
      }

      const srcId = String(typeof link.source === "object" ? link.source.id : link.source);
      const tgtId = String(typeof link.target === "object" ? link.target.id : link.target);
      const sp = positions.get(srcId);
      const tp = positions.get(tgtId);
      if (!sp || !tp) continue;

      if (!groups.has(sub)) {
        groups.set(sub, {
          minX: Math.min(sp.x, tp.x),
          minY: Math.min(sp.y, tp.y),
          maxX: Math.max(sp.x, tp.x),
          maxY: Math.max(sp.y, tp.y),
          color: colorMap.get(sub)!,
        });
      } else {
        const g = groups.get(sub)!;
        g.minX = Math.min(g.minX, sp.x, tp.x);
        g.minY = Math.min(g.minY, sp.y, tp.y);
        g.maxX = Math.max(g.maxX, sp.x, tp.x);
        g.maxY = Math.max(g.maxY, sp.y, tp.y);
      }
    }

    // Expand bounds with padding
    const PAD = 50;
    const result: Array<{
      key: string;
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
    }> = [];
    for (const [key, g] of groups) {
      result.push({
        key,
        x: g.minX - PAD,
        y: g.minY - PAD,
        w: g.maxX - g.minX + PAD * 2,
        h: g.maxY - g.minY + PAD * 2,
        color: g.color,
      });
    }
    return result;
  }, [links, positions]);

  // Zoom behavior
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const zoomGroup = d3.select(svg).select<SVGGElement>("[data-zoom-group]");
    if (zoomGroup.empty()) return;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        zoomGroup.attr("transform", event.transform);
      });

    d3.select(svg).call(zoom);

    // Double-click to reset
    d3.select(svg).on("dblclick.zoom", () => {
      d3.select(svg).transition().duration(300).call(zoom.transform, d3.zoomIdentity);
    });

    return () => {
      d3.select(svg).on(".zoom", null);
    };
  }, []);

  // Tooltip positioning
  const handleReactionHover = useCallback(
    (reactionId: string, flux: number, event: React.MouseEvent) => {
      setHoveredReaction(reactionId);
      const rxn = model.reactions.find((r) => r.id === reactionId);
      setTooltip({
        x: event.clientX,
        y: event.clientY,
        text: `${rxn?.name ?? reactionId}: ${flux.toFixed(2)} mmol/gDW/h`,
      });
    },
    [model.reactions],
  );

  const handleMetaboliteHover = useCallback(
    (metaboliteId: string, event: React.MouseEvent) => {
      setHoveredMetabolite(metaboliteId);
      const met = model.metabolites.find((m) => m.id === metaboliteId);
      setTooltip({
        x: event.clientX,
        y: event.clientY,
        text: met?.name ?? metaboliteId,
      });
    },
    [model.metabolites],
  );

  const clearHover = useCallback(() => {
    setHoveredReaction(null);
    setHoveredMetabolite(null);
    setTooltip(null);
  }, []);

  // Collect reaction IDs connected to hovered metabolite
  const connectedReactions = useMemo(() => {
    if (!hoveredMetabolite) return new Set<string>();
    const ids = new Set<string>();
    for (const rxn of model.reactions) {
      if (hoveredMetabolite in rxn.stoichiometry) {
        ids.add(rxn.id);
      }
    }
    return ids;
  }, [hoveredMetabolite, model.reactions]);

  // Collect metabolite IDs connected to hovered reaction
  const connectedMetabolites = useMemo(() => {
    if (!hoveredReaction) return new Set<string>();
    const rxn = model.reactions.find((r) => r.id === hoveredReaction);
    if (!rxn) return new Set<string>();
    return new Set(Object.keys(rxn.stoichiometry));
  }, [hoveredReaction, model.reactions]);

  // Assign subsystem colors
  const subsystemColorMap = useMemo(() => {
    const map = new Map<string, string>();
    let idx = 0;
    for (const rxn of model.reactions) {
      const sub = rxn.subsystem;
      if (sub && !map.has(sub)) {
        map.set(sub, SUBSYSTEM_COLORS[idx % SUBSYSTEM_COLORS.length]);
        idx++;
      }
    }
    return map;
  }, [model.reactions]);

  return (
    <div data-testid="flux-map-container" style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg
        ref={svgRef}
        data-testid="flux-map-svg"
        role="img"
        aria-label="Escher-style metabolic flux map"
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: "100%",
          height: "100%",
          background: "#050505",
          borderRadius: 8,
        }}
      >
        <defs>
          {/* Arrowhead markers */}
          <marker
            id="flux-fwd-marker"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <polygon points="0 0.5, 7.5 4, 0 7.5" fill={FLUX_FWD} />
          </marker>
          <marker
            id="flux-rev-marker"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <polygon points="0 0.5, 7.5 4, 0 7.5" fill={FLUX_REV} />
          </marker>
          <marker
            id="flux-zero-marker"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <polygon points="0 0.5, 7.5 4, 0 7.5" fill={FLUX_ZERO} />
          </marker>
          {/* Glow filter for hovered elements */}
          <filter id="flux-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <g data-zoom-group>
          {/* Subsystem background rectangles */}
          {subsystemBounds.map((sb) => (
            <g key={sb.key} data-testid={`subsystem-bg-${sb.key}`}>
              <rect
                x={sb.x}
                y={sb.y}
                width={sb.w}
                height={sb.h}
                rx={12}
                fill={sb.color}
                fillOpacity={0.1}
                stroke={sb.color}
                strokeOpacity={0.2}
                strokeDasharray="4 3"
              />
              <text x={sb.x + 12} y={sb.y + 18} fontFamily={THEME.MONO} fontSize={11} fill={sb.color} opacity={0.7}>
                {sb.key}
              </text>
            </g>
          ))}

          {/* Reaction edges */}
          {links.map((link, i) => {
            const srcId = String(typeof link.source === "object" ? link.source.id : link.source);
            const tgtId = String(typeof link.target === "object" ? link.target.id : link.target);
            const sp = positions.get(srcId);
            const tp = positions.get(tgtId);
            if (!sp || !tp) return null;

            const absFlux = Math.abs(link.flux);
            const sw = edgeWidth(absFlux, maxFlux);
            const isReverse = link.flux < -0.01;
            const isZero = absFlux < 0.01;
            const isHighlighted =
              hoveredReaction === link.reactionId ||
              (hoveredMetabolite != null && connectedReactions.has(link.reactionId));
            const isDimmed =
              (hoveredReaction != null && hoveredReaction !== link.reactionId) ||
              (hoveredMetabolite != null && !connectedReactions.has(link.reactionId));

            const color = isZero ? FLUX_ZERO : isReverse ? FLUX_REV : FLUX_FWD;
            const markerEnd = isZero
              ? "url(#flux-zero-marker)"
              : isReverse
                ? "url(#flux-rev-marker)"
                : "url(#flux-fwd-marker)";

            const d = bezierPath(sp.x, sp.y, tp.x, tp.y);

            return (
              <g
                key={`${link.reactionId}-${i}`}
                data-testid={`reaction-edge-${link.reactionId}`}
                onMouseEnter={(e) => handleReactionHover(link.reactionId, link.flux, e)}
                onMouseMove={(e) => handleReactionHover(link.reactionId, link.flux, e)}
                onMouseLeave={clearHover}
                onClick={() => onReactionClick?.(link.reactionId)}
                style={{ cursor: onReactionClick ? "pointer" : "default" }}
              >
                <path
                  d={d}
                  stroke={color}
                  strokeWidth={sw}
                  strokeLinecap="round"
                  fill="none"
                  markerEnd={markerEnd}
                  opacity={isDimmed ? 0.15 : isHighlighted ? 1 : 0.7}
                  filter={isHighlighted ? "url(#flux-glow)" : undefined}
                />
                {/* Flux label at midpoint */}
                {!isZero && (
                  <text
                    x={(sp.x + tp.x) / 2}
                    y={(sp.y + tp.y) / 2 - sw / 2 - 4}
                    textAnchor="middle"
                    fontFamily={THEME.MONO}
                    fontSize={10}
                    fill={THEME.LABEL}
                    opacity={isDimmed ? 0.2 : 0.8}
                  >
                    {absFlux.toFixed(1)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Metabolite nodes */}
          {nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            const isHovered = hoveredMetabolite === node.id;
            const isConnected = hoveredReaction != null && connectedMetabolites.has(node.id);
            const isDimmed = (hoveredMetabolite != null && !isHovered) || (hoveredReaction != null && !isConnected);
            const r = node.radius;

            return (
              <g
                key={node.id}
                data-testid={`metabolite-node-${node.id}`}
                onMouseEnter={(e) => handleMetaboliteHover(node.id, e)}
                onMouseMove={(e) => handleMetaboliteHover(node.id, e)}
                onMouseLeave={clearHover}
                onClick={() => onMetaboliteClick?.(node.id)}
                style={{ cursor: onMetaboliteClick ? "pointer" : "default" }}
              >
                {/* Glow halo on hover */}
                {isHovered && <circle cx={pos.x} cy={pos.y} r={r + 8} fill="#C8D8E8" opacity={0.12} />}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={r}
                  fill="#C8D8E8"
                  stroke="#1a1d24"
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  opacity={isDimmed ? 0.25 : 1}
                  filter={isHovered ? "url(#flux-glow)" : undefined}
                />
                <text
                  x={pos.x}
                  y={pos.y + 3.5}
                  textAnchor="middle"
                  fontFamily={THEME.SANS}
                  fontSize={10}
                  fontWeight={600}
                  fill="#050505"
                  opacity={isDimmed ? 0.3 : 1}
                >
                  {node.name.length > 6 ? node.name.slice(0, 5) + ".." : node.name}
                </text>
                {/* Name label below node */}
                <text
                  x={pos.x}
                  y={pos.y + r + 14}
                  textAnchor="middle"
                  fontFamily={THEME.SANS}
                  fontSize={9}
                  fill={THEME.LABEL}
                  opacity={isDimmed ? 0.2 : 0.75}
                >
                  {node.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          data-testid="flux-map-tooltip"
          style={{
            position: "fixed",
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            background: "rgba(17,19,24,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            padding: "4px 10px",
            fontFamily: THEME.MONO,
            fontSize: 11,
            color: THEME.VALUE,
            pointerEvents: "none",
            zIndex: 9999,
            whiteSpace: "nowrap",
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
