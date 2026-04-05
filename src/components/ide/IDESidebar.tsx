'use client';
/**
 * Nexus-Bio IDE Sidebar — collapsed icon strip + expanded overlay.
 *
 * Layout model:
 *   Collapsed (80 px) — always visible, icon-only, centered icons.
 *   Expanded  (320 px) — spring-animated overlay with labels.
 *   Content offsets via padding-left: 80px (CSS in globals.css).
 *
 * Click behaviour:
 *   Collapsed: clicking an icon navigates. Clicking empty space expands.
 *   Expanded:  clicking an icon navigates. Clicking empty space collapses.
 *
 * z-index hierarchy:
 *   Z_BACKDROP (80) — translucent blur layer
 *   Z_SIDEBAR  (90) — the panel itself
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../store/uiStore';
import { TOOL_DEFINITIONS } from '../tools/shared/toolRegistry';
import { CROSS_STAGE_TOOL_IDS, WORKBENCH_STAGES } from '../tools/shared/workbenchConfig';
import { T } from '../ide/tokens';

// ── Design tokens ──────────────────────────────────────────────────────
const SANS  = T.SANS;
const BRAND = T.BRAND;
const BORDER = 'rgba(255,255,255,0.08)';
const LABEL  = 'rgba(255,255,255,0.45)';
const VALUE  = 'rgba(255,255,255,0.9)';

/** Collapsed width — icon-only strip (80 px). */
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
   * Sidebar click handler:
   *   Collapsed → expand when clicking empty (non-icon) space
   *   Expanded  → collapse when clicking empty (non-interactive) area
   */
  const handleSidebarClick = useCallback(
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
    <>
      {/* ── Backdrop blur overlay (expanded only) ── */}
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

      {/* ── Sidebar panel (always rendered, animated width) ── */}
      <motion.aside
        layout
        layoutId="nexus-sidebar"
        role="navigation"
        aria-label="Tool navigation"
        aria-expanded={!collapsed}
        className={collapsed ? 'nb-ide-sidebar nb-ide-sidebar--collapsed' : 'nb-ide-sidebar'}
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
          scrollbarWidth: 'none',        /* Firefox */
          msOverflowStyle: 'none',       /* IE / old Edge */
          willChange: 'width',
          cursor: 'pointer',
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
            padding: collapsed ? '14px 0' : '14px 16px',
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <Link
            href="/tools"
            onClick={(e) => {
              if (collapsed) {
                // Collapsed: toggle sidebar open (don't navigate)
                e.preventDefault();
                toggle();
              }
              e.stopPropagation();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textDecoration: 'none',
              minWidth: 0,
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                background: collapsed
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(255,255,255,0.06)',
                border: collapsed
                  ? '1px solid rgba(255,255,255,0.08)'
                  : '1px solid rgba(255,255,255,0.14)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <LayoutGrid size={14} style={{ color: 'rgba(255,255,255,0.75)' }} />
            </div>

            {/* Brand text — hidden when collapsed */}
            <motion.div
              animate={{ opacity: collapsed ? 0 : 1 }}
              transition={{ duration: collapsed ? 0.1 : 0.25, delay: collapsed ? 0 : 0.08 }}
              aria-hidden={collapsed}
              style={{
                width: collapsed ? 0 : 'auto',
                overflow: 'hidden',
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
        </div>

        {/* ── Navigation list ────────────────────────────────────── */}
        <nav style={{ flex: 1, paddingBottom: 12 }}>
          {WORKBENCH_STAGES.map((stage) => {
            const tools = TOOL_DEFINITIONS.filter((t) => stage.toolIds.includes(t.id));

            return (
              <section
                key={stage.id}
                style={{
                  padding: collapsed ? '10px 8px 0' : '12px 12px 0',
                  borderTop: collapsed ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                {/* Direction label — hidden when collapsed */}
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
                  {stage.shortLabel} · {stage.label}
                </motion.p>

                <div style={{
                  display: 'grid',
                  gap: 6,
                  justifyItems: collapsed ? 'center' : undefined,
                }}>
                  {tools.map((tool) => {
                    const Icon     = tool.icon;
                    const isActive = pathname?.startsWith(tool.href);

                    return (
                      <Link
                        key={tool.id}
                        href={tool.href}
                        title={collapsed ? `${tool.shortLabel} — ${tool.name}` : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="nb-tool-icon"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: collapsed ? 0 : '10px 12px',
                          textDecoration: 'none',
                          borderRadius: collapsed ? 10 : 14,
                          border: collapsed
                            ? 'none'
                            : isActive
                              ? '1px solid rgba(255,139,31,0.20)'
                              : '1px solid rgba(255,255,255,0.06)',
                          background: collapsed
                            ? 'transparent'
                            : isActive
                              ? 'rgba(255,139,31,0.06)'
                              : 'rgba(255,255,255,0.03)',
                          minWidth: 0,
                          width: collapsed ? 30 : undefined,
                          height: collapsed ? 30 : undefined,
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          transition: 'background 0.15s, border-color 0.15s',
                        }}
                      >
                        {/* Icon box — 30×30 rounded square, always visible */}
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

                        {/* Label text — hidden when collapsed via width:0 */}
                        <motion.div
                          animate={{ opacity: collapsed ? 0 : 1 }}
                          transition={{
                            duration: collapsed ? 0.1 : 0.2,
                            delay: collapsed ? 0 : 0.06,
                          }}
                          aria-hidden={collapsed}
                          style={{
                            width: collapsed ? 0 : 'auto',
                            overflow: 'hidden',
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

          <section
            style={{
              padding: collapsed ? '10px 8px 0' : '12px 12px 0',
              borderTop: collapsed ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}
          >
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
              Copilot
            </motion.p>

            <div style={{ display: 'grid', gap: 6, justifyItems: collapsed ? 'center' : undefined }}>
              {TOOL_DEFINITIONS.filter((tool) => CROSS_STAGE_TOOL_IDS.includes(tool.id as (typeof CROSS_STAGE_TOOL_IDS)[number])).map((tool) => {
                const Icon = tool.icon;
                const isActive = pathname?.startsWith(tool.href);

                return (
                  <Link
                    key={tool.id}
                    href={tool.href}
                    title={collapsed ? `${tool.shortLabel} — ${tool.name}` : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="nb-tool-icon"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: collapsed ? 0 : '10px 12px',
                      textDecoration: 'none',
                      borderRadius: collapsed ? 10 : 14,
                      border: collapsed
                        ? 'none'
                        : isActive
                          ? '1px solid rgba(255,139,31,0.20)'
                          : '1px solid rgba(255,255,255,0.06)',
                      background: collapsed
                        ? 'transparent'
                        : isActive
                          ? 'rgba(255,139,31,0.06)'
                          : 'rgba(255,255,255,0.03)',
                      minWidth: 0,
                      width: collapsed ? 30 : undefined,
                      height: collapsed ? 30 : undefined,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
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
                      <Icon size={14} style={{ color: isActive ? '#FF8B1F' : LABEL }} />
                    </div>

                    <motion.div
                      animate={{ opacity: collapsed ? 0 : 1 }}
                      transition={{ duration: collapsed ? 0.1 : 0.2, delay: collapsed ? 0 : 0.06 }}
                      aria-hidden={collapsed}
                      style={{
                        width: collapsed ? 0 : 'auto',
                        overflow: 'hidden',
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
                          color: isActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
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
        </nav>
      </motion.aside>
    </>
  );
}
