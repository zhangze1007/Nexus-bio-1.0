"use client";
import React from "react";
import { toolTokens } from "../../../hooks/useToolTheme";
import type {
  BindingAffinityResult,
  CatalyticResidue,
  EnzymeStructure,
} from "../../../services/CatalystDesignerEngine";
import type { BRENDAKinetics } from "../../../services/database/brendaClient";
import { THEME } from "../../../theme";
import DataSourceBadge from "../../ide/shared/DataSourceBadge";
import { PATHD_FLOATING_PANEL_SHEEN, PATHD_FLOATING_PANEL_SURFACE } from "../shared/pathdFloatingPanelStyles";

const {
  border: BORDER,
  label: LABEL,
  value: VALUE,
  inputBg: INPUT_BG,
  inputBorder: INPUT_BORDER,
  inputText: INPUT_TEXT,
} = toolTokens;
const tn: React.CSSProperties = { fontFeatureSettings: "'tnum' 1" };

// PathD-style glassmorphism for sections
const GLASS: React.CSSProperties = {
  ...PATHD_FLOATING_PANEL_SURFACE,
  padding: "12px 14px",
};

/* ── Docking Result Interface (matches CatalystDesignerPage) ──────── */

interface DockingResult {
  protein: string;
  ligand: string;
  dockingScore: number;
  bindingEnergy: number;
  contactsFound: number;
  source: string;
}

/* ── Props ────────────────────────────────────────────────────────── */

export interface CatDesSidebarProps {
  enzyme: EnzymeStructure;
  activeEnzyme: EnzymeStructure;
  brendaData: BRENDAKinetics | null;
  brendaSource: "live" | "mock";
  binding: BindingAffinityResult;
  dockingResult: DockingResult | null;
  selectedResidue: number | null;
  selectedCatResidue: CatalyticResidue | null;
  selectedMutation: string | null;
  onMutationChange: (mut: string | null) => void;
  mutationImpact: { deltaG?: number; newKd?: number; confidence?: number } | null;
}

/* ── Quality helpers ──────────────────────────────────────────────── */

function kdQuality(kd: number) {
  if (kd < 1) return { color: "#93CB52", label: "Excellent" };
  if (kd < 10) return { color: "#BFDCCD", label: "Good" };
  if (kd < 100) return { color: "#E8DCC8", label: "Moderate" };
  if (kd < 1000) return { color: "#E8A3A1", label: "Weak" };
  return { color: "#FA8072", label: "Very weak" };
}

function kcatQuality(kcat: number) {
  if (kcat > 100) return { color: "#93CB52", label: "Excellent" };
  if (kcat > 10) return { color: "#BFDCCD", label: "Good" };
  if (kcat > 1) return { color: "#E8DCC8", label: "Moderate" };
  return { color: "#E8A3A1", label: "Slow" };
}

/* ── Section wrapper ──────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", ...GLASS }}>
      <div style={{ ...PATHD_FLOATING_PANEL_SHEEN, borderRadius: "inherit" }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            fontFamily: THEME.MONO,
            fontSize: "10px",
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 8,
          }}
        >
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Metric row ───────────────────────────────────────────────────── */

function MetricRow({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
      <span style={{ fontFamily: THEME.SANS, fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>{label}</span>
      <span style={{ fontFamily: THEME.MONO, fontSize: "12px", color: accent ?? "rgba(255,255,255,0.85)", ...tn }}>
        {value}
        {unit && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginLeft: 3 }}>{unit}</span>}
      </span>
    </div>
  );
}

/* ── Main Sidebar Component ───────────────────────────────────────── */

