"use client";
import React, { useCallback } from "react";
import { toolTokens } from "../../hooks/useToolTheme";
import { THEME } from "../../theme";
import ExportButton from "../ide/shared/ExportButton";
import SimErrorBanner from "../ide/shared/SimErrorBanner";
import AlgorithmPanel from "../shared/AlgorithmPanel";
import EnergySystemPanel from "./cellfree/EnergySystemPanel";
import { CalibrateTabContent, FittingTabContent, IvIvTabContent } from "./cellfree/ExpressionYieldPanel";
import GeneConstructPanel from "./cellfree/GeneConstructPanel";
import {
  CELLFREE_TABS,
  GENE_COLORS,
  getIvivExpressionLabel,
  ReactorTwin3D,
  ResourceChart,
  TimeCourseChart,
} from "./cellfree/sharedComponents";
import { useCellFreeState } from "./cellfree/useCellFreeState";
import FloatingControlRail from "./shared/FloatingControlRail";
import InlineMetricOverlay from "./shared/InlineMetricOverlay";
import ScientificFigureFrame from "./shared/ScientificFigureFrame";
import ScientificHero from "./shared/ScientificHero";
import SectionLabel from "./shared/SectionLabel";
import ToolShell from "./shared/ToolShell";
import ToolTabPanel from "./shared/ToolTabPanel";

const { glass: GLASS, label: LABEL, value: VALUE, border: BORDER } = toolTokens;

