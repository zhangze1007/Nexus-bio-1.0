"use client";
import React, { useCallback, useState } from "react";
import { THEME } from "../../../theme";
import SimErrorBanner from "../../ide/shared/SimErrorBanner";

export default function EnergySystemPanel() {
  const [energySystem, setEnergySystem] = useState<"PEP" | "creatine_phosphate" | "maltodextrin">("PEP");
  const [result, setResult] = useState<import("../../../server/cellFreeMetabolicEngine").CellFreeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [metError, setMetError] = useState<string | null>(null);

  const handleRun = useCallback(async () => {
    setLoading(true);
    try {
      const { simulateCellFreePathway } = await import("../../../server/cellFreeMetabolicEngine");
      const system = {
        extractType: "E_coli" as const,
        energySystem,
        templateDNA: 5,
        aminoAcids: { "L-Ala": 1.0 },
        rNTPs: { ATP: 2.0, GTP: 1.0, CTP: 1.0, UTP: 1.0 },
        cofactors: { NAD: 1.0, CoA: 0.5 },
        volume: 10,
        temperature: 37,
      };
      const pathway = [
        {
          enzyme: "Hexokinase",
          ecNumber: "2.7.1.1",
          substrate: "glucose",
          product: "g6p",
          kcat: 100,
          km: 0.1,
          enzymeConc: 1.0,
        },
      ];
      const res = simulateCellFreePathway(system, pathway, 8);
      setResult(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Cell-free metabolic simulation failed";
      setMetError(msg);
    } finally {
      setLoading(false);
    }
  }, [energySystem]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
          Energy System
        </span>
        <select
          value={energySystem}
          onChange={(e) => setEnergySystem(e.target.value as typeof energySystem)}
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
          <option value="PEP">PEP (Silverman 2020)</option>
          <option value="creatine_phosphate">Creatine Phosphate (Karim 2020)</option>
          <option value="maltodextrin">Maltodextrin (Kim & Swartz 2001)</option>
        </select>
        <button
          onClick={handleRun}
          disabled={loading}
          className="nb-tool-toggle"
          style={{ padding: "6px 14px", fontSize: "var(--nb-fs-sm)", opacity: loading ? 0.4 : 1 }}
        >
          {loading ? "Simulating..." : "Run Simulation"}
        </button>
        {result && (
          <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: "rgba(255,255,255,0.4)" }}>
            Yield: {result.productYield.toFixed(3)} mM | Stability: {result.stability.halfLife.toFixed(1)}h
          </span>
        )}
      </div>

      {metError && <SimErrorBanner message={metError} onRetry={() => setMetError(null)} />}

      {result && (
        <>
          <div
            style={{
              background: THEME.PANEL_SURFACE,
              borderRadius: "var(--nb-radius-lg)",
              padding: 12,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 8,
              border: `1px solid ${THEME.BORDER}`,
            }}
          >
            {[
              { label: "Product Yield", value: `${result.productYield.toFixed(3)} mM`, color: THEME.MINT },
              { label: "Productivity", value: `${result.productivity.toFixed(3)} mM/h`, color: THEME.SKY },
              {
                label: "ATP Produced",
                value: `${result.energyBalance.atpProduced.toFixed(1)} mM`,
                color: THEME.APRICOT,
              },
              {
                label: "ATP Net",
                value: `${result.energyBalance.net.toFixed(1)} mM`,
                color: result.energyBalance.net > 0 ? "rgba(147,203,82,0.7)" : "rgba(250,128,114,0.7)",
              },
              { label: "Half-life", value: `${result.stability.halfLife.toFixed(1)} h`, color: THEME.LILAC },
              { label: "Limiting", value: result.stability.limitingFactor, color: "rgba(255,255,255,0.5)" },
            ].map((m, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xxs)", color: THEME.LABEL }}>
                  {m.label}
                </div>
                <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: m.color, fontWeight: 600 }}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>

          {result.recommendations.length > 0 && (
            <div
              style={{
                background: THEME.PANEL_SURFACE,
                borderRadius: "var(--nb-radius-lg)",
                padding: 12,
                border: `1px solid ${THEME.BORDER}`,
              }}
            >
              <div style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL, marginBottom: 6 }}>
                Recommendations
              </div>
              {result.recommendations.map((r, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: THEME.SANS,
                    fontSize: "var(--nb-fs-sm)",
                    color: "rgba(255,255,255,0.7)",
                    marginBottom: 4,
                  }}
                >
                  • {r}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
