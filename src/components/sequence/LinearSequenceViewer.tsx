'use client';

/**
 * Linear Sequence Viewer
 *
 * A Canvas-based scrollable sequence viewer with:
 * - Color-coded bases/amino acids
 * - Position numbers on left margin
 * - Zoom levels (1x = single base, 2x = with translation, 4x = detailed)
 * - Click and drag to select ranges
 * - Keyboard navigation (arrow keys, shift+arrow for selection)
 * - Virtualized rendering for sequences > 10K bp
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { THEME } from '../../theme';
import type { SequenceData } from './types';
import { getCharColor } from './colors';
import { translateFrame } from './translation';

interface LinearSequenceViewerProps {
  data: SequenceData;
  zoom?: 1 | 2 | 4;
  selectedRange?: { start: number; end: number } | null;
  onSelectRange?: (range: { start: number; end: number } | null) => void;
  onScrollChange?: (scrollLeft: number) => void;
  highlightFeatureId?: string | null;
}

/** Layout constants per zoom level */
const LAYOUT = {
  1: { basesPerRow: 80, charWidth: 10, rowHeight: 20, fontSize: 13, margin: 60 },
  2: { basesPerRow: 60, charWidth: 12, rowHeight: 50, fontSize: 14, margin: 60 },
  4: { basesPerRow: 40, charWidth: 16, rowHeight: 70, fontSize: 16, margin: 70 },
} as const;

