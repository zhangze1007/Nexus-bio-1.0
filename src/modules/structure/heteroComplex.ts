/**
 * Protein-DNA/RNA Complex Support Module
 *
 * Provides multi-type chain encoding, chain type-specific feature extraction,
 * complex encoding, and hetero-complex interface prediction.
 *
 * Supports protein, DNA, and RNA chains with type-specific feature vectors:
 *   - Protein: 20 amino acid composition + 3 physicochemical + 1 length = 24 dims
 *   - DNA: 4 nucleotide composition + 1 GC content + 1 length = 6 dims
 *   - RNA: 4 nucleotide composition + 1 GC content + 1 length = 6 dims
 *
 * @scientific_provenance
 *   ALGORITHM: Chain type-specific feature extraction + pairwise interface prediction
 *   REFERENCE: Krissinel & Henrick (2007) J Mol Biol 372:774 (interface detection)
 */

import type {
  ProteinChain,
  HeteroChain,
  HeteroComplex,
  InterfacePrediction,
  ChainType,
} from './types';

// ── Constants ────────────────────────────────────────────────────────────────

/** Standard amino acids (1-letter codes) in alphabetical order */
const STANDARD_AA = 'ACDEFGHIKLMNPQRSTVWY';

/** Hydrophobic amino acids */
const HYDROPHOBIC_AA = new Set(['A', 'V', 'L', 'I', 'F', 'W', 'M', 'P']);

/** Charged amino acids at physiological pH */
const CHARGED_AA = new Set(['D', 'E', 'K', 'R', 'H']);

/** Polar amino acids */
const POLAR_AA = new Set(['S', 'T', 'N', 'Q', 'Y', 'C']);

/** Similarity threshold for predicting an interface */
const SIMILARITY_THRESHOLD = 0.5;

// ── Feature Extraction Helpers ───────────────────────────────────────────────

/**
 * Extract amino acid composition features for a protein sequence.
 *
 * Returns 24 dimensions:
 *   - Indices 0-19: Amino acid composition (fraction of each standard AA)
 *   - Index 20: Hydrophobic fraction
 *   - Index 21: Charged fraction
 *   - Index 22: Polar fraction
 *   - Index 23: Normalized sequence length (capped at 1000)
 *
 * @param sequence - Amino acid sequence
 * @returns Feature vector of length 24
 */
function extractProteinFeatures(sequence: string): number[] {
  const features: number[] = new Array(24).fill(0);

  if (sequence.length === 0) return features;

  // Amino acid composition (20 dimensions)
  for (let i = 0; i < sequence.length; i++) {
    const aa = sequence[i].toUpperCase();
    const idx = STANDARD_AA.indexOf(aa);
    if (idx >= 0) features[idx]++;
  }

  // Normalize to fractions
  for (let i = 0; i < 20; i++) {
    features[i] /= sequence.length;
  }

  // Physicochemical properties
  let hydrophobic = 0;
  let charged = 0;
  let polar = 0;

  for (const aa of sequence) {
    const upper = aa.toUpperCase();
    if (HYDROPHOBIC_AA.has(upper)) hydrophobic++;
    if (CHARGED_AA.has(upper)) charged++;
    if (POLAR_AA.has(upper)) polar++;
  }

  features[20] = hydrophobic / sequence.length;
  features[21] = charged / sequence.length;
  features[22] = polar / sequence.length;
  features[23] = Math.min(1, sequence.length / 1000); // normalized length

  return features;
}

/**
 * Extract nucleotide composition features for a DNA sequence.
 *
 * Returns 6 dimensions:
 *   - Index 0: A fraction
 *   - Index 1: T fraction
 *   - Index 2: G fraction
 *   - Index 3: C fraction
 *   - Index 4: GC content
 *   - Index 5: Normalized sequence length (capped at 10000)
 *
 * @param sequence - DNA sequence (A, T, G, C)
 * @returns Feature vector of length 6
 */
function extractDnaFeatures(sequence: string): number[] {
  const features: number[] = new Array(6).fill(0);

  if (sequence.length === 0) return features;

  const seq = sequence.toUpperCase();
  let a = 0;
  let t = 0;
  let g = 0;
  let c = 0;

  for (const nt of seq) {
    if (nt === 'A') a++;
    else if (nt === 'T') t++;
    else if (nt === 'G') g++;
    else if (nt === 'C') c++;
  }

  features[0] = a / sequence.length;
  features[1] = t / sequence.length;
  features[2] = g / sequence.length;
  features[3] = c / sequence.length;
  features[4] = (g + c) / sequence.length; // GC content
  features[5] = Math.min(1, sequence.length / 10000); // normalized length

  return features;
}

