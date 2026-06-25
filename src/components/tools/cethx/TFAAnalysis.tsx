"use client";
/**
 * TFAAnalysis — Thermodynamic Flux Analysis tab panel for CETHX.
 * Extracted from CETHXPage.tsx for modularity.
 */
import React from "react";
import type { TFAReaction, TFAResult } from "../../../server/tfaEngine";
import { THEME } from "../../../theme";
import MetricCard from "../../ide/shared/MetricCard";

interface TFAAnalysisProps {
  tfaReactions: TFAReaction[];
  tfaResult: TFAResult | null;
  tempC: number;
  pH: number;
  handleRunTFA: () => void;
}

export default function TFAAnalysis({ tfaReactions, tfaResult, tempC, pH, handleRunTFA }: TFAAnalysisProps) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
      {/* Header & controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: THEME.LABEL,
            }}
          >
            Thermodynamic Flux Analysis
          </div>
          <div style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-sm)", color: THEME.DIM, marginTop: "2px" }}>
            Whole-pathway thermodynamic consistency — Alberty transform under current conditions
          </div>
        </div>
        <button
          onClick={handleRunTFA}
          disabled={tfaReactions.length === 0}
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-sm)",
            fontWeight: 600,
            color: "#050505",
            background: THEME.MINT,
            border: "none",
            borderRadius: "var(--nb-radius-md)",
            padding: "8px 18px",
            cursor: tfaReactions.length === 0 ? "not-allowed" : "pointer",
            opacity: tfaReactions.length === 0 ? 0.5 : 1,
          }}
        >
          Run TFA
        </button>
      </div>

      {/* Pre-loaded reactions info */}
      <div
        style={{
          padding: "10px 14px",
          borderRadius: "var(--nb-radius-md)",
          border: `1px solid ${THEME.BORDER}`,
          background: THEME.PANEL_INSET,
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xxs)",
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: "999px",
            background: `${THEME.SKY}28`,
            color: THEME.SKY,
          }}
        >
          LOADED
        </span>
        <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-sm)", color: THEME.VALUE }}>
          {tfaReactions.length} reactions — glycolysis fragment (HEX1 → PYK) with Lehninger ΔG°′ values
        </span>
        <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: THEME.DIM }}>
          {tempC}°C · pH {pH.toFixed(1)} · I=0.1 M
        </span>
      </div>

      {/* Results */}
      {tfaResult && (
        <>
          {/* Overall feasibility banner */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "var(--nb-radius-md)",
              border: `1px solid ${tfaResult.feasible ? `${THEME.MINT}57` : `${THEME.CORAL}57`}`,
              background: tfaResult.feasible ? `${THEME.MINT}12` : `${THEME.CORAL}12`,
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-sm)",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "999px",
                background: tfaResult.feasible ? `${THEME.MINT}28` : `${THEME.CORAL}28`,
                color: tfaResult.feasible ? THEME.MINT : THEME.CORAL,
              }}
            >
              {tfaResult.feasible ? "FEASIBLE" : "CONSTRAINT CONFLICT"}
            </span>
            <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-sm)", color: THEME.VALUE, lineHeight: 1.5 }}>
              {tfaResult.feasible
                ? `All ${tfaResult.reactionResults.length} reactions have thermodynamically consistent directions.`
                : `Direction conflicts detected — check bottleneck reactions below.`}
              {tfaResult.bottleneckReactions.length > 0 && (
                <span style={{ display: "block", color: THEME.CORAL, fontWeight: 600, marginTop: "2px" }}>
                  {tfaResult.bottleneckReactions.length} bottleneck reaction(s):{" "}
                  {tfaResult.bottleneckReactions.join(", ")}
                </span>
              )}
            </span>
          </div>

          {/* Summary metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "16px" }}>
            <MetricCard
              label="Cumulative ΔG′"
              value={tfaResult.cumulativeDeltaG}
              unit="kJ/mol"
              highlight={tfaResult.cumulativeDeltaG < 0}
            />
            <MetricCard label="Reactions" value={tfaResult.reactionResults.length} />
            <MetricCard label="Bottlenecks" value={tfaResult.bottleneckReactions.length} />
            <MetricCard label="Pathway" value={tfaResult.feasible ? "Feasible" : "Conflict"} />
          </div>

          {/* Results table */}
          <div
            style={{
              padding: "12px",
              borderRadius: "var(--nb-radius-md)",
              border: `1px solid ${THEME.BORDER}`,
              background: THEME.PANEL_INSET,
            }}
          >
            <div
              style={{
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                color: THEME.LABEL,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "10px",
              }}
            >
              Per-Reaction TFA Results
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 90px 80px 70px",
                gap: "2px 8px",
                alignItems: "center",
              }}
            >
              {/* Header */}
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xxs)",
                  color: THEME.DIM,
                  letterSpacing: "0.06em",
                }}
              >
                REACTION
              </span>
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xxs)",
                  color: THEME.DIM,
                  textAlign: "right",
                  letterSpacing: "0.06em",
                }}
              >
                ΔG°′ (kJ/mol)
              </span>
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xxs)",
                  color: THEME.DIM,
                  textAlign: "right",
                  letterSpacing: "0.06em",
                }}
              >
                ΔG′ (kJ/mol)
              </span>
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xxs)",
                  color: THEME.DIM,
                  textAlign: "center",
                  letterSpacing: "0.06em",
                }}
              >
                DIRECTION
              </span>
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xxs)",
                  color: THEME.DIM,
                  textAlign: "center",
                  letterSpacing: "0.06em",
                }}
              >
                FLAG
              </span>
              {/* Rows */}
              {tfaResult.reactionResults.map((r, i) => {
                const isBottleneck = tfaResult.bottleneckReactions.includes(r.id);
                const dirColor =
                  r.feasibleDirection === "forward"
                    ? THEME.MINT
                    : r.feasibleDirection === "reverse"
                      ? THEME.CORAL
                      : THEME.APRICOT;
                return (
                  <React.Fragment key={r.id + i}>
                    <span
                      className="nb-slide-in-left"
                      style={{
                        animationDelay: `${i * 0.03}s`,
                        fontFamily: THEME.SANS,
                        fontSize: "var(--nb-fs-xs)",
                        color: isBottleneck ? THEME.CORAL : THEME.VALUE,
                        fontWeight: isBottleneck ? 600 : 400,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        padding: "3px 0",
                        borderBottom: `1px solid ${THEME.BORDER}`,
                      }}
                    >
                      {r.id}
                    </span>
                    <span
                      style={{
                        fontFamily: THEME.MONO,
                        fontSize: "var(--nb-fs-xs)",
                        textAlign: "right",
                        color: r.deltaG0Prime < 0 ? THEME.MINT : THEME.CORAL,
                        padding: "3px 0",
                        borderBottom: `1px solid ${THEME.BORDER}`,
                      }}
                    >
                      {r.deltaG0Prime > 0 ? "+" : ""}
                      {r.deltaG0Prime.toFixed(1)}
                    </span>
                    <span
                      style={{
                        fontFamily: THEME.MONO,
                        fontSize: "var(--nb-fs-xs)",
                        fontWeight: 600,
                        textAlign: "right",
                        color: r.transformedDeltaG < 0 ? THEME.MINT : THEME.CORAL,
                        padding: "3px 0",
                        borderBottom: `1px solid ${THEME.BORDER}`,
                      }}
                    >
                      {r.transformedDeltaG > 0 ? "+" : ""}
                      {r.transformedDeltaG.toFixed(1)}
                    </span>
                    <span style={{ padding: "3px 0", borderBottom: `1px solid ${THEME.BORDER}`, textAlign: "center" }}>
                      <span
                        style={{
                          fontFamily: THEME.MONO,
                          fontSize: "var(--nb-fs-xxs)",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "999px",
                          letterSpacing: "0.04em",
                          background: `${dirColor}22`,
                          color: dirColor,
                        }}
                      >
                        {r.feasibleDirection.toUpperCase()}
                      </span>
                    </span>
                    <span style={{ padding: "3px 0", borderBottom: `1px solid ${THEME.BORDER}`, textAlign: "center" }}>
                      {isBottleneck && (
                        <span
                          style={{
                            fontFamily: THEME.MONO,
                            fontSize: "var(--nb-fs-xxs)",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "999px",
                            background: `${THEME.CORAL}22`,
                            color: THEME.CORAL,
                          }}
                        >
                          BOTTLENECK
                        </span>
                      )}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Placeholder when no results yet */}
      {!tfaResult && (
        <div
          style={{
            padding: "32px",
            borderRadius: "var(--nb-radius-md)",
            border: `1px dashed ${THEME.BORDER}`,
            background: THEME.PANEL_INSET,
            textAlign: "center",
          }}
        >
          <div style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-sm)", color: THEME.DIM }}>
            Click <strong style={{ color: THEME.VALUE }}>Run TFA</strong> to analyze thermodynamic consistency of the
            loaded pathway.
          </div>
          <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: THEME.DIM, marginTop: "6px" }}>
            Uses Alberty transform to compute ΔG′ under current pH, temperature, and ionic strength conditions.
          </div>
        </div>
      )}
    </div>
  );
}
