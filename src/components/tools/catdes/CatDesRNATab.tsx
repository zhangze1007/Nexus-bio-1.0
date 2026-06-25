"use client";
/**
 * CatDes RNA Tab -- RNA engineering with design type, max length,
 * target sequence parameters, and RNA design engine.
 */
import React from "react";
import type { RNADesignResult, RNADesignType } from "../../../modules/rna-engine";
import { THEME } from "../../../theme";
import ParameterPanel from "../shared/ParameterPanel";
import CatDesRNAEngineeringPanel from "./CatDesRNAEngineeringPanel";
import { BORDER, GLASS, INPUT_BG, INPUT_BORDER, INPUT_TEXT, LABEL, VALUE } from "./catdesShared";

interface CatDesRNATabProps {
  rnaDesignType: RNADesignType;
  setRnaDesignType: (t: RNADesignType) => void;
  rnaTargetSeq: string;
  setRnaTargetSeq: (s: string) => void;
  rnaMaxLength: number;
  setRnaMaxLength: (n: number) => void;
  rnaResult: RNADesignResult | null;
  rnaLoading: boolean;
  handleRNADesign: () => void;
}

export default function CatDesRNATab({
  rnaDesignType,
  setRnaDesignType,
  rnaTargetSeq,
  setRnaTargetSeq,
  rnaMaxLength,
  setRnaMaxLength,
  rnaResult,
  rnaLoading,
  handleRNADesign,
}: CatDesRNATabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* RNA Design Parameters */}
      <ParameterPanel
        title="RNA Design Parameters"
        defaultCollapsed={false}
        onReset={() => {
          setRnaDesignType("sirna");
          setRnaTargetSeq("AUGAAACGCACCAGCAACAGCAACUUUGCGUACG");
          setRnaMaxLength(100);
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <span
              style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, display: "block", marginBottom: 2 }}
            >
              Design Type
            </span>
            <select
              value={rnaDesignType}
              onChange={(e) => setRnaDesignType(e.target.value as RNADesignType)}
              style={{
                width: "100%",
                padding: "5px 8px",
                background: INPUT_BG,
                border: `1px solid ${INPUT_BORDER}`,
                borderRadius: 6,
                color: INPUT_TEXT,
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_SM,
                outline: "none",
              }}
            >
              <option value="sirna">siRNA</option>
              <option value="ribozyme">Ribozyme</option>
              <option value="toehold">Toehold Switch</option>
              <option value="aptamer">Aptamer</option>
            </select>
          </div>
          <div>
            <span
              style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, display: "block", marginBottom: 2 }}
            >
              Max Length (nt)
            </span>
            <input
              type="number"
              min={20}
              max={200}
              value={rnaMaxLength}
              onChange={(e) => setRnaMaxLength(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "5px 8px",
                background: INPUT_BG,
                border: `1px solid ${INPUT_BORDER}`,
                borderRadius: 6,
                color: INPUT_TEXT,
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_SM,
                outline: "none",
              }}
            />
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <span
            style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_XS, color: LABEL, display: "block", marginBottom: 2 }}
          >
            Target mRNA Sequence
          </span>
          <textarea
            value={rnaTargetSeq}
            onChange={(e) => setRnaTargetSeq(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              padding: "6px 8px",
              background: INPUT_BG,
              border: `1px solid ${INPUT_BORDER}`,
              borderRadius: 6,
              color: INPUT_TEXT,
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              outline: "none",
              resize: "vertical",
            }}
          />
        </div>
      </ParameterPanel>

      {/* Design Action Bar */}
      <div
        style={{
          ...GLASS,
          padding: 16,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
            color: LABEL,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          RNA Engineering Engine
        </span>
        <button
          onClick={handleRNADesign}
          disabled={rnaLoading}
          className="nb-tool-toggle"
          style={{ padding: "6px 14px", fontSize: THEME.FS_SM, opacity: rnaLoading ? 0.4 : 1 }}
        >
          {rnaLoading ? "Designing..." : "Design RNA"}
        </button>
        {rnaResult && (
          <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: "rgba(255,255,255,0.4)" }}>
            {rnaResult.type.toUpperCase()} | {rnaResult.sequence.length} nt | Activity:{" "}
            {rnaResult.predictedActivity.toFixed(2)}
          </span>
        )}
      </div>

      {/* Results */}
      {rnaResult && <CatDesRNAEngineeringPanel result={rnaResult} />}
    </div>
  );
}
