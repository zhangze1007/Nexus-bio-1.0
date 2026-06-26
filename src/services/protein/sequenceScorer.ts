/**
 * Sequence Scorer — Quality Evaluation for Designed Protein Sequences
 *
 * Scores amino acid sequences against backbone structure and secondary
 * structure assignments. Uses Chou-Fasman propensities, hydrophobic packing,
 * charge balance, and sequence diversity as scoring components.
 *
 * @scientific_provenance
 *   ALGORITHM: Multi-component scoring (SS propensity + hydrophobic packing +
 *              charge balance + sequence diversity)
 *   REFERENCE: Chou PY, Fasman GD (1978) Annu Rev Biochem 47:251-276
 *   KNOWN_LIMITATIONS:
 *     - Hydrophobic core estimation uses distance proxy, not SASA
 *     - Charge balance does not model pH-dependent protonation
 *     - No pairwise interaction terms (statistical potentials)
 */

import {
  HELIX_PROPENSITIES,
  SHEET_PROPENSITIES,
  LOOP_PROPENSITIES,
  HYDROPHOBIC_CORE,
  CHARGE_PAIRS,
  ALL_AMINO_ACIDS,
} from './propensity';
import type { BackboneAtom } from './backboneGenerator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoringResult {
  totalScore: number;
  components: {
    /** Does the sequence match local secondary structure? (0-1) */
    secondaryStructure: number;
    /** Are hydrophobic residues buried in the core? (0-1) */
    hydrophobicCore: number;
    /** Are charges balanced (salt bridges, net charge)? (0-1) */
    chargeBalance: number;
    /** Is the sequence composition diverse enough? (0-1) */
    diversity: number;
  };
  /** Per-residue quality score (0-1, higher = better fit) */
  perResidueScores: number[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Normalize a propensity value to [0, 1] range given a max expected value */
function normalizePropensity(value: number, maxExpected: number): number {
  return Math.min(1.0, Math.max(0.0, value / maxExpected));
}

/** Compute Euclidean distance between two backbone atoms */
function distance(a: BackboneAtom, b: BackboneAtom): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Count unique amino acids in a sequence */
function countUniqueAA(sequence: string): number {
  const seen = new Set<string>();
  for (const aa of sequence) seen.add(aa);
  return seen.size;
}

// ---------------------------------------------------------------------------
// Component scorers
// ---------------------------------------------------------------------------

/**
 * Score secondary structure match.
 *
 * For each position, checks if the amino acid's propensity matches the
 * assigned secondary structure (helix/sheet/loop). Uses published
 * Chou-Fasman propensity values.
 *
 * @returns Per-residue scores in [0, 1]
 */
function scoreSecondaryStructure(
  sequence: string,
  ssAssignments: Array<'helix' | 'sheet' | 'loop'>,
): number[] {
  const scores: number[] = [];
  const maxPropensity = 1.91; // Pro loop propensity is highest

  for (let i = 0; i < sequence.length; i++) {
    const aa = sequence[i];
    const ss = ssAssignments[i];

    let propensity: number;
    switch (ss) {
      case 'helix':
        propensity = HELIX_PROPENSITIES[aa] ?? 1.0;
        break;
      case 'sheet':
        propensity = SHEET_PROPENSITIES[aa] ?? 1.0;
        break;
      case 'loop':
        propensity = LOOP_PROPENSITIES[aa] ?? 1.0;
        break;
    }

    // Normalize: propensity > 1.0 means favorable, < 1.0 means unfavorable
    // Map [0, maxPropensity] -> [0, 1]
    scores.push(normalizePropensity(propensity, maxPropensity));
  }

  return scores;
}

/**
 * Score hydrophobic core packing.
 *
 * Estimates burial from local backbone density (number of nearby Cα atoms).
 * Buried positions should have hydrophobic residues; exposed positions should
 * have polar/charged residues.
 *
 * @returns Per-residue scores in [0, 1]
 */
function scoreHydrophobicCore(
  sequence: string,
  backbone: BackboneAtom[],
): number[] {
  const n = backbone.length;
  const scores: number[] = [];

  // Compute local density for each residue (proxy for burial)
  const burialScores: number[] = [];
  for (let i = 0; i < n; i++) {
    let neighborCount = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = distance(backbone[i], backbone[j]);
      if (d < 12.0) neighborCount++;
    }
    // Normalize: 0 = fully exposed, 1 = fully buried
    burialScores.push(Math.min(1.0, neighborCount / 12));
  }

  for (let i = 0; i < n; i++) {
    const aa = sequence[i];
    const isHydrophobic = HYDROPHOBIC_CORE.has(aa);
    const burial = burialScores[i];

    if (burial > 0.5) {
      // Buried position — hydrophobic residues preferred
      scores.push(isHydrophobic ? 1.0 : 0.3);
    } else {
      // Exposed position — polar/charged residues preferred
      scores.push(isHydrophobic ? 0.4 : 0.8);
    }
  }

  return scores;
}

/**
 * Score charge balance.
 *
 * Evaluates:
 *   1. Net charge near zero (globular proteins are roughly neutral)
 *   2. Presence of salt bridge pairs (oppositely charged residues nearby)
 *
 * @returns Per-residue scores in [0, 1]
 */
