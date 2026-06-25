"use client";
import React, { useEffect, useMemo, useState } from "react";
import { CRISPRI_TARGETS } from "../../data/mockGenMIM";
import { useWorkbenchStore } from "../../store/workbenchStore";
import { THEME } from "../../theme";
import DataSourceBadge from "../ide/shared/DataSourceBadge";
import ExportButton from "../ide/shared/ExportButton";
import SimErrorBanner from "../ide/shared/SimErrorBanner";
import NextStepButton from "../NextStepButton";
import { BiosafetyPanel } from "./genmim/BiosafetyPanel";
import { MultiplexCRISPRPanel, SchedulePanel, SyntheticGenomicsPanel, TargetsPanel } from "./genmim/CRISPRiScheduler";
import { BaseEditingPanel, EpigenomeEditingPanel, PASTEPanel, PrimeEditingPanel } from "./genmim/CRISPREDITingPanels";
import { EfficiencyHeatmap } from "./genmim/EfficiencyHeatmap";
import { GEMReconstructionPanel } from "./genmim/GEMReconstructionPanel";
import { GenomeMapView } from "./genmim/GenomeMap";
import { FrontierEngineBadge, GENMIM_TABS } from "./genmim/sharedComponents";
import { useGenMIMState } from "./genmim/useGenMIMState";
import ScientificHero from "./shared/ScientificHero";
import ToolShell from "./shared/ToolShell";
import ToolTabPanel from "./shared/ToolTabPanel";

