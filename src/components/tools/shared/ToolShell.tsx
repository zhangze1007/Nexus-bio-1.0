/**
 * ToolShell — Unified BentoGrid wrapper for all Nexus-Bio tool pages.
 *
 * Provides a CSS Grid "bento" layout on a pure #000 canvas.
 * Navigation (back button, breadcrumbs) is handled by the persistent
 * IDETopBar in the shared tools layout — ToolShell only renders the
 * module info bar + bento grid + optional footer.
 *
 * Design principles (Rauch × Victor):
 *   • Paper substrate with scientific framing
 *   • Palette accents are coral / apricot / mint / sky / lilac
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
import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, ChevronLeft } from 'lucide-react';
import { getToolDefinition } from './toolRegistry';
import { getToolValidity, type ValidityLevel } from './toolValidity';
import { useNavigation } from '../../../contexts/NavigationContext';
import { T } from '../../ide/tokens';
import WorkbenchInlineContext from '../../workbench/WorkbenchInlineContext';
import { PATHD_THEME } from '../../workbench/workbenchTheme';
type ControlVarsStyle = CSSProperties & Record<`--${string}`, string>;

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
  const validity = getToolValidity(moduleId);
  const { handleBack } = useNavigation();

  const validityStyles: Record<ValidityLevel, { bg: string; border: string; color: string; label: string }> = {
    real:    { bg: 'rgba(147, 203, 82, 0.16)',  border: 'rgba(147, 203, 82, 0.45)',  color: '#5d8a2f', label: 'REAL' },
    partial: { bg: 'rgba(232, 220, 200, 0.32)', border: 'rgba(180, 150, 100, 0.50)', color: '#8a6a30', label: 'PARTIAL' },
    demo:    { bg: 'rgba(250, 128, 114, 0.16)', border: 'rgba(250, 128, 114, 0.50)', color: '#a8453a', label: 'DEMO' },
  };

  return (
    <div className="nb-tool-shell" style={{
      position: 'relative',
      display: 'flex', flexDirection: 'column',
      background: `linear-gradient(180deg, ${PATHD_THEME.sepiaPanelMuted} 0%, ${PATHD_THEME.sepiaPanel} 100%)`,
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
          display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
          flexShrink: 0,
          borderBottom: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
          background: PATHD_THEME.sepiaPanelMuted,
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          boxShadow: '0 10px 30px rgba(96,74,56,0.08), inset 0 1px 0 rgba(255,255,255,0.28)',
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          className="nb-ui-control"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            minHeight: '28px',
            padding: '0 7px',
            borderRadius: '10px',
            border: '1px solid var(--nb-control-border)',
            background: 'var(--nb-control-bg)',
            color: 'var(--nb-control-color)',
            cursor: 'pointer',
            fontFamily: T.SANS,
            fontSize: '9px',
            flexShrink: 0,
            ['--nb-control-bg' as const]: PATHD_THEME.panelGlassStrong,
            ['--nb-control-border' as const]: PATHD_THEME.sepiaPanelBorder,
            ['--nb-control-color' as const]: PATHD_THEME.label,
            ['--nb-control-hover-bg' as const]: 'rgba(255,255,255,0.94)',
            ['--nb-control-hover-border' as const]: 'rgba(255,255,255,0.94)',
            ['--nb-control-hover-color' as const]: PATHD_THEME.ink,
            ['--nb-control-active-bg' as const]: '#ffffff',
            ['--nb-control-active-border' as const]: '#ffffff',
            ['--nb-control-active-color' as const]: PATHD_THEME.ink,
          } as ControlVarsStyle}
          title="Back to Tools"
        >
          <ChevronLeft size={12} />
          Tools
        </button>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
            minHeight: '28px',
            padding: '0 8px',
            borderRadius: '10px',
            border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
            background: 'rgba(231, 199, 169, 0.24)',
            color: PATHD_THEME.value,
            fontFamily: T.MONO,
            fontSize: '9px',
            fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          <LayoutGrid size={13} />
          {tool?.shortLabel ?? moduleId}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: T.SANS, fontSize: '12px', fontWeight: 700,
            color: PATHD_THEME.value,
            letterSpacing: '-0.01em',
          }}>
            {tool?.name ?? title}
          </div>
          {description && (
            <div style={{
              fontFamily: T.SANS, fontSize: '10px',
              color: PATHD_THEME.label,
              marginTop: '2px',
            }}>
              {description}
            </div>
          )}
        </div>

        {validity && (
          <div
            title={validity.caption}
            style={{
              fontFamily: T.MONO,
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.10em',
              padding: '5px 9px',
              borderRadius: '10px',
              background: validityStyles[validity.level].bg,
              border: `1px solid ${validityStyles[validity.level].border}`,
              color: validityStyles[validity.level].color,
              cursor: 'help',
              flexShrink: 0,
            }}
          >
            {validityStyles[validity.level].label}
          </div>
        )}

        {formula && (
          <div style={{
            fontFamily: T.MONO, fontSize: '9px',
            color: PATHD_THEME.value,
          padding: '5px 8px',
            background: PATHD_THEME.panelGlassStrong,
            border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
            borderRadius: '10px',
          }}>
            {formula}
          </div>
        )}
      </motion.header>

      {/* ── BentoGrid ──────────────────────────────────────── */}
      <div className="nb-tool-shell__body" style={{
        flex: 1, minHeight: 0, padding: `${Math.max(gap, 8)}px 12px 12px`,
        display: 'flex',
        flexDirection: 'column',
        gap: `${Math.max(gap, 8)}px`,
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
            gap: `${Math.max(gap, 10)}px`,
          }}
        >
          {children}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
        {footer && (
        <div className="nb-tool-shell__footer" style={{
          padding: '10px 20px',
          display: 'flex', gap: '8px', flexShrink: 0,
          borderTop: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
          background: PATHD_THEME.sepiaPanelMuted,
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
  MONO: "'IBM Plex Mono','JetBrains Mono','Fira Code',monospace" as const,
  SANS: "'Public Sans',-apple-system,sans-serif" as const,
  NEON: PATHD_THEME.apricot,
  NEON_BLUE: PATHD_THEME.sky,
  NEON_ORANGE: PATHD_THEME.apricot,
  NEON_SUCCESS: PATHD_THEME.mint,
  NEON_DANGER: PATHD_THEME.coral,
  CORAL: PATHD_THEME.coral,
  APRICOT: PATHD_THEME.apricot,
  MINT: PATHD_THEME.mint,
  SKY: PATHD_THEME.sky,
  LILAC: PATHD_THEME.lilac,
  BG: PATHD_THEME.sepiaPanel,
  CARD_BG: PATHD_THEME.panelSurface,
  BORDER: PATHD_THEME.sepiaPanelBorder,
  LABEL: PATHD_THEME.label,
  VALUE: PATHD_THEME.value,
  DIM: PATHD_THEME.label,
  INPUT_BG: PATHD_THEME.panelInset,
} as const;
