/**
 * Interface Prediction Module
 *
 * Detects and classifies protein-protein interfaces using geometric
 * (Cα distance) and embedding-based (cosine similarity) approaches.
 *
 * Geometric detection follows Krissinel & Henrick (2007) J Mol Biol 372:774.
 * Embedding similarity uses ESM-2 style representations from embeddings.ts.
 *
 * @scientific_provenance
 *   ALGORITHM: Cα distance-based interface detection + cosine similarity prediction
 */

import type { InterfacePrediction, InterfaceResidue, ProteinChain } from "./types";

// ── Constants ────────────────────────────────────────────────────────────────

/** Charged amino acids (positive + negative at physiological pH) */
const CHARGED_RESIDUES = new Set(["ASP", "GLU", "LYS", "ARG", "HIS"]);

/** Hydrophobic amino acids (3-letter PDB codes) */
const HYDROPHOBIC_RESIDUES = new Set(["ALA", "VAL", "LEU", "ILE", "PHE", "TRP", "MET", "PRO"]);

/** Hydrophobic amino acids (1-letter codes for sequence iteration) */
const HYDROPHOBIC_1LETTER = new Set(["A", "V", "L", "I", "F", "W", "M", "P"]);

/** Charged amino acids (1-letter codes for sequence iteration) */
const CHARGED_1LETTER = new Set(["D", "E", "K", "R", "H"]);

/** Residues capable of hydrogen bonding */
const HBOND_RESIDUES = new Set([
  "SER",
  "THR",
  "TYR",
  "ASN",
  "GLN",
  "ASP",
  "GLU",
  "LYS",
  "ARG",
  "HIS",
  "backbone", // backbone NH and C=O
]);

/** Distance thresholds for contact classification (Å) */
const DISTANCE_THRESHOLDS = {
  hydrogen_bond: 3.5,
  salt_bridge: 4.0,
  van_der_waals: 5.0,
  hydrophobic: 5.0,
} as const;

/** Similarity threshold for predicting an interface */
const SIMILARITY_THRESHOLD = 0.5;

// ── PDB Parsing Utilities ────────────────────────────────────────────────────

interface ParsedAtom {
  chain: string;
  index: number;
  residue: string;
  atom: string;
  x: number;
  y: number;
  z: number;
}

/**
 * Parse Cα atoms from PDB text for specified chains.
 *
 * @param pdbText - PDB format text
 * @param chainIds - Chain IDs to extract
 * @returns Map from chain ID to array of Cα atom positions
 */
function parseCAlphaAtoms(pdbText: string, chainIds: string[]): Map<string, ParsedAtom[]> {
  const chainSet = new Set(chainIds);
  const atoms = new Map<string, ParsedAtom[]>();
  for (const id of chainIds) atoms.set(id, []);

  const lines = pdbText.split("\n");
  for (const line of lines) {
    if (!line.startsWith("ATOM")) continue;

    const chain = line.substring(21, 22).trim();
    if (!chainSet.has(chain)) continue;

    const atomName = line.substring(12, 16).trim();
    if (atomName !== "CA") continue;

    atoms.get(chain)!.push({
      chain,
      index: parseInt(line.substring(22, 26).trim()),
      residue: line.substring(17, 20).trim(),
      atom: atomName,
      x: parseFloat(line.substring(30, 38)),
      y: parseFloat(line.substring(38, 46)),
      z: parseFloat(line.substring(46, 54)),
    });
  }

  return atoms;
}

/**
 * Compute Euclidean distance between two 3D points.
 */
