'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { TOOL_CATEGORIES, TOOL_DEFINITIONS } from '../tools/shared/toolRegistry';
import { T } from '../ide/tokens';

const SANS  = T.SANS;
const BRAND = T.BRAND;

const BORDER = 'rgba(255,255,255,0.08)';
const LABEL  = 'rgba(255,255,255,0.28)';
const VALUE  = 'rgba(255,255,255,0.9)';

export default function IDESidebar() {
  const pathname = usePathname();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebarCollapsed);

  return (
    <aside className="nb-ide-sidebar" role="navigation" aria-label="Tool navigation">
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: '10px',
          padding: collapsed ? '14px 10px' : '14px 16px',
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <Link
          href="/tools"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none',
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.14)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <LayoutGrid size={14} style={{ color: 'rgba(255,255,255,0.75)' }} />
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: BRAND, fontSize: '13px', fontWeight: 700, color: VALUE }}>
                Nexus-Bio
              </div>
              <div style={{ fontFamily: SANS, fontSize: '10px', color: LABEL }}>
                Tools Directory
              </div>
            </div>
          )}
        </Link>

        {!collapsed && (
          <button
            type="button"
            onClick={toggle}
            title="Collapse sidebar"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '10px',
              border: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.04)',
              color: LABEL,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={14} />
          </button>
        )}

        {collapsed && (
          <button
            type="button"
            onClick={toggle}
            title="Expand sidebar"
            style={{
              position: 'absolute',
              top: '14px',
              right: '8px',
              width: '24px',
              height: '24px',
              borderRadius: '8px',
              border: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.04)',
              color: LABEL,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      <nav className="nb-ide-sidebar-nav">
        {TOOL_CATEGORIES.map((category) => {
          const tools = TOOL_DEFINITIONS.filter((tool) => tool.category === category);

          return (
            <section key={category} style={{ padding: collapsed ? '10px 8px 0' : '12px 12px 0' }}>
              {!collapsed && (
                <p
                  style={{
                    margin: '0 0 8px',
                    padding: '0 4px',
                    fontFamily: SANS,
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'rgba(255,255,255,0.2)',
                  }}
                >
                  {category}
                </p>
              )}

              <div style={{ display: 'grid', gap: '6px' }}>
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  const isActive = pathname?.startsWith(tool.href);

                  return (
                    <Link
                      key={tool.id}
                      href={tool.href}
                      title={collapsed ? `${tool.shortLabel} — ${tool.name}` : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: collapsed ? '10px 8px' : '10px 12px',
                        textDecoration: 'none',
                        borderRadius: '14px',
                        border: isActive ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.06)',
                        background: isActive ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.03)',
                        minWidth: 0,
                        justifyContent: collapsed ? 'center' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '10px',
                          display: 'grid',
                          placeItems: 'center',
                          background: isActive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={14} style={{ color: isActive ? '#ffffff' : LABEL }} />
                      </div>

                      {!collapsed && (
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: SANS,
                              fontSize: '11px',
                              fontWeight: 600,
                              color: isActive ? '#ffffff' : 'rgba(255,255,255,0.55)',
                              lineHeight: 1.25,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {tool.shortLabel}
                          </div>
                          <div
                            style={{
                              fontFamily: SANS,
                              fontSize: '10px',
                              color: isActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
                              lineHeight: 1.2,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {tool.name}
                          </div>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>
    </aside>
  );
}
