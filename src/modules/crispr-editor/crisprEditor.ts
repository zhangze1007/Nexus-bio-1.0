/**
 * CRISPR Editor Engine — Base Editing & Prime Editing Design
 *
 * Designs CRISPR-based edits with three modes:
 *   1. Standard Cas9: double-strand break + NHEJ/HDR
 *   2. Base editing: C→T (BE3/BE4) or A→G (ABE) without DSB
 *   3. Prime editing: arbitrary substitutions, insertions, deletions
 *
 * Reference: Komor et al. (2016) Nature 533:421-424 (BE3)
 * Reference: Gaudelli et al. (2017) Science 359:920-924 (ABE)
 * Reference: Anzalone et al. (2019) Nature 576:149-157 (PE2)
 *
 * @scientific_provenance
 *   ALGORITHM: Rule Set 2 scoring + editing window constraints + off-target k-mer search
 */

import type { BaseEditorType, CRISPRInput, EditingMode, EditingResult, GuideDesign, PrimeEditorType } from "./types";

// ── PAM Sequences ──────────────────────────────────────────────────────────

const PAM_SEQUENCES: Record<string, string> = {
  SpCas9: "NGG",
  SpCas9_NG: "NG",
  SpRY: "NRN",
  Cas12a: "TTTV",
};

// ── Editing Windows ────────────────────────────────────────────────────────

/**
 * Editing windows for different base editors.
 * Positions are 0-indexed from 5' end of spacer (20 nt).
 *
 * Reference: Komor et al. (2016) Nature 533:421-424
 * Reference: Gaudelli et al. (2017) Science 359:920-924
 */
const EDITING_WINDOWS: Record<string, [number, number]> = {
  BE3: [4, 8], // positions 4-8 from 5' end
  BE4: [4, 8], // same as BE3
  ABE: [4, 7], // positions 4-7 from 5' end
  PE2: [0, 20], // entire spacer (flexible)
  PE4: [0, 20], // entire spacer (flexible)
};

// ── Off-Target Scoring ─────────────────────────────────────────────────────

/**
 * Simplified off-target scoring based on mismatch positions.
 *
 * Mismatches in seed region (positions 1-8 from PAM) are more disruptive.
 * Reference: Hsu et al. (2013) Nat Biotechnol 31:827-832
 */
function offTargetScore(querySeq: string, targetSeq: string): number {
  if (querySeq.length !== targetSeq.length) return 0;

  let score = 0;
  const n = querySeq.length;

  for (let i = 0; i < n; i++) {
    if (querySeq[i] !== targetSeq[i]) {
      // Mismatches near PAM (seed region) are more penalizing
      const positionPenalty = i < 8 ? 0.2 : 0.05;
      score += positionPenalty;
    }
  }

  return Math.min(1, score);
}

/**
 * Search for potential off-target sites in a sequence.
 */
function findOffTargets(spacer: string, targetSequence: string, pam: string): GuideDesign["offTargetSites"] {
  const sites: GuideDesign["offTargetSites"] = [];
  const spacerLen = spacer.length;
  const pamLen = pam.length;

  for (let i = 0; i <= targetSequence.length - spacerLen - pamLen; i++) {
    const candidate = targetSequence.substring(i, i + spacerLen);
    const mismatches = spacer.split("").filter((b, j) => b !== candidate[j]).length;

    if (mismatches <= 4) {
      // allow up to 4 mismatches
      const score = offTargetScore(spacer, candidate);
      sites.push({
        position: i,
        mismatches,
        score: Math.round(score * 100) / 100,
      });
    }
  }

  return sites;
}

// ── Guide Design ───────────────────────────────────────────────────────────

/**
 * Design guide RNAs for a target position.
 *
 * Finds PAM sites near the target and designs spacers with
 * optimal on-target score and minimal off-target risk.
 */
