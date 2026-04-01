'use client';

import { T } from '../tokens';
import { usePersistedState } from './usePersistedState';

export type DisplayMode = 'demo' | 'research';

export function useDisplayMode() {
  return usePersistedState<DisplayMode>('nexus-bio:display-mode', 'research');
}

export default function DisplayModeToggle() {
  const [displayMode, setDisplayMode] = useDisplayMode();

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px',
        borderRadius: '999px',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      {([
        { key: 'demo', label: 'Demo' },
        { key: 'research', label: 'Research' },
      ] as const).map((mode) => (
        <button
          key={mode.key}
          type="button"
          onClick={() => setDisplayMode(mode.key)}
          style={{
            minHeight: '28px',
            padding: '0 10px',
            borderRadius: '999px',
            border: 'none',
            background: displayMode === mode.key ? '#ffffff' : 'transparent',
            color: displayMode === mode.key ? '#000000' : 'rgba(255,255,255,0.55)',
            cursor: 'pointer',
            fontFamily: T.SANS,
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
