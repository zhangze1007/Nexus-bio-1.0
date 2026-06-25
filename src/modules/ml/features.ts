/**
 * Feature Extraction for ML Metabolic Engineering
 *
 * Extracts features from enzyme sequences and metabolic context:
 *   1. Amino acid composition (20 features)
 *   2. Dipeptide frequency (400 features, reduced to top 20)
 *   3. Physicochemical properties (10 features)
 *   4. Sequence length and GC content
 *   5. ESM-2 embeddings (optional, via API)
 *
 * Reference: Chen et al. (2011) Anal Biochem 415:137 (AA composition)
 * Reference: Kawashima et al. (2008) Nucleic Acids Res 36:D202 (AAindex)
 */

import type { Dataset, TrainingSample } from "./types";

// ── Amino Acid Properties ──────────────────────────────────────────────────

/**
 * Physicochemical properties from AAindex database.
 * Reference: Kawashima et al. (2008) Nucleic Acids Res 36:D202
 */
const AA_PROPERTIES: Record<
  string,
  {
    hydrophobicity: number;
    charge: number;
    polarity: number;
    molecularWeight: number;
    pI: number;
  }
> = {
  A: { hydrophobicity: 0.62, charge: 0, polarity: 0, molecularWeight: 89.09, pI: 6.0 },
  R: { hydrophobicity: -2.53, charge: 1, polarity: 1, molecularWeight: 174.2, pI: 10.76 },
  N: { hydrophobicity: -0.78, charge: 0, polarity: 1, molecularWeight: 132.12, pI: 5.41 },
  D: { hydrophobicity: -0.9, charge: -1, polarity: 1, molecularWeight: 133.1, pI: 2.77 },
  C: { hydrophobicity: 0.29, charge: 0, polarity: 0, molecularWeight: 121.16, pI: 5.07 },
  Q: { hydrophobicity: -0.85, charge: 0, polarity: 1, molecularWeight: 146.15, pI: 5.65 },
  E: { hydrophobicity: -0.74, charge: -1, polarity: 1, molecularWeight: 147.13, pI: 3.22 },
  G: { hydrophobicity: 0.48, charge: 0, polarity: 0, molecularWeight: 75.03, pI: 5.97 },
  H: { hydrophobicity: -0.4, charge: 0.5, polarity: 1, molecularWeight: 155.16, pI: 7.59 },
  I: { hydrophobicity: 1.38, charge: 0, polarity: 0, molecularWeight: 131.17, pI: 6.02 },
  L: { hydrophobicity: 1.06, charge: 0, polarity: 0, molecularWeight: 131.17, pI: 5.98 },
  K: { hydrophobicity: -1.5, charge: 1, polarity: 1, molecularWeight: 146.19, pI: 9.74 },
  M: { hydrophobicity: 0.64, charge: 0, polarity: 0, molecularWeight: 149.21, pI: 5.74 },
  F: { hydrophobicity: 1.19, charge: 0, polarity: 0, molecularWeight: 165.19, pI: 5.48 },
  P: { hydrophobicity: 0.12, charge: 0, polarity: 0, molecularWeight: 115.13, pI: 6.3 },
  S: { hydrophobicity: -0.18, charge: 0, polarity: 1, molecularWeight: 105.09, pI: 5.68 },
  T: { hydrophobicity: -0.05, charge: 0, polarity: 1, molecularWeight: 119.12, pI: 5.6 },
  W: { hydrophobicity: 0.81, charge: 0, polarity: 0, molecularWeight: 204.23, pI: 5.89 },
  Y: { hydrophobicity: 0.26, charge: 0, polarity: 1, molecularWeight: 181.19, pI: 5.66 },
  V: { hydrophobicity: 1.08, charge: 0, polarity: 0, molecularWeight: 117.15, pI: 5.96 },
};

// ── Feature Extraction ─────────────────────────────────────────────────────

/**
 * Extract features from an enzyme sequence.
 *
 * Features:
 *   1. Amino acid composition (20 features) — fraction of each AA
 *   2. Dipeptide frequency (20 features) — top dipeptides
 *   3. Physicochemical properties (10 features) — mean hydrophobicity, charge, etc.
 *   4. Sequence properties (5 features) — length, MW, pI, etc.
 *   Total: 55 features
 */
