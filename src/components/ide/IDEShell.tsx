'use client';
/**
 * Nexus-Bio IDE Shell (legacy — kept for reference).
 *
 * Layout model: flexbox column with padding-left for sidebar spacer.
 * The sidebar is position:fixed (overlay) — expanding it never triggers reflow.
 *
 * z-index hierarchy:
 *   Content: 10  |  Backdrop: 45  |  Sidebar: 50  |  Topbar: 60
 *
 * NOTE: For /tools/* routes, ToolsLayoutShell (via app/tools/layout.tsx)
 * provides the persistent shell instead. This component is only used
 * if a tool is rendered outside the /tools route tree.
 */

import IDESidebar from './IDESidebar';
import IDETopBar from './IDETopBar';
import IDEConsole from './IDEConsole';

interface IDEShellProps {
  moduleId: string;
  children: React.ReactNode;
  topBarActions?: React.ReactNode;
}

export default function IDEShell({ moduleId, children, topBarActions }: IDEShellProps) {
  return (
    <div className="nb-ide-shell">
      {/* TopBar — z-index: 60 */}
      <IDETopBar moduleId={moduleId} actions={topBarActions} />

      {/* Sidebar — fixed overlay, z-index: 50 */}
      <IDESidebar />

      {/* Main canvas */}
      <main className="nb-ide-main" role="main" aria-label="Tool workspace">
        {children}
      </main>

      {/* Console — bottom panel */}
      <IDEConsole />
    </div>
  );
}
