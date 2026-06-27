"use client";
/**
 * FBASimPage.tsx — Thin orchestrator for Flux Balance Analysis.
 *
 * All state, effects, and handlers live in useFBASimState().
 * Tab content is split into sub-components in ./fbasim/.
 */

import React from "react";
import { REACTION_DEFS, YEAST_REACTION_DEFS } from "../../data/mockFBA";
import { THEME } from "../../theme";
import ExportButton from "../ide/shared/ExportButton";
import NextStepButton from "../NextStepButton";
import AlgorithmPanel from "../shared/AlgorithmPanel";
import WorkbenchTrustIndicator from "../workbench/WorkbenchTrustIndicator";
import FVAPanel from "./fba/FVAPanel";
import GPRPanel from "./fba/GPRPanel";
import CommunityFBATab from "./fbasim/CommunityFBA";
import ConsortiumPanel from "./fbasim/ConsortiumPanel";
import CustomModelPanel from "./fbasim/CustomModelPanel";
import ShadowPricesTab from "./fbasim/FBAVisualization";
import { FluxMapTab, KnockoutTab } from "./fbasim/SingleSpeciesFBA";
import StrainDesignTab from "./fbasim/StrainDesign";
// ── Extracted sub-components ──
import { FBA_TABS } from "./fbasim/sharedComponents";
import { useFBASimState } from "./fbasim/useFBASimState";
import ScientificFigureFrame from "./shared/ScientificFigureFrame";
import ScientificHero from "./shared/ScientificHero";
import ToolShell from "./shared/ToolShell";
import ToolTabPanel from "./shared/ToolTabPanel";

