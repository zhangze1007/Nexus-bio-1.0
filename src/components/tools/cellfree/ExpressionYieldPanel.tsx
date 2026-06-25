"use client";
import type React from "react";
import { toolTokens } from "../../../hooks/useToolTheme";
import type { CalibrationResult } from "../../../server/mcmcCalibration";
import type {
  CFSFullResult,
  CFSParameters,
  GeneConstruct,
  PlateReaderDataPoint,
} from "../../../services/CellFreeEngine";
import type { BRENDAKinetics } from "../../../services/database/brendaClient";
import { THEME } from "../../../theme";
import { PAPER_THEME, SEMANTIC_RGB } from "../../charts/chartTheme";
import DataSourceBadge from "../../ide/shared/DataSourceBadge";
import FloatingControlRail from "../shared/FloatingControlRail";
import ScientificFigureFrame from "../shared/ScientificFigureFrame";
import SectionLabel from "../shared/SectionLabel";
import { FittingChart, GENE_COLORS, getIvivExpressionLabel, IvIvChart } from "./sharedComponents";

const {
  glass: GLASS,
  label: LABEL,
  value: VALUE,
  inputBg: INPUT_BG,
  inputBorder: INPUT_BORDER,
  inputText: INPUT_TEXT,
  border: BORDER,
} = toolTokens;

/* ── Fitting Tab Content ──────────────────────────────────────────── */

interface FittingTabContentProps {
  result: CFSFullResult;
  params: CFSParameters;
  fit: CFSFullResult["fitting"];
  userData: PlateReaderDataPoint[] | null;
  brendaEcInput: string;
  brendaData: BRENDAKinetics | null;
  brendaSource: "live" | "mock";
  brendaLoading: boolean;
  brendaApplied: boolean;
  onCsvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearUserData: () => void;
  onBrendaEcInputChange: (value: string) => void;
  onBrendaLookup: () => void;
  onApplyBrenda: () => void;
  onClearBrenda: () => void;
}

