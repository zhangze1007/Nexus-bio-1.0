/**
 * ModuleCard — BentoGrid cell component.
 *
 * A scientific figure plate for workbench modules.
 *
 * Cards now read as white figure sheets seated inside a sepia workbench frame.
 */
'use client';
import { motion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { PATHD_THEME } from '../../workbench/workbenchTheme';
import { T } from '../../ide/tokens';

interface ModuleCardProps {
  children: ReactNode;
  /** Grid area name (maps to ToolShell gridTemplateAreas) */
  area?: string;
  /** Highlights border with contextual accent */
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
  /** Show LIVE signal (default: false) */
  showSignal?: boolean;
}

export default function ModuleCard({
  children, area, active, title, style, colSpan, rowSpan, flush,
  showSignal = false,
}: ModuleCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        gridArea: area,
        gridColumn: colSpan ? `span ${colSpan}` : undefined,
        gridRow: rowSpan ? `span ${rowSpan}` : undefined,
        borderRadius: '20px',
        background: PATHD_THEME.paperSurfaceStrong,
        border: active
          ? `1px solid ${PATHD_THEME.paperBorderStrong}`
          : `1px solid ${PATHD_THEME.paperBorder}`,
        boxShadow: active
          ? '0 18px 36px rgba(96,74,56,0.12), inset 0 1px 0 rgba(255,255,255,0.82)'
          : '0 16px 32px rgba(96,74,56,0.08), inset 0 1px 0 rgba(255,255,255,0.78)',
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
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(231,199,169,0.08) 0%, rgba(255,255,255,0) 42%, rgba(207,196,227,0.08) 100%)',
          pointerEvents: 'none',
        }}
      />
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
              borderColor: PATHD_THEME.liveRed,
              animation: 'signal-ripple 2s ease-out infinite',
            }} />
            {/* Second ripple ring (delayed) */}
            <span style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '1px solid',
              borderColor: PATHD_THEME.liveRed,
              animation: 'signal-ripple 2s ease-out infinite 1s',
            }} />
            {/* Core dot */}
            <span style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: PATHD_THEME.liveRed,
              animation: 'signal-breathe 2.5s ease-in-out infinite',
            }} />
          </span>
          <span style={{
            fontFamily: T.MONO,
            fontSize: '8px',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: PATHD_THEME.paperLabel,
          }}>
            LIVE
          </span>
        </div>
      )}

      {title && (
        <div style={{
          fontFamily: T.SANS, fontSize: '9px', fontWeight: 500,
          textTransform: 'uppercase', letterSpacing: '0.12em',
          color: active ? PATHD_THEME.paperValue : PATHD_THEME.paperLabel,
          marginBottom: flush ? 0 : '10px',
          padding: flush ? '12px 14px 0' : 0,
          flexShrink: 0,
          position: 'relative',
          zIndex: 1,
        }}>
          {title}
        </div>
      )}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        {children}
      </div>
    </motion.div>
  );
}
