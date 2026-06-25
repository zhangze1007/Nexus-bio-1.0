"use client";
/**
 * RBSCalculatorPanel — Reusable RBS strength calculator for synthetic biology tools.
 *
 * Implements a simplified Salis et al. (2009) thermodynamic model for
 * ribosome binding site (RBS) translation initiation rate prediction.
 *
 * Inputs: RBS sequence, CDS sequence, target organism.
 * Outputs: translation rate, total ΔG, ΔG_mRNA_rRNA, ΔG_spacing,
 *          ΔG_startCodon, spacing visualization.
 */

import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { THEME } from "../../../theme";
import MetricCard from "./MetricCard";

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface RBSResult {
  /** Translation initiation rate (relative, arbitrary units). */
  translationRate: number;
  /** Total free energy of translation initiation (kcal/mol). */
  dgTotal: number;
  /** Free energy from mRNA–rRNA hybridization (kcal/mol). */
  dgMRNARrna: number;
  /** Free energy from spacing penalty/bonus (kcal/mol). */
  dgSpacing: number;
  /** Free energy from start codon recognition (kcal/mol). */
  dgStartCodon: number;
  /** Free energy from mRNA folding (kcal/mol). */
  dgMRNA: number;
  /** Nucleotide spacing between SD sequence and AUG. */
  spacing: number;
  /** Detected Shine-Dalgarno sequence (or empty if none found). */
  sdSequence: string;
  /** Position of the SD motif in the RBS sequence. */
  sdPosition: number;
  /** Start codon found in CDS (e.g. ATG, GTG, TTG). */
  startCodon: string;
  /** Sequence used for calculation (RBS + first 3 nt of CDS). */
  fullSequence: string;
}

export interface RBSCalculatorPanelProps {
  /** Initial RBS sequence (e.g. "AAGAAGGAGATATACATATG..."). */
  initialRBSSequence?: string;
  /** Initial CDS sequence (should start with ATG). */
  initialCDSSequence?: string;
  /** Called when calculation completes successfully. */
  onCalculated?: (result: RBSResult) => void;
}

/* ── Organism presets ───────────────────────────────────────────────────── */

type Organism = "ecoli" | "bsubtilis" | "scerevisiae";

interface OrganismConfig {
  value: Organism;
  label: string;
  /** 3' tail of 16S rRNA (Shine-Dalgarno complement). */
  rRNA: string;
  /** Canonical SD hexamer for this organism. */
  sdHexamer: string;
  /** Optimal spacing range [min, max] nt. */
  optimalSpacing: [number, number];
  /** Position weight matrix for spacing penalty (simplified). */
  spacingPenalty: (nt: number) => number;
}

const ORGANISMS: OrganismConfig[] = [
  {
    value: "ecoli",
    label: "E. coli",
    rRNA: "AUCCUCCACUAG",
    sdHexamer: "AGGAGG",
    optimalSpacing: [5, 8],
    spacingPenalty: (nt) => {
      // Bernstein et al. (2005): 5-8 nt optimal
      if (nt >= 5 && nt <= 8) return 0;
      if (nt >= 4 && nt <= 10) return 0.5 * Math.abs(nt - 6.5);
      return 2.0 * Math.abs(nt - 6.5) * 0.5;
    },
  },
  {
    value: "bsubtilis",
    label: "B. subtilis",
    rRNA: "AUCCUCCACUAG",
    sdHexamer: "AGGAGG",
    optimalSpacing: [4, 9],
    spacingPenalty: (nt) => {
      if (nt >= 4 && nt <= 9) return 0;
      if (nt >= 3 && nt <= 12) return 0.4 * Math.abs(nt - 6.5);
      return 1.8 * Math.abs(nt - 6.5) * 0.5;
    },
  },
  {
    value: "scerevisiae",
    label: "S. cerevisiae",
    rRNA: "AAUUUAACACCU",
    sdHexamer: "AAAAAA",
    optimalSpacing: [6, 12],
    spacingPenalty: (nt) => {
      // Yeast uses scanning model; less SD-dependent
      if (nt >= 6 && nt <= 12) return 0;
      return 0.3 * Math.abs(nt - 9);
    },
  },
];

/* ── Thermodynamic constants ────────────────────────────────────────────── */

const GAS_CONSTANT = 1.987e-3; // kcal/(mol·K)
const BODY_TEMP_K = 310.15; // 37°C in Kelvin

