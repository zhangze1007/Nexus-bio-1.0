'use client';
/**
 * EvidencePanel — Secondary evidence reading surface.
 *
 * Houses the literature-support citation graph plus a textual citation
 * index. The audit's end-state for this panel is a tree / network view
 * with year + source + relevance filters (see PR-2b/3 roadmap). This
 * first pass preserves the existing CitationGraph visual and wraps it
 * with explicit empty-state + list semantics so the deferred filter work
 * has a container to grow into without re-decomposing.
 *
 * Do NOT delete or dilute this panel into a static citation list when
 * the tree/network view lands — the existing graph is a real viz layer
 * and should remain the primary evidence canvas.
 */
import { useState } from 'react';
import type { CitationNode } from '../../../types';
import { TOOL_TOKENS as T } from '../shared/ToolShell';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

export interface EvidencePanelProps {
  citations: CitationNode[];
  onNodeClick?: (citation: CitationNode) => void;
}

export default function EvidencePanel({ citations, onNodeClick }: EvidencePanelProps) {
  if (citations.length === 0) {
    return (
      <div
        data-testid="nexai-evidence-empty"
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: '240px',
          padding: '24px',
          borderRadius: '18px',
          border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
          background: PATHD_THEME.panelSurface,
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'grid', gap: '6px' }}>
          <div style={{ fontFamily: T.MONO, fontSize: '11px', color: PATHD_THEME.label }}>
            No evidence map yet
          </div>
          <div style={{ fontFamily: T.SANS, fontSize: '12px', color: PATHD_THEME.value, lineHeight: 1.6 }}>
            Attach Research evidence or rerun with a literature-backed query to populate the citation surface.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="nexai-evidence-panel"
      style={{
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        gap: '10px',
      }}
    >
      <div style={{ display: 'grid', gap: '4px' }}>
        <div style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Citation support map
        </div>
        <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.55 }}>
          {citations.length} source{citations.length === 1 ? '' : 's'} · positioned by year and relevance.
        </div>
      </div>
      <CitationGraph citations={citations} onNodeClick={onNodeClick} />
    </div>
  );
}

// ── Citation graph visual (unchanged behaviour, relocated from NEXAIPage) ──

