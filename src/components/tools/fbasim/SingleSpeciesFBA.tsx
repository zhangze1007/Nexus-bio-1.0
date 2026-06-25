"use client";
/**
 * SingleSpeciesFBA.tsx — Flux Map tab and Knockout tab content.
 * Extracted from FBASimPage.tsx for modularity.
 */

import React from "react";
import type { FBAOutput } from "../../../data/mockFBA";
import { FLUX_EDGES, METABOLIC_NODES, REACTION_DEFS } from "../../../data/mockFBA";
import type { BiGGModel, BiGGReaction } from "../../../services/database/biggClient";
import type { FallbackResult } from "../../../services/database/fetchWithFallback";
import { THEME } from "../../../theme";
import DataSourceBadge from "../../ide/shared/DataSourceBadge";
import SimErrorBanner from "../../ide/shared/SimErrorBanner";
import ParameterSnapshot from "../../shared/ParameterSnapshot";
import { SimSkeleton } from "../../shared/Skeleton";
import FloatingControlRail from "../shared/FloatingControlRail";
import InlineMetricOverlay from "../shared/InlineMetricOverlay";
import ScientificFigureFrame from "../shared/ScientificFigureFrame";
import ScientificHero from "../shared/ScientificHero";
import { ParamSlider } from "./CommunityPanels";
import { FluxMap } from "./FluxMap";
import type { FBASimState } from "./useFBASimState";

type SingleSpeciesFBAProps = Pick<
  FBASimState,
  | "glucoseUptake"
  | "setGlucoseUptake"
  | "oxygenUptake"
  | "setOxygenUptake"
  | "objective"
  | "setObjective"
  | "knockouts"
  | "setKnockouts"
  | "toggleKO"
  | "singleResult"
  | "singleError"
  | "setSingleError"
  | "singleLoading"
  | "chartRef"
  | "biggModels"
  | "biggResult"
  | "selectedModel"
  | "setSelectedModel"
  | "biggLoading"
  | "loadedReactions"
  | "loadedObjectiveId"
  | "modelLoading"
  | "handleLoadModel"
  | "seedOverwriteNotice"
  | "setSeedOverwriteNotice"
  | "lastAppliedSeedRef"
  | "recommendedSeed"
  | "figureMeta"
>;

// ── Flux Map Tab ────────────────────────────────────────────────────────