/** Approximate ΔG values for RNA base pair formation (kcal/mol). */
const BASE_PAIR_DG: Record<string, Record<string, number>> = {
  A: { U: -1.8, T: -1.8 },
  U: { A: -1.8 },
  T: { A: -1.8 },
  G: { C: -3.4, U: -1.2, T: -1.2 },
  C: { G: -3.4 },
};

/** Start codon ΔG values (Salis et al. 2009). */
const START_CODON_DG: Record<string, number> = {
  ATG: -1.194,
  AUG: -1.194,
  GTG: -0.0748,
  GUG: -0.0748,
  TTG: 0.0,
  UUG: 0.0,
};

/* ── Engine functions ───────────────────────────────────────────────────── */

/**
 * Complement base for RNA/DNA hybridization lookup.
 */
function complement(b: string): string {
  const map: Record<string, string> = { A: "U", U: "A", T: "A", G: "C", C: "G" };
  return map[b.toUpperCase()] || "N";
}

/**
 * Find the strongest Shine-Dalgarno interaction in the RBS sequence.
 * Scans for hexamer, pentamer, and tetramer matches to the 16S rRNA tail.
 * Returns the SD sequence, its position, and ΔG_mRNA_rRNA.
 */
function findSDInteraction(
  rbsSeq: string,
  rRNA: string,
  sdHexamer: string,
): { sdSeq: string; sdPos: number; dg: number } {
  const seq = rbsSeq.toUpperCase().replace(/[^AUTCG]/g, "");
  let bestDg = 0;
  let bestSeq = "";
  let bestPos = -1;

  // Try hexamer, pentamer, tetramer matches
  const lengths = [6, 5, 4];
  const searchMotifs = [sdHexamer, sdHexamer.slice(0, 5), sdHexamer.slice(0, 4)];

  for (let li = 0; li < lengths.length; li++) {
    const motif = searchMotifs[li];
    const len = lengths[li];

    for (let i = 0; i <= seq.length - len; i++) {
      const sub = seq.slice(i, i + len);
      // Check complementarity with rRNA tail
      let matchScore = 0;
      let dg = 0;
      for (let j = 0; j < len; j++) {
        const comp = complement(rRNA[j] || "");
        if (sub[j] === comp) {
          matchScore++;
          // Use nearest-neighbor approximation (simplified)
          const pairKey = sub[j];
          const pairDg = BASE_PAIR_DG[pairKey]?.[comp] ?? -1.5;
          dg += pairDg;
        }
      }
      // Minimum 4 nt match required for SD interaction
      if (matchScore >= 4 && dg < bestDg) {
        bestDg = dg;
        bestSeq = sub;
        bestPos = i;
      }
    }
  }

  // If no SD found, check for weaker 3-nt matches
  if (bestDg === 0) {
    const shortLen = 3;
    for (let i = 0; i <= seq.length - shortLen; i++) {
      const sub = seq.slice(i, i + shortLen);
      let matchScore = 0;
      let dg = 0;
      for (let j = 0; j < shortLen; j++) {
        const comp = complement(rRNA[j] || "");
        if (sub[j] === comp) {
          matchScore++;
          dg += BASE_PAIR_DG[sub[j]]?.[comp] ?? -1.5;
        }
      }
      if (matchScore >= 3 && dg < bestDg) {
        bestDg = dg;
        bestSeq = sub;
        bestPos = i;
      }
    }
  }

  return { sdSeq: bestSeq, sdPos: bestPos, dg: bestDg };
}

/**
 * Calculate the spacing between the 3' end of the SD sequence and the
 * first nucleotide of the start codon.
 */
function calcSpacing(rbsLength: number, sdEnd: number): number {
  // spacing = rbsLength - sdEnd (distance from end of SD to end of RBS = start of CDS)
  return Math.max(0, rbsLength - sdEnd);
}

/**
 * Fold the RBS + first ~20 nt of CDS into minimum free energy structure.
 * Uses a simplified Zuker-style approach for the local mRNA structure.
 */
