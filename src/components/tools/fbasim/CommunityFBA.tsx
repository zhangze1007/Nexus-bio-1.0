"use client";
/**
 * CommunityFBA.tsx — Community FBA tab content.
 * Extracted from FBASimPage.tsx for modularity.
 */

import React from "react";
import type { CommunityFBAOutput } from "../../../data/mockFBA";
import {
  FLUX_EDGES,
  METABOLIC_NODES,
  REACTION_DEFS,
  YEAST_FLUX_EDGES,
  YEAST_NODES,
  YEAST_REACTION_DEFS,
} from "../../../data/mockFBA";
import { THEME } from "../../../theme";
import SimErrorBanner from "../../ide/shared/SimErrorBanner";
import FloatingControlRail from "../shared/FloatingControlRail";
import InlineMetricOverlay from "../shared/InlineMetricOverlay";
import ScientificFigureFrame from "../shared/ScientificFigureFrame";
import { COLORS, GlassContainer, SharedMetaboliteBus, StrainPanel } from "./CommunityPanels";
import { FluxMap } from "./FluxMap";
import type { FBASimState } from "./useFBASimState";

type CommunityFBAProps = Pick<
  FBASimState,
  | "ecoliGlucose"
  | "setEcoliGlucose"
  | "ecoliOxygen"
  | "setEcoliOxygen"
  | "ecoliKO"
  | "setEcoliKO"
  | "toggleEcoliKO"
  | "yeastGlucose"
  | "setYeastGlucose"
  | "yeastOxygen"
  | "setYeastOxygen"
  | "yeastKO"
  | "setYeastKO"
  | "toggleYeastKO"
  | "communityResult"
  | "communityError"
  | "setCommunityError"
  | "communityLoading"
>;

export default function CommunityFBATab(props: CommunityFBAProps) {
  const {
    ecoliGlucose,
    setEcoliGlucose,
    ecoliOxygen,
    setEcoliOxygen,
    ecoliKO,
    toggleEcoliKO,
    setEcoliKO,
    yeastGlucose,
    setYeastGlucose,
    yeastOxygen,
    setYeastOxygen,
    yeastKO,
    toggleYeastKO,
    setYeastKO,
    communityResult,
    communityError,
    setCommunityError,
    communityLoading,
  } = props;

  return (
    <>
      <div
        style={{
          padding: "8px 12px",
          background: "rgba(232,220,200,0.1)",
          borderRadius: "var(--nb-radius-sm)",
          fontSize: "var(--nb-fs-sm)",
          opacity: 0.8,
          margin: "8px 12px",
        }}
      >
        [Note] Community FBA uses sequential single-species optimization with shared resource constraints. This is an
        approximation — for true joint optimization, consider SteCom or BioME frameworks.
      </div>
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <FloatingControlRail label="Strain Parameters" defaultCollapsed={false} width={260}>
          <StrainPanel
            label="E. coli"
            color={COLORS.strainABg}
            borderColor={COLORS.strainABorder}
            accentColor={COLORS.strainA}
            glucoseUptake={ecoliGlucose}
            oxygenUptake={ecoliOxygen}
            knockouts={ecoliKO}
            reactions={REACTION_DEFS}
            result={communityResult.ecoli}
            onGlucoseChange={setEcoliGlucose}
            onOxygenChange={setEcoliOxygen}
            onToggleKO={toggleEcoliKO}
            onClearKO={() => setEcoliKO([])}
          />
          <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "8px 0" }} />
          <StrainPanel
            label="S. cerevisiae"
            color={COLORS.strainBBg}
            borderColor={COLORS.strainBBorder}
            accentColor={COLORS.strainB}
            glucoseUptake={yeastGlucose}
            oxygenUptake={yeastOxygen}
            knockouts={yeastKO}
            reactions={YEAST_REACTION_DEFS}
            result={communityResult.yeast}
            onGlucoseChange={setYeastGlucose}
            onOxygenChange={setYeastOxygen}
            onToggleKO={toggleYeastKO}
            onClearKO={() => setYeastKO([])}
          />
        </FloatingControlRail>

        <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", minHeight: 0 }}>
          {communityError && (
            <div style={{ padding: "0 16px 8px" }}>
              <SimErrorBanner message={communityError} onRetry={() => setCommunityError(null)} />
            </div>
          )}
          {communityLoading && (
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
                }}
              >
                Solving two independent single-species LPs.
              </div>
            </div>
          )}

          <ScientificFigureFrame
            eyebrow="Community FBA"
            title="Two-Species Metabolic Community"
            caption="Independent LP solutions per species with shared metabolite exchange."
            minHeight="100%"
          >
            <div style={{ display: "grid", gap: "12px", minHeight: "500px" }}>
              <GlassContainer
                color={COLORS.sharedBg}
                borderColor={COLORS.sharedBorder}
                style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-sm)", color: "rgba(255,255,255,0.55)" }}>
                  Demo Biomass Blend
                </span>
                <span
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: "var(--nb-fs-sm)",
                    fontWeight: 600,
                    color: COLORS.sharedPool,
                  }}
                >
                  μ_demo = {communityResult.communityGrowthRate.toFixed(4)} h⁻¹
                </span>
              </GlassContainer>
              <div style={{ display: "flex", gap: "12px", flex: 1, minHeight: 0 }}>
                <GlassContainer
                  color={COLORS.strainABg}
                  borderColor={COLORS.strainABorder}
                  style={{ flex: 1, padding: "6px", display: "flex", flexDirection: "column" }}
                >
                  <p
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xs)",
                      color: COLORS.strainA,
                      margin: "0 0 4px",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    E. coli
                  </p>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <FluxMap
                      result={communityResult.ecoli}
                      nodes={METABOLIC_NODES}
                      edges={FLUX_EDGES}
                      knockouts={ecoliKO}
                      compact
                    />
                  </div>
                </GlassContainer>
                <GlassContainer
                  color={COLORS.strainBBg}
                  borderColor={COLORS.strainBBorder}
                  style={{ flex: 1, padding: "6px", display: "flex", flexDirection: "column" }}
                >
                  <p
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xs)",
                      color: COLORS.strainB,
                      margin: "0 0 4px",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    S. cerevisiae
                  </p>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <FluxMap
                      result={communityResult.yeast}
                      nodes={YEAST_NODES}
                      edges={YEAST_FLUX_EDGES}
                      knockouts={yeastKO}
                      compact
                    />
                  </div>
                </GlassContainer>
              </div>
              <SharedMetaboliteBus exchangeFluxes={communityResult.exchangeFluxes} />
            </div>
          </ScientificFigureFrame>

          <InlineMetricOverlay
            position="top-right"
            metrics={[
              {
                label: "Blend μ",
                value: `${communityResult.communityGrowthRate.toFixed(4)} h⁻¹`,
                accent: communityResult.feasible ? THEME.MINT : THEME.CORAL,
              },
              { label: "E. coli μ", value: `${communityResult.ecoli.growthRate.toFixed(3)}`, accent: COLORS.strainA },
              { label: "Yeast μ", value: `${communityResult.yeast.growthRate.toFixed(3)}`, accent: COLORS.strainB },
            ]}
          />
        </div>
      </div>
    </>
  );
}
