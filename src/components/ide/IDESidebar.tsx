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
 *   Z_BACKDROP (85) — translucent blur layer sits above main content
 *                      and below the topbar (90).
 *   Z_SIDEBAR  (100) — the panel itself is the topmost interactive layer,
 *                       above the topbar (90) and below any future modals (≥ 110).
 *
 * Spring config rationale:
 *   stiffness: 300, damping: 30 — models a fast, critically-damped spring
 *   that decelerates naturally (≈ Apple HIG). Higher stiffness = snappier
 *   response; damping 30 prevents oscillation while keeping a soft tail.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { ChevronLeft, LayoutGrid } from 'lucide-react';
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

/**
 * Collapsed width — sidebar is fully hidden (0 px).
 * An invisible edge trigger allows the user to re-open it.
 */
export const W_COLLAPSED = 0;
/** Expanded width — full labels & sections. */
export const W_EXPANDED  = 320;

const Z_BACKDROP = 85;
const Z_SIDEBAR  = 100;

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
   * Full-Height Hotzone handler (expanded state only):
   *   • Expanded  → click on a link/button navigates; click on empty space collapses
   *
   * Keyboard accessibility: we only intercept pointer clicks (detail > 0).
   * Keyboard-triggered events (Enter/Space on links) pass through normally.
   */
  const handleSidebarClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (e.detail === 0) return;

      if (!collapsed) {
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
      {/* ── Edge trigger — invisible touch zone when collapsed ── */}
      {/* Lets the user tap the left edge (black area) to open sidebar */}
      <AnimatePresence initial={false}>
        {collapsed && (
          <motion.div
            key="sidebar-edge-trigger"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={toggle}
            role="button"
            aria-label="Open sidebar"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
            style={{
              position: 'fixed',
              top: TOPBAR_H,
              left: 0,
              bottom: 0,
              width: 24,
              cursor: 'pointer',
              zIndex: Z_SIDEBAR,
              background: 'linear-gradient(to right, rgba(255,255,255,0.03), transparent)',
            }}
            title="Open sidebar"
          />
        )}
      </AnimatePresence>

      {/* ── Backdrop blur overlay (AnimatePresence for enter/exit) ── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={toggle}
            style={{
              position: 'fixed',
              top: TOPBAR_H,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: Z_BACKDROP,
              cursor: 'pointer',
              background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              willChange: 'opacity',
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
          borderRight: collapsed ? 'none' : '1px solid #1f1f1f',
          overflowY: collapsed ? 'hidden' : 'auto',
          overflowX: 'hidden',
          willChange: 'width',
        }}
      >
        {/* ── Header — logo centered ─────────────────────────────── */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '14px 16px',
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

            {/* Brand text */}
            <div
              style={{
                minWidth: 0,
                whiteSpace: 'nowrap',
              }}
            >
              <div style={{ fontFamily: BRAND, fontSize: 13, fontWeight: 700, color: VALUE }}>
                Nexus-Bio
              </div>
              <div style={{ fontFamily: SANS, fontSize: 10, color: LABEL }}>
                Tools Directory
              </div>
            </div>
          </Link>

          {/* Toggle button — absolute so it doesn't shift logo center */}
          <button
            type="button"
            onClick={toggle}
            title="Collapse sidebar"
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 30,
              height: 30,
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.04)',
              color: LABEL,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={14} />
          </button>
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
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          textDecoration: 'none',
                          borderRadius: 14,
                          border: isActive
                            ? '1px solid rgba(255,255,255,0.18)'
                            : '1px solid rgba(255,255,255,0.06)',
                          background: isActive
                            ? 'rgba(255,255,255,0.04)'
                            : 'rgba(255,255,255,0.03)',
                          minWidth: 0,
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

                        {/* Label text */}
                        <div
                          style={{
                            minWidth: 0,
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
  );
}
