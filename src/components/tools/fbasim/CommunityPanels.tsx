/**
 * Community FBA sub-panels: GlassContainer, SharedMetaboliteBus, StrainPanel, ParamSlider.
 * Extracted from FBASimPage.tsx for modularity.
 */

"use client";
import type { CommunityFBAOutput, FBAOutput, REACTION_DEFS } from "../../../data/mockFBA";
import { THEME } from "../../../theme";
import { SCI_PALETTE } from "../../charts/chartTheme";
import MetricCard from "../../ide/shared/MetricCard";
import WorkbenchRangeSlider from "../shared/WorkbenchRangeSlider";

// ── Color palette for community mode (Okabe-Ito CVD-safe) ──
export const COLORS = {
  strainA: SCI_PALETTE.vermilion, // '#D55E00' — Okabe-Ito orange-red
  strainB: SCI_PALETTE.blue, // '#56B4E9' — Okabe-Ito sky blue
  sharedPool: SCI_PALETTE.green, // '#009E73' — Okabe-Ito green
  strainABg: "rgba(213, 94, 0, 0.10)",
  strainBBg: "rgba(86, 180, 233, 0.10)",
  sharedBg: "rgba(0, 158, 115, 0.10)",
  strainABorder: "rgba(213, 94, 0, 0.20)",
  strainBBorder: "rgba(86, 180, 233, 0.20)",
  sharedBorder: "rgba(0, 158, 115, 0.20)",
};

// ── ParamSlider ──
export function ParamSlider({
  label,
  value,
  min,
  max,
  step = 0.5,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
  accentColor?: string;
}) {
  return (
    <WorkbenchRangeSlider
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      unit={unit}
      onChange={onChange}
      formatValue={(nextValue) => nextValue.toFixed(1)}
    />
  );
}

// ── GlassContainer ──
export function GlassContainer({
  children,
  color,
  borderColor,
  style,
}: {
  children: React.ReactNode;
  color: string;
  borderColor: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        borderRadius: "6px",
        background: "rgba(17, 19, 24, 0.95)",
        border: `1px solid rgba(255,255,255,0.10)`,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── SharedMetaboliteBus ──
export function SharedMetaboliteBus({ exchangeFluxes }: { exchangeFluxes: CommunityFBAOutput["exchangeFluxes"] }) {
  const maxFlux = Math.max(...exchangeFluxes.map((e) => Math.abs(e.flux)), 0.1);
  return (
    <GlassContainer color={COLORS.sharedBg} borderColor={COLORS.sharedBorder} style={{ padding: "14px 16px" }}>
      <p
        style={{
          fontFamily: THEME.SANS,
          fontSize: "var(--nb-fs-xs)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: COLORS.sharedPool,
          margin: "0 0 10px",
        }}
      >
        Shared Environmental Pool
      </p>
      {exchangeFluxes.map((ex) => {
        const isRightFlow = ex.fromStrain === "ecoli";
        const normalized = Math.abs(ex.flux) / maxFlux;
        const strokeW = 1.5 + normalized * 3;
        return (
          <div key={ex.id} style={{ marginBottom: "8px" }}>
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}
            >
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: "rgba(255,255,255,0.5)" }}>
                {ex.metabolite}
              </span>
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-sm)",
                  fontWeight: 600,
                  color: COLORS.sharedPool,
                  textAlign: "right",
                }}
              >
                {ex.flux.toFixed(2)} mmol/h
              </span>
            </div>
            <svg role="img" aria-label="Chart" width="100%" height="12" style={{ display: "block" }}>
              <defs>
                <linearGradient
                  id={`grad-${ex.id}`}
                  x1={isRightFlow ? "0%" : "100%"}
                  y1="0%"
                  x2={isRightFlow ? "100%" : "0%"}
                  y2="0%"
                >
                  <stop offset="0%" stopColor={COLORS.strainA} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={COLORS.strainB} stopOpacity="0.8" />
                </linearGradient>
              </defs>
              <line x1="8" y1="6" x2="100%" y2="6" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <line
                x1="8"
                y1="6"
                x2="100%"
                y2="6"
                stroke={`url(#grad-${ex.id})`}
                strokeWidth={strokeW}
                strokeLinecap="round"
                style={{ opacity: ex.flux > 0.01 ? 0.85 : 0.2 }}
              />
              <text
                x={isRightFlow ? "92%" : "4%"}
                y="10"
                fontFamily={THEME.SANS}
                fontSize="10"
                fill={COLORS.sharedPool}
                textAnchor="middle"
              >
                {isRightFlow ? "→" : "←"}
              </text>
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
              <span
                style={{
                  fontSize: "var(--nb-fs-xs)",
                  color: isRightFlow ? COLORS.strainA : COLORS.strainB,
                  fontFamily: THEME.MONO,
                }}
              >
                {ex.fromStrain === "ecoli" ? "E. coli" : "S. cerevisiae"}
              </span>
              <span
                style={{
                  fontSize: "var(--nb-fs-xs)",
                  color: isRightFlow ? COLORS.strainB : COLORS.strainA,
                  fontFamily: THEME.MONO,
                }}
              >
                {ex.toStrain === "ecoli" ? "E. coli" : "S. cerevisiae"}
              </span>
            </div>
          </div>
        );
      })}
    </GlassContainer>
  );
}

