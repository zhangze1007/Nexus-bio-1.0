'use client';
/**
 * Nexus-Bio IDE Sidebar — pure overlay drawer.
 *
 * Layout model:
 *   Collapsed → fully hidden (W_COLLAPSED = 0). Content uses full width.
 *   Expanded  → slides in from left as 320 px overlay with backdrop blur.
 *   Toggled via ☰ menu button in IDETopBar.
 *
 * Click behaviour:
 *   Clicking a tool icon navigates (auto-collapses on route change).
 *   Clicking empty space inside the panel or backdrop collapses.
 *
 * z-index hierarchy:
 *   Z_BACKDROP (80) — translucent blur layer behind sidebar
 *   Z_SIDEBAR  (90) — the drawer panel itself
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../store/uiStore';
import { TOOL_DEFINITIONS, TOOL_DIRECTIONS } from '../tools/shared/toolRegistry';
import { T } from '../ide/tokens';

// ── Design tokens ──────────────────────────────────────────────────────
const SANS   = T.SANS;
const BRAND  = T.BRAND;
const BORDER = 'rgba(255,255,255,0.08)';
const LABEL  = 'rgba(255,255,255,0.28)';
const VALUE  = 'rgba(255,255,255,0.9)';

/** Collapsed width — fully hidden, no persistent strip. */
export const W_COLLAPSED = 0;
/** Expanded width — full labels & sections. */
export const W_EXPANDED  = 320;

const Z_BACKDROP = 80;
const Z_SIDEBAR  = 90;

/** Height of IDETopBar defined in globals.css (.nb-ide-topbar). */
const TOPBAR_H = 56;

/** Spring physics: stiffness 300 + damping 30 → fast yet organic. */
const SPRING: { type: 'spring'; stiffness: number; damping: number } = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

// ── Component ──────────────────────────────────────────────────────────

export default function IDESidebar() {
  const pathname  = usePathname();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle    = useUIStore((s) => s.toggleSidebarCollapsed);

  /**
   * Collapse sidebar when clicking empty (non-interactive) space
   * inside the expanded panel.
   */
  const handlePanelClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (e.detail === 0) return;           // keyboard "click" — pass through
      const target = e.target as HTMLElement;
      if (!target.closest('a, button')) {
        toggle();
      }
    },
    [toggle],
  );

  return (
    <AnimatePresence initial={false}>
      {!collapsed && (
        <>
          {/* ── Backdrop blur overlay ── */}
          <motion.div
            key="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={toggle}
            className="backdrop-blur-md bg-black/20"
            style={{
              position: 'fixed',
              top: TOPBAR_H,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: Z_BACKDROP,
              cursor: 'pointer',
            }}
            aria-hidden={true}
          />

          {/* ── Sidebar drawer — slides in from left ── */}
          <motion.aside
            key="sidebar-panel"
            role="navigation"
            aria-label="Tool navigation"
            initial={{ x: -W_EXPANDED }}
            animate={{ x: 0 }}
            exit={{ x: -W_EXPANDED }}
            transition={SPRING}
            onClick={handlePanelClick}
            style={{
              position: 'fixed',
              top: TOPBAR_H,
              left: 0,
              bottom: 0,
              width: W_EXPANDED,
              zIndex: Z_SIDEBAR,
              display: 'flex',
              flexDirection: 'column',
              background: '#050505',
              borderRight: '1px solid #1f1f1f',
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollbarWidth: 'none',
            }}
          >
            {/* ── Header ─────────────────────────────────────────────── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '14px 16px',
                borderBottom: `1px solid ${BORDER}`,
              }}
            >
              <Link
                href="/tools"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textDecoration: 'none',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${BORDER}`,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <LayoutGrid size={14} style={{ color: 'rgba(255,255,255,0.75)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: BRAND, fontSize: 13, fontWeight: 700, color: VALUE }}>
                    Nexus-Bio
                  </div>
                  <div style={{ fontFamily: SANS, fontSize: 10, color: LABEL }}>
                    Tools Directory
                  </div>
                </div>
              </Link>
            </div>

            {/* ── Navigation list ────────────────────────────────────── */}
            <nav style={{ flex: 1, paddingBottom: 12 }}>
              {TOOL_DIRECTIONS.map((direction) => {
                const tools = TOOL_DEFINITIONS.filter((t) => t.direction === direction);

                return (
                  <section
                    key={direction}
                    style={{ padding: '12px 12px 0' }}
                  >
                    {/* Direction label */}
                    <p
                      style={{
                        margin: '0 0 8px',
                        padding: '0 4px',
                        fontFamily: SANS,
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: 'rgba(255,255,255,0.2)',
                      }}
                    >
                      {direction}
                    </p>

                    <div style={{ display: 'grid', gap: 6 }}>
                      {tools.map((tool) => {
                        const Icon     = tool.icon;
                        const isActive = pathname?.startsWith(tool.href);

                        return (
                          <Link
                            key={tool.id}
                            href={tool.href}
                            onClick={(e) => e.stopPropagation()}
                            className="nb-tool-icon"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '10px 12px',
                              textDecoration: 'none',
                              borderRadius: 14,
                              border: isActive
                                ? '1px solid rgba(255,139,31,0.20)'
                                : '1px solid rgba(255,255,255,0.06)',
                              background: isActive
                                ? 'rgba(255,139,31,0.06)'
                                : 'rgba(255,255,255,0.03)',
                              transition: 'background 0.15s, border-color 0.15s',
                            }}
                          >
                            {/* Icon box — 30×30 rounded square */}
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 10,
                                display: 'grid',
                                placeItems: 'center',
                                background: isActive
                                  ? 'rgba(255,139,31,0.12)'
                                  : 'rgba(255,255,255,0.05)',
                                border: isActive
                                  ? '1px solid rgba(255,139,31,0.25)'
                                  : `1px solid ${BORDER}`,
                                flexShrink: 0,
                              }}
                            >
                              <Icon
                                size={14}
                                style={{ color: isActive ? '#FF8B1F' : LABEL }}
                              />
                            </div>

                            {/* Label text */}
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontFamily: SANS,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: isActive ? '#ffffff' : 'rgba(255,255,255,0.55)',
                                  lineHeight: 1.25,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {tool.shortLabel}
                              </div>
                              <div
                                style={{
                                  fontFamily: SANS,
                                  fontSize: 10,
                                  color: isActive
                                    ? 'rgba(255,255,255,0.5)'
                                    : 'rgba(255,255,255,0.2)',
                                  lineHeight: 1.2,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {tool.name}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