export default React.memo(function FBASimPage() {
  const s = useFBASimState();

  return (
    <ToolShell
      moduleId="fbasim"
      title="Flux Balance Analysis"
      description={
        s.simMode === "single"
          ? "Server-side GLPK solves a stoichiometric LP for the current host context"
          : "Two-species heuristic demo comparison"
      }
      formula={s.simMode === "single" ? "max cᵀv s.t. Sv=0, lb≤v≤ub" : "μ_demo = (1-α)μ₁ + αμ₂"}
      hero={
        <ScientificHero
          eyebrow={`Stage 2 · ${s.simMode === "single" ? "Host Flux Solve" : "Joint Community LP"}`}
          title={
            s.simMode === "single"
              ? "Authority-backed metabolic flux state"
              : "Joint Community LP with Shared Exchange Pools"
          }
          summary={
            s.simMode === "single"
              ? 'FBASim is the first point where the pathway object becomes a constrained production model. The key question is no longer "can the route exist," but "what does it cost the host and which uptake constraints dominate the present solution."'
              : "Community mode uses a joint community LP with shared exchange metabolite pool constraints and weighted community biomass objective."
          }
          aside={
            <>
              <div
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  color: "rgba(205,214,236,0.6)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Current route focus
              </div>
              <div
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: "var(--nb-fs-sm)",
                  color: "rgba(247,249,255,0.92)",
                  fontWeight: 700,
                }}
              >
                {s.recommendedSeed.pathwayFocus || s.recommendedSeed.targetProduct}
              </div>
              <div
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: "var(--nb-fs-sm)",
                  color: "rgba(205,214,236,0.6)",
                  lineHeight: 1.55,
                }}
              >
                Objective{" "}
                {s.objective === "biomass"
                  ? "maximizes biomass resilience"
                  : s.objective === "atp"
                    ? "prioritizes energetic yield"
                    : "pushes product-oriented flux through the current route"}
                .
              </div>
            </>
          }
          signals={
            s.simMode === "single"
              ? [
                  {
                    label: "Growth Rate",
                    value: `${s.singleResult.growthRate.toFixed(4)} h⁻¹`,
                    detail: s.singleLoading
                      ? "Server authority solve is recomputing this host state."
                      : s.singleResult.feasible
                        ? "Host remains feasible under the present uptake and objective settings."
                        : "Infeasible host state under the current constraints.",
                    tone: s.singleResult.feasible ? "cool" : "alert",
                  },
                  {
                    label: "Carbon Efficiency",
                    value: `${s.singleResult.carbonEfficiency.toFixed(1)}%`,
                    detail: `${s.singleResult.atpYield.toFixed(2)} ATP yield · ${s.singleResult.nadhProduction.toFixed(2)} NADH production`,
                    tone: s.singleResult.carbonEfficiency >= 50 ? "cool" : "warm",
                  },
                  {
                    label: "Primary Constraint",
                    value: `∂μ/∂Glc ${s.singleResult.sensitivityCoefficients.glc.toFixed(4)}`,
                    detail: `O₂ sens. ${s.singleResult.sensitivityCoefficients.o2.toFixed(4)} · ATP sens. ${s.singleResult.sensitivityCoefficients.atp.toFixed(4)}`,
                    tone: "neutral",
                  },
                  {
                    label: "Top Active Route",
                    value: s.top5[0]?.id ?? "Pending",
                    detail: s.top5[0]
                      ? `${Math.abs(s.top5[0].flux).toFixed(2)} mmol/gDW/h through the strongest reaction channel.`
                      : "No active reactions ranked yet.",
                    tone: "neutral",
                  },
                ]
              : [
                  {
                    label: "Community Growth Rate",
                    value: `${s.communityResult.communityGrowthRate.toFixed(4)} h⁻¹`,
                    detail: s.communityLoading
                      ? "Solving joint community LP..."
                      : s.communityResult.feasible
                        ? "Joint community LP is feasible with shared exchange constraints."
                        : "Joint community LP is infeasible; falling back to heuristic.",
                    tone: s.communityResult.feasible ? "cool" : "alert",
                  },
                  {
                    label: "Community Biomass",
                    value: `${s.communityResult.communityBiomassObjective.toFixed(3)}`,
                    detail: `E. coli ${s.communityResult.ecoli.growthRate.toFixed(3)} · Yeast ${s.communityResult.yeast.growthRate.toFixed(3)}`,
                    tone: "neutral",
                  },
                  {
                    label: "Exchange Fluxes",
                    value: `${s.communityResult.exchangeFluxes.filter((entry) => Math.abs(entry.flux) > 0.01).length} active links`,
                    detail: s.communityResult.exchangeFluxes[0]
                      ? `${s.communityResult.exchangeFluxes[0].metabolite} ${s.communityResult.exchangeFluxes[0].flux.toFixed(2)} mmol/h`
                      : "No exchange fluxes detected yet.",
                    tone: "warm",
                  },
                  {
                    label: "Pathway Focus",
                    value: s.recommendedSeed.pathwayFocus || s.recommendedSeed.targetProduct,
                    detail:
                      "This route focus is what downstream thermodynamics and catalyst design will inherit from the current systems solve.",
                    tone: "neutral",
                  },
                ]
          }
        />
      }
      tabs={FBA_TABS}
      activeTab={s.activeTab}
      onTabChange={s.setActiveTab}
      advancedTabIds={["fva", "gpr", "knockout", "strain", "shadows", "community", "consortium", "custom"]}
      footer={
        <>
          <ExportButton label="Export JSON" data={s.exportData} filename={`fbasim-${s.simMode}-result`} format="json" />
          <ExportButton
            label="Export CSV"
            data={
              s.simMode === "single"
                ? REACTION_DEFS.map((r) => ({
                    id: r.id,
                    name: r.name,
                    subsystem: r.subsystem,
                    flux: s.singleResult.fluxes[r.id] ?? 0,
                    knocked_out: s.knockouts.includes(r.id),
                  }))
                : [
                    ...REACTION_DEFS.map((r) => ({
                      strain: "ecoli",
                      id: r.id,
                      name: r.name,
                      subsystem: r.subsystem,
                      flux: s.communityResult.ecoli.fluxes[r.id] ?? 0,
                      knocked_out: s.ecoliKO.includes(r.id),
                    })),
                    ...YEAST_REACTION_DEFS.map((r) => ({
                      strain: "yeast",
                      id: r.id,
                      name: r.name,
                      subsystem: r.subsystem,
                      flux: s.communityResult.yeast.fluxes[r.id] ?? 0,
                      knocked_out: s.yeastKO.includes(r.id),
                    })),
                    ...s.communityResult.exchangeFluxes.map((e) => ({
                      strain: "exchange",
                      id: e.id,
                      name: e.metabolite,
                      subsystem: "Exchange",
                      flux: e.flux,
                      knocked_out: false,
                    })),
                  ]
            }
            filename={`fbasim-${s.simMode}-fluxes`}
            format="csv"
          />
          <ExportButton
            label="Export SVG"
            data={null}
            filename={`fbasim-${s.simMode}-chart`}
            format="svg"
            svgRef={s.chartRef}
          />
        </>
      }
    >
      {/* ── Trust Status Indicator ── */}
      <div style={{ padding: "4px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
        <WorkbenchTrustIndicator toolId="fbasim" compact />
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: "10px",
            color: "rgba(226,232,240,0.35)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Payload admission
        </span>
      </div>

      {/* ── Algorithm Transparency ── */}
      <div style={{ padding: "8px 16px" }}>
        <AlgorithmPanel
          name="Flux Balance Analysis (FBA)"
          description="FBA uses linear programming to find the optimal flux distribution through a metabolic network. It maximizes an objective function (usually biomass growth) subject to stoichiometric constraints and capacity bounds."
          assumptions={[
            "Steady-state metabolism (no transient dynamics)",
            "Mass balance constraints (Sv = 0)",
            "Capacity bounds from BiGG model (lb ≤ v ≤ ub)",
            "Linear objective function (biomass or product)",
            "Thermodynamically feasible reactions only",
          ]}
          limitations={[
            "Does not predict metabolite concentrations",
            "Assumes optimal growth (may not reflect real regulation)",
            "No kinetic information (rates are upper bounds)",
            "Gene knockouts are complete (no partial knockdown)",
          ]}
          citation={{
            authors: "Orth JD, Thiele I, Palsson BØ",
            title: "What is flux balance analysis?",
            journal: "Nat Biotechnol",
            year: 2010,
            doi: "10.1038/nbt.1614",
          }}
        />
      </div>

      {/* ── Tab Results (aria-live for screen reader announcements) ── */}
      <div aria-live="polite">
      {/* ── Flux Map Tab ── */}
      <ToolTabPanel tabId="flux" activeId={s.activeTab}>
        <FluxMapTab
          glucoseUptake={s.glucoseUptake}
          setGlucoseUptake={s.setGlucoseUptake}
          oxygenUptake={s.oxygenUptake}
          setOxygenUptake={s.setOxygenUptake}
          objective={s.objective}
          setObjective={s.setObjective}
          knockouts={s.knockouts}
          setKnockouts={s.setKnockouts}
          toggleKO={s.toggleKO}
          singleResult={s.singleResult}
          singleError={s.singleError}
          setSingleError={s.setSingleError}
          singleLoading={s.singleLoading}
          chartRef={s.chartRef}
          biggModels={s.biggModels}
          biggResult={s.biggResult}
          selectedModel={s.selectedModel}
          setSelectedModel={s.setSelectedModel}
          biggLoading={s.biggLoading}
          loadedReactions={s.loadedReactions}
          loadedObjectiveId={s.loadedObjectiveId}
          modelLoading={s.modelLoading}
          handleLoadModel={s.handleLoadModel}
          seedOverwriteNotice={s.seedOverwriteNotice}
          setSeedOverwriteNotice={s.setSeedOverwriteNotice}
          lastAppliedSeedRef={s.lastAppliedSeedRef}
          recommendedSeed={s.recommendedSeed}
          figureMeta={s.figureMeta}
        />
      </ToolTabPanel>

      {/* ── Knockout Tab ── */}
      <ToolTabPanel tabId="knockout" activeId={s.activeTab}>
        <KnockoutTab
          glucoseUptake={s.glucoseUptake}
          setGlucoseUptake={s.setGlucoseUptake}
          oxygenUptake={s.oxygenUptake}
          setOxygenUptake={s.setOxygenUptake}
          objective={s.objective}
          setObjective={s.setObjective}
          knockouts={s.knockouts}
          setKnockouts={s.setKnockouts}
          toggleKO={s.toggleKO}
          singleResult={s.singleResult}
          singleError={s.singleError}
          setSingleError={s.setSingleError}
          singleLoading={s.singleLoading}
          chartRef={s.chartRef}
          biggModels={s.biggModels}
          biggResult={s.biggResult}
          selectedModel={s.selectedModel}
          setSelectedModel={s.setSelectedModel}
          biggLoading={s.biggLoading}
          loadedReactions={s.loadedReactions}
          loadedObjectiveId={s.loadedObjectiveId}
          modelLoading={s.modelLoading}
          handleLoadModel={s.handleLoadModel}
          seedOverwriteNotice={s.seedOverwriteNotice}
          setSeedOverwriteNotice={s.setSeedOverwriteNotice}
          lastAppliedSeedRef={s.lastAppliedSeedRef}
          recommendedSeed={s.recommendedSeed}
          figureMeta={s.figureMeta}
        />
      </ToolTabPanel>

      {/* ── Strain Design Tab ── */}
      <ToolTabPanel tabId="strain" activeId={s.activeTab}>
        <StrainDesignTab
          fseofResult={s.fseofResult}
          optknockResult={s.optknockResult}
          strainDesignLoading={s.strainDesignLoading}
          strainDesignError={s.strainDesignError}
          setStrainDesignError={s.setStrainDesignError}
          pipelineResult={s.pipelineResult}
          pipelineLoading={s.pipelineLoading}
          pipelineError={s.pipelineError}
          loadedReactions={s.loadedReactions}
          loadedObjectiveId={s.loadedObjectiveId}
          handleRunFSEOF={s.handleRunFSEOF}
          handleRunOptKnock={s.handleRunOptKnock}
          handleRunPipeline={s.handleRunPipeline}
          handleSendToProEvol={s.handleSendToProEvol}
        />
      </ToolTabPanel>

      {/* ── FVA Tab ── */}
      <ToolTabPanel tabId="fva" activeId={s.activeTab}>
        <ScientificFigureFrame
          eyebrow="Figure C · Flux Variability Analysis"
          title="Reaction flux ranges at optimal objective"
          caption="FVA (Mahadevan & Schilling 2003) finds the min and max flux each reaction can carry while maintaining the optimal objective value. Reactions with zero range are uniquely determined; variable reactions have alternate optimal pathways."
          legend={[
            { label: "Objective", value: s.objective, accent: THEME.APRICOT },
            { label: "Glucose", value: `${s.glucoseUptake.toFixed(1)} mmol/gDW/h`, accent: THEME.CORAL },
            { label: "Oxygen", value: `${s.oxygenUptake.toFixed(1)} mmol/gDW/h`, accent: THEME.SKY },
          ]}
        >
          <FVAPanel
            objective={s.objective}
            glucoseUptake={s.glucoseUptake}
            oxygenUptake={s.oxygenUptake}
            knockouts={s.knockouts}
          />
        </ScientificFigureFrame>
      </ToolTabPanel>

      {/* ── GPR Knockout Tab ── */}
      <ToolTabPanel tabId="gpr" activeId={s.activeTab}>
        <ScientificFigureFrame
          eyebrow="Figure D · Gene-Protein-Reaction Knockout"
          title="Gene knockout simulation via GPR rules"
          caption="Select genes from the iJO1366 model to knock out. The GPR (Gene-Protein-Reaction) boolean rules determine which reactions become disabled: AND = protein complex (all subunits required), OR = isozymes (any one sufficient). Knocked-out genes propagate through the rule tree to identify disabled reactions."
          legend={[
            { label: "Objective", value: s.objective, accent: THEME.APRICOT },
            { label: "Glucose", value: `${s.glucoseUptake.toFixed(1)} mmol/gDW/h`, accent: THEME.CORAL },
            { label: "Oxygen", value: `${s.oxygenUptake.toFixed(1)} mmol/gDW/h`, accent: THEME.SKY },
          ]}
        >
          <GPRPanel
            objective={s.objective}
            glucoseUptake={s.glucoseUptake}
            oxygenUptake={s.oxygenUptake}
            knockouts={s.knockouts}
          />
        </ScientificFigureFrame>
      </ToolTabPanel>

      {/* ── Shadow Prices Tab ── */}
      <ToolTabPanel tabId="shadows" activeId={s.activeTab}>
        <ShadowPricesTab
          singleResult={s.singleResult}
          knockouts={s.knockouts}
          top5={s.top5}
          maxTopFlux={s.maxTopFlux}
        />
      </ToolTabPanel>

      {/* ── Community Tab ── */}
      <ToolTabPanel tabId="community" activeId={s.activeTab}>
        <CommunityFBATab
          ecoliGlucose={s.ecoliGlucose}
          setEcoliGlucose={s.setEcoliGlucose}
          ecoliOxygen={s.ecoliOxygen}
          setEcoliOxygen={s.setEcoliOxygen}
          ecoliKO={s.ecoliKO}
          setEcoliKO={s.setEcoliKO}
          toggleEcoliKO={s.toggleEcoliKO}
          yeastGlucose={s.yeastGlucose}
          setYeastGlucose={s.setYeastGlucose}
          yeastOxygen={s.yeastOxygen}
          setYeastOxygen={s.setYeastOxygen}
          yeastKO={s.yeastKO}
          setYeastKO={s.setYeastKO}
          toggleYeastKO={s.toggleYeastKO}
          communityResult={s.communityResult}
          communityError={s.communityError}
          setCommunityError={s.setCommunityError}
          communityLoading={s.communityLoading}
        />
      </ToolTabPanel>

      {/* ── Consortium Design Tab ── */}
      <ToolTabPanel tabId="consortium" activeId={s.activeTab}>
        <ScientificFigureFrame
          eyebrow="Stage 2 · Multi-Strain Consortium Design"
          title="SteadyCom Community FBA with Quorum Sensing"
          caption="Consortium design uses SteadyCom balanced-growth LP (Zomorrodi & Segre 2016), cross-feeding interaction modeling, LuxI/LuxR quorum sensing ODE dynamics, and Jacobian eigenvalue stability analysis (May 1972) to optimize microbial community function."
          legend={[
            { label: "Algorithm", value: "SteadyCom LP + QS Hill ODE", accent: THEME.LILAC },
            { label: "Stability", value: "QR Eigenvalue Decomposition", accent: THEME.SKY },
          ]}
          minHeight="100%"
        >
          <ConsortiumPanel />
        </ScientificFigureFrame>
      </ToolTabPanel>

      {/* ── Custom Model Tab ── */}
      <ToolTabPanel tabId="custom" activeId={s.activeTab}>
        <CustomModelPanel />
      </ToolTabPanel>
      </div>
      <NextStepButton currentStepId="fbasim" />
    </ToolShell>
  );
});
