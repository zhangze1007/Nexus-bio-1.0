/**
 * ToolShell — Unified BentoGrid wrapper for all Nexus-Bio tool pages.
 *
 * Provides a CSS Grid "bento" layout on a pure #000 canvas.
 * Navigation (back button, breadcrumbs) is handled by the persistent
 * IDETopBar in the shared tools layout — ToolShell only renders the
 * module info bar + bento grid + optional footer.
 *
 * Design principles (Rauch × Victor):
 *   • Black canvas, no hard borders — separation via spacing and glass
 *   • Neon-green (#39FF14) for active/focus states
 *   • Immediate feedback — every parameter change is visible instantly
 *   • Progressive disclosure via collapsible ModuleCards
 *
 * Usage:
 *   <ToolShell
 *     moduleId="cethx"
 *     title="Cell Thermodynamics"
 *     formula="ΔG' = ΔG° · (T/298)"
 *     grid="sidebar main metrics"    // grid-template-areas shorthand
 *     columns="240px 1fr 220px"
 *   >
 *     <ModuleCard area="sidebar"> ... </ModuleCard>
 *     <ModuleCard area="main">   ... </ModuleCard>
 *     <ModuleCard area="metrics"> ... </ModuleCard>
 *   </ToolShell>
 */
'use client';
import { useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, ChevronLeft } from 'lucide-react';
import { useToolStore } from '../../../store/toolStore';
import { getToolDefinition } from './toolRegistry';
import { useNavigation } from '../../../contexts/NavigationContext';
import { T } from '../../ide/tokens';

const NEON = '#FFFFFF';

export interface ToolShellProps {
  moduleId: string;
  title: string;
  description?: string;
  formula?: string;
  /** CSS grid-template-areas rows, e.g. "'side main metrics'" */
  grid?: string;
  /** CSS grid-template-columns, e.g. "240px 1fr 220px" */
  columns?: string;
  /** CSS grid-template-rows, e.g. "1fr" */
  rows?: string;
  /** Gap between bento cells */
  gap?: number;
  children: ReactNode;
  /** Extra footer content (export buttons) */
  footer?: ReactNode;
}

export default function ToolShell({
  moduleId, title, description, formula,
  grid, columns, rows, gap = 6,
  children, footer,
}: ToolShellProps) {
  const setActiveModule = useToolStore(s => s.setActiveModule);
  const tool = getToolDefinition(moduleId);
  const { handleBack } = useNavigation();

  useEffect(() => {
    setActiveModule(moduleId);
    return () => setActiveModule(null);
  }, [moduleId, setActiveModule]);

  return (
    <div className="nb-tool-shell" style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: '#000000',
      fontFamily: T.SANS,
    }}>
      {/* ── Module Info Bar ──────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
          flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.84)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            minHeight: '30px',
            padding: '0 8px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontFamily: T.SANS,
            fontSize: '10px',
            flexShrink: 0,
          }}
          title="Back to Tools"
        >
          <ChevronLeft size={12} />
          Tools
        </button>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          minHeight: '30px',
          padding: '0 10px',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.08)',
          background: `${NEON}14`,
          color: NEON,
          fontFamily: T.MONO,
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          <LayoutGrid size={13} />
          {tool?.shortLabel ?? moduleId}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: T.SANS, fontSize: '13px', fontWeight: 700,
            color: 'rgba(255,255,255,0.9)',
            letterSpacing: '-0.01em',
          }}>
            {tool?.name ?? title}
          </div>
          {description && (
            <div style={{
              fontFamily: T.SANS, fontSize: '11px',
              color: 'rgba(255,255,255,0.35)',
              marginTop: '2px',
            }}>
              {description}
            </div>
          )}
        </div>

        {formula && (
          <div style={{
            fontFamily: T.MONO, fontSize: '10px',
            color: 'rgba(255,255,255,0.2)',
            padding: '6px 10px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '10px',
          }}>
            {formula}
          </div>
        )}
      </motion.header>

      {/* ── BentoGrid ──────────────────────────────────────── */}
      <div className="nb-tool-shell__body" style={{
        flex: 1, minHeight: 0, padding: `${gap}px`,
        display: 'grid',
        gridTemplateAreas: grid,
        gridTemplateColumns: columns ?? '1fr',
        gridTemplateRows: rows ?? '1fr',
        gap: `${gap}px`,
      }}>
        {children}
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
        {footer && (
        <div style={{
          padding: '6px 16px',
          display: 'flex', gap: '8px', flexShrink: 0,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.84)',
        }}>
          {footer}
        </div>
      )}
    </div>
  );
}

// ── Re-export design tokens for consumers ──────────────────────────────

export const TOOL_TOKENS = {
  MONO: "'JetBrains Mono','Fira Code',monospace" as const,
  SANS: "'Inter',-apple-system,sans-serif" as const,
  NEON: '#FFFFFF',
  BG: '#000',
  CARD_BG: 'rgba(255,255,255,0.02)',
  BORDER: 'rgba(255,255,255,0.06)',
  LABEL: 'rgba(255,255,255,0.3)',
  VALUE: 'rgba(255,255,255,0.75)',
  DIM: 'rgba(255,255,255,0.18)',
  INPUT_BG: 'rgba(255,255,255,0.05)',
} as const;
