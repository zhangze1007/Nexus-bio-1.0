'use client';
import { Terminal } from 'lucide-react';
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
      background: '#FFFFFF',
      borderBottom: '1px solid rgba(0,0,0,0.07)',
    }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(0,0,0,0.3)', letterSpacing: '0.01em' }}>
          Tools
        </span>
        <span style={{ color: 'rgba(0,0,0,0.2)', fontSize: '13px', lineHeight: 1 }}>/</span>
        <span style={{ fontFamily: SANS, fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.6)', letterSpacing: '0.01em' }}>
          {moduleId.toUpperCase()}
        </span>
        <span style={{ color: 'rgba(0,0,0,0.2)', margin: '0 2px' }}>·</span>
        <span style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(0,0,0,0.4)' }}>
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
            background: consoleOpen ? 'rgba(0,0,0,0.06)' : 'transparent',
            border: `1px solid ${consoleOpen ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.12)'}`,
            borderRadius: '6px',
            color: errorCount > 0 ? '#E05040' : 'rgba(0,0,0,0.45)',
            fontFamily: SANS,
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.05)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = consoleOpen ? 'rgba(0,0,0,0.06)' : 'transparent'; }}
        >
          <Terminal size={11} />
          Console
          {consoleEntries.length > 0 && (
            <span style={{
              background: errorCount > 0 ? 'rgba(224,80,64,0.12)' : 'rgba(0,0,0,0.07)',
              borderRadius: '10px',
              padding: '0 5px',
              fontSize: '9px',
              fontFamily: MONO,
              color: errorCount > 0 ? '#E05040' : 'rgba(0,0,0,0.4)',
            }}>
              {consoleEntries.length}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
