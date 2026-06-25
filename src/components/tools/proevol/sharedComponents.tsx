"use client";

import type {
  ProEvolArtifact,
  ProEvolRound,
  ProEvolVariant,
  ProEvolVariantRoundObservation,
} from "../../../domain/proevolArtifact";
import { PROEVOL_ARTIFACT_VERSION } from "../../../domain/proevolArtifact";
import { THEME } from "../../../theme";
import { PROEVOL_THEME } from "./shared";

export const PANEL_BG = PROEVOL_THEME.pageBg;

// ── CSV parsing types ───────────────────────────────────────────────────────

export interface CSVRow {
  variant_id: string;
  round: number;
  replicate: number;
  read_count: number;
}

export interface ParsedCSV {
  rows: CSVRow[];
  variantIds: string[];
  rounds: number[];
  replicates: number[];
}

// ── CSV parsing functions ───────────────────────────────────────────────────

export function parseCSV(text: string): ParsedCSV {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row.");

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const colIndex = {
    variant_id: header.indexOf("variant_id"),
    round: header.indexOf("round"),
    replicate: header.indexOf("replicate"),
    read_count: header.indexOf("read_count"),
  };
  for (const [key, idx] of Object.entries(colIndex)) {
    if (idx === -1) throw new Error(`Missing required column: "${key}"`);
  }

  const rows: CSVRow[] = [];
  const variantSet = new Set<string>();
  const roundSet = new Set<number>();
  const replicateSet = new Set<number>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",").map((c) => c.trim());
    const variant_id = cols[colIndex.variant_id];
    const round = Number(cols[colIndex.round]);
    const replicate = Number(cols[colIndex.replicate]);
    const read_count = Number(cols[colIndex.read_count]);

    if (!variant_id) throw new Error(`Row ${i + 1}: empty variant_id`);
    if (!Number.isFinite(round) || round < 1) throw new Error(`Row ${i + 1}: invalid round "${cols[colIndex.round]}"`);
    if (!Number.isFinite(replicate) || replicate < 1)
      throw new Error(`Row ${i + 1}: invalid replicate "${cols[colIndex.replicate]}"`);
    if (!Number.isFinite(read_count) || read_count < 0)
      throw new Error(`Row ${i + 1}: invalid read_count "${cols[colIndex.read_count]}"`);

    rows.push({ variant_id, round, replicate, read_count });
    variantSet.add(variant_id);
    roundSet.add(round);
    replicateSet.add(replicate);
  }

  if (rows.length === 0) throw new Error("CSV contains no data rows.");

  return {
    rows,
    variantIds: [...variantSet],
    rounds: [...roundSet].sort((a, b) => a - b),
    replicates: [...replicateSet].sort((a, b) => a - b),
  };
}

/** Derive a family grouping from variant_id prefix (e.g. "M1-A12V" → family "M1"). */
export function deriveFamily(variantId: string): { familyId: string; familyLabel: string } {
  const dashIdx = variantId.indexOf("-");
  if (dashIdx > 0) {
    const prefix = variantId.substring(0, dashIdx);
    return { familyId: prefix, familyLabel: `Family ${prefix}` };
  }
  if (variantId === "WT" || variantId.toLowerCase().startsWith("wt")) {
    return { familyId: "wt", familyLabel: "Wild Type" };
  }
  return { familyId: variantId, familyLabel: `Family ${variantId}` };
}

/** Derive mutation string from variant_id (e.g. "M1-A12V" → "A12V", "WT" → ""). */
export function deriveMutations(variantId: string): {
  mutationString: string;
  mutationBurden: number;
  mutations: Array<{ position: number; from: string; to: string }>;
} {
  if (variantId === "WT" || variantId.toLowerCase().startsWith("wt")) {
    return { mutationString: "", mutationBurden: 0, mutations: [] };
  }
  const dashIdx = variantId.indexOf("-");
  const mutPart = dashIdx > 0 ? variantId.substring(dashIdx + 1) : variantId;
  // Support comma-separated multi-mutations like "A12V,S88A"
  const parts = mutPart
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const mutations: Array<{ position: number; from: string; to: string }> = [];
  const mutationStrings: string[] = [];
  for (const part of parts) {
    const m = part.match(/^([A-Z])(\d+)([A-Z])$/i);
    if (m) {
      mutations.push({ from: m[1].toUpperCase(), position: Number(m[2]), to: m[3].toUpperCase() });
      mutationStrings.push(part);
    } else {
      // If we can't parse it, use the raw string as-is
      mutationStrings.push(part);
    }
  }
  return {
    mutationString: mutationStrings.join(" / "),
    mutationBurden: mutations.length || Math.max(parts.length, 1),
    mutations,
  };
}