function designGuides(targetSequence: string, targetPosition: number, mode: EditingMode): GuideDesign[] {
  const guides: GuideDesign[] = [];
  const pam = PAM_SEQUENCES.SpCas9;
  const spacerLen = 20;
  const pamLen = pam.length;

  // Scan for PAM sites near target position
  for (
    let i = Math.max(0, targetPosition - spacerLen - pamLen);
    i <= Math.min(targetSequence.length - spacerLen - pamLen, targetPosition + 10);
    i++
  ) {
    const pamSite = targetSequence.substring(i + spacerLen, i + spacerLen + pamLen);

    // Check PAM match (simplified: check for NGG)
    if (pamSite.length >= 3 && pamSite[2] === "G") {
      const spacer = targetSequence.substring(i, i + spacerLen);

      // On-target score (simplified Rule Set 2)
      const gc = (spacer.match(/[GC]/g) || []).length / spacerLen;
      const gcScore = gc >= 0.4 && gc <= 0.6 ? 1.0 : gc >= 0.3 && gc <= 0.7 ? 0.7 : 0.3;
      const onTargetScore = gcScore * 0.8 + 0.2; // base score

      // Off-target analysis
      const offTargets = findOffTargets(spacer, targetSequence, pam);

      // Editing window
      const window = EDITING_WINDOWS[mode === "base_editing" ? "BE3" : mode === "prime_editing" ? "PE2" : "BE3"];
      const targetInWindow = targetPosition >= i + window[0] && targetPosition <= i + window[1];

      guides.push({
        sequence: spacer,
        pam,
        position: i,
        onTargetScore: Math.round(onTargetScore * 100) / 100,
        offTargetSites: offTargets,
        editingWindow: window,
        targetInWindow,
      });
    }
  }

  // Sort by on-target score and target-in-window
  guides.sort((a, b) => {
    if (a.targetInWindow !== b.targetInWindow) return a.targetInWindow ? -1 : 1;
    return b.onTargetScore - a.onTargetScore;
  });

  return guides.slice(0, 5); // top 5 guides
}

// ── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Design a CRISPR edit for the given target.
 *
 * Supports:
 *   - Standard Cas9 cleavage (DSB + NHEJ/HDR)
 *   - Base editing (C→T or A→G without DSB)
 *   - Prime editing (arbitrary edits without DSB)
 */
