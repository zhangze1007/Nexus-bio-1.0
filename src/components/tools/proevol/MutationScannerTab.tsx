"use client";

import { analyzeConservation, predictFitness, scanMutations } from "../../../services/ProEvolCampaignEngine";
import { THEME } from "../../../theme";
import DataSourceBadge from "../../ide/shared/DataSourceBadge";
import { PROEVOL_THEME } from "./shared";
import { kicker } from "./sharedComponents";
import type { ProEvolState } from "./useProEvolState";

export default function MutationScannerTab({ state }: { state: ProEvolState }) {
  const {
    scanSequence,
    setScanSequence,
    pdbText,
    setPdbText,
    pdbLoading,
    setPdbLoading,
    scanResult,
    setScanResult,
    conservationResult,
    setConservationResult,
    fitnessResult,
    setFitnessResult,
    setProevolError,
    campaign,
  } = state;

  return (
    <div style={{ padding: "16px", display: "grid", gap: "12px" }}>
      {/* Sequence Input */}
      <div
        style={{
          border: `1px solid ${PROEVOL_THEME.border}`,
          background: PROEVOL_THEME.surface,
          borderRadius: "var(--nb-radius-md)",
          padding: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={kicker}>Protein Sequence Input</span>
          <DataSourceBadge source={pdbText ? "live" : "mock"} label={pdbText ? "AlphaFold Live" : "AlphaFold"} />
        </div>
        <textarea
          placeholder="Paste protein sequence (one-letter amino acid codes)..."
          value={scanSequence}
          onChange={(e) => setScanSequence(e.target.value.toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, ""))}
          style={{
            width: "100%",
            height: 60,
            resize: "vertical",
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
            color: PROEVOL_THEME.value,
            background: PROEVOL_THEME.inset,
            border: `1px solid ${PROEVOL_THEME.border}`,
            borderRadius: "var(--nb-radius-sm)",
            padding: "8px",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={async () => {
              if (!scanSequence) return;
              setPdbLoading(true);
              try {
                // Try to fetch PDB from AlphaFold using target product as search
                const res = await fetch(`/api/alphafold?id=${campaign.targetProtein.substring(0, 6)}`);
                if (res.ok) {
                  const text = await res.text();
                  setPdbText(text);
                }
              } finally {
                setPdbLoading(false);
              }
            }}
            disabled={!scanSequence || pdbLoading}
            style={{
              padding: "6px 12px",
              borderRadius: "var(--nb-radius-sm)",
              background: pdbLoading ? "rgba(255,255,255,0.04)" : "rgba(175,195,214,0.12)",
              border: `1px solid ${pdbLoading ? "rgba(255,255,255,0.08)" : "rgba(175,195,214,0.25)"}`,
              color: pdbLoading ? "rgba(255,255,255,0.35)" : PROEVOL_THEME.sky,
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              cursor: "pointer",
            }}
          >
            {pdbLoading ? "Fetching…" : "Fetch PDB (optional)"}
          </button>
          <button
            onClick={() => {
              if (!scanSequence) return;
              try {
                // Conservation always works (no PDB needed)
                setConservationResult(analyzeConservation(scanSequence, pdbText ?? undefined));
                // ΔΔG scan needs PDB
                if (pdbText) {
                  const result = scanMutations(pdbText, scanSequence);
                  setScanResult(result);
                  const ddgMap = new Map<string, number>();
                  for (const r of result.results) ddgMap.set(`${r.position}:${r.mut}`, r.ddg);
                  const fitness = predictFitness({
                    sequence: scanSequence,
                    mutations: result.results.map((r) => ({ position: r.position, mut: r.mut })),
                    pdbText,
                    ddgResults: ddgMap,
                  });
                  setFitnessResult(fitness.predictions);
                } else {
                  // Fitness prediction without PDB (BLOSUM62 + conservation only)
                  const conserved = conservationResult?.conservedPositions ?? [];
                  const variable = conservationResult?.variablePositions ?? [];
                  const mutations = variable.slice(0, 20).flatMap((pos) => {
                    const wt = scanSequence[pos - 1];
                    return "ACDEFGHIKLMNPQRSTVWY"
                      .split("")
                      .filter((aa) => aa !== wt)
                      .slice(0, 3)
                      .map((aa) => ({ position: pos, mut: aa }));
                  });
                  const fitness = predictFitness({ sequence: scanSequence, mutations });
                  setFitnessResult(fitness.predictions);
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : "Mutation analysis failed";
                setProevolError(msg);
              }
            }}
            disabled={!scanSequence}
            style={{
              padding: "6px 12px",
              borderRadius: "var(--nb-radius-sm)",
              background: !scanSequence ? "rgba(255,255,255,0.04)" : "rgba(191,220,205,0.14)",
              border: `1px solid ${!scanSequence ? "rgba(255,255,255,0.08)" : "rgba(191,220,205,0.3)"}`,
              color: !scanSequence ? "rgba(255,255,255,0.35)" : PROEVOL_THEME.mint,
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              cursor: "pointer",
            }}
          >
            Run Analysis
          </button>
        </div>
      </div>

      {/* ΔΔG Heatmap */}
      {scanResult && (
        <div
          style={{
            border: `1px solid ${PROEVOL_THEME.border}`,
            background: PROEVOL_THEME.surface,
            borderRadius: "var(--nb-radius-md)",
            padding: "14px",
          }}
        >
          <span style={kicker}>ΔΔG Stability Heatmap</span>
          <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL, margin: "4px 0 8px" }}>
            {scanResult.results.length} mutations scanned · {scanResult.aminoAcids.length} amino acids ×{" "}
            {scanResult.heatmap.length} positions
          </p>
          {/* Simple text-based heatmap summary */}
          <div style={{ fontFamily: THEME.MONO, fontSize: 10, color: THEME.VALUE, maxHeight: 200, overflow: "auto" }}>
            {scanResult.heatmap.slice(0, 20).map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 2 }}>
                <span style={{ width: 20, color: THEME.LABEL }}>{i + 1}</span>
                {row.slice(0, 20).map((v, j) => (
                  <span
                    key={j}
                    style={{
                      width: 16,
                      textAlign: "center",
                      color: v > 1 ? "#dc2626" : v < -1 ? "#16a34a" : THEME.LABEL,
                      background: Math.abs(v) > 2 ? "rgba(255,255,255,0.05)" : "transparent",
                    }}
                  >
                    {v > 0 ? "+" : ""}
                    {v.toFixed(1)}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conservation Track */}
      {conservationResult &&
        (() => {
          const hasStructural = conservationResult.perPosition.some((p) => p.structuralImportance !== null);
          const maxStructImp = hasStructural
            ? Math.max(...conservationResult.perPosition.map((p) => p.structuralImportance ?? 0), 0.01)
            : 1;
          const doNotMutateSet = new Set(conservationResult.doNotMutatePositions);
          const funcSiteSet = new Set(conservationResult.functionalSitePositions);

          return (
            <div
              style={{
                border: `1px solid ${PROEVOL_THEME.border}`,
                background: PROEVOL_THEME.surface,
                borderRadius: "var(--nb-radius-md)",
                padding: "14px",
              }}
            >
              <span style={kicker}>Conservation Analysis</span>

              {/* Legend row */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 8,
                  marginBottom: 6,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span
                    style={{ width: 10, height: 10, borderRadius: 2, background: "#dc2626", display: "inline-block" }}
                  />
                  <span style={{ fontFamily: THEME.MONO, fontSize: 9, color: PROEVOL_THEME.label }}>Conserved</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span
                    style={{ width: 10, height: 10, borderRadius: 2, background: "#d97706", display: "inline-block" }}
                  />
                  <span style={{ fontFamily: THEME.MONO, fontSize: 9, color: PROEVOL_THEME.label }}>Moderate</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span
                    style={{ width: 10, height: 10, borderRadius: 2, background: "#2563eb", display: "inline-block" }}
                  />
                  <span style={{ fontFamily: THEME.MONO, fontSize: 9, color: PROEVOL_THEME.label }}>Variable</span>
                </span>
                {doNotMutateSet.size > 0 && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 11 }}>&#9888;</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 9, color: "#dc2626" }}>Do not mutate</span>
                  </span>
                )}
                {funcSiteSet.size > 0 && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 11 }}>&#9733;</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 9, color: PROEVOL_THEME.apricot }}>
                      Functional site
                    </span>
                  </span>
                )}
                {hasStructural && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: PROEVOL_THEME.sky,
                        display: "inline-block",
                        opacity: 0.7,
                      }}
                    />
                    <span style={{ fontFamily: THEME.MONO, fontSize: 9, color: PROEVOL_THEME.label }}>
                      Structural importance
                    </span>
                  </span>
                )}
              </div>

              {/* Conservation heatmap bar */}
              <div style={{ marginBottom: 4 }}>
                <span
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: 9,
                    color: PROEVOL_THEME.label,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Conservation
                </span>
              </div>
              <div style={{ display: "flex", gap: 1, flexWrap: "wrap", marginBottom: 8 }}>
                {conservationResult.perPosition.slice(0, 100).map((p, i) => {
                  const bg =
                    p.classification === "conserved"
                      ? "#dc2626"
                      : p.classification === "moderate"
                        ? "#d97706"
                        : "#2563eb";
                  const intensity = 0.35 + p.conservation * 0.65;
                  const isFuncSite = funcSiteSet.has(p.position);
                  const isDnm = doNotMutateSet.has(p.position);
                  return (
                    <div
                      key={i}
                      style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}
                    >
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 2,
                          background: bg,
                          opacity: intensity,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 7,
                          color: "#fff",
                          fontFamily: THEME.MONO,
                          border: isDnm
                            ? "1.5px solid #dc2626"
                            : isFuncSite
                              ? "1.5px solid #d97706"
                              : "1px solid transparent",
                        }}
                        title={`${p.position}: ${p.residue} (${p.classification}, C=${p.conservation.toFixed(2)}${p.structuralImportance !== null ? `, SI=${p.structuralImportance.toFixed(2)}` : ""}${p.functionalSiteWarning ? `, ${p.functionalSiteWarning}` : ""})`}
                      >
                        {p.residue}
                      </div>
                      {isDnm && (
                        <span style={{ fontSize: 7, lineHeight: 1, color: "#dc2626", marginTop: -1 }}>&#9888;</span>
                      )}
                      {isFuncSite && !isDnm && (
                        <span style={{ fontSize: 7, lineHeight: 1, color: "#d97706", marginTop: -1 }}>&#9733;</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Structural importance bar (only when PDB data is available) */}
              {hasStructural && (
                <>
                  <div style={{ marginBottom: 4 }}>
                    <span
                      style={{
                        fontFamily: THEME.MONO,
                        fontSize: 9,
                        color: PROEVOL_THEME.label,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      Structural Importance
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 1, flexWrap: "wrap", marginBottom: 8 }}>
                    {conservationResult.perPosition.slice(0, 100).map((p, i) => {
                      const si = p.structuralImportance ?? 0;
                      const barHeight = Math.max(2, (si / maxStructImp) * 20);
                      const isDnm = doNotMutateSet.has(p.position);
                      return (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "flex-end",
                          }}
                        >
                          <div
                            style={{
                              width: 14,
                              height: barHeight,
                              borderRadius: 2,
                              background: isDnm ? "#dc2626" : PROEVOL_THEME.sky,
                              opacity: 0.5 + (si / maxStructImp) * 0.5,
                            }}
                            title={`Pos ${p.position}: SI=${si.toFixed(3)}${p.normalizedSASA !== null ? `, SASA=${p.normalizedSASA.toFixed(2)}` : ""}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Summary stats */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                <span style={{ fontFamily: THEME.MONO, fontSize: 10, color: "#dc2626" }}>
                  Conserved: {conservationResult.conservedPositions.length}
                </span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 10, color: "#d97706" }}>
                  Moderate: {conservationResult.perPosition.filter((p) => p.classification === "moderate").length}
                </span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 10, color: "#2563eb" }}>
                  Variable: {conservationResult.variablePositions.length}
                </span>
                {doNotMutateSet.size > 0 && (
                  <span style={{ fontFamily: THEME.MONO, fontSize: 10, color: "#dc2626" }}>
                    &#9888; Do not mutate: {doNotMutateSet.size}
                  </span>
                )}
                {funcSiteSet.size > 0 && (
                  <span style={{ fontFamily: THEME.MONO, fontSize: 10, color: PROEVOL_THEME.apricot }}>
                    &#9733; Functional sites: {funcSiteSet.size}
                  </span>
                )}
              </div>

              {/* Functional site warnings (expandable list) */}
              {funcSiteSet.size > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "6px 8px",
                    borderRadius: "var(--nb-radius-sm)",
                    background: "rgba(232,220,200,0.06)",
                    border: `1px solid ${PROEVOL_THEME.apricot}33`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: 9,
                      color: PROEVOL_THEME.apricot,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    Functional Site Warnings
                  </span>
                  <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {conservationResult.perPosition
                      .filter((p) => p.functionalSiteWarning)
                      .slice(0, 20)
                      .map((p, i) => (
                        <span
                          key={i}
                          style={{
                            fontFamily: THEME.MONO,
                            fontSize: 9,
                            color: PROEVOL_THEME.value,
                            padding: "2px 6px",
                            borderRadius: "var(--nb-radius-sm)",
                            background: "rgba(232,220,200,0.08)",
                          }}
                        >
                          {p.residue}
                          {p.position}: {p.functionalSiteWarning}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      {/* Fitness Predictions Summary */}
      {fitnessResult && fitnessResult.length > 0 && (
        <div
          style={{
            border: `1px solid ${PROEVOL_THEME.border}`,
            background: PROEVOL_THEME.surface,
            borderRadius: "var(--nb-radius-md)",
            padding: "14px",
          }}
        >
          <span style={kicker}>Fitness Predictions (Top 20)</span>
          <div style={{ marginTop: 8, fontFamily: THEME.MONO, fontSize: 10 }}>
            {fitnessResult.slice(0, 20).map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "2px 0" }}>
                <span style={{ width: 40, color: THEME.LABEL }}>
                  {f.wt}
                  {f.position}
                  {f.mut}
                </span>
                <span
                  style={{
                    width: 50,
                    color: f.fitnessScore > 0.7 ? "#16a34a" : f.fitnessScore < 0.4 ? "#dc2626" : THEME.VALUE,
                  }}
                >
                  {f.fitnessScore.toFixed(3)}
                </span>
                <span
                  style={{
                    padding: "0 4px",
                    borderRadius: 3,
                    fontSize: 9,
                    background:
                      f.classification === "beneficial"
                        ? "rgba(22,163,74,0.15)"
                        : f.classification === "deleterious"
                          ? "rgba(220,38,38,0.15)"
                          : "rgba(255,255,255,0.05)",
                    color:
                      f.classification === "beneficial"
                        ? "#16a34a"
                        : f.classification === "deleterious"
                          ? "#dc2626"
                          : THEME.LABEL,
                  }}
                >
                  {f.classification}
                </span>
                <span style={{ color: THEME.LABEL, fontSize: 9 }}>
                  B:{f.components.blosum.toFixed(2)} S:{f.components.stability.toFixed(2)} E:
                  {f.components.structural.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
