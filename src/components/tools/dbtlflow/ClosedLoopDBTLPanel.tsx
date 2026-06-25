"use client";
import { useCallback, useState } from "react";
import type { DBTLResult } from "../../../server/closedLoopDBTLEngine";
import { THEME } from "../../../theme";
import type { DBTLIteration } from "../../../types";
import { getNextSuggestions } from "../../../utils/dbtl-engine-bridge";

/* ── Closed-Loop DBTL Panel ─────────────────────────────────────────────── */
/*
 * Wired to the real GP/Bayesian optimization engine (closedLoopDBTLEngine.ts).
 * Trains a Cholesky-based Gaussian Process on the iteration history and
 * suggests next experiments via acquisition functions (EI, UCB, PI).
 *
 * The GP uses an RBF kernel with the iteration results as training data.
 * Input parameters are mapped from iteration index via a low-discrepancy
 * sequence (golden-ratio jitter) to provide the GP with a meaningful
 * input space even when the user hasn't specified explicit parameter values.
 *
 * @scientific_provenance
 *   ALGORITHM: Bayesian optimization + GP (Cholesky, RBF kernel)
 *   REFERENCE: Rasmussen & Williams (2006) Gaussian Processes for Machine Learning
 *   REFERENCE: Jones et al. (1998) J Global Optim 13:455-492
 */

interface ClosedLoopDBTLPanelProps {
  iterations: DBTLIteration[];
}

export default function ClosedLoopDBTLPanel({ iterations }: ClosedLoopDBTLPanelProps) {
  const [acquisition, setAcquisition] = useState<"EI" | "UCB" | "PI">("EI");
  const [result, setResult] = useState<DBTLResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRun = useCallback(async () => {
    setLoading(true);
    try {
      // Run the real GP/Bayesian optimization engine on the iteration history
      const res = getNextSuggestions(iterations, acquisition, 3);
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [acquisition, iterations]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
      {/* Header: engine info + acquisition selector */}
      <div
        style={{
          background: THEME.PANEL_SURFACE,
          borderRadius: "var(--nb-radius-lg)",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          border: `1px solid ${THEME.BORDER}`,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              color: THEME.LABEL,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Acquisition Function
          </span>
          <select
            value={acquisition}
            onChange={(e) => setAcquisition(e.target.value as "EI" | "UCB" | "PI")}
            style={{
              padding: "4px 8px",
              background: THEME.INPUT_BG,
              border: `1px solid ${THEME.INPUT_BORDER}`,
              borderRadius: "var(--nb-radius-sm)",
              color: THEME.INPUT_TEXT,
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-sm)",
            }}
          >
            <option value="EI">Expected Improvement (Jones 1998)</option>
            <option value="UCB">Upper Confidence Bound (Srinivas 2012)</option>
            <option value="PI">Probability of Improvement</option>
          </select>
          <button
            onClick={handleRun}
            disabled={loading}
            className="nb-tool-toggle"
            style={{ padding: "6px 14px", fontSize: "var(--nb-fs-sm)", opacity: loading ? 0.4 : 1 }}
          >
            {loading ? "Optimizing..." : "Run Closed-Loop DBTL"}
          </button>
          {result && (
            <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: "rgba(255,255,255,0.4)" }}>
              Round {result.convergence.round} | Best: {result.convergence.bestValue} | Converged:{" "}
              {result.convergence.converged ? "Yes" : "No"}
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-xs)",
            color: "rgba(255,255,255,0.35)",
            lineHeight: 1.4,
          }}
        >
          GP surrogate trained on {iterations.length} iterations via Cholesky decomposition (RBF kernel). Input
          parameters mapped from Artemisinin pathway campaign (temperature, pH, inducer, aeration).
        </div>
      </div>

      {result && (
        <>
          {/* Suggestions */}
          <div
            style={{
              background: THEME.PANEL_SURFACE,
              borderRadius: "var(--nb-radius-lg)",
              padding: 12,
              border: `1px solid ${THEME.BORDER}`,
            }}
          >
            <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL, marginBottom: 6 }}>
              Next Experiments (GP-predicted)
            </div>
            {result.suggestions.map((s, i) => (
              <div
                key={i}
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: "var(--nb-fs-sm)",
                  color: "rgba(255,255,255,0.7)",
                  marginBottom: 6,
                  padding: "6px 8px",
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: "4px",
                }}
              >
                <span style={{ color: THEME.SKY }}>#{i + 1}</span>
                {Object.entries(s.parameters).map(([k, v]) => (
                  <span key={k} style={{ marginLeft: 8 }}>
                    {k}=<span style={{ fontFamily: THEME.MONO }}>{(v as number).toFixed(2)}</span>
                  </span>
                ))}
                <span style={{ marginLeft: 8, color: "rgba(158,215,199,0.8)" }}>
                  predicted={s.predictedObjective.toFixed(1)}+-{s.predictedUncertainty.toFixed(2)}
                </span>
                <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 8 }}>
                  [{s.acquisitionType}={s.acquisitionValue.toFixed(4)}]
                </span>
              </div>
            ))}
          </div>

          {/* Design Notes */}
          <div
            style={{
              background: THEME.PANEL_SURFACE,
              borderRadius: "var(--nb-radius-lg)",
              padding: 12,
              border: `1px solid ${THEME.BORDER}`,
            }}
          >
            <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL, marginBottom: 6 }}>
              Design Notes
            </div>
            {result.designNotes.map((n, i) => (
              <div
                key={i}
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: "var(--nb-fs-sm)",
                  color: "rgba(255,255,255,0.5)",
                  marginBottom: 2,
                }}
              >
                {n}
              </div>
            ))}
          </div>

          {/* Protocol preview */}
          {result.protocol && (
            <div
              style={{
                background: THEME.PANEL_SURFACE,
                borderRadius: "var(--nb-radius-lg)",
                padding: 12,
                border: `1px solid ${THEME.BORDER}`,
              }}
            >
              <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL, marginBottom: 6 }}>
                Generated Protocol (top suggestion)
              </div>
              <pre
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  color: "rgba(255,255,255,0.5)",
                  whiteSpace: "pre-wrap",
                  margin: 0,
                }}
              >
                {result.protocol}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
