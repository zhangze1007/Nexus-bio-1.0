'use client';
/**
 * Nexus-Bio IDE Shell
 *
 * Layout (CSS Grid):
 *   Col: [220px sidebar] [1fr main]
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

interface IDEShellProps {
  moduleId: string;
  children: React.ReactNode;
  topBarActions?: React.ReactNode;
}

export default function IDEShell({ moduleId, children, topBarActions }: IDEShellProps) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#0a0c10',
      display: 'grid',
      gridTemplateColumns: '220px 1fr',
      gridTemplateRows: '48px 1fr auto',
      overflow: 'hidden',
    }}>
      {/* TopBar — row 1, full width */}
      <IDETopBar moduleId={moduleId} actions={topBarActions} />

      {/* Sidebar — col 1, rows 2-3 */}
      <IDESidebar />

      {/* Main canvas — col 2, row 2 */}
      <div style={{
        gridColumn: '2',
        gridRow: '2',
        position: 'relative',
        overflow: 'hidden',
        background: '#0d0f14',
      }}>
        {children}
      </div>

      {/* Console — col 2, row 3 */}
      <IDEConsole />
    </div>
  );
}
