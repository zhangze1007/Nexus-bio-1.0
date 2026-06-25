"use client";
import React from "react";
import { THEME } from "../../../theme";
import type { ProvenanceRecord } from "../../../types";
import type { LearnedDeltaPack } from "../../../types/learnedDelta";
import ActionButton from "../shared/ActionButton";

/* ── Props ── */
interface DeltaPackPanelProps {
  computedDeltaPacks: LearnedDeltaPack[];
  learnedDeltaPacks: LearnedDeltaPack[];
  approveDeltaPack: (id: string) => void;
  rejectDeltaPack: (id: string) => void;
  assemblyProvenance: ProvenanceRecord[];
}

export default function DeltaPackPanel({
  computedDeltaPacks,
  learnedDeltaPacks,
  approveDeltaPack,
  rejectDeltaPack,
  assemblyProvenance,
}: DeltaPackPanelProps) {
  return (
    <div style={{ padding: "16px" }}>
      {computedDeltaPacks.length > 0 || learnedDeltaPacks.length > 0 ? (
        <div style={{ display: "grid", gap: "12px" }}>
          {[...learnedDeltaPacks].reverse().map((pack) => {
            const entryCount =
              Object.keys(pack.changedBounds).length +
              Object.keys(pack.changedPriors).length +
              Object.keys(pack.changedWeights).length;
            const statusBg =
              pack.humanGateStatus === "approved"
                ? "rgba(191,220,205,0.16)"
                : pack.humanGateStatus === "rejected"
                  ? "rgba(232,163,161,0.16)"
                  : "rgba(231,199,169,0.14)";
            const statusBorder =
              pack.humanGateStatus === "approved"
                ? "rgba(191,220,205,0.34)"
                : pack.humanGateStatus === "rejected"
                  ? "rgba(232,163,161,0.34)"
                  : "rgba(231,199,169,0.28)";
            const statusColor =
              pack.humanGateStatus === "approved"
                ? THEME.MINT
                : pack.humanGateStatus === "rejected"
                  ? THEME.CORAL
                  : THEME.APRICOT;
            return (
              <div
                key={pack.deltaPackId}
                style={{
                  background: THEME.PANEL_INSET,
                  border: `1px solid ${THEME.BORDER}`,
                  borderRadius: "var(--nb-radius-lg)",
                  padding: "14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <span
                    style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-sm)", color: THEME.VALUE, fontWeight: 600 }}
                  >
                    Iteration {pack.iteration}
                  </span>
                  <span
                    style={{
                      padding: "2px 7px",
                      borderRadius: "999px",
                      border: `1px solid ${statusBorder}`,
                      background: statusBg,
                      color: statusColor,
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xs)",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    {pack.humanGateStatus}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginBottom: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL }}>
                      Classification
                    </span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.VALUE }}>
                      {pack.classification}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL }}>
                      Target tools
                    </span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.VALUE }}>
                      {pack.targetToolIds.join(", ")}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL }}>
                      Delta entries
                    </span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.VALUE }}>
                      {entryCount}
                    </span>
                  </div>
                </div>
                {pack.humanGateStatus === "pending" && (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <ActionButton
                      variant="primary"
                      size="sm"
                      onClick={() => approveDeltaPack(pack.deltaPackId)}
                      style={{ flex: 1 }}
                    >
                      Approve
                    </ActionButton>
                    <ActionButton
                      variant="destructive"
                      size="sm"
                      onClick={() => rejectDeltaPack(pack.deltaPackId)}
                      style={{ flex: 1 }}
                    >
                      Reject
                    </ActionButton>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "40px", color: THEME.LABEL, fontFamily: THEME.SANS }}>
          <p style={{ fontSize: "var(--nb-fs-md)", margin: "0 0 8px" }}>No delta packs yet</p>
          <p style={{ fontSize: "var(--nb-fs-sm)", margin: 0 }}>
            Commit iterations with feedback to generate delta packs for approval.
          </p>
        </div>
      )}
      {assemblyProvenance.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <p
            style={{
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              color: THEME.LABEL,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: "0 0 12px",
            }}
          >
            Data Provenance ({assemblyProvenance.length} records)
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {assemblyProvenance.map((p) => {
              const clr: Record<string, string> = {
                fragment: THEME.MINT,
                primer: THEME.SKY,
                assembly: THEME.LILAC,
                transformant: THEME.CORAL,
                culture: THEME.APRICOT,
              };
              return (
                <div
                  key={p.uuid}
                  style={{
                    padding: "8px",
                    borderRadius: "var(--nb-radius-sm)",
                    background: THEME.PANEL_INSET,
                    border: `1px solid ${THEME.BORDER}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "2px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: THEME.MONO,
                        fontSize: "var(--nb-fs-xs)",
                        color: clr[p.sampleType] ?? THEME.VALUE,
                      }}
                    >
                      {p.sampleType.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL }}>
                      {p.well ? "Well " + p.well : ""}
                      {p.slot ? " · Slot " + p.slot : ""}
                    </span>
                  </div>
                  <p
                    style={{
                      fontFamily: THEME.SANS,
                      fontSize: "var(--nb-fs-xs)",
                      color: THEME.VALUE,
                      margin: "0 0 2px",
                      lineHeight: 1.3,
                    }}
                  >
                    {p.label}
                  </p>
                  <p style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL, margin: 0 }}>
                    {p.uuid}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
