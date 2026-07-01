"use client";
import React, { useCallback, useEffect, useState } from "react";
import { getToolValidity } from "../../config/toolValidity";
import type { DiscoveredPathway, PathwayDiscoveryResult } from "../../server/pathwayDiscoveryEngine";
import type { RetrosynthesisResult } from "../../server/retrosynthesis";
import type { FallbackResult } from "../../services/database/fetchWithFallback";
import type { KEGGPathwayResult } from "../../services/database/keggClient";
import { searchKEGGPathway } from "../../services/database/keggClient";
import { useUIStore } from "../../store/uiStore";
import { useWorkbenchStore } from "../../store/workbenchStore";
import { THEME } from "../../theme";
import { keggToPathway } from "../../utils/keggToPathway";
import DataSourceBadge from "../ide/shared/DataSourceBadge";
import SimErrorBanner from "../ide/shared/SimErrorBanner";
import NextStepButton from "../NextStepButton";
import MetabolicEngPage from "./MetabolicEngPage";

/** Tab bar / section divider border — subtle white edge */
const BORDER_SUBTLE = "rgba(255,255,255,0.06)";
/** Hover / inactive background highlight for interactive elements */
const BG_HOVER = "rgba(255,255,255,0.04)";
/** Input field border — slightly stronger than BORDER_SUBTLE */
const INPUT_BORDER_PATHD = "rgba(255,255,255,0.1)";

