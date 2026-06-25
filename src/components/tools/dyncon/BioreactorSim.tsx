"use client";
import React, { useState } from "react";
import {
  DEFAULT_CONTROLLER,
  DEFAULT_HILL,
  DEFAULT_PARAMS,
  O2_CONSUMPTION_COEFF,
  SPONTANEOUS_LOSS_RATE,
} from "../../../data/mockDynCon";
import { toolTokens } from "../../../hooks/useToolTheme";
import { THEME } from "../../../theme";
import { PAPER_THEME } from "../../charts/chartTheme";
import MetricCard from "../../ide/shared/MetricCard";
import SimErrorBanner from "../../ide/shared/SimErrorBanner";
import { usePersistedState } from "../../ide/shared/usePersistedState";
import FloatingControlRail from "../shared/FloatingControlRail";
import InlineMetricOverlay from "../shared/InlineMetricOverlay";
import ParameterPanel from "../shared/ParameterPanel";
import ResultSummaryPanel from "../shared/ResultSummaryPanel";
import ScientificFigureFrame from "../shared/ScientificFigureFrame";
import SectionLabel from "../shared/SectionLabel";
import { ParamSlider, TimeSeriesSVG } from "./sharedComponents";
import type { DynConStateReturn } from "./useDynConState";

const { glass: GLASS, border: BORDER, label: LABEL, value: VALUE } = toolTokens;

/* ── Trajectory Panel (trajectory tab content) ─────────────────────────────── */

