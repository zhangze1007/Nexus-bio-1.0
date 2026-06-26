/**
 * Inverse Folding Engine — Chou-Fasman Propensity-Based Sequence Design
 *
 * Given a protein backbone structure (Cα coordinates), designs amino acid
 * sequences that are predicted to fold into that structure. Uses secondary
 * structure assignment from Cα geometry and Chou-Fasman propensity tables
 * to build a position-specific scoring matrix (PSSM), then samples sequences
 * via temperature-controlled softmax.
 *
 * This module complements the existing ESM-2-based inverse folding engine
 * (src/server/inverseFoldingEngine.ts) with a simpler, faster approach
 * that works without external model dependencies.
 *
 * @scientific_provenance
 *   ALGORITHM: Cα geometry → SS assignment → propensity PSSM → softmax sampling
 *   REFERENCE: Dauparas et al. (2022) Science 378:49-56 (ProteinMPNN concept)
 *   REFERENCE: Chou PY, Fasman GD (1978) Annu Rev Biochem 47:251-276
 *   KNOWN_LIMITATIONS:
 *     - Uses Cα-only backbone (no sidechain geometry)
 *     - Chou-Fasman propensities are context-independent
 *     - No pairwise interaction terms
 *     - No explicit solvent modeling
 */

import {
  HELIX_PROPENSITIES,
  SHEET_PROPENSITIES,
  LOOP_PROPENSITIES,
  HYDROPHOBIC_CORE,
  ALL_AMINO_ACIDS,
} from './propensity';
import type { BackboneAtom } from './backboneGenerator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InverseFoldingRequest {
  /** Backbone atoms (Cα coordinates, minimum 10 residues) */
  backbone: BackboneAtom[];
  /** Temperature for sampling (0=greedy/deterministic, 1=diverse). Default: 1.0 */
  temperature?: number;
  /** Number of sequences to generate. Default: 5 */
  numSequences?: number;
  /** Fixed residues (position → single-letter AA code, will not be redesigned) */
  fixedPositions?: Map<number, string>;
  /** Wild-type sequence for sequence identity calculation */
  wildType?: string;
}

