"use client";
import { useRouter } from "next/navigation";
/**
 * CatDes Overview Tab -- Bottleneck analysis, metabolic cost summary,
 * pathway steps, and ProEvol handoff.
 */
import React from "react";
import { ENZYME_STRUCTURES, PATHWAY_STEPS } from "../../../data/mockCatalystDesigner";
import type {
  BindingAffinityResult,
  BottleneckResult,
  EnzymeStructure,
  MetabolicDrainResult,
  MutagenesisResult,
  ParetoFrontResult,
  PathwayBalanceResult,
  SequenceDesignResult,
} from "../../../services/CatalystDesignerEngine";
import { THEME } from "../../../theme";
import MetricCard from "../../ide/shared/MetricCard";
import ConfidenceBadge from "../shared/ConfidenceBadge";
import HandoffCard from "../shared/HandoffCard";
import ResultSummaryPanel from "../shared/ResultSummaryPanel";
import WorkflowStepper from "../shared/WorkflowStepper";
import { GLASS, LABEL, type QualityIndicator, VALUE } from "./catdesShared";

interface CatDesOverviewTabProps {
  enzyme: EnzymeStructure;
  binding: BindingAffinityResult;
  sequences: SequenceDesignResult;
  drain: MetabolicDrainResult;
  balance: PathwayBalanceResult;
  pareto: ParetoFrontResult;
  mutagenesis: MutagenesisResult;
  bottlenecks: {
    bottlenecks: BottleneckResult[];
    topBottleneck: BottleneckResult | null;
    summary: string;
  };
  bestPathway: { name: string } | undefined;
  kdQ: QualityIndicator;
  kcatQ: QualityIndicator;
  fitQ: QualityIndicator;
  activeEnzyme: EnzymeStructure;
}

