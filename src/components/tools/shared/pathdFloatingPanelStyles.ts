import type { CSSProperties } from 'react';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

export const PATHD_FLOATING_PANEL_SURFACE: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(246,250,255,0.08) 12%, rgba(27,33,39,0.86) 100%)',
  backdropFilter: 'blur(28px) saturate(138%)',
  WebkitBackdropFilter: 'blur(28px) saturate(138%)',
  borderRadius: '22px',
  border: '1px solid rgba(255,255,255,0.18)',
  boxShadow: '0 20px 44px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(255,255,255,0.04)',
};

export const PATHD_FLOATING_PANEL_SHEEN: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 'inherit',
  background: `${PATHD_THEME.panelSheen}, radial-gradient(circle at top left, rgba(255,255,255,0.14), transparent 40%), radial-gradient(circle at top right, rgba(255,255,255,0.08), transparent 32%)`,
  pointerEvents: 'none',
};
