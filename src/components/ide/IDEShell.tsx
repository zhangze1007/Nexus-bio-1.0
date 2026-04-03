'use client';
/**
 * Nexus-Bio IDE Shell
 *
 * Layout (CSS Grid):
 *   Col: [80px sidebar-spacer] [1fr main]
 *   Row: [56px topbar] [1fr canvas] [auto console]
 *
 * The 80px first column is a static spacer matching the collapsed
 * sidebar width. The sidebar itself is position:fixed (overlay) and
 * is NOT part of the grid flow — expanding it never triggers reflow.
 *
 * TopBar:  spans all columns, row 1
 * Canvas:  col 2, row 2
 * Console: col 2, row 3 (collapsible, 0 or 180px)
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
      {/* TopBar — row 1, spans all columns */}
      <IDETopBar moduleId={moduleId} actions={topBarActions} />

      {/* Sidebar — fixed overlay, not in grid flow */}
      <IDESidebar />

      {/* Main canvas — col 2, row 2 */}
      <main className="nb-ide-main" role="main" aria-label="Tool workspace">
        {children}
      </main>

      {/* Console — col 2, row 3 */}
      <IDEConsole />
    </div>
  );
}
