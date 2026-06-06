import { T } from '../components/ide/tokens';

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
  panelBg:     T.PANEL_BG,
  border:      T.PANEL_BORDER,
  label:       T.LABEL,
  value:       T.VALUE,
  inputBg:     T.PANEL_INSET,
  inputBorder: T.PANEL_BORDER,
  inputText:   T.VALUE,
  glass: {
    borderRadius: T.R_XL,
    background: T.PANEL_SURFACE,
    border: `1px solid ${T.PANEL_BORDER}`,
  } as React.CSSProperties,
} as const;

export function useToolTheme() {
  return toolTokens;
}
