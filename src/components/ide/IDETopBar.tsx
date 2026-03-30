'use client';
import Link from 'next/link';
import { ChevronLeft, Terminal } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";

const MODULE_NAMES: Record<string, string> = {
  pathd:    'Pathway & Enzyme Design',
  fbasim:   'Flux Balance Analysis',
  proevol:  'Protein Evolution Simulator',
  gecair:   'Gene Circuit AI Reasoner',
  dyncon:   'Dynamic Control Simulator',
  dbtlflow: 'Design-Build-Test-Learn',
  multio:   'Multi-Omics Integrator',
  cethx:    'Cell Thermodynamics Engine',
  genmim:   'Gene Minimization',
  nexai:    'AI Research Agent',
};

interface IDETopBarProps {
  moduleId: string;
  actions?: React.ReactNode;
}

export default function IDETopBar({ moduleId, actions }: IDETopBarProps) {
  const toggleConsole = useUIStore(s => s.toggleConsole);
  const consoleOpen = useUIStore(s => s.consoleOpen);
  const consoleEntries = useUIStore(s => s.consoleEntries);
  const errorCount = consoleEntries.filter(e => e.level === 'error').length;

  return (
    <div style={{
      gridColumn: '1 / -1',
      gridRow: '1',
      height: '48px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px 0 0',
      background: 'rgba(5,6,10,0.95)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }}>
      {/* Left: back + breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', height: '100%' }}>
        {/* Logo area (aligned with sidebar) */}
        <div style={{
          width: '220px',
          height: '100%',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '8px',
          flexShrink: 0,
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: 'rgba(255,255,255,0.3)', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'}
          >
            <ChevronLeft size={11} />
            <span style={{ fontFamily: SANS, fontSize: '10px', letterSpacing: '0.02em' }}>Home</span>
          </Link>
        </div>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 20px' }}>
          <span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Tools
          </span>
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '12px' }}>/</span>
          <span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {moduleId.toUpperCase()}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 4px' }}>·</span>
          <span style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '-0.01em' }}>
            {MODULE_NAMES[moduleId] ?? moduleId}
          </span>
        </div>
      </div>

      {/* Right: actions + console toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {actions}
        <button
          onClick={toggleConsole}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '4px 10px',
            background: consoleOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
            border: `1px solid ${consoleOpen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '3px',
            color: errorCount > 0 ? 'rgba(220,80,60,0.8)' : 'rgba(255,255,255,0.35)',
            fontFamily: MONO,
            fontSize: '10px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = consoleOpen ? 'rgba(255,255,255,0.08)' : 'transparent'; }}
        >
          <Terminal size={10} />
          Console
          {consoleEntries.length > 0 && (
            <span style={{
              background: errorCount > 0 ? 'rgba(220,60,60,0.25)' : 'rgba(255,255,255,0.1)',
              borderRadius: '10px',
              padding: '0 5px',
              fontSize: '9px',
              color: errorCount > 0 ? 'rgba(255,100,80,0.9)' : 'rgba(255,255,255,0.5)',
            }}>
              {consoleEntries.length}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
