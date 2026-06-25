'use client';

/**
 * Circular Plasmid Map
 *
 * SVG-based circular plasmid map with:
 * - Outer ring: feature annotations as colored arcs
 * - Inner ring: restriction sites as tick marks
 * - Center: plasmid name and length
 * - Click on a feature arc to select it
 * - Mouse wheel to rotate
 * - Click and drag to rotate
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { THEME } from '../../theme';
import type { SequenceData } from './types';

interface CircularPlasmidViewProps {
  data: SequenceData;
  selectedFeatureId?: string | null;
  onSelectFeature?: (id: string | null) => void;
  size?: number;
}

/** Convert a sequence position (0-indexed) to an angle in radians. */
function posToAngle(pos: number, length: number, rotation: number): number {
  return (pos / length) * Math.PI * 2 - Math.PI / 2 + rotation;
}

/** Create an SVG arc path for a feature. */
function featureArcPath(
  start: number,
  end: number,
  length: number,
  innerR: number,
  outerR: number,
  rotation: number
): string {
  const a1 = posToAngle(start, length, rotation);
  const a2 = posToAngle(end, length, rotation);
  const sweep = end - start;
  const largeArc = sweep > length / 2 ? 1 : 0;

  const x1o = Math.cos(a1) * outerR;
  const y1o = Math.sin(a1) * outerR;
  const x2o = Math.cos(a2) * outerR;
  const y2o = Math.sin(a2) * outerR;
  const x1i = Math.cos(a1) * innerR;
  const y1i = Math.sin(a1) * innerR;
  const x2i = Math.cos(a2) * innerR;
  const y2i = Math.sin(a2) * innerR;

  return [
    `M ${x1i} ${y1i}`,
    `L ${x1o} ${y1o}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o}`,
    `L ${x2i} ${y2i}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1i} ${y1i}`,
    'Z',
  ].join(' ');
}

