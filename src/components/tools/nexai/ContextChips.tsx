"use client";

import { useWorkbenchStore } from "../../../store/workbenchStore";
import { THEME } from "../../../theme";
/**
 * ContextChips — shows what workbench state Axon has access to.
 * Inspired by GitHub Copilot's #file reference chips.
 */
export function ContextChips() {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const evidenceItems = useWorkbenchStore((s) => s.evidenceItems);
  const selectedEvidenceIds = useWorkbenchStore((s) => s.selectedEvidenceIds);
  const currentToolId = useWorkbenchStore((s) => s.currentToolId);
  const workflowControl = useWorkbenchStore((s) => s.workflowControl);

  const chips: Array<{ label: string; value: string; accent: string }> = [];

  if (project?.title) {
    chips.push({ label: "project", value: project.title, accent: THEME.SKY });
  }
  if (analyzeArtifact?.targetProduct) {
    chips.push({ label: "target", value: analyzeArtifact.targetProduct, accent: THEME.MINT });
  }
  if (currentToolId) {
    chips.push({ label: "tool", value: currentToolId, accent: THEME.LILAC });
  }
  if (evidenceItems.length > 0) {
    chips.push({
      label: "evidence",
      value: `${selectedEvidenceIds.length}/${evidenceItems.length}`,
      accent: THEME.APRICOT,
    });
  }
  if (workflowControl?.status && workflowControl.status !== "idle") {
    chips.push({
      label: "workflow",
      value: workflowControl.status,
      accent: workflowControl.status === "blocked" || workflowControl.status === "gated" ? THEME.CORAL : THEME.MINT,
    });
  }
  if (workflowControl?.iteration && workflowControl.iteration > 0) {
    chips.push({
      label: "dbtl",
      value: `cycle ${workflowControl.iteration}`,
      accent: THEME.APRICOT,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: "5px",
        flexWrap: "wrap",
        padding: "4px 0",
      }}
    >
      {chips.map((chip, i) => (
        <span
          key={i}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            padding: "2px 7px",
            borderRadius: "6px",
            background: `${chip.accent}22`,
            border: `1px solid ${chip.accent}40`,
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
            color: chip.accent,
            letterSpacing: "0.04em",
          }}
        >
          <span style={{ opacity: 0.55 }}>#{chip.label}</span>
          <span style={{ opacity: 0.85 }}>{chip.value}</span>
        </span>
      ))}
    </div>
  );
}
