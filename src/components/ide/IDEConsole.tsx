'use client';
import { useRef, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { PATHD_THEME } from '../workbench/workbenchTheme';

const MONO = "'IBM Plex Mono','JetBrains Mono','Fira Code',monospace";
const SANS = "'Public Sans',-apple-system,sans-serif";

const LEVEL_COLORS = {
  info:    PATHD_THEME.sky,
  warn:    PATHD_THEME.apricot,
  error:   PATHD_THEME.coral,
  success: PATHD_THEME.mint,
};

const LEVEL_BG = {
  info:    'rgba(175,195,214,0.16)',
  warn:    'rgba(231,199,169,0.16)',
  error:   'rgba(232,163,161,0.16)',
  success: 'rgba(191,220,205,0.16)',
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
    <div className="nb-ide-console" style={{
      height: '180px',
      display: 'flex',
      flexDirection: 'column',
      background: PATHD_THEME.sepiaPanelMuted,
      borderTop: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
      boxShadow: '0 -10px 30px rgba(0,0,0,0.28)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 12px',
        borderBottom: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: PATHD_THEME.label }}>
          Output Console · {consoleEntries.length} entries
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={clearConsole} style={{ background: 'none', border: 'none', cursor: 'pointer', color: PATHD_THEME.label, padding: '2px', display: 'flex' }}
            title="Clear console">
            <Trash2 size={11} />
          </button>
          <button onClick={toggleConsole} style={{ background: 'none', border: 'none', cursor: 'pointer', color: PATHD_THEME.label, padding: '2px', display: 'flex' }}
            title="Close console">
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Entries */}
      <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {consoleEntries.length === 0 ? (
          <p style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(226,232,240,0.42)', padding: '8px 12px', margin: 0 }}>
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
                background: PATHD_THEME.panelGlassStrong,
                borderLeft: `2px solid ${LEVEL_COLORS[entry.level]}`,
                marginBottom: '1px',
              }}>
                <span style={{ fontFamily: MONO, fontSize: '9px', color: 'rgba(226,232,240,0.42)', flexShrink: 0, marginTop: '1px' }}>{ts}</span>
                <span style={{ fontFamily: MONO, fontSize: '9px', color: LEVEL_COLORS[entry.level], flexShrink: 0, textTransform: 'uppercase', marginTop: '1px' }}>
                  [{entry.level}]
                </span>
                <span style={{ fontFamily: MONO, fontSize: '9px', color: 'rgba(226,232,240,0.42)', flexShrink: 0, marginTop: '1px' }}>{entry.module}</span>
                <span style={{ fontFamily: SANS, fontSize: '11px', color: PATHD_THEME.value, flex: 1, lineHeight: 1.4 }}>{entry.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
