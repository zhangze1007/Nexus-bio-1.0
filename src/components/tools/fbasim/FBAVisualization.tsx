"use client";
/**
 * FBAVisualization.tsx — Shadow Prices / Sensitivity tab content.
 * Extracted from FBASimPage.tsx for modularity.
 */

import React from "react";
import { THEME } from "../../../theme";
import MetricCard from "../../ide/shared/MetricCard";
import type { FBASimState } from "./useFBASimState";

type ShadowPricesProps = Pick<FBASimState, "singleResult" | "knockouts" | "top5" | "maxTopFlux">;

export default function ShadowPricesTab(props: ShadowPricesProps) {
  const { singleResult, knockouts, top5, maxTopFlux } = props;

  return (
    <div style={{ display: "flex", gap: "16px", flex: 1, minHeight: 0, overflow: "auto", padding: "12px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-xs)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.55)",
            margin: "0 0 10px",
          }}
        >
          FBA Results
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
          <MetricCard label="Growth Rate (μ)" value={singleResult.growthRate} unit="h⁻¹" highlight />
          <MetricCard label="ATP Yield" value={singleResult.atpYield} unit="mol/mol glc" />
          <MetricCard label="NADH Production" value={singleResult.nadhProduction} unit="mmol/gDW/h" />
          <MetricCard label="Carbon Efficiency" value={singleResult.carbonEfficiency} unit="%" />
          <MetricCard label="Feasible" value={singleResult.feasible ? "YES" : "NO"} />
        </div>
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
          Shadow Prices (∂μ/∂uptake)
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <MetricCard
            label="∂μ/∂Glucose"
            value={singleResult.sensitivityCoefficients.glc.toFixed(4)}
            unit="h⁻¹·gDW/mmol"
          />
          <MetricCard
            label="∂μ/∂Oxygen"
            value={singleResult.sensitivityCoefficients.o2.toFixed(4)}
            unit="h⁻¹·gDW/mmol"
          />
          <MetricCard label="∂μ/∂ATP" value={singleResult.sensitivityCoefficients.atp.toFixed(4)} unit="h⁻¹·gDW/mmol" />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-xs)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.55)",
            margin: "0 0 10px",
          }}
        >
          Top 5 Active Reactions
        </p>
        {top5.map((r) => (
          <div
            key={r.id}
            style={{
              padding: "6px 8px",
              marginBottom: "4px",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${knockouts.includes(r.id) ? "rgba(255,80,80,0.2)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: "var(--nb-radius-sm)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  color: knockouts.includes(r.id) ? "rgba(255,120,120,0.7)" : "rgba(255,255,255,0.6)",
                }}
              >
                {r.id}
              </span>
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  fontWeight: 600,
                  color: r.flux > 0 ? "rgba(20,140,80,0.9)" : "rgba(255,80,80,0.6)",
                  textAlign: "right",
                }}
              >
                {r.flux.toFixed(2)}
              </span>
            </div>
            <div
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
                color: "rgba(255,255,255,0.55)",
                marginTop: "2px",
              }}
            >
              {r.name}
            </div>
            <div style={{ marginTop: "4px", height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "1px" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: "1px",
                  width: `${Math.abs(r.flux / maxTopFlux) * 100}%`,
                  background: knockouts.includes(r.id) ? "rgba(255,80,80,0.3)" : "rgba(20,140,80,0.4)",
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