function CitationGraph({
  citations,
  onNodeClick,
}: {
  citations: CitationNode[];
  onNodeClick?: (c: CitationNode) => void;
}) {
  const W = 640;
  const H = 480;
  const [hovered, setHovered] = useState<string | null>(null);

  const sorted = [...citations].sort((left, right) => left.year - right.year);
  const yearMin = Math.min(...sorted.map((c) => c.year), sorted[0]?.year ?? 2020);
  const yearMax = Math.max(...sorted.map((c) => c.year), sorted[sorted.length - 1]?.year ?? yearMin + 1);
  const yearRange = Math.max(yearMax - yearMin, 1);

  const nodes = sorted.map((citation, index) => {
    const x = 68 + ((citation.year - yearMin) / yearRange) * (W - 136);
    const lane = index % 4;
    const relevanceY = 104 + (1 - citation.relevance) * 188;
    const laneOffset = lane % 2 === 0 ? -18 : 18;
    return {
      ...citation,
      x,
      y: relevanceY + laneOffset,
      r: 11 + citation.relevance * 11,
      lane,
    };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <defs>
        <filter id="nexai-node-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect width={W} height={H} rx={16} fill="#05070b" />
      <rect
        x="24"
        y="24"
        width={W - 48}
        height={H - 48}
        rx="18"
        fill="rgba(255,255,255,0.025)"
        stroke="rgba(255,255,255,0.06)"
      />
      <text x="40" y="22" fontFamily={T.SANS} fontSize="10" fill="rgba(205,214,236,0.6)" letterSpacing="0.12em">
        LITERATURE SUPPORT MAP
      </text>
      <text x="40" y="36" fontFamily={T.SANS} fontSize="12" fill="rgba(247,249,255,0.92)">
        Publications positioned by year and relevance, with bridge citations highlighted
      </text>

      {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
        const y = 92 + tick * 220;
        return (
          <g key={`g-${tick}`}>
            <line x1="52" y1={y} x2={W - 52} y2={y} stroke="rgba(255,255,255,0.045)" />
            <text
              x="46"
              y={y + 3}
              textAnchor="end"
              fontFamily={T.MONO}
              fontSize="7"
              fill="rgba(255,255,255,0.28)"
            >
              {(1 - tick).toFixed(2)}
            </text>
          </g>
        );
      })}
      <line x1="52" y1="330" x2={W - 52} y2="330" stroke="rgba(255,255,255,0.12)" />
      {Array.from({ length: Math.min(6, yearRange + 1) }).map((_, index, arr) => {
        const year = Math.round(yearMin + (index / Math.max(arr.length - 1, 1)) * yearRange);
        const x = 68 + ((year - yearMin) / yearRange) * (W - 136);
        return (
          <g key={`year-${year}-${index}`}>
            <line x1={x} y1="330" x2={x} y2="336" stroke="rgba(255,255,255,0.12)" />
            <text
              x={x}
              y="350"
              textAnchor="middle"
              fontFamily={T.MONO}
              fontSize="7"
              fill="rgba(255,255,255,0.28)"
            >
              {year}
            </text>
          </g>
        );
      })}

      {nodes.map((node, index) =>
        nodes
          .slice(index + 1)
          .filter(
            (candidate) =>
              Math.abs(candidate.year - node.year) <= 4 &&
              Math.abs(candidate.relevance - node.relevance) <= 0.22,
          )
          .slice(0, 2)
          .map((peer, edgeIndex) => {
            const mx = (node.x + peer.x) / 2;
            const my = Math.min(node.y, peer.y) - 28 - Math.abs(node.x - peer.x) * 0.15;
            const combined = (node.relevance + peer.relevance) / 2;
            return (
              <path
                key={`arc-${index}-${edgeIndex}`}
                d={`M ${node.x} ${node.y} Q ${mx} ${my} ${peer.x} ${peer.y}`}
                fill="none"
                stroke={combined > 0.7 ? 'rgba(175,195,214,0.32)' : 'rgba(175,195,214,0.16)'}
                strokeWidth={combined > 0.7 ? 1.2 : 0.7}
              />
            );
          }),
      )}

      {nodes.map((n) => {
        const isHov = hovered === n.id;
        return (
          <g
            key={n.id}
            onMouseEnter={() => setHovered(n.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onNodeClick?.(n)}
            style={{ cursor: 'pointer' }}
          >
            <line x1={n.x} y1="330" x2={n.x} y2={n.y + n.r + 4} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 4" />
            {n.relevance > 0.7 && (
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r + 4}
                fill={isHov ? 'rgba(231,199,169,0.22)' : 'rgba(175,195,214,0.18)'}
                filter="url(#nexai-node-glow)"
              />
            )}
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={isHov ? 'rgba(175,195,214,0.24)' : 'rgba(18,26,40,0.88)'}
              stroke={
                isHov
                  ? 'rgba(231,199,169,0.9)'
                  : n.relevance > 0.7
                    ? 'rgba(175,195,214,0.72)'
                    : 'rgba(175,195,214,0.46)'
              }
              strokeWidth={isHov ? 1.8 : n.relevance > 0.7 ? 1.5 : 1.1}
            />
            <text
              x={n.x}
              y={n.y + 4}
              textAnchor="middle"
              fontFamily={T.MONO}
              fontSize="9"
              fill={isHov ? 'rgba(255,244,230,0.96)' : 'rgba(255,255,255,0.72)'}
            >
              {n.year}
            </text>
            <text
              x={n.x}
              y={n.y + n.r + 16}
              textAnchor="middle"
              fontFamily={T.SANS}
              fontSize="8"
              fill="rgba(205,214,236,0.62)"
            >
              {n.title.slice(0, 14)}
              {n.title.length > 14 ? '…' : ''}
            </text>
          </g>
        );
      })}
      <text x={14} y={H - 12} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.18)">
        Y-axis = citation relevance · X-axis = publication year
      </text>
    </svg>
  );
}
