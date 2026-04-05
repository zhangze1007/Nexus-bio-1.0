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
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, ChevronLeft } from 'lucide-react';
import { getToolDefinition } from './toolRegistry';
import { useNavigation } from '../../../contexts/NavigationContext';
import { T } from '../../ide/tokens';
import WorkbenchInlineContext from '../../workbench/WorkbenchInlineContext';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

const NEON_ACCENT = '#FF8B1F';

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
  workbenchSummary?: string;
  workbenchCompact?: boolean;
  workbenchSimulated?: boolean;
  hero?: ReactNode;
}

export default function ToolShell({
  moduleId, title, description, formula,
  grid, columns, rows, gap = 6,
  children, footer,
  workbenchSummary,
  workbenchCompact = true,
  workbenchSimulated = false,
  hero,
}: ToolShellProps) {
  const tool = getToolDefinition(moduleId);
  const { handleBack } = useNavigation();

  return (
    <div className="nb-tool-shell" style={{
      position: 'relative',
      display: 'flex', flexDirection: 'column',
      background: '#000000',
      fontFamily: T.SANS,
      flex: 1,
      minHeight: '100%',
    }}>
      {/* ── Module Info Bar ──────────────────────────────────── */}
      <motion.header
        className="nb-tool-shell__header"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
          flexShrink: 0,
          borderBottom: `1px solid ${PATHD_THEME.panelBorder}`,
          background: PATHD_THEME.panelGlassStrong,
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
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
            border: `1px solid ${PATHD_THEME.panelBorder}`,
            background: PATHD_THEME.chipNeutral,
            color: PATHD_THEME.label,
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
            border: `1px solid ${PATHD_THEME.panelBorder}`,
            background: PATHD_THEME.chipNeutral,
            color: PATHD_THEME.orange,
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
            color: PATHD_THEME.value,
            letterSpacing: '-0.01em',
          }}>
            {tool?.name ?? title}
          </div>
          {description && (
            <div style={{
              fontFamily: T.SANS, fontSize: '11px',
              color: PATHD_THEME.label,
              marginTop: '2px',
            }}>
              {description}
            </div>
          )}
        </div>

        {formula && (
          <div style={{
            fontFamily: T.MONO, fontSize: '10px',
            color: PATHD_THEME.label,
          padding: '6px 10px',
            background: 'rgba(255,255,255,0.045)',
            border: `1px solid ${PATHD_THEME.panelBorder}`,
            borderRadius: '10px',
          }}>
            {formula}
          </div>
        )}
      </motion.header>

      {/* ── BentoGrid ──────────────────────────────────────── */}
      <div className="nb-tool-shell__body" style={{
        flex: 1, minHeight: 0, padding: `${gap}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: `${gap}px`,
      }}>
        {workbenchSummary && (
          <WorkbenchInlineContext
            toolId={moduleId}
            title={tool?.name ?? title}
            summary={workbenchSummary}
            compact={workbenchCompact}
            isSimulated={workbenchSimulated}
          />
        )}
        {hero}
        <div
          className="nb-tool-shell__grid"
          style={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateAreas: grid,
            gridTemplateColumns: columns ?? '1fr',
            gridTemplateRows: rows ?? '1fr',
            gap: `${gap}px`,
          }}
        >
          {children}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
        {footer && (
        <div className="nb-tool-shell__footer" style={{
          padding: '6px 16px',
          display: 'flex', gap: '8px', flexShrink: 0,
          borderTop: `1px solid ${PATHD_THEME.panelBorder}`,
          background: PATHD_THEME.panelGlassStrong,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
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
  NEON: '#FF8B1F',
  NEON_BLUE: '#4A7CFF',
  NEON_ORANGE: '#FF8B1F',
  NEON_SUCCESS: '#39FF14',
  NEON_DANGER: '#FF3131',
  BG: '#000',
  CARD_BG: 'rgba(255,255,255,0.05)',
  BORDER: 'rgba(255,255,255,0.06)',
  LABEL: 'rgba(255,255,255,0.3)',
  VALUE: 'rgba(255,255,255,0.75)',
  DIM: 'rgba(255,255,255,0.18)',
  INPUT_BG: 'rgba(255,255,255,0.05)',
} as const;
