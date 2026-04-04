'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Terminal, LayoutGrid } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { getToolDefinition } from '../tools/shared/toolRegistry';
import { T } from './tokens';
import DisplayModeToggle from './shared/DisplayModeToggle';

const SANS = T.SANS;
const MONO = T.MONO;

const BORDER = 'rgba(255,255,255,0.08)';
const LABEL  = 'rgba(255,255,255,0.45)';
const VALUE  = 'rgba(255,255,255,0.9)';

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

  return (
    <header className="nb-ide-topbar">
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

        <span style={{ color: 'rgba(255,255,255,0.16)' }}>/</span>

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
            <span style={{ color: 'rgba(255,255,255,0.16)' }}>/</span>

            <span style={{ fontFamily: MONO, fontSize: '10px', color: LABEL, textTransform: 'uppercase' }}>
              {tool?.shortLabel ?? moduleId}
            </span>
          </>
        )}

        {tool && (
          <>
            <span style={{ color: 'rgba(255,255,255,0.16)' }}>·</span>
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
            border: `1px solid ${consoleOpen ? 'rgba(255,255,255,0.15)' : BORDER}`,
            background: consoleOpen ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.03)',
            color: errorCount > 0 ? 'rgba(255,140,126,0.95)' : VALUE,
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
              border: `1px solid ${errorCount > 0 ? 'rgba(255,140,126,0.28)' : 'rgba(255,255,255,0.08)'}`,
              background: errorCount > 0 ? 'rgba(255,140,126,0.12)' : 'rgba(255,255,255,0.04)',
              color: errorCount > 0 ? 'rgba(255,140,126,0.92)' : LABEL,
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