export default React.memo(function CatDesSidebar({
  enzyme,
  activeEnzyme,
  brendaData,
  brendaSource,
  binding,
  dockingResult,
  selectedResidue,
  selectedCatResidue,
  selectedMutation,
  onMutationChange,
  mutationImpact,
}: CatDesSidebarProps) {
  const kdQ = kdQuality(binding.predictedKd);
  const kcatQ = kcatQuality(activeEnzyme.kcat);
  const kcatKm = activeEnzyme.km > 0 ? activeEnzyme.kcat / activeEnzyme.km : 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
        overflowY: "auto",
        padding: "10px 12px",
      }}
    >
      {/* ── 1. Enzyme Header ── */}
      <Section title="Enzyme">
        <div
          style={{
            fontFamily: THEME.SANS,
            fontSize: "14px",
            fontWeight: 700,
            color: "rgba(255,255,255,0.9)",
            marginBottom: 2,
          }}
        >
          {enzyme.name}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: "11px",
              color: "#c4b8a8",
              padding: "1px 6px",
              borderRadius: 4,
              background: "rgba(196,184,168,0.1)",
              border: "1px solid rgba(196,184,168,0.2)",
            }}
          >
            EC {enzyme.ecNumber}
          </span>
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: "11px",
              color: "#AFC3D6",
              padding: "1px 6px",
              borderRadius: 4,
              background: "rgba(175,195,214,0.1)",
              border: "1px solid rgba(175,195,214,0.2)",
            }}
          >
            {enzyme.uniprotId}
          </span>
        </div>
        <div style={{ marginTop: 6, fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: LABEL }}>
          {enzyme.substrate} <span style={{ color: VALUE }}>→</span> {enzyme.product}
        </div>
      </Section>

      {/* ── 2. Kinetics ── */}
      <Section title="Kinetics">
        <MetricRow label="Km" value={activeEnzyme.km.toFixed(3)} unit="mM" />
        <MetricRow label="kcat" value={activeEnzyme.kcat.toFixed(2)} unit="s⁻¹" accent={kcatQ.color} />
        <MetricRow label="kcat / Km" value={kcatKm.toFixed(1)} unit="mM⁻¹s⁻¹" accent={THEME.MINT} />
        <MetricRow label="Tm" value={enzyme.meltingTemp.toFixed(0)} unit="°C" accent={THEME.APRICOT} />
        {brendaData && brendaData.km.length > 0 && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <DataSourceBadge source={brendaSource} />
            <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>
              BRENDA: Km {brendaData.km[0].value} {brendaData.km[0].unit}
            </span>
          </div>
        )}
      </Section>

      {/* ── 3. Binding ── */}
      <Section title="Binding Affinity">
        <MetricRow label="Kd" value={binding.predictedKd.toFixed(2)} unit="μM" accent={kdQ.color} />
        <MetricRow label="Overall Score" value={binding.overallScore.toFixed(3)} accent={THEME.SKY} />
        <MetricRow label="ΔG" value={binding.bindingEnergy.toFixed(2)} unit="kcal/mol" accent={THEME.CORAL} />

        {/* Energy decomposition mini bars */}
        <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 8px" }}>
          {[
            { label: "Dist", value: binding.distanceScore, color: THEME.MINT },
            { label: "Orient", value: binding.orientationScore, color: THEME.SKY },
            { label: "vdW", value: binding.vdwScore, color: THEME.APRICOT },
            { label: "Electro", value: binding.electrostaticScore, color: THEME.LILAC },
          ].map((ax) => (
            <div key={ax.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: "10px", color: LABEL, minWidth: 36 }}>{ax.label}</span>
              <div
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background: "rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, ax.value * 100)}%`,
                    height: "100%",
                    borderRadius: 2,
                    background: ax.color,
                    opacity: 0.8,
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "10px",
                  color: VALUE,
                  minWidth: 24,
                  textAlign: "right",
                  ...tn,
                }}
              >
                {ax.value.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Docking contacts */}
        {dockingResult && (
          <div
            style={{
              marginTop: 8,
              padding: "6px 8px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${BORDER}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Docking Score</span>
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE, ...tn }}>
                {dockingResult.dockingScore.toFixed(3)} kcal/mol
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Contacts</span>
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE, ...tn }}>
                {dockingResult.contactsFound}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <DataSourceBadge source={dockingResult.source === "mock" ? "mock" : "live"} />
              <span style={{ fontFamily: THEME.MONO, fontSize: "10px", color: LABEL }}>±2 kcal/mol</span>
            </div>
          </div>
        )}

        {/* Uncertainty annotation */}
        <div style={{ marginTop: 4, fontFamily: THEME.MONO, fontSize: "10px", color: LABEL, opacity: 0.6 }}>
          ±{binding.uncertaintyDeltaG.toFixed(1)} kcal/mol (empirical)
        </div>
      </Section>

      {/* ── 4. Selected Residue ── */}
      {selectedResidue != null && selectedCatResidue ? (
        <Section title="Selected Residue">
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-md)", color: "#FFDB13", fontWeight: 700 }}>
              {selectedCatResidue.residue}
              {selectedResidue}
            </span>
            <span
              style={{
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                color: THEME.MINT,
                background: "rgba(191,220,205,0.12)",
                padding: "2px 5px",
                borderRadius: 4,
              }}
            >
              {selectedCatResidue.role.replace("_", " ")}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 8px" }}>
            <div>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Distance</span>
              <p style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE, margin: 0, ...tn }}>
                {selectedCatResidue.distanceToSubstrate.toFixed(1)} A
              </p>
            </div>
            <div>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Angle</span>
              <p style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE, margin: 0, ...tn }}>
                {selectedCatResidue.orientationAngle.toFixed(0)} deg
              </p>
            </div>
            <div>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>Optimal</span>
              <p style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE, margin: 0, ...tn }}>
                {selectedCatResidue.optimalDistance.toFixed(1)} A
              </p>
            </div>
            <div>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL }}>pKa Shift</span>
              <p
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  margin: 0,
                  ...tn,
                  color: Math.abs(selectedCatResidue.pKaShift) > 0.5 ? THEME.CORAL : VALUE,
                }}
              >
                {selectedCatResidue.pKaShift > 0 ? "+" : ""}
                {selectedCatResidue.pKaShift.toFixed(2)}
              </p>
            </div>
          </div>
        </Section>
      ) : (
        <Section title="Selected Residue">
          <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, margin: 0 }}>
            Click a residue in the 3D viewer to inspect it.
          </p>
        </Section>
      )}

      {/* ── 5. Mutation Selector ── */}
      <Section title="Mutation Predictor">
        <div style={{ marginBottom: 6 }}>
          <span
            style={{
              fontFamily: THEME.SANS,
              fontSize: "var(--nb-fs-xs)",
              color: LABEL,
              display: "block",
              marginBottom: 3,
            }}
          >
            Mutate to
          </span>
          <select
            value={selectedMutation ?? ""}
            onChange={(e) => onMutationChange(e.target.value || null)}
            style={{
              width: "100%",
              fontFamily: THEME.MONO,
              fontSize: "var(--nb-fs-sm)",
              fontWeight: 600,
              color: VALUE,
              background: INPUT_BG,
              border: `1px solid ${INPUT_BORDER}`,
              borderRadius: 6,
              padding: "4px 6px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="">-- select --</option>
            {"ACDEFGHIKLMNPQRSTVWY"
              .split("")
              .filter((aa) => (selectedCatResidue ? aa !== selectedCatResidue.residue : true))
              .map((aa) => (
                <option key={aa} value={aa}>
                  {aa}
                </option>
              ))}
          </select>
        </div>

        {mutationImpact ? (
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              background: (mutationImpact.deltaG ?? 0) < 0 ? "rgba(147,203,82,0.06)" : "rgba(250,128,114,0.06)",
              border: `1px solid ${(mutationImpact.deltaG ?? 0) < 0 ? "rgba(147,203,82,0.15)" : "rgba(250,128,114,0.15)"}`,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px" }}>
              <div>
                <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>ddG</span>
                <p
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: "var(--nb-fs-sm)",
                    margin: 0,
                    ...tn,
                    color: (mutationImpact.deltaG ?? 0) < 0 ? THEME.MINT : THEME.CORAL,
                  }}
                >
                  {(mutationImpact.deltaG ?? 0) > 0 ? "+" : ""}
                  {(mutationImpact.deltaG ?? 0).toFixed(2)}{" "}
                  <span style={{ fontSize: "var(--nb-fs-xxs)", color: LABEL }}>kcal/mol</span>
                </p>
              </div>
              <div>
                <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>New Kd</span>
                <p style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: VALUE, margin: 0, ...tn }}>
                  {(mutationImpact.newKd ?? 0).toFixed(2)}{" "}
                  <span style={{ fontSize: "var(--nb-fs-xxs)", color: LABEL }}>uM</span>
                </p>
              </div>
              <div>
                <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>Confidence</span>
                <p
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: "var(--nb-fs-sm)",
                    margin: 0,
                    ...tn,
                    color:
                      (mutationImpact.confidence ?? 0) > 0.7
                        ? THEME.MINT
                        : (mutationImpact.confidence ?? 0) > 0.5
                          ? THEME.RISK_LOW
                          : THEME.CORAL,
                  }}
                >
                  {((mutationImpact.confidence ?? 0) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
            <p
              style={{
                margin: "6px 0 0",
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xxs)",
                color: LABEL,
                opacity: 0.6,
                lineHeight: 1.4,
              }}
            >
              BLOSUM62-based ddG estimate. Negative = stabilizing.
            </p>
          </div>
        ) : selectedMutation ? (
          <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, margin: 0 }}>
            Select a catalytic residue in the 3D viewer first.
          </p>
        ) : (
          <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, margin: 0 }}>
            Select a mutation to predict ddG.
          </p>
        )}
      </Section>
    </div>
  );
});
