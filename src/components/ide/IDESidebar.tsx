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

const BORDER  = 'rgba(255,255,255,0.06)';
const LABEL   = 'rgba(255,255,255,0.28)';
const VALUE   = 'rgba(255,255,255,0.65)';

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
      background: '#10131a',
      borderRight: `1px solid ${BORDER}`,
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* Logo — also acts as Home link */}
      <Link href="/" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: collapsed ? '14px 0' : '14px 16px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        textDecoration: 'none',
        borderBottom: `1px solid ${BORDER}`,
        flexShrink: 0,
        transition: 'padding 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '7px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Dna size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
        </div>
        {!collapsed && (
          <span style={{ fontFamily: BRAND, fontWeight: 700, fontSize: '13px', color: VALUE, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden' }}>
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
        borderBottom: `1px solid ${BORDER}`,
        cursor: 'pointer',
        color: LABEL,
        flexShrink: 0,
        transition: 'color 0.15s',
      }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = VALUE}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = LABEL}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      {/* Section label */}
      {!collapsed && (
        <div style={{ padding: '10px 16px 6px', flexShrink: 0 }}>
          <span style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.12em', color: LABEL }}>
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
                borderLeft: isActive ? '2px solid rgba(120,220,160,0.6)' : '2px solid transparent',
                background: isActive ? 'rgba(120,220,160,0.06)' : 'transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div style={{
                width: '28px', height: '28px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '8px',
                background: isActive ? 'rgba(120,220,160,0.12)' : 'rgba(255,255,255,0.04)',
                flexShrink: 0,
              }}>
                <Icon size={13} style={{ color: isActive ? 'rgba(120,220,160,0.85)' : LABEL }} />
              </div>
              {!collapsed && (
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div style={{
                    fontFamily: SANS, fontSize: '11px', fontWeight: 600,
                    color: isActive ? VALUE : LABEL,
                    letterSpacing: '0.01em',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontFamily: SANS, fontSize: '10px',
                    color: isActive ? LABEL : 'rgba(255,255,255,0.18)',
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
          borderTop: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: SANS, fontSize: '9px', color: 'rgba(255,255,255,0.15)', letterSpacing: '0.04em' }}>
            v2.0 · IDE
          </span>
        </div>
      )}
    </div>
  );
}
