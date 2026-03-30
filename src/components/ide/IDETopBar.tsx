'use client';
import Link from 'next/link';
import { Terminal, Home } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

const SANS = "'Inter',-apple-system,sans-serif";
const MONO = "'JetBrains Mono','Fira Code',monospace";

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
  nexai:    'Axon — Research Agent',
};

const BORDER = 'rgba(255,255,255,0.06)';
const LABEL  = 'rgba(255,255,255,0.28)';
const VALUE  = 'rgba(255,255,255,0.55)';

interface IDETopBarProps {
  moduleId: string;
  actions?: React.ReactNode;
}

export default function IDETopBar({ moduleId, actions }: IDETopBarProps) {
  const toggleConsole  = useUIStore(s => s.toggleConsole);
  const consoleOpen    = useUIStore(s => s.consoleOpen);
  const consoleEntries = useUIStore(s => s.consoleEntries);
  const errorCount     = consoleEntries.filter(e => e.level === 'error').length;

  return (
    <div style={{
      gridColumn: '1 / -1',
      gridRow: '1',
      height: '48px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      background: '#10131a',
      borderBottom: `1px solid ${BORDER}`,
    }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Link href="/" style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          textDecoration: 'none',
          color: LABEL,
          fontFamily: SANS, fontSize: '11px',
          transition: 'color 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = VALUE}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = LABEL}
        >
          <Home size={11} />
          Home
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '13px', lineHeight: 1 }}>/</span>
        <span style={{ fontFamily: SANS, fontSize: '11px', color: LABEL, letterSpacing: '0.01em' }}>
          Tools
        </span>
        <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '13px', lineHeight: 1 }}>/</span>
        <span style={{ fontFamily: SANS, fontSize: '11px', fontWeight: 600, color: VALUE, letterSpacing: '0.01em' }}>
          {moduleId.toUpperCase()}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 2px' }}>·</span>
        <span style={{ fontFamily: SANS, fontSize: '11px', color: LABEL }}>
          {MODULE_NAMES[moduleId] ?? moduleId}
        </span>
      </div>

      {/* Right: actions + console toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {actions}
        <button
          onClick={toggleConsole}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '4px 10px',
            background: consoleOpen ? 'rgba(255,255,255,0.06)' : 'transparent',
            border: `1px solid ${consoleOpen ? 'rgba(255,255,255,0.15)' : BORDER}`,
            borderRadius: '6px',
            color: errorCount > 0 ? '#E05040' : LABEL,
            fontFamily: SANS,
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = consoleOpen ? 'rgba(255,255,255,0.06)' : 'transparent'; }}
        >
          <Terminal size={11} />
          Console
          {consoleEntries.length > 0 && (
            <span style={{
              background: errorCount > 0 ? 'rgba(224,80,64,0.15)' : 'rgba(255,255,255,0.07)',
              borderRadius: '10px',
              padding: '0 5px',
              fontSize: '9px',
              fontFamily: MONO,
              color: errorCount > 0 ? '#E05040' : LABEL,
            }}>
              {consoleEntries.length}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
