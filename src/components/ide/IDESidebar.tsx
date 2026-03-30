'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Dna, GitBranch, Activity, Cpu, Gauge, RefreshCw, Layers, Zap, Scissors, Sparkles,
  ChevronLeft, ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

const SANS  = "'Inter',-apple-system,sans-serif";
const BRAND = "'Space Grotesk',-apple-system,sans-serif";

interface ModuleDef {
  id: string;
  label: string;
  subtitle: string;
  Icon: LucideIcon;
  href: string;
}

const MODULES: ModuleDef[] = [
  { id: 'pathd',    label: 'PATHD',    subtitle: 'Pathway Design',    Icon: GitBranch, href: '/tools/pathd'    },
  { id: 'fbasim',   label: 'FBAsim',   subtitle: 'Flux Balance',      Icon: Activity,  href: '/tools/fbasim'   },
  { id: 'proevol',  label: 'PROEVOL',  subtitle: 'Protein Evolution', Icon: Dna,       href: '/tools/proevol'  },
  { id: 'gecair',   label: 'GECAIR',   subtitle: 'Gene Circuits',     Icon: Cpu,       href: '/tools/gecair'   },
  { id: 'dyncon',   label: 'DYNCON',   subtitle: 'Dynamic Control',   Icon: Gauge,     href: '/tools/dyncon'   },
  { id: 'dbtlflow', label: 'DBTLflow', subtitle: 'DBTL Tracker',      Icon: RefreshCw, href: '/tools/dbtlflow' },
  { id: 'multio',   label: 'MULTIO',   subtitle: 'Multi-Omics',       Icon: Layers,    href: '/tools/multio'   },
  { id: 'cethx',    label: 'CETHX',    subtitle: 'Thermodynamics',    Icon: Zap,       href: '/tools/cethx'    },
  { id: 'genmim',   label: 'GENMIM',   subtitle: 'Gene Minimization', Icon: Scissors,  href: '/tools/genmim'   },
  { id: 'nexai',    label: 'NEXAI',    subtitle: 'Axon',              Icon: Sparkles,  href: '/tools/nexai'    },
];

export default function IDESidebar() {
  const pathname = usePathname();
  const collapsed = useUIStore(s => s.sidebarCollapsed);
  const toggle    = useUIStore(s => s.toggleSidebarCollapsed);

  return (
    <div style={{
      gridColumn: '1',
      gridRow: '2 / 4',
      display: 'flex',
      flexDirection: 'column',
      background: '#FFFFFF',
      borderRight: '1px solid rgba(0,0,0,0.07)',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* Logo */}
      <Link href="/" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: collapsed ? '14px 0' : '14px 16px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        textDecoration: 'none',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        flexShrink: 0,
        transition: 'padding 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '7px',
          background: 'rgba(0,0,0,0.06)',
          border: '1px solid rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Dna size={12} style={{ color: 'rgba(0,0,0,0.55)' }} />
        </div>
        {!collapsed && (
          <span style={{ fontFamily: BRAND, fontWeight: 700, fontSize: '13px', color: 'rgba(0,0,0,0.75)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            Nexus-Bio
          </span>
        )}
      </Link>

      {/* Collapse toggle */}
      <button onClick={toggle} style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-end',
        padding: '6px 10px',
        background: 'none',
        border: 'none',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        cursor: 'pointer',
        color: 'rgba(0,0,0,0.25)',
        flexShrink: 0,
        transition: 'color 0.15s',
      }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(0,0,0,0.55)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(0,0,0,0.25)'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      {/* Section label */}
      {!collapsed && (
        <div style={{ padding: '10px 16px 6px', flexShrink: 0 }}>
          <span style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(0,0,0,0.3)' }}>
            Modules
          </span>
        </div>
      )}

      {/* Module list */}
      <nav style={{ flex: 1 }}>
        {MODULES.map(({ id, label, subtitle, Icon, href }) => {
          const isActive = pathname?.startsWith(href) || (pathname?.startsWith('/tools/metabolic-eng') && id === 'pathd');
          return (
            <Link
              key={id}
              href={href}
              title={collapsed ? `${label} — ${subtitle}` : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: collapsed ? '8px 0' : '8px 16px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                textDecoration: 'none',
                borderLeft: isActive ? '2px solid rgba(0,0,0,0.5)' : '2px solid transparent',
                background: isActive ? 'rgba(0,0,0,0.04)' : 'transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.025)'; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div style={{
                width: '28px', height: '28px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '8px',
                background: isActive ? 'rgba(200,240,224,0.6)' : 'rgba(0,0,0,0.04)',
                flexShrink: 0,
              }}>
                <Icon size={13} style={{ color: isActive ? 'rgba(0,120,80,0.8)' : 'rgba(0,0,0,0.4)' }} />
              </div>
              {!collapsed && (
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div style={{
                    fontFamily: SANS, fontSize: '11px', fontWeight: 600,
                    color: isActive ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)',
                    letterSpacing: '0.01em',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontFamily: SANS, fontSize: '10px',
                    color: isActive ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.25)',
                    marginTop: '1px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {subtitle}
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom version tag */}
      {!collapsed && (
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid rgba(0,0,0,0.05)',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: SANS, fontSize: '9px', color: 'rgba(0,0,0,0.2)', letterSpacing: '0.04em' }}>
            v2.0 · IDE
          </span>
        </div>
      )}
    </div>
  );
}
