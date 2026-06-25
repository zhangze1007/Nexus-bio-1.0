"use client";
/**
 * CatDes Regulatory Tab -- Regulatory cassette design with
 * promoter, RBS, terminator parameters and codon optimization.
 */
import React from "react";
import { THEME } from "../../../theme";
import MetricCard from "../../ide/shared/MetricCard";
import ConfidenceBadge from "../shared/ConfidenceBadge";
import ParameterPanel from "../shared/ParameterPanel";
import ResultSummaryPanel from "../shared/ResultSummaryPanel";
import { BORDER, GLASS, INPUT_BG, INPUT_BORDER, INPUT_TEXT, LABEL, tn, VALUE } from "./catdesShared";

interface RegulatoryPromoter {
  type: string;
  strength: number;
  consensusScore: number;
  sequence: string;
}

interface RegulatoryRBS {
  sdSequence: string;
  predictedStrength: number;
  dgTotal: number;
  dgMRNA: number;
  dgSpacing: number;
  dgStandby: number;
  dgStart: number;
  dgAntiSD: number;
  spacerLength: number;
  sequence: string;
}

interface RegulatoryTerminator {
  type: string;
  efficiency: number;
  stemLoopLength: number;
  sequence: string;
}

interface RegulatoryDesignResult {
  overallStrength: number;
  promoter: RegulatoryPromoter;
  rbs: RegulatoryRBS;
  terminator: RegulatoryTerminator;
  designNotes: string[];
}

interface CatDesRegulatoryTabProps {
  regResult: RegulatoryDesignResult | null;
  regLoading: boolean;
  regTargetStrength: number;
  setRegTargetStrength: (n: number) => void;
  regHost: "ecoli" | "yeast" | "human";
  setRegHost: (h: "ecoli" | "yeast" | "human") => void;
  regCodonOptimize: boolean;
  setRegCodonOptimize: (b: boolean) => void;
  handleRegulatoryDesign: () => void;
}

