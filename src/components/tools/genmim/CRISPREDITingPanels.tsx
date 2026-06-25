"use client";
/**
 * CRISPR Editing Panels — Prime Editing, Base Editing, Epigenome Editing, PASTE
 *
 * Extends GenMIM beyond CRISPRi to precision editing tools.
 */
import React, { useMemo, useState } from "react";
import { THEME } from "../../../theme";
import type { BaseEditorType, EpigenomeEffector } from "../../../server/crisprEditingEngine";
import { designBaseEdit, designEpigenomeEdit, designPASTE, designPrimeEdit } from "../../../server/crisprEditingEngine";
import MetricCard from "../../ide/shared/MetricCard";

const GLASS = {
  background: "rgba(255,255,255,0.02)",
  border: `1px solid rgba(255,255,255,0.06)`,
};
const LABEL = "rgba(255,255,255,0.45)";
const VALUE = "rgba(255,255,255,0.85)";

/* ── Prime Editing Panel ─────────────────────────────────────────────── */

export function PrimeEditingPanel({ geneSequence }: { geneSequence?: string }) {
  const [editPos, setEditPos] = useState(50);
  const [editType, setEditType] = useState<"substitution" | "insertion" | "deletion">("substitution");
  const [newBases, setNewBases] = useState("G");
  const [peVersion, setPeVersion] = useState<"PE2" | "PE3" | "PEmax">("PE3");

  const seq = geneSequence || "ATGAAACGCATTAGCACCACCATTACCACCACCATCACCATTACCACAGGTAACGGTGCGGGCTGACGCGTACAGGAAACACAGAAAAAAGCCCGCACCTGACAGTGCGGGCTTTTTTTTTCGACCAAAGGTAACGAGGTAACAACCATGCGAGTGTTGAAGTTCGGCGGTACATCAGTGGCAAATGCAGAACGTTTTCTGCGTGTTGCCGATATTCTGGAAAGCAATGCCAGGCAGGGGCAGGTGGCCACCGGTCCTCATCTCCTGTCAGGGGGATTTAGCGCTTGCTCGCATGCTAGAATGGCGTAAGCCATACCGTCGGATGCCGCCAGCGTCAGCATTTGCGTCTGCTATTGGCGATTCCTTGCGGCGTAACTGACGATGATCGCCCGACAGGCTGATGGCGAGCCGGATCGCCATTTCCATTCATTTGATCTGCGCGAACAGACCGACGATCGTCTTCTGCATCTGCGGCGCCAGCTCGCGCTCGATCACTTCAGCCACCAGCGGCAGCTGCTTGATGCCCTGCAGCGCCGCCGCCAGCAACATGGTCATCGGCGTCAGCGGCGCCAGCAGGATCGTCAGCGGCGGCGTCAGCACCAGCGCCGCCAGCGCCTGCAGCACCACCGGCGGCAGCGCCAGCGCCGCCAGCGCCTGCAGCACCACCGGCGGCAGCGCCAGCGCCGCCAGCAC";

  const design = useMemo(() => {
    if (!seq) return null;
    try {
      return designPrimeEdit(seq, editPos, editType, newBases, peVersion);
    } catch {
      return null;
    }
  }, [seq, editPos, editType, newBases, peVersion]);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
        <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Prime Editing Design
        </span>
        <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, margin: "8px 0 0", lineHeight: 1.6 }}>
          Design pegRNAs for precise genome editing without double-strand breaks.
          Supports substitutions, insertions, and deletions with PE2/PE3/PEmax.
        </p>
        <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: "rgba(255,255,255,0.3)", margin: "4px 0 0" }}>
          Reference: Anzalone et al. (2019) Nature 576:149-157
        </p>
      </div>

      {/* Controls */}
      <div style={{ ...GLASS, borderRadius: 16, padding: 14, display: "flex", flexWrap: "wrap", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>Edit Position</span>
          <input type="number" value={editPos} onChange={(e) => setEditPos(Number(e.target.value))} min={0} max={seq.length - 1}
            style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: VALUE, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, padding: "6px 10px", width: 100 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>Edit Type</span>
          <select value={editType} onChange={(e) => setEditType(e.target.value as any)}
            style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: VALUE, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, padding: "6px 10px" }}>
            <option value="substitution">Substitution</option>
            <option value="insertion">Insertion</option>
            <option value="deletion">Deletion</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>New Bases</span>
          <input type="text" value={newBases} onChange={(e) => setNewBases(e.target.value.toUpperCase())} maxLength={10}
            style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: VALUE, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, padding: "6px 10px", width: 80 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>PE Version</span>
          <select value={peVersion} onChange={(e) => setPeVersion(e.target.value as any)}
            style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: VALUE, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, padding: "6px 10px" }}>
            <option value="PE2">PE2</option>
            <option value="PE3">PE3</option>
            <option value="PEmax">PEmax</option>
          </select>
        </label>
      </div>

      {/* Results */}
      {design && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            <MetricCard label="Efficiency" value={`${(design.efficiency * 100).toFixed(1)}%`} />
            <MetricCard label="Indel Freq" value={`${(design.indelFrequency * 100).toFixed(1)}%`} />
            <MetricCard label="Edit Type" value={design.editType} />
            <MetricCard label="AA Change" value={design.aaChange} />
          </div>

          <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
            <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, textTransform: "uppercase", letterSpacing: "0.06em" }}>pegRNA Sequence</span>
            <div style={{ marginTop: 8, fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: VALUE, wordBreak: "break-all", lineHeight: 1.6, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${GLASS.border}` }}>
              {design.pegRNA}
            </div>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>Spacer (20 nt)</span>
                <p style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE, margin: "2px 0 0" }}>{design.spacer}</p>
              </div>
              <div>
                <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>PBS ({design.pbs.length} nt)</span>
                <p style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE, margin: "2px 0 0" }}>{design.pbs}</p>
              </div>
              <div>
                <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>RTT ({design.rtt.length} nt)</span>
                <p style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE, margin: "2px 0 0" }}>{design.rtt}</p>
              </div>
              {design.nicksgRNA && (
                <div>
                  <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>Nick sgRNA</span>
                  <p style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE, margin: "2px 0 0" }}>{design.nicksgRNA}</p>
                </div>
              )}
            </div>
          </div>

          <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
            <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, textTransform: "uppercase", letterSpacing: "0.06em" }}>Design Notes</span>
            {design.notes.map((note, i) => (
              <p key={i} style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: "rgba(255,255,255,0.6)", margin: "4px 0 0" }}>{note}</p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Base Editing Panel ──────────────────────────────────────────────── */

export function BaseEditingPanel({ geneSequence }: { geneSequence?: string }) {
  const [editPos, setEditPos] = useState(50);
  const [editorType, setEditorType] = useState<BaseEditorType>("ABE8e");

  const seq = geneSequence || "ATGAAACGCATTAGCACCACCATTACCACCACCATCACCATTACCACAGGTAACGGTGCGGGCTGACGCGTACAGGAAACACAGAAAAAAGCCCGCACCTGACAGTGCGGGCTTTTTTTTTCGACCAAAGGTAACGAGGTAACAACCATGCGAGTGTTGAAGTTCGGCGGTACATCAGTGGCAAATGCAGAACGTTTTCTGCGTGTTGCCGATATTCTGGAAAGCAATGCCAGGCAGGGGCAGGTGGCCACCGGTCCTCATCTCCTGTCAGGGGGATTTAGCGCTTGCTCGCATGCTAGAATGGCGTAAGCCATACCGTCGGATGCCGCCAGCGTCAGCATTTGCGTCTGCTATTGGCGATTCCTTGCGGCGTAACTGACGATGATCGCCCGACAGGCTGATGGCGAGCCGGATCGCCATTTCCATTCATTTGATCTGCGCGAACAGACCGACGATCGTCTTCTGCATCTGCGGCGCCAGCTCGCGCTCGATCACTTCAGCCACCAGCGGCAGCTGCTTGATGCCCTGCAGCGCCGCCGCCAGCAACATGGTCATCGGCGTCAGCGGCGCCAGCAGGATCGTCAGCGGCGGCGTCAGCACCAGCGCCGCCAGCGCCTGCAGCACCACCGGCGGCAGCGCCAGCGCCGCCAGCGCCTGCAGCACCACCGGCGGCAGCGCCAGCGCCGCCAGCAC";

  const design = useMemo(() => {
    if (!seq) return null;
    try {
      return designBaseEdit(seq, editPos, editorType);
    } catch {
      return null;
    }
  }, [seq, editPos, editorType]);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
        <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Base Editing Design
        </span>
        <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, margin: "8px 0 0", lineHeight: 1.6 }}>
          Design base edits without double-strand breaks. ABE8e converts A→G, CBE4max converts C→T, CGBE converts C→G.
        </p>
        <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: "rgba(255,255,255,0.3)", margin: "4px 0 0" }}>
          Reference: Gaudelli et al. (2017) Nature 551:464-471
        </p>
      </div>

      <div style={{ ...GLASS, borderRadius: 16, padding: 14, display: "flex", flexWrap: "wrap", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>Edit Position</span>
          <input type="number" value={editPos} onChange={(e) => setEditPos(Number(e.target.value))} min={0} max={seq.length - 1}
            style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: VALUE, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, padding: "6px 10px", width: 100 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>Editor Type</span>
          <select value={editorType} onChange={(e) => setEditorType(e.target.value as BaseEditorType)}
            style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: VALUE, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, padding: "6px 10px" }}>
            <option value="ABE8e">ABE8e (A→G)</option>
            <option value="CBE4max">CBE4max (C→T)</option>
            <option value="CGBE">CGBE (C→G)</option>
          </select>
        </label>
      </div>

      {design && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            <MetricCard label="Efficiency" value={`${(design.efficiency * 100).toFixed(1)}%`} />
            <MetricCard label="Conversion" value={`${design.originalBase}→${design.targetBase}`} />
            <MetricCard label="Window" value={`${design.editingWindow.start}-${design.editingWindow.end}`} />
            <MetricCard label="Bystanders" value={design.bystanderEdits.length} />
          </div>

          <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
            <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, textTransform: "uppercase", letterSpacing: "0.06em" }}>sgRNA Spacer</span>
            <div style={{ marginTop: 8, fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: VALUE, wordBreak: "break-all", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${GLASS.border}` }}>
              {design.spacer}
            </div>
          </div>

          {design.bystanderEdits.length > 0 && (
            <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: THEME.RISK_LOW, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                ⚠️ Bystander Edits Detected
              </span>
              {design.bystanderEdits.map((b, i) => (
                <p key={i} style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: VALUE, margin: "4px 0 0" }}>
                  Position {b.position}: {b.original}→{b.edited} (efficiency: {(b.efficiency * 100).toFixed(1)}%)
                </p>
              ))}
            </div>
          )}

          <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
            <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, textTransform: "uppercase", letterSpacing: "0.06em" }}>Design Notes</span>
            {design.notes.map((note, i) => (
              <p key={i} style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: "rgba(255,255,255,0.6)", margin: "4px 0 0" }}>{note}</p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Epigenome Editing Panel ─────────────────────────────────────────── */

export function EpigenomeEditingPanel({ geneSequence }: { geneSequence?: string }) {
  const [targetRegion, setTargetRegion] = useState<"promoter" | "gene_body" | "enhancer">("promoter");
  const [effector, setEffector] = useState<EpigenomeEffector>("CRISPRoff");

  const seq = geneSequence || "ATGAAACGCATTAGCACCACCATTACCACCACCATCACCATTACCACAGGTAACGGTGCGGGCTGACGCGTACAGGAAACACAGAAAAAAGCCCGCACCTGACAGTGCGGGCTTTTTTTTTCGACCAAAGGTAACGAGGTAACAACCATGCGAGTGTTGAAGTTCGGCGGTACATCAGTGGCAAATGCAGAACGTTTTCTGCGTGTTGCCGATATTCTGGAAAGCAATGCCAGGCAGGGGCAGGTGGCCACCGGTCCTCATCTCCTGTCAGGGGGATTTAGCGCTTGCTCGCATGCTAGAATGGCGTAAGCCATACCGTCGGATGCCGCCAGCGTCAGCATTTGCGTCTGCTATTGGCGATTCCTTGCGGCGTAACTGACGATGATCGCCCGACAGGCTGATGGCGAGCCGGATCGCCATTTCCATTCATTTGATCTGCGCGAACAGACCGACGATCGTCTTCTGCATCTGCGGCGCCAGCTCGCGCTCGATCACTTCAGCCACCAGCGGCAGCTGCTTGATGCCCTGCAGCGCCGCCGCCAGCAACATGGTCATCGGCGTCAGCGGCGCCAGCAGGATCGTCAGCGGCGGCGTCAGCACCAGCGCCGCCAGCGCCTGCAGCACCACCGGCGGCAGCGCCAGCGCCGCCAGCGCCTGCAGCACCACCGGCGGCAGCGCCAGCGCCGCCAGCAC";

  const design = useMemo(() => {
    if (!seq) return null;
    try {
      return designEpigenomeEdit(seq, targetRegion, effector);
    } catch {
      return null;
    }
  }, [seq, targetRegion, effector]);

  const isSilencing = ["CRISPRoff", "DNMT3A", "KRAB"].includes(effector);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
        <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Epigenome Editing Design
        </span>
        <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, margin: "8px 0 0", lineHeight: 1.6 }}>
          Design epigenome edits for heritable gene silencing or activation without changing DNA sequence.
          Uses dCas9 fused to chromatin-modifying enzymes.
        </p>
        <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: "rgba(255,255,255,0.3)", margin: "4px 0 0" }}>
          Reference: Nuñez et al. (2021) Cell 184:1-15
        </p>
      </div>

      <div style={{ ...GLASS, borderRadius: 16, padding: 14, display: "flex", flexWrap: "wrap", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>Target Region</span>
          <select value={targetRegion} onChange={(e) => setTargetRegion(e.target.value as any)}
            style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: VALUE, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, padding: "6px 10px" }}>
            <option value="promoter">Promoter</option>
            <option value="gene_body">Gene Body</option>
            <option value="enhancer">Enhancer</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>Effector</span>
          <select value={effector} onChange={(e) => setEffector(e.target.value as EpigenomeEffector)}
            style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: VALUE, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, padding: "6px 10px" }}>
            <option value="CRISPRoff">CRISPRoff (silencing)</option>
            <option value="CRISPRon">CRISPRon (activation)</option>
            <option value="DNMT3A">DNMT3A (methylation)</option>
            <option value="TET1">TET1 (demethylation)</option>
            <option value="p300">p300 (acetylation)</option>
            <option value="KRAB">KRAB (repression)</option>
          </select>
        </label>
      </div>

      {design && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <MetricCard label="Activity" value={`${(design.activityScore * 100).toFixed(1)}%`} />
            <MetricCard label="Mode" value={isSilencing ? "Silencing" : "Activation"} />
            <MetricCard label="Chromatin" value={design.chromatinContext} />
          </div>

          <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
            <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, textTransform: "uppercase", letterSpacing: "0.06em" }}>dCas9 sgRNA</span>
            <div style={{ marginTop: 8, fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: VALUE, wordBreak: "break-all", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${GLASS.border}` }}>
              {design.spacer}
            </div>
          </div>

          <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
            <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, textTransform: "uppercase", letterSpacing: "0.06em" }}>Design Notes</span>
            {design.notes.map((note, i) => (
              <p key={i} style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: "rgba(255,255,255,0.6)", margin: "4px 0 0" }}>{note}</p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── PASTE Panel ─────────────────────────────────────────────────────── */

export function PASTEPanel() {
  const [cargoSize, setCargoSize] = useState(2000);
  const [organism, setOrganism] = useState<"human" | "mouse" | "ecoli">("human");
  const [integrase, setIntegrase] = useState<"Bxb1" | "phiC31" | "PhiBT1">("Bxb1");

  const design = useMemo(() => {
    const cargo = "A".repeat(cargoSize);
    return designPASTE(cargo, organism, integrase);
  }, [cargoSize, organism, integrase]);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
        <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          PASTE — Large DNA Cargo Insertion
        </span>
        <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, margin: "8px 0 0", lineHeight: 1.6 }}>
          Programmable Addition via Site-specific Targeting Elements. Combines CRISPR-Cas9 with serine integrases
          to insert large DNA cargos ({'>'}1 kb) at safe harbor loci without HDR.
        </p>
        <p style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: "rgba(255,255,255,0.3)", margin: "4px 0 0" }}>
          Reference: Yarnall et al. (2023) Nat Biotechnol 41:500-512
        </p>
      </div>

      <div style={{ ...GLASS, borderRadius: 16, padding: 14, display: "flex", flexWrap: "wrap", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>Cargo Size (bp)</span>
          <input type="number" value={cargoSize} onChange={(e) => setCargoSize(Number(e.target.value))} min={100} max={50000} step={100}
            style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: VALUE, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, padding: "6px 10px", width: 120 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>Organism</span>
          <select value={organism} onChange={(e) => setOrganism(e.target.value as any)}
            style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: VALUE, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, padding: "6px 10px" }}>
            <option value="human">Human</option>
            <option value="mouse">Mouse</option>
            <option value="ecoli">E. coli</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xxs)", color: LABEL }}>Integrase</span>
          <select value={integrase} onChange={(e) => setIntegrase(e.target.value as any)}
            style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-sm)", color: VALUE, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, padding: "6px 10px" }}>
            <option value="Bxb1">Bxb1</option>
            <option value="phiC31">phiC31</option>
            <option value="PhiBT1">PhiBT1</option>
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <MetricCard label="Efficiency" value={`${(design.efficiency * 100).toFixed(1)}%`} />
        <MetricCard label="Cargo" value={`${(cargoSize / 1000).toFixed(1)} kb`} />
        <MetricCard label="Safe Harbor" value={design.safeHarbor} />
        <MetricCard label="Integrase" value={design.integrase} />
      </div>

      <div style={{ ...GLASS, borderRadius: 16, padding: 14 }}>
        <span style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: LABEL, textTransform: "uppercase", letterSpacing: "0.06em" }}>Design Notes</span>
        {design.notes.map((note, i) => (
          <p key={i} style={{ fontFamily: THEME.SANS, fontSize: "var(--nb-fs-xs)", color: "rgba(255,255,255,0.6)", margin: "4px 0 0" }}>{note}</p>
        ))}
      </div>
    </div>
  );
}