// ── StrainPanel ──
export function StrainPanel({
  label,
  color,
  borderColor,
  accentColor,
  glucoseUptake,
  oxygenUptake,
  knockouts,
  reactions,
  result,
  onGlucoseChange,
  onOxygenChange,
  onToggleKO,
  onClearKO,
}: {
  label: string;
  color: string;
  borderColor: string;
  accentColor: string;
  glucoseUptake: number;
  oxygenUptake: number;
  knockouts: string[];
  reactions: typeof REACTION_DEFS;
  result: FBAOutput;
  onGlucoseChange: (v: number) => void;
  onOxygenChange: (v: number) => void;
  onToggleKO: (id: string) => void;
  onClearKO: () => void;
}) {
  return (
    <GlassContainer
      color={color}
      borderColor={borderColor}
      style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}
    >
      <p
        style={{
          fontFamily: THEME.SANS,
          fontSize: "var(--nb-fs-xs)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: accentColor,
          margin: "0",
        }}
      >
        {label}
      </p>
      <ParamSlider
        label="Glucose"
        value={glucoseUptake}
        min={0}
        max={20}
        onChange={onGlucoseChange}
        unit="mmol/gDW/h"
        accentColor={accentColor}
      />
      <ParamSlider
        label="O₂"
        value={oxygenUptake}
        min={0}
        max={20}
        onChange={onOxygenChange}
        unit="mmol/gDW/h"
        accentColor={accentColor}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <MetricCard label="Growth Rate (μ)" value={result.growthRate} unit="h⁻¹" highlight />
        <MetricCard label="ATP Yield" value={result.atpYield} unit="mol/mol" />
        <MetricCard label="Carbon Eff." value={result.carbonEfficiency} unit="%" />
      </div>
      <p
        style={{
          fontFamily: THEME.SANS,
          fontSize: "var(--nb-fs-xs)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "rgba(255,255,255,0.55)",
          margin: "6px 0 0",
        }}
      >
        Gene Knockouts
      </p>
      <div style={{ maxHeight: "140px", overflowY: "auto" }}>
        {reactions.map((r) => {
          const isKO = knockouts.includes(r.id);
          return (
            <button
              type="button"
              aria-label={`Toggle knockout for ${r.id}`}
              aria-pressed={isKO}
              key={r.id}
              onClick={() => onToggleKO(r.id)}
              className={`nb-tool-toggle${isKO ? " nb-tool-toggle--active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "4px 8px",
                marginBottom: "2px",
                borderRadius: "var(--nb-radius-sm)",
              }}
            >
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  color: isKO ? "rgba(255,120,120,0.9)" : "rgba(255,255,255,0.5)",
                }}
              >
                {r.id}
              </span>
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: isKO ? "rgba(255,80,80,0.7)" : "rgba(255,255,255,0.12)",
                  flexShrink: 0,
                }}
              />
            </button>
          );
        })}
      </div>
      {knockouts.length > 0 && (
        <button
          aria-label="Clear all knockouts"
          onClick={onClearKO}
          className="nb-tool-toggle"
          style={{
            display: "block",
            width: "100%",
            padding: "4px 8px",
            borderRadius: "var(--nb-radius-sm)",
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-xs)",
          }}
        >
          Clear all
        </button>
      )}
    </GlassContainer>
  );
}
