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
const NEON = '#99D8FF';

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
        borderRadius: '18px',
        background: 'linear-gradient(180deg, rgba(16,23,33,0.94), rgba(11,17,25,0.9))',
        backdropFilter: 'blur(12px)',
        border: active
          ? `1px solid ${NEON}4d`
          : '1px solid rgba(255,255,255,0.08)',
        boxShadow: active ? '0 14px 40px rgba(5,12,19,0.34)' : '0 10px 28px rgba(5,12,19,0.24)',
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
      {title && (
        <div style={{
          fontFamily: SANS, fontSize: '9px', fontWeight: 500,
          textTransform: 'uppercase', letterSpacing: '0.12em',
          color: active ? NEON : 'rgba(223,232,245,0.44)',
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