export default React.memo(function PathDPage() {
  const [activeTab, setActiveTab] = useState<"kegg" | "retro" | "discover">("kegg");
  const [keggQuery, setKeggQuery] = useState("");
  const [keggResult, setKeggResult] = useState<FallbackResult<KEGGPathwayResult> | null>(null);
  const [keggLoading, setKeggLoading] = useState(false);
  const [keggError, setKeggError] = useState<string | null>(null);

  // Retrosynthesis state
  const [retroTarget, setRetroTarget] = useState("");
  const [retroResult, setRetroResult] = useState<RetrosynthesisResult | null>(null);
  const [retroLoading, setRetroLoading] = useState(false);
  const [retroError, setRetroError] = useState<string | null>(null);

  // Pathway Discovery state
  const [discoverTarget, setDiscoverTarget] = useState("");
  const [discoverPrecursors, setDiscoverPrecursors] = useState("glucose,pyruvate,acetyl_coa");
  const [discoverResult, setDiscoverResult] = useState<PathwayDiscoveryResult | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discoverOrganism, setDiscoverOrganism] = useState("ecoli");

  const setAiPathway = useUIStore((s) => s.setAiPathway);
  const resetPathway = useUIStore((s) => s.resetPathway);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);

  const handleKeggSearch = useCallback(async () => {
    if (!keggQuery.trim()) return;
    setKeggLoading(true);
    try {
      const result = await searchKEGGPathway(keggQuery.trim());
      setKeggResult(result);
      if (result.data.compounds.length > 0) {
        setToolPayload("pathd", {
          validity: result.source === "live" ? "partial" : "demo",
          toolId: "pathd",
          targetProduct: result.data.name,
          activeRouteLabel: result.data.name,
          nodeCount: result.data.compounds.length,
          edgeCount: result.data.reactions.length,
          selectedNodeId: null,
          result: {
            pathwayCandidates: 1,
            bottleneckCount: 0,
            enzymeCandidates: 0,
            thermodynamicConcerns: 0,
            highlightedNode: null,
            recommendedNextTool: "fbasim",
            evidenceLinked: result.source === "live",
          },
          updatedAt: Date.now(),
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "KEGG search failed";
      setKeggError(msg);
    } finally {
      setKeggLoading(false);
    }
  }, [keggQuery, setToolPayload]);

  const handleClear = useCallback(() => {
    setKeggQuery("");
    setKeggResult(null);
    resetPathway();
  }, [resetPathway]);

  const handleRetrosynthesis = useCallback(async () => {
    if (!retroTarget.trim()) return;
    setRetroLoading(true);
    try {
      // Compute runs server-side (see /api/retrosynthesis) so the engine stays
      // out of the client bundle (integrity audit T3-3).
      const res = await fetch("/api/retrosynthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSmiles: retroTarget, maxSteps: 5, maxPathways: 10 }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Retrosynthesis failed");
      const result = json.result as RetrosynthesisResult;
      setRetroResult(result);
      setToolPayload("pathd", {
        validity: "demo",
        toolId: "pathd",
        targetProduct: retroTarget,
        activeRouteLabel: `Retrosynthesis: ${retroTarget}`,
        nodeCount: result.pathways[0]?.steps.length ?? 0,
        edgeCount: Math.max(0, (result.pathways[0]?.steps.length ?? 0) - 1),
        selectedNodeId: null,
        result: {
          pathwayCandidates: result.pathways.length,
          bottleneckCount: 0,
          enzymeCandidates: 0,
          thermodynamicConcerns: 0,
          highlightedNode: null,
          recommendedNextTool: "catdes",
          evidenceLinked: false,
        },
        updatedAt: Date.now(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Retrosynthesis failed";
      setRetroError(msg);
    } finally {
      setRetroLoading(false);
    }
  }, [retroTarget, setToolPayload]);

  const handlePathwayDiscovery = useCallback(async () => {
    if (!discoverTarget.trim()) return;
    setDiscoverLoading(true);
    try {
      const precursorList = discoverPrecursors
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      // Compute runs server-side via the pipeline route so the engine stays out
      // of the client bundle (integrity audit T3-3).
      const res = await fetch("/api/pipeline/pathwaydiscovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: {
            id: discoverTarget.toLowerCase().replace(/\s+/g, "_"),
            name: discoverTarget,
            functionalGroups: [],
            isPrecursor: false,
          },
          precursors: precursorList.map((p) => ({
            id: p.toLowerCase().replace(/\s+/g, "_"),
            name: p,
            functionalGroups: [],
            isPrecursor: true,
          })),
          maxLength: 8,
          topN: 5,
          preferredOrganism: discoverOrganism,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Pathway discovery failed");
      const result = json.result as PathwayDiscoveryResult;
      setDiscoverResult(result);
      if (result.pathways.length > 0) {
        const best = result.pathways[0];
        setToolPayload("pathd", {
          validity: "partial",
          toolId: "pathd",
          targetProduct: discoverTarget,
          activeRouteLabel: `Discovery: ${discoverTarget}`,
          nodeCount: best.metrics.pathwayLength,
          edgeCount: Math.max(0, best.metrics.pathwayLength - 1),
          selectedNodeId: null,
          result: {
            pathwayCandidates: result.pathways.length,
            bottleneckCount: best.bottlenecks.length,
            enzymeCandidates: 0,
            thermodynamicConcerns: best.metrics.totalDeltaG > 0 ? 1 : 0,
            highlightedNode: null,
            recommendedNextTool: "fbasim",
            evidenceLinked: false,
          },
          updatedAt: Date.now(),
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pathway discovery failed";
      setDiscoverError(msg);
    } finally {
      setDiscoverLoading(false);
    }
  }, [discoverTarget, discoverPrecursors, discoverOrganism, setToolPayload]);

  // Inject KEGG pathway into uiStore when live data arrives.
  // MetabolicEngPage picks it up via tier 4 (uiGraph) of its resolution cascade.
  useEffect(() => {
    if (keggResult && keggResult.data.compounds.length > 0) {
      const { nodes, edges } = keggToPathway(keggResult.data);
      if (nodes.length > 0) {
        setAiPathway(nodes, edges);
      }
    }
    // Reset on unmount so MetabolicEngPage falls back to demo
    return () => {
      resetPathway();
    };
  }, [keggResult, setAiPathway, resetPathway]);

  const pathwayValidity = getToolValidity("pathwaydiscovery");

  return (
    <>
      {/* ── Tab bar ── */}
      <div
        style={{
          display: "flex",
          gap: "2px",
          padding: "0 16px",
          borderBottom: `1px solid ${BORDER_SUBTLE}`,
          background: "rgba(10,12,16,0.72)",
          alignItems: "center",
        }}
      >
        <button
          role="tab"
          aria-selected={activeTab === "kegg"}
          onClick={() => setActiveTab("kegg")}
          style={{
            position: "relative",
            padding: "10px 16px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-sm)",
            fontWeight: activeTab === "kegg" ? 600 : 400,
            color: activeTab === "kegg" ? THEME.SKY : "rgba(255,255,255,0.45)",
            borderRadius: "6px 6px 0 0",
            transition: "color 0.2s ease, background 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (activeTab !== "kegg") {
              e.currentTarget.style.background = BG_HOVER;
              e.currentTarget.style.color = "rgba(255,255,255,0.7)";
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== "kegg") {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(255,255,255,0.45)";
            }
          }}
        >
          KEGG Search
          {activeTab === "kegg" && (
            <div
              style={{
                position: "absolute",
                bottom: "-1px",
                left: 0,
                right: 0,
                height: "2px",
                background: THEME.SKY,
                borderRadius: "2px 2px 0 0",
              }}
            />
          )}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "retro"}
          onClick={() => setActiveTab("retro")}
          style={{
            position: "relative",
            padding: "10px 16px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-sm)",
            fontWeight: activeTab === "retro" ? 600 : 400,
            color: activeTab === "retro" ? THEME.MINT : "rgba(255,255,255,0.45)",
            borderRadius: "6px 6px 0 0",
            transition: "color 0.2s ease, background 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (activeTab !== "retro") {
              e.currentTarget.style.background = BG_HOVER;
              e.currentTarget.style.color = "rgba(255,255,255,0.7)";
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== "retro") {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(255,255,255,0.45)";
            }
          }}
        >
          Retrosynthesis
          {activeTab === "retro" && (
            <div
              style={{
                position: "absolute",
                bottom: "-1px",
                left: 0,
                right: 0,
                height: "2px",
                background: THEME.MINT,
                borderRadius: "2px 2px 0 0",
              }}
            />
          )}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "discover"}
          onClick={() => setActiveTab("discover")}
          style={{
            position: "relative",
            padding: "10px 16px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-sm)",
            fontWeight: activeTab === "discover" ? 600 : 400,
            color: activeTab === "discover" ? THEME.LILAC : "rgba(255,255,255,0.45)",
            borderRadius: "6px 6px 0 0",
            transition: "color 0.2s ease, background 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (activeTab !== "discover") {
              e.currentTarget.style.background = BG_HOVER;
              e.currentTarget.style.color = "rgba(255,255,255,0.7)";
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== "discover") {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(255,255,255,0.45)";
            }
          }}
        >
          Pathway Discovery
          {activeTab === "discover" && (
            <div
              style={{
                position: "absolute",
                bottom: "-1px",
                left: 0,
                right: 0,
                height: "2px",
                background: THEME.LILAC,
                borderRadius: "2px 2px 0 0",
              }}
            />
          )}
        </button>
        {pathwayValidity && (
          <div
            title={pathwayValidity.caption}
            style={{
              marginLeft: "auto",
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-xs)",
              fontWeight: 700,
              letterSpacing: "0.10em",
              padding: "5px 9px",
              borderRadius: "var(--nb-radius-md)",
              background:
                pathwayValidity.level === "real"
                  ? "rgba(147, 203, 82, 0.16)"
                  : pathwayValidity.level === "partial"
                    ? "rgba(232, 220, 200, 0.32)"
                    : "rgba(250, 128, 114, 0.16)",
              border: `1px solid ${pathwayValidity.level === "real" ? "rgba(147, 203, 82, 0.45)" : pathwayValidity.level === "partial" ? "rgba(180, 150, 100, 0.50)" : "rgba(250, 128, 114, 0.50)"}`,
              color:
                pathwayValidity.level === "real"
                  ? "#5d8a2f"
                  : pathwayValidity.level === "partial"
                    ? "#8a6a30"
                    : "#a8453a",
              cursor: "help",
              flexShrink: 0,
            }}
          >
            {pathwayValidity.level === "real" ? "REAL" : pathwayValidity.level === "partial" ? "PARTIAL" : "DEMO"}
          </div>
        )}
      </div>

      {/* ── KEGG Pathway Search ── */}
      {activeTab === "kegg" && (
        <div
          style={{
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            borderBottom: `1px solid ${BORDER_SUBTLE}`,
          }}
        >
          <span
            style={{
              fontFamily: "var(--nb-mono)",
              fontSize: "var(--nb-fs-xxs)",
              color: "rgba(255,255,255,0.45)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              whiteSpace: "nowrap",
            }}
          >
            KEGG Search
          </span>
          <input
            type="text"
            value={keggQuery}
            onChange={(e) => setKeggQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleKeggSearch();
            }}
            placeholder="e.g. glycolysis, tca, mevalonate"
            style={{
              flex: 1,
              maxWidth: "280px",
              padding: "4px 8px",
              background: BG_HOVER,
              border: `1px solid ${INPUT_BORDER_PATHD}`,
              borderRadius: "var(--nb-radius-sm)",
              color: "rgba(255,255,255,0.85)",
              fontFamily: "var(--nb-mono)",
              fontSize: "var(--nb-fs-xs)",
              outline: "none",
            }}
          />
          <button
            onClick={handleKeggSearch}
            disabled={keggLoading || !keggQuery.trim()}
            className="nb-tool-toggle"
            style={{
              padding: "4px 12px",
              fontSize: "var(--nb-fs-xs)",
              opacity: keggLoading || !keggQuery.trim() ? 0.4 : 1,
            }}
          >
            {keggLoading ? "Searching..." : "Search"}
          </button>
          {keggResult && (
            <button
              onClick={handleClear}
              className="nb-tool-toggle"
              style={{
                padding: "4px 8px",
                fontSize: "var(--nb-fs-xs)",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              Clear
            </button>
          )}
          {keggResult && (
            <DataSourceBadge
              source={keggResult.source}
              label={keggResult.source === "live" ? "KEGG Live" : "KEGG Demo"}
            />
          )}
          {keggResult && (
            <span
              style={{
                fontFamily: "var(--nb-mono)",
                fontSize: "var(--nb-fs-xxs)",
                color: "rgba(255,255,255,0.5)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "240px",
              }}
            >
              {keggResult.data.name} ({keggResult.data.reactions.length} rxns, {keggResult.data.compounds.length} cpds)
            </span>
          )}
        </div>
      )}

      {keggError && (
        <div style={{ padding: "8px 16px" }}>
          <SimErrorBanner message={keggError} onRetry={() => setKeggError(null)} />
        </div>
      )}

      {/* ── Retrosynthesis ── */}
      {activeTab === "retro" && (
        <div
          style={{
            padding: "16px",
            borderBottom: `1px solid ${BORDER_SUBTLE}`,
            background: "rgba(10,12,16,0.72)",
          }}
        >
          {/* Search bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: retroResult ? "16px" : 0,
            }}
          >
            <span
              style={{
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_XS,
                color: "rgba(255,255,255,0.45)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                whiteSpace: "nowrap",
              }}
            >
              Target SMILES
            </span>
            <input
              type="text"
              value={retroTarget}
              onChange={(e) => setRetroTarget(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRetrosynthesis();
              }}
              placeholder="e.g. CC(=O)SC(=O)O  (acetyl-CoA)"
              style={{
                flex: 1,
                maxWidth: "360px",
                padding: "6px 10px",
                background: BG_HOVER,
                border: `1px solid ${INPUT_BORDER_PATHD}`,
                borderRadius: "var(--nb-radius-sm)",
                color: "rgba(255,255,255,0.85)",
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_SM,
                outline: "none",
              }}
            />
            <button
              onClick={handleRetrosynthesis}
              disabled={retroLoading || !retroTarget.trim()}
              className="nb-tool-toggle"
              style={{
                padding: "6px 14px",
                fontSize: THEME.FS_SM,
                opacity: retroLoading || !retroTarget.trim() ? 0.4 : 1,
              }}
            >
              {retroLoading ? "Searching..." : "Find Pathways"}
            </button>
            {retroResult && (
              <button
                onClick={() => {
                  setRetroTarget("");
                  setRetroResult(null);
                }}
                className="nb-tool-toggle"
                style={{
                  padding: "6px 10px",
                  fontSize: THEME.FS_SM,
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                Clear
              </button>
            )}
            {retroResult && (
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: THEME.FS_XS,
                  color: "rgba(255,255,255,0.4)",
                  whiteSpace: "nowrap",
                }}
              >
                {retroResult.pathways.length} pathway{retroResult.pathways.length !== 1 ? "s" : ""} in{" "}
                {retroResult.totalTime}ms
              </span>
            )}
          </div>

          {retroError && (
            <div style={{ marginBottom: "12px" }}>
              <SimErrorBanner message={retroError} onRetry={() => setRetroError(null)} />
            </div>
          )}

          {/* Results */}
          {retroResult && retroResult.pathways.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxHeight: "240px",
                overflowY: "auto",
              }}
            >
              {retroResult.pathways.map((pathway, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "var(--nb-radius-sm)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {/* Pathway header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      fontFamily: THEME.SANS,
                      fontSize: THEME.FS_SM,
                    }}
                  >
                    <span
                      style={{
                        color: THEME.MINT,
                        fontWeight: 600,
                      }}
                    >
                      Route {idx + 1}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>
                      {pathway.length} step{pathway.length !== 1 ? "s" : ""}
                    </span>
                    <span
                      style={{
                        color: "rgba(255,255,255,0.35)",
                        fontFamily: THEME.MONO,
                        fontSize: THEME.FS_XS,
                      }}
                    >
                      score {(pathway.score * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* Steps */}
                  {pathway.steps.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "4px",
                        alignItems: "center",
                      }}
                    >
                      {pathway.steps.map((step, si) => (
                        <React.Fragment key={si}>
                          <span
                            style={{
                              padding: "2px 6px",
                              background: "rgba(191,220,205,0.08)",
                              border: "1px solid rgba(191,220,205,0.15)",
                              borderRadius: "3px",
                              fontFamily: THEME.MONO,
                              fontSize: THEME.FS_XS,
                              color: "rgba(255,255,255,0.7)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {step.ruleName}
                            <span style={{ color: "rgba(255,255,255,0.35)", marginLeft: "4px" }}>
                              [{step.enzymeClass}]
                            </span>
                          </span>
                          {si < pathway.steps.length - 1 && (
                            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: THEME.FS_XS }}>→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  {/* Cofactors */}
                  {pathway.steps.some((s) => s.cofactors.length > 0) && (
                    <div
                      style={{
                        fontFamily: THEME.MONO,
                        fontSize: THEME.FS_XS,
                        color: "rgba(255,255,255,0.3)",
                      }}
                    >
                      Cofactors: {Array.from(new Set(pathway.steps.flatMap((s) => s.cofactors))).join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {retroResult && retroResult.pathways.length === 0 && (
            <div
              style={{
                padding: "12px",
                textAlign: "center",
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_SM,
                color: "rgba(255,255,255,0.4)",
              }}
            >
              No retrosynthetic pathways found for this target. Try a different SMILES or a simpler molecule.
            </div>
          )}
        </div>
      )}

      {/* ── Pathway Discovery ── */}
      {activeTab === "discover" && (
        <div
          style={{
            padding: "16px",
            borderBottom: `1px solid ${BORDER_SUBTLE}`,
            background: "rgba(10,12,16,0.72)",
          }}
        >
          {/* Input controls */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "8px",
              marginBottom: discoverResult ? "16px" : 0,
            }}
          >
            <span
              style={{
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_XS,
                color: "rgba(255,255,255,0.45)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                whiteSpace: "nowrap",
              }}
            >
              Target
            </span>
            <input
              type="text"
              value={discoverTarget}
              onChange={(e) => setDiscoverTarget(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePathwayDiscovery();
              }}
              placeholder="e.g. artemisinin, lycopene, vanillin"
              style={{
                width: "180px",
                padding: "6px 10px",
                background: BG_HOVER,
                border: `1px solid ${INPUT_BORDER_PATHD}`,
                borderRadius: "var(--nb-radius-sm)",
                color: "rgba(255,255,255,0.85)",
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_SM,
                outline: "none",
              }}
            />
            <span
              style={{
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_XS,
                color: "rgba(255,255,255,0.45)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                whiteSpace: "nowrap",
              }}
            >
              Precursors
            </span>
            <input
              type="text"
              value={discoverPrecursors}
              onChange={(e) => setDiscoverPrecursors(e.target.value)}
              placeholder="glucose,pyruvate,acetyl_coa"
              style={{
                flex: 1,
                minWidth: "200px",
                maxWidth: "360px",
                padding: "6px 10px",
                background: BG_HOVER,
                border: `1px solid ${INPUT_BORDER_PATHD}`,
                borderRadius: "var(--nb-radius-sm)",
                color: "rgba(255,255,255,0.85)",
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_SM,
                outline: "none",
              }}
            />
            <select
              value={discoverOrganism}
              onChange={(e) => setDiscoverOrganism(e.target.value)}
              style={{
                padding: "6px 8px",
                background: BG_HOVER,
                border: `1px solid ${INPUT_BORDER_PATHD}`,
                borderRadius: "var(--nb-radius-sm)",
                color: "rgba(255,255,255,0.85)",
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_SM,
                outline: "none",
              }}
            >
              <option value="ecoli">E. coli</option>
              <option value="yeast">S. cerevisiae</option>
              <option value="human">Human</option>
            </select>
            <button
              onClick={handlePathwayDiscovery}
              disabled={discoverLoading || !discoverTarget.trim()}
              className="nb-tool-toggle"
              style={{
                padding: "6px 14px",
                fontSize: THEME.FS_SM,
                opacity: discoverLoading || !discoverTarget.trim() ? 0.4 : 1,
              }}
            >
              {discoverLoading ? "Searching..." : "Discover Pathways"}
            </button>
            {discoverResult && (
              <button
                onClick={() => {
                  setDiscoverTarget("");
                  setDiscoverResult(null);
                }}
                className="nb-tool-toggle"
                style={{
                  padding: "6px 10px",
                  fontSize: THEME.FS_SM,
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                Clear
              </button>
            )}
            {discoverResult && (
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: THEME.FS_XS,
                  color: "rgba(255,255,255,0.4)",
                  whiteSpace: "nowrap",
                }}
              >
                {discoverResult.pathways.length} pathway{discoverResult.pathways.length !== 1 ? "s" : ""} found
              </span>
            )}
          </div>

          {discoverError && (
            <div style={{ marginBottom: "12px" }}>
              <SimErrorBanner message={discoverError} onRetry={() => setDiscoverError(null)} />
            </div>
          )}

          {/* Design notes */}
          {discoverResult && discoverResult.designNotes.length > 0 && (
            <div
              style={{
                marginBottom: "12px",
                padding: "8px 10px",
                background: "rgba(221,208,232,0.05)",
                border: "1px solid rgba(221,208,232,0.12)",
                borderRadius: "var(--nb-radius-sm)",
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_XS,
                color: "rgba(255,255,255,0.5)",
                lineHeight: 1.6,
              }}
            >
              {discoverResult.designNotes.map((note, i) => (
                <div key={i}>• {note}</div>
              ))}
            </div>
          )}

          {/* Results */}
          {discoverResult && discoverResult.pathways.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                maxHeight: "320px",
                overflowY: "auto",
              }}
            >
              {discoverResult.pathways.map((pathway, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "12px",
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${idx === 0 ? "rgba(221,208,232,0.2)" : "rgba(255,255,255,0.07)"}`,
                    borderRadius: "var(--nb-radius-sm)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {/* Pathway header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      fontFamily: THEME.SANS,
                      fontSize: THEME.FS_SM,
                    }}
                  >
                    <span
                      style={{
                        color: idx === 0 ? THEME.LILAC : "rgba(255,255,255,0.6)",
                        fontWeight: idx === 0 ? 700 : 400,
                      }}
                    >
                      Route {idx + 1}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>
                      {pathway.metrics.pathwayLength} step{pathway.metrics.pathwayLength !== 1 ? "s" : ""}
                    </span>
                    <span
                      style={{
                        color: "rgba(255,255,255,0.35)",
                        fontFamily: THEME.MONO,
                        fontSize: THEME.FS_XS,
                      }}
                    >
                      score {pathway.metrics.overallScore.toFixed(2)}
                    </span>
                    <span
                      style={{
                        color: pathway.metrics.totalDeltaG < 0 ? "rgba(147,203,82,0.7)" : "rgba(250,128,114,0.7)",
                        fontFamily: THEME.MONO,
                        fontSize: THEME.FS_XS,
                      }}
                    >
                      ΔG {pathway.metrics.totalDeltaG.toFixed(1)} kcal/mol
                    </span>
                    <span
                      style={{
                        color: "rgba(255,255,255,0.35)",
                        fontFamily: THEME.MONO,
                        fontSize: THEME.FS_XS,
                      }}
                    >
                      enzyme {(pathway.metrics.avgEnzymeAvailability * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* Steps visualization */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "4px",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        padding: "2px 6px",
                        background: "rgba(147,203,82,0.1)",
                        border: "1px solid rgba(147,203,82,0.2)",
                        borderRadius: "3px",
                        fontFamily: THEME.MONO,
                        fontSize: THEME.FS_XS,
                        color: "rgba(147,203,82,0.8)",
                      }}
                    >
                      {pathway.precursor.name}
                    </span>
                    {pathway.steps.map((step, si) => (
                      <React.Fragment key={si}>
                        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: THEME.FS_XS }}>→</span>
                        <span
                          style={{
                            padding: "2px 6px",
                            background: step.deltaG < 0 ? "rgba(191,220,205,0.08)" : "rgba(250,128,114,0.08)",
                            border: `1px solid ${step.deltaG < 0 ? "rgba(191,220,205,0.15)" : "rgba(250,128,114,0.15)"}`,
                            borderRadius: "3px",
                            fontFamily: THEME.MONO,
                            fontSize: THEME.FS_XS,
                            color: "rgba(255,255,255,0.7)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {step.reaction.name}
                          <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: "4px" }}>
                            [{step.reaction.ecNumber || step.reaction.type}]
                          </span>
                        </span>
                      </React.Fragment>
                    ))}
                    <span style={{ color: "rgba(255,255,255,0.2)", fontSize: THEME.FS_XS }}>→</span>
                    <span
                      style={{
                        padding: "2px 6px",
                        background: "rgba(221,208,232,0.1)",
                        border: "1px solid rgba(221,208,232,0.2)",
                        borderRadius: "3px",
                        fontFamily: THEME.MONO,
                        fontSize: THEME.FS_XS,
                        color: "rgba(221,208,232,0.8)",
                      }}
                    >
                      {pathway.target.name}
                    </span>
                  </div>

                  {/* Bottlenecks */}
                  {pathway.bottlenecks.length > 0 && (
                    <div
                      style={{
                        fontFamily: THEME.MONO,
                        fontSize: THEME.FS_XS,
                        color: "rgba(250,128,114,0.6)",
                      }}
                    >
                      ⚠ {pathway.bottlenecks.filter((b) => b.severity === "high").length} high-severity bottleneck
                      {pathway.bottlenecks.filter((b) => b.severity === "high").length !== 1 ? "s" : ""}:{" "}
                      {pathway.bottlenecks
                        .filter((b) => b.severity === "high")
                        .map((b) => b.reason)
                        .join("; ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {discoverResult && discoverResult.pathways.length === 0 && (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_SM,
                color: "rgba(255,255,255,0.4)",
              }}
            >
              No pathways discovered from available precursors to {discoverTarget}. Try adding more precursors or
              increasing max pathway length.
            </div>
          )}
        </div>
      )}

      {activeTab === "kegg" && <MetabolicEngPage embedded />}
      <NextStepButton currentStepId="pathd" />
    </>
  );
});
