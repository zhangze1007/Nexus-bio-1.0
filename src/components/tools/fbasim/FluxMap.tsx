/**
 * FluxMap — Escher-style SVG flux visualization.
 * Extracted from FBASimPage.tsx for modularity.
 */

'use client';
import { useState, useMemo } from 'react';
import type { FBAOutput } from '../../../data/mockFBA';
import type { METABOLIC_NODES, FLUX_EDGES } from '../../../data/mockFBA';
import { T } from '../../ide/tokens';
import { SCI_PALETTE, SCI_PASTEL } from '../../charts/chartTheme';

// ── Layout constants ──
export const W = 480;
export const H = 640;

// ── Subsystem palette ──
export const SUBSYSTEM_COLORS: Record<string, string> = {
  Glycolysis:   SCI_PASTEL.coral,
  TCA:          SCI_PASTEL.periwinkle,
  Energy:       SCI_PASTEL.teal,
  Fermentation: SCI_PASTEL.lavender,
};

// ── Flux direction colors (Okabe-Ito, CVD-safe) ──
export const FLUX_FWD_COLOR = SCI_PALETTE.green;
export const FLUX_REV_COLOR = SCI_PALETTE.vermilion;

// ── Force-directed graph layout ──
export function runForceLayout(
  nodes: { id: string; subsystem: string }[],
  edges: { from: string; to: string }[],
  width: number,
  height: number,
): Record<string, { x: number; y: number }> {
  const PAD = 48;
  const pos: Record<string, { x: number; y: number }> = {};
  const glyNodes = nodes.filter(n => n.subsystem === 'Glycolysis');
  const tcaNodes = nodes.filter(n => n.subsystem === 'TCA');
  const otherNodes = nodes.filter(n => n.subsystem !== 'Glycolysis' && n.subsystem !== 'TCA');

  glyNodes.forEach((n, i) => {
    pos[n.id] = { x: PAD + 30 + (i % 2) * 40, y: PAD + i * ((height - PAD * 2) / Math.max(glyNodes.length - 1, 1)) };
  });
  tcaNodes.forEach((n, i) => {
    pos[n.id] = { x: width * 0.55 + (i % 2) * 50, y: PAD + 80 + i * ((height - PAD * 2 - 80) / Math.max(tcaNodes.length, 1)) };
  });
  otherNodes.forEach((n, i) => {
    pos[n.id] = { x: width - PAD - 30, y: PAD + i * 80 };
  });

  const nodeIds = nodes.map(n => n.id);
  const area = (width - PAD * 2) * (height - PAD * 2);
  const k = Math.sqrt(area / Math.max(nodeIds.length, 1));

  for (let iter = 0; iter < 180; iter++) {
    const temp = k * (1 - iter / 180) * 0.45;
    const disp: Record<string, { dx: number; dy: number }> = {};
    nodeIds.forEach(id => { disp[id] = { dx: 0, dy: 0 }; });

    for (let a = 0; a < nodeIds.length; a++) {
      for (let b = a + 1; b < nodeIds.length; b++) {
        const ia = nodeIds[a], ib = nodeIds[b];
        const dx = pos[ia].x - pos[ib].x, dy = pos[ia].y - pos[ib].y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        const rep = (k * k) / d;
        disp[ia].dx += (dx / d) * rep; disp[ia].dy += (dy / d) * rep;
        disp[ib].dx -= (dx / d) * rep; disp[ib].dy -= (dy / d) * rep;
      }
    }
    edges.forEach(e => {
      if (!pos[e.from] || !pos[e.to]) return;
      const dx = pos[e.to].x - pos[e.from].x, dy = pos[e.to].y - pos[e.from].y;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
      const att = (d * d) / k;
      disp[e.from].dx += (dx / d) * att; disp[e.from].dy += (dy / d) * att;
      disp[e.to].dx   -= (dx / d) * att; disp[e.to].dy   -= (dy / d) * att;
    });
    nodeIds.forEach(id => {
      const d = Math.max(Math.sqrt(disp[id].dx ** 2 + disp[id].dy ** 2), 0.01);
      const sc = Math.min(d, temp) / d;
      pos[id].x = Math.max(PAD, Math.min(width - PAD, pos[id].x + disp[id].dx * sc));
      pos[id].y = Math.max(PAD, Math.min(height - PAD, pos[id].y + disp[id].dy * sc));
    });
  }
  return pos;
}

