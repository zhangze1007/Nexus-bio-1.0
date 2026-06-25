"use client";

import type { CSSProperties } from "react";
import { THEME } from "../../../theme";
import { usePersistedState } from "./usePersistedState";
export type DisplayMode = "demo" | "research";

export function useDisplayMode() {
  return usePersistedState<DisplayMode>("nexus-bio:display-mode", "research");
}

type ControlVarsStyle = CSSProperties & Record<`--${string}`, string>;

export default function DisplayModeToggle() {
  const [displayMode, setDisplayMode] = useDisplayMode();

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px",
        borderRadius: "999px",
        border: `1px solid ${THEME.BORDER}`,
        background: THEME.PANEL_GLASS_STRONG,
      }}
    >
      {(
        [
          { key: "demo", label: "Demo" },
          { key: "research", label: "Research" },
        ] as const
      ).map((mode) => (
        <button
          key={mode.key}
          type="button"
          onClick={() => setDisplayMode(mode.key)}
          className="nb-ui-control"
          style={
            {
              minHeight: "28px",
              padding: "0 10px",
              borderRadius: "999px",
              border: "1px solid var(--nb-control-border)",
              background: "var(--nb-control-bg)",
              color: "var(--nb-control-color)",
              cursor: "pointer",
              fontFamily: THEME.SANS,
              fontSize: "11px",
              fontWeight: 700,
              ["--nb-control-bg" as const]: displayMode === mode.key ? THEME.SKY : "transparent",
              ["--nb-control-border" as const]: displayMode === mode.key ? THEME.SKY : "transparent",
              ["--nb-control-color" as const]: displayMode === mode.key ? THEME.INK : THEME.LABEL,
              ["--nb-control-hover-bg" as const]: "rgba(255,255,255,0.96)",
              ["--nb-control-hover-border" as const]: "rgba(255,255,255,0.96)",
              ["--nb-control-hover-color" as const]: THEME.INK,
              ["--nb-control-active-bg" as const]: "#ffffff",
              ["--nb-control-active-border" as const]: "#ffffff",
              ["--nb-control-active-color" as const]: THEME.INK,
            } as ControlVarsStyle
          }
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