export function FluxMapTab(props: SingleSpeciesFBAProps) {
  const {
    glucoseUptake,
    setGlucoseUptake,
    oxygenUptake,
    setOxygenUptake,
    objective,
    setObjective,
    knockouts,
    toggleKO,
    singleResult,
    singleError,
    setSingleError,
    singleLoading,
    chartRef,
    biggModels,
    biggResult,
    selectedModel,
    setSelectedModel,
    biggLoading,
    loadedReactions,
    loadedObjectiveId,
    modelLoading,
    handleLoadModel,
    seedOverwriteNotice,
    setSeedOverwriteNotice,
    lastAppliedSeedRef,
    recommendedSeed,
    figureMeta,
  } = props;

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <FloatingControlRail label="Flux Parameters" defaultCollapsed={false} width={220}>
        {/* ── BiGG Model Selector ── */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
            <p
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.55)",
                margin: 0,
              }}
            >
              BiGG Model
            </p>
            {biggResult && (
              <DataSourceBadge
                source={biggResult.source}
                label={biggResult.source === "live" ? "BiGG Live" : "BiGG Demo"}
              />
            )}
          </div>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={biggLoading}
            style={{
              width: "100%",
              padding: "4px 6px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "var(--nb-radius-sm)",
              color: "rgba(255,255,255,0.85)",
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              outline: "none",
              cursor: "pointer",
            }}
          >
            {biggModels.map((m) => (
              <option key={m.bigg_id} value={m.bigg_id} style={{ background: "#10131a" }}>
                {m.bigg_id} ({m.reaction_count} rxns)
              </option>
            ))}
            {biggModels.length === 0 && (
              <option value="e_coli_core" style={{ background: "#10131a" }}>
                e_coli_core (loading...)
              </option>
            )}
          </select>
          {biggModels.length > 0 &&
            selectedModel &&
            (() => {
              const m = biggModels.find((x) => x.bigg_id === selectedModel);
              if (!m) return null;
              return (
                <p
                  style={{
                    fontFamily: THEME.SANS,
                    fontSize: "var(--nb-fs-xxs)",
                    color: "rgba(255,255,255,0.35)",
                    margin: "3px 0 0",
                    lineHeight: 1.3,
                  }}
                >
                  {m.organism} — {m.metabolite_count} metabolites, {m.gene_count} genes
                </p>
              );
            })()}
          <button
            onClick={handleLoadModel}
            disabled={modelLoading}
            className="nb-tool-toggle"
            style={{
              display: "block",
              width: "100%",
              marginTop: "6px",
              padding: "5px 8px",
              borderRadius: "var(--nb-radius-sm)",
              background: loadedReactions ? "rgba(20,140,80,0.12)" : undefined,
              borderColor: loadedReactions ? "rgba(20,140,80,0.3)" : undefined,
              color: loadedReactions ? "rgba(140,230,170,0.9)" : undefined,
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
            }}
          >
            {modelLoading ? "Loading..." : loadedReactions ? "Model Loaded" : "Load Model"}
          </button>
          {loadedReactions && (
            <p
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xxs)",
                color: "rgba(140,230,170,0.7)",
                margin: "3px 0 0",
                lineHeight: 1.3,
              }}
            >
              {loadedReactions.length} reactions loaded · obj: {loadedObjectiveId}
            </p>
          )}
        </div>

        <p
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-xs)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.55)",
            margin: "0 0 8px",
          }}
        >
          Uptake Limits
        </p>
        <ParamSlider
          label="Glucose uptake"
          value={glucoseUptake}
          min={0}
          max={20}
          onChange={setGlucoseUptake}
          unit="mmol/gDW/h"
        />
        <ParamSlider
          label="O₂ uptake"
          value={oxygenUptake}
          min={0}
          max={20}
          onChange={setOxygenUptake}
          unit="mmol/gDW/h"
        />
        <p
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-xs)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.55)",
            margin: "12px 0 8px",
          }}
        >
          Objective
        </p>
        {(["biomass", "atp", "product"] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => setObjective(opt)}
            className={`nb-tool-toggle ${objective === opt ? "nb-tool-toggle--active" : ""}`}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "5px 8px",
              marginBottom: "3px",
              background: objective === opt ? THEME.PANEL_SURFACE : undefined,
              borderColor: objective === opt ? THEME.BORDER_STRONG : undefined,
              borderRadius: "var(--nb-radius-sm)",
              color: objective === opt ? "rgba(255,255,255,0.85)" : undefined,
            }}
          >
            {opt === "biomass" ? "Max Biomass" : opt === "atp" ? "Max ATP" : "Max Product"}
          </button>
        ))}

        <div style={{ marginTop: "16px" }}>
          <ParameterSnapshot
            toolId="fbasim"
            parameters={{ glucoseUptake, oxygenUptake, objective }}
            onLoad={(params: Record<string, unknown>) => {
              if (params.glucoseUptake !== undefined) setGlucoseUptake(params.glucoseUptake as number);
              if (params.oxygenUptake !== undefined) setOxygenUptake(params.oxygenUptake as number);
              if (params.objective !== undefined) setObjective(params.objective as "biomass" | "atp" | "product");
            }}
          />
        </div>
      </FloatingControlRail>

      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", minHeight: 0 }}>
        {seedOverwriteNotice && (
          <div style={{ padding: "0 16px 8px" }}>
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "var(--nb-radius-md)",
                border: "1px solid rgba(232,220,200,0.3)",
                background: "rgba(232,220,200,0.08)",
                color: "#E8DCC8",
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span>{seedOverwriteNotice}</span>
              <button
                onClick={() => {
                  lastAppliedSeedRef.current = null;
                  setSeedOverwriteNotice(null);
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: "4px",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff",
                  fontSize: "11px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Apply seed
              </button>
            </div>
          </div>
        )}
        {singleError && (
          <div style={{ padding: "0 16px 8px" }}>
            <SimErrorBanner message={singleError} onRetry={() => setSingleError(null)} />
          </div>
        )}
        {singleLoading && (
          <div style={{ padding: "0 16px 8px" }}>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: "var(--nb-radius-md)",
                border: "1px solid rgba(81,81,205,0.22)",
                background: "rgba(81,81,205,0.08)",
                color: "rgba(240,245,255,0.78)",
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
                marginBottom: "8px",
              }}
            >
              Authority engine recomputing server-side LP.
            </div>
            <SimSkeleton />
          </div>
        )}

        <ScientificFigureFrame
          eyebrow={figureMeta.eyebrow}
          title={figureMeta.title}
          caption={figureMeta.caption}
          minHeight="100%"
          legend={[
            { label: "Objective", value: objective, accent: THEME.APRICOT },
            { label: "Glucose", value: `${glucoseUptake.toFixed(1)} mmol/gDW/h`, accent: THEME.CORAL },
            { label: "Oxygen", value: `${oxygenUptake.toFixed(1)} mmol/gDW/h`, accent: THEME.SKY },
          ]}
        >
          <div style={{ minHeight: "500px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FluxMap
              result={singleResult}
              nodes={METABOLIC_NODES}
              edges={FLUX_EDGES}
              knockouts={knockouts}
              svgRef={chartRef}
            />
          </div>
        </ScientificFigureFrame>

        <InlineMetricOverlay
          position="top-right"
          metrics={[
            {
              label: "Growth",
              value: `${singleResult.growthRate.toFixed(4)} h⁻¹`,
              accent: singleResult.feasible ? THEME.MINT : THEME.CORAL,
            },
            { label: "ATP Yield", value: `${singleResult.atpYield.toFixed(2)} mol/mol`, accent: THEME.SKY },
            {
              label: "C Efficiency",
              value: `${singleResult.carbonEfficiency.toFixed(1)}%`,
              accent: singleResult.carbonEfficiency >= 50 ? THEME.MINT : THEME.APRICOT,
            },
          ]}
        />
      </div>
    </div>
  );
}