function calcMRNAFolding(rbsSeq: string, cdsSeq: string): number {
  const window = (rbsSeq + cdsSeq.slice(0, 20)).toUpperCase().replace(/[^AUTCG]/g, "");
  if (window.length < 4) return 0;

  let dg = 0;
  // Count GC and AU pairs in potential stem-loop structures
  // Simplified: scan for complementary runs
  for (let i = 0; i < window.length - 3; i++) {
    for (let j = i + 3; j < Math.min(i + 12, window.length); j++) {
      const comp = complement(window[j]);
      if (window[i] === comp) {
        // AU or GC pair
        const pairDg = BASE_PAIR_DG[window[i]]?.[comp] ?? -1.0;
        // Only count if not too close (hairpin needs >= 3 nt loop)
        if (j - i >= 4) {
          dg += pairDg * 0.3; // Weight: not all pairs form simultaneously
        }
      }
    }
  }

  // Clamp to reasonable range
  return Math.max(-5.0, Math.min(0, dg));
}

/**
 * Main RBS calculation engine (Salis et al. 2009 simplified).
 */
function calculateRBS(rbsSeq: string, cdsSeq: string, config: OrganismConfig): RBSResult {
  const rbs = rbsSeq.toUpperCase().replace(/[^AUTCG]/g, "");
  const cds = cdsSeq.toUpperCase().replace(/[^AUTCG]/g, "");

  // Detect start codon (first 3 nt of CDS, or scan for ATG/AUG in RBS tail)
  let startCodon = cds.slice(0, 3);
  if (!START_CODON_DG[startCodon]) {
    // Try scanning last 10 nt of RBS for a start codon
    for (let i = rbs.length - 3; i >= Math.max(0, rbs.length - 10); i--) {
      const candidate = rbs.slice(i, i + 3);
      if (START_CODON_DG[candidate]) {
        startCodon = candidate;
        break;
      }
    }
    if (!START_CODON_DG[startCodon]) {
      startCodon = "AUG"; // default
    }
  }

  // Find SD interaction
  const { sdSeq, sdPos, dg: dgMRNARrna } = findSDInteraction(rbs, config.rRNA, config.sdHexamer);

  // Calculate spacing
  const spacing = sdPos >= 0 ? calcSpacing(rbs.length, sdPos + sdSeq.length) : 15;

  // ΔG_spacing
  const dgSpacing = config.spacingPenalty(spacing);

  // ΔG_startCodon
  const dgStartCodon = START_CODON_DG[startCodon] ?? 0;

  // ΔG_mRNA folding
  const dgMRNA = calcMRNAFolding(rbs, cds);

  // ΔG_total = ΔG_mRNA_rRNA + ΔG_spacing + ΔG_startCodon + ΔG_mRNA
  const dgTotal = dgMRNARrna + dgSpacing + dgStartCodon + dgMRNA;

  // Translation rate ∝ exp(-ΔG_total / RT)
  const translationRate = Math.exp(-dgTotal / (GAS_CONSTANT * BODY_TEMP_K));

  const fullSequence = rbs + (cds.slice(0, 3) || "AUG");

  return {
    translationRate,
    dgTotal,
    dgMRNARrna,
    dgSpacing,
    dgStartCodon,
    dgMRNA,
    spacing,
    sdSequence: sdSeq,
    sdPosition: sdPos,
    startCodon,
    fullSequence,
  };
}

/* ── Style constants ────────────────────────────────────────────────────── */

const labelStyle: React.CSSProperties = {
  fontFamily: THEME.MONO,
  fontSize: THEME.FS_XS,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: THEME.LABEL,
  marginBottom: 4,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: THEME.R_SM,
  border: `1px solid ${THEME.BORDER}`,
  background: THEME.PANEL_INSET,
  color: THEME.VALUE,
  fontFamily: THEME.MONO,
  fontSize: THEME.FS_SM,
  outline: "none",
  transition: "border-color 120ms",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
  appearance: "none" as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' fill='none' stroke='%239BA3AE' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: 28,
};

/* ── Spacing diagram component ──────────────────────────────────────────── */