export function TrajectoryPanel({ state }: { state: DynConStateReturn }) {
  const {
    controlMode,
    setControlMode,
    kp,
    setKp,
    ki,
    setKi,
    kd,
    setKd,
    setpoint,
    setSetpoint,
    vmax,
    setVmax,
    hillKd,
    setHillKd,
    hillN,
    setHillN,
    spontaneousLossRate,
    setSpontaneousLossRate,
    o2ConsumptionCoeff,
    setO2ConsumptionCoeff,
    burdenPenalty,
    setBurdenPenalty,
    mpcPredHorizon,
    setMpcPredHorizon,
    mpcCtrlHorizon,
    setMpcCtrlHorizon,
    mpcStateWeight,
    setMpcStateWeight,
    mpcControlWeight,
    setMpcControlWeight,
    mpcResult,
    trajectory,
    convergence,
    productTiter,
    doRmse,
    currentFPP,
    burden,
    rbsMapping,
    hill,
    chartRef,
  } = state;

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <FloatingControlRail label="Parameters" defaultCollapsed={false} width={260}>
        {/* Control mode toggle */}
        <SectionLabel>Control Mode</SectionLabel>
        <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
          {(["pid", "mpc"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setControlMode(mode)}
              style={{
                flex: 1,
                padding: "6px 8px",
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                fontWeight: controlMode === mode ? 700 : 400,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                background: controlMode === mode ? `${THEME.SKY}20` : "transparent",
                color: controlMode === mode ? THEME.SKY : LABEL,
                border: `1px solid ${controlMode === mode ? `${THEME.SKY}60` : BORDER}`,
                borderRadius: "var(--nb-radius-sm)",
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
            >
              {mode === "pid" ? "PID" : "MPC"}
            </button>
          ))}
        </div>

        {controlMode === "pid" ? (
          <>
            <ParameterPanel
              title="PID Controller"
              onReset={() => {
                setKp(DEFAULT_CONTROLLER.kp);
                setKi(DEFAULT_CONTROLLER.ki);
                setKd(DEFAULT_CONTROLLER.kd);
                setSetpoint(DEFAULT_CONTROLLER.setpoint);
              }}
            >
              <ParamSlider label="Kp" value={kp} min={0} max={10} step={0.1} onChange={setKp} />
              <ParamSlider label="Ki" value={ki} min={0} max={5} step={0.05} onChange={setKi} />
              <ParamSlider label="Kd" value={kd} min={0} max={2} step={0.02} onChange={setKd} />
              <ParamSlider
                label="DO₂ Setpoint"
                value={setpoint}
                min={0.1}
                max={1.0}
                step={0.05}
                onChange={setSetpoint}
                unit="sat."
              />
            </ParameterPanel>
            <ParameterPanel
              title="Hill Feedback"
              onReset={() => {
                setVmax(DEFAULT_HILL.Vmax);
                setHillKd(DEFAULT_HILL.Kd);
                setHillN(DEFAULT_HILL.n);
              }}
            >
              <ParamSlider label="Vmax" value={vmax} min={0.1} max={2.0} step={0.05} onChange={setVmax} />
              <ParamSlider label="Kd" value={hillKd} min={5} max={200} step={5} onChange={setHillKd} unit="μM" />
              <ParamSlider label="n" value={hillN} min={1} max={4} step={0.5} onChange={setHillN} />
            </ParameterPanel>
            <ParameterPanel
              title="Advanced"
              defaultCollapsed
              onReset={() => {
                setSpontaneousLossRate(SPONTANEOUS_LOSS_RATE);
                setO2ConsumptionCoeff(O2_CONSUMPTION_COEFF);
                setBurdenPenalty(0.4);
              }}
            >
              <ParamSlider
                label="Spont. Loss Rate"
                value={spontaneousLossRate}
                min={0.001}
                max={0.1}
                step={0.001}
                onChange={setSpontaneousLossRate}
                unit="h⁻¹"
              />
              <ParamSlider
                label="O₂ Cons. Coeff"
                value={o2ConsumptionCoeff}
                min={0.5}
                max={3.0}
                step={0.1}
                onChange={setO2ConsumptionCoeff}
              />
              <ParamSlider
                label="Burden Penalty"
                value={burdenPenalty}
                min={0.1}
                max={0.8}
                step={0.05}
                onChange={setBurdenPenalty}
              />
            </ParameterPanel>
          </>
        ) : (
          <>
            <ParameterPanel
              title="MPC Configuration"
              onReset={() => {
                setMpcPredHorizon(10);
                setMpcCtrlHorizon(4);
                setSetpoint(DEFAULT_CONTROLLER.setpoint);
              }}
            >
              <ParamSlider
                label="Prediction Horizon"
                value={mpcPredHorizon}
                min={2}
                max={20}
                step={1}
                onChange={setMpcPredHorizon}
              />
              <ParamSlider
                label="Control Horizon"
                value={mpcCtrlHorizon}
                min={1}
                max={Math.min(mpcPredHorizon, 10)}
                step={1}
                onChange={setMpcCtrlHorizon}
              />
              <ParamSlider
                label="DO₂ Setpoint"
                value={setpoint}
                min={0.1}
                max={1.0}
                step={0.05}
                onChange={setSetpoint}
                unit="sat."
              />
            </ParameterPanel>
            <ParameterPanel
              title="Cost Weights"
              onReset={() => {
                setMpcStateWeight(10.0);
                setMpcControlWeight(0.5);
              }}
            >
              <ParamSlider
                label="State Weight (DO₂)"
                value={mpcStateWeight}
                min={0.1}
                max={50}
                step={0.5}
                onChange={setMpcStateWeight}
              />
              <ParamSlider
                label="Control Weight"
                value={mpcControlWeight}
                min={0.01}
                max={5}
                step={0.05}
                onChange={setMpcControlWeight}
              />
            </ParameterPanel>
            <ParameterPanel
              title="Hill Feedback"
              onReset={() => {
                setVmax(DEFAULT_HILL.Vmax);
                setHillKd(DEFAULT_HILL.Kd);
                setHillN(DEFAULT_HILL.n);
              }}
            >
              <ParamSlider label="Vmax" value={vmax} min={0.1} max={2.0} step={0.05} onChange={setVmax} />
              <ParamSlider label="Kd" value={hillKd} min={5} max={200} step={5} onChange={setHillKd} unit="μM" />
              <ParamSlider label="n" value={hillN} min={1} max={4} step={0.5} onChange={setHillN} />
            </ParameterPanel>
          </>
        )}
      </FloatingControlRail>

      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <ScientificFigureFrame
          eyebrow={controlMode === "mpc" ? "MPC controller figure" : "Controller figure"}
          title={controlMode === "mpc" ? "MPC-controlled bioreactor dynamics" : "Closed-loop bioreactor dynamics"}
          caption={
            controlMode === "mpc"
              ? `6-lane time-series under MPC control (Np=${mpcPredHorizon}, Nc=${mpcCtrlHorizon}). Predicted trajectory shown as dashed overlay.`
              : "6-lane time-series showing biomass, substrate, product, DO₂, FPP, and ADS expression trajectories under PID control."
          }
          legend={[
            { label: "Setpoint", value: `${setpoint.toFixed(2)} sat.`, accent: THEME.SKY },
            {
              label: "Stability",
              value: convergence.isStable ? "Stable" : "Unstable",
              accent: convergence.isStable ? THEME.MINT : THEME.CORAL,
            },
            { label: "Titer", value: `${productTiter.toFixed(2)} g/L`, accent: THEME.MINT },
            ...(controlMode === "mpc" && mpcResult
              ? [
                  { label: "MPC Cost", value: mpcResult.cost.toFixed(1), accent: THEME.APRICOT },
                  {
                    label: "Feasible",
                    value: mpcResult.feasible ? "Yes" : "No",
                    accent: mpcResult.feasible ? THEME.MINT : THEME.CORAL,
                  },
                ]
              : [{ label: "RBS", value: rbsMapping.rbsName, accent: THEME.LILAC }]),
          ]}
          minHeight="100%"
        >
          <TimeSeriesSVG trajectory={trajectory} setpoint={setpoint} svgRef={chartRef} />
        </ScientificFigureFrame>

        <InlineMetricOverlay
          position="top-right"
          metrics={[
            { label: "Titer", value: `${productTiter.toFixed(2)} g/L`, accent: THEME.MINT },
            { label: "DO₂ RMSE", value: doRmse.toFixed(3), accent: doRmse > 0.1 ? THEME.CORAL : THEME.SKY },
            {
              label: "FPP",
              value: `${currentFPP.toFixed(1)} μM`,
              accent: currentFPP > DEFAULT_PARAMS.fppToxicThreshold ? THEME.CORAL : THEME.SKY,
            },
            {
              label: "Burden",
              value: burden.burdenIndex.toFixed(3),
              accent: burden.isViable ? THEME.MINT : THEME.CORAL,
            },
            ...(controlMode === "mpc" && mpcResult
              ? [{ label: "MPC Cost", value: mpcResult.cost.toFixed(2), accent: THEME.APRICOT }]
              : []),
          ]}
        />

        {/* ── MPC Prediction Horizon Visualization ── */}
        {controlMode === "mpc" && mpcResult && mpcResult.predictedTrajectory.length > 1 && (
          <div style={{ ...GLASS, padding: "12px", margin: "8px 16px" }}>
            <SectionLabel>Prediction Horizon</SectionLabel>
            <div
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
                color: LABEL,
                marginBottom: "8px",
                lineHeight: 1.5,
              }}
            >
              MPC-predicted DO₂ trajectory over the next {mpcPredHorizon} steps from the final operating point. The
              controller optimizes airflow to keep DO₂ at setpoint while respecting constraints.
            </div>
            <svg width="100%" viewBox="0 0 560 100" style={{ display: "block" }}>
              {(() => {
                const W = 560,
                  H = 100,
                  PAD = 30;
                const pred = mpcResult.predictedTrajectory;
                const tMax = pred[pred.length - 1].time - pred[0].time;
                const doMax = 1.2;
                const spY = PAD + (1 - setpoint / doMax) * (H - 2 * PAD);
                const predPts = pred.map((s, i) => {
                  const x = PAD + ((s.time - pred[0].time) / Math.max(1, tMax)) * (W - 2 * PAD);
                  const y = PAD + (1 - (s.dissolvedO2 ?? 0) / doMax) * (H - 2 * PAD);
                  return `${x},${y}`;
                });
                return (
                  <>
                    <rect
                      x={PAD}
                      y={PAD}
                      width={W - 2 * PAD}
                      height={H - 2 * PAD}
                      rx="2"
                      fill={PAPER_THEME.bgAlt}
                      stroke={PAPER_THEME.border}
                    />
                    <line x1={PAD} y1={spY} x2={W - PAD} y2={spY} stroke={`${THEME.SKY}50`} strokeDasharray="4 4" />
                    <text
                      x={W - PAD + 4}
                      y={spY + 3}
                      fontFamily={PAPER_THEME.tickFont}
                      fontSize="9"
                      fill={PAPER_THEME.tickColor}
                    >
                      SP
                    </text>
                    <polyline
                      points={predPts.join(" ")}
                      fill="none"
                      stroke={THEME.MINT}
                      strokeWidth="2"
                      strokeDasharray="6 3"
                    />
                    <circle cx={predPts[0]?.split(",")[0]} cy={predPts[0]?.split(",")[1]} r="3" fill={THEME.CORAL} />
                    <text x={PAD} y={12} fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>
                      DO₂ prediction
                    </text>
                    <text x={PAD} y={H - 8} fontFamily={PAPER_THEME.tickFont} fontSize="9" fill={PAPER_THEME.tickColor}>
                      now
                    </text>
                    <text
                      x={W - PAD}
                      y={H - 8}
                      textAnchor="end"
                      fontFamily={PAPER_THEME.tickFont}
                      fontSize="9"
                      fill={PAPER_THEME.tickColor}
                    >
                      +{mpcPredHorizon}h
                    </text>
                  </>
                );
              })()}
            </svg>
          </div>
        )}

        {/* ── MPC Constraint Violations ── */}
        {controlMode === "mpc" && mpcResult && mpcResult.constraintViolations.length > 0 && (
          <div style={{ ...GLASS, padding: "12px", margin: "0 16px 8px", borderLeft: `3px solid ${THEME.CORAL}` }}>
            <SectionLabel>Constraint Violations</SectionLabel>
            <div
              style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: THEME.CORAL, marginBottom: "4px" }}
            >
              {mpcResult.constraintViolations.length} violation(s) detected during simulation
            </div>
            <div style={{ maxHeight: "80px", overflow: "auto" }}>
              {mpcResult.constraintViolations.slice(0, 8).map((v, i) => (
                <div
                  key={i}
                  style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-2xs)", color: LABEL, padding: "2px 0" }}
                >
                  t={v.time.toFixed(0)}h: {v.variable} = {v.value.toFixed(2)} (bound: {v.bound})
                </div>
              ))}
              {mpcResult.constraintViolations.length > 8 && (
                <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-2xs)", color: THEME.DIM }}>
                  +{mpcResult.constraintViolations.length - 8} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Bioprocess Optimization Panel ─────────────────────────────────────────── */

export function BioprocessOptimizationPanel() {
  const [loading, setLoading] = useState(false);
  const [simResult, setSimResult] = useState<
    import("../../../server/bioprocessOptimizationEngine").BioprocessResult | null
  >(null);
  const [optResult, setOptResult] = useState<{
    optimalFeedRates: number[];
    maxProduct: number;
    improvement: number;
  } | null>(null);
  const [activeBioprocessTab, setActiveBioprocessTab] = useState<"kinetics" | "kla" | "optimize">("kinetics");
  const [bpError, setBpError] = useState<string | null>(null);

  const [muMax, setMuMax] = usePersistedState("nexus-bio:dyncon:bp:muMax", 0.5);
  const [ks, setKs] = usePersistedState("nexus-bio:dyncon:bp:ks", 0.5);
  const [ko, setKo] = usePersistedState("nexus-bio:dyncon:bp:ko", 0.5);
  const [feedConc, setFeedConc] = usePersistedState("nexus-bio:dyncon:bp:feedConc", 200);
  const [feedRate, setFeedRate] = usePersistedState("nexus-bio:dyncon:bp:feedRate", 0.05);
  const [agitation, setAgitation] = usePersistedState("nexus-bio:dyncon:bp:agitation", 300);
  const [aeration, setAeration] = usePersistedState("nexus-bio:dyncon:bp:aeration", 1.0);
  const [duration, setDuration] = usePersistedState("nexus-bio:dyncon:bp:duration", 48);

  const handleSimulate = React.useCallback(async () => {
    setLoading(true);
    try {
      const { simulateFedBatch, optimizeFedBatch } = await import("../../../server/bioprocessOptimizationEngine");
      const params = {
        volume: 2,
        impellerDiameter: 0.08,
        agitationSpeed: agitation,
        aerationRate: aeration,
        muMax,
        ks,
        ko,
        kp: 50,
        yieldCoeff: 0.5,
        maintenanceCoeff: 0.02,
        productYield: 0.1,
        productMaintenance: 0.01,
        deathRate: 0.01,
        temperature: 37,
        pH: 7.0,
        dissolvedO2: 100,
        feedConcentration: feedConc,
        feedRate,
      };
      const sim = simulateFedBatch(params, duration);
      setSimResult(sim);
      const opt = optimizeFedBatch(params, duration, 12);
      setOptResult(opt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bioprocess simulation failed";
      setBpError(msg);
    } finally {
      setLoading(false);
    }
  }, [muMax, ks, ko, feedConc, feedRate, agitation, aeration, duration]);

  const klaValue = React.useMemo(() => {
    const Np = 6.0,
      rho = 1000;
    const N = agitation / 60;
    const D = 0.08;
    const power = Np * rho * N ** 3 * D ** 5;
    const pv = power / (2 * 0.001);
    const Q = (aeration * 2) / 60;
    const rD = ((2 * 4) / (Math.PI * 3)) ** (1 / 3);
    const A = (Math.PI * (rD / 100) ** 2) / 4;
    const vs = (Q * 1e-3) / Math.max(A, 0.001);
    return 0.02 * pv ** 0.4 * vs ** 0.5 * 0.001 ** -0.5;
  }, [agitation, aeration]);

  const bioprocessSubTabs = [
    { id: "kinetics", label: "Kinetics", accent: THEME.MINT },
    { id: "kla", label: "kLa / O₂", accent: THEME.SKY },
    { id: "optimize", label: "Optimize", accent: THEME.APRICOT },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px", overflow: "auto" }}>
      {/* Sub-tab bar */}
      <div style={{ display: "flex", gap: "4px" }}>
        {bioprocessSubTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveBioprocessTab(tab.id)}
            style={{
              padding: "6px 12px",
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              fontWeight: activeBioprocessTab === tab.id ? 700 : 400,
              background: activeBioprocessTab === tab.id ? `${tab.accent}20` : "transparent",
              color: activeBioprocessTab === tab.id ? tab.accent : LABEL,
              border: `1px solid ${activeBioprocessTab === tab.id ? `${tab.accent}60` : BORDER}`,
              borderRadius: "var(--nb-radius-sm)",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={handleSimulate}
          disabled={loading}
          style={{
            padding: "6px 14px",
            borderRadius: "var(--nb-radius-sm)",
            background: loading ? "rgba(255,255,255,0.04)" : "rgba(191,220,205,0.14)",
            border: `1px solid ${loading ? "rgba(255,255,255,0.08)" : "rgba(191,220,205,0.3)"}`,
            color: loading ? "rgba(255,255,255,0.35)" : "rgba(191,220,205,0.9)",
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Simulating..." : "Run Simulation"}
        </button>
      </div>

      {bpError && <SimErrorBanner message={bpError} onRetry={() => setBpError(null)} />}

      {/* Parameters */}
      <ParameterPanel
        title="Bioprocess Parameters"
        onReset={() => {
          setMuMax(0.5);
          setKs(0.5);
          setKo(0.5);
          setFeedConc(200);
          setFeedRate(0.05);
          setAgitation(300);
          setAeration(1.0);
          setDuration(48);
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <ParamSlider label="μ_max" value={muMax} min={0.1} max={1.5} step={0.05} onChange={setMuMax} unit="h⁻¹" />
          <ParamSlider label="Ks" value={ks} min={0.1} max={5.0} step={0.1} onChange={setKs} unit="g/L" />
          <ParamSlider label="Ko" value={ko} min={0.1} max={2.0} step={0.1} onChange={setKo} unit="% sat." />
          <ParamSlider
            label="Feed Conc"
            value={feedConc}
            min={50}
            max={400}
            step={10}
            onChange={setFeedConc}
            unit="g/L"
          />
          <ParamSlider
            label="Feed Rate"
            value={feedRate}
            min={0.001}
            max={0.2}
            step={0.005}
            onChange={setFeedRate}
            unit="L/h"
          />
          <ParamSlider
            label="Agitation"
            value={agitation}
            min={100}
            max={800}
            step={25}
            onChange={setAgitation}
            unit="rpm"
          />
          <ParamSlider
            label="Aeration"
            value={aeration}
            min={0.1}
            max={3.0}
            step={0.1}
            onChange={setAeration}
            unit="vvm"
          />
          <ParamSlider label="Duration" value={duration} min={12} max={120} step={4} onChange={setDuration} unit="h" />
        </div>
      </ParameterPanel>

      {/* Kinetics Tab */}
      {activeBioprocessTab === "kinetics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...GLASS, padding: "12px" }}>
            <SectionLabel>Structured Kinetics Model</SectionLabel>
            <div
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
                color: LABEL,
                marginBottom: "8px",
                lineHeight: 1.5,
              }}
            >
              Monod kinetics with O₂ limitation and product inhibition (Garcia-Ochoa &amp; Gomez, 2009). Growth: μ =
              μ_max · S/(Ks+S) · O₂/(Ko+O₂) · (1-P/Kp)^n
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
              {[
                { model: "Monod", formula: "S/(Ks+S)", param: `Ks=${ks.toFixed(2)} g/L` },
                { model: "Contois", formula: "S/(B·X+S)", param: `B=${(ks / 0.5).toFixed(2)}` },
                { model: "Tessier", formula: "1-exp(-S/Ks)", param: `Ks=${ks.toFixed(2)} g/L` },
              ].map((m, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${BORDER}`,
                    borderRadius: "var(--nb-radius-sm)",
                    padding: "8px 10px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xxs)",
                      color: THEME.LILAC,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 4,
                    }}
                  >
                    {m.model}
                  </div>
                  <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>{m.formula}</div>
                  <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: LABEL, marginTop: 2 }}>
                    {m.param}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Simulation Results */}
          {simResult && (
            <>
              <ResultSummaryPanel
                metrics={[
                  { label: "Final Biomass", value: simResult.finalBiomass.toFixed(2), unit: "g/L", accent: THEME.MINT },
                  { label: "Final Product", value: simResult.finalProduct.toFixed(2), unit: "g/L", accent: THEME.SKY },
                  {
                    label: "Productivity",
                    value: simResult.productivity.toFixed(3),
                    unit: "g/L/h",
                    accent: THEME.APRICOT,
                  },
                  { label: "Yield", value: simResult.yield.toFixed(3), unit: "g/g", accent: THEME.LILAC },
                ]}
              />
              {/* Time-series mini chart */}
              <div style={{ ...GLASS, padding: "12px" }}>
                <SectionLabel>Fed-Batch Trajectory</SectionLabel>
                <svg width="100%" viewBox="0 0 560 180" style={{ display: "block" }}>
                  {(() => {
                    const W = 560,
                      H = 180,
                      PAD = 30;
                    const ts = simResult.timeSeries;
                    if (ts.length < 2) return null;
                    const tMax = ts[ts.length - 1].time;
                    const xMax = Math.max(0.001, ...ts.map((t) => t.biomass));
                    const sMax = Math.max(0.001, ...ts.map((t) => t.substrate));
                    const pMax = Math.max(0.001, ...ts.map((t) => t.product));
                    const toX = (t: number) => PAD + (t / tMax) * (W - 2 * PAD);
                    const toY = (v: number, mx: number) => PAD + (1 - v / mx) * (H - 2 * PAD);
                    const mkPath = (key: keyof (typeof ts)[0], mx: number) =>
                      ts.map((s, i) => `${i === 0 ? "M" : "L"}${toX(s.time)},${toY(s[key] as number, mx)}`).join(" ");
                    return (
                      <>
                        <rect
                          x={PAD}
                          y={PAD}
                          width={W - 2 * PAD}
                          height={H - 2 * PAD}
                          rx="2"
                          fill={PAPER_THEME.bgAlt}
                          stroke={PAPER_THEME.border}
                        />
                        <path d={mkPath("biomass", xMax)} fill="none" stroke={THEME.MINT} strokeWidth="1.5" />
                        <path d={mkPath("substrate", sMax)} fill="none" stroke={THEME.SKY} strokeWidth="1.5" />
                        <path d={mkPath("product", pMax)} fill="none" stroke={THEME.APRICOT} strokeWidth="1.5" />
                        {/* Legend */}
                        {[
                          { l: "Biomass", c: THEME.MINT },
                          { l: "Substrate", c: THEME.SKY },
                          { l: "Product", c: THEME.APRICOT },
                        ].map((item, i) => (
                          <g key={item.l}>
                            <line
                              x1={PAD + i * 100}
                              y1={H - 8}
                              x2={PAD + i * 100 + 16}
                              y2={H - 8}
                              stroke={item.c}
                              strokeWidth="2"
                            />
                            <text
                              x={PAD + i * 100 + 20}
                              y={H - 5}
                              fontFamily={PAPER_THEME.tickFont}
                              fontSize="9"
                              fill={PAPER_THEME.tickColor}
                            >
                              {item.l}
                            </text>
                          </g>
                        ))}
                        <text
                          x={PAD}
                          y={14}
                          fontFamily={PAPER_THEME.tickFont}
                          fontSize="10"
                          fill={PAPER_THEME.tickColor}
                        >
                          Time (h)
                        </text>
                      </>
                    );
                  })()}
                </svg>
              </div>
              {simResult.recommendations.length > 0 && (
                <div style={{ ...GLASS, padding: "12px", borderLeft: `3px solid ${THEME.APRICOT}` }}>
                  <SectionLabel>Recommendations</SectionLabel>
                  {simResult.recommendations.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        fontFamily: THEME.SANS,
                        fontSize: "var(--nb-fs-xs)",
                        color: "rgba(255,255,255,0.7)",
                        padding: "2px 0",
                      }}
                    >
                      • {r}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* kLa Tab */}
      {activeBioprocessTab === "kla" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...GLASS, padding: "12px" }}>
            <SectionLabel>kLa Correlation (van&apos;t Riet, 1979)</SectionLabel>
            <div
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
                color: LABEL,
                marginBottom: "8px",
                lineHeight: 1.5,
              }}
            >
              kLa = a · (P/V)^b · v_s^c · μ_app^d — volumetric oxygen transfer coefficient for stirred-tank bioreactors.
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <MetricCard label="kLa" value={klaValue.toFixed(2)} unit="h⁻¹" highlight />
              <MetricCard label="Agitation" value={agitation} unit="rpm" />
              <MetricCard label="Aeration" value={aeration} unit="vvm" />
              {simResult && <MetricCard label="OTR" value={simResult.oxygenTransferRate} unit="mmol/L/h" />}
            </div>
          </div>
          <div style={{ ...GLASS, padding: "12px" }}>
            <SectionLabel>Empirical Coefficients</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {[
                { sym: "a", val: "0.02", desc: "van't Riet (coalescing)" },
                { sym: "b", val: "0.4", desc: "Power number exponent" },
                { sym: "c", val: "0.5", desc: "Gas velocity exponent" },
                { sym: "d", val: "-0.5", desc: "Viscosity exponent" },
              ].map((c, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${BORDER}`,
                    borderRadius: "var(--nb-radius-sm)",
                    padding: "8px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-lg)", color: THEME.SKY, fontWeight: 700 }}
                  >
                    {c.sym}={c.val}
                  </div>
                  <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: LABEL, marginTop: 2 }}>
                    {c.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {simResult && (
            <div style={{ ...GLASS, padding: "12px" }}>
              <SectionLabel>Agitation Power</SectionLabel>
              <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: VALUE }}>
                P/V = {simResult.agitationPower.toFixed(2)} W/L
              </div>
              <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: LABEL, marginTop: 4 }}>
                Rushton turbine (Np=6.0) · Impeller D=0.08 m · Volume=2 L
              </div>
            </div>
          )}
        </div>
      )}

      {/* Optimize Tab */}
      {activeBioprocessTab === "optimize" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...GLASS, padding: "12px" }}>
            <SectionLabel>Pontryagin Maximum Principle (Grid Search)</SectionLabel>
            <div style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, lineHeight: 1.5 }}>
              Exhaustive feed-rate optimization via grid search over {12} candidate rates. Selects the constant feed
              rate that maximizes final product concentration. Full Pontryagin costate equations approximate via
              discrete enumeration (Lim &amp; Shin, 1989).
            </div>
          </div>
          {optResult ? (
            <>
              <ResultSummaryPanel
                metrics={[
                  {
                    label: "Max Product",
                    value: optResult.maxProduct.toFixed(2),
                    unit: "g/L",
                    accent: THEME.MINT,
                    trend: "up",
                  },
                  {
                    label: "Improvement",
                    value: `+${(optResult.improvement * 100).toFixed(1)}%`,
                    accent: THEME.APRICOT,
                    trend: optResult.improvement > 0 ? "up" : "flat",
                  },
                  {
                    label: "Optimal Feed",
                    value: optResult.optimalFeedRates[0]?.toFixed(3) ?? "—",
                    unit: "L/h",
                    accent: THEME.SKY,
                  },
                ]}
              />
              <div style={{ ...GLASS, padding: "12px" }}>
                <SectionLabel>Optimal Feed Rate Trajectory</SectionLabel>
                <svg width="100%" viewBox="0 0 560 100" style={{ display: "block" }}>
                  {(() => {
                    const W = 560,
                      H = 100,
                      PAD = 30;
                    const rates = optResult.optimalFeedRates;
                    if (rates.length < 1) return null;
                    const rMax = Math.max(0.001, ...rates);
                    const pts = rates.map((r, i) => {
                      const x = PAD + (i / Math.max(1, rates.length - 1)) * (W - 2 * PAD);
                      const y = PAD + (1 - r / rMax) * (H - 2 * PAD);
                      return `${x},${y}`;
                    });
                    return (
                      <>
                        <rect
                          x={PAD}
                          y={PAD}
                          width={W - 2 * PAD}
                          height={H - 2 * PAD}
                          rx="2"
                          fill={PAPER_THEME.bgAlt}
                          stroke={PAPER_THEME.border}
                        />
                        <polyline points={pts.join(" ")} fill="none" stroke={THEME.MINT} strokeWidth="2" />
                        <text
                          x={PAD}
                          y={14}
                          fontFamily={PAPER_THEME.tickFont}
                          fontSize="10"
                          fill={PAPER_THEME.tickColor}
                        >
                          Optimal feed rate (constant)
                        </text>
                        <text
                          x={PAD}
                          y={H - 6}
                          fontFamily={PAPER_THEME.tickFont}
                          fontSize="9"
                          fill={PAPER_THEME.tickColor}
                        >
                          0h
                        </text>
                        <text
                          x={W - PAD}
                          y={H - 6}
                          textAnchor="end"
                          fontFamily={PAPER_THEME.tickFont}
                          fontSize="9"
                          fill={PAPER_THEME.tickColor}
                        >
                          {rates.length}h
                        </text>
                      </>
                    );
                  })()}
                </svg>
              </div>
            </>
          ) : (
            <div
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-sm)",
                color: LABEL,
                padding: "20px",
                textAlign: "center",
              }}
            >
              Run simulation first to compute optimal feed rates.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
