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
import CopilotSlideOver from './CopilotSlideOver';
import GlobalAutomationDock from './GlobalAutomationDock';
import { NavigationProvider } from '../../contexts/NavigationContext';
import { useUIStore } from '../../store/uiStore';
import WorkbenchStatusBar from '../workbench/WorkbenchStatusBar';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { AxonOrchestratorProvider } from '../../providers/AxonOrchestratorProvider';

function openCopilot() {
  useUIStore.getState().setCopilotOpen(true);
}

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

  // Global Ctrl+K / Cmd+K toggles the Axon copilot overlay.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        useUIStore.getState().toggleCopilot();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <NavigationProvider>
      <AxonOrchestratorProvider>
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

        {/*
         * Floating Copilot entry point.
         *
         * Primary hub entry across every /tools/* page. Opens the
         * CopilotSlideOver overlay instead of navigating to /tools/nexai,
         * so the current workbench stays mounted beneath the copilot.
         * Hidden on the directory page (no module context) and on
         * /tools/nexai itself (the full view is already on screen).
         */}
        {isWorkbench && moduleId !== 'nexai' && <CopilotFloatingButton />}

        {/*
         * Copilot overlay — always mounted here (not per-page) so its local
         * state survives cross-tool navigation. Visibility is driven by
         * uiStore.copilotOpen; AnimatePresence inside handles the transition.
         */}
        <CopilotSlideOver />

        {/*
         * Global automation dock — visible on every /tools/* route when
         * agentic mode is ON, so the user can see the shared queue
         * while navigating between tools. Self-gates: renders nothing
         * when agentic mode is OFF, preserving the non-agentic UX.
         */}
        <GlobalAutomationDock />
      </div>
      </AxonOrchestratorProvider>
    </NavigationProvider>
  );
}

function CopilotFloatingButton() {
  return (
    <button
      type="button"
      onClick={openCopilot}
      aria-label="Ask Axon Copilot"
      data-testid="nexai-floating-copilot"
      style={{
        position: 'fixed',
        right: '24px',
        bottom: '84px',
        zIndex: 95,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        borderRadius: '999px',
        background: 'linear-gradient(135deg, rgba(175,195,214,0.92), rgba(231,199,169,0.88))',
        color: '#111318',
        fontFamily: 'var(--font-sans, system-ui)',
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.02em',
        cursor: 'pointer',
        boxShadow: '0 10px 28px rgba(4,10,16,0.45), 0 2px 6px rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.22)',
      }}
    >
      <span aria-hidden style={{ fontFamily: 'monospace', fontSize: '14px' }}>⬡</span>
      <span>Ask Axon</span>
      <span
        aria-hidden
        style={{
          fontFamily: 'monospace',
          fontSize: '10px',
          padding: '2px 6px',
          borderRadius: '6px',
          background: 'rgba(17,19,24,0.18)',
          color: '#111318',
        }}
      >
        ⌘K
      </span>
    </button>
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
