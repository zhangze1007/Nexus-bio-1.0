"use client";
import type React from "react";
import { toolTokens } from "../../../hooks/useToolTheme";
import type { MetabolicEfficiencyScore, MOFAResult, VAETrainingResult } from "../../../services/MOIEngine";
import { THEME } from "../../../theme";
import type { OmicsLayer, OmicsRow } from "../../../types";
import { PAPER_THEME } from "../../charts/chartTheme";
import { ChartAxisLabels, ChartGrid, SVGChartContainer } from "../../charts/primitives";
import FloatingControlRail from "../shared/FloatingControlRail";
import InlineMetricOverlay from "../shared/InlineMetricOverlay";
import ScientificFigureFrame from "../shared/ScientificFigureFrame";
import ToolTabPanel from "../shared/ToolTabPanel";
import WorkbenchRangeSlider from "../shared/WorkbenchRangeSlider";
import { LAYER_COLORS, SectionLabel } from "./multiOHelpers";
import { VolcanoPlot } from "./VolcanoPlot";

const {
  label: LABEL,
  value: VALUE,
  glass: GLASS,
  border: BORDER,
  inputBg: INPUT_BG,
  inputBorder: INPUT_BORDER,
  inputText: INPUT_TEXT,
} = toolTokens;

/* ── Volcano Tab ─────────────────────────────────────────────────── */

interface VolcanoTabProps {
  activeTab: string;
  filtered: OmicsRow[];
  selectedGene: string;
  setSelectedGene: (v: string) => void;
  geneNames: string[];
  fcThreshold: number;
  setFcThreshold: (v: number) => void;
  pvThreshold: number;
  setPvThreshold: (v: number) => void;
  significant: OmicsRow[];
  upregulated: number;
  downregulated: number;
}

export function MultiOVolcanoTab(props: VolcanoTabProps) {
  const {
    activeTab,
    filtered,
    selectedGene,
    setSelectedGene,
    geneNames,
    fcThreshold,
    setFcThreshold,
    pvThreshold,
    setPvThreshold,
    significant,
    upregulated,
    downregulated,
  } = props;

  return (
    <ToolTabPanel tabId="volcano" activeId={activeTab}>
      <div style={{ display: "flex", gap: "0", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <FloatingControlRail label="Controls">
          <SectionLabel>Thresholds</SectionLabel>
          <WorkbenchRangeSlider
            label="|FC| >"
            value={fcThreshold}
            min={0.5}
            max={5}
            step={0.1}
            formatValue={(v) => v.toFixed(1)}
            onChange={setFcThreshold}
          />
          <WorkbenchRangeSlider
            label="p <"
            value={pvThreshold}
            min={0.001}
            max={0.1}
            step={0.001}
            formatValue={(v) => v.toFixed(3)}
            onChange={setPvThreshold}
          />
          <SectionLabel>Gene</SectionLabel>
          <select
            value={selectedGene}
            onChange={(e) => setSelectedGene(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 8px",
              background: INPUT_BG,
              border: `1px solid ${INPUT_BORDER}`,
              borderRadius: "var(--nb-radius-sm)",
              color: INPUT_TEXT,
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              outline: "2px solid rgba(175,195,214,0.5)",
              outlineOffset: "2px",
              appearance: "auto" as React.CSSProperties["appearance"],
            }}
          >
            {geneNames.map((g) => (
              <option key={g} value={g} style={{ background: "#1a1d24" }}>
                {g}
              </option>
            ))}
          </select>
        </FloatingControlRail>
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, padding: "16px", overflow: "auto" }}
        >
          <ScientificFigureFrame
            eyebrow="Differential Signal Map"
            title={`${selectedGene} highlighted against fold-change and significance thresholds`}
            caption="Volcano view emphasizes threshold logic and current bottleneck focus."
            minHeight="100%"
            legend={[
              { label: "Gene", value: selectedGene, accent: THEME.LILAC },
              { label: "Significant", value: `${significant.length}`, accent: THEME.MINT },
            ]}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "520px" }}>
              <div style={{ width: "100%", maxWidth: "560px", aspectRatio: "360/300" }}>
                <VolcanoPlot
                  data={filtered}
                  fcThreshold={fcThreshold}
                  pvThreshold={pvThreshold}
                  highlightedGene={selectedGene}
                />
              </div>
            </div>
          </ScientificFigureFrame>
          <InlineMetricOverlay
            position="top-right"
            metrics={[
              { label: "Up", value: `${upregulated}`, accent: THEME.MINT },
              { label: "Down", value: `${downregulated}`, accent: THEME.CORAL },
              { label: "Total Sig", value: `${significant.length}`, accent: THEME.LILAC },
            ]}
          />
        </div>
      </div>
    </ToolTabPanel>
  );
}

