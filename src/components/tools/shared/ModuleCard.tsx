/**
 * ModuleCard — BentoGrid cell component.
 *
 * A glassmorphism card with optional neon-green active border.
 * Designed for the #000 background aesthetic with zero hard borders —
 * separation is achieved via spacing and subtle glow.
 */
'use client';
import { motion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';

const SANS = "'Inter',-apple-system,sans-serif";
const NEON = '#39FF14';

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
}

export default function ModuleCard({
  children, area, active, title, style, colSpan, rowSpan, flush,
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
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.02)',
        backdropFilter: 'blur(12px)',
        border: active
          ? `1px solid ${NEON}30`
          : '1px solid rgba(255,255,255,0.04)',
        boxShadow: active ? `0 0 20px ${NEON}08` : 'none',
        padding: flush ? 0 : '16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        position: 'relative',
        ...style,
      }}
    >
      {title && (
        <div style={{
          fontFamily: SANS, fontSize: '9px', fontWeight: 500,
          textTransform: 'uppercase', letterSpacing: '0.12em',
          color: active ? NEON : 'rgba(255,255,255,0.3)',
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
