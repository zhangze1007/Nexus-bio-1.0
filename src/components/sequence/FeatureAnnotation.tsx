"use client";

/**
 * Feature Annotation Bar
 *
 * A horizontal SVG bar showing feature annotations as colored blocks
 * with strand arrows, tooltips, and click-to-select interaction.
 */

import React, { useCallback, useMemo, useState } from "react";
import { THEME } from "../../theme";
import type { SequenceData, SequenceFeature } from "./types";

interface FeatureAnnotationProps {
  data: SequenceData;
  selectedFeatureId?: string | null;
  onSelectFeature?: (id: string | null) => void;
  scrollLeft?: number;
  baseWidth?: number;
  height?: number;
}

/** Vertical lane assignment — features in the same lane must not overlap. */
function assignLanes(features: SequenceFeature[]): Map<string, number> {
  const sorted = [...features].sort((a, b) => a.start - b.start || a.end - b.end);
  const laneEnds: number[] = [];
  const map = new Map<string, number>();

  for (const feat of sorted) {
    let placed = false;
    for (let lane = 0; lane < laneEnds.length; lane++) {
      if (feat.start >= laneEnds[lane]) {
        laneEnds[lane] = feat.end;
        map.set(feat.id, lane);
        placed = true;
        break;
      }
    }
    if (!placed) {
      map.set(feat.id, laneEnds.length);
      laneEnds.push(feat.end);
    }
  }
  return map;
}

export default function FeatureAnnotation({
  data,
  selectedFeatureId,
  onSelectFeature,
  scrollLeft = 0,
  baseWidth = 12,
  height = 20,
}: FeatureAnnotationProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const laneMap = useMemo(() => assignLanes(data.features), [data.features]);
  const numLanes = useMemo(() => (laneMap.size > 0 ? Math.max(...laneMap.values()) + 1 : 0), [laneMap]);
  const totalHeight = numLanes * (height + 4) + 8;
  const seqPixelWidth = data.length * baseWidth;

  const handleClick = useCallback(
    (id: string) => {
      onSelectFeature?.(id === selectedFeatureId ? null : id);
    },
    [onSelectFeature, selectedFeatureId],
  );

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        overflow: "hidden",
        background: THEME.BG_CANVAS,
        borderBottom: `1px solid ${THEME.BORDER}`,
        minHeight: totalHeight,
      }}
    >
      <svg
        width={seqPixelWidth}
        height={totalHeight}
        style={{
          display: "block",
          transform: `translateX(${-scrollLeft}px)`,
        }}
      >
        {data.features.map((feat) => {
          const lane = laneMap.get(feat.id) ?? 0;
          const x = feat.start * baseWidth;
          const w = Math.max((feat.end - feat.start) * baseWidth, baseWidth);
          const y = lane * (height + 4) + 4;
          const isSelected = feat.id === selectedFeatureId;
          const isHovered = feat.id === hoveredId;
          const arrowDir = feat.strand === 1 ? 1 : -1;
          const arrowSize = Math.min(6, w / 4);

          // Build path: rectangle with arrow head
          const path =
            arrowDir === 1
              ? `M ${x} ${y} L ${x + w - arrowSize} ${y} L ${x + w} ${y + height / 2} L ${x + w - arrowSize} ${y + height} L ${x} ${y + height} Z`
              : `M ${x + w} ${y} L ${x + arrowSize} ${y} L ${x} ${y + height / 2} L ${x + arrowSize} ${y + height} L ${x + w} ${y + height} Z`;

          return (
            <g
              key={feat.id}
              onClick={() => handleClick(feat.id)}
              onMouseEnter={() => setHoveredId(feat.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: "pointer" }}
            >
              <path
                d={path}
                fill={feat.color}
                fillOpacity={isSelected ? 1 : isHovered ? 0.85 : 0.6}
                stroke={isSelected ? THEME.VALUE : "none"}
                strokeWidth={isSelected ? 1.5 : 0}
              />
              {w > 30 && (
                <text
                  x={x + w / 2}
                  y={y + height / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={THEME.VALUE}
                  fontSize={10}
                  fontFamily={THEME.SANS}
                  style={{ pointerEvents: "none" }}
                >
                  {feat.name.length > Math.floor(w / 7) ? feat.name.slice(0, Math.floor(w / 7)) + ".." : feat.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip for hovered feature */}
      {hoveredId &&
        (() => {
          const feat = data.features.find((f) => f.id === hoveredId);
          if (!feat) return null;
          const lane = laneMap.get(feat.id) ?? 0;
          const tipX = feat.start * baseWidth - scrollLeft + ((feat.end - feat.start) * baseWidth) / 2;
          const tipY = lane * (height + 4);
          return (
            <div
              style={{
                position: "absolute",
                left: tipX,
                top: Math.max(0, tipY - 40),
                transform: "translateX(-50%)",
                background: THEME.PANEL_STRONG,
                border: `1px solid ${THEME.BORDER_ACTIVE}`,
                borderRadius: THEME.R_SM,
                padding: "4px 8px",
                fontFamily: THEME.SANS,
                fontSize: 11,
                color: THEME.VALUE,
                whiteSpace: "nowrap",
                pointerEvents: "none",
                zIndex: 10,
                boxShadow: THEME.SHADOW_MEDIUM,
              }}
            >
              <strong>{feat.name}</strong> ({feat.type}) &middot; {feat.start + 1}&ndash;{feat.end}{" "}
              {feat.strand === 1 ? "&rarr;" : "&larr;"}
              {feat.notes && <div style={{ color: THEME.DIM, fontSize: 10 }}>{feat.notes}</div>}
            </div>
          );
        })()}
    </div>
  );
}
