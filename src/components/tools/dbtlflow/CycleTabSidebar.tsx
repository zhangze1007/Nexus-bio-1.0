"use client";
import React from "react";
import { THEME } from "../../../theme";
import type { DBTLIteration, GeneratedProtocol, GibsonAssemblyPlan, SBOLDocument } from "../../../types";
import SimErrorBanner from "../../ide/shared/SimErrorBanner";
import ActionButton from "../shared/ActionButton";
import ScientificFigureFrame from "../shared/ScientificFigureFrame";
import { inputBase, sectionLabel } from "./sharedComponents";

/* ── Props ── */
interface CycleTabSidebarProps {
  iterations: DBTLIteration[];
  hypothesis: string;
  setHypothesis: (v: string) => void;
  result: string;
  setResult: (v: string) => void;
  unit: string;
  setUnit: (v: string) => void;
  passed: boolean;
  setPassed: (v: boolean) => void;
  addIteration: () => void;
  bestIteration: DBTLIteration;
  generatedProtocol: GeneratedProtocol | null;
  protocolExpanded: boolean;
  setProtocolExpanded: (fn: (prev: boolean) => boolean) => void;
  handleGenerateProtocol: () => void;
  handleDownloadProtocol: () => void;
  latestIteration: DBTLIteration | undefined;
  sbolDoc: SBOLDocument | null;
  sbolValidation: string[];
  handleSBOLExport: () => void;
  handleDownloadSBOL: (format: "xml" | "turtle") => void;
  assemblyPlan: GibsonAssemblyPlan | null;
  assemblyExpanded: boolean;
  setAssemblyExpanded: (fn: (prev: boolean) => boolean) => void;
  assemblyError: string | null;
  seqInput: string;
  setSeqInput: (v: string) => void;
  handlePlanAssembly: () => void;
  handleDownloadPrimers: () => void;
  handleGenerateGibsonProtocol: () => void;
  liveDraft: { unit: string };
}

