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
import { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, ChevronLeft, SlidersHorizontal, Minimize2 } from 'lucide-react';
import { usePersistedState } from '../../ide/shared/usePersistedState';
import { getToolDefinition } from './toolRegistry';
import { getToolValidity, type ValidityLevel } from '../../../config/toolValidity';
import { useNavigation } from '../../../contexts/NavigationContext';
import ToolTabBar, { type ToolTab } from './ToolTabBar';
import { ErrorBoundary } from '../../shared/ErrorBoundary';
import { THEME } from '../../../theme';
type ControlVarsStyle = CSSProperties & Record<`--${string}`, string>;

export interface ToolReference {
  /** Short citation key, e.g. "Orth et al., 2010" */
  citation: string;
  /** DOI link, e.g. "10.1038/nbt.1614" */
  doi?: string;
  /** Optional URL for non-DOI references */
  url?: string;
}

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
  hero?: ReactNode;
  /** Optional tab navigation — renders ToolTabBar between header and body */
  tabs?: ToolTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  /** Tab IDs hidden in "simple" mode. Toggle appears automatically when provided. */
  advancedTabIds?: string[];
  /** Scientific references with DOI links for credibility */
  references?: ToolReference[];
}

export default function ToolShell({
  moduleId, title, description, formula,
  grid, columns, rows, gap = 6,
  children, footer,
  hero,
  tabs,
  activeTab,
  onTabChange,
  advancedTabIds,
  references,
}: ToolShellProps) {
  const tool = getToolDefinition(moduleId);
  const validity = getToolValidity(moduleId);
  const { handleBack } = useNavigation();

  const validityStyles: Record<ValidityLevel, { bg: string; border: string; color: string; label: string }> = {
    real:    { bg: 'rgba(147, 203, 82, 0.16)',  border: 'rgba(147, 203, 82, 0.45)',  color: '#5d8a2f', label: 'REAL' },
    partial: { bg: 'rgba(232, 220, 200, 0.32)', border: 'rgba(180, 150, 100, 0.50)', color: '#8a6a30', label: 'PARTIAL' },
    demo:    { bg: 'rgba(250, 128, 114, 0.16)', border: 'rgba(250, 128, 114, 0.50)', color: '#a8453a', label: 'DEMO' },
  };

  // ── Progressive Disclosure: simple/advanced mode ──
  const [mode, setMode] = usePersistedState<'simple' | 'advanced'>(
    `nexus-bio:tool-mode:${moduleId}`,
    'simple',
  );

  const hasAdvancedTabs = Boolean(advancedTabIds && advancedTabIds.length > 0 && tabs && tabs.length > advancedTabIds.length);

  const visibleTabs = useMemo(() => {
    if (!tabs || !hasAdvancedTabs || mode === 'advanced') return tabs;
    return tabs.filter(t => !advancedTabIds!.includes(t.id));
  }, [tabs, hasAdvancedTabs, mode, advancedTabIds]);

  const toggleMode = useCallback(() => {
    const next = mode === 'simple' ? 'advanced' : 'simple';
    setMode(next);
    if (next === 'simple' && activeTab && onTabChange && advancedTabIds?.includes(activeTab)) {
      const firstSimple = tabs?.find(t => !advancedTabIds.includes(t.id));
      if (firstSimple) onTabChange(firstSimple.id);
    }
  }, [mode, setMode, activeTab, onTabChange, advancedTabIds, tabs]);

  return (
    <div className="nb-tool-shell" style={{
      position: 'relative',
      display: 'flex', flexDirection: 'column',
      background: `linear-gradient(180deg, ${THEME.PANEL_MUTED} 0%, ${THEME.PANEL_BG} 100%)`,
      fontFamily: THEME.SANS,
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
          borderBottom: `1px solid ${THEME.BORDER}`,
          background: THEME.PANEL_MUTED,
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          boxShadow: 'var(--nb-shadow-low), inset 0 1px 0 rgba(255,255,255,0.28)',
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
            borderRadius: 'var(--nb-radius-md)',
            border: '1px solid var(--nb-control-border)',
            background: 'var(--nb-control-bg)',
            color: 'var(--nb-control-color)',
            cursor: 'pointer',
            fontFamily: THEME.SANS,
            fontSize: 'var(--nb-fs-xs)',
            flexShrink: 0,
            ['--nb-control-bg' as const]: THEME.PANEL_GLASS_STRONG,
            ['--nb-control-border' as const]: THEME.BORDER,
            ['--nb-control-color' as const]: THEME.LABEL,
            ['--nb-control-hover-bg' as const]: 'rgba(255,255,255,0.08)',
            ['--nb-control-hover-border' as const]: 'rgba(255,255,255,0.12)',
            ['--nb-control-hover-color' as const]: THEME.INK,
            ['--nb-control-active-bg' as const]: 'rgba(255,255,255,0.12)',
            ['--nb-control-active-border' as const]: 'rgba(255,255,255,0.16)',
            ['--nb-control-active-color' as const]: THEME.INK,
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
            borderRadius: 'var(--nb-radius-md)',
            border: `1px solid ${THEME.BORDER}`,
            background: 'rgba(231, 199, 169, 0.24)',
            color: THEME.VALUE,
            fontFamily: THEME.MONO,
            fontSize: 'var(--nb-fs-xs)',
            fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          <LayoutGrid size={13} />
          {tool?.shortLabel ?? moduleId}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', fontWeight: 700,
            color: THEME.VALUE,
            letterSpacing: '-0.01em',
          }}>
            {tool?.name ?? title}
          </div>
          {description && (
            <div style={{
              fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
              color: THEME.LABEL,
              marginTop: '2px',
            }}>
              {description}
            </div>
          )}
          {(tool?.focus || tool?.glossary) && (
            <details style={{ marginTop: '4px' }}>
              <summary style={{
                fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL,
                cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase',
                opacity: 0.7,
              }}>
                What does this tool do?
              </summary>
              {tool.glossary && (
                <p style={{
                  fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.LABEL,
                  marginTop: '4px', lineHeight: 1.6, maxWidth: '520px',
                }}>
                  {tool.glossary}
                </p>
              )}
              {!tool.glossary && tool.focus && (
                <p style={{
                  fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.LABEL,
                  marginTop: '4px', lineHeight: 1.55, maxWidth: '480px',
                }}>
                  {tool.focus}
                </p>
              )}
              {tool.keyConcepts && tool.keyConcepts.length > 0 && (
                <div style={{ display: 'grid', gap: '4px', marginTop: '8px', maxWidth: '520px' }}>
                  {tool.keyConcepts.map(({ term, definition }) => (
                    <div key={term} style={{ display: 'flex', gap: '8px' }}>
                      <span style={{
                        fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                        color: THEME.SKY, fontWeight: 600, flexShrink: 0,
                      }}>
                        {term}
                      </span>
                      <span style={{
                        fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
                        color: THEME.LABEL, lineHeight: 1.5,
                      }}>
                        {definition}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </details>
          )}
        </div>

        {validity && (
          <div
            title={validity.caption}
            style={{
              fontFamily: THEME.MONO,
              fontSize: 'var(--nb-fs-xs)',
              fontWeight: 700,
              letterSpacing: '0.10em',
              padding: '5px 9px',
              borderRadius: 'var(--nb-radius-md)',
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
            fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
            color: THEME.VALUE,
          padding: '5px 8px',
            background: THEME.PANEL_GLASS_STRONG,
            border: `1px solid ${THEME.BORDER}`,
            borderRadius: 'var(--nb-radius-md)',
          }}>
            {formula}
          </div>
        )}

        {/* ── Simple/Advanced Toggle ── */}
        {hasAdvancedTabs && (
          <button
            type="button"
            onClick={toggleMode}
            className="nb-ui-control"
            title={mode === 'simple' ? 'Show advanced tabs' : 'Show simple view'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              minHeight: '28px',
              padding: '0 7px',
              borderRadius: 'var(--nb-radius-md)',
              border: '1px solid var(--nb-control-border)',
              background: mode === 'advanced' ? 'rgba(175, 195, 214, 0.15)' : 'var(--nb-control-bg)',
              color: mode === 'advanced' ? THEME.SKY : 'var(--nb-control-color)',
              cursor: 'pointer',
              fontFamily: THEME.SANS,
              fontSize: 'var(--nb-fs-xs)',
              fontWeight: mode === 'advanced' ? 600 : 400,
              flexShrink: 0,
              transition: 'all 0.2s ease',
              ['--nb-control-bg' as const]: 'rgba(16,19,26,0.8)',
              ['--nb-control-border' as const]: 'rgba(255,255,255,0.08)',
              ['--nb-control-color' as const]: THEME.LABEL,
              ['--nb-control-hover-bg' as const]: 'rgba(255,255,255,0.08)',
              ['--nb-control-hover-border' as const]: 'rgba(255,255,255,0.12)',
              ['--nb-control-hover-color' as const]: THEME.VALUE,
              ['--nb-control-active-bg' as const]: 'rgba(255,255,255,0.12)',
              ['--nb-control-active-border' as const]: 'rgba(255,255,255,0.16)',
              ['--nb-control-active-color' as const]: THEME.VALUE,
            } as ControlVarsStyle}
          >
            {mode === 'simple' ? (
              <><SlidersHorizontal size={12} /> Advanced</>
            ) : (
              <><Minimize2 size={12} /> Simple</>
            )}
          </button>
        )}
      </motion.header>

      {/* ── Tab Bar (optional) ─────────────────────────────── */}
      {visibleTabs && visibleTabs.length > 0 && activeTab && onTabChange && (
        <ToolTabBar tabs={visibleTabs} activeId={activeTab} onChange={onTabChange} />
      )}

      {/* ── BentoGrid ──────────────────────────────────────── */}
      {/* P3.4: fixed token padding (SP_SM=8, SP_MD=16) instead of dynamic Math.max */}
      <div className="nb-tool-shell__body" style={{
        flex: 1, minHeight: 0, padding: '8px 16px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
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
            gap: '8px',
          }}
        >
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </div>

      {/* ── References ──────────────────────────────────────── */}
      {references && references.length > 0 && (
        <div style={{
          padding: '6px 16px',
          borderTop: `1px solid ${THEME.BORDER}`,
          background: THEME.PANEL_MUTED,
          flexShrink: 0,
        }}>
          <details>
            <summary style={{
              fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL,
              cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase',
              listStyle: 'none', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <span style={{ fontSize: '11px', transition: 'transform 0.15s' }}>▸</span>
              References ({references.length})
            </summary>
            <div style={{ paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {references.map((ref, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, flexShrink: 0 }}>
                    [{i + 1}]
                  </span>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE }}>
                    {ref.citation}
                  </span>
                  {ref.doi && (
                    <a
                      href={`https://doi.org/${ref.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                        color: THEME.SKY, textDecoration: 'none',
                      }}
                    >
                      DOI: {ref.doi}
                    </a>
                  )}
                  {ref.url && !ref.doi && (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                        color: THEME.SKY, textDecoration: 'none',
                      }}
                    >
                      Link
                    </a>
                  )}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────── */}
        {footer && (
        <div className="nb-tool-shell__footer" style={{
          padding: '8px 16px',
          display: 'flex', gap: '8px', flexShrink: 0,
          borderTop: `1px solid ${THEME.BORDER}`,
          background: THEME.PANEL_MUTED,
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
  NEON: THEME.APRICOT,
  NEON_BLUE: THEME.SKY,
  NEON_ORANGE: THEME.APRICOT,
  NEON_SUCCESS: THEME.MINT,
  NEON_DANGER: THEME.CORAL,
  CORAL: THEME.CORAL,
  APRICOT: THEME.APRICOT,
  MINT: THEME.MINT,
  SKY: THEME.SKY,
  LILAC: THEME.LILAC,
  BG: THEME.PANEL_BG,
  CARD_BG: THEME.PANEL_SURFACE,
  BORDER: THEME.BORDER,
  LABEL: THEME.LABEL,
  VALUE: THEME.VALUE,
  DIM: THEME.LABEL,
  INPUT_BG: THEME.PANEL_INSET,
} as const;
