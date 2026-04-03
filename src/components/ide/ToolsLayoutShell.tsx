'use client';
/**
 * ToolsLayoutShell — Persistent IDE chrome for all /tools/* routes.
 *
 * This component lives in the shared app/tools/layout.tsx and is NEVER
 * unmounted when navigating between tool pages. It provides:
 *   • IDESidebar  — persistent, position:fixed overlay
 *   • IDETopBar   — breadcrumb + mode toggle + console button
 *   • IDEConsole  — collapsible output panel
 *
 * The {children} slot receives the individual tool page content,
 * which transitions smoothly via AnimatePresence.
 *
 * Architecture:
 *   CSS Grid (same as old IDEShell):
 *     Col: [80px sidebar-spacer] [1fr main]
 *     Row: [56px topbar] [1fr canvas] [auto console]
 *
 * The sidebar is position:fixed and not part of grid flow.
 */

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import IDESidebar from './IDESidebar';
import IDETopBar from './IDETopBar';
import IDEConsole from './IDEConsole';
import { useUIStore } from '../../store/uiStore';

interface ToolsLayoutShellProps {
  children: React.ReactNode;
}

export default function ToolsLayoutShell({ children }: ToolsLayoutShellProps) {
  const pathname = usePathname();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  // Derive moduleId from the current path:
  //   /tools          → null (directory page)
  //   /tools/cethx    → 'cethx'
  //   /tools/pathd    → 'pathd'
  const moduleId = deriveModuleId(pathname);

  // Auto-collapse sidebar when navigating to a new tool (prevents "black screen" glitch)
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      // If sidebar is expanded, collapse it on route change to prevent
      // the backdrop lingering during page transition
      if (!sidebarCollapsed) {
        useUIStore.getState().toggleSidebarCollapsed();
      }
    }
  }, [pathname, sidebarCollapsed]);

  return (
    <div className="nb-ide-shell">
      {/* TopBar — row 1, spans all columns. Always mounted. */}
      <IDETopBar moduleId={moduleId ?? ''} />

      {/* Sidebar — fixed overlay, not in grid flow. Always mounted. */}
      <IDESidebar />

      {/* Main canvas — col 2, row 2. Content transitions smoothly. */}
      <main className="nb-ide-main" role="main" aria-label="Tool workspace">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Console — col 2, row 3. Always mounted. */}
      <IDEConsole />
    </div>
  );
}

/**
 * Extract the tool module ID from a /tools/* pathname.
 * Returns null for the directory page (/tools).
 */
function deriveModuleId(pathname: string): string | null {
  if (!pathname || pathname === '/tools' || pathname === '/tools/') return null;
  const segments = pathname.split('/').filter(Boolean);
  // /tools/cethx → ['tools', 'cethx'] → 'cethx'
  // /tools/metabolic-eng → ['tools', 'metabolic-eng'] → 'metabolic-eng'
  if (segments.length >= 2 && segments[0] === 'tools') {
    return segments[1];
  }
  return null;
}
