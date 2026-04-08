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
import { T } from '../../ide/tokens';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

const TRACK = PATHD_THEME.progressTrack;

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
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    resolve(e.clientX);
  }, [resolve]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    resolve(e.clientX);
  }, [dragging, resolve]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontFamily: T.SANS, fontSize: '10px', color: PATHD_THEME.label }}>
          {label}
        </span>
        <span
          style={{
            fontFamily: T.MONO,
            fontSize: '10px',
            color: PATHD_THEME.value,
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
        onMouseLeave={() => { setHovering(false); setDragging(false); }}
        style={{
          position: 'relative', width: '100%', height: '18px',
          cursor: 'pointer', touchAction: 'none',
          display: 'flex', alignItems: 'center',
        }}
      >
        {/* Background track */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: `${PATHD_THEME.progressHeight}px`,
          borderRadius: `${PATHD_THEME.progressRadius}px`, background: TRACK,
        }} />

        {/* Filled track — instant, no transition */}
        <div
          style={{
            position: 'absolute', left: 0, height: `${PATHD_THEME.progressHeight}px`,
            borderRadius: `${PATHD_THEME.progressRadius}px`,
            background: PATHD_THEME.progressGradient,
            width: `${pct}%`,
            boxShadow: dragging || hovering ? PATHD_THEME.progressGlow : 'none',
          }}
        />

        {/* Thumb — instant, white with sky border to match nb-pathd-slider */}
        <div
          style={{
            position: 'absolute',
            left: `calc(${pct}% - 7px)`,
            width: '14px', height: '14px', borderRadius: '50%',
            background: '#FFFFFF',
            border: `2px solid ${PATHD_THEME.sky}`,
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
