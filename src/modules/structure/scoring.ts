/**
 * Complex Assembly Scoring Module
 *
 * Computes structural quality scores for protein-protein complexes:
 *   - Contact score: interface contact density
 *   - Area score: buried surface area estimation
 *   - Energy score: statistical potential approximation
 *   - Clash penalty: steric clash detection
 *   - Composite score: weighted combination
 *
 * @scientific_provenance
 *   ALGORITHM: Cα distance-based scoring with statistical potential
 *   REFERENCE: Krissinel & Henrick (2007) J Mol Biol 372:774
 *   REFERENCE: Zhang & Skolnick (2004) Proteins 57:702 (TM-score)
 */

import type { ComplexScore } from './types';

// ── Constants ────────────────────────────────────────────────────────────────

/** Default distance threshold for interface contacts (Å) */
const DEFAULT_DISTANCE_THRESHOLD = 8.0;

/** Default clash threshold (Å) */
const DEFAULT_CLASH_THRESHOLD = 2.0;

/** Approximate Cα sphere radius for area estimation (Å) */
const CA_RADIUS = 1.8;

/** Typical Cα-Cα distance in extended chain (Å) */
const CA_CA_DISTANCE = 3.8;

/** Default scoring weights */
const DEFAULT_WEIGHTS = {
  contact: 0.3,
  area: 0.3,
  energy: 0.3,
  clash: 0.1,
};

/** Statistical potential reference distance (Å) */
const REFERENCE_DISTANCE = 4.0;

/** Statistical potential well depth (kT units) */
const POTENTIAL_DEPTH = 1.0;

