"use client";
/**
 * CatDes Plasmid Tab -- Plasmid design with host, expression level,
 * assembly method, and copy number parameters.
 */
import React from "react";
import { THEME } from "../../../theme";
import ParameterPanel from "../shared/ParameterPanel";
import { BORDER, GLASS, INPUT_BG, INPUT_BORDER, INPUT_TEXT, LABEL, VALUE } from "./catdesShared";

interface PlasmidComponent {
  name: string;
  type: string;
}

interface PlasmidDesign {
  name: string;
  totalSize: number;
  overallScore: number;
  designNotes: string[];
  components: PlasmidComponent[];
}

interface PlasmidDesignResult {
  mainDesign: PlasmidDesign;
  alternatives: PlasmidDesign[];
}

interface CatDesPlasmidTabProps {
  plasmidResult: PlasmidDesignResult | null;
  plasmidLoading: boolean;
  plasmidHost: "ecoli" | "yeast";
  setPlasmidHost: (h: "ecoli" | "yeast") => void;
  expressionLevel: "high_expression" | "low_expression" | "tunable" | "knockdown" | "reporter";
  setExpressionLevel: (l: "high_expression" | "low_expression" | "tunable" | "knockdown" | "reporter") => void;
  assemblyMethod: "gibson" | "golden_gate" | "restriction_ligation" | "infusion";
  setAssemblyMethod: (m: "gibson" | "golden_gate" | "restriction_ligation" | "infusion") => void;
  copyNumber: number;
  setCopyNumber: (n: number) => void;
  handlePlasmidDesign: () => void;
}

export default function CatDesPlasmidTab({
  plasmidResult,
  plasmidLoading,
  plasmidHost,
  setPlasmidHost,
  expressionLevel,
  setExpressionLevel,
  assemblyMethod,
  setAssemblyMethod,
  copyNumber,
  setCopyNumber,
  handlePlasmidDesign,
}: CatDesPlasmidTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Plasmid design parameters */}
      <ParameterPanel
        title="Plasmid Parameters"
        defaultCollapsed={false}
        onReset={() => {
          setExpressionLevel("high_expression" as const);
          setAssemblyMethod("gibson");
          setCopyNumber(2);
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div>
            <span
              style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, display: "block", marginBottom: 2 }}
            >
              Expression Level
            </span>
            <select
              value={expressionLevel}
              onChange={(e) =>
                setExpressionLevel(
                  e.target.value as "high_expression" | "low_expression" | "tunable" | "knockdown" | "reporter",
                )
              }
              style={{
                width: "100%",
                padding: "5px 8px",
                background: INPUT_BG,
                border: `1px solid ${INPUT_BORDER}`,
                borderRadius: 6,
                color: INPUT_TEXT,
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_SM,
                outline: "none",
              }}
            >
              <option value="high_expression">High Expression</option>
              <option value="low_expression">Low Expression</option>
              <option value="tunable">Tunable</option>
              <option value="knockdown">Knockdown</option>
              <option value="reporter">Reporter</option>
            </select>
          </div>
          <div>
            <span
              style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, display: "block", marginBottom: 2 }}
            >
              Assembly Method
            </span>
            <select
              value={assemblyMethod}
              onChange={(e) =>
                setAssemblyMethod(e.target.value as "gibson" | "golden_gate" | "restriction_ligation" | "infusion")
              }
              style={{
                width: "100%",
                padding: "5px 8px",
                background: INPUT_BG,
                border: `1px solid ${INPUT_BORDER}`,
                borderRadius: 6,
                color: INPUT_TEXT,
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_SM,
                outline: "none",
              }}
            >
              <option value="gibson">Gibson</option>
              <option value="golden_gate">Golden Gate</option>
              <option value="restriction_ligation">Restriction-Ligation</option>
              <option value="infusion">In-Fusion</option>
            </select>
          </div>
          <div>
            <span
              style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, display: "block", marginBottom: 2 }}
            >
              Copy Number
            </span>
            <input
              type="number"
              min={1}
              max={10}
              value={copyNumber}
              onChange={(e) => setCopyNumber(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "5px 8px",
                background: INPUT_BG,
                border: `1px solid ${INPUT_BORDER}`,
                borderRadius: 6,
                color: INPUT_TEXT,
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_SM,
                outline: "none",
              }}
            />
          </div>
        </div>
      </ParameterPanel>

      <div
        style={{
          ...GLASS,
          padding: 16,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
            color: LABEL,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Plasmid Designer
        </span>
        <select
          value={plasmidHost}
          onChange={(e) => setPlasmidHost(e.target.value as "ecoli" | "yeast")}
          style={{
            padding: "4px 8px",
            background: INPUT_BG,
            border: `1px solid ${INPUT_BORDER}`,
            borderRadius: "var(--nb-radius-sm)",
            color: INPUT_TEXT,
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_SM,
          }}
        >
          <option value="ecoli">E. coli</option>
          <option value="yeast">S. cerevisiae</option>
        </select>
        <button
          onClick={handlePlasmidDesign}
          disabled={plasmidLoading}
          className="nb-tool-toggle"
          style={{ padding: "6px 14px", fontSize: THEME.FS_SM, opacity: plasmidLoading ? 0.4 : 1 }}
        >
          {plasmidLoading ? "Designing..." : "Design Plasmid"}
        </button>
        {plasmidResult && (
          <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: "rgba(255,255,255,0.4)" }}>
            {plasmidResult.mainDesign.name} | {plasmidResult.mainDesign.totalSize} bp | Score:{" "}
            {plasmidResult.mainDesign.overallScore}
          </span>
        )}
      </div>

      {plasmidResult && (
        <>
          {/* Main design */}
          <div style={{ ...GLASS, padding: 12 }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, marginBottom: 6 }}>
              Main Design: {plasmidResult.mainDesign.name}
            </div>
            <div
              style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}
            >
              {plasmidResult.mainDesign.designNotes.map((n, i) => (
                <div key={i}>• {n}</div>
              ))}
            </div>
          </div>

          {/* Components */}
          <div style={{ ...GLASS, padding: 12 }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, marginBottom: 6 }}>
              Components
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {plasmidResult.mainDesign.components.map((c, i) => (
                <span
                  key={i}
                  style={{
                    padding: "3px 8px",
                    background:
                      c.type === "replicon"
                        ? "rgba(200,216,232,0.1)"
                        : c.type === "resistance"
                          ? "rgba(200,224,208,0.1)"
                          : "rgba(221,208,232,0.1)",
                    border: `1px solid ${c.type === "replicon" ? "rgba(200,216,232,0.2)" : c.type === "resistance" ? "rgba(200,224,208,0.2)" : "rgba(221,208,232,0.2)"}`,
                    borderRadius: "3px",
                    fontFamily: THEME.MONO,
                    fontSize: THEME.FS_XS,
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  {c.name}
                </span>
              ))}
            </div>
          </div>

          {/* Alternatives */}
          {plasmidResult.alternatives.length > 0 && (
            <div style={{ ...GLASS, padding: 12 }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: LABEL, marginBottom: 6 }}>
                Alternatives
              </div>
              {plasmidResult.alternatives.map((alt, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: THEME.SANS,
                    fontSize: THEME.FS_SM,
                    color: "rgba(255,255,255,0.5)",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: THEME.SKY }}>Alt {i + 1}:</span> {alt.name} | {alt.totalSize} bp | Score:{" "}
                  {alt.overallScore}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
