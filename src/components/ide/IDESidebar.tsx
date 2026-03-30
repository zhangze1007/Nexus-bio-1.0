'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Dna, GitBranch, Activity, Cpu, Gauge, RefreshCw, Layers, Zap, Scissors, Sparkles,
  type LucideIcon,
} from 'lucide-react';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";
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
  { id: 'nexai',    label: 'NEXAI',    subtitle: 'AI Research Agent', Icon: Sparkles,  href: '/tools/nexai'    },
];

export default function IDESidebar() {
  const pathname = usePathname();

  return (
    <div style={{
      gridColumn: '1',
      gridRow: '2 / 4',
      display: 'flex',
      flexDirection: 'column',
      background: '#0a0c10',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* Logo */}
      <Link href="/" style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '14px 16px',
        textDecoration: 'none',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '7px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Dna size={12} style={{ color: 'rgba(255,255,255,0.65)' }} />
        </div>
        <span style={{ fontFamily: BRAND, fontWeight: 700, fontSize: '13px', color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.01em' }}>
          Nexus-Bio
        </span>
      </Link>

      {/* Section label */}
      <div style={{ padding: '10px 16px 6px', flexShrink: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.2)' }}>
          Modules
        </span>
      </div>

      {/* Module list */}
      <nav style={{ flex: 1 }}>
        {MODULES.map(({ id, label, subtitle, Icon, href }) => {
          const isActive = pathname?.startsWith(href) || pathname?.startsWith(`/tools/metabolic-eng`) && id === 'pathd';
          return (
            <Link
              key={id}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 16px',
                textDecoration: 'none',
                borderLeft: isActive ? '2px solid rgba(255,255,255,0.4)' : '2px solid transparent',
                background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div style={{
                width: '28px', height: '28px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '6px',
                background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                flexShrink: 0,
              }}>
                <Icon size={13} style={{ color: isActive ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontFamily: MONO, fontSize: '10px', fontWeight: 600,
                  color: isActive ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.45)',
                  letterSpacing: '0.04em',
                  lineHeight: 1.2,
                }}>
                  {label}
                </div>
                <div style={{
                  fontFamily: SANS, fontSize: '10px',
                  color: isActive ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)',
                  marginTop: '1px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {subtitle}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom version tag */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: MONO, fontSize: '9px', color: 'rgba(255,255,255,0.15)', letterSpacing: '0.06em' }}>
          v2.0 · IDE
        </span>
      </div>
    </div>
  );
}
