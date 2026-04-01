/**
 * TactileSlider — Framer Motion animated range input.
 *
 * Replaces bare <input type="range"> with a custom track + thumb
 * that pulses on interaction and shows neon-green (#39FF14) active state.
 * Renders at 60 fps via Framer Motion spring physics.
 */
'use client';
import { useRef, useCallback, useState } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { T } from '../../ide/tokens';

const NEON  = '#39FF14';
const TRACK = 'rgba(255,255,255,0.06)';

interface TactileSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  color?: string;
}

export default function TactileSlider({
  label, value, min, max, step, unit = '', onChange, color = NEON,
}: TactileSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);

  const pct = ((value - min) / (max - min)) * 100;

  const thumbScale = useSpring(dragging ? 1.6 : hovering ? 1.2 : 1, {
    stiffness: 400, damping: 25,
  });
  const glowOpacity = useSpring(dragging ? 0.5 : hovering ? 0.25 : 0, {
    stiffness: 300, damping: 30,
  });

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
        <span style={{ fontFamily: T.SANS, fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
          {label}
        </span>
        <motion.span
          style={{ fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}
          animate={{ color: dragging ? color : 'rgba(255,255,255,0.7)' }}
          transition={{ duration: 0.15 }}
        >
          {value.toFixed(step < 1 ? 1 : 0)}{unit}
        </motion.span>
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
          position: 'relative', width: '100%', height: '28px',
          cursor: 'pointer', touchAction: 'none',
          display: 'flex', alignItems: 'center',
        }}
      >
        {/* Background track */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '3px',
          borderRadius: '2px', background: TRACK,
        }} />

        {/* Filled track */}
        <motion.div
          style={{
            position: 'absolute', left: 0, height: '3px',
            borderRadius: '2px', background: color,
          }}
          animate={{ width: `${pct}%`, opacity: dragging ? 1 : 0.6 }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />

        {/* Glow */}
        <motion.div
          style={{
            position: 'absolute',
            left: `calc(${pct}% - 14px)`,
            width: '28px', height: '28px', borderRadius: '50%',
            background: color,
            filter: 'blur(10px)',
            pointerEvents: 'none',
            opacity: glowOpacity,
          }}
        />

        {/* Thumb */}
        <motion.div
          style={{
            position: 'absolute',
            left: `calc(${pct}% - 6px)`,
            width: '12px', height: '12px', borderRadius: '50%',
            background: '#000',
            border: `2px solid ${color}`,
            boxShadow: dragging ? `0 0 12px ${color}80` : 'none',
            pointerEvents: 'none',
            scale: thumbScale,
          }}
        />
      </div>
    </div>
  );
}
