import { THEME } from "../theme";
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
  panelBg: THEME.PANEL_BG,
  border: THEME.PANEL_BORDER,
  label: THEME.LABEL,
  value: THEME.VALUE,
  inputBg: THEME.PANEL_INSET,
  inputBorder: THEME.PANEL_BORDER,
  inputText: THEME.VALUE,
  glass: {
    borderRadius: THEME.R_XL,
    background: THEME.PANEL_SURFACE,
    border: `1px solid ${THEME.PANEL_BORDER}`,
  } as React.CSSProperties,
} as const;

export function useToolTheme() {
  return toolTokens;
}
