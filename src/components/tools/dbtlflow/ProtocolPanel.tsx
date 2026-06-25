"use client";
import React from "react";
import { THEME } from "../../../theme";
import type { DBTLIteration, GeneratedProtocol, SBOLDocument } from "../../../types";
import ActionButton from "../shared/ActionButton";
import ScientificFigureFrame from "../shared/ScientificFigureFrame";

/* ── Props ── */
interface ProtocolPanelProps {
  generatedProtocol: GeneratedProtocol | null;
  handleGenerateProtocol: () => void;
  handleDownloadProtocol: () => void;
  latestIteration: DBTLIteration | undefined;
  sbolDoc: SBOLDocument | null;
  sbolValidation: string[];
  handleSBOLExport: () => void;
  handleDownloadSBOL: (format: "xml" | "turtle") => void;
}

export default function ProtocolPanel({
  generatedProtocol,
  handleGenerateProtocol,
  handleDownloadProtocol,
  latestIteration,
  sbolDoc,
  sbolValidation,
  handleSBOLExport,
  handleDownloadSBOL,
}: ProtocolPanelProps) {
  return (
    <div style={{ padding: "16px", maxWidth: "640px" }}>
      <ActionButton
        variant="secondary"
        size="md"
        aria-label="Generate protocol"
        onClick={handleGenerateProtocol}
        disabled={!latestIteration}
        style={{ background: "rgba(207,196,227,0.2)", borderColor: "rgba(207,196,227,0.34)", marginBottom: "16px" }}
      >
        ⚗ Generate Protocol
      </ActionButton>
      {generatedProtocol && (
        <ScientificFigureFrame
          eyebrow="Protocol"
          title={generatedProtocol.metadata.protocolName}
          caption={`API ${generatedProtocol.api_version} · ${generatedProtocol.labware.length} labware · ${generatedProtocol.pipetting_logic.length} steps`}
        >
          <p
            style={{
              fontFamily: THEME.SANS,
              fontSize: "var(--nb-fs-sm)",
              color: THEME.LABEL,
              lineHeight: 1.6,
              margin: "0 0 12px",
            }}
          >
            {generatedProtocol.metadata.description}
          </p>
          <ActionButton variant="secondary" size="sm" onClick={handleDownloadProtocol}>
            ↓ Download .py
          </ActionButton>
        </ScientificFigureFrame>
      )}
      <div style={{ marginTop: "24px" }}>
        <p
          style={{
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
            color: THEME.LABEL,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            margin: "0 0 12px",
          }}
        >
          SBOL 3.0 Export
        </p>
        <ActionButton
          variant="secondary"
          size="md"
          onClick={handleSBOLExport}
          style={{ background: "rgba(175,195,214,0.2)", borderColor: "rgba(175,195,214,0.34)", marginBottom: "12px" }}
        >
          ◎ Serialize to SBOL 3.0
        </ActionButton>
        {sbolDoc && (
          <div
            style={{
              background: THEME.PANEL_INSET,
              border: `1px solid ${THEME.BORDER}`,
              borderRadius: "var(--nb-radius-lg)",
              padding: "14px",
            }}
          >
            <p
              style={{
                fontFamily: THEME.SANS,
                fontSize: "var(--nb-fs-sm)",
                color: THEME.VALUE,
                fontWeight: 600,
                margin: "0 0 6px",
              }}
            >
              {sbolDoc.name}
            </p>
            <p style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL, margin: "0 0 8px" }}>
              {sbolDoc.components.length} components · {sbolDoc.interactions.length} interactions
            </p>
            {sbolValidation.map((v, i) => (
              <p
                key={i}
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: "var(--nb-fs-xs)",
                  margin: "0 0 3px",
                  color: v.startsWith("VALID") ? THEME.MINT : v.startsWith("ERROR") ? THEME.CORAL : THEME.APRICOT,
                }}
              >
                {v}
              </p>
            ))}
            <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
              <ActionButton variant="secondary" size="sm" onClick={() => handleDownloadSBOL("xml")}>
                ↓ RDF/XML
              </ActionButton>
              <ActionButton variant="secondary" size="sm" onClick={() => handleDownloadSBOL("turtle")}>
                ↓ Turtle
              </ActionButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