function SpacingDiagram({
  rbsSeq,
  sdSequence,
  sdPosition,
  spacing,
  startCodon,
  optimalSpacing,
}: {
  rbsSeq: string;
  sdSequence: string;
  sdPosition: number;
  spacing: number;
  startCodon: string;
  optimalSpacing: [number, number];
}) {
  const displayLen = Math.min(rbsSeq.length, 40);
  const seq = rbsSeq.slice(0, displayLen).toUpperCase();
  const sdEnd = sdPosition >= 0 ? sdPosition + sdSequence.length : -1;
  const inOptimal = spacing >= optimalSpacing[0] && spacing <= optimalSpacing[1];

  return (
    <div style={{ marginTop: 8 }}>
      <span style={labelStyle}>Spacing Diagram (SD to Start Codon)</span>
      <div
        style={{
          padding: "10px 12px",
          borderRadius: THEME.R_SM,
          background: "rgba(0,0,0,0.3)",
          border: `1px solid ${THEME.BORDER}`,
          overflowX: "auto",
        }}
      >
        {/* Sequence line */}
        <div
          style={{
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_SM,
            lineHeight: 1.8,
            whiteSpace: "pre",
            letterSpacing: "0.12em",
            color: THEME.VALUE,
          }}
        >
          {seq.split("").map((nt, i) => {
            let bg = "transparent";
            let color: string = THEME.VALUE;
            if (sdPosition >= 0 && i >= sdPosition && i < sdEnd) {
              bg = "rgba(191,220,205,0.25)";
              color = THEME.MINT;
            } else if (i >= seq.length - 3 && startCodon.includes(seq.slice(i, i + 3))) {
              bg = "rgba(232,163,161,0.25)";
              color = THEME.CORAL;
            }
            return (
              <span
                key={i}
                style={{
                  background: bg,
                  color,
                  borderRadius: 2,
                  padding: "1px 0",
                }}
              >
                {nt}
              </span>
            );
          })}
        </div>

        {/* Annotation line */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 4,
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
          }}
        >
          {sdPosition >= 0 && (
            <>
              <span
                style={{
                  color: THEME.MINT,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "rgba(191,220,205,0.12)",
                }}
              >
                SD: {sdSequence}
              </span>
              <span style={{ color: THEME.DIM }}>{"─".repeat(Math.max(1, Math.min(spacing, 12)))}</span>
              <span
                style={{
                  color: inOptimal ? THEME.MINT : THEME.RISK_MEDIUM,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: inOptimal ? "rgba(191,220,205,0.12)" : "rgba(229,143,70,0.12)",
                }}
              >
                {spacing} nt
              </span>
              <span style={{ color: THEME.DIM }}>{"─".repeat(2)}</span>
              <span
                style={{
                  color: THEME.CORAL,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "rgba(232,163,161,0.12)",
                }}
              >
                {startCodon}
              </span>
            </>
          )}
          {sdPosition < 0 && <span style={{ color: THEME.DIM }}>No SD sequence detected</span>}
        </div>

        {/* Spacing bar */}
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Optimal range marker */}
            <div
              style={{
                position: "absolute",
                left: `${(optimalSpacing[0] / 20) * 100}%`,
                width: `${((optimalSpacing[1] - optimalSpacing[0]) / 20) * 100}%`,
                height: "100%",
                background: "rgba(191,220,205,0.15)",
                borderRadius: 999,
              }}
            />
            {/* Current spacing marker */}
            <div
              style={{
                position: "absolute",
                left: `${Math.min((spacing / 20) * 100, 100)}%`,
                top: -2,
                width: 3,
                height: 10,
                borderRadius: 2,
                background: inOptimal ? THEME.MINT : THEME.RISK_MEDIUM,
                transform: "translateX(-50%)",
                transition: "left 300ms ease",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: THEME.MONO,
              fontSize: "9px",
              color: THEME.DIM,
              marginTop: 2,
            }}
          >
            <span>0</span>
            <span style={{ color: THEME.MINT }}>
              optimal {optimalSpacing[0]}-{optimalSpacing[1]}
            </span>
            <span>20</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ΔG breakdown bar ───────────────────────────────────────────────────── */

function DGBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.abs(value) * 20); // scale for display
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          fontFamily: THEME.MONO,
          fontSize: THEME.FS_XS,
          color: THEME.LABEL,
          minWidth: 100,
          textAlign: "right" as const,
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 999,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            background: color,
            transition: "width 300ms ease",
          }}
        />
      </div>
      <span
        style={{
          fontFamily: THEME.MONO,
          fontSize: THEME.FS_SM,
          color,
          fontWeight: 600,
          minWidth: 56,
          textAlign: "right" as const,
        }}
      >
        {value >= 0 ? "+" : ""}
        {value.toFixed(2)}
      </span>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function RBSCalculatorPanel({
  initialRBSSequence = "",
  initialCDSSequence = "",
  onCalculated,
}: RBSCalculatorPanelProps) {
  const [rbsSeq, setRbsSeq] = useState(initialRBSSequence);
  const [cdsSeq, setCdsSeq] = useState(initialCDSSequence);
  const [organism, setOrganism] = useState<Organism>("ecoli");
  const [result, setResult] = useState<RBSResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);

  const orgConfig = useMemo(() => ORGANISMS.find((o) => o.value === organism)!, [organism]);

  /* Validate sequences */
  const validateSequence = useCallback((seq: string, name: string): string | null => {
    const clean = seq.trim().toUpperCase();
    if (!clean) return `Enter a ${name} sequence.`;
    if (!/^[AUTCG]+$/.test(clean)) {
      return `${name} sequence contains invalid characters. Use A, U/T, C, G only.`;
    }
    return null;
  }, []);

  /* Run calculation */
  const handleCalculate = useCallback(() => {
    const rbsErr = validateSequence(rbsSeq, "RBS");
    if (rbsErr) {
      setError(rbsErr);
      return;
    }

    // CDS is optional — default to ATG if empty
    const cleanCds = cdsSeq.trim().toUpperCase();
    if (cleanCds && !/^[AUTCG]+$/.test(cleanCds)) {
      setError("CDS sequence contains invalid characters. Use A, U/T, C, G only.");
      return;
    }

    setCalculating(true);
    setError(null);
    setResult(null);

    try {
      const res = calculateRBS(rbsSeq, cleanCds || "AUG", orgConfig);
      setResult(res);
      onCalculated?.(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Calculation failed.");
    } finally {
      setCalculating(false);
    }
  }, [rbsSeq, cdsSeq, orgConfig, validateSequence, onCalculated]);

  /* Quick-load example */
  const loadExample = useCallback(() => {
    setRbsSeq("AAGAAGGAGATATACATATG");
    setCdsSeq("ATGGCTAGCAAAGGAGAAGAACTTTTCACTGGAGTTGTCCC");
    setResult(null);
    setError(null);
  }, []);

  const rbsLen = rbsSeq.trim().length;
  const cdsLen = cdsSeq.trim().length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 16,
        borderRadius: THEME.R_MD,
        border: `1px solid ${THEME.BORDER}`,
        background: THEME.PANEL_INSET,
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_SM,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: THEME.SKY,
          }}
        >
          RBS Calculator
        </span>
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
            color: THEME.DIM,
          }}
        >
          Salis et al. 2009
        </span>
        {rbsLen > 0 && (
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              color: THEME.DIM,
            }}
          >
            {rbsLen} nt
          </span>
        )}
      </div>

      {/* ── RBS sequence input ── */}
      <div>
        <label style={labelStyle}>RBS Sequence (5&apos;&rarr;3&apos;)</label>
        <input
          type="text"
          placeholder="e.g. AAGAAGGAGATATACATATG"
          value={rbsSeq}
          onChange={(e) => {
            setRbsSeq(e.target.value);
            setError(null);
          }}
          style={inputStyle}
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {/* ── CDS sequence input ── */}
      <div>
        <label style={labelStyle}>CDS Sequence (starts with ATG)</label>
        <input
          type="text"
          placeholder="e.g. ATGGCTAGCAAAGGAGAAGAA"
          value={cdsSeq}
          onChange={(e) => {
            setCdsSeq(e.target.value);
            setError(null);
          }}
          style={inputStyle}
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {/* ── Organism selector ── */}
      <div>
        <label style={labelStyle}>Target Organism</label>
        <select
          value={organism}
          onChange={(e) => {
            setOrganism(e.target.value as Organism);
            setResult(null);
          }}
          style={selectStyle}
        >
          {ORGANISMS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div
          style={{
            marginTop: 4,
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
            color: THEME.DIM,
          }}
        >
          16S rRNA: 3&apos;-{orgConfig.rRNA}-5&apos;
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={handleCalculate}
          disabled={calculating || !rbsSeq.trim()}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            height: 36,
            padding: "0 16px",
            borderRadius: THEME.R_MD,
            border: "none",
            background: calculating ? "rgba(175,195,214,0.3)" : THEME.SKY,
            color: "#0a0a0a",
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            fontWeight: 600,
            cursor: calculating || !rbsSeq.trim() ? "not-allowed" : "pointer",
            opacity: calculating || !rbsSeq.trim() ? 0.5 : 1,
            transition: "background 100ms, opacity 100ms",
          }}
        >
          {calculating ? "Calculating..." : "Calculate RBS Strength"}
        </button>
        <button
          type="button"
          onClick={loadExample}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 36,
            padding: "0 12px",
            borderRadius: THEME.R_MD,
            border: `1px solid ${THEME.BORDER}`,
            background: "rgba(255,255,255,0.04)",
            color: THEME.LABEL,
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            cursor: "pointer",
            transition: "background 80ms",
          }}
        >
          Example
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: THEME.R_SM,
            background: "rgba(232,163,161,0.1)",
            border: `1px solid rgba(232,163,161,0.25)`,
            color: THEME.CORAL,
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
          }}
        >
          {error}
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingTop: 4,
            borderTop: `1px solid ${THEME.BORDER}`,
          }}
        >
          {/* Metrics row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <MetricCard
              label="Translation Rate"
              value={
                result.translationRate < 0.01
                  ? result.translationRate.toExponential(2)
                  : result.translationRate.toFixed(4)
              }
              size="sm"
              accent={
                result.translationRate > 1 ? THEME.MINT : result.translationRate > 0.1 ? THEME.APRICOT : THEME.CORAL
              }
              detail={result.translationRate > 1 ? "Strong" : result.translationRate > 0.1 ? "Moderate" : "Weak"}
            />
            <MetricCard
              label="Total ΔG"
              value={`${result.dgTotal.toFixed(2)}`}
              unit="kcal/mol"
              size="sm"
              accent={result.dgTotal < -3 ? THEME.MINT : result.dgTotal < 0 ? THEME.APRICOT : THEME.CORAL}
              detail={result.dgTotal < -3 ? "Favorable" : result.dgTotal < 0 ? "Marginal" : "Unfavorable"}
            />
          </div>

          {/* ΔG breakdown */}
          <div>
            <span style={labelStyle}>Free Energy Components</span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "8px 10px",
                borderRadius: THEME.R_SM,
                background: "rgba(0,0,0,0.25)",
              }}
            >
              <DGBar label="ΔG mRNA-rRNA" value={result.dgMRNARrna} color={THEME.SKY} />
              <DGBar
                label="ΔG spacing"
                value={result.dgSpacing}
                color={result.dgSpacing === 0 ? THEME.MINT : THEME.RISK_MEDIUM}
              />
              <DGBar label="ΔG start codon" value={result.dgStartCodon} color={THEME.APRICOT} />
              <DGBar label="ΔG mRNA fold" value={result.dgMRNA} color={THEME.LILAC} />
              <div
                style={{
                  borderTop: `1px solid ${THEME.BORDER}`,
                  paddingTop: 6,
                  marginTop: 2,
                }}
              >
                <DGBar
                  label="ΔG total"
                  value={result.dgTotal}
                  color={result.dgTotal < -3 ? THEME.MINT : result.dgTotal < 0 ? THEME.APRICOT : THEME.CORAL}
                />
              </div>
            </div>
          </div>

          {/* Spacing info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <MetricCard
              label="Spacing"
              value={`${result.spacing}`}
              unit="nt"
              size="sm"
              accent={
                result.spacing >= orgConfig.optimalSpacing[0] && result.spacing <= orgConfig.optimalSpacing[1]
                  ? THEME.MINT
                  : THEME.RISK_MEDIUM
              }
            />
            <MetricCard label="Start Codon" value={result.startCodon} size="sm" accent={THEME.CORAL} />
            <MetricCard
              label="SD Sequence"
              value={result.sdSequence || "None"}
              size="sm"
              accent={result.sdSequence ? THEME.MINT : THEME.DIM}
            />
          </div>

          {/* Spacing diagram */}
          <SpacingDiagram
            rbsSeq={result.fullSequence}
            sdSequence={result.sdSequence}
            sdPosition={result.sdPosition}
            spacing={result.spacing}
            startCodon={result.startCodon}
            optimalSpacing={orgConfig.optimalSpacing}
          />

          {/* Full sequence display */}
          <div>
            <span style={labelStyle}>Full Sequence (5&apos;&rarr;3&apos;)</span>
            <div
              style={{
                padding: "8px 10px",
                borderRadius: THEME.R_SM,
                background: "rgba(0,0,0,0.3)",
                border: `1px solid ${THEME.BORDER}`,
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_SM,
                color: THEME.VALUE,
                wordBreak: "break-all" as const,
                letterSpacing: "0.08em",
                lineHeight: 1.6,
              }}
            >
              {result.fullSequence}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
