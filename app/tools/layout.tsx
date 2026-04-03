import ToolsLayoutShell from '../../src/components/ide/ToolsLayoutShell';

/**
 * Shared layout for all /tools/* routes.
 *
 * The ToolsLayoutShell provides a persistent IDE chrome (sidebar, topbar,
 * console) that is NEVER unmounted when navigating between tool pages.
 * This eliminates the "black screen" and "rapid open/close" glitches
 * caused by per-page IDEShell re-mounting.
 */
export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return <ToolsLayoutShell>{children}</ToolsLayoutShell>;
}
