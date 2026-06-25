"use client";
import React, { useState } from "react";
import { THEME } from "../../../theme";
import type { CRISPRiTarget } from "../../../types";
import SimErrorBanner from "../../ide/shared/SimErrorBanner";
import ConfidenceBadge from "../shared/ConfidenceBadge";
import ParameterPanel from "../shared/ParameterPanel";
import { generatePseudoSequence, hexToRgb } from "./sharedComponents";

const BIOSAFETY_BSL_OPTIONS = [
  { value: "BSL-1", label: "BSL-1 — Standard microbiological practices" },
  { value: "BSL-2", label: "BSL-2 — Limited access, biohazard warning" },
  { value: "BSL-3", label: "BSL-3 — Controlled access, respiratory protection" },
  { value: "BSL-4", label: "BSL-4 — Maximum containment, positive-pressure suits" },
] as const;

const BIOSAFETY_HOST_OPTIONS = [
  { value: "ecoli", label: "E. coli K-12" },
  { value: "yeast", label: "S. cerevisiae" },
  { value: "human", label: "Human cell line" },
  { value: "other", label: "Other" },
] as const;

const BIOSAFETY_PURPOSE_OPTIONS = [
  { value: "research", label: "Research" },
  { value: "production", label: "Production" },
  { value: "therapy", label: "Therapy" },
  { value: "environmental", label: "Environmental release" },
] as const;

const BIOSAFETY_CONTAINMENT_OPTIONS = [
  { value: "standard", label: "Standard containment" },
  { value: "enhanced", label: "Enhanced containment" },
  { value: "maximum", label: "Maximum containment" },
] as const;

const RISK_LEVEL_COLORS: Record<string, string> = {
  low: THEME.MINT,
  moderate: THEME.APRICOT,
  elevated: "#fb923c",
  high: THEME.CORAL,
  blocked: "#dc2626",
};

const RISK_LEVEL_LABELS: Record<string, string> = {
  low: "BSL-1",
  moderate: "BSL-2",
  elevated: "BSL-3",
  high: "BSL-4",
  blocked: "BLOCKED",
};

const CONTAINMENT_TYPE_LABELS: Record<string, string> = {
  auxotrophic: "Auxotrophic strain",
  inducible_survival: "Inducible kill switch",
  compartmentalization: "Physical containment",
  safe_host: "Safe host recommendation",
  research_only: "Research-only mode",
};

