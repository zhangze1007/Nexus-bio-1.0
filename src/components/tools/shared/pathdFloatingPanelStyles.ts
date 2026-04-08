import type { CSSProperties } from 'react';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

export const PATHD_FLOATING_PANEL_SURFACE: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(31,37,44,0.94) 0%, rgba(22,27,32,0.92) 100%)',
  backdropFilter: 'blur(26px) saturate(140%)',
  WebkitBackdropFilter: 'blur(26px) saturate(140%)',
  borderRadius: '22px',
  border: `1px solid ${PATHD_THEME.panelBorder}`,
  boxShadow: '0 20px 44px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.08)',
  overflow: 'hidden',
};

export const PATHD_FLOATING_PANEL_SHEEN: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 'inherit',
  background: `${PATHD_THEME.panelSheen}, radial-gradient(circle at top left, rgba(255,255,255,0.08), transparent 42%)`,
  pointerEvents: 'none',
};