export function FittingTabContent({
  result,
  params,
  fit,
  userData,
  brendaEcInput,
  brendaData,
  brendaSource,
  brendaLoading,
  brendaApplied,
  onCsvUpload,
  onClearUserData,
  onBrendaEcInputChange,
  onBrendaLookup,
  onApplyBrenda,
  onClearBrenda,
}: FittingTabContentProps) {
  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <FloatingControlRail label="Parameters" defaultCollapsed={true}>
        <SectionLabel>Reaction Parameters</SectionLabel>
        <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "10px" }}>
          {[
            { label: "Temperature", value: `${params.temperature} °C` },
            { label: "Sim Time", value: `${params.simulationTime} min` },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>{item.label}</span>
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>{item.value}</span>
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
          overflowY: "auto",
          gap: "16px",
        }}
      >
        {/* CSV Upload + Fitting Mode Indicator */}
        <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "12px" }}>
          <SectionLabel>Data Source</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "var(--nb-radius-sm)",
                border: `1px solid ${INPUT_BORDER}`,
                background: INPUT_BG,
                color: VALUE,
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
            >
              <span>Upload CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={onCsvUpload}
                style={{ display: "none" }}
                aria-label="Upload CSV file for fitting"
              />
            </label>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: "999px",
                background: userData ? `rgba(${SEMANTIC_RGB.warn}, 0.15)` : "rgba(255,255,255,0.06)",
                color: userData ? `rgba(${SEMANTIC_RGB.warn}, 0.92)` : VALUE,
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                border: userData ? `1px solid rgba(${SEMANTIC_RGB.warn}, 0.3)` : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {userData ? "User Data" : "Demo"}
            </span>
            {userData && (
              <button
                onClick={onClearUserData}
                style={{
                  padding: "4px 10px",
                  borderRadius: "var(--nb-radius-sm)",
                  border: `1px solid ${INPUT_BORDER}`,
                  background: "transparent",
                  color: LABEL,
                  fontFamily: THEME.SANS,
                  fontSize: "var(--nb-fs-xs)",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}
          </div>
          {userData && (
            <p
              style={{
                margin: "8px 0 0",
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
                color: `rgba(${SEMANTIC_RGB.warn}, 0.85)`,
                lineHeight: 1.5,
              }}
            >
              Partial — user data not independently validated. Fitting uses your uploaded {userData.length}-point
              dataset. CSV format: header row + columns (time, fluorescence, concentration). 2-column CSV accepted but
              requires concentration for Michaelis-Menten fitting.
            </p>
          )}
          {!userData && (
            <p
              style={{
                margin: "8px 0 0",
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
                color: LABEL,
                lineHeight: 1.5,
              }}
            >
              Using built-in demo plate reader data. Upload a CSV (columns: time, fluorescence) to fit your own data.
            </p>
          )}
        </div>
        {/* BRENDA Kinetics Lookup */}
        <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <SectionLabel>BRENDA Reference Kinetics</SectionLabel>
            <DataSourceBadge source={brendaSource} />
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input
              value={brendaEcInput}
              onChange={(e) => onBrendaEcInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onBrendaLookup();
              }}
              placeholder="EC number (e.g. 2.7.1.1)"
              style={{
                flex: 1,
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                color: INPUT_TEXT,
                background: INPUT_BG,
                border: `1px solid ${INPUT_BORDER}`,
                borderRadius: 6,
                padding: "5px 8px",
                outline: "none",
              }}
            />
            <button
              onClick={onBrendaLookup}
              disabled={brendaLoading}
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
                color: VALUE,
                background: "rgba(175,195,214,0.12)",
                border: `1px solid ${INPUT_BORDER}`,
                borderRadius: 6,
                padding: "5px 10px",
                cursor: brendaLoading ? "wait" : "pointer",
                opacity: brendaLoading ? 0.6 : 1,
              }}
            >
              {brendaLoading ? "..." : "Fetch"}
            </button>
          </div>
          {brendaData && brendaData.km.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              {brendaData.km.map((k, i) => (
                <div key={`km-${i}`} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
                    Km ({k.substrate})
                  </span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                    {k.value} {k.unit}
                  </span>
                </div>
              ))}
              {brendaData.kcat.map((k, i) => (
                <div key={`kcat-${i}`} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
                    Vmax ({k.substrate})
                  </span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                    {k.value} {k.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
          {brendaData && brendaData.km.length === 0 && (
            <p style={{ margin: 0, fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, opacity: 0.7 }}>
              No kinetics data found for {brendaData.ecNumber}
            </p>
          )}
          {!brendaData && (
            <p style={{ margin: 0, fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, opacity: 0.6 }}>
              Search an EC number to compare BRENDA reference Km/Vmax against your fitted parameters.
            </p>
          )}
          {brendaData && (brendaData.km.length > 0 || brendaData.kcat.length > 0) && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button
                onClick={onApplyBrenda}
                disabled={brendaApplied}
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: "var(--nb-fs-xs)",
                  color: brendaApplied ? LABEL : VALUE,
                  background: brendaApplied ? "transparent" : "rgba(74, 222, 128, 0.12)",
                  border: `1px solid ${brendaApplied ? INPUT_BORDER : "rgba(74, 222, 128, 0.3)"}`,
                  borderRadius: 6,
                  padding: "5px 10px",
                  cursor: brendaApplied ? "default" : "pointer",
                  opacity: brendaApplied ? 0.6 : 1,
                }}
              >
                {brendaApplied ? "Applied" : "Apply to Model"}
              </button>
              {brendaApplied && (
                <button
                  onClick={onClearBrenda}
                  style={{
                    fontFamily: THEME.SANS,
                    fontSize: "var(--nb-fs-xs)",
                    color: LABEL,
                    background: "transparent",
                    border: `1px solid ${INPUT_BORDER}`,
                    borderRadius: 6,
                    padding: "5px 10px",
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
          {brendaApplied && params.brendaKm !== undefined && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: 8 }}>
              <DataSourceBadge source={brendaSource} label="BRENDA Km" />
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                {params.brendaKm} mM → K<sub>tl</sub>
              </span>
            </div>
          )}
          {brendaApplied && params.brendaKcat !== undefined && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: 4 }}>
              <DataSourceBadge source={brendaSource} label="BRENDA Kcat" />
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                {params.brendaKcat} 1/s → k<sub>tl</sub>
              </span>
            </div>
          )}
        </div>
        <ScientificFigureFrame
          eyebrow="Plate fitting"
          title="Parameter-fit quality for cell-free readout"
          caption="Fitting is presented as evidence for how trustworthy the cell-free readout is."
          legend={[{ label: "R²", value: fit ? fit.r_squared.toFixed(4) : "—", accent: THEME.MINT }]}
          minHeight="300px"
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 0" }}>
            <div style={{ width: "100%", maxWidth: "600px" }}>
              <FittingChart result={result} />
            </div>
          </div>
        </ScientificFigureFrame>
        {fit && (
          <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "12px" }}>
            <SectionLabel>Fitting Results</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Vmax</span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                    {fit.vmax.toFixed(3)}
                  </span>
                  {brendaApplied && params.brendaKcat !== undefined && (
                    <DataSourceBadge source={brendaSource} label="BRENDA" />
                  )}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Kd</span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                    {fit.kd.toFixed(3)}
                  </span>
                  {brendaApplied && params.brendaKm !== undefined && (
                    <DataSourceBadge source={brendaSource} label="BRENDA" />
                  )}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>R²</span>
                <span
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: "var(--nb-fs-xs)",
                    color: `rgba(${SEMANTIC_RGB.pass}, 0.92)`,
                  }}
                >
                  {fit.r_squared.toFixed(4)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Vmax CI</span>
                <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
                  [{fit.vmax_ci[0].toFixed(2)}, {fit.vmax_ci[1].toFixed(2)}]
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Kd CI</span>
                <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
                  [{fit.kd_ci[0].toFixed(2)}, {fit.kd_ci[1].toFixed(2)}]
                </span>
              </div>
            </div>
            {brendaApplied && (
              <div
                style={{
                  marginTop: 8,
                  padding: "6px 8px",
                  borderRadius: "var(--nb-radius-sm)",
                  border: "1px solid rgba(74, 222, 128, 0.2)",
                  background: "rgba(74, 222, 128, 0.06)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontFamily: THEME.SANS,
                    fontSize: "var(--nb-fs-xxs)",
                    color: "rgba(74, 222, 128, 0.85)",
                    lineHeight: 1.5,
                  }}
                >
                  BRENDA constants seeded the LM optimizer initial guesses.
                  {params.brendaKm !== undefined && ` Km=${params.brendaKm} mM → Kd.`}
                  {params.brendaKcat !== undefined && ` Kcat=${params.brendaKcat} 1/s → Vmax.`}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Calibrate Tab Content ────────────────────────────────────────── */

interface CalibrateTabContentProps {
  userData: PlateReaderDataPoint[] | null;
  calibrationResult: CalibrationResult | null;
  calibrationLoading: boolean;
  onCalibrate: () => void;
}

export function CalibrateTabContent({
  userData,
  calibrationResult,
  calibrationLoading,
  onCalibrate,
}: CalibrateTabContentProps) {
  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <FloatingControlRail label="MCMC Config" defaultCollapsed={false}>
        <SectionLabel>Model</SectionLabel>
        <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "10px", marginBottom: "16px" }}>
          <p style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: LABEL, margin: 0, lineHeight: 1.5 }}>
            protein(t) = (k_tx · k_tl / d_mRNA) · (1 - exp(-d_mRNA · t))
          </p>
        </div>
        <SectionLabel>Prior Ranges</SectionLabel>
        <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "10px", marginBottom: "16px" }}>
          {[
            { label: "k_tx", range: "[0.01, 5]" },
            { label: "k_tl", range: "[0.1, 20]" },
            { label: "d_mRNA", range: "[0.001, 0.5]" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>{item.label}</span>
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>{item.range}</span>
            </div>
          ))}
        </div>
        <SectionLabel>Sampler</SectionLabel>
        <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "10px" }}>
          {[
            { label: "Samples", value: "200" },
            { label: "Burn-in", value: "50" },
            { label: "Algorithm", value: "Metropolis-Hastings" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>{item.label}</span>
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>{item.value}</span>
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
          overflowY: "auto",
          gap: "16px",
        }}
      >
        <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "12px" }}>
          <SectionLabel>Data Source</SectionLabel>
          <p style={{ margin: 0, fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, lineHeight: 1.5 }}>
            {userData
              ? `Calibrating against uploaded plate reader data (${Array.from(new Set(userData.map((d) => d.time))).length} timepoints).`
              : "Using built-in demo timecourse. Upload a CSV in the Fitting tab to calibrate against your own data."}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={onCalibrate}
            disabled={calibrationLoading}
            style={{
              padding: "8px 20px",
              borderRadius: "var(--nb-radius-sm)",
              border: `1px solid ${INPUT_BORDER}`,
              background: calibrationLoading ? "transparent" : "rgba(74, 222, 128, 0.12)",
              color: calibrationLoading ? LABEL : VALUE,
              fontFamily: THEME.SANS,
              fontSize: "var(--nb-fs-sm)",
              fontWeight: 600,
              cursor: calibrationLoading ? "wait" : "pointer",
              opacity: calibrationLoading ? 0.6 : 1,
              transition: "all 0.15s",
            }}
          >
            {calibrationLoading ? "Running MCMC..." : "Run Calibration"}
          </button>
          {calibrationResult && (
            <span
              style={{
                padding: "3px 10px",
                borderRadius: "999px",
                background: calibrationResult.converged
                  ? `rgba(${SEMANTIC_RGB.pass}, 0.15)`
                  : `rgba(${SEMANTIC_RGB.warn}, 0.15)`,
                color: calibrationResult.converged
                  ? `rgba(${SEMANTIC_RGB.pass}, 0.92)`
                  : `rgba(${SEMANTIC_RGB.warn}, 0.92)`,
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                border: `1px solid ${calibrationResult.converged ? `rgba(${SEMANTIC_RGB.pass}, 0.3)` : `rgba(${SEMANTIC_RGB.warn}, 0.3)`}`,
              }}
            >
              {calibrationResult.converged ? "Converged" : "Not converged"}
            </span>
          )}
        </div>
        {calibrationResult && (
          <>
            <ScientificFigureFrame
              eyebrow="Posterior distributions"
              title="MCMC parameter posteriors"
              caption="Posterior mean and standard deviation for each TX-TL parameter estimated via Metropolis-Hastings sampling."
              legend={[
                {
                  label: "Samples",
                  value: `${Object.values(calibrationResult.samples)[0]?.length ?? 0}`,
                  accent: THEME.MINT,
                },
                {
                  label: "Acceptance",
                  value: `${((typeof calibrationResult.acceptanceRate === "number" ? calibrationResult.acceptanceRate : 0) * 100).toFixed(1)}%`,
                  accent: THEME.SKY,
                },
              ]}
              minHeight="280px"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "8px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontFamily: THEME.SANS,
                      fontSize: "var(--nb-fs-xs)",
                      color: LABEL,
                      width: "100px",
                      flexShrink: 0,
                    }}
                  >
                    Acceptance
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: "8px",
                      borderRadius: "4px",
                      background: PAPER_THEME.bgAlt,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${(typeof calibrationResult.acceptanceRate === "number" ? calibrationResult.acceptanceRate : 0) * 100}%`,
                        height: "100%",
                        borderRadius: "4px",
                        background: THEME.MINT,
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xs)",
                      color: VALUE,
                      width: "40px",
                      textAlign: "right",
                    }}
                  >
                    {(
                      (typeof calibrationResult.acceptanceRate === "number" ? calibrationResult.acceptanceRate : 0) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
                {Object.keys(calibrationResult.posteriorMean).map((param) => {
                  const mu = calibrationResult.posteriorMean[param];
                  const sigma = calibrationResult.posteriorStd[param];
                  const ci = calibrationResult.credibleInterval[param];
                  const [lo, hi] = [ci[0], ci[1]];
                  const priorMin = { k_tx: 0.01, k_tl: 0.1, d_mRNA: 0.001 }[param] ?? 0;
                  const priorMax = { k_tx: 5, k_tl: 20, d_mRNA: 0.5 }[param] ?? 1;
                  const priorRange = priorMax - priorMin;
                  const normalizedMean = (mu - priorMin) / priorRange;
                  const normalizedLo = (lo - priorMin) / priorRange;
                  const normalizedHi = (hi - priorMin) / priorRange;
                  return (
                    <div key={param} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span
                          style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", fontWeight: 600, color: VALUE }}
                        >
                          {param}
                        </span>
                        <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                          {mu.toFixed(4)} ± {sigma.toFixed(4)}
                        </span>
                      </div>
                      <div style={{ position: "relative", height: "20px" }}>
                        <div
                          style={{
                            position: "absolute",
                            top: "4px",
                            left: `${normalizedLo * 100}%`,
                            width: `${Math.max(2, (normalizedHi - normalizedLo) * 100)}%`,
                            height: "12px",
                            borderRadius: "3px",
                            background: `${THEME.MINT}30`,
                            border: `1px solid ${THEME.MINT}60`,
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            top: "0",
                            left: `calc(${Math.min(99, Math.max(1, normalizedMean)) * 100}% - 3px)`,
                            width: "6px",
                            height: "20px",
                            borderRadius: "3px",
                            background: THEME.MINT,
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>
                          95% CI: [{lo.toFixed(4)}, {hi.toFixed(4)}]
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScientificFigureFrame>

            <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "12px" }}>
              <SectionLabel>Credible Intervals</SectionLabel>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {["Parameter", "Mean", "Std", "2.5%", "97.5%", "Status"].map((h) => (
                      <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: LABEL, fontWeight: 500 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(calibrationResult.posteriorMean).map((param) => {
                    const mu = calibrationResult.posteriorMean[param];
                    const sigma = calibrationResult.posteriorStd[param];
                    const ci = calibrationResult.credibleInterval[param];
                    const [lo, hi] = [ci[0], ci[1]];
                    const priorMin = { k_tx: 0.01, k_tl: 0.1, d_mRNA: 0.001 }[param] ?? 0;
                    const priorMax = { k_tx: 5, k_tl: 20, d_mRNA: 0.5 }[param] ?? 1;
                    const tight = sigma < 0.3 * (priorMax - priorMin);
                    return (
                      <tr key={param} style={{ borderBottom: `1px solid ${BORDER}40` }}>
                        <td style={{ padding: "6px 8px", color: VALUE, fontWeight: 600 }}>{param}</td>
                        <td style={{ padding: "6px 8px", color: VALUE }}>{mu.toFixed(4)}</td>
                        <td style={{ padding: "6px 8px", color: VALUE }}>{sigma.toFixed(4)}</td>
                        <td style={{ padding: "6px 8px", color: LABEL }}>{lo.toFixed(4)}</td>
                        <td style={{ padding: "6px 8px", color: LABEL }}>{hi.toFixed(4)}</td>
                        <td style={{ padding: "6px 8px" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "999px",
                              background: tight
                                ? `rgba(${SEMANTIC_RGB.pass}, 0.15)`
                                : `rgba(${SEMANTIC_RGB.warn}, 0.15)`,
                              color: tight ? `rgba(${SEMANTIC_RGB.pass}, 0.92)` : `rgba(${SEMANTIC_RGB.warn}, 0.92)`,
                              fontSize: "var(--nb-fs-xxs)",
                            }}
                          >
                            {tight ? "Tight" : "Wide"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              style={{
                ...GLASS,
                borderRadius: "var(--nb-radius-md)",
                padding: "12px",
                border: `1px solid ${calibrationResult.converged ? `rgba(${SEMANTIC_RGB.pass}, 0.3)` : `rgba(${SEMANTIC_RGB.warn}, 0.3)`}`,
              }}
            >
              <SectionLabel>Convergence Summary</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
                    Acceptance Rate
                  </span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                    {(
                      (typeof calibrationResult.acceptanceRate === "number" ? calibrationResult.acceptanceRate : 0) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Converged</span>
                  <span
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xs)",
                      color: calibrationResult.converged
                        ? `rgba(${SEMANTIC_RGB.pass}, 0.92)`
                        : `rgba(${SEMANTIC_RGB.warn}, 0.92)`,
                    }}
                  >
                    {calibrationResult.converged ? "Yes" : "No"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
                    Total Samples
                  </span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                    {Object.values(calibrationResult.samples)[0]?.length ?? 0}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Parameters</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                    {Object.keys(calibrationResult.posteriorMean).length}
                  </span>
                </div>
              </div>
              <p
                style={{
                  margin: "10px 0 0",
                  fontFamily: THEME.SANS,
                  fontSize: "var(--nb-fs-xs)",
                  color: LABEL,
                  lineHeight: 1.5,
                }}
              >
                {calibrationResult.converged
                  ? "All posterior standard deviations are below 30% of their prior range widths. Parameter estimates are reasonably constrained."
                  : "Some posterior standard deviations exceed 30% of prior range widths. Consider running more samples or narrowing priors."}
              </p>
            </div>
          </>
        )}
        {!calibrationResult && !calibrationLoading && (
          <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "20px", textAlign: "center" }}>
            <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-sm)", color: LABEL, margin: 0 }}>
              Click &quot;Run Calibration&quot; to estimate TX-TL parameters via Metropolis-Hastings MCMC.
            </p>
            <p
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
                color: LABEL,
                margin: "8px 0 0",
                opacity: 0.7,
              }}
            >
              The sampler fits k_tx, k_tl, and d_mRNA to observed protein expression timecourses.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── IVIV Tab Content ─────────────────────────────────────────────── */

interface IvIvTabContentProps {
  result: CFSFullResult;
  constructs: GeneConstruct[];
  iviv: CFSFullResult["iviv"];
}

export function IvIvTabContent({ result, constructs, iviv }: IvIvTabContentProps) {
  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <FloatingControlRail label="Parameters" defaultCollapsed={true}>
        <SectionLabel>Gene Constructs</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {constructs.map((g, i) => (
            <div key={g.id} style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
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
          overflowY: "auto",
          gap: "16px",
        }}
      >
        <ScientificFigureFrame
          eyebrow="Translation bridge"
          title="In-vitro to in-vivo translation estimate"
          caption="Estimated in-vivo expression, heuristic confidence, and rationale — parameter limits stay legible."
          legend={[
            { label: "Confidence", value: iviv ? `${(iviv.confidence * 100).toFixed(0)}%` : "—", accent: THEME.LILAC },
            { label: "Estimate", value: iviv ? "Heuristic" : "—", accent: THEME.MINT },
          ]}
          minHeight="300px"
        >
          <div style={{ display: "flex", flexDirection: "column", padding: "8px 0", gap: "16px" }}>
            <div style={{ width: "100%", maxWidth: "600px", margin: "0 auto" }}>
              <IvIvChart result={result} />
            </div>
            {iviv && (
              <div
                style={{
                  ...GLASS,
                  borderRadius: "var(--nb-radius-lg)",
                  padding: "14px 18px",
                  maxWidth: "600px",
                  margin: "0 auto",
                  width: "100%",
                }}
              >
                <p
                  style={{
                    fontFamily: THEME.SANS,
                    fontSize: "var(--nb-fs-xs)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: LABEL,
                    margin: "0 0 6px",
                  }}
                >
                  Reasoning
                </p>
                <p
                  style={{
                    fontFamily: THEME.SANS,
                    fontSize: "var(--nb-fs-sm)",
                    color: VALUE,
                    margin: 0,
                    lineHeight: 1.6,
                  }}
                >
                  {iviv.reasoning}
                </p>
              </div>
            )}
          </div>
        </ScientificFigureFrame>
        {iviv && (
          <>
            <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "12px" }}>
              <SectionLabel>IvIv Estimate</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
                    Expression Range
                  </span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                    {getIvivExpressionLabel(iviv.invivo_expression)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Fold Change</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                    {iviv.invivo_foldChange < 0.5
                      ? "Below median"
                      : iviv.invivo_foldChange < 2
                        ? "Near median"
                        : iviv.invivo_foldChange < 10
                          ? "Above median"
                          : "Well above median"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Confidence</span>
                  <span
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xs)",
                      color:
                        iviv.confidence > 0.7
                          ? `rgba(${SEMANTIC_RGB.pass}, 0.92)`
                          : iviv.confidence > 0.4
                            ? `rgba(${SEMANTIC_RGB.warn}, 0.9)`
                            : `rgba(${SEMANTIC_RGB.fail}, 0.9)`,
                    }}
                  >
                    {(iviv.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
                    Scaling Factor
                  </span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                    {iviv.scalingFactor < 1 ? "Reduced" : iviv.scalingFactor < 5 ? "Comparable" : "Amplified"}
                  </span>
                </div>
              </div>
            </div>
            <div
              style={{
                ...GLASS,
                borderRadius: "var(--nb-radius-md)",
                padding: "10px 12px",
                border: `1px solid rgba(${SEMANTIC_RGB.warn}, 0.3)`,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: THEME.SANS,
                  fontSize: "var(--nb-fs-xs)",
                  color: `rgba(${SEMANTIC_RGB.warn}, 0.9)`,
                  lineHeight: 1.5,
                }}
              >
                This is a heuristic estimate, not a trained model. Weights are deterministic (SeededRNG 12345) but not
                fitted to experimental data. Use qualitative ranges only.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