// ── FluxMap component ──
export function FluxMap({ result, nodes, edges, knockouts, compact, svgRef }: {
  result: FBAOutput;
  nodes: typeof METABOLIC_NODES;
  edges: typeof FLUX_EDGES;
  knockouts: string[];
  compact?: boolean;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}) {
  const maxFlux = Math.max(...Object.values(result.fluxes).map(Math.abs), 1);
  const koSet = new Set(knockouts);
  const [hovered, setHovered] = useState<string | null>(null);
  const viewH = compact ? 480 : H;

  const positions = useMemo(
    () => runForceLayout(nodes, edges, W, viewH),
    [nodes, edges, viewH],
  );

  function nodeFlux(nodeId: string) {
    const connected = edges.filter(e => e.from === nodeId || e.to === nodeId);
    const total = connected.reduce((sum, e) => sum + Math.abs(result.fluxes[e.reactionId] ?? 0), 0);
    return total / Math.max(connected.length, 1);
  }

  return (
    <svg ref={svgRef} role="img" aria-label="Chart" viewBox={`0 0 ${W} ${viewH}`} style={{ width: '100%', height: '100%', maxHeight: '100%' }}>
      <defs>
        <marker id="fba-fwd"  markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
          <polygon points="0 0.5, 6.5 3.5, 0 6.5" fill={FLUX_FWD_COLOR} />
        </marker>
        <marker id="fba-rev"  markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
          <polygon points="0 0.5, 6.5 3.5, 0 6.5" fill={FLUX_REV_COLOR} />
        </marker>
        <marker id="fba-zero" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
          <polygon points="0 0.5, 6.5 3.5, 0 6.5" fill="rgba(255,255,255,0.18)" />
        </marker>
        <marker id="fba-ko"   markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
          <polygon points="0 0.5, 6.5 3.5, 0 6.5" fill="rgba(255,80,80,0.5)" />
        </marker>
        <filter id="fba-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <rect width={W} height={viewH} fill="#05070b" rx={16} />

      <text x="28" y="22" fontFamily={T.MONO} fontSize="10" fill={SUBSYSTEM_COLORS.Glycolysis} opacity={0.75}>● GLYCOLYSIS</text>
      <text x="200" y="22" fontFamily={T.MONO} fontSize="10" fill={SUBSYSTEM_COLORS.TCA} opacity={0.75}>● TCA CYCLE</text>
      <text x="28" y={viewH - 12} fontFamily={T.MONO} fontSize="10" fill="rgba(255,255,255,0.2)">
        Flux: mmol·gDW⁻¹·h⁻¹ · Node size ∝ flux magnitude · Edge color encodes direction
      </text>

      {edges.map(edge => {
        const from = positions[edge.from], to = positions[edge.to];
        if (!from || !to) return null;
        const rawFlux = result.fluxes[edge.reactionId] ?? 0;
        const flux = Math.abs(rawFlux);
        const normalized = flux / maxFlux;
        const isKO = koSet.has(edge.reactionId);
        const isReverse = rawFlux < 0;
        const color = isKO ? 'rgba(255,80,80,0.55)'
          : flux < 0.01 ? 'rgba(255,255,255,0.15)'
          : isReverse ? FLUX_REV_COLOR : FLUX_FWD_COLOR;
        const strokeW = Math.min(8, 1 + normalized * 5);
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        const marker = isKO ? 'url(#fba-ko)' : flux < 0.01 ? 'url(#fba-zero)' : isReverse ? 'url(#fba-rev)' : 'url(#fba-fwd)';
        return (
          <g key={edge.reactionId}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={color} strokeWidth={strokeW} strokeLinecap="round"
              strokeDasharray={isKO ? '5 3' : undefined} markerEnd={marker} opacity={0.85} />
            <rect x={mx - 14} y={my - 7} width="28" height="14" rx="7"
              fill="rgba(5,7,11,0.88)" stroke="rgba(255,255,255,0.07)" />
            <text x={mx} y={my + 4} fill={isKO ? 'rgba(255,80,80,0.7)' : 'rgba(255,255,255,0.55)'}
              fontFamily={T.MONO} fontSize="10" textAnchor="middle">
              {isKO ? '×' : flux.toFixed(1)}
            </text>
          </g>
        );
      })}

      {nodes.map(node => {
        const pos = positions[node.id];
        if (!pos) return null;
        const f = nodeFlux(node.id);
        const r = Math.max(10, Math.min(20, 8 + Math.sqrt(f / maxFlux) * 14));
        const color = SUBSYSTEM_COLORS[node.subsystem] ?? 'rgba(255,255,255,0.5)';
        const isHov = hovered === node.id;
        return (
          <g key={node.id} onMouseEnter={() => setHovered(node.id)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
            {isHov && <circle cx={pos.x} cy={pos.y} r={r + 6} fill={color} opacity={0.12} />}
            <circle cx={pos.x} cy={pos.y} r={r} fill="rgba(5,7,11,0.92)" stroke={color}
              strokeWidth={isHov ? 2.2 : 1.4} filter={isHov ? 'url(#fba-glow)' : undefined} />
            <text x={pos.x} y={pos.y + 3.5} textAnchor="middle" fontFamily={T.MONO} fontSize="10" fill="rgba(255,255,255,0.88)">
              {node.label.slice(0, 5)}
            </text>
            <text x={pos.x} y={pos.y + r + 10} textAnchor="middle" fontFamily={T.MONO} fontSize="10" fill={color} opacity={0.7}>
              {f.toFixed(1)}
            </text>
          </g>
        );
      })}

      <rect x={W - 110} y={26} width="96" height="38" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" />
      <text x={W - 96} y={40} fontFamily={T.MONO} fontSize="10" fill="rgba(255,255,255,0.28)">μ BIOMASS</text>
      <text x={W - 96} y={56} fontFamily={T.MONO} fontSize="13" fontWeight="700" fill="rgba(247,249,255,0.92)">
        {result.growthRate.toFixed(4)}
      </text>
    </svg>
  );
}
