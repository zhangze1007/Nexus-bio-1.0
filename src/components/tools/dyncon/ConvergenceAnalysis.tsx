"use client";
import React from "react";
import { DEFAULT_CONTROLLER, DEFAULT_PARAMS } from "../../../data/mockDynCon";
import { toolTokens } from "../../../hooks/useToolTheme";
import { THEME } from "../../../theme";
import MetricCard from "../../ide/shared/MetricCard";
import FloatingControlRail from "../shared/FloatingControlRail";
import InlineMetricOverlay from "../shared/InlineMetricOverlay";
import ParameterPanel from "../shared/ParameterPanel";
import SectionLabel from "../shared/SectionLabel";
import { ParamSlider, StatRow } from "./sharedComponents";
import type { DynConStateReturn } from "./useDynConState";

const { glass: GLASS, label: LABEL, value: VALUE } = toolTokens;

/* ── Convergence Panel (convergence tab content) ───────────────────────────── */

export function ConvergencePanel({ state }: { state: DynConStateReturn }) {
  const {
    convergence,
    burden,
    pipelineResult,
    setPipelineResult,
    pipelineLoading,
    setPipelineLoading,
    pipelineError,
    setPipelineError,
    kp,
    ki,
    kd,
    setpoint,
    hill,
    controlMode,
    productTiter,
    productivity,
    last,
    doRmse,
    currentFPP,
    currentADS,
  } = state;

  return (
    <div style={{ display: "flex", gap: "16px", flex: 1, minHeight: 0, overflow: "auto", padding: "12px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <SectionLabel>Convergence Analysis</SectionLabel>
        <div style={{ ...GLASS, padding: "12px", marginBottom: "12px" }}>
          <StatRow label="Settling Time" value={convergence.settlingTime} unit="h" />
          <StatRow label="Overshoot" value={convergence.overshoot} unit="%" />
          <StatRow label="Conv. Rate" value={convergence.convergenceRate} unit="h⁻¹" />
          <StatRow label="SS Error" value={convergence.steadyStateError} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: convergence.isStable ? THEME.MINT : THEME.CORAL,
              }}
            />
            <span
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-sm)",
                color: convergence.isStable ? VALUE : THEME.CORAL,
              }}
            >
              {convergence.isStable ? "Stable" : "Unstable"}
            </span>
          </div>
        </div>
        <SectionLabel>Metabolic Burden</SectionLabel>
        <div style={{ ...GLASS, padding: "12px" }}>
          <StatRow label="Burden Index" value={burden.burdenIndex} />
          <StatRow label="Protein Cost" value={burden.proteinCost} />
          <StatRow label="ATP Drain" value={burden.atpDrain} unit="mmol/gDW/h" />
          <StatRow label="Growth Penalty" value={burden.growthPenalty} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: burden.isViable ? THEME.MINT : THEME.CORAL,
              }}
            />
            <span
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-sm)",
                color: burden.isViable ? VALUE : THEME.CORAL,
              }}
            >
              {burden.isViable ? "Viable" : "Non-viable"}
            </span>
          </div>
          <p
            style={{
              fontFamily: THEME.SANS,
              fontSize: "var(--nb-fs-xs)",
              fontStyle: "italic",
              color: LABEL,
              lineHeight: 1.45,
              marginTop: "6px",
            }}
          >
            {burden.recommendation}
          </p>
        </div>

        {/* ── Pipeline Section ── */}
        <div style={{ ...GLASS, padding: "12px", marginTop: "12px" }}>
          <SectionLabel>Control Optimization Pipeline</SectionLabel>
          <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL, margin: "0 0 8px" }}>
            Optimize PID gains via gradient-free search against current trajectory cost.
          </p>
          <button
            onClick={async () => {
              setPipelineLoading(true);
              setPipelineError(null);
              try {
                const res = await fetch("/api/pipeline/dyncon", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ kp, ki, kd, setpoint, hill, controlMode }),
                });
                if (!res.ok) throw new Error(`Pipeline failed (${res.status})`);
                const data = await res.json();
                setPipelineResult(data.result);
              } catch (err) {
                setPipelineError(err instanceof Error ? err.message : "Pipeline failed");
              } finally {
                setPipelineLoading(false);
              }
            }}
            disabled={pipelineLoading}
            style={{
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
              <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.VALUE }}>
                Kp={pipelineResult.optimalKp.toFixed(2)} Ki={pipelineResult.optimalKi.toFixed(3)} Kd=
                {pipelineResult.optimalKd.toFixed(3)}
              </div>
              <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: THEME.LABEL, marginTop: 2 }}>
                Cost reduction: {(pipelineResult.costReduction * 100).toFixed(1)}% | {pipelineResult.iterations}{" "}
                iterations
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <SectionLabel>Process Readouts</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <MetricCard label="Final Product Titer" value={productTiter} unit="g/L" highlight />
          <MetricCard label="Productivity" value={productivity} unit="g/L/h" />
          <MetricCard label="Final Biomass" value={last?.biomass ?? 0} unit="g/L" />
          <MetricCard label="DO₂ RMSE" value={doRmse} unit="sat." warning={doRmse > 0.1 ? "Poor control" : undefined} />
          <MetricCard
            label="FPP Level"
            value={currentFPP}
            unit="μM"
            warning={currentFPP > DEFAULT_PARAMS.fppToxicThreshold ? "Above toxic" : undefined}
          />
          <MetricCard label="ADS Expression" value={currentADS} unit="a.u." />
        </div>
      </div>
    </div>
  );
}

