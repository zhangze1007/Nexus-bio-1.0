'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Menu, Terminal } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { getToolDefinition } from '../tools/shared/toolRegistry';
import { T } from './tokens';
import DisplayModeToggle from './shared/DisplayModeToggle';
import { PATHD_THEME } from '../workbench/workbenchTheme';

const SANS = T.SANS;
const MONO = T.MONO;

const BORDER = PATHD_THEME.paperBorder;
const LABEL  = PATHD_THEME.paperLabel;
const VALUE  = PATHD_THEME.paperValue;

interface IDETopBarProps {
  moduleId: string;
  actions?: React.ReactNode;
}

export default function IDETopBar({ moduleId, actions }: IDETopBarProps) {
  const pathname = usePathname();
  const toggleConsole = useUIStore((s) => s.toggleConsole);
  const consoleOpen = useUIStore((s) => s.consoleOpen);
  const consoleEntries = useUIStore((s) => s.consoleEntries);
  const errorCount = consoleEntries.filter((entry) => entry.level === 'error').length;
  const tool = getToolDefinition(moduleId);
  const isDirectory = !moduleId || pathname === '/tools' || pathname === '/tools/';
  const isWorkbench = !!moduleId && !isDirectory;
  const toggleSidebar = useUIStore((s) => s.toggleSidebarCollapsed);

  return (
    <header className="nb-ide-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
        {/* Sidebar toggle — only on workbench pages */}
        {isWorkbench && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: 8,
              background: PATHD_THEME.paperElevated,
              border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
              color: LABEL,
              cursor: 'pointer',
              flexShrink: 0,
              marginRight: 4,
            }}
          >
            <Menu size={14} />
          </button>
        )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'none',
            color: LABEL,
            fontFamily: SANS,
            fontSize: '11px',
          }}
        >
          <Home size={12} />
          Home
        </Link>

        <span style={{ color: PATHD_THEME.paperMuted }}>/</span>

        <Link
          href="/tools"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'none',
            color: isDirectory ? VALUE : LABEL,
            fontFamily: SANS,
            fontSize: '11px',
          }}
        >
          <LayoutGrid size={12} />
          Tools
        </Link>

        {!isDirectory && (
          <>
            <span style={{ color: PATHD_THEME.paperMuted }}>/</span>

            <span style={{ fontFamily: MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase' }}>
              {tool?.shortLabel ?? moduleId}
            </span>
          </>
        )}

        {tool && (
          <>
            <span style={{ color: PATHD_THEME.paperMuted }}>·</span>
            <span
              style={{
                minWidth: 0,
                fontFamily: SANS,
                fontSize: '12px',
                fontWeight: 600,
                color: VALUE,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {tool.name}
            </span>
          </>
        )}
      </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <DisplayModeToggle />
        {actions}
        <button
          type="button"
          onClick={toggleConsole}
          aria-pressed={consoleOpen}
          aria-label="Toggle console"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            minHeight: '36px',
            padding: '0 12px',
            borderRadius: '10px',
            border: `1px solid ${consoleOpen ? PATHD_THEME.paperBorderStrong : PATHD_THEME.sepiaPanelBorder}`,
            background: PATHD_THEME.paperElevated,
            color: errorCount > 0 ? PATHD_THEME.coral : VALUE,
            fontFamily: SANS,
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          <Terminal size={13} />
          Console
          <span
            style={{
              minWidth: '22px',
              height: '22px',
              borderRadius: '999px',
              border: `1px solid ${errorCount > 0 ? 'rgba(232,163,161,0.3)' : PATHD_THEME.paperBorder}`,
              background: errorCount > 0 ? 'rgba(232,163,161,0.14)' : PATHD_THEME.paperSurfaceMuted,
              color: errorCount > 0 ? PATHD_THEME.coral : LABEL,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: MONO,
              fontSize: '10px',
            }}
          >
            {consoleEntries.length}
          </span>
        </button>
      </div>
    </header>
  );
}