export default function CycleTabSidebar({
  iterations,
  hypothesis,
  setHypothesis,
  result,
  setResult,
  unit,
  setUnit,
  passed,
  setPassed,
  addIteration,
  bestIteration,
  generatedProtocol,
  protocolExpanded,
  setProtocolExpanded,
  handleGenerateProtocol,
  handleDownloadProtocol,
  latestIteration,
  sbolDoc,
  sbolValidation,
  handleSBOLExport,
  handleDownloadSBOL,
  assemblyPlan,
  assemblyExpanded,
  setAssemblyExpanded,
  assemblyError,
  seqInput,
  setSeqInput,
  handlePlanAssembly,
  handleDownloadPrimers,
  handleGenerateGibsonProtocol,
  liveDraft,
}: CycleTabSidebarProps) {
  return (
    <div
      className="nb-tool-sidebar"
      style={{
        width: "260px",
        flexShrink: 0,
        padding: "16px",
        borderRight: `1px solid ${THEME.paperBorder}`,
        background: THEME.sepiaPanelMuted,
      }}
    >
      <p style={sectionLabel}>Add Iteration</p>

      {/* Hypothesis */}
      <div style={{ marginBottom: "10px" }}>
        <label
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-sm)",
            color: THEME.paperLabel,
            display: "block",
            marginBottom: "4px",
          }}
        >
          Hypothesis
        </label>
        <textarea
          value={hypothesis}
          onChange={(e) => setHypothesis(e.target.value)}
          placeholder="Describe the engineering hypothesis..."
          rows={3}
          style={{
            ...inputBase,
            padding: "6px 8px",
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-sm)",
            resize: "vertical",
          }}
        />
      </div>

      {/* Result + Unit */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
        <div style={{ flex: 1 }}>
          <label
            style={{
              fontFamily: THEME.SANS,
              fontSize: "var(--nb-fs-sm)",
              color: THEME.paperLabel,
              display: "block",
              marginBottom: "4px",
            }}
          >
            Result
          </label>
          <input
            type="number"
            value={result}
            onChange={(e) => setResult(e.target.value)}
            placeholder="0.0"
            style={inputBase}
          />
        </div>
        <div style={{ width: "70px" }}>
          <label
            style={{
              fontFamily: THEME.SANS,
              fontSize: "var(--nb-fs-sm)",
              color: THEME.paperLabel,
              display: "block",
              marginBottom: "4px",
            }}
          >
            Unit
          </label>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            style={{ ...inputBase, padding: "5px 6px", fontSize: "var(--nb-fs-sm)" }}
          />
        </div>
      </div>

      {/* Pass / Fail */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        {([true, false] as const).map((p) => (
          <button
            aria-label={p ? "Mark iteration as pass" : "Mark iteration as fail"}
            key={String(p)}
            onClick={() => setPassed(p)}
            className={`nb-tool-toggle ${passed === p ? "nb-tool-toggle--active" : ""}`}
            style={{
              flex: 1,
              padding: "6px",
              background: passed === p ? (p ? "rgba(191,220,205,0.2)" : "rgba(232,163,161,0.18)") : undefined,
              borderColor: passed === p ? (p ? "rgba(191,220,205,0.34)" : "rgba(232,163,161,0.34)") : undefined,
              borderRadius: "var(--nb-radius-sm)",
              color: passed === p ? THEME.paperValue : undefined,
            }}
          >
            {p ? "✓ Pass" : "✗ Fail"}
          </button>
        ))}
      </div>

      {/* Add iteration button */}
      <ActionButton
        variant="primary"
        size="md"
        aria-label="Add DBTL iteration"
        onClick={addIteration}
        disabled={!hypothesis.trim() || !result.trim()}
        style={{ width: "100%" }}
      >
        + Add Iteration
      </ActionButton>

      {/* Best Result */}
      <div
        style={{
          marginTop: "16px",
          padding: "10px",
          background: "rgba(191,220,205,0.18)",
          borderRadius: "var(--nb-radius-md)",
          border: "1px solid rgba(191,220,205,0.34)",
        }}
      >
        <p
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-xs)",
            color: THEME.paperLabel,
            margin: "0 0 6px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Best Result
        </p>
        <p style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-md)", color: THEME.paperValue, margin: "0 0 4px" }}>
          {bestIteration?.result} {bestIteration?.unit}
        </p>
        <p
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-xs)",
            color: THEME.paperLabel,
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {bestIteration?.hypothesis.slice(0, 60)}…
        </p>
      </div>

      {/* ── Protocol Generation ── */}
      <div style={{ marginTop: "16px" }}>
        <p style={sectionLabel}>Protocol Generation</p>
        <ActionButton
          variant="secondary"
          size="md"
          aria-label="Generate protocol"
          onClick={handleGenerateProtocol}
          disabled={!latestIteration}
          style={{ width: "100%", background: "rgba(207,196,227,0.2)", borderColor: "rgba(207,196,227,0.34)" }}
        >
          ⚗ Generate Protocol
        </ActionButton>

        {generatedProtocol && (
          <div
            style={{
              background: THEME.paperSurfaceStrong,
              border: `1px solid ${THEME.paperBorder}`,
              borderRadius: "var(--nb-radius-xl)",
              marginTop: "10px",
              padding: "12px",
            }}
          >
            <div
              onClick={() => setProtocolExpanded((prev) => !prev)}
              style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <span
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: "var(--nb-fs-xs)",
                  color: THEME.paperValue,
                  fontWeight: 500,
                }}
              >
                {generatedProtocol.metadata.protocolName}
              </span>
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.paperLabel }}>
                {protocolExpanded ? "▾" : "▸"}
              </span>
            </div>

            {protocolExpanded && (
              <div style={{ marginTop: "8px" }}>
                <p
                  style={{
                    fontFamily: THEME.SANS,
                    fontSize: "var(--nb-fs-xs)",
                    color: THEME.paperLabel,
                    margin: "0 0 4px",
                  }}
                >
                  {generatedProtocol.metadata.description}
                </p>
                <p
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: "var(--nb-fs-xs)",
                    color: THEME.paperLabel,
                    margin: "0 0 8px",
                  }}
                >
                  API {generatedProtocol.api_version} · {generatedProtocol.labware.length} labware ·{" "}
                  {generatedProtocol.pipetting_logic.length} steps
                </p>
                <ActionButton
                  variant="secondary"
                  size="sm"
                  aria-label="Download Python protocol"
                  onClick={handleDownloadProtocol}
                  style={{ width: "100%", background: "rgba(207,196,227,0.22)", borderColor: "rgba(207,196,227,0.34)" }}
                >
                  ↓ Download .py
                </ActionButton>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SBOL 3.0 Export ── */}
      <div style={{ marginTop: "16px" }}>
        <p style={sectionLabel}>SBOL 3.0 Export</p>
        <ActionButton
          variant="secondary"
          size="md"
          aria-label="Serialize to SBOL 3.0"
          onClick={handleSBOLExport}
          style={{ width: "100%", background: "rgba(175,195,214,0.2)", borderColor: "rgba(175,195,214,0.34)" }}
        >
          ◎ Serialize to SBOL 3.0
        </ActionButton>
        {sbolDoc && (
          <div
            style={{
              background: THEME.paperSurfaceStrong,
              border: `1px solid ${THEME.paperBorder}`,
              borderRadius: "var(--nb-radius-xl)",
              marginTop: "10px",
              padding: "12px",
            }}
          >
            <p
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-xs)",
                color: THEME.paperValue,
                fontWeight: 500,
                margin: "0 0 6px",
              }}
            >
              {sbolDoc.name}
            </p>
            <p
              style={{
                fontFamily: THEME.MONO,
                fontSize: "var(--nb-fs-xs)",
                color: THEME.paperLabel,
                margin: "0 0 8px",
              }}
            >
              {sbolDoc.components.length} components · {sbolDoc.interactions.length} interactions
            </p>
            {sbolValidation.map((v, i) => (
              <p
                key={i}
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  margin: "0 0 3px",
                  lineHeight: 1.3,
                  color: v.startsWith("VALID") ? THEME.mint : v.startsWith("ERROR") ? THEME.coral : THEME.apricot,
                }}
              >
                {v}
              </p>
            ))}
            <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
              <ActionButton
                variant="secondary"
                size="sm"
                aria-label="Download SBOL as RDF/XML"
                onClick={() => handleDownloadSBOL("xml")}
                style={{ flex: 1, background: "rgba(175,195,214,0.22)", borderColor: "rgba(175,195,214,0.34)" }}
              >
                ↓ RDF/XML
              </ActionButton>
              <ActionButton
                variant="secondary"
                size="sm"
                aria-label="Download SBOL as Turtle"
                onClick={() => handleDownloadSBOL("turtle")}
                style={{ flex: 1, background: "rgba(207,196,227,0.22)", borderColor: "rgba(207,196,227,0.34)" }}
              >
                ↓ Turtle
              </ActionButton>
            </div>
          </div>
        )}
      </div>

      {/* ── Gibson Assembly Planner ── */}
      <div style={{ marginTop: "16px" }}>
        <p style={sectionLabel}>Gibson Assembly</p>
        <textarea
          value={seqInput}
          onChange={(e) => setSeqInput(e.target.value)}
          placeholder="Paste target DNA (ATCG)… or leave empty for demo"
          rows={2}
          style={{
            ...inputBase,
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
            resize: "vertical",
            marginBottom: "8px",
          }}
        />
        {assemblyError && (
          <div style={{ marginBottom: "8px" }}>
            <SimErrorBanner message={assemblyError} />
          </div>
        )}
        <ActionButton
          variant="secondary"
          size="md"
          aria-label="Plan Gibson assembly"
          onClick={handlePlanAssembly}
          style={{ width: "100%", background: "rgba(191,220,205,0.2)", borderColor: "rgba(191,220,205,0.34)" }}
        >
          🧬 Plan Assembly
        </ActionButton>
        {assemblyPlan && (
          <div
            style={{
              background: THEME.paperSurfaceStrong,
              border: `1px solid ${THEME.paperBorder}`,
              borderRadius: "var(--nb-radius-xl)",
              marginTop: "10px",
              padding: "12px",
            }}
          >
            <div
              onClick={() => setAssemblyExpanded((p) => !p)}
              style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <span
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: "var(--nb-fs-xs)",
                  color: THEME.paperValue,
                  fontWeight: 500,
                }}
              >
                {assemblyPlan.targetName}
              </span>
              <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.paperLabel }}>
                {assemblyExpanded ? "▾" : "▸"}
              </span>
            </div>
            {assemblyExpanded && (
              <div style={{ marginTop: "8px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "10px" }}>
                  {(
                    [
                      ["Target", assemblyPlan.targetLength + " bp"],
                      ["Fragments", String(assemblyPlan.fragments.length)],
                      ["Primers", String(assemblyPlan.primers.length)],
                      ["Overlap", assemblyPlan.overlapLength + " bp"],
                      [
                        "Tm Range",
                        assemblyPlan.expectedTmRange[0].toFixed(1) +
                          "–" +
                          assemblyPlan.expectedTmRange[1].toFixed(1) +
                          " °C",
                      ],
                      ["Tm Spread", assemblyPlan.tmSpread.toFixed(1) + " °C"],
                    ] as const
                  ).map(([lbl, val]) => (
                    <div key={lbl} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: THEME.paperLabel }}>
                        {lbl}
                      </span>
                      <span
                        style={{
                          fontFamily: THEME.MONO,
                          fontSize: "var(--nb-fs-xs)",
                          color: THEME.paperValue,
                          textAlign: "right",
                        }}
                      >
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    height: "4px",
                    borderRadius: "2px",
                    marginBottom: "8px",
                    background: "rgba(255,255,255,0.06)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: "2px",
                      width: Math.min(100, assemblyPlan.tmSpread * 20) + "%",
                      background:
                        assemblyPlan.tmSpread <= 3
                          ? "rgba(120,220,160,0.7)"
                          : assemblyPlan.tmSpread <= 5
                            ? "rgba(231,199,169,0.78)"
                            : "rgba(232,163,161,0.78)",
                    }}
                  />
                </div>
                {assemblyPlan.warnings.length > 0 && (
                  <div style={{ marginBottom: "8px" }}>
                    {assemblyPlan.warnings.map((w, i) => (
                      <p
                        key={i}
                        style={{
                          fontFamily: THEME.SANS,
                          fontSize: "var(--nb-fs-xs)",
                          color: THEME.apricot,
                          margin: "0 0 3px",
                          lineHeight: 1.3,
                        }}
                      >
                        ⚠ {w}
                      </p>
                    ))}
                  </div>
                )}
                <p
                  style={{
                    fontFamily: THEME.SANS,
                    fontSize: "var(--nb-fs-xs)",
                    color: THEME.paperLabel,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    margin: "0 0 6px",
                  }}
                >
                  Fragment Map
                </p>
                <div style={{ display: "flex", gap: "2px", marginBottom: "10px" }}>
                  {assemblyPlan.fragments.map((f, i) => {
                    const colors = [
                      "rgba(191,220,205,0.34)",
                      "rgba(207,196,227,0.34)",
                      "rgba(175,195,214,0.34)",
                      "rgba(232,163,161,0.34)",
                    ];
                    const borders = [
                      "rgba(191,220,205,0.58)",
                      "rgba(207,196,227,0.58)",
                      "rgba(175,195,214,0.58)",
                      "rgba(232,163,161,0.58)",
                    ];
                    return (
                      <div
                        key={f.id}
                        style={{
                          flex: f.length / assemblyPlan.targetLength,
                          height: "16px",
                          borderRadius: "3px",
                          background: colors[i % 4],
                          border: "1px solid " + borders[i % 4],
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.paperValue }}>
                          {f.length}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                  <ActionButton
                    variant="secondary"
                    size="sm"
                    aria-label="Download primers as CSV"
                    onClick={handleDownloadPrimers}
                    style={{ flex: 1, background: "rgba(191,220,205,0.22)", borderColor: "rgba(191,220,205,0.34)" }}
                  >
                    ↓ Primers CSV
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    size="sm"
                    aria-label="Generate OT-2 protocol"
                    onClick={handleGenerateGibsonProtocol}
                    style={{ flex: 1, background: "rgba(175,195,214,0.22)", borderColor: "rgba(175,195,214,0.34)" }}
                  >
                    ⚗ OT-2 Protocol
                  </ActionButton>
                </div>
                <p style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.paperLabel, margin: 0 }}>
                  Provenance: {assemblyPlan.provenanceId.slice(0, 8)}…
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
