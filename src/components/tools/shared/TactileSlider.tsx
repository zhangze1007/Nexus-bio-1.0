/**
 * TactileSlider — unified PATHD gradient range input.
 *
 * Silky-smooth pointer-driven slider with zero animation lag: the fill
 * and thumb are positioned directly from state so dragging back and forth
 * tracks the cursor exactly. Matches the .nb-pathd-slider CSS slider so
 * every slider across the app looks identical.
 */
'use client';
import { useRef, useCallback, useState } from 'react';
import { THEME } from '../../../theme';
const TRACK = THEME.PROGRESS_TRACK;

interface TactileSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  /** Deprecated — kept for API compatibility; ignored. */
  color?: string;
}

export default function TactileSlider({
  label, value, min, max, step, unit = '', onChange,
}: TactileSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);

  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const resolve = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const raw = (clientX - rect.left) / rect.width;
    const clamped = Math.min(1, Math.max(0, raw));
    const snapped = Math.round((min + clamped * (max - min)) / step) * step;
    onChange(Math.min(max, Math.max(min, parseFloat(snapped.toFixed(8)))));
  }, [min, max, step, onChange]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    trackRef.current?.setPointerCapture(e.pointerId);
    activePointerIdRef.current = e.pointerId;
    setDragging(true);
    resolve(e.clientX);
  }, [resolve]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || activePointerIdRef.current !== e.pointerId) return;
    resolve(e.clientX);
  }, [dragging, resolve]);

  const handlePointerUp = useCallback((e?: React.PointerEvent) => {
    if (e && trackRef.current?.hasPointerCapture(e.pointerId)) {
      trackRef.current.releasePointerCapture(e.pointerId);
    }
    activePointerIdRef.current = null;
    setDragging(false);
  }, []);

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>
          {label}
        </span>
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: 'var(--nb-fs-xs)',
            color: THEME.VALUE,
          }}
        >
          {value.toFixed(step < 1 ? 1 : 0)}{unit}
        </span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => { setHovering(false); }}
        style={{
          position: 'relative', width: '100%', height: '18px',
          cursor: 'pointer', touchAction: 'none',
          display: 'flex', alignItems: 'center',
        }}
      >
        {/* Background track */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: `${THEME.PROGRESS_HEIGHT}px`,
          borderRadius: `${THEME.PROGRESS_RADIUS}px`, background: TRACK,
        }} />

        {/* Filled track — instant, no transition */}
        <div
          style={{
            position: 'absolute', left: 0, height: `${THEME.PROGRESS_HEIGHT}px`,
            borderRadius: `${THEME.PROGRESS_RADIUS}px`,
            background: THEME.PROGRESS_GRADIENT,
            width: `${pct}%`,
            boxShadow: dragging || hovering ? THEME.PROGRESS_GLOW : 'none',
          }}
        />

        {/* Thumb — instant, white with sky border to match nb-pathd-slider */}
        <div
          style={{
            position: 'absolute',
            left: `calc(${pct}% - 7px)`,
            width: '14px', height: '14px', borderRadius: '50%',
            background: '#FFFFFF',
            border: `2px solid ${THEME.SKY}`,
            boxShadow: dragging
              ? `0 2px 8px rgba(32,37,43,0.32), 0 0 0 6px rgba(175,195,214,0.22)`
              : hovering
                ? `0 1px 6px rgba(32,37,43,0.24), 0 0 0 4px rgba(175,195,214,0.14)`
                : `0 1px 4px rgba(32,37,43,0.20), 0 0 0 3px rgba(175,195,214,0.1)`,
            transform: dragging ? 'scale(1.15)' : 'scale(1)',
            transition: 'box-shadow 0.15s, transform 0.1s',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}