function distance3D(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

/**
 * Classify a contact between two residues based on distance and residue type.
 *
 * Classification priority:
 *   1. Salt bridge: dist < 4.0Å and one residue positive, one negative (most specific)
 *   2. Hydrogen bond: dist < 3.5Å and residues capable of H-bonding
 *   3. Hydrophobic: dist < 5.0Å and both residues hydrophobic
 *   4. Van der Waals: dist < 5.0Å (default fallback)
 *
 * @param dist - Distance in Å
 * @param resA - Residue name of chain A
 * @param resB - Residue name of chain B
 * @returns Contact type classification
 */
function classifyContact(dist: number, resA: string, resB: string): InterfaceResidue["type"] {
  // Salt bridge: charged pair at close range
  if (dist < DISTANCE_THRESHOLDS.salt_bridge) {
    const aNeg = resA === "ASP" || resA === "GLU";
    const bNeg = resB === "ASP" || resB === "GLU";
    const aPos = resA === "LYS" || resA === "ARG" || resA === "HIS";
    const bPos = resB === "LYS" || resB === "ARG" || resB === "HIS";
    if ((aNeg && bPos) || (aPos && bNeg)) {
      return "salt_bridge";
    }
  }

  // Hydrogen bond: close proximity and H-bond capable residues
  if (dist < DISTANCE_THRESHOLDS.hydrogen_bond) {
    if (HBOND_RESIDUES.has(resA) || HBOND_RESIDUES.has(resB)) {
      return "hydrogen_bond";
    }
  }

  // Hydrophobic: both residues nonpolar at moderate distance
  if (dist < DISTANCE_THRESHOLDS.hydrophobic) {
    if (HYDROPHOBIC_RESIDUES.has(resA) && HYDROPHOBIC_RESIDUES.has(resB)) {
      return "hydrophobic";
    }
  }

  // Default: van der Waals
  return "van_der_waals";
}

/**
 * Compute confidence score for an interface contact.
 *
 * Closer distances yield higher confidence.
 * Confidence decays linearly from 1.0 at 0Å to 0.0 at threshold.
 *
 * @param dist - Distance in Å
 * @param threshold - Distance threshold in Å
 * @returns Confidence score in [0, 1]
 */
function computeConfidence(dist: number, threshold: number): number {
  if (dist <= 0) return 1.0;
  if (dist >= threshold) return 0.0;
  return Math.max(0, Math.min(1, 1 - dist / threshold));
}

// ── Embedding Utilities ──────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two embedding vectors.
 *
 * Both vectors must be the same length. Returns 0 for zero-magnitude vectors.
 *
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Cosine similarity in [-1, 1]
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;

  return dot / denom;
}

/**
 * Compute amino acid composition features for a sequence.
 *
 * Returns fractions: hydrophobic, charged, polar.
 *
 * @param sequence - Amino acid sequence
 * @returns Composition features
 */
