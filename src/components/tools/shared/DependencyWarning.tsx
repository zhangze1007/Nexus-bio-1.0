import { AlertTriangle, Clock } from "lucide-react";
import React from "react";
import { validateDependencies } from "../../../services/toolDependencyValidator";
import { useWorkbenchStore } from "../../../store/workbenchStore";
import { BIO_THEME_COLORS, THEME } from "../../../theme";

/**
 * DependencyWarning — shown at the top of a tool page when required
 * upstream tool payloads are missing or stale.
 *
 * Renders nothing when all dependencies are satisfied.
 */
export default function DependencyWarning({ toolId }: { toolId: string }) {
  const toolPayloads = useWorkbenchStore((s) => s.toolPayloads);
  const validation = validateDependencies(toolId, toolPayloads as Record<string, { updatedAt?: number } | undefined>);

  if (validation.status === "ok") return null;

  const isMissing = validation.status === "missing";
  const borderColor = isMissing ? "rgba(232,220,200,0.35)" : "rgba(231,199,169,0.25)";
  const bgColor = isMissing ? "rgba(232,220,200,0.10)" : "rgba(231,199,169,0.08)";
  const iconColor = isMissing ? BIO_THEME_COLORS.AMBER : THEME.APRICOT;
  const Icon = isMissing ? AlertTriangle : Clock;

  const depNames = isMissing ? validation.missing : validation.stale;
  const label = isMissing ? "Missing upstream data" : "Stale upstream data";
  const detail = isMissing
    ? `Run ${formatToolList(depNames)} first to provide required input for this tool.`
    : `Payloads from ${formatToolList(depNames)} are older than 30 minutes. Consider re-running them for up-to-date results.`;

  return (
    <div
      role="alert"
      style={{
        borderRadius: "10px",
        border: `1px solid ${borderColor}`,
        background: bgColor,
        padding: "10px 12px",
        display: "grid",
        gap: "6px",
        marginBottom: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
        <Icon size={15} color={iconColor} style={{ flexShrink: 0, marginTop: "2px" }} />
        <div style={{ display: "grid", gap: "4px", minWidth: 0 }}>
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: "11px",
              color: iconColor,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Workflow dependency &middot; {label}
          </span>
          <div
            style={{
              fontFamily: THEME.SANS,
              fontSize: "11px",
              color: THEME.LABEL,
              lineHeight: 1.5,
            }}
          >
            {detail}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {depNames.map((id) => (
          <span
            key={id}
            style={{
              borderRadius: "999px",
              border: `1px solid ${borderColor}`,
              background: THEME.CHIP_NEUTRAL,
              color: THEME.VALUE,
              padding: "2px 8px",
              fontFamily: THEME.MONO,
              fontSize: "10px",
              lineHeight: 1.4,
              overflowWrap: "anywhere",
            }}
          >
            {id}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Format a list of tool ids into a human-readable string. */
function formatToolList(ids: string[]): string {
  if (ids.length === 0) return "";
  if (ids.length === 1) return ids[0];
  if (ids.length === 2) return `${ids[0]} and ${ids[1]}`;
  return `${ids.slice(0, -1).join(", ")}, and ${ids[ids.length - 1]}`;
}