/* ── Factors Tab ─────────────────────────────────────────────────── */

interface FactorsTabProps {
  activeTab: string;
  mofaResult: MOFAResult;
  scspatialPayload?: {
    result?: {
      clusterSummaries?: Array<{
        clusterId: number;
        clusterLabel: string;
        cellCount: number;
        meanExpression: number;
        fate: string;
        topGenes: string[];
      }>;
    };
  };
}

export function MultiOFactorsTab(props: FactorsTabProps) {
  const { activeTab, mofaResult, scspatialPayload } = props;

  return (
    <ToolTabPanel tabId="factors" activeId={activeTab}>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        <ScientificFigureFrame
          eyebrow="Factor Decomposition"
          title="Cross-layer factors explaining multi-omics variance"
          caption="Per-layer contribution, top genes, and interpretation in one frame."
          minHeight="100%"
          legend={[
            {
              label: "Var Explained",
              value: `${(mofaResult.totalVarianceExplained * 100).toFixed(1)}%`,
              accent: THEME.SKY,
            },
            { label: "Factors", value: `${mofaResult.factors.length}`, accent: THEME.LILAC },
          ]}
        >
          <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
            <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "12px 16px", flex: "1 0 120px" }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, display: "block" }}>
                Total Var. Explained
              </span>
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-lg)",
                  fontWeight: 700,
                  color: LAYER_COLORS.transcriptomics,
                }}
              >
                {(mofaResult.totalVarianceExplained * 100).toFixed(1)}%
              </span>
            </div>
            <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "12px 16px", flex: "1 0 120px" }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, display: "block" }}>
                Optimization Steps
              </span>
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-lg)", fontWeight: 700, color: VALUE }}>
                {mofaResult.convergenceIterations} iter
              </span>
            </div>
            <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "12px 16px", flex: "1 0 120px" }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, display: "block" }}>
                Recon. Error
              </span>
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-lg)", fontWeight: 700, color: VALUE }}>
                {mofaResult.reconstructionError.toFixed(4)}
              </span>
            </div>
          </div>
          {mofaResult.factors.map((f) => (
            <div
              key={f.id}
              style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "14px", marginBottom: "12px" }}
            >
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}
              >
                <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-sm)", fontWeight: 600, color: VALUE }}>
                  {f.name}
                </span>
                <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
                  {(f.varianceExplained.total * 100).toFixed(1)}% var
                </span>
              </div>
              {(["transcriptomics", "proteomics", "metabolomics"] as OmicsLayer[]).map((layer) => {
                const pct = f.varianceExplained[layer] * 100;
                return (
                  <div key={layer} style={{ marginBottom: "5px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
                        {layer.slice(0, 5)}
                      </span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ width: "100%", height: "5px", borderRadius: "3px", background: THEME.PANEL_INSET }}>
                      <div
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          height: "100%",
                          borderRadius: "3px",
                          background: LAYER_COLORS[layer],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              <div style={{ display: "flex", gap: "4px", marginTop: "8px", flexWrap: "wrap" }}>
                {f.topGenes.slice(0, 4).map((g) => (
                  <span
                    key={g.gene}
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xs)",
                      padding: "2px 6px",
                      borderRadius: "6px",
                      background: THEME.PANEL_INSET,
                      color: VALUE,
                    }}
                  >
                    {g.gene} ({g.loading.toFixed(2)})
                  </span>
                ))}
              </div>
              <p
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: "var(--nb-fs-xs)",
                  color: LABEL,
                  margin: "6px 0 0",
                  lineHeight: "1.3",
                }}
              >
                {f.interpretation}
              </p>
            </div>
          ))}
          {scspatialPayload?.result?.clusterSummaries && scspatialPayload.result.clusterSummaries.length > 0 && (
            <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "14px", marginTop: "12px" }}>
              <div
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  color: LABEL,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: "8px",
                }}
              >
                Spatial Cluster Correlation
              </div>
              <div
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: "var(--nb-fs-xs)",
                  color: LABEL,
                  marginBottom: "10px",
                  lineHeight: 1.45,
                }}
              >
                Spatial cluster assignments inform factor decomposition — clusters with high mean expression may align
                with dominant MOFA factors.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {scspatialPayload.result.clusterSummaries.map((cs) => (
                  <div
                    key={cs.clusterId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "4px 0",
                      borderBottom: `1px solid ${BORDER}`,
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background:
                          cs.fate === "productive" ? THEME.MINT : cs.fate === "stressed" ? THEME.CORAL : THEME.APRICOT,
                      }}
                    />
                    <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE, width: "100px" }}>
                      {cs.clusterLabel}
                    </span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
                      {cs.cellCount} cells
                    </span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
                      expr: {cs.meanExpression.toFixed(2)}
                    </span>
                    <span
                      style={{
                        fontFamily: THEME.MONO,
                        fontSize: "var(--nb-fs-xs)",
                        color: cs.fate === "productive" ? THEME.MINT : THEME.LABEL,
                      }}
                    >
                      {cs.fate}
                    </span>
                    <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                      {cs.topGenes.slice(0, 3).map((g) => (
                        <span
                          key={g}
                          style={{
                            fontFamily: THEME.MONO,
                            fontSize: "9px",
                            padding: "1px 4px",
                            borderRadius: "4px",
                            background: THEME.PANEL_INSET,
                            color: VALUE,
                          }}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScientificFigureFrame>
      </div>
    </ToolTabPanel>
  );
}

/* ── Projection Tab ──────────────────────────────────────────────── */

interface ProjectionTabProps {
  activeTab: string;
  vaeResult: VAETrainingResult | null;
  vaeLoading: boolean;
  vaeError: string | null;
}

export function MultiOProjectionTab(props: ProjectionTabProps) {
  const { activeTab, vaeResult, vaeLoading, vaeError } = props;

  return (
    <ToolTabPanel tabId="projection" activeId={activeTab}>
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, padding: "16px", overflow: "auto" }}
      >
        <ScientificFigureFrame
          eyebrow="Projected Embedding"
          title="Projected embedding and optimization trace"
          caption="Embedding geometry above, optimization trace below."
          minHeight="100%"
          legend={[
            { label: "Dim", value: `${vaeResult?.latentDim ?? 8}D`, accent: THEME.SKY },
            { label: "ELBO", value: vaeResult?.elbo?.toFixed(3) ?? "—", accent: THEME.MINT },
          ]}
        >
          {vaeLoading && (
            <div style={{ display: "grid", gap: "8px", padding: "16px" }}>
              <div
                style={{
                  height: "14px",
                  width: "50%",
                  borderRadius: "4px",
                  background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`,
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.5s ease-in-out infinite",
                }}
              />
              <div
                style={{
                  height: "240px",
                  borderRadius: "12px",
                  background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`,
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.5s ease-in-out infinite",
                }}
              />
              <div style={{ display: "flex", gap: "8px" }}>
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    style={{
                      height: "36px",
                      flex: 1,
                      borderRadius: "8px",
                      background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`,
                      backgroundSize: "200% 100%",
                      animation: "shimmer 1.5s ease-in-out infinite",
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  textAlign: "center",
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  color: THEME.LABEL,
                  marginTop: "4px",
                }}
              >
                Training linear embedding model…
              </div>
            </div>
          )}
          {vaeError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "32px",
                color: THEME.CORAL,
                fontSize: "var(--nb-fs-sm)",
                fontFamily: "monospace",
              }}
            >
              Linear embedding error: {vaeError}
            </div>
          )}
          {!vaeLoading && !vaeError && (
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
              >
                <div style={{ width: "100%", maxWidth: "560px" }}>
                  {(() => {
                    const W = 520,
                      H = 380,
                      PAD = 44;
                    const pts = vaeResult?.latentPoints ?? [];
                    const xs = pts.map((p) => p.z_mean[0] ?? 0);
                    const ys = pts.map((p) => p.z_mean[1] ?? 0);
                    const xMin = Math.min(...xs),
                      xMax = Math.max(...xs);
                    const yMin = Math.min(...ys),
                      yMax = Math.max(...ys);
                    const xR = xMax - xMin || 1,
                      yR = yMax - yMin || 1;
                    return (
                      <SVGChartContainer W={W} H={H} ariaLabel="Linear embedding latent space projection">
                        <ChartGrid W={W} H={H} PAD={PAD} gridCount={0} showGrid={false} />
                        <ChartAxisLabels W={W} H={H} PAD={PAD} xLabel="Projection 1" yLabel="Projection 2" />
                        {pts.map((p, i) => {
                          const cx = PAD + ((xs[i] - xMin) / xR) * (W - PAD * 2);
                          const cy = H - PAD - ((ys[i] - yMin) / yR) * (H - PAD * 2);
                          const eff = p.metabolicEfficiency;
                          const r = Math.round(60 + (1 - eff) * 195);
                          const g = Math.round(120 + eff * 100);
                          const b = Math.round(100 + eff * 80);
                          return (
                            <circle key={p.id} cx={cx} cy={cy} r={5} fill={`rgb(${r},${g},${b})`} opacity={0.85}>
                              <title>
                                {p.gene}: eff={eff.toFixed(3)}
                              </title>
                            </circle>
                          );
                        })}
                      </SVGChartContainer>
                    );
                  })()}
                </div>
              </div>
              <div style={{ height: "100px", padding: "0 20px 12px", flexShrink: 0 }}>
                {(() => {
                  const hist = vaeResult?.convergenceHistory ?? [];
                  if (hist.length === 0) return null;
                  const W = 480,
                    H = 80,
                    PAD = 30;
                  const maxL = Math.max(...hist.map((h) => h.loss), 0.01);
                  return (
                    <SVGChartContainer W={W} H={H} ariaLabel="Linear embedding convergence history" fill="transparent">
                      <text x={PAD - 4} y={12} fontFamily={THEME.MONO} fontSize="10" fill={LABEL} textAnchor="end">
                        Loss
                      </text>
                      <polyline
                        points={hist
                          .map((h, i) => {
                            const x = PAD + (i / (hist.length - 1)) * (W - PAD * 2);
                            const y = H - 8 - (h.loss / maxL) * (H - 20);
                            return `${x},${y}`;
                          })
                          .join(" ")}
                        fill="none"
                        stroke={LAYER_COLORS.proteomics}
                        strokeWidth={1.5}
                      />
                      <text x={W / 2} y={H - 1} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={LABEL}>
                        Epoch
                      </text>
                    </SVGChartContainer>
                  );
                })()}
              </div>
            </div>
          )}
        </ScientificFigureFrame>
      </div>
    </ToolTabPanel>
  );
}

/* ── Efficiency Tab ──────────────────────────────────────────────── */

interface EfficiencyTabProps {
  activeTab: string;
  efficiencyScores: MetabolicEfficiencyScore[];
}

export function MultiOEfficiencyTab(props: EfficiencyTabProps) {
  const { activeTab, efficiencyScores } = props;

  return (
    <ToolTabPanel tabId="efficiency" activeId={activeTab}>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        <ScientificFigureFrame
          eyebrow="Metabolic Efficiency Ledger"
          title="Ranked entities ordered by production-relevant efficiency"
          caption="Efficiency ranking connects deterministic integration back to exploratory prioritization."
          minHeight="100%"
          legend={[
            {
              label: "Avg Eff",
              value: `${((efficiencyScores.reduce((s, e) => s + e.score, 0) / Math.max(1, efficiencyScores.length)) * 100).toFixed(1)}%`,
              accent: THEME.MINT,
            },
            {
              label: "Top Gene",
              value: [...efficiencyScores].sort((a, b) => b.score - a.score)[0]?.gene ?? "—",
              accent: THEME.SKY,
            },
          ]}
        >
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
            <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "12px 16px", flex: "1 0 140px" }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, display: "block" }}>
                Avg Efficiency
              </span>
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-lg)", fontWeight: 700, color: THEME.MINT }}>
                {(
                  (efficiencyScores.reduce((s, e) => s + e.score, 0) / Math.max(1, efficiencyScores.length)) *
                  100
                ).toFixed(1)}
                %
              </span>
            </div>
            <div style={{ ...GLASS, borderRadius: "var(--nb-radius-md)", padding: "12px 16px", flex: "1 0 140px" }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, display: "block" }}>
                Top Gene
              </span>
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-md)", fontWeight: 700, color: VALUE }}>
                {[...efficiencyScores].sort((a, b) => b.score - a.score)[0]?.gene ?? "—"}
              </span>
            </div>
          </div>
          {[...efficiencyScores]
            .sort((a, b) => b.score - a.score)
            .map((e, i) => {
              const pct = e.score * 100;
              const color = pct > 60 ? THEME.MINT : pct > 35 ? THEME.RISK_LOW : THEME.CORAL;
              return (
                <div
                  key={e.geneId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "6px 0",
                    borderBottom: `1px solid ${BORDER}`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xs)",
                      color: LABEL,
                      width: "20px",
                      textAlign: "right",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE, width: "70px" }}>
                    {e.gene}
                  </span>
                  <div style={{ flex: 1, height: "6px", borderRadius: "3px", background: PAPER_THEME.grid }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        borderRadius: "3px",
                        background: color,
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: "var(--nb-fs-xs)",
                      color,
                      width: "45px",
                      textAlign: "right",
                    }}
                  >
                    {pct.toFixed(1)}%
                  </span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <span
                      style={{
                        fontFamily: THEME.MONO,
                        fontSize: "var(--nb-fs-xs)",
                        padding: "1px 4px",
                        borderRadius: "4px",
                        background: `${LAYER_COLORS.transcriptomics}20`,
                        color: LAYER_COLORS.transcriptomics,
                      }}
                    >
                      F:{e.fluxUtilization.toFixed(2)}
                    </span>
                    <span
                      style={{
                        fontFamily: THEME.MONO,
                        fontSize: "var(--nb-fs-xs)",
                        padding: "1px 4px",
                        borderRadius: "4px",
                        background: `${LAYER_COLORS.proteomics}20`,
                        color: LAYER_COLORS.proteomics,
                      }}
                    >
                      E:{e.expressionBalance.toFixed(2)}
                    </span>
                    <span
                      style={{
                        fontFamily: THEME.MONO,
                        fontSize: "var(--nb-fs-xs)",
                        padding: "1px 4px",
                        borderRadius: "4px",
                        background: `${LAYER_COLORS.metabolomics}20`,
                        color: LAYER_COLORS.metabolomics,
                      }}
                    >
                      Y:{e.metaboliteYield.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
        </ScientificFigureFrame>
      </div>
    </ToolTabPanel>
  );
}
