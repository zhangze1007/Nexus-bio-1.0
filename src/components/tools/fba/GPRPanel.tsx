"use client";

/**
 * GPRPanel — Gene-Protein-Reaction knockout panel.
 *
 * Lists genes from iJO1366 GPR rules, lets users select genes to knock out,
 * calls /api/fba with action='knockout', and shows which reactions are
 * affected and the resulting growth impact.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { IJO1366_GPR_RULES, IJO1366_REACTIONS } from "../../../data/iJO1366Subset";
import type { FBAOutput } from "../../../data/mockFBA";
import type { FBAObjective } from "../../../services/FBAAuthorityClient";
import { THEME } from "../../../theme";
import MetricCard from "../../ide/shared/MetricCard";
import SimErrorBanner from "../../ide/shared/SimErrorBanner";
import { SimSkeleton } from "../../shared/Skeleton";

// ── Extract unique genes from GPR rules ───────────────────────────────

function extractGenes(gprRules: Record<string, string>): string[] {
  const geneIds = new Set<string>();
  for (const rule of Object.values(gprRules)) {
    if (!rule || rule.trim() === "") continue;
    const tokens = rule.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    for (const token of tokens) {
      if (token !== "AND" && token !== "OR") {
        geneIds.add(token);
      }
    }
  }
  return Array.from(geneIds).sort();
}

// ── Types ─────────────────────────────────────────────────────────────

interface GPRPanelProps {
  objective: FBAObjective;
  glucoseUptake: number;
  oxygenUptake: number;
  knockouts: string[];
}

interface KnockoutResponse {
  genes: string[];
  knockedOutReactions: string[];
  result: FBAOutput;
}

// ── Main Component ────────────────────────────────────────────────────

export default React.memo(function GPRPanel({ objective, glucoseUptake, oxygenUptake, knockouts }: GPRPanelProps) {
  const allGenes = useMemo(() => extractGenes(IJO1366_GPR_RULES), []);
  const [selectedGenes, setSelectedGenes] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [koResult, setKoResult] = useState<KnockoutResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter genes by search
  const filteredGenes = useMemo(() => {
    if (!searchFilter.trim()) return allGenes;
    const q = searchFilter.toLowerCase();
    return allGenes.filter((g) => g.toLowerCase().includes(q));
  }, [allGenes, searchFilter]);

  // Build reaction→name map
  const reactionNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const rxn of IJO1366_REACTIONS) {
      map[rxn.id] = rxn.name;
    }
    return map;
  }, []);

  function toggleGene(geneId: string) {
    setSelectedGenes((prev) => (prev.includes(geneId) ? prev.filter((g) => g !== geneId) : [...prev, geneId]));
  }

  const handleRunKnockout = useCallback(() => {
    if (selectedGenes.length === 0) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch("/api/fba", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        action: "knockout",
        species: "ecoli",
        objective,
        glucoseUptake,
        oxygenUptake,
        knockouts,
        genes: selectedGenes,
      }),
    })
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.error ?? "Knockout solve failed");
        }
        setKoResult({
          genes: payload.genes as string[],
          knockedOutReactions: payload.knockedOutReactions as string[],
          result: payload.result as FBAOutput,
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Knockout solve failed");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [selectedGenes, objective, glucoseUptake, oxygenUptake, knockouts]);

  return (
    <div style={{ display: "flex", gap: "16px", flex: 1, minHeight: 0, overflow: "auto", padding: "12px" }}>
      {/* Left: Gene selector */}
      <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <p
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-xs)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.55)",
            margin: "0 0 8px",
          }}
        >
          Gene Selection ({allGenes.length} genes)
        </p>

        {/* Search */}
        <input
          type="text"
          placeholder="Filter genes..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          style={{
            padding: "6px 10px",
            marginBottom: "8px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "var(--nb-radius-sm)",
            color: "rgba(255,255,255,0.85)",
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
            outline: "none",
          }}
        />

        {/* Gene list (scrollable) */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            minHeight: 0,
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "var(--nb-radius-sm)",
            padding: "4px",
          }}
        >
          {filteredGenes.map((gene) => {
            const isSelected = selectedGenes.includes(gene);
            return (
              <button
                key={gene}
                onClick={() => toggleGene(gene)}
                className={`nb-tool-toggle ${isSelected ? "nb-tool-toggle--active" : ""}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "3px 6px",
                  marginBottom: "1px",
                  background: isSelected ? "rgba(255,80,80,0.14)" : undefined,
                  borderColor: isSelected ? "rgba(255,80,80,0.38)" : undefined,
                  borderRadius: "var(--nb-radius-sm)",
                }}
              >
                <span
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: "var(--nb-fs-xs)",
                    color: isSelected ? "rgba(255,120,120,0.9)" : "rgba(255,255,255,0.5)",
                  }}
                >
                  {gene}
                </span>
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: isSelected ? "rgba(255,80,80,0.7)" : "rgba(255,255,255,0.12)",
                    flexShrink: 0,
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
          {selectedGenes.length > 0 && (
            <button
              onClick={() => setSelectedGenes([])}
              className="nb-tool-toggle"
              style={{
                flex: 1,
                padding: "5px 8px",
                borderRadius: "var(--nb-radius-sm)",
                color: "rgba(255,255,255,0.4)",
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
              }}
            >
              Clear ({selectedGenes.length})
            </button>
          )}
          <button
            onClick={handleRunKnockout}
            disabled={selectedGenes.length === 0 || loading}
            className="nb-tool-toggle nb-tool-toggle--active"
            style={{
              flex: 2,
              padding: "5px 8px",
              borderRadius: "var(--nb-radius-sm)",
              background: selectedGenes.length > 0 ? "rgba(255,80,80,0.2)" : undefined,
              borderColor: selectedGenes.length > 0 ? "rgba(255,80,80,0.4)" : undefined,
              color: selectedGenes.length > 0 ? "rgba(255,120,120,0.9)" : "rgba(255,255,255,0.3)",
              fontFamily: THEME.SANS,
              fontSize: "var(--nb-fs-xs)",
              fontWeight: 600,
              opacity: selectedGenes.length === 0 ? 0.5 : 1,
            }}
          >
            {loading ? "Solving..." : `Knock out (${selectedGenes.length})`}
          </button>
        </div>
      </div>

      {/* Right: Results */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
        {error && <SimErrorBanner message={error} />}

        {/* Growth impact metrics */}
        {koResult && (
          <div>
            <p
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.55)",
                margin: "0 0 8px",
              }}
            >
              Knockout Impact
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <MetricCard label="Growth Rate" value={koResult.result.growthRate} unit="h⁻¹" highlight />
              <MetricCard label="ATP Yield" value={koResult.result.atpYield} unit="mol/mol" />
              <MetricCard label="Carbon Efficiency" value={koResult.result.carbonEfficiency} unit="%" />
              <MetricCard label="Feasible" value={koResult.result.feasible ? "YES" : "NO"} />
            </div>
          </div>
        )}

        {/* Affected reactions */}
        {koResult && (
          <div>
            <p
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.55)",
                margin: "0 0 8px",
              }}
            >
              Disabled Reactions ({koResult.knockedOutReactions.length})
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "4px",
                maxHeight: "240px",
                overflow: "auto",
              }}
            >
              {koResult.knockedOutReactions.map((rxnId) => (
                <div
                  key={rxnId}
                  style={{
                    padding: "5px 8px",
                    background: "rgba(255,80,80,0.08)",
                    border: "1px solid rgba(255,80,80,0.18)",
                    borderRadius: "var(--nb-radius-sm)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: "rgba(255,120,120,0.8)" }}>
                    {rxnId}
                  </span>
                  <span style={{ fontFamily: THEME.SANS, fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>
                    {reactionNames[rxnId] ?? ""}
                  </span>
                </div>
              ))}
              {koResult.knockedOutReactions.length === 0 && (
                <div
                  style={{
                    padding: "8px",
                    color: "rgba(255,255,255,0.4)",
                    fontFamily: THEME.SANS,
                    fontSize: "var(--nb-fs-sm)",
                  }}
                >
                  No reactions disabled — selected genes have OR-redundancy.
                </div>
              )}
            </div>
          </div>
        )}

        {/* GPR rules for selected genes */}
        {selectedGenes.length > 0 && !koResult && (
          <div>
            <p
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.55)",
                margin: "0 0 8px",
              }}
            >
              GPR Rules Involving Selected Genes
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "300px", overflow: "auto" }}>
              {IJO1366_REACTIONS.filter((rxn) => rxn.gpr && selectedGenes.some((g) => rxn.gpr!.includes(g)))
                .slice(0, 30)
                .map((rxn) => (
                  <div
                    key={rxn.id}
                    style={{
                      padding: "6px 8px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: "var(--nb-radius-sm)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span
                        style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: "rgba(255,255,255,0.6)" }}
                      >
                        {rxn.id}
                      </span>
                      <span style={{ fontFamily: THEME.SANS, fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>
                        {rxn.subsystem}
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: THEME.MONO,
                        fontSize: "10px",
                        color: "rgba(200,216,232,0.6)",
                        marginTop: "2px",
                        wordBreak: "break-all",
                      }}
                    >
                      {rxn.gpr}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {selectedGenes.length === 0 && !koResult && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.3)",
              fontFamily: THEME.SANS,
              fontSize: "var(--nb-fs-sm)",
              textAlign: "center",
              padding: "24px",
            }}
          >
            Select one or more genes from the list on the left, then click "Knock out" to simulate the effect on the
            metabolic network.
          </div>
        )}
      </div>
    </div>
  );
});