export function extractFeatures(sequence: string): number[] {
  const seq = sequence.toUpperCase();
  const length = seq.length;

  if (length === 0) return new Array(55).fill(0);

  // 1. Amino acid composition (20 features)
  const aaComposition: Record<string, number> = {};
  for (const aa of aminoAcids) {
    aaComposition[aa] = (seq.split(aa).length - 1) / length;
  }
  const aaFeatures = aminoAcids.map((aa) => aaComposition[aa] || 0);

  // 2. Dipeptide frequency (20 features — top dipeptides)
  const dipeptides = generateDipeptides();
  const dipepFreq: Record<string, number> = {};
  for (const dp of dipeptides) {
    const count = (seq.match(new RegExp(dp, "g")) || []).length;
    dipepFreq[dp] = count / Math.max(1, length - 1);
  }
  const dipepFeatures = dipeptides.map((dp) => dipepFreq[dp] || 0);

  // 3. Physicochemical properties (10 features)
  const hydrophobicities = seq.split("").map((aa) => AA_PROPERTIES[aa]?.hydrophobicity ?? 0);
  const charges = seq.split("").map((aa) => AA_PROPERTIES[aa]?.charge ?? 0);
  const polarities = seq.split("").map((aa) => AA_PROPERTIES[aa]?.polarity ?? 0);
  const molecularWeights = seq.split("").map((aa) => AA_PROPERTIES[aa]?.molecularWeight ?? 110);

  const physioFeatures = [
    mean(hydrophobicities), // mean hydrophobicity
    std(hydrophobicities), // hydrophobicity std
    mean(charges), // mean charge
    charges.filter((c) => c > 0).length / length, // positive charge fraction
    mean(polarities), // mean polarity
    polarities.filter((p) => p > 0).length / length, // polar fraction
    mean(molecularWeights), // mean MW
    seq.split("").filter((aa) => AA_PROPERTIES[aa]?.hydrophobicity > 0.5).length / length, // hydrophobic fraction
    seq.split("").filter((aa) => AA_PROPERTIES[aa]?.charge !== 0).length / length, // charged fraction
    seq.split("").filter((aa) => "DEKRH".includes(aa)).length / length, // ionizable fraction
  ];

  // 4. Sequence properties (5 features)
  const seqFeatures = [
    length / 1000, // normalized length
    molecularWeights.reduce((s, w) => s + w, 0) / 1000, // total MW
    mean(seq.split("").map((aa) => AA_PROPERTIES[aa]?.pI ?? 7)), // mean pI
    (seq.match(/P/g) || []).length / length, // proline fraction (flexibility)
    (seq.match(/G/g) || []).length / length, // glycine fraction (flexibility)
  ];

  return [...aaFeatures, ...dipepFeatures, ...physioFeatures, ...seqFeatures];
}

/**
 * Get feature names for interpretability.
 */
export function getFeatureNames(): string[] {
  const aminoAcidFeatures = aminoAcids.map((aa) => `aa_${aa}`);
  const dipepFeatures = generateDipeptides().map((dp) => `dp_${dp}`);
  const physioFeatures = [
    "hydrophobicity_mean",
    "hydrophobicity_std",
    "charge_mean",
    "positive_fraction",
    "polarity_mean",
    "polar_fraction",
    "mw_mean",
    "hydrophobic_fraction",
    "charged_fraction",
    "ionizable_fraction",
  ];
  const seqFeatures = ["length_norm", "total_mw", "mean_pi", "proline_fraction", "glycine_fraction"];

  return [...aminoAcidFeatures, ...dipepFeatures, ...physioFeatures, ...seqFeatures];
}

const aminoAcids = "ACDEFGHIKLMNPQRSTVWY".split("");

function generateDipeptides(): string[] {
  // Top 20 most common dipeptides by frequency in UniProt
  return [
    "AA",
    "GG",
    "LL",
    "LA",
    "AL",
    "VL",
    "LV",
    "LS",
    "SL",
    "GS",
    "SA",
    "AS",
    "AG",
    "GA",
    "GL",
    "LG",
    "AV",
    "VA",
    "SS",
    "LE",
  ];
}

function mean(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function std(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, arr.length - 1));
}

/**
 * Build a dataset from enzyme sequences with known activities.
 */
export function buildDataset(
  samples: Array<{ sequence: string; activity: number; metadata?: Record<string, unknown> }>,
): Dataset {
  const featureNames = getFeatureNames();
  const trainingSamples: TrainingSample[] = samples.map((s) => ({
    features: extractFeatures(s.sequence),
    label: s.activity,
    metadata: s.metadata as TrainingSample["metadata"],
  }));

  return {
    featureNames,
    samples: trainingSamples,
    taskType: "regression",
  };
}

/**
 * Split dataset into train/test sets.
 */
export function trainTestSplit(
  dataset: Dataset,
  testFraction: number = 0.2,
): {
  train: Dataset;
  test: Dataset;
} {
  const n = dataset.samples.length;
  const nTest = Math.max(1, Math.floor(n * testFraction));

  // Shuffle indices
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const testIndices = new Set(indices.slice(0, nTest));
  const train = dataset.samples.filter((_, i) => !testIndices.has(i));
  const test = dataset.samples.filter((_, i) => testIndices.has(i));

  return {
    train: { ...dataset, samples: train },
    test: { ...dataset, samples: test },
  };
}