export function csvToArtifact(parsed: ParsedCSV, targetProduct: string): ProEvolArtifact {
  const { rows, variantIds, rounds, replicates } = parsed;
  const wildTypeId = variantIds.find((id) => id === "WT" || id.toLowerCase().startsWith("wt")) ?? variantIds[0];

  // Build round structures
  const roundObjs: ProEvolRound[] = rounds.map((roundNum) => {
    const roundLabel = `r${roundNum}`;
    // Sum reads per replicate across all variants for this round
    const totalReadsPerReplicate = replicates.map((repNum) => {
      const replicateId = `rep${repNum}`;
      const total = rows
        .filter((r) => r.round === roundNum && r.replicate === repNum)
        .reduce((sum, r) => sum + r.read_count, 0);
      return { replicateId, reads: total };
    });
    return {
      id: roundLabel,
      number: roundNum,
      label: `Round ${roundNum}`,
      selectionPressure: "user-supplied",
      reportedSurvivorCount: variantIds.length,
      totalReadsPerReplicate,
    };
  });

  // Build variant structures
  const variants: ProEvolVariant[] = variantIds.map((variantId) => {
    const { familyId, familyLabel } = deriveFamily(variantId);
    const { mutationString, mutationBurden, mutations } = deriveMutations(variantId);

    const observations: ProEvolVariantRoundObservation[] = rounds.map((roundNum) => {
      const replicateIdMap = replicates.map((repNum) => `rep${repNum}`);
      const replicatesData = replicateIdMap.map((replicateId, idx) => {
        const repNum = replicates[idx];
        const matching = rows.find((r) => r.variant_id === variantId && r.round === roundNum && r.replicate === repNum);
        return { replicateId, reads: matching?.read_count ?? 0 };
      });
      const totalReads = replicatesData.reduce((sum, r) => sum + r.reads, 0);
      return { roundId: `r${roundNum}`, replicates: replicatesData, totalReads };
    });

    const isWildType = variantId === wildTypeId;

    return {
      id: variantId,
      label: variantId,
      parentId: isWildType ? null : wildTypeId,
      familyId,
      familyLabel,
      mutations,
      mutationString,
      mutationBurden,
      observations,
      phenotype: {},
      selectionStatus: isWildType ? "wild-type" : "unknown",
      riskFlags: [],
    };
  });

  return {
    version: PROEVOL_ARTIFACT_VERSION,
    meta: {
      id: `csv-upload-${Date.now()}`,
      name: "User CSV Upload",
      targetProtein: targetProduct,
      targetProduct,
      wildTypeId,
      wildTypeLabel: wildTypeId,
      startingSequence: "",
      hostSystem: "User-supplied",
      screeningSystem: "User-supplied",
      assayCondition: "User-supplied",
      selectionPressure: "User-supplied",
      objective: "Analyze user-supplied directed evolution data",
      totalRounds: rounds.length,
      librarySizePerRound: variantIds.length,
      selectionStringency: 0.5,
    },
    rounds: roundObjs,
    variants,
    provenance: {
      kind: "user-supplied",
      validity: "real",
      bandSemantic: "measurement",
      isModeled: false,
      source: "User CSV upload",
      replicateCount: replicates.length,
      statisticalNotes: [
        "Per-replicate read counts supplied by user.",
        "Uncertainty bands represent 95% CIs across biological replicates.",
        "Frequencies use Laplace pseudocount (+1) before normalization.",
      ],
      generatedAt: Date.now(),
    },
  };
}

// ── Shared UI constants ─────────────────────────────────────────────────────