export default React.memo(function GenMIMPage() {
  const {
    project,
    analyzeArtifact,
    fbaPayload,
    dynconPayload,
    setToolPayload,
    efficiency,
    setEfficiency,
    maxTargets,
    setMaxTargets,
    protectEssential,
    setProtectEssential,
    customTargets,
    setCustomTargets,
    customTargetHeaders,
    setCustomTargetHeaders,
    customTargetRows,
    setCustomTargetRows,
    customTargetError,
    setCustomTargetError,
    recommendedEfficiency,
    recommendedTargets,
    fluxBoostedTargets,
    schedule,
    simError,
    growthImpact,
    avgEfficiency,
    sgRNASequences,
    offTargetRisk,
  } = useGenMIMState();

  const [activeTab, setActiveTab] = useState("genome");

  useEffect(() => {
    setToolPayload("genmim", {
      validity: "partial",
      toolId: "genmim",
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || "Target Product",
      sourceArtifactId: analyzeArtifact?.id,
      efficiencyThreshold: efficiency,
      maxTargets,
      protectEssential,
      result: {
        selectedTargets: schedule.length,
        growthImpact,
        avgEfficiency,
        offTargetRisk,
        topGenes: schedule.slice(0, 5).map((target) => target.gene),
      },
      updatedAt: Date.now(),
    });
  }, [
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    avgEfficiency,
    efficiency,
    growthImpact,
    maxTargets,
    offTargetRisk,
    project?.targetProduct,
    project?.title,
    protectEssential,
    schedule,
    setToolPayload,
  ]);

  const upstreamMissing: string[] = [];
  if (!fbaPayload) upstreamMissing.push("FBASim");
  if (!dynconPayload) upstreamMissing.push("DynCon");

  return (
    <ToolShell
      moduleId="genmim"
      title="Gene Minimization via CRISPRi"
      description="Greedy knockdown scheduling: ranks non-essential genes by knockdown efficiency, bounded by max targets and growth tolerance."
      formula="score = KD_eff + (1 + GI) × 0.3"
      tabs={GENMIM_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={["schedule", "efficiency"]}
      hero={
        <>
          <FrontierEngineBadge engineId="multiplexcrispr" />
          <ScientificHero
            eyebrow="Stage 3 · Chassis Minimization"
            title="Minimal chassis decisions with explicit growth tradeoffs"
            summary="GENMIM now foregrounds the chassis question instead of burying it in a schedule table. You can read immediately how many targets are being proposed, how much growth is being sacrificed, and whether the current protection policy is conservative enough for the active project."
            signals={[
              {
                label: "Selected Targets",
                value: `${schedule.length}`,
                detail: `Max budget ${maxTargets}`,
                tone: schedule.length > 6 ? "warm" : "cool",
              },
              {
                label: "Growth Impact",
                value: `${(growthImpact * 100).toFixed(1)}%`,
                detail: Math.abs(growthImpact) > 0.4 ? "Expensive in host fitness." : "Manageable band.",
                tone: Math.abs(growthImpact) > 0.4 ? "alert" : "cool",
              },
              {
                label: "Average KD",
                value: `${(avgEfficiency * 100).toFixed(1)}%`,
                detail: `Off-target ${(offTargetRisk * 100).toFixed(0)}%`,
                tone: avgEfficiency > 0.85 ? "cool" : "warm",
              },
              {
                label: "Lead Gene",
                value: schedule[0]?.gene ?? "Pending",
                detail: schedule[0] ? `${schedule[0].phenotype}` : "No schedule yet.",
                tone: "neutral",
              },
            ]}
          />
        </>
      }
      footer={
        <>
          <DataSourceBadge
            source={fbaPayload || dynconPayload ? "live" : "mock"}
            label={fbaPayload || dynconPayload ? "Upstream Data" : "Default Targets"}
          />
          <ExportButton label="Export Schedule JSON" data={schedule} filename="genmim-schedule" format="json" />
          <ExportButton
            label="Export All Targets CSV"
            data={fluxBoostedTargets}
            filename="genmim-targets"
            format="csv"
          />
        </>
      }
    >
      {upstreamMissing.length > 0 && (
        <div
          style={{
            padding: "8px 12px",
            marginBottom: "8px",
            borderRadius: "var(--nb-radius-md)",
            border: "1px solid rgba(180, 150, 100, 0.50)",
            background: "rgba(232, 220, 200, 0.12)",
            color: THEME.VALUE,
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-sm)",
            lineHeight: 1.55,
          }}
        >
          <strong>Upstream payload missing:</strong> Run <em>{upstreamMissing.join(" and ")}</em> first.
        </div>
      )}
      {simError && (
        <div style={{ padding: "0 0 8px" }}>
          <SimErrorBanner message={simError} />
        </div>
      )}

      {/* ── Genome Map Tab ── */}
      <ToolTabPanel tabId="genome" activeId={activeTab}>
        <GenomeMapView
          targets={fluxBoostedTargets}
          schedule={schedule}
          efficiency={efficiency}
          maxTargets={maxTargets}
          protectEssential={protectEssential}
          avgEfficiency={avgEfficiency}
          growthImpact={growthImpact}
          offTargetRisk={offTargetRisk}
          recommendedTargets={recommendedTargets}
          recommendedEfficiency={recommendedEfficiency}
          onEfficiencyChange={setEfficiency}
          onMaxTargetsChange={setMaxTargets}
          onToggleProtect={() => setProtectEssential(!protectEssential)}
        />
      </ToolTabPanel>

      {/* ── Targets Tab ── */}
      <ToolTabPanel tabId="targets" activeId={activeTab}>
        <TargetsPanel
          fluxBoostedTargets={fluxBoostedTargets}
          schedule={schedule}
          sgRNASequences={sgRNASequences}
          customTargets={customTargets}
          customTargetHeaders={customTargetHeaders}
          customTargetRows={customTargetRows}
          customTargetError={customTargetError}
          onCustomUpload={(rows, headers) => {
            const lowerHeaders = headers.map((h) => h.toLowerCase());
            const geneIdCol = lowerHeaders.findIndex((h) => h === "gene_id" || h === "geneid" || h === "gene");
            const geneNameCol = lowerHeaders.findIndex((h) => h === "gene_name" || h === "genename" || h === "name");
            const essentialityCol = lowerHeaders.findIndex((h) => h === "essentiality" || h === "essential");
            const fluxCol = lowerHeaders.findIndex((h) => h === "flux");
            if (geneIdCol === -1) {
              setCustomTargetError("CSV must have a gene_id column");
              return;
            }
            const parsed = rows
              .map((row) => {
                const vals = Object.values(row);
                return {
                  geneId: vals[geneIdCol],
                  geneName: geneNameCol >= 0 ? vals[geneNameCol] : vals[geneIdCol],
                  essentiality: essentialityCol >= 0 ? parseFloat(vals[essentialityCol]) || 0 : 0,
                  flux: fluxCol >= 0 ? parseFloat(vals[fluxCol]) || 0 : 0,
                };
              })
              .filter((d) => d.geneId);
            if (parsed.length === 0) {
              setCustomTargetError("No valid gene targets found");
              return;
            }
            setCustomTargets(parsed);
            setCustomTargetHeaders(headers);
            setCustomTargetRows(rows);
            setCustomTargetError(null);
          }}
          onCustomError={(err) => setCustomTargetError(err)}
          onClearCustom={() => {
            setCustomTargets(null);
            setCustomTargetHeaders([]);
            setCustomTargetRows([]);
          }}
        />
      </ToolTabPanel>

      {/* ── Schedule Tab ── */}
      <ToolTabPanel tabId="schedule" activeId={activeTab}>
        <SchedulePanel schedule={schedule} />
      </ToolTabPanel>

      {/* ── Efficiency Tab ── */}
      <ToolTabPanel tabId="efficiency" activeId={activeTab}>
        <EfficiencyHeatmap
          schedule={schedule}
          growthImpact={growthImpact}
          avgEfficiency={avgEfficiency}
          offTargetRisk={offTargetRisk}
          protectEssential={protectEssential}
        />
      </ToolTabPanel>

      {/* ── Multiplex Strategy Tab ────────────────────────────────────── */}
      <ToolTabPanel tabId="multiplex" activeId={activeTab}>
        <MultiplexCRISPRPanel />
      </ToolTabPanel>

      {/* ── Prime Editing Tab ────────────────────────────────────────────────── */}
      <ToolTabPanel tabId="prime" activeId={activeTab}>
        <PrimeEditingPanel />
      </ToolTabPanel>

      {/* ── Base Editing Tab ─────────────────────────────────────────────────── */}
      <ToolTabPanel tabId="base" activeId={activeTab}>
        <BaseEditingPanel />
      </ToolTabPanel>

      {/* ── Epigenome Editing Tab ────────────────────────────────────────────── */}
      <ToolTabPanel tabId="epigenome" activeId={activeTab}>
        <EpigenomeEditingPanel />
      </ToolTabPanel>

      {/* ── PASTE Tab ────────────────────────────────────────────────────────── */}
      <ToolTabPanel tabId="paste" activeId={activeTab}>
        <PASTEPanel />
      </ToolTabPanel>

      {/* ── Synthetic Genomics Tab ──────────────────────────────────────────── */}
      <ToolTabPanel tabId="synthetic" activeId={activeTab}>
        <SyntheticGenomicsPanel />
      </ToolTabPanel>

      {/* ── Biosafety Tab ────────────────────────────────────────────────────── */}
      <ToolTabPanel tabId="biosafety" activeId={activeTab}>
        <BiosafetyPanel schedule={schedule} />
      </ToolTabPanel>

      {/* ── GEM Reconstruction Tab ───────────────────────────────────────────── */}
      <ToolTabPanel tabId="gem" activeId={activeTab}>
        <GEMReconstructionPanel />
      </ToolTabPanel>
      <NextStepButton currentStepId="genmim" />
    </ToolShell>
  );
});