export default function CatDesOverviewTab({
  enzyme,
  binding,
  sequences,
  drain,
  balance,
  pareto,
  mutagenesis,
  bottlenecks,
  bestPathway,
  kdQ,
  kcatQ,
  fitQ,
  activeEnzyme,
}: CatDesOverviewTabProps) {
  const router = useRouter();

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
      {/* Workflow Stepper */}
      <div style={{ marginBottom: 12 }}>
        <WorkflowStepper
          steps={[
            { id: "enzyme", label: "Enzyme Select", status: "done", detail: enzyme.name },
            { id: "binding", label: "Binding", status: "done", detail: `Kd ${binding.predictedKd.toFixed(1)} μM` },
            { id: "sequences", label: "Sequences", status: "done", detail: `${sequences.designs.length} designs` },
            {
              id: "drain",
              label: "Drain",
              status: drain.isViable ? "done" : "error",
              detail: `${(drain.totalMetabolicDrain * 100).toFixed(1)}%`,
            },
            {
              id: "balance",
              label: "Balance",
              status: balance.isBalanced ? "done" : "active",
              detail: `${balance.iterations} iter`,
            },
          ]}
          activeIndex={4}
        />
      </div>

      {/* Result Summary Panel */}
      <div style={{ marginBottom: 12 }}>
        <ResultSummaryPanel
          metrics={[
            { label: "Kd", value: binding.predictedKd.toFixed(2), unit: "μM", accent: kdQ.color },
            { label: "Best Score", value: sequences.designs[0]?.score.toFixed(3) ?? "N/A", accent: THEME.SKY },
            {
              label: "Drain",
              value: `${(drain.totalMetabolicDrain * 100).toFixed(1)}%`,
              accent: drain.isViable ? THEME.MINT : THEME.CORAL,
            },
            {
              label: "Bottlenecks",
              value: bottlenecks.bottlenecks.length,
              accent: bottlenecks.bottlenecks.length > 0 ? THEME.RISK_LOW : THEME.MINT,
            },
          ]}
          actions={<ConfidenceBadge value={binding.overallScore} label="Binding Fit" />}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "16px" }}>
        {/* Bottleneck Analysis */}
        <div style={{ ...GLASS, borderRadius: 16, padding: "14px" }}>
          <span
            style={{
              fontFamily: THEME.SANS,
              fontSize: "var(--nb-fs-xs)",
              color: LABEL,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Bottleneck Analysis
          </span>
          {bottlenecks.topBottleneck ? (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-md)", color: VALUE, margin: 0 }}>
                {bottlenecks.topBottleneck.enzymeName}
              </p>
              <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, margin: "4px 0 0" }}>
                Score: {bottlenecks.topBottleneck.score.toFixed(3)} — {bottlenecks.topBottleneck.recommendation}
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontFamily: THEME.MONO, fontSize: "10px", color: LABEL }}>FBA</span>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 2 }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${bottlenecks.topBottleneck.factors.fba * 100}%`,
                        background: THEME.SKY,
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontFamily: THEME.MONO, fontSize: "10px", color: LABEL }}>Thermo</span>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 2 }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${bottlenecks.topBottleneck.factors.thermo * 100}%`,
                        background: THEME.CORAL,
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontFamily: THEME.MONO, fontSize: "10px", color: LABEL }}>Expt</span>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 2 }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${bottlenecks.topBottleneck.factors.experimental * 100}%`,
                        background: THEME.MINT,
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-sm)", color: LABEL, margin: "8px 0 0" }}>
              Connect FBA/CETHX/DBTLflow data to identify bottlenecks.
            </p>
          )}
        </div>

        {/* Metabolic Cost */}
        <div style={{ ...GLASS, borderRadius: 16, padding: "14px" }}>
          <span
            style={{
              fontFamily: THEME.SANS,
              fontSize: "var(--nb-fs-xs)",
              color: LABEL,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Metabolic Cost
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            <MetricCard label="ATP Cost" value={drain.atpCost.toFixed(0)} unit="ATP/chain" />
            <MetricCard label="Growth Penalty" value={(drain.growthPenalty * 100).toFixed(1)} unit="%" />
            <MetricCard label="Ribosome" value={(drain.ribosomeBurden * 100).toFixed(1)} unit="%" />
            <MetricCard label="Total Drain" value={(drain.totalMetabolicDrain * 100).toFixed(1)} unit="%" />
          </div>
        </div>
      </div>

      {/* Pathway Steps */}
      <div style={{ ...GLASS, borderRadius: 16, padding: "14px", marginBottom: 12 }}>
        <span
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-xs)",
            color: LABEL,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Pathway Steps
        </span>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {PATHWAY_STEPS.map((step, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.SKY, minWidth: 24 }}>
                {i + 1}
              </span>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-sm)", color: VALUE, flex: 1 }}>
                {step.enzyme} · {step.substrate} → {step.product}
              </span>
              {step.enzyme === bottlenecks.topBottleneck?.enzymeId && (
                <span
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: "10px",
                    color: THEME.RISK_LOW,
                    background: "rgba(255,251,31,0.12)",
                    padding: "2px 6px",
                    borderRadius: 6,
                  }}
                >
                  BOTTLENECK
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Send to ProEvol via HandoffCard */}
      {bottlenecks.topBottleneck &&
        (() => {
          const targetEnzyme = ENZYME_STRUCTURES.find((e) => e.id === bottlenecks.topBottleneck?.enzymeId);
          if (!targetEnzyme) return null;
          return (
            <div style={{ marginTop: 12 }}>
              <HandoffCard
                fromTool="CatDes"
                toTool="ProEvol"
                payloadSummary={`${bottlenecks.topBottleneck.enzymeName} is the rate-limiting step. Best sequence score: ${sequences.designs[0]?.score.toFixed(3) ?? "N/A"}`}
                onSend={() => {
                  localStorage.setItem(
                    "nexus-bio:catdes-to-proevol",
                    JSON.stringify({
                      targetEnzyme: targetEnzyme.id,
                      targetEnzymeName: targetEnzyme.name,
                      targetProperty: "kcat",
                      currentValue: targetEnzyme.kcat,
                      targetValue: targetEnzyme.kcat * 3,
                      pdbId: targetEnzyme.pdbId,
                      uniprotId: targetEnzyme.uniprotId,
                      sequence: targetEnzyme.sequence,
                    }),
                  );
                  router.push("/tools/proevol");
                }}
              />
            </div>
          );
        })()}
    </div>
  );
}