export default function CatDesRegulatoryTab({
  regResult,
  regLoading,
  regTargetStrength,
  setRegTargetStrength,
  regHost,
  setRegHost,
  regCodonOptimize,
  setRegCodonOptimize,
  handleRegulatoryDesign,
}: CatDesRegulatoryTabProps) {
  return (
    <div
      style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}
    >
      {/* Parameter Panel */}
      <ParameterPanel
        title="Regulatory Cassette Parameters"
        defaultCollapsed={false}
        onReset={() => {
          setRegTargetStrength(0.7);
          setRegHost("ecoli");
          setRegCodonOptimize(true);
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div>
            <span
              style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, display: "block", marginBottom: 2 }}
            >
              Target Expression Level
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={regTargetStrength}
                onChange={(e) => setRegTargetStrength(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: THEME.FS_SM,
                  color: VALUE,
                  minWidth: 36,
                  textAlign: "right",
                  ...tn,
                }}
              >
                {regTargetStrength.toFixed(2)}
              </span>
            </div>
          </div>
          <div>
            <span
              style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, display: "block", marginBottom: 2 }}
            >
              Host Organism
            </span>
            <select
              value={regHost}
              onChange={(e) => setRegHost(e.target.value as "ecoli" | "yeast" | "human")}
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
              <option value="ecoli">E. coli</option>
              <option value="yeast">S. cerevisiae</option>
              <option value="human">Human</option>
            </select>
          </div>
          <div>
            <span
              style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, display: "block", marginBottom: 2 }}
            >
              Codon Optimization
            </span>
            <button
              onClick={() => setRegCodonOptimize(!regCodonOptimize)}
              className={`nb-tool-toggle ${regCodonOptimize ? "nb-tool-toggle--active" : ""}`}
              style={{
                width: "100%",
                padding: "5px 0",
                borderRadius: 6,
                borderColor: regCodonOptimize ? THEME.MINT : undefined,
                background: regCodonOptimize ? "rgba(191,220,205,0.15)" : undefined,
                color: regCodonOptimize ? THEME.MINT : undefined,
              }}
            >
              {regCodonOptimize ? "● Enabled" : "Disabled"}
            </button>
          </div>
        </div>
      </ParameterPanel>

      {/* Run button */}
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
          Regulatory Cassette Designer
        </span>
        <button
          onClick={handleRegulatoryDesign}
          disabled={regLoading}
          className="nb-tool-toggle"
          style={{ padding: "6px 14px", fontSize: THEME.FS_SM, opacity: regLoading ? 0.4 : 1 }}
        >
          {regLoading ? "Designing..." : "Design Cassette"}
        </button>
        {regResult && (
          <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: "rgba(255,255,255,0.4)" }}>
            Score: {regResult.overallStrength.toFixed(3)} | Promoter: {regResult.promoter.strength.toFixed(2)} | RBS:{" "}
            {regResult.rbs.predictedStrength.toFixed(2)} | Term: {regResult.terminator.efficiency.toFixed(2)}
          </span>
        )}
      </div>

      {/* Results */}
      {regResult && (
        <>
          {/* Summary Metrics */}
          <ResultSummaryPanel
            metrics={[
              { label: "Promoter", value: regResult.promoter.strength.toFixed(2), accent: THEME.CORAL },
              { label: "RBS Rate", value: regResult.rbs.predictedStrength.toFixed(2), accent: THEME.MINT },
              { label: "Terminator", value: regResult.terminator.efficiency.toFixed(2), accent: THEME.LILAC },
              { label: "Cassette Score", value: regResult.overallStrength.toFixed(3), accent: THEME.APRICOT },
            ]}
            actions={<ConfidenceBadge value={regResult.overallStrength} label="Overall" />}
          />

          {/* Promoter Details */}
          <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: THEME.FS_XS,
                  color: LABEL,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Promoter — {regResult.promoter.type}
              </span>
              <ConfidenceBadge value={regResult.promoter.strength} label="Strength" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
              <MetricCard label="Strength" value={(regResult.promoter.strength * 100).toFixed(0)} unit="%" />
              <MetricCard label="Consensus" value={(regResult.promoter.consensusScore * 100).toFixed(0)} unit="%" />
              <MetricCard label="Type" value={regResult.promoter.type} />
            </div>
            <div
              style={{
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                color: VALUE,
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${BORDER}`,
                wordBreak: "break-all",
                lineHeight: 1.6,
              }}
            >
              {regResult.promoter.sequence}
            </div>
          </div>

          {/* RBS Details */}
          <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: THEME.FS_XS,
                  color: LABEL,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Ribosome Binding Site — SD: {regResult.rbs.sdSequence}
              </span>
              <ConfidenceBadge value={regResult.rbs.predictedStrength} label="Translation" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
              <MetricCard label="Strength" value={(regResult.rbs.predictedStrength * 100).toFixed(0)} unit="%" />
              <MetricCard label="ΔG total" value={regResult.rbs.dgTotal.toFixed(1)} unit="kcal/mol" />
              <MetricCard label="Spacing" value={regResult.rbs.spacerLength} unit="nt" />
              <MetricCard label="ΔG mRNA" value={regResult.rbs.dgMRNA.toFixed(1)} unit="kcal/mol" />
            </div>
            {/* ΔG Breakdown */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 8 }}>
              {[
                { label: "ΔG mRNA", value: regResult.rbs.dgMRNA, color: THEME.CORAL },
                { label: "ΔG spacing", value: regResult.rbs.dgSpacing, color: THEME.SKY },
                { label: "ΔG standby", value: regResult.rbs.dgStandby, color: THEME.MINT },
                { label: "ΔG start", value: regResult.rbs.dgStart, color: THEME.LILAC },
                { label: "ΔG antiSD", value: regResult.rbs.dgAntiSD, color: THEME.APRICOT },
              ].map((dg) => (
                <div key={dg.label} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: "10px", color: LABEL }}>{dg.label}</div>
                  <div
                    style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_SM, color: dg.color, fontWeight: 600, ...tn }}
                  >
                    {dg.value.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                color: VALUE,
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${BORDER}`,
                wordBreak: "break-all",
                lineHeight: 1.6,
              }}
            >
              {regResult.rbs.sequence}
            </div>
          </div>

          {/* Terminator Details */}
          <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: THEME.FS_XS,
                  color: LABEL,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Terminator — {regResult.terminator.type}
              </span>
              <ConfidenceBadge value={regResult.terminator.efficiency} label="Efficiency" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
              <MetricCard label="Efficiency" value={(regResult.terminator.efficiency * 100).toFixed(0)} unit="%" />
              <MetricCard label="Stem Loop" value={regResult.terminator.stemLoopLength} unit="bp" />
              <MetricCard label="Type" value={regResult.terminator.type} />
            </div>
            <div
              style={{
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                color: VALUE,
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${BORDER}`,
                wordBreak: "break-all",
                lineHeight: 1.6,
              }}
            >
              {regResult.terminator.sequence}
            </div>
          </div>

          {/* Design Notes */}
          {regResult.designNotes.length > 0 && (
            <div
              style={{
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_SM,
                color: LABEL,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${BORDER}`,
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: VALUE, marginBottom: 4 }}>
                Design Notes
              </div>
              {regResult.designNotes.map((note, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: THEME.SANS,
                    fontSize: THEME.FS_SM,
                    color: "rgba(255,255,255,0.7)",
                    marginBottom: 4,
                  }}
                >
                  {note}
                </div>
              ))}
            </div>
          )}

          {/* Codon optimization note */}
          {regCodonOptimize && (
            <div
              style={{
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_SM,
                color: LABEL,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(147,203,82,0.06)",
                border: `1px solid rgba(147,203,82,0.15)`,
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: THEME.MINT, marginBottom: 4 }}>
                Codon Optimization ({regHost})
              </div>
              <p style={{ margin: 0, fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: "rgba(255,255,255,0.6)" }}>
                CDS will be optimized for{" "}
                {regHost === "ecoli" ? "E. coli" : regHost === "yeast" ? "S. cerevisiae" : "human"} codon usage using
                tRNA Adaptiveness Index (tAI, dos Reis 2004). Use the{" "}
                <span style={{ color: THEME.SKY }}>optimizeCodons</span> and{" "}
                <span style={{ color: THEME.SKY }}>computeCAI</span> functions from the engine to apply optimization to
                the coding sequence.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
