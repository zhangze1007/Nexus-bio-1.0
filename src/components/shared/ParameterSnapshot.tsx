'use client';
import { useState, useCallback } from 'react';
import { Save, Download, Upload, Clock } from 'lucide-react';
import { THEME } from '../../theme';

interface ParameterSnapshotProps {
  toolId: string;
  parameters: Record<string, unknown>;
  onLoad: (parameters: Record<string, unknown>) => void;
}

const STORAGE_PREFIX = 'nexus-bio:snapshot:';

interface Snapshot {
  id: string;
  toolId: string;
  label: string;
  parameters: Record<string, unknown>;
  timestamp: string;
}

function getSnapshots(toolId: string): Snapshot[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${toolId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSnapshot(toolId: string, snapshot: Snapshot) {
  const existing = getSnapshots(toolId);
  existing.unshift(snapshot);
  // Keep max 10 snapshots
  const trimmed = existing.slice(0, 10);
  localStorage.setItem(`${STORAGE_PREFIX}${toolId}`, JSON.stringify(trimmed));
}

export default function ParameterSnapshot({ toolId, parameters, onLoad }: ParameterSnapshotProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => getSnapshots(toolId));
  const [label, setLabel] = useState('');

  const handleSave = useCallback(() => {
    const snapshot: Snapshot = {
      id: Date.now().toString(36),
      toolId,
      label: label || `Snapshot ${snapshots.length + 1}`,
      parameters: { ...parameters },
      timestamp: new Date().toISOString(),
    };
    saveSnapshot(toolId, snapshot);
    setSnapshots(getSnapshots(toolId));
    setLabel('');
  }, [toolId, parameters, label, snapshots.length]);

  const handleExport = useCallback(() => {
    const data = JSON.stringify({ toolId, parameters, timestamp: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${toolId}-snapshot-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [toolId, parameters]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.parameters) {
          onLoad(data.parameters);
        }
      } catch { /* ignore */ }
    };
    input.click();
  }, [onLoad]);

  return (
    <div style={{
      borderRadius: THEME.R_MD,
      border: `1px solid ${THEME.BORDER}`,
      background: THEME.PANEL_INSET,
      padding: '12px',
    }}>
      <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: THEME.DIM, marginBottom: '8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Parameter Snapshots
      </div>

      {/* Save new */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          style={{
            flex: 1, height: '32px', padding: '0 8px',
            borderRadius: THEME.R_SM,
            border: `1px solid ${THEME.BORDER}`,
            background: THEME.PANEL_SURFACE,
            color: THEME.VALUE,
            fontFamily: THEME.SANS, fontSize: THEME.FS_XS,
          }}
        />
        <button onClick={handleSave} style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          height: '32px', padding: '0 10px',
          borderRadius: THEME.R_SM,
          border: `1px solid rgba(191,220,205,0.3)`,
          background: 'rgba(191,220,205,0.12)',
          color: THEME.MINT,
          fontFamily: THEME.MONO, fontSize: THEME.FS_XS,
          cursor: 'pointer',
        }}>
          <Save size={12} /> Save
        </button>
      </div>

      {/* Import/Export */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <button onClick={handleExport} style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          height: '28px', padding: '0 8px',
          borderRadius: THEME.R_SM,
          border: `1px solid ${THEME.BORDER}`,
          background: 'transparent',
          color: THEME.LABEL,
          fontFamily: THEME.MONO, fontSize: THEME.FS_XS,
          cursor: 'pointer', flex: 1,
        }}>
          <Download size={11} /> Export
        </button>
        <button onClick={handleImport} style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          height: '28px', padding: '0 8px',
          borderRadius: THEME.R_SM,
          border: `1px solid ${THEME.BORDER}`,
          background: 'transparent',
          color: THEME.LABEL,
          fontFamily: THEME.MONO, fontSize: THEME.FS_XS,
          cursor: 'pointer', flex: 1,
        }}>
          <Upload size={11} /> Import
        </button>
      </div>

      {/* Saved snapshots */}
      {snapshots.length > 0 && (
        <div style={{ display: 'grid', gap: '4px' }}>
          {snapshots.slice(0, 5).map((s) => (
            <button key={s.id} onClick={() => onLoad(s.parameters)} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 8px',
              borderRadius: THEME.R_SM,
              border: `1px solid ${THEME.BORDER}`,
              background: 'transparent',
              color: THEME.VALUE,
              fontFamily: THEME.SANS, fontSize: THEME.FS_XS,
              cursor: 'pointer', textAlign: 'left',
              transition: 'background 0.15s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Clock size={11} color={THEME.DIM} />
              <span style={{ flex: 1 }}>{s.label}</span>
              <span style={{ fontFamily: THEME.MONO, color: THEME.DIM, fontSize: '10px' }}>
                {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
