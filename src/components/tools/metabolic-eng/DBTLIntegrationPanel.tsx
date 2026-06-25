"use client";
import { THEME } from "../../../theme";

export default function DBTLIntegrationPanel({
  activeRouteLabel,
  nodeCount,
  bottleneckCount,
  recommendedNextTool,
}: {
  activeRouteLabel: string;
  nodeCount: number;
  bottleneckCount: number;
  recommendedNextTool: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: "16px",
        right: "18px",
        left: "auto",
        width: "272px",
        zIndex: 14,
        pointerEvents: "auto",
        display: "grid",
        gap: "8px",
      }}
    >
      <div
        style={{
          padding: "14px",
          borderRadius: "var(--nb-radius-md)",
          background: "rgba(10,12,16,0.72)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.1)",
          display: "grid",
          gap: "10px",
        }}
      >
        <div
          style={{
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: THEME.LABEL,
          }}
        >
          DBTL Integration
        </div>
        <div style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-sm)", color: THEME.VALUE, lineHeight: 1.55 }}>
          Pathway design feeds directly into the DBTL cycle. Bottlenecks identified here become the hypotheses for the
          next iteration.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              color: THEME.LABEL,
            }}
          >
            <span>Active Route</span>
            <span style={{ color: THEME.VALUE }}>{activeRouteLabel}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              color: THEME.LABEL,
            }}
          >
            <span>Nodes</span>
            <span style={{ color: THEME.VALUE }}>{nodeCount}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              color: THEME.LABEL,
            }}
          >
            <span>Bottlenecks</span>
            <span style={{ color: THEME.VALUE }}>{bottleneckCount}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              color: THEME.LABEL,
            }}
          >
            <span>Next Tool</span>
            <span style={{ color: THEME.APRICOT }}>{recommendedNextTool}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