/**
 * Extract nucleotide composition features for an RNA sequence.
 *
 * Returns 6 dimensions:
 *   - Index 0: A fraction
 *   - Index 1: U fraction
 *   - Index 2: G fraction
 *   - Index 3: C fraction
 *   - Index 4: GC content
 *   - Index 5: Normalized sequence length (capped at 10000)
 *
 * @param sequence - RNA sequence (A, U, G, C)
 * @returns Feature vector of length 6
 */
function extractRnaFeatures(sequence: string): number[] {
  const features: number[] = new Array(6).fill(0);

  if (sequence.length === 0) return features;

  const seq = sequence.toUpperCase();
  let a = 0;
  let u = 0;
  let g = 0;
  let c = 0;

  for (const nt of seq) {
    if (nt === 'A') a++;
    else if (nt === 'U') u++;
    else if (nt === 'G') g++;
    else if (nt === 'C') c++;
  }

  features[0] = a / sequence.length;
  features[1] = u / sequence.length;
  features[2] = g / sequence.length;
  features[3] = c / sequence.length;
  features[4] = (g + c) / sequence.length; // GC content
  features[5] = Math.min(1, sequence.length / 10000); // normalized length

  return features;
}

// ── Pair Type Classification ─────────────────────────────────────────────────

/**
 * Classify the pair type for two chains based on their types.
 *
 * @param typeA - Type of first chain
 * @param typeB - Type of second chain
 * @returns Classified pair type string
 */
function classifyPairType(
  typeA: ChainType,
  typeB: ChainType,
): HeteroComplex['chainPairs'][0]['pairType'] {
  // Sort types alphabetically for consistent classification
  const sorted = [typeA, typeB].sort();

  if (sorted[0] === 'protein' && sorted[1] === 'protein') return 'protein-protein';
  if (sorted[0] === 'dna' && sorted[1] === 'protein') return 'protein-dna';
  if (sorted[0] === 'protein' && sorted[1] === 'rna') return 'protein-rna';
  if (sorted[0] === 'dna' && sorted[1] === 'dna') return 'dna-dna';
  if (sorted[0] === 'rna' && sorted[1] === 'rna') return 'rna-rna';
  if (sorted[0] === 'dna' && sorted[1] === 'rna') return 'dna-rna';

  // Fallback for ligand or unknown types
  return 'protein-protein';
}

// ── Similarity Utilities ─────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two feature vectors.
 *
 * Both vectors must be the same length. Returns 0 for zero-magnitude vectors.
 * Output normalized to [0, 1] range.
 *
 * @param a - First feature vector
 * @param b - Second feature vector
 * @returns Cosine similarity in [0, 1]
 */
function computeFeatureSimilarity(a: number[], b: number[]): number {
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

  // Normalize from [-1, 1] to [0, 1]
  return (dot / denom + 1) / 2;
}

/**
 * Estimate contact probability between two chains based on their features.
 *
 * Considers:
 *   - Feature vector similarity (weight: 0.4)
 *   - Sequence length similarity (weight: 0.3)
 *   - Cross-type interaction bonus (weight: 0.3)
 *
 * @param chainA - First chain with features
 * @param chainB - Second chain with features
 * @returns Contact probability in [0, 1]
 */