function scoreChargeBalance(
  sequence: string,
  backbone: BackboneAtom[],
): number[] {
  const n = sequence.length;
  const scores: number[] = [];

  // Charge map for standard amino acids
  const chargeMap: Record<string, number> = {
    D: -1, E: -1, K: 1, R: 1, H: 0.5,
  };

  // Compute global net charge
  let netCharge = 0;
  for (const aa of sequence) {
    netCharge += chargeMap[aa] ?? 0;
  }
  const netChargePenalty = Math.abs(netCharge) / n; // 0 = perfect, 1 = all charged

  for (let i = 0; i < n; i++) {
    const aa = sequence[i];
    const charge = chargeMap[aa] ?? 0;

    if (charge === 0) {
      // Neutral residue — always fine
      scores.push(0.9);
      continue;
    }

    // Check if there's a nearby opposite charge (salt bridge)
    let hasSaltBridge = false;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = distance(backbone[i], backbone[j]);
      if (d < 8.0) {
        const neighborCharge = chargeMap[sequence[j]] ?? 0;
        if (charge * neighborCharge < 0) {
          // Opposite charges nearby — salt bridge
          hasSaltBridge = true;
          break;
        }
      }
    }

    if (hasSaltBridge) {
      scores.push(1.0); // Salt bridge — excellent
    } else {
      // Charged but no salt bridge — penalize by net charge imbalance
      scores.push(Math.max(0.2, 0.7 - netChargePenalty * 0.5));
    }
  }

  return scores;
}

/**
 * Score sequence diversity.
 *
 * Shannon entropy of amino acid composition, normalized to [0, 1].
 * Higher diversity = more different amino acids used.
 *
 * @returns Per-residue scores (uniform across all positions)
 */
function scoreDiversity(sequence: string): number[] {
  // Count amino acid frequencies
  const counts: Record<string, number> = {};
  for (const aa of ALL_AMINO_ACIDS) counts[aa] = 0;
  for (const aa of sequence) counts[aa] = (counts[aa] ?? 0) + 1;

  const n = sequence.length;
  let entropy = 0;
  for (const aa of ALL_AMINO_ACIDS) {
    const p = counts[aa] / n;
    if (p > 0) entropy -= p * Math.log2(p);
  }

  // Max entropy = log2(20) ≈ 4.32
  const maxEntropy = Math.log2(20);
  const normalizedEntropy = Math.min(1.0, entropy / maxEntropy);

  // Return uniform score for all positions
  return Array(n).fill(normalizedEntropy);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score an amino acid sequence against backbone structure and SS assignments.
 *
 * Computes four scoring components:
 *   1. Secondary structure — Chou-Fasman propensity match
 *   2. Hydrophobic core — burial-appropriate residue selection
 *   3. Charge balance — salt bridges and net charge
 *   4. Diversity — amino acid composition variety
 *
 * The total score is the geometric mean of all components (penalizes
 * any single bad component more than arithmetic mean).
 *
 * @param sequence - Single-letter amino acid sequence
 * @param backbone - Cα coordinates for each residue
 * @param ssAssignments - Secondary structure assignment per residue
 * @returns ScoringResult with total score, components, and per-residue scores
 */
export function scoreSequence(
  sequence: string,
  backbone: BackboneAtom[],
  ssAssignments: Array<'helix' | 'sheet' | 'loop'>,
): ScoringResult {
  // Validate inputs
  if (sequence.length !== backbone.length) {
    throw new Error(
      `Sequence length (${sequence.length}) must match backbone length (${backbone.length})`,
    );
  }
  if (sequence.length !== ssAssignments.length) {
    throw new Error(
      `Sequence length (${sequence.length}) must match SS assignments length (${ssAssignments.length})`,
    );
  }

  // Compute per-residue scores for each component
  const ssScores = scoreSecondaryStructure(sequence, ssAssignments);
  const hydroScores = scoreHydrophobicCore(sequence, backbone);
  const chargeScores = scoreChargeBalance(sequence, backbone);
  const diversityScores = scoreDiversity(sequence);

  // Aggregate per-residue scores
  const n = sequence.length;
  const perResidueScores: number[] = [];
  for (let i = 0; i < n; i++) {
    // Weighted average per residue
    const score =
      0.35 * ssScores[i] +
      0.30 * hydroScores[i] +
      0.20 * chargeScores[i] +
      0.15 * diversityScores[i];
    perResidueScores.push(Math.round(Math.min(1.0, Math.max(0.0, score)) * 1000) / 1000);
  }

  // Component averages
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const components = {
    secondaryStructure: Math.round(avg(ssScores) * 1000) / 1000,
    hydrophobicCore: Math.round(avg(hydroScores) * 1000) / 1000,
    chargeBalance: Math.round(avg(chargeScores) * 1000) / 1000,
    diversity: Math.round(avg(diversityScores) * 1000) / 1000,
  };

  // Total score: geometric mean of components (penalizes imbalance)
  const geoMean = Math.pow(
    components.secondaryStructure *
      components.hydrophobicCore *
      components.chargeBalance *
      components.diversity,
    0.25,
  );

  const totalScore = Math.round(Math.min(1.0, Math.max(0.0, geoMean)) * 1000) / 1000;

  return {
    totalScore,
    components,
    perResidueScores,
  };
}
