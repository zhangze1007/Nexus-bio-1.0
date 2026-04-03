'use client';
/**
 * ToolsLayoutShell — Persistent IDE chrome for all /tools/* routes.
 *
 * This component lives in the shared app/tools/layout.tsx and is NEVER
 * unmounted when navigating between tool pages. It provides:
 *   • IDESidebar  — persistent, position:fixed overlay (Workbench only)
 *   • IDETopBar   — breadcrumb + direction pill
 *   • IDEConsole  — dev-mode only, toggled via Ctrl+\
 *   • NavigationProvider — unified handleBack() for all children
 *
 * The {children} slot receives the individual tool page content,
 * which transitions smoothly via AnimatePresence.
 *
 * Layout model:
 *   The sidebar is fully hidden when collapsed (width: 0) and overlays
 *   content when expanded (position: fixed, width: 320px).
 *   Main content has no left offset — it fills the full viewport.
 *   No CSS grid-template-columns switching means no reflow.
 *
 * z-index hierarchy (globals.css):
 *   Content: 10  |  Backdrop: 85  |  Topbar: 90  |  Sidebar: 100
 */

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import IDESidebar from './IDESidebar';
import IDETopBar from './IDETopBar';
import IDEConsole from './IDEConsole';
import { NavigationProvider } from '../../contexts/NavigationContext';
import { useUIStore } from '../../store/uiStore';

interface ToolsLayoutShellProps {
  children: React.ReactNode;
}

export default function ToolsLayoutShell({ children }: ToolsLayoutShellProps) {
  const pathname = usePathname();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const devMode = useUIStore((s) => s.devMode);
  const consoleOpen = useUIStore((s) => s.consoleOpen);

  // Derive moduleId from the current path:
  //   /tools          → null (directory page)
  //   /tools/cethx    → 'cethx'
  //   /tools/pathd    → 'pathd'
  const moduleId = deriveModuleId(pathname);
  const isWorkbench = moduleId !== null;

  // Auto-collapse sidebar on route change ONLY if expanded.
  // This prevents the backdrop from lingering during page transition
  // (the "black screen" glitch).
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      if (!sidebarCollapsed) {
        useUIStore.getState().toggleSidebarCollapsed();
      }
    }
  }, [pathname, sidebarCollapsed]);

  // Ctrl+\ shortcut — toggle console (dev mode only)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === '\\') {
      e.preventDefault();
      const store = useUIStore.getState();
      if (store.devMode) {
        store.toggleConsole();
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <NavigationProvider>
      <div className="nb-ide-shell" aria-keyshortcuts="Control+Backslash">
        {/* TopBar — fixed at top, z-index: 90. Always mounted. */}
        <IDETopBar moduleId={moduleId ?? ''} />

        {/* Sidebar — fixed overlay, z-index: 100. Only on Workbench (/tools/[id]). */}
        {isWorkbench && <IDESidebar />}

        {/* Main canvas — fills remaining space after topbar. */}
        <main
          className="nb-ide-main"
          role="main"
          aria-label="Tool workspace"
          style={isWorkbench ? undefined : { paddingLeft: 0, marginLeft: 0 }}
        >
          {/*
           * initial={false}: Skip mount animation on first render to avoid
           * flash-of-empty-state when navigating directly to a tool URL.
           * mode="wait": Ensure exit animation completes before enter begins.
           */}
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

        {/* Console — dev-mode only, toggled via Ctrl+\ */}
        {devMode && consoleOpen && <IDEConsole />}
      </div>
    </NavigationProvider>
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
