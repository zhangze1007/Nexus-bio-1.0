'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid } from 'lucide-react';
import { getToolDefinition } from '../tools/shared/toolRegistry';
import { T } from './tokens';

const SANS = T.SANS;
const MONO = T.MONO;

const BORDER = 'rgba(255,255,255,0.08)';
const LABEL  = 'rgba(255,255,255,0.28)';
const VALUE  = 'rgba(255,255,255,0.9)';

interface IDETopBarProps {
  moduleId: string;
  actions?: React.ReactNode;
}

export default function IDETopBar({ moduleId, actions }: IDETopBarProps) {
  const pathname = usePathname();
  const tool = getToolDefinition(moduleId);
  const isDirectory = !moduleId || pathname === '/tools' || pathname === '/tools/';

  return (
    <header className="nb-ide-topbar">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
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

              <span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase' }}>
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

        {tool && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Link
              href={`/tools?direction=${encodeURIComponent(tool.direction)}&tool=${tool.id}`}
              style={{
                minHeight: '28px',
                padding: '0 10px',
                borderRadius: '999px',
                border: `1px solid ${BORDER}`,
                background: 'rgba(255,255,255,0.03)',
                color: 'rgba(255,255,255,0.55)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                fontFamily: MONO,
                fontSize: '10px',
              }}
            >
              {tool.direction}
            </Link>
          </div>
        )}
      </div>

      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {actions}
        </div>
      )}
    </header>
  );
}