/* ── RBS Bridge Panel (RBS tab content) ────────────────────────────────────── */

export function RBSBridgePanel({ state }: { state: DynConStateReturn }) {
  const { kp, setKp, ki, setKi, kd, setKd, rbsMapping } = state;

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <FloatingControlRail label="Controller Gains" defaultCollapsed={false} width={260}>
        <ParameterPanel
          title="PID Controller"
          onReset={() => {
            setKp(DEFAULT_CONTROLLER.kp);
            setKi(DEFAULT_CONTROLLER.ki);
            setKd(DEFAULT_CONTROLLER.kd);
          }}
        >
          <ParamSlider label="Kp" value={kp} min={0} max={10} step={0.1} onChange={setKp} />
          <ParamSlider label="Ki" value={ki} min={0} max={5} step={0.05} onChange={setKi} />
          <ParamSlider label="Kd" value={kd} min={0} max={2} step={0.02} onChange={setKd} />
        </ParameterPanel>
      </FloatingControlRail>

      <div
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          gap: "12px",
          padding: "12px",
          overflow: "auto",
        }}
      >
        <SectionLabel>RBS Part Mapping</SectionLabel>
        <div style={{ ...GLASS, padding: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <div
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  color: LABEL,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: "4px",
                }}
              >
                Control Gain
              </div>
              <div style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-lg)", color: VALUE, fontWeight: 700 }}>
                {rbsMapping.controlGain.toFixed(2)}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  color: LABEL,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: "4px",
                }}
              >
                RBS Part
              </div>
              <div style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-lg)", color: THEME.SKY, fontWeight: 700 }}>
                {rbsMapping.rbsName}
              </div>
            </div>
          </div>
          <div style={{ marginBottom: "12px" }}>
            <div
              style={{
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                color: LABEL,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "4px",
              }}
            >
              RBS Strength
            </div>
            <div style={{ background: THEME.PANEL_INSET, borderRadius: "6px", height: "10px", overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.min(100, rbsMapping.rbsStrength * 100)}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${THEME.SKY}, ${THEME.MINT})`,
                  borderRadius: "6px",
                  transition: "width 300ms ease-out",
                }}
              />
            </div>
            <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE, marginTop: "4px" }}>
              {(rbsMapping.rbsStrength * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                color: LABEL,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "4px",
              }}
            >
              DNA Sequence
            </div>
            <p
              style={{
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                color: THEME.SKY,
                wordBreak: "break-all",
                lineHeight: 1.6,
                background: THEME.PANEL_INSET,
                padding: "8px",
                borderRadius: "var(--nb-radius-sm)",
                border: `1px solid ${THEME.BORDER}`,
              }}
            >
              {rbsMapping.sequence}
            </p>
          </div>
        </div>

        <InlineMetricOverlay
          position="top-right"
          metrics={[
            { label: "Gain", value: rbsMapping.controlGain.toFixed(2), accent: THEME.SKY },
            { label: "RBS", value: rbsMapping.rbsName, accent: THEME.LILAC },
            { label: "Strength", value: `${(rbsMapping.rbsStrength * 100).toFixed(0)}%`, accent: THEME.MINT },
          ]}
        />
      </div>
    </div>
  );
}
