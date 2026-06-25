import React from "react";

interface DataSourceBadgeProps {
  source: "live" | "mock" | "engine";
  label?: string;
}

export default function DataSourceBadge({ source, label }: DataSourceBadgeProps) {
  const isLive = source === "live";
  const isEngine = source === "engine";
  const accentColor = isLive ? "rgba(74, 222, 128, " : isEngine ? "rgba(96, 165, 250, " : "rgba(251, 191, 36, ";
  const dotColor = isLive ? "#4ade80" : isEngine ? "#60a5fa" : "#fbbf24";
  const defaultLabel = isLive ? "Live" : isEngine ? "Engine" : "Demo";
  const titleText = isLive
    ? "Data from live database"
    : isEngine
      ? "Real computation engine (GP/Bayesian optimization)"
      : "Using demo/mock data — API unavailable";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "var(--nb-fs-xxs)",
        fontFamily: "var(--nb-mono)",
        background: `${accentColor}0.12)`,
        color: `${accentColor}0.9)`,
        border: `1px solid ${accentColor}0.2)`,
      }}
      title={titleText}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: dotColor,
        }}
      />
      {label ?? defaultLabel}
    </span>
  );
}
