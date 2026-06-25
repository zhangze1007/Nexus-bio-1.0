"use client";
import React from "react";
import { THEME } from "../../../theme";
import type { DBTLIteration } from "../../../types";
import ScientificFigureFrame from "../shared/ScientificFigureFrame";
import { PHASE_PASTEL, Timeline } from "./sharedComponents";

/* ── Props ── */
interface IterationWaterfallProps {
  displayIterations: DBTLIteration[];
}

export default function IterationWaterfall({ displayIterations }: IterationWaterfallProps) {
  return (
    <div style={{ padding: "16px" }}>
      <ScientificFigureFrame
        eyebrow="Iteration History"
        title="All recorded iterations"
        caption={`${displayIterations.length} iterations across ${new Set(displayIterations.map((i) => i.phase)).size} phases`}
      >
        <Timeline iterations={displayIterations} />
      </ScientificFigureFrame>
      <div style={{ marginTop: "16px", display: "grid", gap: "8px" }}>
        {displayIterations.map((it) => (
          <div
            key={it.id}
            style={{
              padding: "10px 12px",
              borderRadius: "var(--nb-radius-md)",
              border: `1px solid ${THEME.BORDER}`,
              background: THEME.PANEL_INSET,
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span
              style={{
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                color: PHASE_PASTEL[it.phase] ?? THEME.LABEL,
                fontWeight: 700,
                minWidth: "60px",
              }}
            >
              {it.phase}
            </span>
            <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-sm)", color: THEME.VALUE, flex: 1 }}>
              {it.hypothesis}
            </span>
            <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: THEME.VALUE, fontWeight: 600 }}>
              {it.result} {it.unit}
            </span>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "999px",
                background: it.passed ? "rgba(191,220,205,0.16)" : "rgba(232,163,161,0.16)",
                color: it.passed ? THEME.MINT : THEME.CORAL,
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                fontWeight: 600,
              }}
            >
              {it.passed ? "PASS" : "FAIL"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
