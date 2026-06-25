"use client";
/**
 * CustomModelPanel.tsx — Upload and solve custom FBA models via CSV/TSV.
 * Extracted from FBASimPage.tsx for modularity.
 */

import React, { useCallback, useMemo, useState } from "react";
import type { FBAOutput } from "../../../data/mockFBA";
import { solveDynamicModelFBA } from "../../../services/FBAAuthorityClient";
import { THEME } from "../../../theme";
import type { ProvenanceEntry } from "../../../types/assumptions";
import MetricCard from "../../ide/shared/MetricCard";
import DataPreview from "../../shared/DataPreview";
import DataUpload from "../../shared/DataUpload";
import { ParamSlider } from "./CommunityPanels";

export default function CustomModelPanel() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [customGlucose, setCustomGlucose] = useState(10);
  const [customOxygen, setCustomOxygen] = useState(12);
  const [objectiveId, setObjectiveId] = useState("");
  const [customResult, setCustomResult] = useState<FBAOutput | null>(null);
  const [customProvenance, setCustomProvenance] = useState<ProvenanceEntry | undefined>(undefined);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const handleUpload = useCallback((data: Record<string, string>[], hdrs: string[]) => {
    setRows(data);
    setHeaders(hdrs);
    setUploadError(null);
    setCustomResult(null);
    // Auto-detect first reaction as objective
    if (data.length > 0) {
      const firstId = data[0]["reaction_id"] ?? data[0]["reaction id"] ?? data[0]["id"] ?? "";
      setObjectiveId(firstId);
    }
  }, []);

  const handleUploadError = useCallback((err: string) => {
    setUploadError(err);
  }, []);

  const parsedReactions = useMemo(() => {
    if (rows.length === 0) return [];
    return rows
      .map((row) => {
        const id = row["reaction_id"] ?? row["reaction id"] ?? row["id"] ?? "";
        const lb = parseFloat(row["lb"] ?? row["lower_bound"] ?? row["lower bound"] ?? "-1000");
        const ub = parseFloat(row["ub"] ?? row["upper_bound"] ?? row["upper bound"] ?? "1000");
        // Parse stoichiometry: "met1:1;met2:-1" or "met1:1,met2:-1"
        const stoichRaw = row["stoichiometry"] ?? row["stoich"] ?? "";
        const stoichiometry: Record<string, number> = {};
        if (stoichRaw) {
          const sep = stoichRaw.includes(";") ? ";" : ",";
          stoichRaw.split(sep).forEach((entry) => {
            const parts = entry.trim().split(":");
            if (parts.length === 2) {
              const met = parts[0].trim();
              const coeff = parseFloat(parts[1].trim());
              if (met && !isNaN(coeff)) {
                stoichiometry[met] = coeff;
              }
            }
          });
        }
        return { id, name: id, subsystem: "Custom", lb, ub, stoichiometry };
      })
      .filter((r) => r.id);
  }, [rows]);

  const handleRunCustomFBA = useCallback(async () => {
    if (parsedReactions.length === 0) return;
    setCustomLoading(true);
    setCustomError(null);
    const controller = new AbortController();
    try {
      const result = await solveDynamicModelFBA(
        {
          reactions: parsedReactions,
          objectiveId: objectiveId || parsedReactions[0].id,
          glucoseUptake: customGlucose,
          oxygenUptake: customOxygen,
        },
        controller.signal,
      );
      setCustomResult(result.result);
      setCustomProvenance(result.provenance);
    } catch (err) {
      if (!controller.signal.aborted) {
        setCustomError(err instanceof Error ? err.message : "Custom FBA solve failed");
      }
    } finally {
      setCustomLoading(false);
    }
  }, [parsedReactions, objectiveId, customGlucose, customOxygen]);

  const customTop5 = useMemo(() => {
    if (!customResult) return [];
    return parsedReactions
      .map((r) => ({ ...r, flux: customResult.fluxes[r.id] ?? 0 }))
      .sort((a, b) => Math.abs(b.flux) - Math.abs(a.flux))
      .slice(0, 5);
  }, [customResult, parsedReactions]);

  return (
    <div style={{ display: "flex", gap: "16px", flex: 1, minHeight: 0, overflow: "auto", padding: "12px" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Upload Section */}
        <div
          style={{
            padding: "12px",
            border: `1px solid ${THEME.BORDER}`,
            borderRadius: "var(--nb-radius-md)",
            background: THEME.PANEL_SURFACE,
          }}
        >
          <p
            style={{
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              color: THEME.LABEL,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: "0 0 8px",
            }}
          >
            Upload Custom FBA Model
          </p>
          <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: THEME.DIM, margin: "0 0 10px" }}>
            CSV/TSV with columns: <span style={{ fontFamily: THEME.MONO, color: THEME.LABEL }}>reaction_id</span>,{" "}
            <span style={{ fontFamily: THEME.MONO, color: THEME.LABEL }}>lb</span>,{" "}
            <span style={{ fontFamily: THEME.MONO, color: THEME.LABEL }}>ub</span>,{" "}
            <span style={{ fontFamily: THEME.MONO, color: THEME.LABEL }}>stoichiometry</span>
          </p>
          <DataUpload
            onUpload={handleUpload}
            onError={handleUploadError}
            label="Upload FBA Model CSV"
            accept=".csv,.tsv"
          />
          {uploadError && (
            <p style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.CORAL, margin: "8px 0 0" }}>
              {uploadError}
            </p>
          )}
        </div>

        {/* Data Preview */}
        {rows.length > 0 && (
          <div
            style={{
              padding: "12px",
              border: `1px solid ${THEME.BORDER}`,
              borderRadius: "var(--nb-radius-md)",
              background: THEME.PANEL_SURFACE,
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}
            >
              <p
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  color: THEME.LABEL,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  margin: 0,
                }}
              >
                Data Preview
              </p>
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: 10,
                  color: THEME.MINT,
                  background: "rgba(191,220,205,0.12)",
                  padding: "2px 6px",
                  borderRadius: 6,
                }}
              >
                {parsedReactions.length} reactions parsed
              </span>
            </div>
            <DataPreview headers={headers} rows={rows} maxRows={5} />
          </div>
        )}

        {/* Parameters + Run */}
        {rows.length > 0 && (
          <div
            style={{
              padding: "12px",
              border: `1px solid ${THEME.BORDER}`,
              borderRadius: "var(--nb-radius-md)",
              background: THEME.PANEL_SURFACE,
            }}
          >
            <p
              style={{
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                color: THEME.LABEL,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                margin: "0 0 8px",
              }}
            >
              FBA Parameters
            </p>
            <ParamSlider
              label="Glucose uptake"
              value={customGlucose}
              min={0}
              max={20}
              onChange={setCustomGlucose}
              unit="mmol/gDW/h"
            />
            <ParamSlider
              label="O₂ uptake"
              value={customOxygen}
              min={0}
              max={20}
              onChange={setCustomOxygen}
              unit="mmol/gDW/h"
            />
            <div style={{ marginTop: "8px" }}>
              <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: THEME.DIM, margin: "0 0 4px" }}>
                Objective Reaction
              </p>
              <select
                value={objectiveId}
                onChange={(e) => setObjectiveId(e.target.value)}
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
                {parsedReactions.map((r) => (
                  <option key={r.id} value={r.id} style={{ background: "#10131a" }}>
                    {r.id}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleRunCustomFBA}
              disabled={customLoading || parsedReactions.length === 0}
              style={{
                display: "block",
                width: "100%",
                marginTop: "12px",
                padding: "8px 14px",
                borderRadius: "var(--nb-radius-sm)",
                background: customLoading ? "rgba(255,255,255,0.04)" : "rgba(231,199,169,0.14)",
                border: `1px solid ${customLoading ? "rgba(255,255,255,0.08)" : "rgba(231,199,169,0.3)"}`,
                color: customLoading ? "rgba(255,255,255,0.35)" : "rgba(231,199,169,0.9)",
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-sm)",
                cursor: customLoading ? "wait" : "pointer",
              }}
            >
              {customLoading ? "Solving LP..." : "Run FBA"}
            </button>
            {customError && (
              <p style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.CORAL, margin: "8px 0 0" }}>
                {customError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Results Panel */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
        {customResult ? (
          <>
            <div
              style={{
                padding: "12px",
                border: `1px solid ${THEME.BORDER}`,
                borderRadius: "var(--nb-radius-md)",
                background: THEME.PANEL_SURFACE,
              }}
            >
              <p
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  color: THEME.LABEL,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  margin: "0 0 8px",
                }}
              >
                Custom Model Results
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <MetricCard label="Growth Rate (μ)" value={customResult.growthRate} unit="h⁻¹" highlight />
                <MetricCard label="ATP Yield" value={customResult.atpYield} unit="mol/mol glc" />
                <MetricCard label="NADH Production" value={customResult.nadhProduction} unit="mmol/gDW/h" />
                <MetricCard label="Carbon Efficiency" value={customResult.carbonEfficiency} unit="%" />
                <MetricCard label="Feasible" value={customResult.feasible ? "YES" : "NO"} />
              </div>
            </div>
            <div
              style={{
                padding: "12px",
                border: `1px solid ${THEME.BORDER}`,
                borderRadius: "var(--nb-radius-md)",
                background: THEME.PANEL_SURFACE,
              }}
            >
              <p
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  color: THEME.LABEL,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  margin: "0 0 8px",
                }}
              >
                Shadow Prices
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <MetricCard
                  label="∂μ/∂Glucose"
                  value={customResult.sensitivityCoefficients.glc.toFixed(4)}
                  unit="h⁻¹·gDW/mmol"
                />
                <MetricCard
                  label="∂μ/∂Oxygen"
                  value={customResult.sensitivityCoefficients.o2.toFixed(4)}
                  unit="h⁻¹·gDW/mmol"
                />
                <MetricCard
                  label="∂μ/∂ATP"
                  value={customResult.sensitivityCoefficients.atp.toFixed(4)}
                  unit="h⁻¹·gDW/mmol"
                />
              </div>
            </div>
            {customTop5.length > 0 && (
              <div
                style={{
                  padding: "12px",
                  border: `1px solid ${THEME.BORDER}`,
                  borderRadius: "var(--nb-radius-md)",
                  background: THEME.PANEL_SURFACE,
                }}
              >
                <p
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: "var(--nb-fs-xs)",
                    color: THEME.LABEL,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    margin: "0 0 8px",
                  }}
                >
                  Top 5 Active Reactions
                </p>
                {customTop5.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: "6px 8px",
                      marginBottom: "4px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: "var(--nb-radius-sm)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span
                        style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: "rgba(255,255,255,0.6)" }}
                      >
                        {r.id}
                      </span>
                      <span
                        style={{
                          fontFamily: THEME.MONO,
                          fontSize: "var(--nb-fs-xs)",
                          fontWeight: 600,
                          color: r.flux > 0 ? "rgba(20,140,80,0.9)" : "rgba(255,80,80,0.6)",
                        }}
                      >
                        {r.flux.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              textAlign: "center",
              color: "rgba(217,225,235,0.35)",
              fontFamily: THEME.SANS,
              fontSize: "var(--nb-fs-sm)",
              border: `1px solid ${THEME.BORDER}`,
              borderRadius: "var(--nb-radius-md)",
              background: THEME.PANEL_SURFACE,
            }}
          >
            Upload a CSV model file and click &quot;Run FBA&quot; to see results here.
          </div>
        )}
      </div>
    </div>
  );
}
