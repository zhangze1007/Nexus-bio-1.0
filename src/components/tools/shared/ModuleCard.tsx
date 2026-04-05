/**
 * ModuleCard — BentoGrid cell component.
 *
 * A glassmorphism card with Blue→Orange backlight glow and
 * warm frosted-glass aesthetic. Features "LIVE" signal indicator
 * with orange breathing pulse animation.
 *
 * Designed for the #000 background aesthetic with zero hard borders —
 * separation is achieved via spacing and subtle glow.
 */
'use client';
import { motion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { T } from '../../ide/tokens';

const NEON_ORANGE  = T.NEON_ORANGE;
const BLUR         = 'blur(16px)';

interface ModuleCardProps {
  children: ReactNode;
  /** Grid area name (maps to ToolShell gridTemplateAreas) */
  area?: string;
  /** Highlights border with neon accent */
  active?: boolean;
  /** Optional title rendered at top-left */
  title?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** CSS grid column span */
  colSpan?: number;
  /** CSS grid row span */
  rowSpan?: number;
  /** Remove all padding (for full-bleed visualizations) */
  flush?: boolean;
  /** Show LIVE signal (default: true) */
  showSignal?: boolean;
}

export default function ModuleCard({
  children, area, active, title, style, colSpan, rowSpan, flush,
  showSignal = true,
}: ModuleCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        gridArea: area,
        gridColumn: colSpan ? `span ${colSpan}` : undefined,
        gridRow: rowSpan ? `span ${rowSpan}` : undefined,
        borderRadius: '18px',
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: BLUR,
        WebkitBackdropFilter: BLUR,
        border: active
          ? '1px solid rgba(255,139,31,0.25)'
          : '1px solid rgba(255,255,255,0.08)',
        boxShadow: active
          ? '0 0 20px rgba(255,139,31,0.10), 0 0 20px rgba(74,124,255,0.06)'
          : 'none',
        padding: flush ? 0 : '18px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        position: 'relative',
        ...style,
      }}
      className="nb-tool-card"
    >
      {/* ── LIVE signal with wave ripple ── */}
      {showSignal && (
        <div style={{
          position: 'absolute',
          top: flush ? '10px' : '8px',
          right: flush ? '12px' : '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 2,
        }}>
          {/* Dot container with ripple */}
          <span style={{
            position: 'relative',
            width: '6px',
            height: '6px',
            flexShrink: 0,
            display: 'inline-block',
          }}>
            {/* Expanding ripple ring */}
            <span style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '1px solid',
              borderColor: NEON_ORANGE,
              animation: 'signal-ripple 2s ease-out infinite',
            }} />
            {/* Second ripple ring (delayed) */}
            <span style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '1px solid',
              borderColor: NEON_ORANGE,
              animation: 'signal-ripple 2s ease-out infinite 1s',
            }} />
            {/* Core dot */}
            <span style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: NEON_ORANGE,
              animation: 'signal-breathe 2.5s ease-in-out infinite',
            }} />
          </span>
          <span style={{
            fontFamily: T.MONO,
            fontSize: '8px',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.45)',
          }}>
            LIVE
          </span>
        </div>
      )}

      {title && (
        <div style={{
          fontFamily: T.SANS, fontSize: '9px', fontWeight: 500,
          textTransform: 'uppercase', letterSpacing: '0.12em',
          color: active ? NEON_ORANGE : 'rgba(255,255,255,0.3)',
          marginBottom: flush ? 0 : '10px',
          padding: flush ? '12px 14px 0' : 0,
          flexShrink: 0,
        }}>
          {title}
        </div>
      )}
      {children}
    </motion.div>
  );
}