export function BiosafetyPanel({ schedule }: { schedule: CRISPRiTarget[] }) {
  const [host, setHost] = useState<"ecoli" | "yeast" | "human" | "other">("ecoli");
  const [purpose, setPurpose] = useState<"research" | "production" | "therapy" | "environmental">("research");
  const [bslLevel, setBslLevel] = useState<string>("BSL-1");
  const [containmentType, setContainmentType] = useState<string>("standard");
  const [result, setResult] = useState<import("../../../modules/biosafety").BiosafetyOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAssess = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { assessBiosafety } = await import("../../../modules/biosafety");
      const geneSequence = schedule
        .map((t) => {
          const seed = t.gene.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
          return generatePseudoSequence(seed, 21);
        })
        .join("");
      const riskTolerance = bslLevel === "BSL-1" ? 0.8 : bslLevel === "BSL-2" ? 0.6 : bslLevel === "BSL-3" ? 0.4 : 0.2;
      const res = assessBiosafety({
        dnaSequence: geneSequence,
        host,
        purpose,
        mode: purpose === "production" ? "production" : "research",
        riskTolerance,
      });
      setResult(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Simulation failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [schedule, host, purpose, bslLevel]);

  const riskColor = result ? (RISK_LEVEL_COLORS[result.risk.level] ?? THEME.CORAL) : THEME.LABEL;
  const riskLabel = result ? (RISK_LEVEL_LABELS[result.risk.level] ?? result.risk.level) : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px", overflowY: "auto", flex: 1 }}>
      <div
        style={{
          padding: "8px 12px",
          marginBottom: "12px",
          background: "rgba(250,128,114,0.08)",
          border: "1px solid rgba(250,128,114,0.2)",
          borderRadius: "6px",
          fontSize: "12px",
          color: "rgba(255,255,255,0.6)",
          fontFamily: THEME.MONO,
        }}
      >
        ⚠ Demo mode — pattern database is a 14-entry simulated subset. Not suitable for actual biosafety screening.
      </div>
      {error && <SimErrorBanner message={error} onRetry={() => setError(null)} />}
      <ParameterPanel title="Biosafety Parameters">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <div>
            <label
              style={{
                display: "block",
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xxs)",
                color: THEME.LABEL,
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Host Organism
            </label>
            <select
              value={host}
              onChange={(e) => setHost(e.target.value as typeof host)}
              style={{
                width: "100%",
                padding: "6px 10px",
                background: THEME.INPUT_BG,
                border: `1px solid ${THEME.INPUT_BORDER}`,
                borderRadius: "var(--nb-radius-sm)",
                color: THEME.INPUT_TEXT,
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-sm)",
              }}
            >
              {BIOSAFETY_HOST_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xxs)",
                color: THEME.LABEL,
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Purpose
            </label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as typeof purpose)}
              style={{
                width: "100%",
                padding: "6px 10px",
                background: THEME.INPUT_BG,
                border: `1px solid ${THEME.INPUT_BORDER}`,
                borderRadius: "var(--nb-radius-sm)",
                color: THEME.INPUT_TEXT,
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-sm)",
              }}
            >
              {BIOSAFETY_PURPOSE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xxs)",
                color: THEME.LABEL,
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Biosafety Level
            </label>
            <select
              value={bslLevel}
              onChange={(e) => setBslLevel(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                background: THEME.INPUT_BG,
                border: `1px solid ${THEME.INPUT_BORDER}`,
                borderRadius: "var(--nb-radius-sm)",
                color: THEME.INPUT_TEXT,
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-sm)",
              }}
            >
              {BIOSAFETY_BSL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xxs)",
                color: THEME.LABEL,
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Containment Type
            </label>
            <select
              value={containmentType}
              onChange={(e) => setContainmentType(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                background: THEME.INPUT_BG,
                border: `1px solid ${THEME.INPUT_BORDER}`,
                borderRadius: "var(--nb-radius-sm)",
                color: THEME.INPUT_TEXT,
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-sm)",
              }}
            >
              {BIOSAFETY_CONTAINMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={handleAssess}
            disabled={loading || schedule.length === 0}
            className="nb-tool-toggle"
            style={{ padding: "6px 14px", fontSize: "var(--nb-fs-sm)", opacity: loading ? 0.4 : 1 }}
          >
            {loading ? "Assessing..." : "Assess Biosafety"}
          </button>
          <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: THEME.LABEL }}>
            {schedule.length} gene targets in schedule
          </span>
        </div>
      </ParameterPanel>

      {result && (
        <>
          <div
            style={{
              background: THEME.PANEL_SURFACE,
              borderRadius: "var(--nb-radius-lg)",
              padding: 14,
              border: `1px solid ${THEME.BORDER}`,
            }}
          >
            <div
              style={{
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                color: THEME.LABEL,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              Risk Assessment
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
              <div
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--nb-radius-md)",
                  background: `rgba(${hexToRgb(riskColor)}, 0.12)`,
                  border: `1px solid rgba(${hexToRgb(riskColor)}, 0.35)`,
                }}
              >
                <div
                  style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: THEME.LABEL, marginBottom: 2 }}
                >
                  Risk Level
                </div>
                <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-lg)", fontWeight: 700, color: riskColor }}>
                  {riskLabel}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: THEME.LABEL }}>
                    Risk Score
                  </span>
                  <ConfidenceBadge value={1 - result.risk.score} label="Safety" thresholds={{ high: 0.7, low: 0.4 }} />
                </div>
                <div
                  style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-sm)", color: THEME.VALUE, lineHeight: 1.5 }}
                >
                  {result.risk.reason}
                </div>
                <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: THEME.LABEL, marginTop: 4 }}>
                  Rule: {result.risk.triggerRule}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "var(--nb-radius-sm)",
                  background: result.canProceed ? "rgba(147,203,82,0.12)" : "rgba(250,128,114,0.12)",
                  border: `1px solid ${result.canProceed ? "rgba(147,203,82,0.3)" : "rgba(250,128,114,0.3)"}`,
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xxs)",
                  color: result.canProceed ? "rgba(147,203,82,0.9)" : "rgba(250,128,114,0.9)",
                }}
              >
                {result.canProceed ? "CAN PROCEED" : "BLOCKED"}
              </span>
              {result.requiresHumanReview && (
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: "var(--nb-radius-sm)",
                    background: "rgba(232,220,200,0.12)",
                    border: "1px solid rgba(180,150,100,0.3)",
                    fontFamily: THEME.MONO,
                    fontSize: "var(--nb-fs-xxs)",
                    color: "rgba(232,220,200,0.8)",
                  }}
                >
                  HUMAN REVIEW REQUIRED
                </span>
              )}
            </div>
          </div>

          {result.containment.length > 0 && (
            <div
              style={{
                background: THEME.PANEL_SURFACE,
                borderRadius: "var(--nb-radius-lg)",
                padding: 14,
                border: `1px solid ${THEME.BORDER}`,
              }}
            >
              <div
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  color: THEME.LABEL,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 10,
                }}
              >
                Containment Recommendations
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {result.containment.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "var(--nb-radius-sm)",
                      background: "rgba(200,216,232,0.06)",
                      border: `1px solid ${THEME.BORDER}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span
                        style={{
                          fontFamily: THEME.MONO,
                          fontSize: "var(--nb-fs-xxs)",
                          fontWeight: 700,
                          color: THEME.SKY,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {CONTAINMENT_TYPE_LABELS[c.type] ?? c.type}
                      </span>
                      <ConfidenceBadge value={c.confidence} thresholds={{ high: 0.8, low: 0.5 }} />
                    </div>
                    <div
                      style={{
                        fontFamily: THEME.SANS,
                        fontSize: "var(--nb-fs-sm)",
                        color: THEME.VALUE,
                        lineHeight: 1.5,
                      }}
                    >
                      {c.description}
                    </div>
                    {c.reference && (
                      <div
                        style={{
                          fontFamily: THEME.MONO,
                          fontSize: "var(--nb-fs-xxs)",
                          color: THEME.LABEL,
                          marginTop: 4,
                        }}
                      >
                        Ref: {c.reference}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.matches.length > 0 && (
            <div
              style={{
                background: THEME.PANEL_SURFACE,
                borderRadius: "var(--nb-radius-lg)",
                padding: 14,
                border: `1px solid ${THEME.BORDER}`,
              }}
            >
              <div
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  color: THEME.LABEL,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 10,
                }}
              >
                Sequence Hazard Matches ({result.matches.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {result.matches.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "var(--nb-radius-sm)",
                      background: "rgba(250,128,114,0.06)",
                      border: "1px solid rgba(250,128,114,0.15)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: THEME.MONO,
                        fontSize: "var(--nb-fs-xxs)",
                        color: THEME.CORAL,
                        fontWeight: 700,
                        minWidth: 60,
                      }}
                    >
                      {m.source}
                    </span>
                    <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: THEME.VALUE, flex: 1 }}>
                      {m.matchName}
                    </span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: THEME.LABEL }}>
                      score: {m.score.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              background: THEME.PANEL_SURFACE,
              borderRadius: "var(--nb-radius-lg)",
              padding: 14,
              border: `1px solid ${THEME.BORDER}`,
            }}
          >
            <div
              style={{
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                color: THEME.LABEL,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              Disposal Protocol
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-sm)", color: THEME.VALUE, lineHeight: 1.6 }}>
              {result.risk.level === "blocked"
                ? "Construct is BLOCKED. All materials must be autoclaved at 121 C for 30 min. Document destruction per institutional EHS protocol. Notify biosafety officer immediately."
                : result.risk.level === "high"
                  ? "High-risk construct. Autoclave all biological waste. Decontaminate work surfaces with 10% bleach. Double-bag all solid waste. Follow BSL-4 disposal procedures."
                  : result.risk.level === "elevated"
                    ? "Elevated risk. Autoclave biological waste at 121 C. Decontaminate with 70% ethanol. Follow BSL-3 waste management guidelines."
                    : result.risk.level === "moderate"
                      ? "Moderate risk. Standard biological waste disposal. Autoclave before disposal. Follow BSL-2 waste protocols."
                      : "Low risk. Standard microbiological waste disposal. Autoclave or chemical inactivation per institutional guidelines. Follow BSL-1 protocols."}
            </div>
          </div>

          <div
            style={{
              background: THEME.PANEL_SURFACE,
              borderRadius: "var(--nb-radius-lg)",
              padding: 14,
              border: `1px solid ${THEME.BORDER}`,
            }}
          >
            <div
              style={{
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                color: THEME.LABEL,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              Assessment Notes
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {result.designNotes.map((note, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: "var(--nb-fs-xxs)",
                    color: THEME.LABEL,
                    padding: "4px 8px",
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: "3px",
                  }}
                >
                  {note}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!result && schedule.length === 0 && (
        <div
          style={{
            padding: "24px",
            textAlign: "center",
            background: THEME.PANEL_SURFACE,
            borderRadius: "var(--nb-radius-lg)",
            border: `1px solid ${THEME.BORDER}`,
          }}
        >
          <div style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-sm)", color: THEME.LABEL }}>
            No gene targets in schedule. Configure CRISPRi targets in the Genome Map tab first.
          </div>
        </div>
      )}
    </div>
  );
}
