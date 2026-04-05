'use client';
/**
 * ToolsLayoutShell — Persistent IDE chrome for all /tools/* routes.
 *
 * This component lives in the shared app/tools/layout.tsx and is NEVER
 * unmounted when navigating between tool pages. It provides:
 *   • IDESidebar  — persistent, position:fixed overlay
 *   • IDETopBar   — breadcrumb + mode toggle + console button
 *   • IDEConsole  — collapsible output panel
 *   • NavigationProvider — unified handleBack() for all children
 *
 * The {children} slot receives the individual tool page content,
 * which transitions smoothly via AnimatePresence.
 *
 * Layout model:
 *   The main content area uses padding-left: 80px to reserve space for
 *   the collapsed sidebar (position: fixed). No CSS grid-template-columns
 *   switching means no reflow when sidebar expands/collapses.
 *
 * z-index hierarchy (globals.css):
 *   Content: 10  |  Backdrop: 80  |  Sidebar: 90  |  Topbar: 100
 */

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import IDESidebar, { W_COLLAPSED } from './IDESidebar';
import IDETopBar from './IDETopBar';
import IDEConsole from './IDEConsole';
import { NavigationProvider } from '../../contexts/NavigationContext';
import { useUIStore } from '../../store/uiStore';
import WorkbenchStatusBar from '../workbench/WorkbenchStatusBar';
import { useWorkbenchStore } from '../../store/workbenchStore';

interface ToolsLayoutShellProps {
  children: React.ReactNode;
}

export default function ToolsLayoutShell({ children }: ToolsLayoutShellProps) {
  const pathname = usePathname();

  // Derive moduleId from the current path:
  //   /tools          → null (directory page)
  //   /tools/cethx    → 'cethx'
  //   /tools/pathd    → 'pathd'
  const moduleId = deriveModuleId(pathname);

  // Sidebar only appears on workbench pages (/tools/[id]), not directory (/tools).
  const isWorkbench = moduleId !== null;

  // Auto-collapse sidebar on route change.
  // Uses setState directly (not toggle) to ensure deterministic collapse.
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      useUIStore.setState({ sidebarCollapsed: true });
    }
  }, [pathname]);

  useEffect(() => {
    useWorkbenchStore.getState().visitTool(moduleId);
  }, [moduleId]);

  return (
    <NavigationProvider>
      <div className={`nb-ide-shell${isWorkbench ? ' nb-workbench' : ''}`}>
        {/* TopBar — fixed at top, z-index: 100. Always mounted. */}
        <IDETopBar moduleId={moduleId ?? ''} />

        {/* Sidebar — fixed overlay, z-index: 90. Only on workbench pages. */}
        {isWorkbench && <IDESidebar />}

        {/* Main canvas — fills remaining space after topbar. */}
        <main
          className="nb-ide-main"
          role="main"
          aria-label="Tool workspace"
          style={isWorkbench ? undefined : { paddingLeft: 0 }}
          data-workbench={isWorkbench || undefined}
        >
          {/*
           * initial={false}: Skip mount animation on first render to avoid
           * flash-of-empty-state when navigating directly to a tool URL.
           * Cross-fade (no mode="wait"): Old and new pages overlap briefly
           * to prevent black screen flash between tool switches.
           */}
          <AnimatePresence initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeInOut' }}
              className={isWorkbench ? 'nb-workbench-content' : undefined}
              style={{
                position: 'relative',
                minHeight: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <WorkbenchStatusBar moduleId={moduleId} />
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Console — bottom panel. Always mounted. */}
        <IDEConsole />
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
