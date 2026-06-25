"use client";
import React from "react";
import { toolTokens } from "../../../hooks/useToolTheme";
import type { CFSParameters, GeneConstruct } from "../../../services/CellFreeEngine";
import type { BRENDAKinetics } from "../../../services/database/brendaClient";
import { THEME } from "../../../theme";
import DataSourceBadge from "../../ide/shared/DataSourceBadge";
import SectionLabel from "../shared/SectionLabel";
import { GENE_COLORS } from "./sharedComponents";

const { glass: GLASS, label: LABEL, value: VALUE } = toolTokens;

interface GeneConstructPanelProps {
  constructs: GeneConstruct[];
  params: CFSParameters;
  brendaApplied: boolean;
  brendaSource: "live" | "mock";
  pipelineLoading: boolean;
  pipelineError: string | null;
  pipelineResult: {
    predictedYield: number;
    robustnessScore: number;
    energyDepletionTime: number;
    recommendedConstruct: string;
    confidenceLevel: string;
  } | null;
  onRunPipeline: () => void;
}

export default function GeneConstructPanel({
  constructs,
  params,
  brendaApplied,
  brendaSource,
  pipelineLoading,
  pipelineError,
  pipelineResult,
  onRunPipeline,
}: GeneConstructPanelProps) {
  return (
    <>
      <SectionLabel>Gene Constructs</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
        {constructs.map((g, i) => (
          <div key={g.id} style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: GENE_COLORS[i % GENE_COLORS.length],
                  flexShrink: 0,
                }}
              />
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", fontWeight: 600, color: VALUE }}>
                {g.name.length > 20 ? g.name.slice(0, 20) + "…" : g.name}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Promoter</span>
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>{g.promoter}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>DNA conc.</span>
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                {g.dnaConcentration} nM
              </span>
            </div>
          </div>
        ))}
      </div>
      <SectionLabel>Reaction Parameters</SectionLabel>
      <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "10px", marginBottom: "16px" }}>
        {[
          { label: "Ribosome Total", value: `${params.ribosomeTotal} nM` },
          { label: "RNAP Total", value: `${params.rnap_total} nM` },
          { label: "Temperature", value: `${params.temperature} °C` },
          { label: "Volume", value: `${params.reactionVolume} μL` },
          { label: "Sim Time", value: `${params.simulationTime} min` },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>{item.label}</span>
            <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>{item.value}</span>
          </div>
        ))}
      </div>
      <SectionLabel>Energy Status</SectionLabel>
      <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "10px" }}>
        {[
          { label: "ATP", value: `${params.initialEnergy.atp} mM` },
          { label: "GTP", value: `${params.initialEnergy.gtp} mM` },
          { label: "PEP", value: `${params.initialEnergy.pep} mM` },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>{item.label}</span>
            <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>{item.value}</span>
          </div>
        ))}
      </div>
      {brendaApplied && (
        <div style={{ marginTop: "8px" }}>
          <SectionLabel>BRENDA Overrides</SectionLabel>
          <div
            style={{
              ...GLASS,
              borderRadius: "var(--nb-radius-md)",
              padding: "10px",
              border: "1px solid rgba(74, 222, 128, 0.2)",
            }}
          >
            {params.brendaKm !== undefined && (
              <div
                style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", alignItems: "center" }}
              >
                <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Km (BRENDA)</span>
                <DataSourceBadge source={brendaSource} label={`${params.brendaKm} mM`} />
              </div>
            )}
            {params.brendaKcat !== undefined && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Kcat (BRENDA)</span>
                <DataSourceBadge source={brendaSource} label={`${params.brendaKcat} 1/s`} />
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: `1px solid ${THEME.BORDER}` }}>
        <SectionLabel>Robustness Pipeline</SectionLabel>
        <button
          onClick={onRunPipeline}
          disabled={pipelineLoading}
          style={{
            width: "100%",
            padding: "6px 14px",
            borderRadius: "var(--nb-radius-sm)",
            background: pipelineLoading ? "rgba(255,255,255,0.04)" : "rgba(191,220,205,0.14)",
            border: `1px solid ${pipelineLoading ? "rgba(255,255,255,0.08)" : "rgba(191,220,205,0.3)"}`,
            color: pipelineLoading ? "rgba(255,255,255,0.35)" : "rgba(191,220,205,0.9)",
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
            cursor: pipelineLoading ? "wait" : "pointer",
          }}
        >
          {pipelineLoading ? "Running Pipeline..." : "Run Pipeline"}
        </button>
        {pipelineError && (
          <p style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.CORAL, margin: "6px 0 0" }}>
            {pipelineError}
          </p>
        )}
        {pipelineResult && (
          <div
            style={{
              marginTop: 8,
              padding: "6px 8px",
              background: "rgba(191,220,205,0.08)",
              border: "1px solid rgba(191,220,205,0.15)",
              borderRadius: "var(--nb-radius-sm)",
            }}
          >
            <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
              Yield: {pipelineResult.predictedYield.toFixed(1)} nM | Robustness:{" "}
              {(pipelineResult.robustnessScore * 100).toFixed(0)}%
            </div>
            <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: LABEL, marginTop: 2 }}>
              Best: {pipelineResult.recommendedConstruct} | {pipelineResult.confidenceLevel} | Depletion:{" "}
              {pipelineResult.energyDepletionTime.toFixed(0)} min
            </div>
          </div>
        )}
      </div>
    </>
  );
}