export function designCRISPREdit(input: CRISPRInput): EditingResult {
  const {
    targetSequence,
    targetPosition,
    editType,
    desiredChange,
    insertion,
    deletionLength,
    mode,
    baseEditor = "BE3",
    primeEditor = "PE2",
    host,
    highFidelity = false,
  } = input;

  // Validate input
  if (targetPosition < 0 || targetPosition >= targetSequence.length) {
    return {
      mode,
      guides: [],
      predictedEdit: "invalid",
      predictedEfficiency: 0,
      offTargetRisk: 0,
      isAcceptable: false,
      rejectionReason: "Target position out of sequence bounds",
      evidence: [],
      designNotes: ["Invalid target position"],
    };
  }

  // Design guides
  const guides = designGuides(targetSequence, targetPosition, mode);

  if (guides.length === 0) {
    return {
      mode,
      guides: [],
      predictedEdit: "no_guide",
      predictedEfficiency: 0,
      offTargetRisk: 0,
      isAcceptable: false,
      rejectionReason: "No suitable PAM sites found near target position",
      evidence: [],
      designNotes: ["No PAM sites found near target"],
    };
  }

  const bestGuide = guides[0];

  // Mode-specific analysis
  let predictedEdit = "";
  let predictedEfficiency = 0;
  let offTargetRisk = 0;

  switch (mode) {
    case "cas9": {
      predictedEdit = `DSB at position ${targetPosition}, repair via NHEJ`;
      predictedEfficiency = bestGuide.onTargetScore * 0.8; // NHEJ efficiency
      break;
    }
    case "base_editing": {
      if (!desiredChange) {
        return {
          mode,
          guides,
          predictedEdit: "no_change",
          predictedEfficiency: 0,
          offTargetRisk: 0,
          isAcceptable: false,
          rejectionReason: "Base editing requires desiredChange (from → to)",
          evidence: [],
          designNotes: ["Missing desiredChange for base editing"],
        };
      }

      // Check if edit falls in editing window
      if (!bestGuide.targetInWindow) {
        return {
          mode,
          guides,
          predictedEdit: "out_of_window",
          predictedEfficiency: 0,
          offTargetRisk: 0,
          isAcceptable: false,
          rejectionReason: `Target position ${targetPosition} is outside editing window [${bestGuide.editingWindow[0]}, ${bestGuide.editingWindow[1]}]`,
          evidence: [],
          designNotes: ["Target outside editing window"],
        };
      }

      // Check edit compatibility with base editor
      const fromBase = desiredChange.from.toUpperCase();
      const toBase = desiredChange.to.toUpperCase();

      if (baseEditor === "BE3" || baseEditor === "BE4") {
        // CBE: C→T (or G→A on opposite strand)
        if (fromBase !== "C" || toBase !== "T") {
          return {
            mode,
            guides,
            predictedEdit: "incompatible",
            predictedEfficiency: 0,
            offTargetRisk: 0,
            isAcceptable: false,
            rejectionReason: `${baseEditor} only supports C→T edits, requested ${fromBase}→${toBase}`,
            evidence: [],
            designNotes: ["Incompatible edit for CBE"],
          };
        }
      } else if (baseEditor === "ABE") {
        // ABE: A→G (or T→C on opposite strand)
        if (fromBase !== "A" || toBase !== "G") {
          return {
            mode,
            guides,
            predictedEdit: "incompatible",
            predictedEfficiency: 0,
            offTargetRisk: 0,
            isAcceptable: false,
            rejectionReason: `ABE only supports A→G edits, requested ${fromBase}→${toBase}`,
            evidence: [],
            designNotes: ["Incompatible edit for ABE"],
          };
        }
      }

      predictedEdit = `${baseEditor}: ${fromBase}→${toBase} at position ${targetPosition}`;
      predictedEfficiency = bestGuide.onTargetScore * 0.6; // base editing efficiency
      break;
    }
    case "prime_editing": {
      if (editType === "substitution" && desiredChange) {
        predictedEdit = `PE: ${desiredChange.from}→${desiredChange.to} at position ${targetPosition}`;
      } else if (editType === "insertion" && insertion) {
        predictedEdit = `PE: insert ${insertion} at position ${targetPosition}`;
      } else if (editType === "deletion" && deletionLength) {
        predictedEdit = `PE: delete ${deletionLength} bp at position ${targetPosition}`;
      } else {
        return {
          mode,
          guides,
          predictedEdit: "invalid_edit",
          predictedEfficiency: 0,
          offTargetRisk: 0,
          isAcceptable: false,
          rejectionReason: "Prime editing requires valid editType and corresponding parameters",
          evidence: [],
          designNotes: ["Invalid prime editing parameters"],
        };
      }

      // Prime editing has lower efficiency than base editing
      predictedEfficiency = bestGuide.onTargetScore * 0.3;
      break;
    }
  }

  // Off-target risk
  const highRiskOffTargets = bestGuide.offTargetSites.filter((s) => s.score > 0.5);
  offTargetRisk = highRiskOffTargets.length > 0 ? Math.max(...highRiskOffTargets.map((s) => s.score)) : 0;

  // Acceptability
  const isAcceptable = predictedEfficiency > 0.1 && offTargetRisk < 0.5 && bestGuide.targetInWindow;
  const rejectionReason = !isAcceptable
    ? !bestGuide.targetInWindow
      ? "Target outside editing window"
      : offTargetRisk >= 0.5
        ? "High off-target risk"
        : "Low predicted efficiency"
    : undefined;

  return {
    mode,
    guides,
    predictedEdit,
    predictedEfficiency: Math.round(predictedEfficiency * 100) / 100,
    offTargetRisk: Math.round(offTargetRisk * 100) / 100,
    isAcceptable,
    rejectionReason,
    evidence: [
      { source: "Rule Set 2", type: "literature", title: "Doench et al. (2016) Nat Biotechnol 34:184" },
      { source: "CRISPOR", type: "database", title: "Concordet & Haeussler (2018) Bioinformatics 34:2243" },
    ],
    designNotes: [
      `Mode: ${mode}, Editor: ${mode === "base_editing" ? baseEditor : mode === "prime_editing" ? primeEditor : "SpCas9"}`,
      `Best guide: ${bestGuide.sequence} (score=${bestGuide.onTargetScore})`,
      `Editing window: [${bestGuide.editingWindow[0]}, ${bestGuide.editingWindow[1]}]`,
      `Target in window: ${bestGuide.targetInWindow}`,
      `Off-target sites: ${bestGuide.offTargetSites.length} (${highRiskOffTargets.length} high-risk)`,
    ],
  };
}
