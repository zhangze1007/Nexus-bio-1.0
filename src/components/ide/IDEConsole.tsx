'use client';
import { useRef, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";

const LEVEL_COLORS = {
  info:    'rgba(120,180,255,0.7)',
  warn:    'rgba(255,190,60,0.8)',
  error:   'rgba(255,80,60,0.85)',
  success: 'rgba(80,220,120,0.8)',
};

const LEVEL_BG = {
  info:    'rgba(120,180,255,0.08)',
  warn:    'rgba(255,190,60,0.08)',
  error:   'rgba(255,80,60,0.08)',
  success: 'rgba(80,220,120,0.08)',
};

export default function IDEConsole() {
  const consoleOpen    = useUIStore(s => s.consoleOpen);
  const consoleEntries = useUIStore(s => s.consoleEntries);
  const toggleConsole  = useUIStore(s => s.toggleConsole);
  const clearConsole   = useUIStore(s => s.clearConsole);
  const bodyRef        = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleOpen && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [consoleEntries, consoleOpen]);

  if (!consoleOpen) return null;

  return (
    <div style={{
      gridColumn: '2',
      gridRow: '3',
      height: '180px',
      display: 'flex',
      flexDirection: 'column',
      background: '#070810',
      borderTop: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>
          Output Console · {consoleEntries.length} entries
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={clearConsole} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', padding: '2px', display: 'flex' }}
            title="Clear console">
            <Trash2 size={11} />
          </button>
          <button onClick={toggleConsole} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', padding: '2px', display: 'flex' }}
            title="Close console">
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Entries */}
      <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {consoleEntries.length === 0 ? (
          <p style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.15)', padding: '8px 12px', margin: 0 }}>
            No output yet.
          </p>
        ) : (
          consoleEntries.map(entry => {
            const d = new Date(entry.timestamp);
            const ts = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
            return (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                padding: '3px 12px',
                background: LEVEL_BG[entry.level],
                borderLeft: `2px solid ${LEVEL_COLORS[entry.level]}`,
                marginBottom: '1px',
              }}>
                <span style={{ fontFamily: MONO, fontSize: '9px', color: 'rgba(255,255,255,0.2)', flexShrink: 0, marginTop: '1px' }}>{ts}</span>
                <span style={{ fontFamily: MONO, fontSize: '9px', color: LEVEL_COLORS[entry.level], flexShrink: 0, textTransform: 'uppercase', marginTop: '1px' }}>
                  [{entry.level}]
                </span>
                <span style={{ fontFamily: MONO, fontSize: '9px', color: 'rgba(255,255,255,0.2)', flexShrink: 0, marginTop: '1px' }}>{entry.module}</span>
                <span style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(255,255,255,0.65)', flex: 1, lineHeight: 1.4 }}>{entry.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
