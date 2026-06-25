"use client";

import { designMutantLibrary, designSequences } from "../../../services/ProEvolCampaignEngine";
import { THEME } from "../../../theme";
import { PROEVOL_THEME } from "./shared";
import { kicker } from "./sharedComponents";
import type { ProEvolState } from "./useProEvolState";

export default function SequenceDesignTab({ state }: { state: ProEvolState }) {
  const {
    scanSequence,
    pdbText,
    conservationResult,
    designResult,
    setDesignResult,
    libraryResult,
    setLibraryResult,
    designLoading,
    setDesignLoading,
    setProevolError,
  } = state;

  return (
    <div style={{ padding: "16px", display: "grid", gap: "12px" }}>
      {/* Design Controls */}
      <div
        style={{
          border: `1px solid ${PROEVOL_THEME.border}`,
          background: PROEVOL_THEME.surface,
          borderRadius: "var(--nb-radius-md)",
          padding: "14px",
        }}
      >
        <span style={kicker}>Inverse Folding Design</span>
        <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL, margin: "4px 0 12px" }}>
          Design sequences that fold into the target structure using structural constraints + BLOSUM62 plausibility.
        </p>
        <button
          onClick={() => {
            if (!scanSequence) return;
            setDesignLoading(true);
            try {
              const designs = designSequences({
                sequence: scanSequence,
                pdbText: pdbText ?? undefined,
                fixedPositions: conservationResult?.conservedPositions,
                numDesigns: 10,
              });
              setDesignResult(designs);

              // Also design mutant library
              const variablePos = conservationResult?.variablePositions.slice(0, 8) ?? [];
              const library = designMutantLibrary({
                sequence: scanSequence,
                positions: variablePos,
                candidatesPerPosition: variablePos.map(() => "ACDEFGHIKLMNPQRSTVWY".split("")),
                librarySize: 20,
                pdbText: pdbText ?? undefined,
              });
              setLibraryResult(library);
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Sequence design failed";
              setProevolError(msg);
            } finally {
              setDesignLoading(false);
            }
          }}
          disabled={!scanSequence || designLoading}
          style={{
            padding: "6px 12px",
            borderRadius: "var(--nb-radius-sm)",
            background: !scanSequence || designLoading ? "rgba(255,255,255,0.04)" : "rgba(191,220,205,0.14)",
            border: `1px solid ${!scanSequence || designLoading ? "rgba(255,255,255,0.08)" : "rgba(191,220,205,0.3)"}`,
            color: !scanSequence || designLoading ? "rgba(255,255,255,0.35)" : PROEVOL_THEME.mint,
            fontFamily: THEME.MONO,
            fontSize: "var(--nb-fs-xs)",
            cursor: "pointer",
          }}
        >
          {designLoading ? "Designing…" : "Design Sequences"}
        </button>
      </div>

      {/* Designed Sequences */}
      {designResult && (
        <div
          style={{
            border: `1px solid ${PROEVOL_THEME.border}`,
            background: PROEVOL_THEME.surface,
            borderRadius: "var(--nb-radius-md)",
            padding: "14px",
          }}
        >
          <span style={kicker}>Designed Sequences ({designResult.designs.length})</span>
          <div style={{ marginTop: 8, fontFamily: THEME.MONO, fontSize: 10, maxHeight: 300, overflow: "auto" }}>
            {designResult.designs.slice(0, 10).map((d, i) => (
              <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ color: THEME.SKY, width: 20 }}>#{i + 1}</span>
                  <span style={{ color: THEME.VALUE }}>{d.mutations.length} mutations</span>
                  <span style={{ color: THEME.LABEL }}>
                    S:{d.scores.stability.toFixed(2)} P:{d.scores.plausibility.toFixed(2)} C:
                    {d.scores.compatibility.toFixed(2)}
                  </span>
                  <span style={{ color: THEME.MINT, fontWeight: 600 }}>Σ:{d.scores.composite.toFixed(3)}</span>
                </div>
                <div style={{ color: THEME.LABEL, fontSize: 9, marginTop: 2 }}>
                  {d.mutations
                    .slice(0, 5)
                    .map((m) => `${m.wt}${m.position}${m.mut}`)
                    .join(" ")}
                  {d.mutations.length > 5 ? ` +${d.mutations.length - 5} more` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mutant Library */}
      {libraryResult && (
        <div
          style={{
            border: `1px solid ${PROEVOL_THEME.border}`,
            background: PROEVOL_THEME.surface,
            borderRadius: "var(--nb-radius-md)",
            padding: "14px",
          }}
        >
          <span style={kicker}>Mutant Library (Pareto-optimal)</span>
          <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: THEME.LABEL, margin: "4px 0 8px" }}>
            {libraryResult.stats.totalEnumerated} enumerated → {libraryResult.stats.paretoFrontSize} Pareto-optimal →{" "}
            {libraryResult.stats.librarySize} selected
          </p>
          <div style={{ fontFamily: THEME.MONO, fontSize: 10, maxHeight: 200, overflow: "auto" }}>
            {libraryResult.library.slice(0, 20).map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "2px 0" }}>
                <span style={{ width: 20, color: THEME.SKY }}>{i + 1}</span>
                <span style={{ color: THEME.VALUE }}>
                  {m.mutations.map((mut) => `${mut.wt}${mut.position}${mut.mut}`).join(" ")}
                </span>
                <span style={{ color: THEME.LABEL }}>
                  S:{m.scores.stability.toFixed(2)} F:{m.scores.fitness.toFixed(2)} D:{m.scores.diversity.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