export default function CircularPlasmidView({
  data,
  selectedFeatureId,
  onSelectFeature,
  size = 400,
}: CircularPlasmidViewProps) {
  const [rotation, setRotation] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; rot: number } | null>(null);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.4;
  const innerR = size * 0.32;
  const tickOuterR = size * 0.3;
  const tickInnerR = size * 0.26;
  const labelR = size * 0.36;

  // Tick marks every 10%
  const ticks = useMemo(() => {
    const count = Math.min(10, Math.floor(data.length / 100));
    if (count === 0) return [];
    const step = data.length / count;
    return Array.from({ length: count }, (_, i) => ({
      pos: Math.round(i * step),
      label: Math.round(i * step).toLocaleString(),
    }));
  }, [data.length]);

  // Mouse wheel to rotate
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      setRotation((r) => r + (e.deltaY > 0 ? 0.05 : -0.05));
    },
    []
  );

  // Drag to rotate
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, rot: rotation };
    },
    [rotation]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      setRotation(dragStartRef.current.rot + dx * 0.005);
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Click on feature arc
  const handleFeatureClick = useCallback(
    (id: string) => {
      onSelectFeature?.(id === selectedFeatureId ? null : id);
    },
    [onSelectFeature, selectedFeatureId]
  );

  // Hit test for mouse position
  const hoveredFeature = hoveredId ? data.features.find((f) => f.id === hoveredId) : null;

  return (
    <div
      style={{
        background: THEME.BG_CANVAS,
        borderRadius: THEME.R_MD,
        border: `1px solid ${THEME.BORDER}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: THEME.SP_SM,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`${-cx} ${-cy} ${size} ${size}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Background circle */}
        <circle cx={0} cy={0} r={outerR + 4} fill="none" stroke={THEME.BORDER} strokeWidth={1} />
        <circle cx={0} cy={0} r={innerR - 4} fill="none" stroke={THEME.BORDER} strokeWidth={0.5} />

        {/* Tick marks and labels */}
        {ticks.map((tick) => {
          const angle = posToAngle(tick.pos, data.length, rotation);
          const x1 = Math.cos(angle) * tickInnerR;
          const y1 = Math.sin(angle) * tickInnerR;
          const x2 = Math.cos(angle) * tickOuterR;
          const y2 = Math.sin(angle) * tickOuterR;
          const lx = Math.cos(angle) * (tickInnerR - 12);
          const ly = Math.sin(angle) * (tickInnerR - 12);
          return (
            <g key={tick.pos}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={THEME.DIM} strokeWidth={1} />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fill={THEME.DIM}
                fontSize={9}
                fontFamily={THEME.MONO}
              >
                {tick.label}
              </text>
            </g>
          );
        })}

        {/* Feature arcs */}
        {data.features.map((feat) => {
          const d = featureArcPath(feat.start, feat.end, data.length, innerR, outerR, rotation);
          const isHovered = feat.id === hoveredId;
          const isSelected = feat.id === selectedFeatureId;
          return (
            <path
              key={feat.id}
              d={d}
              fill={feat.color}
              fillOpacity={isSelected ? 1 : isHovered ? 0.8 : 0.55}
              stroke={isSelected ? THEME.VALUE : 'none'}
              strokeWidth={isSelected ? 2 : 0}
              onClick={(e) => {
                e.stopPropagation();
                handleFeatureClick(feat.id);
              }}
              onMouseEnter={() => setHoveredId(feat.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: 'pointer' }}
            />
          );
        })}

        {/* Feature labels */}
        {data.features.map((feat) => {
          const midPos = (feat.start + feat.end) / 2;
          const angle = posToAngle(midPos, data.length, rotation);
          const lx = Math.cos(angle) * labelR;
          const ly = Math.sin(angle) * labelR;
          const arcLen = feat.end - feat.start;
          if (arcLen < data.length * 0.04) return null; // too small to label
          return (
            <text
              key={`label-${feat.id}`}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              fill={THEME.VALUE}
              fontSize={9}
              fontFamily={THEME.SANS}
              fontWeight={feat.id === selectedFeatureId ? 700 : 400}
              style={{ pointerEvents: 'none' }}
            >
              {feat.name.length > 10 ? feat.name.slice(0, 10) + '..' : feat.name}
            </text>
          );
        })}

        {/* Restriction site ticks */}
        {data.restrictionSites.map((site, i) => {
          const angle = posToAngle(site.position, data.length, rotation);
          const x1 = Math.cos(angle) * (innerR - 4);
          const y1 = Math.sin(angle) * (innerR - 4);
          const x2 = Math.cos(angle) * (tickInnerR);
          const y2 = Math.sin(angle) * (tickInnerR);
          return (
            <line
              key={`rs-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={THEME.LILAC}
              strokeWidth={1.5}
            />
          );
        })}

        {/* Center: plasmid name and length */}
        <text
          x={0}
          y={-6}
          textAnchor="middle"
          dominantBaseline="central"
          fill={THEME.VALUE}
          fontSize={12}
          fontFamily={THEME.BRAND}
          fontWeight={600}
        >
          {data.name}
        </text>
        <text
          x={0}
          y={10}
          textAnchor="middle"
          dominantBaseline="central"
          fill={THEME.DIM}
          fontSize={10}
          fontFamily={THEME.MONO}
        >
          {data.length.toLocaleString()} bp
        </text>
        <text
          x={0}
          y={24}
          textAnchor="middle"
          dominantBaseline="central"
          fill={THEME.DIM}
          fontSize={9}
          fontFamily={THEME.SANS}
        >
          {data.topology === 'circular' ? 'Circular' : 'Linear'}
        </text>
      </svg>

      {/* Hover tooltip */}
      {hoveredFeature && (
        <div
          style={{
            marginTop: 4,
            padding: '4px 10px',
            background: THEME.PANEL_STRONG,
            border: `1px solid ${THEME.BORDER_ACTIVE}`,
            borderRadius: THEME.R_SM,
            fontFamily: THEME.SANS,
            fontSize: 11,
            color: THEME.VALUE,
            textAlign: 'center',
          }}
        >
          <strong>{hoveredFeature.name}</strong> ({hoveredFeature.type}) &middot;{' '}
          {hoveredFeature.start + 1}&ndash;{hoveredFeature.end}{' '}
          {hoveredFeature.strand === 1 ? '→' : '←'}
        </div>
      )}
    </div>
  );
}