export default function LinearSequenceViewer({
  data,
  zoom = 1,
  selectedRange,
  onSelectRange,
  onScrollChange,
  highlightFeatureId,
}: LinearSequenceViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(500);
  const [containerWidth, setContainerWidth] = useState(800);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);

  const layout = LAYOUT[zoom];
  const totalRows = Math.ceil(data.length / layout.basesPerRow);
  const contentHeight = totalRows * layout.rowHeight;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  // Precompute translation for zoom >= 2
  const translation = useMemo(() => {
    if (zoom < 2 || data.type === 'protein') return null;
    return translateFrame(data.sequence, 0);
  }, [data.sequence, data.type, zoom]);

  // Feature lookup: position -> feature color (for highlighting)
  const featureColorAt = useCallback(
    (pos: number): string | null => {
      for (const feat of data.features) {
        if (pos >= feat.start && pos < feat.end) {
          return feat.color;
        }
      }
      return null;
    },
    [data.features]
  );

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = containerWidth;
    const ch = containerHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = THEME.BG_CANVAS;
    ctx.fillRect(0, 0, cw, ch);

    const firstVisibleRow = Math.floor(scrollTop / layout.rowHeight);
    const lastVisibleRow = Math.min(
      totalRows - 1,
      Math.ceil((scrollTop + ch) / layout.rowHeight)
    );

    const seqType = data.type === 'rna' ? 'dna' : data.type;

    for (let row = firstVisibleRow; row <= lastVisibleRow; row++) {
      const y = row * layout.rowHeight - scrollTop;
      const startPos = row * layout.basesPerRow;

      // Position number
      ctx.fillStyle = THEME.DIM;
      ctx.font = `${layout.fontSize - 2}px ${THEME.MONO}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`${startPos + 1}`, layout.margin - 8, y + 2);

      // Separator line
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(layout.margin, y);
      ctx.lineTo(cw, y);
      ctx.stroke();

      // Bases
      ctx.textAlign = 'left';
      ctx.font = `${layout.fontSize}px ${THEME.MONO}`;

      for (let col = 0; col < layout.basesPerRow; col++) {
        const pos = startPos + col;
        if (pos >= data.length) break;

        const base = data.sequence[pos];
        const x = layout.margin + col * layout.charWidth;

        // Feature background highlight
        const featColor = featureColorAt(pos);
        if (featColor) {
          ctx.fillStyle = featColor;
          ctx.globalAlpha = 0.15;
          ctx.fillRect(x - 1, y + 1, layout.charWidth, layout.rowHeight - 2);
          ctx.globalAlpha = 1;
        }

        // Selection highlight
        if (selectedRange && pos >= selectedRange.start && pos < selectedRange.end) {
          ctx.fillStyle = 'rgba(175, 195, 214, 0.25)';
          ctx.fillRect(x - 1, y + 1, layout.charWidth, layout.rowHeight - 2);
        }

        // Highlighted feature
        if (highlightFeatureId) {
          const hf = data.features.find((f) => f.id === highlightFeatureId);
          if (hf && pos >= hf.start && pos < hf.end) {
            ctx.fillStyle = 'rgba(175, 195, 214, 0.3)';
            ctx.fillRect(x - 1, y + 1, layout.charWidth, layout.rowHeight - 2);
          }
        }

        // Base character
        ctx.fillStyle = seqType === 'protein' ? getCharColor(base, 'protein') : getCharColor(base, 'dna');
        ctx.fillText(base, x, y + 3);
      }

      // Translation line (zoom >= 2, DNA only)
      if (translation && zoom >= 2) {
        ctx.font = `${layout.fontSize - 2}px ${THEME.MONO}`;
        ctx.textAlign = 'left';
        for (let col = 0; col < layout.basesPerRow; col++) {
          const pos = startPos + col;
          if (pos >= translation.length) break;
          const aa = translation[pos];
          const x = layout.margin + col * layout.charWidth;
          ctx.fillStyle = aa === '*' ? THEME.CORAL : THEME.DIM;
          ctx.fillText(aa, x, y + layout.rowHeight - 16);
        }
      }

      // Restriction sites tick marks
      for (const site of data.restrictionSites) {
        const siteRow = Math.floor(site.position / layout.basesPerRow);
        if (siteRow === row) {
          const col = site.position % layout.basesPerRow;
          const x = layout.margin + col * layout.charWidth;
          ctx.strokeStyle = THEME.LILAC;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x + layout.charWidth / 2, y);
          ctx.lineTo(x + layout.charWidth / 2, y + layout.rowHeight);
          ctx.stroke();
        }
      }
    }
  }, [
    data,
    zoom,
    scrollTop,
    containerHeight,
    containerWidth,
    selectedRange,
    highlightFeatureId,
    translation,
    totalRows,
    layout,
    featureColorAt,
    dpr,
  ]);

  // Scroll handler
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      setScrollTop(target.scrollTop);
      onScrollChange?.(target.scrollLeft);
    },
    [onScrollChange]
  );

  // Mouse position to sequence position
  const posFromMouse = useCallback(
    (e: React.MouseEvent): number | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const row = Math.floor((my + scrollTop) / layout.rowHeight);
      const col = Math.floor((mx - layout.margin) / layout.charWidth);
      if (col < 0 || col >= layout.basesPerRow) return null;
      const pos = row * layout.basesPerRow + col;
      return pos >= 0 && pos < data.length ? pos : null;
    },
    [scrollTop, layout, data.length]
  );

  // Click to select
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const pos = posFromMouse(e);
      if (pos === null) return;
      setIsDragging(true);
      setDragStart(pos);
      onSelectRange?.({ start: pos, end: pos + 1 });
    },
    [posFromMouse, onSelectRange]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || dragStart === null) return;
      const pos = posFromMouse(e);
      if (pos === null) return;
      const start = Math.min(dragStart, pos);
      const end = Math.max(dragStart, pos) + 1;
      onSelectRange?.({ start, end });
    },
    [isDragging, dragStart, posFromMouse, onSelectRange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentStart = selectedRange?.start ?? 0;
      const shift = e.shiftKey;

      switch (e.key) {
        case 'ArrowRight': {
          e.preventDefault();
          const newStart = Math.min(currentStart + 1, data.length - 1);
          if (shift && selectedRange) {
            onSelectRange?.({ start: selectedRange.start, end: Math.min(selectedRange.end + 1, data.length) });
          } else {
            onSelectRange?.({ start: newStart, end: newStart + 1 });
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const newStart = Math.max(currentStart - 1, 0);
          if (shift && selectedRange) {
            onSelectRange?.({ start: selectedRange.start, end: Math.max(selectedRange.end - 1, selectedRange.start + 1) });
          } else {
            onSelectRange?.({ start: newStart, end: newStart + 1 });
          }
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const pos = Math.min(currentStart + layout.basesPerRow, data.length - 1);
          if (shift && selectedRange) {
            onSelectRange?.({ start: selectedRange.start, end: Math.min(pos + 1, data.length) });
          } else {
            onSelectRange?.({ start: pos, end: pos + 1 });
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const pos = Math.max(currentStart - layout.basesPerRow, 0);
          if (shift && selectedRange) {
            onSelectRange?.({ start: selectedRange.start, end: Math.max(pos + 1, selectedRange.start + 1) });
          } else {
            onSelectRange?.({ start: pos, end: pos + 1 });
          }
          break;
        }
      }
    },
    [selectedRange, onSelectRange, layout.basesPerRow, data.length]
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onScroll={handleScroll}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'auto',
        background: THEME.BG_CANVAS,
        outline: 'none',
        cursor: 'text',
        fontFamily: THEME.MONO,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: layout.margin + layout.basesPerRow * layout.charWidth + 20,
          height: contentHeight,
        }}
      />
    </div>
  );
}
