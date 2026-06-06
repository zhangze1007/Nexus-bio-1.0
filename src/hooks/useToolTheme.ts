import { PATHD_THEME } from '../components/workbench/workbenchTheme';

/**
 * Shared design tokens for all tool pages.
 *
 * Replaces the per-file PANEL_BG / BORDER / LABEL / VALUE /
 * INPUT_BG / INPUT_BORDER / INPUT_TEXT / GLASS declarations
 * that were copy-pasted across 6+ tool pages.
 *
 * FORBIDDEN files (DBTLflowPage, GECAIRPage, ProEvolPage) are NOT touched.
 * ToolsDirectoryPage keeps its own SURFACE_TINT / SHADOW / BTN_TEXT tokens.
 */
export const toolTokens = {
  panelBg:     PATHD_THEME.sepiaPanelMuted,
  border:      PATHD_THEME.sepiaPanelBorder,
  label:       PATHD_THEME.label,
  value:       PATHD_THEME.value,
  inputBg:     PATHD_THEME.panelInset,
  inputBorder: PATHD_THEME.sepiaPanelBorder,
  inputText:   PATHD_THEME.value,
  glass: {
    borderRadius: '24px',
    background: PATHD_THEME.panelSurface,
    border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
  } as React.CSSProperties,
} as const;

export function useToolTheme() {
  return toolTokens;
}
