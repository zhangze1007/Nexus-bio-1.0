'use client';

import type { CSSProperties } from 'react';
import { T } from '../tokens';
import { usePersistedState } from './usePersistedState';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

export type DisplayMode = 'demo' | 'research';

export function useDisplayMode() {
  return usePersistedState<DisplayMode>('nexus-bio:display-mode', 'research');
}

type ControlVarsStyle = CSSProperties & Record<`--${string}`, string>;

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
        border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
        background: PATHD_THEME.panelGlassStrong,
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
          className="nb-ui-control"
          style={{
            minHeight: '28px',
            padding: '0 10px',
            borderRadius: '999px',
            border: '1px solid var(--nb-control-border)',
            background: 'var(--nb-control-bg)',
            color: 'var(--nb-control-color)',
            cursor: 'pointer',
            fontFamily: T.SANS,
            fontSize: '11px',
            fontWeight: 700,
            ['--nb-control-bg' as const]: displayMode === mode.key ? PATHD_THEME.sky : 'transparent',
            ['--nb-control-border' as const]: displayMode === mode.key ? PATHD_THEME.sky : 'transparent',
            ['--nb-control-color' as const]: displayMode === mode.key ? PATHD_THEME.ink : PATHD_THEME.label,
            ['--nb-control-hover-bg' as const]: 'rgba(255,255,255,0.96)',
            ['--nb-control-hover-border' as const]: 'rgba(255,255,255,0.96)',
            ['--nb-control-hover-color' as const]: PATHD_THEME.ink,
            ['--nb-control-active-bg' as const]: '#ffffff',
            ['--nb-control-active-border' as const]: '#ffffff',
            ['--nb-control-active-color' as const]: PATHD_THEME.ink,
          } as ControlVarsStyle}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