function sequenceFeatures(sequence: string): {
  hydrophobicFraction: number;
  chargedFraction: number;
  length: number;
} {
  if (sequence.length === 0) {
    return { hydrophobicFraction: 0, chargedFraction: 0, length: 0 };
  }

  let hydrophobic = 0;
  let charged = 0;

  for (const aa of sequence) {
    if (HYDROPHOBIC_1LETTER.has(aa)) hydrophobic++;
    if (CHARGED_1LETTER.has(aa)) charged++;
  }

  return {
    hydrophobicFraction: hydrophobic / sequence.length,
    chargedFraction: charged / sequence.length,
    length: sequence.length,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect geometric interfaces between protein chains using Cα distance.
 *
 * For each pair of chains, computes pairwise Cα distances and identifies
 * residues within the distance threshold. Classifies contacts as hydrogen
 * bond, salt bridge, hydrophobic, or van der Waals based on distance and
 * residue chemistry.
 *
 * @param pdbText - PDB format text containing atom coordinates
 * @param chainIds - Chain IDs to analyze for interfaces
 * @param options - Optional configuration
 * @param options.distanceThreshold - Cα distance threshold in Å (default: 8.0)
 * @returns Array of interface residues with classification and confidence
 *
 * @example
 * ```ts
 * const interfaces = detectGeometricInterfaces(pdbText, ['A', 'B']);
 * console.log(interfaces.length); // number of interface contacts
 * ```
 */
export function detectGeometricInterfaces(
  pdbText: string,
  chainIds: string[],
  options?: { distanceThreshold?: number },
): InterfaceResidue[] {
  if (!pdbText || chainIds.length < 2) return [];

  const threshold = options?.distanceThreshold ?? 8.0;
  const chainAtoms = parseCAlphaAtoms(pdbText, chainIds);
  const residues: InterfaceResidue[] = [];
  const seen = new Set<string>();

  // Compare each pair of chains
  for (let ci = 0; ci < chainIds.length; ci++) {
    for (let cj = ci + 1; cj < chainIds.length; cj++) {
      const atomsA = chainAtoms.get(chainIds[ci]) || [];
      const atomsB = chainAtoms.get(chainIds[cj]) || [];

      for (const a of atomsA) {
        for (const b of atomsB) {
          const dist = distance3D(a, b);

          if (dist < threshold) {
            // Deduplicate: same residue pair can only appear once
            const key = `${a.index}-${a.chain}-${b.index}-${b.chain}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const type = classifyContact(dist, a.residue, b.residue);
            const confidence = computeConfidence(dist, threshold);

            residues.push({
              index: a.index,
              residue: a.residue,
              chain: a.chain,
              partnerChain: b.chain,
              distance: Math.round(dist * 100) / 100,
              type,
              confidence: Math.round(confidence * 100) / 100,
            });
          }
        }
      }
    }
  }

  return residues;
}

/**
 * Predict protein-protein interfaces from chain embeddings.
 *
 * Computes pairwise cosine similarity between chain embeddings and predicts
 * which chain pairs form interfaces based on a similarity threshold.
 * Higher similarity suggests evolutionary or structural compatibility.
 *
 * @param chains - Array of protein chains to analyze
 * @param embeddings - Map from chain ID to embedding vector
 * @returns Interface prediction with per-pair scores and overall confidence
 *
 * @example
 * ```ts
 * const prediction = predictInterfaceFromEmbeddings(chains, embeddings);
 * console.log(prediction.chainPairs[0].predictedInterface); // true/false
 * ```
 */
export function predictInterfaceFromEmbeddings(
  chains: ProteinChain[],
  embeddings: Map<string, number[]>,
): InterfacePrediction {
  if (chains.length < 2) {
    return { chainPairs: [], overallConfidence: 0 };
  }

  const chainPairs: InterfacePrediction["chainPairs"] = [];

  for (let i = 0; i < chains.length; i++) {
    for (let j = i + 1; j < chains.length; j++) {
      const chainA = chains[i];
      const chainB = chains[j];

      const embA = embeddings.get(chainA.id);
      const embB = embeddings.get(chainB.id);

      let similarity = 0;
      if (embA && embB && embA.length > 0 && embB.length > 0) {
        similarity = cosineSimilarity(embA, embB);
      }

      const contactProbability = estimateContactProbability(chainA, chainB, embeddings);

      chainPairs.push({
        chainA: chainA.id,
        chainB: chainB.id,
        similarity: Math.round(similarity * 1000) / 1000,
        contactProbability: Math.round(contactProbability * 1000) / 1000,
        predictedInterface: similarity >= SIMILARITY_THRESHOLD,
      });
    }
  }

  // Overall confidence is the mean of all pair similarities
  const totalSimilarity = chainPairs.reduce((sum, p) => sum + p.similarity, 0);
  const overallConfidence = chainPairs.length > 0 ? Math.round((totalSimilarity / chainPairs.length) * 1000) / 1000 : 0;

  return { chainPairs, overallConfidence };
}

/**
 * Estimate the probability of interface contact between two chains.
 *
 * Combines embedding similarity with sequence features (hydrophobicity,
 * charge distribution, length) to produce a contact probability.
 *
 * @param chainA - First protein chain
 * @param chainB - Second protein chain
 * @param embeddings - Map from chain ID to embedding vector
 * @returns Contact probability in [0, 1]
 *
 * @example
 * ```ts
 * const prob = estimateContactProbability(chainA, chainB, embeddings);
 * console.log(`Contact probability: ${(prob * 100).toFixed(1)}%`);
 * ```
 */
export function estimateContactProbability(
  chainA: ProteinChain,
  chainB: ProteinChain,
  embeddings: Map<string, number[]>,
): number {
  const embA = embeddings.get(chainA.id);
  const embB = embeddings.get(chainB.id);

  // Embedding similarity component (weight: 0.6)
  let embeddingScore = 0;
  if (embA && embB && embA.length > 0 && embB.length > 0) {
    embeddingScore = (cosineSimilarity(embA, embB) + 1) / 2; // normalize to [0, 1]
  }

  // Sequence feature similarity (weight: 0.4)
  const featA = sequenceFeatures(chainA.sequence);
  const featB = sequenceFeatures(chainB.sequence);

  // Hydrophobicity similarity
  const hydrophobicSim = 1 - Math.abs(featA.hydrophobicFraction - featB.hydrophobicFraction);

  // Charge complementarity (opposite charges attract)
  const chargeSim = 1 - Math.abs(featA.chargedFraction - featB.chargedFraction);

  // Length similarity (penalize very different lengths)
  const maxLen = Math.max(featA.length, featB.length, 1);
  const lengthSim = Math.min(featA.length, featB.length) / maxLen;

  const featureScore = 0.4 * hydrophobicSim + 0.3 * chargeSim + 0.3 * lengthSim;

  // Combined probability
  const probability = 0.6 * embeddingScore + 0.4 * featureScore;

  return Math.max(0, Math.min(1, Math.round(probability * 1000) / 1000));
}

/**
 * Classify interface residues by contact type with confidence scores.
 *
 * Parses PDB coordinates and classifies each interface residue based on
 * distance thresholds and residue chemistry. Uses the default 8Å threshold
 * for interface detection.
 *
 * @param pdbText - PDB format text containing atom coordinates
 * @param chainIds - Chain IDs to analyze
 * @returns Array of classified interface residues with confidence scores
 *
 * @example
 * ```ts
 * const classified = classifyInterfaceResidues(pdbText, ['A', 'B']);
 * const saltBridges = classified.filter(r => r.type === 'salt_bridge');
 * ```
 */
export function classifyInterfaceResidues(pdbText: string, chainIds: string[]): InterfaceResidue[] {
  return detectGeometricInterfaces(pdbText, chainIds, { distanceThreshold: 8.0 });
}
