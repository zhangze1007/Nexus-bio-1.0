"use client";
/**
 * CatDes RNA Engineering Panel -- Displays RNA design results
 * including sequence, thermodynamic properties, off-target analysis,
 * design notes, and evidence.
 */
import type React from "react";
import type { RNADesignResult } from "../../../modules/rna-engine";
import { THEME } from "../../../theme";
import MetricCard from "../../ide/shared/MetricCard";
import ConfidenceBadge from "../shared/ConfidenceBadge";
import ResultSummaryPanel from "../shared/ResultSummaryPanel";
import { BORDER, GLASS, LABEL, VALUE } from "./catdesShared";

export default function CatDesRNAEngineeringPanel({ result }: { result: RNADesignResult }) {
  const activityColor =
    result.predictedActivity >= 0.7 ? THEME.MINT : result.predictedActivity >= 0.4 ? THEME.RISK_LOW : THEME.CORAL;
  const offTargetColor =
    result.offTargetScore <= 0.2 ? THEME.MINT : result.offTargetScore <= 0.5 ? THEME.RISK_LOW : THEME.CORAL;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Summary metrics */}
      <ResultSummaryPanel
        metrics={[
          { label: "Activity", value: result.predictedActivity.toFixed(2), accent: activityColor },
          { label: "ΔG", value: result.deltaG.toFixed(1), unit: "kcal/mol", accent: THEME.SKY },
          { label: "Off-target", value: result.offTargetScore.toFixed(2), accent: offTargetColor },
          { label: "Length", value: result.sequence.length, unit: "nt", accent: THEME.LILAC },
        ]}
        actions={<ConfidenceBadge value={result.predictedActivity} label="Activity" />}
      />

      {/* Designed Sequence */}
      <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
        <span
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-xs)",
            color: LABEL,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Designed Sequence — {result.type.toUpperCase()}
        </span>
        <div
          style={{
            marginTop: 8,
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-sm)",
            color: VALUE,
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${BORDER}`,
            wordBreak: "break-all",
            lineHeight: 1.6,
          }}
        >
          {result.sequence || "No sequence generated"}
        </div>
        {result.targetPosition != null && (
          <p style={{ margin: "6px 0 0", fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
            Target position: <span style={{ color: VALUE, fontFamily: THEME.MONO }}>{result.targetPosition}</span>
          </p>
        )}
      </div>

      {/* Thermodynamic Properties */}
      <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
        <span
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-xs)",
            color: LABEL,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Thermodynamic Properties
        </span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
          <MetricCard label="ΔG (folding)" value={result.deltaG.toFixed(1)} unit="kcal/mol" />
          <MetricCard label="Activity" value={(result.predictedActivity * 100).toFixed(0)} unit="%" />
          <MetricCard label="Off-target" value={(result.offTargetScore * 100).toFixed(0)} unit="%" />
        </div>
      </div>

      {/* Off-target Analysis */}
      <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
        <span
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-xs)",
            color: LABEL,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Off-target Analysis
        </span>
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Risk Level</span>
            <div
              style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}
            >
              <div
                className="nb-width-fill"
                style={
                  {
                    "--nb-w": `${result.offTargetScore * 100}%`,
                    height: "100%",
                    borderRadius: 3,
                    background: offTargetColor,
                  } as React.CSSProperties
                }
              />
            </div>
            <span
              style={{
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                color: offTargetColor,
                minWidth: 32,
                textAlign: "right",
              }}
            >
              {result.offTargetScore <= 0.2 ? "Low" : result.offTargetScore <= 0.5 ? "Med" : "High"}
            </span>
          </div>
          <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, margin: 0 }}>
            Score: {result.offTargetScore.toFixed(2)} —{" "}
            {result.offTargetScore <= 0.2
              ? "Highly specific design"
              : result.offTargetScore <= 0.5
                ? "Moderate specificity"
                : "Review for off-target binding"}
          </p>
        </div>
      </div>

      {/* Design Notes */}
      {result.designNotes.length > 0 && (
        <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
          <span
            style={{
              fontFamily: THEME.SANS,
              fontSize: "var(--nb-fs-xs)",
              color: LABEL,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Design Notes
          </span>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {result.designNotes.map((note, i) => (
              <p
                key={i}
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: "var(--nb-fs-sm)",
                  color: "rgba(255,255,255,0.6)",
                  margin: 0,
                }}
              >
                {note}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Evidence */}
      {result.evidence.length > 0 && (
        <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
          <span
            style={{
              fontFamily: THEME.SANS,
              fontSize: "var(--nb-fs-xs)",
              color: LABEL,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Evidence
          </span>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {result.evidence.map((ev, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: "var(--nb-fs-xxs)",
                    color: ev.type === "literature" ? THEME.SKY : ev.type === "database" ? THEME.MINT : THEME.LILAC,
                    background:
                      ev.type === "literature"
                        ? "rgba(175,195,214,0.1)"
                        : ev.type === "database"
                          ? "rgba(147,203,82,0.1)"
                          : "rgba(221,208,232,0.1)",
                    padding: "1px 5px",
                    borderRadius: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {ev.type}
                </span>
                <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: VALUE }}>{ev.source}</span>
                <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>- {ev.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
