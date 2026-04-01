'use client';
/**
 * Nexus-Bio IDE Shell
 *
 * Layout (CSS Grid):
 *   Col: [64–220px animated sidebar] [1fr main]
 *   Row: [48px topbar] [1fr canvas] [auto console]
 *
 * TopBar:  spans all columns, row 1
 * Sidebar: col 1, rows 2-3 (full height minus topbar)
 * Canvas:  col 2, row 2
 * Console: col 2, row 3 (collapsible, 0 or 180px)
 */

import IDESidebar from './IDESidebar';
import IDETopBar from './IDETopBar';
import IDEConsole from './IDEConsole';
import { useUIStore } from '../../store/uiStore';
import type { CSSProperties } from 'react';

interface IDEShellProps {
  moduleId: string;
  children: React.ReactNode;
  topBarActions?: React.ReactNode;
}

export default function IDEShell({ moduleId, children, topBarActions }: IDEShellProps) {
  const sidebarCollapsed = useUIStore(s => s.sidebarCollapsed);
  const sidebarWidth = sidebarCollapsed ? 72 : 264;

  return (
    <div
      className="nb-ide-shell"
      style={{
        '--nb-sidebar-width': `${sidebarWidth}px`,
      } as CSSProperties}
    >
      {/* TopBar — row 1, full width */}
      <IDETopBar moduleId={moduleId} actions={topBarActions} />

      {/* Sidebar — col 1, rows 2-3 */}
      <IDESidebar />

      {/* Main canvas — col 2, row 2 */}
      <div className="nb-ide-main">
        {children}
      </div>

      {/* Console — col 2, row 3 */}
      <IDEConsole />
    </div>
  );
}