export default React.memo(function CellFreePage() {
  const state = useCellFreeState();
  const {
    constructs,
    params,
    activeTab,
    setActiveTab,
    userData,
    setUserData,
    brendaEcInput,
    setBrendaEcInput,
    brendaData,
    brendaSource,
    brendaLoading,
    brendaApplied,
    calibrationResult,
    calibrationLoading,
    cellfreeError,
    setCellfreeError,
    pipelineResult,
    pipelineLoading,
    pipelineError,
    setPipelineResult,
    setPipelineLoading,
    setPipelineError,
    handleCalibrate,
    handleBrendaLookup,
    handleApplyBrenda,
    handleClearBrenda,
    handleCsvUpload,
    result,
    simError,
    sim,
    fit,
    iviv,
    invitroMaxProtein,
    exportData,
  } = state;

  const handleRunPipeline = useCallback(async () => {
    setPipelineLoading(true);
    setPipelineError(null);
    try {
      const res = await fetch("/api/pipeline/cellfree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          constructs: constructs.map((c) => ({
            id: c.id,
            name: c.name,
            promoter: c.promoter,
            dnaConcentration: c.dnaConcentration,
          })),
          params: {
            temperature: params.temperature,
            simulationTime: params.simulationTime,
            ribosomeTotal: params.ribosomeTotal,
            initialEnergy: params.initialEnergy,
          },
        }),
      });
      if (!res.ok) throw new Error(`Pipeline failed (${res.status})`);
      const data = await res.json();
      setPipelineResult(data.result);
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : "Pipeline failed");
    } finally {
      setPipelineLoading(false);
    }
  }, [constructs, params, setPipelineLoading, setPipelineError, setPipelineResult]);

  if (!result) {
    return (
      <ToolShell
        moduleId="cellfree"
        title="Cell-Free Prototyping"
        formula="dP/dt = k_tl · [mRNA] · R_free / (K_tl + R_free)"
      >
        <div style={{ padding: "16px" }}>
          <SimErrorBanner message={simError ?? "CFS pipeline failed completely"} />
        </div>
      </ToolShell>
    );
  }

  return (
    <ToolShell
      moduleId="cellfree"
      title="Cell-Free Prototyping"
      formula="dP/dt = k_tl · [mRNA] · R_free / (K_tl + R_free)"
      hero={
        <ScientificHero
          eyebrow="Stage 4 · Pre-Build Simulation"
          title="Cell-free prototyping as a fast exploratory gate before DBTL"
          summary="Cell-free should read like a simulation bench, not a calibrated prediction. Yield, depletion timing, heuristic in-vitro-to-in-vivo confidence, and construct count are elevated here with parameter-sourcing limits visible."
          signals={[
            {
              label: "Total Yield",
              value: `${sim.totalProteinYield.toFixed(1)} nM`,
              detail: `${invitroMaxProtein.toFixed(1)} nM max single-construct expression.`,
              tone: sim.totalProteinYield > 100 ? "cool" : "warm",
            },
            {
              label: "Depletion Gate",
              value: `${sim.energyDepletionTime.toFixed(0)} min`,
              detail: sim.isResourceLimited ? "Resource-limited run." : "Resources adequate.",
              tone: sim.isResourceLimited ? "alert" : "cool",
            },
            {
              label: "IVIV Confidence",
              value: iviv ? `${(iviv.confidence * 100).toFixed(0)}%` : "Pending",
              detail: iviv
                ? `${getIvivExpressionLabel(iviv.invivo_expression)} expression (heuristic)`
                : "Fitting required.",
              tone: iviv && iviv.confidence > 0.65 ? "cool" : "neutral",
            },
            {
              label: "Constructs",
              value: `${constructs.length}`,
              detail: `${params.temperature}°C · ${params.simulationTime} min`,
              tone: "neutral",
            },
          ]}
        />
      }
      tabs={CELLFREE_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={["fitting", "calibrate", "iviv", "reactor"]}
      footer={
        <>
          <ExportButton label="Export Simulation JSON" data={result} filename="cellfree-simulation" format="json" />
          <ExportButton label="Export Time Series CSV" data={exportData} filename="cellfree-timeseries" format="csv" />
        </>
      }
    >
      {simError && (
        <div style={{ padding: "0 0 8px" }}>
          <SimErrorBanner message={simError} />
        </div>
      )}
      {cellfreeError && (
        <div style={{ padding: "0 0 8px" }}>
          <SimErrorBanner message={cellfreeError} onRetry={() => setCellfreeError(null)} />
        </div>
      )}

      <div style={{ padding: "8px 16px" }}>
        <AlgorithmPanel
          name="Cell-Free Expression ODE Model"
          description="Models gene expression in cell-free systems using coupled ODEs for transcription, translation, and resource competition. Includes ribosome dynamics, energy depletion (ATP/GTP), and amino acid consumption."
          assumptions={[
            "Well-mixed reactor (no spatial gradients)",
            "Michaelis-Menten kinetics for transcription/translation",
            "Ribosome as limiting resource",
            "ATP/GTP regeneration via energy mix",
            "No protein degradation during experiment",
          ]}
          limitations={[
            "Does not model DNA template degradation",
            "Simplified tRNA dynamics",
            "No explicit folding kinetics",
            "Calibration data from specific extract batch",
          ]}
          citation={{
            authors: "Stögbauer T, Windhager L, Zimmer R, Rädler JO",
            title: "Experiment and mathematical modeling of gene expression dynamics in a cell-free system",
            journal: "Integr Biol",
            year: 2012,
            doi: "10.1039/c2ib00108k",
          }}
        />
      </div>

      {/* ── Time Course Tab ── */}
      <ToolTabPanel tabId="timecourse" activeId={activeTab}>
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <FloatingControlRail label="Bench Setup" defaultCollapsed={false}>
            <GeneConstructPanel
              constructs={constructs}
              params={params}
              brendaApplied={brendaApplied}
              brendaSource={brendaSource}
              pipelineLoading={pipelineLoading}
              pipelineError={pipelineError}
              pipelineResult={pipelineResult}
              onRunPipeline={handleRunPipeline}
            />
          </FloatingControlRail>
          <div
            style={{
              flex: 1,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              padding: "12px",
            }}
          >
            <ScientificFigureFrame
              eyebrow="Expression timecourse"
              title="Protein production, resource depletion, and construct quality"
              caption="The timecourse lens is treated as a figure plate — expression, depletion, and comparative construct quality live inside one evidence surface."
              legend={[
                { label: "Constructs", value: `${constructs.length}`, accent: THEME.APRICOT },
                { label: "Yield", value: `${sim.totalProteinYield.toFixed(1)} nM`, accent: THEME.MINT },
                { label: "Depletion", value: `${sim.energyDepletionTime.toFixed(0)} min`, accent: THEME.CORAL },
              ]}
              footer={
                <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
                  setup {params.temperature}°C · {params.simulationTime} min ·{" "}
                  {sim.isResourceLimited ? "resource-limited run" : "resources adequate"}
                </div>
              }
              minHeight="100%"
            >
              <div style={{ padding: "4px 0", overflowY: "auto" }}>
                <TimeCourseChart result={result} constructs={constructs} />
              </div>
            </ScientificFigureFrame>
            <InlineMetricOverlay
              position="top-right"
              metrics={[
                { label: "Yield", value: `${sim.totalProteinYield.toFixed(1)} nM`, accent: THEME.MINT },
                {
                  label: "Depletion",
                  value: `${sim.energyDepletionTime.toFixed(0)} min`,
                  accent: sim.isResourceLimited ? THEME.CORAL : THEME.SKY,
                },
                { label: "Constructs", value: `${constructs.length}`, accent: THEME.APRICOT },
              ]}
            />
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Resources Tab ── */}
      <ToolTabPanel tabId="resources" activeId={activeTab}>
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <FloatingControlRail label="Bench Setup" defaultCollapsed={true}>
            <SectionLabel>Energy Status</SectionLabel>
            <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "10px" }}>
              {[
                { label: "ATP", value: `${params.initialEnergy.atp} mM` },
                { label: "GTP", value: `${params.initialEnergy.gtp} mM` },
                { label: "PEP", value: `${params.initialEnergy.pep} mM` },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
                    {item.label}
                  </span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </FloatingControlRail>
          <div
            style={{
              flex: 1,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              padding: "12px",
            }}
          >
            <ScientificFigureFrame
              eyebrow="Resource ledger"
              title="ATP, ribosome, and amino-acid drawdown"
              caption="Resource exhaustion governs whether a construct bundle should remain exploratory before slower experimental loops."
              legend={[
                { label: "Yield", value: `${sim.totalProteinYield.toFixed(1)} nM`, accent: THEME.MINT },
                { label: "Depletion", value: `${sim.energyDepletionTime.toFixed(0)} min`, accent: THEME.CORAL },
              ]}
              minHeight="100%"
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 0" }}>
                <div style={{ width: "100%", maxWidth: "600px" }}>
                  <ResourceChart result={result} />
                </div>
              </div>
            </ScientificFigureFrame>
            <InlineMetricOverlay
              position="top-right"
              metrics={[
                {
                  label: "Depletion",
                  value: `${sim.energyDepletionTime.toFixed(0)} min`,
                  accent: sim.isResourceLimited ? THEME.CORAL : THEME.SKY,
                },
                {
                  label: "Resource Ltd",
                  value: sim.isResourceLimited ? "Yes" : "No",
                  accent: sim.isResourceLimited ? THEME.CORAL : THEME.MINT,
                },
              ]}
            />
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Fitting Tab ── */}
      <ToolTabPanel tabId="fitting" activeId={activeTab}>
        <FittingTabContent
          result={result}
          params={params}
          fit={fit}
          userData={userData}
          brendaEcInput={brendaEcInput}
          brendaData={brendaData}
          brendaSource={brendaSource}
          brendaLoading={brendaLoading}
          brendaApplied={brendaApplied}
          onCsvUpload={handleCsvUpload}
          onClearUserData={() => setUserData(null)}
          onBrendaEcInputChange={setBrendaEcInput}
          onBrendaLookup={handleBrendaLookup}
          onApplyBrenda={handleApplyBrenda}
          onClearBrenda={handleClearBrenda}
        />
      </ToolTabPanel>

      {/* ── IVIV Tab ── */}
      <ToolTabPanel tabId="iviv" activeId={activeTab}>
        <IvIvTabContent result={result} constructs={constructs} iviv={iviv} />
      </ToolTabPanel>

      {/* ── Calibrate Tab ── */}
      <ToolTabPanel tabId="calibrate" activeId={activeTab}>
        <CalibrateTabContent
          userData={userData}
          calibrationResult={calibrationResult}
          calibrationLoading={calibrationLoading}
          onCalibrate={handleCalibrate}
        />
      </ToolTabPanel>

      {/* ── Reactor 3D Tab ── */}
      <ToolTabPanel tabId="reactor" activeId={activeTab}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, padding: "12px", gap: "10px" }}>
          <div style={{ maxWidth: "760px", margin: "0 auto", width: "100%" }}>
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "var(--nb-radius-md)",
                border: `1px solid ${BORDER}`,
                background: THEME.PANEL_INSET,
              }}
            >
              <p style={{ margin: "0 0 3px", color: VALUE, fontSize: "var(--nb-fs-sm)", fontFamily: THEME.SANS }}>
                Reactor 3D turns the CFPS run into a digital twin: construct yield, energy pool and depletion timing are
                mapped into one spatial scene.
              </p>
              <p style={{ margin: 0, color: LABEL, fontSize: "var(--nb-fs-xs)", fontFamily: THEME.MONO }}>
                center tank = resource state · rear towers = expression output · right bars = ATP / GTP / PEP allocation
              </p>
            </div>
          </div>
          <div style={{ minHeight: "420px", maxWidth: "760px", margin: "0 auto", width: "100%", position: "relative" }}>
            <ReactorTwin3D result={result} constructs={constructs} params={params} />
            <InlineMetricOverlay
              position="top-right"
              metrics={[
                { label: "Yield", value: `${sim.totalProteinYield.toFixed(1)} nM`, accent: THEME.MINT },
                {
                  label: "Depletion",
                  value: `${sim.energyDepletionTime.toFixed(0)} min`,
                  accent: sim.isResourceLimited ? THEME.CORAL : THEME.SKY,
                },
                { label: "Constructs", value: `${constructs.length}`, accent: THEME.APRICOT },
              ]}
            />
          </div>
          <SectionLabel>Per-Gene Stats</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px" }}>
            {sim.steadyState.map((ss, i) => {
              const gene = constructs.find((c) => c.id === ss.geneId);
              const color = GENE_COLORS[i % GENE_COLORS.length];
              return (
                <div key={ss.geneId} style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "8px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    <span
                      style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0 }}
                    />
                    <span
                      style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", fontWeight: 600, color: VALUE }}
                    >
                      {gene ? (gene.name.length > 18 ? gene.name.slice(0, 18) + "…" : gene.name) : ss.geneId}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
                      Peak Protein
                    </span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                      {ss.maxProtein.toFixed(1)} nM
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
                      Time to Half
                    </span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                      {ss.timeToHalf.toFixed(0)} min
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Yield/DNA</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                      {ss.yieldPerDNA.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Metabolic Engineering Tab ── */}
      <ToolTabPanel tabId="metabolic" activeId={activeTab}>
        <EnergySystemPanel />
      </ToolTabPanel>
    </ToolShell>
  );
});