// ── Knockout Tab ────────────────────────────────────────────────────────

export function KnockoutTab(props: SingleSpeciesFBAProps) {
  const { knockouts, toggleKO, setKnockouts, singleResult, singleError, setSingleError, chartRef } = props;

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <FloatingControlRail label="Gene Knockouts" defaultCollapsed={false} width={240}>
        <p
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-xs)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.55)",
            margin: "0 0 8px",
          }}
        >
          Toggle Reactions
        </p>
        {REACTION_DEFS.map((r) => {
          const isKO = knockouts.includes(r.id);
          return (
            <button
              key={r.id}
              onClick={() => toggleKO(r.id)}
              className={`nb-tool-toggle ${isKO ? "nb-tool-toggle--active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "4px 6px",
                marginBottom: "2px",
                background: isKO ? "rgba(255,80,80,0.14)" : undefined,
                borderColor: isKO ? "rgba(255,80,80,0.38)" : undefined,
                borderRadius: "var(--nb-radius-sm)",
              }}
            >
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  color: isKO ? "rgba(255,120,120,0.9)" : "rgba(255,255,255,0.5)",
                }}
              >
                {r.id}
              </span>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: isKO ? "rgba(255,80,80,0.7)" : "rgba(255,255,255,0.12)",
                  flexShrink: 0,
                }}
              />
            </button>
          );
        })}
        {knockouts.length > 0 && (
          <button
            onClick={() => setKnockouts([])}
            className="nb-tool-toggle"
            style={{
              display: "block",
              width: "100%",
              marginTop: "6px",
              padding: "4px 6px",
              borderRadius: "var(--nb-radius-sm)",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            Clear knockouts ({knockouts.length})
          </button>
        )}
      </FloatingControlRail>

      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", minHeight: 0 }}>
        {singleError && (
          <div style={{ padding: "0 16px 8px" }}>
            <SimErrorBanner message={singleError} onRetry={() => setSingleError(null)} />
          </div>
        )}

        <ScientificFigureFrame
          eyebrow="Knockout Analysis"
          title="Flux Map with Gene Knockouts"
          caption="Red-highlighted reactions show knocked-out genes and their flux impact."
          minHeight="100%"
          legend={[
            { label: "Knockouts", value: knockouts.length ? knockouts.join(", ") : "none", accent: THEME.CORAL },
            {
              label: "Growth",
              value: `${singleResult.growthRate.toFixed(4)} h⁻¹`,
              accent: singleResult.feasible ? THEME.MINT : THEME.CORAL,
            },
          ]}
        >
          <div style={{ minHeight: "500px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FluxMap
              result={singleResult}
              nodes={METABOLIC_NODES}
              edges={FLUX_EDGES}
              knockouts={knockouts}
              svgRef={chartRef}
            />
          </div>
        </ScientificFigureFrame>

        <InlineMetricOverlay
          position="top-right"
          metrics={[
            {
              label: "Growth",
              value: `${singleResult.growthRate.toFixed(4)} h⁻¹`,
              accent: singleResult.feasible ? THEME.MINT : THEME.CORAL,
            },
            { label: "ATP Yield", value: `${singleResult.atpYield.toFixed(2)} mol/mol`, accent: THEME.SKY },
            {
              label: "Feasible",
              value: singleResult.feasible ? "YES" : "NO",
              accent: singleResult.feasible ? THEME.MINT : THEME.CORAL,
            },
          ]}
        />
      </div>
    </div>
  );
}
