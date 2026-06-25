"use client";

import { THEME } from "../../../theme";
import { PROEVOL_THEME, StatusPill, tableCellStyle, tableHeaderStyle } from "./shared";
import { BOImprovementChart, CompactMetric, kicker } from "./sharedComponents";
import type { ProEvolState } from "./useProEvolState";

export default function MLGuidedTab({ state }: { state: ProEvolState }) {
  const {
    mlMode,
    setMlMode,
    gpPredictions,
    suggestedVariantId,
    setSelectedVariantId,
    gpError,
    mlVariants,
    gpTableRows,
    runGPAnalysis,
    boResult,
    boRunning,
    boError,
    boAcqType,
    setBoAcqType,
    boRounds,
    setBoRounds,
    boBatchSize,
    setBoBatchSize,
    runBOSimulation,
  } = state;
  return (
    <div style={{ padding: "16px", display: "grid", gap: "12px" }}>
      {/* Toggle header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          padding: "10px 12px",
          borderRadius: "var(--nb-radius-md)",
          border: `1px solid ${PROEVOL_THEME.border}`,
          background: PROEVOL_THEME.surface,
        }}
      >
        <span style={kicker}>ML-Guided Prediction</span>
        <button
          type="button"
          onClick={() => setMlMode(!mlMode)}
          style={{
            padding: "6px 14px",
            borderRadius: "999px",
            background: mlMode ? "rgba(147,203,82,0.15)" : "rgba(191,220,205,0.08)",
            color: mlMode ? "#93CB52" : PROEVOL_THEME.mint,
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: "pointer",
            border: `1px solid ${mlMode ? "#93CB52" : PROEVOL_THEME.mint}44`,
          }}
        >
          {mlMode ? "GP Active" : "Enable GP"}
        </button>
        <button
          type="button"
          onClick={runGPAnalysis}
          disabled={!mlMode}
          style={{
            padding: "6px 14px",
            borderRadius: "999px",
            background: mlMode ? "rgba(81,81,205,0.15)" : "rgba(255,255,255,0.03)",
            color: mlMode ? PROEVOL_THEME.sky : PROEVOL_THEME.muted,
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: mlMode ? "pointer" : "default",
            border: `1px solid ${mlMode ? PROEVOL_THEME.sky : PROEVOL_THEME.border}44`,
            opacity: mlMode ? 1 : 0.5,
          }}
        >
          Refresh GP
        </button>
        {mlMode && suggestedVariantId && (
          <button
            type="button"
            onClick={() => setSelectedVariantId(suggestedVariantId)}
            style={{
              padding: "6px 14px",
              borderRadius: "999px",
              background: "rgba(232,220,200,0.12)",
              color: PROEVOL_THEME.apricot,
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              border: `1px solid ${PROEVOL_THEME.apricot}44`,
              marginLeft: "auto",
            }}
          >
            Suggest Next: {suggestedVariantId}
          </button>
        )}
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
            color: PROEVOL_THEME.muted,
          }}
        >
          RBF kernel, lengthScale=10, signalVar=1, noiseVar=0.1
        </span>
      </div>
      {gpError && (
        <div
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-sm)",
            color: PROEVOL_THEME.coral,
            padding: "6px 10px",
            borderRadius: "var(--nb-radius-sm)",
            background: "rgba(232,163,161,0.08)",
            border: `1px solid ${PROEVOL_THEME.coral}33`,
            lineHeight: 1.5,
          }}
        >
          GP analysis failed: {gpError}
        </div>
      )}
      {/* Feature encoding info */}
      {mlMode && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "var(--nb-radius-md)",
            border: `1px solid ${PROEVOL_THEME.border}`,
            background: PROEVOL_THEME.surface,
          }}
        >
          <div style={kicker}>Feature Encoding</div>
          <div
            style={{
              fontFamily: THEME.SANS,
              fontSize: "var(--nb-fs-sm)",
              color: PROEVOL_THEME.muted,
              lineHeight: 1.5,
              marginTop: "4px",
            }}
          >
            Each variant is encoded as a 5-dimensional feature vector:
            <code
              style={{
                fontFamily: THEME.MONO,
                color: PROEVOL_THEME.sky,
                fontSize: "var(--nb-fs-xs)",
                marginLeft: "4px",
              }}
            >
              [activity, stability, expression, specificity, mutationBurden]
            </code>
            . The GP is trained on composite fitness scores from {mlVariants.length} variants. Expected Improvement (EI)
            acquisition suggests the next variant to explore.
          </div>
        </div>
      )}
      {/* GP predictions with uncertainty */}
      {mlMode && gpPredictions.length > 0 && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "var(--nb-radius-md)",
            border: `1px solid ${PROEVOL_THEME.border}`,
            background: PROEVOL_THEME.surface,
          }}
        >
          <div style={kicker}>GP Fitness Predictions with Uncertainty</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "8px",
              marginTop: "8px",
            }}
          >
            {gpTableRows.slice(0, 12).map((row) => (
              <div
                key={row.id}
                style={{
                  padding: "8px 10px",
                  borderRadius: "var(--nb-radius-sm)",
                  border: `1px solid ${row.suggested ? PROEVOL_THEME.apricot : row.selected ? PROEVOL_THEME.mint : PROEVOL_THEME.border}${row.suggested ? "" : "66"}`,
                  background: row.suggested ? "rgba(232,220,200,0.08)" : "rgba(255,255,255,0.02)",
                  display: "grid",
                  gap: "3px",
                }}
              >
                <div
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: "var(--nb-fs-xs)",
                    color: row.suggested ? PROEVOL_THEME.apricot : PROEVOL_THEME.label,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.name} {row.suggested ? "(suggested)" : ""}
                </div>
                <div
                  style={{
                    fontFamily: THEME.SANS,
                    fontSize: "var(--nb-fs-sm)",
                    color: PROEVOL_THEME.value,
                    fontWeight: 600,
                  }}
                >
                  {row.gpMean.toFixed(1)}
                  <span
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xs)",
                      color: PROEVOL_THEME.muted,
                      fontWeight: 400,
                      marginLeft: "4px",
                    }}
                  >
                    +/- {row.gpStd.toFixed(2)}
                  </span>
                </div>
                {/* Uncertainty bar */}
                <div
                  style={{
                    height: "4px",
                    borderRadius: "2px",
                    overflow: "hidden",
                    background: PROEVOL_THEME.inset,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: "2px",
                      width: `${Math.min(100, (row.gpStd / (Math.max(...gpTableRows.map((r) => r.gpStd)) || 1)) * 100)}%`,
                      background: PROEVOL_THEME.sky,
                      opacity: 0.6,
                    }}
                  />
                </div>
                <div
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: "var(--nb-fs-xs)",
                    color: row.ei > 0 ? "#93CB52" : PROEVOL_THEME.muted,
                  }}
                >
                  EI: {row.ei.toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* EI ranking table */}
      {mlMode && gpTableRows.length > 0 && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "var(--nb-radius-md)",
            border: `1px solid ${PROEVOL_THEME.border}`,
            background: PROEVOL_THEME.surface,
            overflow: "auto",
          }}
        >
          <div style={kicker}>Expected Improvement Ranking</div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px" }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle()}>Rank</th>
                <th style={tableHeaderStyle()}>Variant</th>
                <th style={tableHeaderStyle()}>Mutation</th>
                <th style={tableHeaderStyle()}>Composite</th>
                <th style={tableHeaderStyle()}>GP Mean</th>
                <th style={tableHeaderStyle()}>GP Std</th>
                <th style={tableHeaderStyle()}>EI</th>
                <th style={tableHeaderStyle()}>Status</th>
              </tr>
            </thead>
            <tbody>
              {[...gpTableRows]
                .sort((a, b) => b.ei - a.ei)
                .slice(0, 15)
                .map((row, rank) => (
                  <tr
                    key={row.id}
                    style={{
                      background: row.suggested ? "rgba(232,220,200,0.06)" : undefined,
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedVariantId(row.id)}
                  >
                    <td style={tableCellStyle()}>
                      <span
                        style={{
                          fontFamily: THEME.MONO,
                          fontSize: "var(--nb-fs-xs)",
                          color: rank === 0 ? PROEVOL_THEME.apricot : PROEVOL_THEME.muted,
                        }}
                      >
                        {rank + 1}
                      </span>
                    </td>
                    <td style={tableCellStyle()}>
                      <span style={{ fontWeight: row.suggested ? 700 : 400 }}>{row.name}</span>
                    </td>
                    <td style={tableCellStyle()}>
                      <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: PROEVOL_THEME.sky }}>
                        {row.mutationString || "-"}
                      </span>
                    </td>
                    <td style={tableCellStyle()}>{row.composite.toFixed(1)}</td>
                    <td style={tableCellStyle()}>{row.gpMean.toFixed(2)}</td>
                    <td style={tableCellStyle()}>
                      <span style={{ color: PROEVOL_THEME.sky }}>+/- {row.gpStd.toFixed(3)}</span>
                    </td>
                    <td style={tableCellStyle()}>
                      <span
                        style={{
                          color: row.ei > 0 ? "#93CB52" : PROEVOL_THEME.muted,
                          fontWeight: row.ei > 0 ? 600 : 400,
                        }}
                      >
                        {row.ei.toFixed(4)}
                      </span>
                    </td>
                    <td style={tableCellStyle()}>
                      <StatusPill tone={row.suggested ? "warm" : row.selected ? "cool" : "neutral"}>
                        {row.suggested ? "suggest" : row.selected ? "selected" : "candidate"}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {/* ═══ BO TRAJECTORY SIMULATION ═══ */}
      {mlMode && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "var(--nb-radius-md)",
            border: `1px solid ${PROEVOL_THEME.border}`,
            background: PROEVOL_THEME.surface,
            display: "grid",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={kicker}>BO Trajectory Simulation</span>
            <StatusPill tone="cool">{boAcqType}</StatusPill>
            <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: PROEVOL_THEME.muted }}>
              Multi-round optimization loop — simulates iterative directed evolution
            </span>
          </div>
          {/* BO Config Controls */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            {(
              [
                { label: "Rounds", value: boRounds, set: setBoRounds, min: 1, max: 20, fallback: 5 },
                { label: "Batch", value: boBatchSize, set: setBoBatchSize, min: 1, max: 50, fallback: 10 },
              ] as const
            ).map(({ label, value, set, min, max, fallback }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: PROEVOL_THEME.label }}>
                  {label}
                </span>
                <input
                  type="number"
                  min={min}
                  max={max}
                  value={value}
                  onChange={(e) => set(Math.max(min, Math.min(max, Number(e.target.value) || fallback)))}
                  style={{
                    width: 48,
                    padding: "3px 6px",
                    borderRadius: "var(--nb-radius-sm)",
                    background: PROEVOL_THEME.inset,
                    border: `1px solid ${PROEVOL_THEME.border}`,
                    fontFamily: THEME.MONO,
                    fontSize: "var(--nb-fs-xs)",
                    color: PROEVOL_THEME.value,
                    textAlign: "center",
                  }}
                />
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: PROEVOL_THEME.label }}>
                Acquisition
              </span>
              <select
                value={boAcqType}
                onChange={(e) => setBoAcqType(e.target.value as "EI" | "UCB" | "EHVI")}
                style={{
                  padding: "3px 6px",
                  borderRadius: "var(--nb-radius-sm)",
                  background: PROEVOL_THEME.inset,
                  border: `1px solid ${PROEVOL_THEME.border}`,
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  color: PROEVOL_THEME.value,
                }}
              >
                <option value="EI">EI</option>
                <option value="UCB">UCB</option>
                <option value="EHVI">EHVI</option>
              </select>
            </div>
            <button
              type="button"
              onClick={runBOSimulation}
              disabled={boRunning || mlVariants.length < 3}
              style={{
                padding: "6px 14px",
                borderRadius: "999px",
                background: boRunning ? "rgba(255,255,255,0.03)" : "rgba(147,203,82,0.15)",
                color: boRunning ? PROEVOL_THEME.muted : "#93CB52",
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: boRunning ? "default" : "pointer",
                border: `1px solid ${boRunning ? "rgba(255,255,255,0.08)" : "#93CB52"}44`,
                opacity: boRunning || mlVariants.length < 3 ? 0.5 : 1,
              }}
            >
              {boRunning ? "Simulating..." : "Run BO Simulation"}
            </button>
          </div>
          {boError && (
            <div
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-sm)",
                color: PROEVOL_THEME.coral,
                padding: "6px 10px",
                borderRadius: "var(--nb-radius-sm)",
                background: "rgba(232,163,161,0.08)",
                border: `1px solid ${PROEVOL_THEME.coral}33`,
              }}
            >
              {boError}
            </div>
          )}
          {/* BO Results */}
          {boResult && (
            <div style={{ display: "grid", gap: "10px" }}>
              {/* Convergence Summary */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: "6px",
                }}
              >
                <CompactMetric
                  label="Convergence"
                  value={boResult.convergenceRound > 0 ? `Round ${boResult.convergenceRound}` : "Not reached"}
                  delta={
                    boResult.convergenceRound > 0
                      ? "EI < threshold"
                      : `max EI: ${Math.max(...boResult.acquisitionHistory).toFixed(4)}`
                  }
                  accent={boResult.convergenceRound > 0 ? PROEVOL_THEME.mint : PROEVOL_THEME.apricot}
                />
                <CompactMetric
                  label="Best fitness"
                  value={boResult.finalBest.predictedFitness.toFixed(2)}
                  delta={`Round ${boResult.finalBest.round}`}
                  accent={PROEVOL_THEME.mint}
                />
                <CompactMetric
                  label="Uncertainty"
                  value={`+/- ${boResult.finalBest.uncertainty.toFixed(3)}`}
                  delta="std dev"
                  accent={PROEVOL_THEME.sky}
                />
                <CompactMetric
                  label="Total proposed"
                  value={String(boResult.totalProposed)}
                  delta={`${boResult.rounds.length} rounds`}
                  accent={PROEVOL_THEME.lilac}
                />
              </div>
              {/* Improvement History Chart (SVG) */}
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--nb-radius-md)",
                  border: `1px solid ${PROEVOL_THEME.border}`,
                  background: "rgba(255,255,255,0.015)",
                }}
              >
                <div style={kicker}>Improvement Trajectory</div>
                <BOImprovementChart
                  improvementHistory={boResult.improvementHistory}
                  acquisitionHistory={boResult.acquisitionHistory}
                  convergenceRound={boResult.convergenceRound}
                  stoppingThreshold={boResult.config.stoppingThreshold ?? 0.01}
                />
              </div>
              {/* Proposed Variants per Round */}
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--nb-radius-md)",
                  border: `1px solid ${PROEVOL_THEME.border}`,
                  background: "rgba(255,255,255,0.015)",
                  overflow: "auto",
                }}
              >
                <div style={kicker}>Proposed Variants by Round</div>
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px" }}>
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle()}>Round</th>
                      <th style={tableHeaderStyle()}>Rank</th>
                      <th style={tableHeaderStyle()}>Predicted Fitness</th>
                      <th style={tableHeaderStyle()}>Uncertainty</th>
                      <th style={tableHeaderStyle()}>Acquisition</th>
                      <th style={tableHeaderStyle()}>Features</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boResult.rounds.map((r) =>
                      r.proposed.map((features, j) => (
                        <tr
                          key={`${r.round}-${j}`}
                          style={{
                            background: j === 0 ? "rgba(147,203,82,0.06)" : undefined,
                            borderBottom: `1px solid ${PROEVOL_THEME.border}`,
                          }}
                        >
                          <td style={tableCellStyle()}>
                            <span
                              style={{
                                fontFamily: THEME.MONO,
                                fontSize: "var(--nb-fs-xs)",
                                color: r.round === boResult.finalBest.round ? "#93CB52" : PROEVOL_THEME.muted,
                              }}
                            >
                              R{r.round}
                            </span>
                          </td>
                          <td style={tableCellStyle()}>
                            <span
                              style={{
                                fontFamily: THEME.MONO,
                                fontSize: "var(--nb-fs-xs)",
                                color: j === 0 ? PROEVOL_THEME.apricot : PROEVOL_THEME.muted,
                              }}
                            >
                              {j + 1}
                            </span>
                          </td>
                          <td style={tableCellStyle()}>
                            <span
                              style={{
                                fontFamily: THEME.MONO,
                                fontSize: "var(--nb-fs-sm)",
                                color: PROEVOL_THEME.value,
                                fontWeight: 600,
                              }}
                            >
                              {r.predicted[j].toFixed(3)}
                            </span>
                          </td>
                          <td style={tableCellStyle()}>
                            <span
                              style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: PROEVOL_THEME.sky }}
                            >
                              +/- {r.uncertainty[j].toFixed(3)}
                            </span>
                          </td>
                          <td style={tableCellStyle()}>
                            <span
                              style={{
                                fontFamily: THEME.MONO,
                                fontSize: "var(--nb-fs-xs)",
                                color: r.acquisition[j] > 0 ? "#93CB52" : PROEVOL_THEME.muted,
                              }}
                            >
                              {r.acquisition[j].toFixed(4)}
                            </span>
                          </td>
                          <td style={tableCellStyle()}>
                            <span
                              style={{
                                fontFamily: THEME.MONO,
                                fontSize: "9px",
                                color: PROEVOL_THEME.muted,
                              }}
                            >
                              [{features.map((f) => f.toFixed(1)).join(", ")}]
                            </span>
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Empty state */}
      {mlMode && gpPredictions.length === 0 && (
        <div
          style={{
            padding: "20px",
            borderRadius: "var(--nb-radius-md)",
            border: `1px dashed ${PROEVOL_THEME.border}`,
            background: PROEVOL_THEME.surface,
            textAlign: "center",
          }}
        >
          <div style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-sm)", color: PROEVOL_THEME.muted }}>
            Need at least 3 variants to fit GP. Current: {mlVariants.length} variants.
          </div>
        </div>
      )}
      {!mlMode && (
        <div
          style={{
            padding: "20px",
            borderRadius: "var(--nb-radius-md)",
            border: `1px dashed ${PROEVOL_THEME.border}`,
            background: PROEVOL_THEME.surface,
            textAlign: "center",
          }}
        >
          <div
            style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-sm)", color: PROEVOL_THEME.muted, lineHeight: 1.6 }}
          >
            Enable the Gaussian Process to predict fitness landscapes and identify high-Expected-Improvement variants
            for the next round of directed evolution. The GP uses an RBF kernel trained on the current variant library.
          </div>
        </div>
      )}
    </div>
  );
}
