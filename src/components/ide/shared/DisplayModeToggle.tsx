'use client';

import { T } from '../tokens';
import { usePersistedState } from './usePersistedState';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

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
        border: `1px solid ${PATHD_THEME.paperBorder}`,
        background: PATHD_THEME.paperSurface,
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
            background: displayMode === mode.key ? PATHD_THEME.sky : 'transparent',
            color: displayMode === mode.key ? PATHD_THEME.ink : PATHD_THEME.paperMuted,
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
