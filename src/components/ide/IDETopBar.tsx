'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid } from 'lucide-react';
import { getToolDefinition } from '../tools/shared/toolRegistry';
import { T } from './tokens';

const SANS = T.SANS;
const MONO = T.MONO;

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
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

        {tool && (
          <>
            {/* Workflow Stage (Direction) */}
            <span style={{ color: 'rgba(255,255,255,0.16)' }}>/</span>
            <Link
              href={`/tools?direction=${encodeURIComponent(tool.direction)}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                textDecoration: 'none',
                color: 'rgba(255,255,255,0.45)',
                fontFamily: SANS,
                fontSize: '11px',
              }}
            >
              {tool.direction}
            </Link>

            {/* Tool Name */}
            <span style={{ color: 'rgba(255,255,255,0.16)' }}>/</span>
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

        {!isDirectory && !tool && (
          <>
            <span style={{ color: 'rgba(255,255,255,0.16)' }}>/</span>
            <span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase' }}>
              {moduleId}
            </span>
          </>
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
