"use client";
import React, { useCallback, useState } from "react";
import { THEME } from "../../../theme";
import ConfidenceBadge from "../shared/ConfidenceBadge";

/* ── ML Predict Panel ───────────────────────────────────────────────────── */

export function MLPredictPanel() {
  const [sequence, setSequence] = useState("MKWVTFISLLFLFSSAYS");
  const [geneExpr, setGeneExpr] = useState("1.0,0.8,0.5,0.3");
  const [enzymeResult, setEnzymeResult] = useState<{ predictedEC: string; confidence: number } | null>(null);
  const [fluxResult, setFluxResult] = useState<{ predictedFluxes: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePredict = useCallback(async () => {
    setLoading(true);
    try {
      const { predictEnzymeFunction, predictFluxes } = await import("../../../server/mlMetabolicEngine");
      const enzResult = await predictEnzymeFunction(sequence);
      setEnzymeResult(enzResult);

      const expressions = geneExpr.split(",").reduce(
        (acc, v, i) => {
          acc[`gene_${i}`] = parseFloat(v.trim()) || 0;
          return acc;
        },
        {} as Record<string, number>,
      );
      const fluxRes = predictFluxes(expressions, ["biomass", "product", "co2"]);
      setFluxResult(fluxRes);
    } finally {
      setLoading(false);
    }
  }, [sequence, geneExpr]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
      <div
        style={{
          background: THEME.PANEL_SURFACE,
          borderRadius: "var(--nb-radius-lg)",
          padding: 16,
          border: `1px solid ${THEME.BORDER}`,
        }}
      >
        <div
          style={{
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
            color: THEME.LABEL,
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          ML Metabolic Predictor
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: "rgba(255,255,255,0.4)" }}>
              Protein Sequence
            </div>
            <input
              value={sequence}
              onChange={(e) => setSequence(e.target.value)}
              style={{
                width: "100%",
                padding: "4px 8px",
                background: THEME.INPUT_BG,
                border: `1px solid ${THEME.INPUT_BORDER}`,
                borderRadius: "var(--nb-radius-sm)",
                color: THEME.INPUT_TEXT,
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                outline: "none",
              }}
            />
          </div>
          <div>
            <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: "rgba(255,255,255,0.4)" }}>
              Gene Expression (csv)
            </div>
            <input
              value={geneExpr}
              onChange={(e) => setGeneExpr(e.target.value)}
              style={{
                width: 150,
                padding: "4px 8px",
                background: THEME.INPUT_BG,
                border: `1px solid ${THEME.INPUT_BORDER}`,
                borderRadius: "var(--nb-radius-sm)",
                color: THEME.INPUT_TEXT,
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                outline: "none",
              }}
            />
          </div>
        </div>
        <button
          onClick={handlePredict}
          disabled={loading}
          className="nb-tool-toggle"
          style={{ padding: "6px 14px", fontSize: "var(--nb-fs-sm)", opacity: loading ? 0.4 : 1 }}
        >
          {loading ? "Predicting..." : "Run ML Prediction"}
        </button>
      </div>

      {enzymeResult && (
        <div
          style={{
            background: THEME.PANEL_SURFACE,
            borderRadius: "var(--nb-radius-lg)",
            padding: 12,
            border: `1px solid ${THEME.BORDER}`,
          }}
        >
          <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL, marginBottom: 6 }}>
            Enzyme Function (PROSITE signatures + ESM-2)
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: THEME.LABEL }}>EC Class</div>
              <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-lg)", color: THEME.LILAC, fontWeight: 700 }}>
                {enzymeResult.predictedEC}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: THEME.LABEL }}>Confidence</div>
              <ConfidenceBadge value={enzymeResult.confidence} />
            </div>
          </div>
        </div>
      )}

      {fluxResult && (
        <div
          style={{
            background: THEME.PANEL_SURFACE,
            borderRadius: "var(--nb-radius-lg)",
            padding: 12,
            border: `1px solid ${THEME.BORDER}`,
          }}
        >
          <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL, marginBottom: 6 }}>
            Flux Prediction (Monod kinetics)
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {Object.entries(fluxResult.predictedFluxes).map(([rxn, flux]) => (
              <div key={rxn} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: THEME.LABEL }}>{rxn}</div>
                <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: THEME.APRICOT }}>
                  {(flux as number).toFixed(3)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