function estimateContactProbability(chainA: HeteroChain, chainB: HeteroChain): number {
  // Feature similarity component
  const featureSim = computeFeatureSimilarity(chainA.features, chainB.features);

  // Length similarity (penalize very different lengths)
  const maxLen = Math.max(chainA.sequence.length, chainB.sequence.length, 1);
  const lengthSim = Math.min(chainA.sequence.length, chainB.sequence.length) / maxLen;

  // Cross-type interaction bonus (protein-DNA/RNA interactions are common)
  const crossTypeBonus = chainA.type !== chainB.type ? 0.5 : 0;

  // Combined probability
  const probability = 0.4 * featureSim + 0.3 * lengthSim + 0.3 * crossTypeBonus;

  return Math.max(0, Math.min(1, probability));
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract chain type-specific features from a protein or nucleic acid chain.
 *
 * Feature dimensions vary by chain type:
 *   - Protein: 24 dimensions (AA composition + physicochemical + length)
 *   - DNA: 6 dimensions (nucleotide composition + GC content + length)
 *   - RNA: 6 dimensions (nucleotide composition + GC content + length)
 *
 * @param chain - The chain to extract features from
 * @returns Feature vector specific to the chain type
 *
 * @example
 * ```ts
 * const proteinFeats = extractChainFeatures({ id: 'A', sequence: 'MKWV', type: 'protein' });
 * console.log(proteinFeats.length); // 24
 *
 * const dnaFeats = extractChainFeatures({ id: 'B', sequence: 'ATCG', type: 'dna' });
 * console.log(dnaFeats.length); // 6
 * ```
 */
export function extractChainFeatures(chain: ProteinChain): number[] {
  switch (chain.type) {
    case 'protein':
      return extractProteinFeatures(chain.sequence);
    case 'dna':
      return extractDnaFeatures(chain.sequence);
    case 'rna':
      return extractRnaFeatures(chain.sequence);
    default:
      return [];
  }
}

/**
 * Encode a set of chains into a hetero-complex representation.
 *
 * Extracts type-specific features for each chain and identifies all
 * pairwise chain combinations with their classified pair types.
 *
 * @param chains - Array of protein/nucleic acid chains
 * @returns HeteroComplex with encoded chains and pair classifications
 *
 * @example
 * ```ts
 * const chains = [
 *   { id: 'A', sequence: 'MKWV', type: 'protein' },
 *   { id: 'B', sequence: 'ATCG', type: 'dna' },
 * ];
 * const complex = encodeHeteroComplex(chains);
 * console.log(complex.chainPairs[0].pairType); // 'protein-dna'
 * ```
 */
export function encodeHeteroComplex(chains: ProteinChain[]): HeteroComplex {
  const heteroChains: HeteroChain[] = chains.map(chain => ({
    id: chain.id,
    sequence: chain.sequence,
    type: chain.type as ChainType,
    features: extractChainFeatures(chain),
  }));

  const chainPairs: HeteroComplex['chainPairs'] = [];

  for (let i = 0; i < chains.length; i++) {
    for (let j = i + 1; j < chains.length; j++) {
      chainPairs.push({
        chainA: chains[i].id,
        chainB: chains[j].id,
        pairType: classifyPairType(
          chains[i].type as ChainType,
          chains[j].type as ChainType,
        ),
      });
    }
  }

  return { chains: heteroChains, chainPairs };
}

/**
 * Predict interfaces for all chain pairs in a hetero-complex.
 *
 * Uses feature-based similarity to predict which chain pairs form
 * interfaces. Higher similarity suggests structural compatibility.
 *
 * @param complex - The hetero-complex to analyze
 * @returns Interface predictions for each chain pair with confidence scores
 *
 * @example
 * ```ts
 * const complex = encodeHeteroComplex(chains);
 * const prediction = predictHeteroInterface(complex);
 * console.log(prediction.chainPairs[0].predictedInterface); // true/false
 * ```
 */
export function predictHeteroInterface(complex: HeteroComplex): InterfacePrediction {
  if (complex.chains.length < 2) {
    return { chainPairs: [], overallConfidence: 0 };
  }

  const chainPairs: InterfacePrediction['chainPairs'] = [];

  for (const pair of complex.chainPairs) {
    const chainA = complex.chains.find(c => c.id === pair.chainA);
    const chainB = complex.chains.find(c => c.id === pair.chainB);

    if (!chainA || !chainB) continue;

    // Compute feature similarity
    const similarity = computeFeatureSimilarity(chainA.features, chainB.features);

    // Estimate contact probability based on chain types and features
    const contactProbability = estimateContactProbability(chainA, chainB);

    chainPairs.push({
      chainA: pair.chainA,
      chainB: pair.chainB,
      similarity: Math.round(similarity * 1000) / 1000,
      contactProbability: Math.round(contactProbability * 1000) / 1000,
      predictedInterface: similarity >= SIMILARITY_THRESHOLD,
    });
  }

  // Overall confidence is the mean of all pair similarities
  const totalSimilarity = chainPairs.reduce((sum, p) => sum + p.similarity, 0);
  const overallConfidence = chainPairs.length > 0
    ? Math.round((totalSimilarity / chainPairs.length) * 1000) / 1000
    : 0;

  return { chainPairs, overallConfidence };
}
