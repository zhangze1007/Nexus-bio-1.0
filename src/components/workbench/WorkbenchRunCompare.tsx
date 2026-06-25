"use client";

import { Gauge, GitCompareArrows } from "lucide-react";
import { useMemo } from "react";
import { useWorkbenchStore } from "../../store/workbenchStore";
import { THEME } from "../../theme";
import { TOOL_BY_ID } from "../tools/shared/toolRegistry";
import type { WorkbenchStageId } from "../tools/shared/workbenchConfig";
import { getAuthorityTier } from "./workbenchTrust";

interface WorkbenchRunCompareProps {
  toolId?: string | null;
  stageId?: WorkbenchStageId | null;
  title?: string;
}

const BORDER = THEME.BORDER;
const LABEL = THEME.LABEL;
const VALUE = THEME.VALUE;

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WorkbenchRunCompare({
  toolId = null,
  stageId = null,
  title = "Run Compare",
}: WorkbenchRunCompareProps) {
  const runArtifacts = useWorkbenchStore((s) => s.runArtifacts);

  const [latest, previous] = useMemo(() => {
    const filtered = runArtifacts.filter((artifact) => {
      if (toolId) return artifact.toolId === toolId;
      if (stageId) return artifact.stageId === stageId;
      return true;
    });
    return filtered.slice(0, 2);
  }, [runArtifacts, stageId, toolId]);

  const compareLabel = useMemo(() => {
    if (!latest || !previous) return null;
    const upstreamDelta = latest.upstreamArtifactIds.length - previous.upstreamArtifactIds.length;
    const sameSummary = latest.summary === previous.summary;
    const targetShift = latest.targetProduct === previous.targetProduct ? "same target" : "target changed";
    return [
      sameSummary ? "summary stable" : "summary shifted",
      upstreamDelta === 0 ? "same upstream depth" : `upstream ${upstreamDelta > 0 ? "+" : ""}${upstreamDelta}`,
      targetShift,
    ].join(" · ");
  }, [latest, previous]);

  const subject = toolId
    ? (TOOL_BY_ID[toolId]?.name ?? toolId.toUpperCase())
    : stageId
      ? stageId.replace("stage-", "Stage ")
      : "Workbench";

  if (!latest) {
    return (
      <section style={{ display: "grid", gap: "8px" }}>
        <div
          style={{
            fontFamily: THEME.MONO,
            fontSize: "10px",
            color: LABEL,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {title}
        </div>
        <div style={{ fontFamily: THEME.SANS, fontSize: "12px", color: LABEL, lineHeight: 1.6 }}>
          No runs have been recorded for {subject} yet.
        </div>
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gap: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <GitCompareArrows size={14} color={THEME.APRICOT} />
        <div
          style={{
            fontFamily: THEME.MONO,
            fontSize: "10px",
            color: LABEL,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {title}
        </div>
      </div>

      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {[latest, previous].filter(Boolean).map((run, index) => (
          <div
            key={run.id}
            style={{
              borderRadius: "16px",
              border: `1px solid ${BORDER}`,
              background: index === 0 ? THEME.PANEL_GRADIENT : THEME.PANEL_GRADIENT_SOFT,
              padding: "12px 14px",
              display: "grid",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
              <div style={{ fontFamily: THEME.SANS, fontSize: "13px", color: VALUE, fontWeight: 700 }}>
                {index === 0 ? "Latest run" : "Previous run"}
              </div>
              <div style={{ fontFamily: THEME.MONO, fontSize: "10px", color: LABEL }}>{formatTime(run.createdAt)}</div>
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: "12px", color: VALUE, lineHeight: 1.55 }}>
              {run.summary}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "999px",
                  border: `1px solid ${run.isSimulated ? THEME.CHIP_BORDER_WARM : THEME.CHIP_BORDER}`,
                  background: run.isSimulated ? THEME.CHIP_WARM : THEME.CHIP_COOL,
                  color: THEME.CHIP_TEXT,
                  fontFamily: THEME.MONO,
                  fontSize: "10px",
                }}
              >
                {run.isSimulated ? "Simulated" : "Project-linked"}
              </span>
              <span style={{ fontFamily: THEME.MONO, fontSize: "10px", color: LABEL }}>{getAuthorityTier(run)}</span>
              <span style={{ fontFamily: THEME.MONO, fontSize: "10px", color: LABEL }}>
                upstream {run.upstreamArtifactIds.length}
              </span>
            </div>
          </div>
        ))}
      </div>

      {compareLabel && (
        <div
          style={{
            borderRadius: "12px",
            border: `1px solid ${BORDER}`,
            background: THEME.PANEL_GRADIENT_SOFT,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <Gauge size={13} color={THEME.SKY} />
          <span style={{ fontFamily: THEME.SANS, fontSize: "12px", color: VALUE, fontWeight: 600 }}>{subject}</span>
          <span style={{ fontFamily: THEME.SANS, fontSize: "12px", color: LABEL, lineHeight: 1.55 }}>
            {compareLabel}
          </span>
        </div>
      )}
    </section>
  );
}
