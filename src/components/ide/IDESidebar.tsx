'use client';
/**
 * Nexus-Bio IDE Sidebar — Apple-style overlay with Framer Motion
 *
 * Performance model:
 *   • position: fixed — sidebar is an independent compositing layer.
 *   • Width is animated via Framer Motion spring, NOT CSS grid column,
 *     so the main content never reflows.
 *   • Backdrop overlay uses AnimatePresence (initial={false}) for smooth
 *     fade in/out without first-render flash.
 *   • layout prop on motion.aside ensures cross-route layout stability.
 *
 * z-index hierarchy:
 *   Z_BACKDROP (80) — translucent blur layer sits above main content
 *                      but below the sidebar panel.
 *   Z_SIDEBAR  (90) — the panel itself is the topmost interactive layer,
 *                      below the topbar (100) and any future modals (≥ 110).
 *
 * Spring config rationale:
 *   stiffness: 300, damping: 30 — models a fast, critically-damped spring
 *   that decelerates naturally (≈ Apple HIG). Higher stiffness = snappier
 *   response; damping 30 prevents oscillation while keeping a soft tail.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../store/uiStore';
import { TOOL_DEFINITIONS, TOOL_DIRECTIONS } from '../tools/shared/toolRegistry';
import { T } from '../ide/tokens';

// ── Design tokens ──────────────────────────────────────────────────────
const SANS  = T.SANS;
const BRAND = T.BRAND;
const BORDER = 'rgba(255,255,255,0.08)';
const LABEL  = 'rgba(255,255,255,0.28)';
const VALUE  = 'rgba(255,255,255,0.9)';

/** Collapsed width — icon-only strip (≈ 80 px). */
export const W_COLLAPSED = 80;
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
   * Full-Height Hotzone handler:
   *   • Collapsed → click anywhere on sidebar expands it
   *   • Expanded  → click on a link/button navigates; click on empty space collapses
   *
   * Keyboard accessibility: we only intercept pointer clicks (detail > 0).
   * Keyboard-triggered events (Enter/Space on links) pass through normally.
   */
  const handleSidebarClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      // detail === 0 means keyboard-triggered "click" → let it pass through
      if (e.detail === 0) return;

      if (collapsed) {
        // Prevent any link navigation when collapsed; expand instead
        e.preventDefault();
        toggle();
      } else {
        // Expanded: collapse only when clicking empty (non-interactive) area
        const target = e.target as HTMLElement;
        if (!target.closest('a, button')) {
          toggle();
        }
      }
    },
    [collapsed, toggle],
  );

  return (
    <>
      {/* ── Backdrop blur overlay (AnimatePresence for enter/exit) ── */}
      {/* initial={false} prevents flash on first render / SSR hydration */}
      <AnimatePresence initial={false}>
        {!collapsed && (
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
        )}
      </AnimatePresence>

      {/* ── Sidebar panel (spring-animated width) ────────────────── */}
      <motion.aside
        layout
        layoutId="nexus-sidebar"
        role="navigation"
        aria-label="Tool navigation"
        aria-expanded={!collapsed}
        animate={{ width: collapsed ? W_COLLAPSED : W_EXPANDED }}
        transition={SPRING}
        onClick={handleSidebarClick}
        style={{
          position: 'fixed',
          top: TOPBAR_H,
          left: 0,
          bottom: 0,
          zIndex: Z_SIDEBAR,
          display: 'flex',
          flexDirection: 'column',
          background: '#050505',
          borderRight: '1px solid #1f1f1f',
          overflowY: 'auto',
          overflowX: 'hidden',
          willChange: 'width',
          cursor: collapsed ? 'pointer' : 'default',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            gap: 10,
            padding: collapsed ? '14px 10px' : '14px 16px',
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <Link
            href="/tools"
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
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.14)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <LayoutGrid size={14} style={{ color: 'rgba(255,255,255,0.75)' }} />
            </div>

            {/* Brand text — smooth opacity fade during expand/collapse */}
            <motion.div
              animate={{ opacity: collapsed ? 0 : 1 }}
              transition={{ duration: collapsed ? 0.1 : 0.25, delay: collapsed ? 0 : 0.08 }}
              aria-hidden={collapsed}
              style={{
                minWidth: 0,
                pointerEvents: collapsed ? 'none' : 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              <div style={{ fontFamily: BRAND, fontSize: 13, fontWeight: 700, color: VALUE }}>
                Nexus-Bio
              </div>
              <div style={{ fontFamily: SANS, fontSize: 10, color: LABEL }}>
                Tools Directory
              </div>
            </motion.div>
          </Link>

          {/* Toggle button */}
          <button
            type="button"
            onClick={toggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              width: collapsed ? 24 : 30,
              height: collapsed ? 24 : 30,
              borderRadius: collapsed ? 8 : 10,
              border: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.04)',
              color: LABEL,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              ...(collapsed
                ? { position: 'absolute' as const, top: 14, right: 8 }
                : {}),
            }}
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* ── Navigation list ────────────────────────────────────── */}
        <nav style={{ flex: 1, paddingBottom: 12 }}>
          {TOOL_DIRECTIONS.map((direction) => {
            const tools = TOOL_DEFINITIONS.filter((t) => t.direction === direction);

            return (
              <section
                key={direction}
                style={{ padding: collapsed ? '10px 8px 0' : '12px 12px 0' }}
              >
                {/* Direction label — opacity fade, zero-height when collapsed */}
                <motion.p
                  animate={{ opacity: collapsed ? 0 : 1, height: collapsed ? 0 : 'auto' }}
                  transition={{ duration: 0.15 }}
                  aria-hidden={collapsed}
                  style={{
                    margin: collapsed ? 0 : '0 0 8px',
                    padding: '0 4px',
                    fontFamily: SANS,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'rgba(255,255,255,0.2)',
                    overflow: 'hidden',
                    pointerEvents: collapsed ? 'none' : 'auto',
                  }}
                >
                  {direction}
                </motion.p>

                <div style={{ display: 'grid', gap: 6 }}>
                  {tools.map((tool) => {
                    const Icon     = tool.icon;
                    const isActive = pathname?.startsWith(tool.href);

                    return (
                      <Link
                        key={tool.id}
                        href={tool.href}
                        title={collapsed ? `${tool.shortLabel} — ${tool.name}` : undefined}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: collapsed ? '10px 8px' : '10px 12px',
                          textDecoration: 'none',
                          borderRadius: 14,
                          border: isActive
                            ? '1px solid rgba(255,255,255,0.18)'
                            : '1px solid rgba(255,255,255,0.06)',
                          background: isActive
                            ? 'rgba(255,255,255,0.04)'
                            : 'rgba(255,255,255,0.03)',
                          minWidth: 0,
                          justifyContent: collapsed ? 'center' : 'flex-start',
                        }}
                      >
                        {/* Icon container — always visible */}
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 10,
                            display: 'grid',
                            placeItems: 'center',
                            background: isActive
                              ? 'rgba(255,255,255,0.12)'
                              : 'rgba(255,255,255,0.05)',
                            flexShrink: 0,
                          }}
                        >
                          <Icon
                            size={14}
                            style={{ color: isActive ? '#ffffff' : LABEL }}
                          />
                        </div>

                        {/* Label text — smooth opacity fade */}
                        <motion.div
                          animate={{ opacity: collapsed ? 0 : 1 }}
                          transition={{
                            duration: collapsed ? 0.1 : 0.2,
                            delay: collapsed ? 0 : 0.06,
                          }}
                          aria-hidden={collapsed}
                          style={{
                            minWidth: 0,
                            pointerEvents: collapsed ? 'none' : 'auto',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <div
                            style={{
                              fontFamily: SANS,
                              fontSize: 11,
                              fontWeight: 600,
                              color: isActive ? '#ffffff' : 'rgba(255,255,255,0.55)',
                              lineHeight: 1.25,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
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
                            }}
                          >
                            {tool.name}
                          </div>
                        </motion.div>
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
  );
}
