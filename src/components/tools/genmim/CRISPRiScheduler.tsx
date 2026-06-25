"use client";
import React, { useState } from "react";
import { CRISPRI_TARGETS, computeOffTargetScore } from "../../../data/mockGenMIM";
import { THEME } from "../../../theme";
import type { CRISPRiTarget } from "../../../types";
import SimErrorBanner from "../../ide/shared/SimErrorBanner";
import DataPreview from "../../shared/DataPreview";
import DataUpload from "../../shared/DataUpload";

/* ── Targets Tab ──────────────────────────────────────────────────────── */

export function TargetsPanel({
  fluxBoostedTargets,
  schedule,
  sgRNASequences,
  customTargets,
  customTargetHeaders,
  customTargetRows,
  customTargetError,
  onCustomUpload,
  onCustomError,
  onClearCustom,
}: {
  fluxBoostedTargets: CRISPRiTarget[];
  schedule: CRISPRiTarget[];
  sgRNASequences: Record<string, string>;
  customTargets: Array<{ geneId: string; geneName: string; essentiality: number; flux: number }> | null;
  customTargetHeaders: string[];
  customTargetRows: Record<string, string>[];
  customTargetError: string | null;
  onCustomUpload: (rows: Record<string, string>[], headers: string[]) => void;
  onCustomError: (err: string) => void;
  onClearCustom: () => void;
}) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
      {/* Upload Gene Targets Section */}
      <div
        style={{
          padding: "12px",
          marginBottom: "16px",
          borderRadius: "var(--nb-radius-md)",
          border: `1px solid ${THEME.BORDER}`,
          background: THEME.PANEL_INSET,
        }}
      >
        <div
          style={{
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
            color: THEME.LABEL,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 8,
          }}
        >
          Upload Gene Targets
        </div>
        <DataUpload
          accept=".csv,.tsv"
          label="Upload custom gene targets"
          onUpload={onCustomUpload}
          onError={onCustomError}
        />
        {customTargetError && (
          <p style={{ margin: "6px 0 0", fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: THEME.CORAL }}>
            {customTargetError}
          </p>
        )}
        {customTargets && customTargets.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: THEME.MINT }}>
                {customTargets.length} custom gene targets loaded — merged with {CRISPRI_TARGETS.length} defaults
              </span>
              <button
                onClick={onClearCustom}
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: "var(--nb-fs-xxs)",
                  color: THEME.CORAL,
                  background: "rgba(250,128,114,0.08)",
                  border: `1px solid rgba(250,128,114,0.2)`,
                  borderRadius: 4,
                  padding: "2px 6px",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
            <DataPreview headers={customTargetHeaders} rows={customTargetRows} maxRows={5} />
          </div>
        )}
      </div>

      <div
        style={{
          fontFamily: THEME.MONO,
          fontSize: "var(--nb-fs-xs)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: THEME.LABEL,
          marginBottom: "10px",
        }}
      >
        All CRISPRi Targets
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${THEME.BORDER_STRONG}` }}>
              {["Gene", "Position", "Essential", "KD Eff.", "sgRNA Score", "Phenotype", "Growth ΔΔ"].map((h) => (
                <th
                  key={h}
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: "var(--nb-fs-xs)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: THEME.LABEL,
                    padding: "5px 8px",
                    textAlign: "left",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fluxBoostedTargets.map((t, i) => {
              const isSelected = schedule.some((s) => s.gene === t.gene);
              return (
                <tr
                  key={t.gene}
                  style={{
                    background: isSelected ? "rgba(232,163,161,0.10)" : i % 2 === 0 ? "transparent" : THEME.PANEL_INSET,
                  }}
                >
                  <td
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xs)",
                      padding: "4px 8px",
                      color: THEME.VALUE,
                    }}
                  >
                    {t.gene}
                  </td>
                  <td
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xs)",
                      padding: "4px 8px",
                      color: THEME.LABEL,
                    }}
                  >
                    {t.position.toLocaleString()}
                  </td>
                  <td
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xs)",
                      padding: "4px 8px",
                      color: t.essential ? THEME.APRICOT : THEME.LABEL,
                    }}
                  >
                    {t.essential ? "YES" : "no"}
                  </td>
                  <td
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xs)",
                      padding: "4px 8px",
                      color: THEME.VALUE,
                    }}
                  >
                    {t.essential ? "—" : `${(t.knockdown_efficiency * 100).toFixed(0)}%`}
                  </td>
                  <td
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xs)",
                      padding: "4px 8px",
                      color: THEME.LABEL,
                    }}
                  >
                    {t.essential
                      ? "—"
                      : computeOffTargetScore(
                          sgRNASequences[t.gene] ?? t.gene.toUpperCase().padEnd(20, "A").slice(0, 20),
                        ).toFixed(2)}
                  </td>
                  <td
                    style={{
                      fontFamily: THEME.SANS,
                      fontSize: "var(--nb-fs-xs)",
                      padding: "4px 8px",
                      color: THEME.LABEL,
                    }}
                  >
                    {t.phenotype}
                  </td>
                  <td
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xs)",
                      padding: "4px 8px",
                      color: THEME.LABEL,
                    }}
                  >
                    {t.essential ? "—" : `${((t.growth_impact ?? 0) * 100).toFixed(0)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Schedule Tab ─────────────────────────────────────────────────────── */

export function SchedulePanel({ schedule }: { schedule: CRISPRiTarget[] }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
      <div
        style={{
          fontFamily: THEME.MONO,
          fontSize: "var(--nb-fs-xs)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: THEME.LABEL,
          marginBottom: "10px",
        }}
      >
        Selected Schedule ({schedule.length} targets)
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {schedule.map((t, i) => (
          <div
            key={t.gene}
            style={{
              padding: "8px 12px",
              background: "rgba(232,163,161,0.12)",
              border: "1px solid rgba(232,163,161,0.28)",
              borderRadius: "var(--nb-radius-sm)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", fontWeight: 600, color: THEME.VALUE }}
              >
                {t.gene}
              </span>
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL }}>
                {(t.knockdown_efficiency * 100).toFixed(0)}% KD
              </span>
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL, marginTop: "2px" }}>
              {t.phenotype} · GI: {((t.growth_impact ?? 0) * 100).toFixed(0)}%
            </div>
            <div style={{ marginTop: "6px", height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "2px" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: "2px",
                  width: `${t.knockdown_efficiency * 100}%`,
                  background: THEME.CORAL,
                  opacity: 0.6,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Multiplex CRISPR Strategy Panel ──────────────────────────────────── */

export function MultiplexCRISPRPanel() {
  const [maxEdits, setMaxEdits] = useState(4);
  const [result, setResult] = useState<import("../../../server/multiplexCRISPREngine").MultiplexCRISPRResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { runMultiplexCRISPR } = await import("../../../server/multiplexCRISPREngine");
      // Use CRISPRI_TARGETS as gene pool
      const genes = CRISPRI_TARGETS.map((t: CRISPRiTarget) => ({
        geneId: t.gene,
        geneName: t.gene,
        essentiality: t.essential ? 0.8 : 0.2,
        flux: 2.0,
        subsystem: "central_metabolism",
        maxKnockdown: t.knockdown_efficiency,
      }));
      const res = runMultiplexCRISPR({ genes, maxEdits, minFitness: 0.2, topN: 5 });
      setResult(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Simulation failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [maxEdits]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Controls */}
      <div
        style={{
          background: THEME.PANEL_SURFACE,
          borderRadius: "var(--nb-radius-lg)",
          padding: 16,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          border: `1px solid ${THEME.BORDER}`,
        }}
      >
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
            color: THEME.LABEL,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Max Edits
        </span>
        <input
          type="number"
          min={2}
          max={8}
          value={maxEdits}
          onChange={(e) => setMaxEdits(Number(e.target.value))}
          style={{
            width: 60,
            padding: "4px 8px",
            background: THEME.INPUT_BG,
            border: `1px solid ${THEME.INPUT_BORDER}`,
            borderRadius: "var(--nb-radius-sm)",
            color: THEME.INPUT_TEXT,
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-sm)",
            outline: "none",
          }}
        />
        <button
          onClick={handleRun}
          disabled={loading}
          className="nb-tool-toggle"
          style={{ padding: "6px 14px", fontSize: "var(--nb-fs-sm)", opacity: loading ? 0.4 : 1 }}
        >
          {loading ? "Computing..." : "Design Strategy"}
        </button>
        {result && (
          <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: "rgba(255,255,255,0.4)" }}>
            {result.strategies.length} strategies • {result.epistasisMatrix.length} epistatic pairs
          </span>
        )}
      </div>

      {error && <SimErrorBanner message={error} onRetry={() => setError(null)} />}

      {/* Gene ranking */}
      {result && result.geneRanking.length > 0 && (
        <div
          style={{
            background: THEME.PANEL_SURFACE,
            borderRadius: "var(--nb-radius-lg)",
            padding: 12,
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
            Gene Importance Ranking
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {result.geneRanking.slice(0, 10).map((g, i) => (
              <span
                key={i}
                style={{
                  padding: "3px 8px",
                  background: g.importance > 0.6 ? "rgba(147,203,82,0.1)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${g.importance > 0.6 ? "rgba(147,203,82,0.2)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: "3px",
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  color: g.importance > 0.6 ? "rgba(147,203,82,0.8)" : "rgba(255,255,255,0.5)",
                }}
              >
                {g.geneId} ({g.importance.toFixed(2)})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top strategies */}
      {result && result.strategies.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
          {result.strategies.map((s, i) => (
            <div
              key={i}
              style={{
                background: THEME.PANEL_SURFACE,
                borderRadius: "var(--nb-radius-lg)",
                padding: 12,
                border: `1px solid ${i === 0 ? "rgba(221,208,232,0.2)" : THEME.BORDER}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontFamily: THEME.SANS,
                  fontSize: "var(--nb-fs-sm)",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{ color: i === 0 ? THEME.LILAC : "rgba(255,255,255,0.6)", fontWeight: i === 0 ? 700 : 400 }}
                >
                  Strategy {i + 1}
                </span>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>{s.targetGenes.length} edits</span>
                <span
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: "var(--nb-fs-xs)",
                    color: s.predictedFitness > 0.7 ? "rgba(147,203,82,0.7)" : "rgba(250,128,114,0.7)",
                  }}
                >
                  fitness {s.predictedFitness.toFixed(3)}
                </span>
                <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: "rgba(255,255,255,0.35)" }}>
                  titer {s.predictedTiterImprovement.toFixed(1)}x
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                {s.targetGenes.map((g, gi) => (
                  <React.Fragment key={gi}>
                    <span
                      style={{
                        padding: "2px 6px",
                        background: s.editTypes[g] === "knockout" ? "rgba(250,128,114,0.1)" : "rgba(200,216,232,0.1)",
                        border: `1px solid ${s.editTypes[g] === "knockout" ? "rgba(250,128,114,0.2)" : "rgba(200,216,232,0.2)"}`,
                        borderRadius: "3px",
                        fontFamily: THEME.MONO,
                        fontSize: "var(--nb-fs-xs)",
                        color: "rgba(255,255,255,0.7)",
                      }}
                    >
                      {g} ({s.editTypes[g]})
                    </span>
                    {gi < s.targetGenes.length - 1 && (
                      <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "var(--nb-fs-xs)" }}>+</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
              {s.notes.length > 0 && (
                <div
                  style={{
                    marginTop: 6,
                    fontFamily: THEME.MONO,
                    fontSize: "var(--nb-fs-xxs)",
                    color: "rgba(250,128,114,0.5)",
                  }}
                >
                  {s.notes.join(" • ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Synthetic Genomics Panel ────────────────────────────────────────────── */

export function SyntheticGenomicsPanel() {
  const [host, setHost] = useState<"ecoli" | "yeast">("ecoli");
  const [caiResult, setCaiResult] = useState<{ cai: number; optimized: string } | null>(null);
  const [testSequence, setTestSequence] = useState("ATGAAACGCACCAGCAACAGCAACTAA");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { optimizeCodonsForHost, computeCAI } = await import("../../../server/syntheticGenomicsEngine");
      const optimized = optimizeCodonsForHost(testSequence, host);
      const cai = computeCAI(optimized, host);
      setCaiResult({ cai, optimized });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Simulation failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [testSequence, host]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          background: THEME.PANEL_SURFACE,
          borderRadius: "var(--nb-radius-lg)",
          padding: 14,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          border: `1px solid ${THEME.BORDER}`,
        }}
      >
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
            color: THEME.LABEL,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Codon Optimizer
        </span>
        <select
          value={host}
          onChange={(e) => setHost(e.target.value as "ecoli" | "yeast")}
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
          <option value="ecoli">E. coli (Nakamura 2000)</option>
          <option value="yeast">S. cerevisiae (Nakamura 2000)</option>
        </select>
        <input
          value={testSequence}
          onChange={(e) => setTestSequence(e.target.value)}
          placeholder="ATG..."
          style={{
            flex: 1,
            minWidth: 150,
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
        <button
          onClick={handleOptimize}
          disabled={loading}
          className="nb-tool-toggle"
          style={{ padding: "6px 14px", fontSize: "var(--nb-fs-sm)", opacity: loading ? 0.4 : 1 }}
        >
          {loading ? "Optimizing..." : "Optimize Codons"}
        </button>
      </div>

      {error && <SimErrorBanner message={error} onRetry={() => setError(null)} />}

      {caiResult && (
        <div
          style={{
            background: THEME.PANEL_SURFACE,
            borderRadius: "var(--nb-radius-lg)",
            padding: 14,
            border: `1px solid ${THEME.BORDER}`,
          }}
        >
          <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: THEME.LABEL }}>CAI</div>
              <div
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-lg)",
                  color:
                    caiResult.cai > 0.8
                      ? "rgba(147,203,82,0.8)"
                      : caiResult.cai > 0.5
                        ? "rgba(200,216,232,0.8)"
                        : "rgba(250,128,114,0.8)",
                  fontWeight: 700,
                }}
              >
                {caiResult.cai.toFixed(3)}
              </div>
            </div>
          </div>
          <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: THEME.LABEL, marginBottom: 4 }}>
            Optimized Sequence
          </div>
          <div
            style={{
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              color: "rgba(255,255,255,0.6)",
              wordBreak: "break-all",
              maxHeight: 60,
              overflow: "auto",
              padding: "6px 8px",
              background: "rgba(255,255,255,0.02)",
              borderRadius: "4px",
            }}
          >
            {caiResult.optimized}
          </div>
        </div>
      )}
    </div>
  );
}