export interface InverseFoldingResult {
  sequences: Array<{
    sequence: string;
    /** Design quality score (higher = better) */
    score: number;
    /** Sequence identity to wild-type (0-1), if wildType was provided */
    sequenceIdentity?: number;
    /** Per-position confidence (0-1) */
    perResidueScores: number[];
  }>;
  metadata: {
    model: string;
    temperature: number;
    length: number;
    timestamp: string;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL_NAME = 'nexus-bio-inverse-fold-cf';

/** Cα-Cα distance thresholds for secondary structure classification */
const HELIX_CA_DIST = 3.8; // Å, typical α-helix
const SHEET_CA_DIST = 6.5; // Å, typical β-sheet

/** Weights for combining propensity with hydrophobic packing */
const SS_WEIGHT = 0.7;
const PACKING_WEIGHT = 0.3;

// ---------------------------------------------------------------------------
// Geometry utilities
// ---------------------------------------------------------------------------

function euclideanDistance(a: BackboneAtom, b: BackboneAtom): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// ---------------------------------------------------------------------------
// Secondary structure assignment
// ---------------------------------------------------------------------------

/**
 * Assign secondary structure from Cα geometry.
 *
 * Uses Cα-Cα distances to classify each residue as helix, sheet, or loop.
 * This mirrors the approach in the existing inverseFoldingEngine.ts.
 *
 * Thresholds:
 *   - Helix: avg Cα-Cα distance < 4.1 Å (3.8 + 0.3 tolerance)
 *   - Sheet: avg Cα-Cα distance > 5.5 Å (6.5 - 1.0 tolerance)
 *   - Loop: everything else
 */
function assignSecondaryStructure(
  backbone: BackboneAtom[],
): Array<'helix' | 'sheet' | 'loop'> {
  const n = backbone.length;
  const assignments: Array<'helix' | 'sheet' | 'loop'> = [];

  for (let i = 0; i < n; i++) {
    if (i === 0 || i === n - 1) {
      // Terminal residues default to loop (no flanking neighbors for both sides)
      assignments.push('loop');
      continue;
    }

    const d1 = euclideanDistance(backbone[i - 1], backbone[i]);
    const d2 = euclideanDistance(backbone[i], backbone[i + 1]);
    const avgDist = (d1 + d2) / 2;

    if (avgDist < HELIX_CA_DIST + 0.3) {
      assignments.push('helix');
    } else if (avgDist > SHEET_CA_DIST - 1.0) {
      assignments.push('sheet');
    } else {
      assignments.push('loop');
    }
  }

  return assignments;
}

// ---------------------------------------------------------------------------
// PSSM construction
// ---------------------------------------------------------------------------

/**
 * Build a position-specific scoring matrix from secondary structure assignments
 * and local structural context.
 *
 * For each position, computes a probability distribution over 20 amino acids
 * based on:
 *   1. Chou-Fasman propensity for the local secondary structure
 *   2. Hydrophobic packing preference (buried → hydrophobic, exposed → polar)
 *
 * The PSSM is unnormalized (raw scores); normalization happens during sampling.
 */
function buildPSSM(
  backbone: BackboneAtom[],
  ssAssignments: Array<'helix' | 'sheet' | 'loop'>,
): number[][] {
  const n = backbone.length;
  const pssm: number[][] = [];

  // Estimate burial for each residue
  const burial: number[] = [];
  for (let i = 0; i < n; i++) {
    let neighborCount = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = euclideanDistance(backbone[i], backbone[j]);
      if (d < 12.0) neighborCount++;
    }
    // Normalize: 0 = exposed, 1 = buried
    burial.push(Math.min(1.0, neighborCount / 12));
  }

  for (let i = 0; i < n; i++) {
    const ss = ssAssignments[i];
    const scores: number[] = [];

    for (let a = 0; a < 20; a++) {
      const aa = ALL_AMINO_ACIDS[a];

      // 1. Secondary structure propensity score
      let ssScore: number;
      switch (ss) {
        case 'helix':
          ssScore = HELIX_PROPENSITIES[aa] ?? 1.0;
          break;
        case 'sheet':
          ssScore = SHEET_PROPENSITIES[aa] ?? 1.0;
          break;
        case 'loop':
          ssScore = LOOP_PROPENSITIES[aa] ?? 1.0;
          break;
      }
      // Normalize propensity to ~[0, 1]
      ssScore = ssScore / 1.91; // max propensity value

      // 2. Hydrophobic packing score
      const isHydrophobic = HYDROPHOBIC_CORE.has(aa);
      let packingScore: number;
      if (burial[i] > 0.5) {
        // Buried → prefer hydrophobic
        packingScore = isHydrophobic ? 1.0 : 0.3;
      } else {
        // Exposed → prefer polar
        packingScore = isHydrophobic ? 0.4 : 0.8;
      }

      // Combined score
      scores.push(SS_WEIGHT * ssScore + PACKING_WEIGHT * packingScore);
    }

    pssm.push(scores);
  }

  return pssm;
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

/**
 * Sample an amino acid at a given position using temperature-controlled softmax.
 *
 * At temperature=0, selects the highest-scoring amino acid (greedy).
 * At temperature=1, samples proportionally to the score distribution.
 *
 * @param scores - Raw scores for 20 amino acids (unnormalized)
 * @param temperature - Sampling temperature (0=greedy, 1=diverse)
 * @returns Index of selected amino acid and its probability
 */
function sampleAminoAcid(
  scores: number[],
  temperature: number,
): { index: number; probability: number } {
  if (temperature <= 0) {
    // Greedy: pick the argmax
    let maxIdx = 0;
    let maxVal = scores[0];
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > maxVal) {
        maxVal = scores[i];
        maxIdx = i;
      }
    }
    return { index: maxIdx, probability: 1.0 };
  }

  // Temperature-controlled softmax
  const scaled = scores.map((s) => s / temperature);
  const maxScaled = Math.max(...scaled);
  const expScores = scaled.map((s) => Math.exp(s - maxScaled)); // subtract max for stability
  const sumExp = expScores.reduce((a, b) => a + b, 0);
  const probs = expScores.map((e) => e / sumExp);

  // Sample from distribution
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < probs.length; i++) {
    cumulative += probs[i];
    if (r <= cumulative) {
      return { index: i, probability: probs[i] };
    }
  }

  // Fallback: last amino acid
  return { index: 19, probability: probs[19] };
}

/**
 * Sample a complete sequence from the PSSM.
 *
 * @param pssm - Position-specific scoring matrix
 * @param temperature - Sampling temperature
 * @param fixedPositions - Fixed residues (position → AA code)
 * @returns Sampled sequence and per-position confidence scores
 */
