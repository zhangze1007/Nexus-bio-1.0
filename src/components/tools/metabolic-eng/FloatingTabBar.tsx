"use client";

import { THEME } from "../../../theme";
import type { ToolTab } from "../shared/ToolTabBar";
export default function FloatingTabBar({
  tabs,
  activeTab,
  onTabChange,
  visible,
}: {
  tabs: ToolTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 30,
        display: "flex",
        gap: "2px",
        background: "rgba(10,12,16,0.72)",
        backdropFilter: "blur(16px) saturate(135%)",
        WebkitBackdropFilter: "blur(16px) saturate(135%)",
        borderRadius: "var(--nb-radius-md)",
        border: "1px solid rgba(255,255,255,0.1)",
        padding: "3px",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            aria-selected={isActive}
            className={`nb-tool-toggle${isActive ? " nb-tool-toggle--active" : ""}`}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--nb-radius-sm)",
              fontFamily: THEME.SANS,
              fontSize: "var(--nb-fs-sm)",
              fontWeight: isActive ? 600 : 400,
              color: isActive ? tab.accent : THEME.LABEL,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