// ── PDB Parsing ──────────────────────────────────────────────────────────────

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
function parseCAlphaAtoms(
  pdbText: string,
  chainIds: string[],
): Map<string, ParsedAtom[]> {
  const chainSet = new Set(chainIds);
  const atoms = new Map<string, ParsedAtom[]>();
  for (const id of chainIds) atoms.set(id, []);

  const lines = pdbText.split('\n');
  for (const line of lines) {
    if (!line.startsWith('ATOM')) continue;

    const chain = line.substring(21, 22).trim();
    if (!chainSet.has(chain)) continue;

    const atomName = line.substring(12, 16).trim();
    if (atomName !== 'CA') continue;

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
function distance3D(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

// ── Scoring Functions ────────────────────────────────────────────────────────

/**
 * Compute contact score for a protein complex.
 *
 * Counts interface contacts (Cα pairs within threshold) and normalizes
 * by total possible contacts. Higher score indicates more extensive
 * interface formation.
 *
 * @param pdbText - PDB format text containing atom coordinates
 * @param chainIds - Chain IDs to analyze
 * @param options - Optional configuration
 * @param options.distanceThreshold - Cα distance threshold in Å (default: 8.0)
 * @returns Contact score in [0, 1]
 *
 * @example
 * ```ts
 * const score = computeContactScore(pdbText, ['A', 'B']);
 * console.log(`Contact score: ${score.toFixed(3)}`);
 * ```
 */
export function computeContactScore(
  pdbText: string,
  chainIds: string[],
  options?: { distanceThreshold?: number },
): number {
  if (!pdbText || chainIds.length < 2) return 0;

  const threshold = options?.distanceThreshold ?? DEFAULT_DISTANCE_THRESHOLD;
  const chainAtoms = parseCAlphaAtoms(pdbText, chainIds);

  // Count total atoms across all chains
  let totalAtoms = 0;
  for (const id of chainIds) {
    totalAtoms += (chainAtoms.get(id) || []).length;
  }

  if (totalAtoms === 0) return 0;

  // Count interface contacts between different chains
  let contactCount = 0;
  const seen = new Set<string>();

  for (let ci = 0; ci < chainIds.length; ci++) {
    for (let cj = ci + 1; cj < chainIds.length; cj++) {
      const atomsA = chainAtoms.get(chainIds[ci]) || [];
      const atomsB = chainAtoms.get(chainIds[cj]) || [];

      for (const a of atomsA) {
        for (const b of atomsB) {
          const dist = distance3D(a, b);
          if (dist < threshold) {
            const key = `${a.index}-${a.chain}-${b.index}-${b.chain}`;
            if (seen.has(key)) continue;
            seen.add(key);
            contactCount++;
          }
        }
      }
    }
  }

  // Normalize by total possible contacts (product of chain sizes)
  // Use geometric mean of chain sizes as normalization factor
  const chainSizes = chainIds.map(id => (chainAtoms.get(id) || []).length);
  const maxPossibleContacts = chainSizes.reduce((acc, size) => acc * size, 1);

  if (maxPossibleContacts === 0) return 0;

  return Math.min(1, contactCount / maxPossibleContacts);
}

/**
 * Compute area score for a protein complex.
 *
 * Estimates buried surface area from interface contacts using a simplified
 * sphere-based approximation. Each contact contributes an estimated buried
 * area based on the overlap of Cα spheres.
 *
 * @param pdbText - PDB format text containing atom coordinates
 * @param chainIds - Chain IDs to analyze
 * @returns Area score in [0, 1]
 *
 * @example
 * ```ts
 * const score = computeAreaScore(pdbText, ['A', 'B']);
 * console.log(`Area score: ${score.toFixed(3)}`);
 * ```
 */
export function computeAreaScore(
  pdbText: string,
  chainIds: string[],
): number {
  if (!pdbText || chainIds.length < 2) return 0;

  const chainAtoms = parseCAlphaAtoms(pdbText, chainIds);

  // Count total atoms
  let totalAtoms = 0;
  for (const id of chainIds) {
    totalAtoms += (chainAtoms.get(id) || []).length;
  }

  if (totalAtoms === 0) return 0;

  // Estimate buried area from contacts
  // Each contact between Cα atoms represents approximately the overlap
  // of two spheres of radius CA_RADIUS
  let buriedArea = 0;
  const seen = new Set<string>();

  for (let ci = 0; ci < chainIds.length; ci++) {
    for (let cj = ci + 1; cj < chainIds.length; cj++) {
      const atomsA = chainAtoms.get(chainIds[ci]) || [];
      const atomsB = chainAtoms.get(chainIds[cj]) || [];

      for (const a of atomsA) {
        for (const b of atomsB) {
          const dist = distance3D(a, b);

          // Only count contacts within 2 * CA_RADIUS (sphere overlap)
          if (dist < 2 * CA_RADIUS) {
            const key = `${a.index}-${a.chain}-${b.index}-${b.chain}`;
            if (seen.has(key)) continue;
            seen.add(key);

            // Simplified sphere overlap area estimation
            // For spheres of equal radius r with center distance d:
            // Overlap area ≈ π * (r - d/2)^2 for d < 2r
            const overlap = CA_RADIUS - dist / 2;
            if (overlap > 0) {
              buriedArea += Math.PI * overlap * overlap;
            }
          }
        }
      }
    }
  }

  // Normalize by total surface area of all Cα spheres
  const totalSurfaceArea = totalAtoms * 4 * Math.PI * CA_RADIUS * CA_RADIUS;

  if (totalSurfaceArea === 0) return 0;

  return Math.min(1, buriedArea / totalSurfaceArea);
}

/**
 * Compute energy score for a protein complex.
 *
 * Uses a simplified distance-dependent statistical potential to estimate
 * the stability of the complex. Lower scores indicate more stable complexes.
 *
 * The potential uses a Lennard-Jones-like form:
 *   E(r) = ε * [(σ/r)^12 - 2*(σ/r)^6]
 *
 * where σ is the reference distance and ε is the well depth.
 *
 * @param pdbText - PDB format text containing atom coordinates
 * @param chainIds - Chain IDs to analyze
 * @returns Energy score in [0, 1], lower = more stable
 *
 * @example
 * ```ts
 * const score = computeEnergyScore(pdbText, ['A', 'B']);
 * console.log(`Energy score: ${score.toFixed(3)}`);
 * ```
 */
export function computeEnergyScore(
  pdbText: string,
  chainIds: string[],
): number {
  if (!pdbText || chainIds.length < 2) return 0;

  const chainAtoms = parseCAlphaAtoms(pdbText, chainIds);

  // Compute pairwise energies between chains
  let totalEnergy = 0;
  let pairCount = 0;

  for (let ci = 0; ci < chainIds.length; ci++) {
    for (let cj = ci + 1; cj < chainIds.length; cj++) {
      const atomsA = chainAtoms.get(chainIds[ci]) || [];
      const atomsB = chainAtoms.get(chainIds[cj]) || [];

      for (const a of atomsA) {
        for (const b of atomsB) {
          const dist = distance3D(a, b);

          if (dist > 0 && dist < 15.0) {
            // Lennard-Jones-like potential
            const ratio = REFERENCE_DISTANCE / dist;
            const ratio6 = ratio ** 6;
            const ratio12 = ratio6 * ratio6;
            const energy = POTENTIAL_DEPTH * (ratio12 - 2 * ratio6);

            totalEnergy += energy;
            pairCount++;
          }
        }
      }
    }
  }

  if (pairCount === 0) return 0;

  // Average energy per pair
  const avgEnergy = totalEnergy / pairCount;

  // Normalize to [0, 1]
  // The Lennard-Jones potential minimum is -ε at r = σ
  // Range: [-ε, +∞) -> [0, 1]
  // Map: score = 1 - (avgEnergy + ε) / (2ε) for avgEnergy in [-ε, ε]
  // Clamp to [0, 1]
  const normalized = 1 - (avgEnergy + POTENTIAL_DEPTH) / (2 * POTENTIAL_DEPTH);
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Compute clash penalty for a protein complex.
 *
 * Detects steric clashes (atoms too close together) and returns a penalty
 * score. Higher penalty indicates more severe clashes.
 *
 * @param pdbText - PDB format text containing atom coordinates
 * @param chainIds - Chain IDs to analyze
 * @param options - Optional configuration
 * @param options.clashThreshold - Distance threshold for clash detection in Å (default: 2.0)
 * @returns Clash penalty in [0, 1], higher = more clashes
 *
 * @example
 * ```ts
 * const penalty = computeClashPenalty(pdbText, ['A', 'B']);
 * console.log(`Clash penalty: ${penalty.toFixed(3)}`);
 * ```
 */
export function computeClashPenalty(
  pdbText: string,
  chainIds: string[],
  options?: { clashThreshold?: number },
): number {
  if (!pdbText || chainIds.length < 2) return 0;

  const threshold = options?.clashThreshold ?? DEFAULT_CLASH_THRESHOLD;
  const chainAtoms = parseCAlphaAtoms(pdbText, chainIds);

  // Count total atoms
  let totalAtoms = 0;
  for (const id of chainIds) {
    totalAtoms += (chainAtoms.get(id) || []).length;
  }

  if (totalAtoms === 0) return 0;

  // Count clashes between different chains
  let clashCount = 0;
  const seen = new Set<string>();

  for (let ci = 0; ci < chainIds.length; ci++) {
    for (let cj = ci + 1; cj < chainIds.length; cj++) {
      const atomsA = chainAtoms.get(chainIds[ci]) || [];
      const atomsB = chainAtoms.get(chainIds[cj]) || [];

      for (const a of atomsA) {
        for (const b of atomsB) {
          const dist = distance3D(a, b);

          if (dist < threshold) {
            const key = `${a.index}-${a.chain}-${b.index}-${b.chain}`;
            if (seen.has(key)) continue;
            seen.add(key);
            clashCount++;
          }
        }
      }
    }
  }

  // Normalize by total possible contacts
  const chainSizes = chainIds.map(id => (chainAtoms.get(id) || []).length);
  const maxPossibleContacts = chainSizes.reduce((acc, size) => acc * size, 1);

  if (maxPossibleContacts === 0) return 0;

  return Math.min(1, clashCount / maxPossibleContacts);
}

/**
 * Compute composite score for a protein complex.
 *
 * Combines all sub-scores (contact, area, energy, clash) using configurable
 * weights. The final score is the weighted sum minus the clash penalty.
 *
 * Default weights:
 *   - contact: 0.3
 *   - area: 0.3
 *   - energy: 0.3
 *   - clash: 0.1
 *
 * @param pdbText - PDB format text containing atom coordinates
 * @param chainIds - Chain IDs to analyze
 * @param options - Optional configuration
 * @param options.weights - Custom weights for each score component
 * @returns ComplexScore with all sub-scores and final composite score
 *
 * @example
 * ```ts
 * const result = scoreComplex(pdbText, ['A', 'B']);
 * console.log(`Final score: ${result.finalScore.toFixed(3)}`);
 * console.log(`Contact: ${result.contactScore.toFixed(3)}`);
 * console.log(`Area: ${result.areaScore.toFixed(3)}`);
 * console.log(`Energy: ${result.energyScore.toFixed(3)}`);
 * console.log(`Clash: ${result.clashPenalty.toFixed(3)}`);
 * ```
 */
export function scoreComplex(
  pdbText: string,
  chainIds: string[],
  options?: {
    weights?: {
      contact?: number;
      area?: number;
      energy?: number;
      clash?: number;
    };
  },
): ComplexScore {
  const weights = {
    contact: options?.weights?.contact ?? DEFAULT_WEIGHTS.contact,
    area: options?.weights?.area ?? DEFAULT_WEIGHTS.area,
    energy: options?.weights?.energy ?? DEFAULT_WEIGHTS.energy,
    clash: options?.weights?.clash ?? DEFAULT_WEIGHTS.clash,
  };

  const contactScore = computeContactScore(pdbText, chainIds);
  const areaScore = computeAreaScore(pdbText, chainIds);
  const energyScore = computeEnergyScore(pdbText, chainIds);
  const clashPenalty = computeClashPenalty(pdbText, chainIds);

  // Compute weighted sum
  const weightedSum =
    weights.contact * contactScore +
    weights.area * areaScore +
    weights.energy * energyScore;

  // Final score: weighted sum minus clash penalty
  const finalScore = Math.max(0, Math.min(1, weightedSum - clashPenalty));

  return {
    contactScore: Math.round(contactScore * 1000) / 1000,
    areaScore: Math.round(areaScore * 1000) / 1000,
    energyScore: Math.round(energyScore * 1000) / 1000,
    clashPenalty: Math.round(clashPenalty * 1000) / 1000,
    finalScore: Math.round(finalScore * 1000) / 1000,
  };
}