export const kicker: React.CSSProperties = {
  fontFamily: THEME.MONO,
  fontSize: "var(--nb-fs-xs)",
  color: PROEVOL_THEME.label,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

// ── Shared UI components ────────────────────────────────────────────────────

export function SectionKicker({ index, label }: { index: number; label: string }) {
  return (
    <div
      style={{
        fontFamily: THEME.MONO,
        fontSize: "var(--nb-fs-xs)",
        color: PROEVOL_THEME.label,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        paddingTop: "6px",
        borderTop: `1px solid ${PROEVOL_THEME.border}`,
        marginTop: "2px",
      }}
    >
      {String(index).padStart(2, "0")} · {label}
    </div>
  );
}

export function CompactMetric({
  label,
  value,
  delta,
  accent,
}: {
  label: string;
  value: string;
  delta: string;
  accent: string;
}) {
  return (
    <div style={{ display: "grid", gap: "3px", textAlign: "center", minWidth: 0 }}>
      <span
        style={{
          fontFamily: THEME.MONO,
          fontSize: "var(--nb-fs-xs)",
          color: PROEVOL_THEME.label,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: THEME.SANS,
          fontSize: "var(--nb-fs-lg)",
          fontWeight: 700,
          color: PROEVOL_THEME.value,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </span>
      <span
        style={{ fontFamily: THEME.MONO, fontSize: "var(--nb-fs-xs)", color: accent, fontFeatureSettings: "'tnum' 1" }}
      >
        {delta}
      </span>
    </div>
  );
}

export function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "5px 8px",
        borderRadius: "var(--nb-radius-sm)",
        border: `1px solid ${PROEVOL_THEME.border}`,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div
        style={{
          fontFamily: THEME.MONO,
          fontSize: "var(--nb-fs-xs)",
          color: PROEVOL_THEME.label,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: THEME.SANS,
          fontSize: "var(--nb-fs-sm)",
          color: PROEVOL_THEME.value,
          lineHeight: 1.4,
          marginTop: "2px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function ChartShell({
  title,
  children,
  footnote,
}: {
  title: string;
  children: React.ReactNode;
  footnote?: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: "8px",
        padding: "10px 12px",
        borderRadius: "var(--nb-radius-md)",
        border: `1px solid ${PROEVOL_THEME.border}`,
        background: PROEVOL_THEME.surface,
        minWidth: 0,
      }}
    >
      <div style={kicker}>{title}</div>
      <div>{children}</div>
      {footnote ? (
        <div
          style={{
            fontFamily: THEME.SANS,
            fontSize: "var(--nb-fs-xs)",
            color: PROEVOL_THEME.muted,
            lineHeight: 1.5,
            paddingTop: "4px",
            borderTop: `1px dashed ${PROEVOL_THEME.border}`,
          }}
        >
          {footnote}
        </div>
      ) : null}
    </div>
  );
}

/**
 * SVG line chart for BO improvement trajectory.
 * Shows best fitness per round (left axis) and max acquisition value (right axis).
 * Marks convergence round with a vertical dashed line.
 */
export function BOImprovementChart({
  improvementHistory,
  acquisitionHistory,
  convergenceRound,
  stoppingThreshold,
}: {
  improvementHistory: number[];
  acquisitionHistory: number[];
  convergenceRound: number;
  stoppingThreshold: number;
}) {
  const W = 480;
  const H = 180;
  const PAD = { top: 20, right: 50, bottom: 30, left: 45 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const nRounds = improvementHistory.length;
  if (nRounds === 0) return null;

  // Scales
  const fitnessMin = Math.min(...improvementHistory) * 0.95;
  const fitnessMax = Math.max(...improvementHistory) * 1.05;
  const acqMax = Math.max(...acquisitionHistory, stoppingThreshold) * 1.1;

  const xScale = (i: number) => PAD.left + (i / Math.max(nRounds - 1, 1)) * plotW;
  const yFitnessScale = (v: number) =>
    PAD.top + plotH - ((v - fitnessMin) / Math.max(fitnessMax - fitnessMin, 1e-6)) * plotH;
  const yAcqScale = (v: number) => PAD.top + plotH - (v / Math.max(acqMax, 1e-6)) * plotH;

  // Fitness line path
  const fitnessPath = improvementHistory
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yFitnessScale(v).toFixed(1)}`)
    .join(" ");

  // Acquisition line path
  const acqPath = acquisitionHistory
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yAcqScale(v).toFixed(1)}`)
    .join(" ");

  // Threshold line
  const thresholdY = yAcqScale(stoppingThreshold);

  // Fitness dots
  const fitnessDots = improvementHistory.map((v, i) => ({
    cx: xScale(i),
    cy: yFitnessScale(v),
  }));

  // Y-axis ticks for fitness (left)
  const nYTicks = 4;
  const fitnessTicks = Array.from({ length: nYTicks + 1 }, (_, i) => {
    const v = fitnessMin + (i / nYTicks) * (fitnessMax - fitnessMin);
    return { v, y: yFitnessScale(v) };
  });

  // Y-axis ticks for acquisition (right)
  const acqTicks = Array.from({ length: nYTicks + 1 }, (_, i) => {
    const v = (i / nYTicks) * acqMax;
    return { v, y: yAcqScale(v) };
  });

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ marginTop: "6px" }}>
      {/* Grid lines */}
      {fitnessTicks.map((t, i) => (
        <line
          key={`g-${i}`}
          x1={PAD.left}
          y1={t.y}
          x2={W - PAD.right}
          y2={t.y}
          stroke={PROEVOL_THEME.border}
          strokeWidth={0.5}
          strokeDasharray="2 4"
        />
      ))}

      {/* X-axis labels */}
      {improvementHistory.map((_, i) => (
        <text
          key={`xl-${i}`}
          x={xScale(i)}
          y={H - 6}
          textAnchor="middle"
          fill={PROEVOL_THEME.muted}
          style={{ fontFamily: THEME.MONO, fontSize: "9px" }}
        >
          {i + 1}
        </text>
      ))}

      {/* Convergence marker */}
      {convergenceRound > 0 && convergenceRound <= nRounds && (
        <>
          <line
            x1={xScale(convergenceRound - 1)}
            y1={PAD.top}
            x2={xScale(convergenceRound - 1)}
            y2={PAD.top + plotH}
            stroke="#93CB52"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.7}
          />
          <text
            x={xScale(convergenceRound - 1)}
            y={PAD.top - 4}
            textAnchor="middle"
            fill="#93CB52"
            style={{ fontFamily: THEME.MONO, fontSize: "8px", textTransform: "uppercase" }}
          >
            converged
          </text>
        </>
      )}

      {/* Threshold line (acquisition axis) */}
      <line
        x1={PAD.left}
        y1={thresholdY}
        x2={W - PAD.right}
        y2={thresholdY}
        stroke={PROEVOL_THEME.coral}
        strokeWidth={0.8}
        strokeDasharray="3 3"
        opacity={0.5}
      />
      <text
        x={W - PAD.right + 3}
        y={thresholdY + 3}
        fill={PROEVOL_THEME.coral}
        style={{ fontFamily: THEME.MONO, fontSize: "7px" }}
      >
        EI={stoppingThreshold}
      </text>

      {/* Acquisition line (right axis) */}
      <path d={acqPath} fill="none" stroke={PROEVOL_THEME.apricot} strokeWidth={1.5} opacity={0.6} />

      {/* Fitness line (left axis) */}
      <path d={fitnessPath} fill="none" stroke={PROEVOL_THEME.mint} strokeWidth={2} />

      {/* Fitness dots */}
      {fitnessDots.map((d, i) => (
        <circle
          key={`fd-${i}`}
          cx={d.cx}
          cy={d.cy}
          r={3.5}
          fill={PROEVOL_THEME.mint}
          stroke="#050505"
          strokeWidth={1}
        />
      ))}

      {/* Left Y-axis label */}
      <text
        x={8}
        y={PAD.top + plotH / 2}
        fill={PROEVOL_THEME.mint}
        style={{ fontFamily: THEME.MONO, fontSize: "8px", textTransform: "uppercase" }}
        transform={`rotate(-90, 8, ${PAD.top + plotH / 2})`}
        textAnchor="middle"
      >
        Best Fitness
      </text>

      {/* Left Y-axis ticks */}
      {fitnessTicks.map((t, i) => (
        <text
          key={`yl-${i}`}
          x={PAD.left - 4}
          y={t.y + 3}
          textAnchor="end"
          fill={PROEVOL_THEME.muted}
          style={{ fontFamily: THEME.MONO, fontSize: "8px" }}
        >
          {t.v.toFixed(1)}
        </text>
      ))}

      {/* Right Y-axis label */}
      <text
        x={W - 6}
        y={PAD.top + plotH / 2}
        fill={PROEVOL_THEME.apricot}
        style={{ fontFamily: THEME.MONO, fontSize: "8px", textTransform: "uppercase" }}
        transform={`rotate(90, ${W - 6}, ${PAD.top + plotH / 2})`}
        textAnchor="middle"
      >
        Max Acq
      </text>

      {/* Right Y-axis ticks */}
      {acqTicks.map((t, i) => (
        <text
          key={`yr-${i}`}
          x={W - PAD.right + 4}
          y={t.y + 3}
          textAnchor="start"
          fill={PROEVOL_THEME.muted}
          style={{ fontFamily: THEME.MONO, fontSize: "8px" }}
        >
          {t.v.toFixed(3)}
        </text>
      ))}

      {/* Legend */}
      <circle cx={PAD.left + 8} cy={PAD.top - 10} r={3} fill={PROEVOL_THEME.mint} />
      <text
        x={PAD.left + 15}
        y={PAD.top - 7}
        fill={PROEVOL_THEME.mint}
        style={{ fontFamily: THEME.MONO, fontSize: "8px" }}
      >
        Fitness
      </text>
      <circle cx={PAD.left + 68} cy={PAD.top - 10} r={3} fill={PROEVOL_THEME.apricot} />
      <text
        x={PAD.left + 75}
        y={PAD.top - 7}
        fill={PROEVOL_THEME.apricot}
        style={{ fontFamily: THEME.MONO, fontSize: "8px" }}
      >
        Acquisition
      </text>

      {/* X-axis label */}
      <text
        x={PAD.left + plotW / 2}
        y={H - 2}
        textAnchor="middle"
        fill={PROEVOL_THEME.label}
        style={{ fontFamily: THEME.MONO, fontSize: "8px", textTransform: "uppercase" }}
      >
        Round
      </text>
    </svg>
  );
}