function sampleSequence(
  pssm: number[][],
  temperature: number,
  fixedPositions?: Map<number, string>,
): { sequence: string; perResidueScores: number[] } {
  const n = pssm.length;
  let sequence = '';
  const perResidueScores: number[] = [];

  for (let i = 0; i < n; i++) {
    // Check if this position is fixed
    if (fixedPositions?.has(i)) {
      const fixedAA = fixedPositions.get(i)!;
      sequence += fixedAA;
      perResidueScores.push(1.0); // Fixed positions get maximum confidence
      continue;
    }

    const { index, probability } = sampleAminoAcid(pssm[i], temperature);
    sequence += ALL_AMINO_ACIDS[index];
    perResidueScores.push(Math.round(probability * 1000) / 1000);
  }

  return { sequence, perResidueScores };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Compute a design quality score for a sampled sequence.
 *
 * Evaluates how well the sequence fits the backbone structure based on:
 *   1. PSSM probability at each position (how likely was this residue?)
 *   2. Hydrophobic core integrity (hydrophobic residues buried?)
 *
 * @returns Score in [0, 1], higher = better
 */
function scoreDesign(
  sequence: string,
  pssm: number[][],
  backbone: BackboneAtom[],
): number {
  const n = sequence.length;

  // 1. PSSM log-probability score
  let logProbScore = 0;
  for (let i = 0; i < n; i++) {
    const aa = sequence[i];
    const aaIdx = ALL_AMINO_ACIDS.indexOf(aa);
    if (aaIdx >= 0) {
      const prob = pssm[i][aaIdx];
      logProbScore += Math.log(Math.max(prob, 1e-10));
    }
  }
  // Normalize: average log-probability per residue
  const avgLogProb = logProbScore / n;
  // Map from log-prob range to [0, 1]
  const probScore = Math.min(1.0, Math.max(0.0, (avgLogProb + 3) / 3));

  // 2. Hydrophobic core integrity
  let coreScore = 0;
  let coreCount = 0;
  for (let i = 0; i < n; i++) {
    let neighborCount = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = euclideanDistance(backbone[i], backbone[j]);
      if (d < 12.0) neighborCount++;
    }
    const burial = Math.min(1.0, neighborCount / 12);

    if (burial > 0.5) {
      // Buried position
      const isHydrophobic = HYDROPHOBIC_CORE.has(sequence[i]);
      coreScore += isHydrophobic ? 1.0 : 0.0;
      coreCount++;
    }
  }
  const coreIntegrity = coreCount > 0 ? coreScore / coreCount : 0.5;

  // Weighted combination
  return Math.round((0.6 * probScore + 0.4 * coreIntegrity) * 1000) / 1000;
}

/**
 * Compute sequence identity between two sequences.
 *
 * Fraction of positions where both sequences have the same amino acid.
 */
function computeSequenceIdentity(seq1: string, seq2: string): number {
  if (seq1.length === 0) return 0;
  const len = Math.min(seq1.length, seq2.length);
  let matches = 0;
  for (let i = 0; i < len; i++) {
    if (seq1[i] === seq2[i]) matches++;
  }
  return Math.round((matches / len) * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Design amino acid sequences that fold into a given backbone structure.
 *
 * Pipeline:
 *   1. Assign secondary structure from Cα geometry
 *   2. Build propensity PSSM from Chou-Fasman tables
 *   3. Sample sequences via temperature-controlled softmax
 *   4. Score and rank candidates
 *   5. Compute sequence identity to wild-type (if provided)
 *
 * @param request - Inverse folding parameters
 * @returns Designed sequences with scores and metadata
 */
export function inverseFold(request: InverseFoldingRequest): InverseFoldingResult {
  const {
    backbone,
    temperature = 1.0,
    numSequences = 5,
    fixedPositions,
    wildType,
  } = request;

  // Validate input
  if (backbone.length < 10) {
    throw new Error('Inverse folding requires at least 10 residues');
  }

  // 1. Assign secondary structure
  const ssAssignments = assignSecondaryStructure(backbone);

  // 2. Build PSSM
  const pssm = buildPSSM(backbone, ssAssignments);

  // 3. Sample sequences
  const sequences: InverseFoldingResult['sequences'] = [];
  const seenSequences = new Set<string>();
  const maxAttempts = numSequences * 10;
  let attempts = 0;

  while (sequences.length < numSequences && attempts < maxAttempts) {
    attempts++;

    const { sequence, perResidueScores } = sampleSequence(pssm, temperature, fixedPositions);

    // Skip duplicates
    if (seenSequences.has(sequence)) continue;
    seenSequences.add(sequence);

    // Score the design
    const score = scoreDesign(sequence, pssm, backbone);

    // Compute sequence identity if wild-type provided
    const sequenceIdentity = wildType !== undefined
      ? computeSequenceIdentity(sequence, wildType)
      : undefined;

    sequences.push({
      sequence,
      score,
      sequenceIdentity,
      perResidueScores,
    });
  }

  // Sort by score (descending)
  sequences.sort((a, b) => b.score - a.score);

  return {
    sequences,
    metadata: {
      model: MODEL_NAME,
      temperature,
      length: backbone.length,
      timestamp: new Date().toISOString(),
    },
  };
}
