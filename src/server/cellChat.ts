/**
 * CellChat-style Cell-Cell Communication Analysis
 *
 * Ligand-receptor interaction inference from single-cell expression data.
 * For each cluster pair and L-R pair, computes communication probability as
 * the product of ligand and receptor expression, optionally scaled by
 * cluster size via a Hill function. Includes permutation testing with
 * Benjamini-Hochberg FDR correction for statistical significance.
 *
 * Algorithm:
 *   For each cluster pair (i, j) and each L-R pair:
 *     1. P(L in sender) = mean expression of ligand in cluster i
 *     2. P(R in receiver) = mean expression of receptor in cluster j
 *     3. Communication probability = P(L) * P(R) * Hill(n_cells)
 *     4. Aggregate by pathway for network-level summary
 *
 * @scientific_provenance
 *   ALGORITHM: Cell-cell communication inference via ligand-receptor
 *     co-expression scoring. Communication probability for each cluster
 *     pair is the product of mean ligand expression in the sender and mean
 *     receptor expression in the receiver, scaled by a Hill function of
 *     cell counts. Statistical significance is assessed by permutation
 *     testing (shuffled cluster labels) with Benjamini-Hochberg FDR
 *     correction.
 *   REFERENCE: Jin S, Guerrero-Juarez CF, Zhang L, Chang I, Ramos R,
 *     Kuan CH, Myung P, Plikus MV, Nie Q. "Inference and analysis of
 *     cell-cell communication using CellChat." Nat Commun. 2021;12:1088.
 *   KNOWN_LIMITATIONS:
 *     - Uses mean expression per cluster; does not model the distribution
 *       of expression across individual cells or zero-inflation.
 *     - Communication probability is a simple product of expression levels;
 *       does not account for secretion kinetics or competitive inhibition.
 *     - Spatial distance weighting uses exponential decay with median
 *       pairwise distance as the length scale; this assumes uniform tissue
 *       geometry and may not capture anisotropic diffusion patterns.
 *     - Permutation test shuffles cluster labels rather than gene labels,
 *       which controls for cluster structure but not gene-gene correlations.
 *     - Hill-function cell-count scaling uses K=100 as a fixed reference;
 *       this is not calibrated to specific tissue types or assay platforms.
 */

import ligandReceptorDB from '../data/ligandReceptorDB.json';
import { EXPANDED_LR_DB, type LRPairExpanded } from '../data/ligandReceptorDBExpanded';
import { SeededRNG } from '../utils/seededRng';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LRPair {
  ligand: string;
  receptor: string;
  pathway: string;
}

export interface CommunicationInput {
  /** gene -> cluster -> mean expression */
  expressionMatrix: Record<string, Record<string, number>>;
  /** cluster identifiers */
  clusters: string[];
  /** optional: cell counts per cluster for Hill scaling */
  cellCounts?: Record<string, number>;
  /** optional: Hill coefficient (default 1.0, i.e. linear) */
  hillCoef?: number;
}

export interface LRInteraction {
  ligand: string;
  receptor: string;
  pathway: string;
  sender: string;
  receiver: string;
  probability: number;
  significance: number;
}

export interface ClusterCentrality {
  outgoingStrength: number;
  incomingStrength: number;
  totalStrength: number;
  dominantRole: 'sender' | 'receiver' | 'mediator';
}

export interface PathwaySummary {
  pathway: string;
  totalStrength: number;
  interactionCount: number;
  topSender: string;
  topReceiver: string;
}

export interface CommunicationResult {
  interactions: LRInteraction[];
  centrality: Record<string, ClusterCentrality>;
  pathwaySummary: Record<string, number>;
  pathwayDetails: PathwaySummary[];
  topInteractions: LRInteraction[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Hill function: x^n / (K^n + x^n) with K=1 for cell-count scaling */
function hill(x: number, n: number): number {
  if (x <= 0) return 0;
  return Math.pow(x, n) / (1 + Math.pow(x, n));
}

/** Clamp a value to [0, 1] */
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Pathway names that indicate inhibitory interactions */
const INHIBIT_PATHWAYS = new Set([
  'Wnt-inhibitor', 'BMP-inhibitor', 'TGF-beta-inhibitor',
  'Notch-inhibitor', 'Hedgehog-inhibitor', 'FGF-inhibitor',
]);

/**
 * Determine interaction type from a pathway name.
 * Returns 'inhibition' for known inhibitory pathways, 'signaling' otherwise.
 */
function interactionTypeForPathway(pathway: string): 'signaling' | 'inhibition' {
  if (INHIBIT_PATHWAYS.has(pathway)) return 'inhibition';
  if (pathway.toLowerCase().includes('inhibitor')) return 'inhibition';
  if (pathway.toLowerCase().includes('antagonist')) return 'inhibition';
  return 'signaling';
}

/**
 * Compute spatial distance weights between cluster centroids.
 *
 * For each pair of clusters, computes the Euclidean distance between their
 * spatial centroids, then converts to a weight via exponential decay:
 *   weight(i,j) = exp(-distance(i,j) / medianDistance)
 *
 * Closer clusters receive higher weights (up to 1.0 for co-located clusters).
 * The median pairwise distance serves as the characteristic length scale.
 *
 * @param cellPositions - Map from cluster label to array of {x, y} positions
 * @param clusterLabels - Ordered list of cluster labels
 * @returns 2D weight matrix [i][j] where i,j index into clusterLabels
 */
export function computeSpatialWeights(
  cellPositions: Map<string, { x: number; y: number }[]>,
  clusterLabels: string[],
): number[][] {
  const n = clusterLabels.length;

  // Compute centroids
  const centroids: { x: number; y: number }[] = [];
  for (const label of clusterLabels) {
    const positions = cellPositions.get(label);
    if (!positions || positions.length === 0) {
      centroids.push({ x: 0, y: 0 });
    } else {
      let sx = 0, sy = 0;
      for (const p of positions) { sx += p.x; sy += p.y; }
      centroids.push({ x: sx / positions.length, y: sy / positions.length });
    }
  }

  // Compute pairwise distances
  const distances: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = centroids[i].x - centroids[j].x;
      const dy = centroids[i].y - centroids[j].y;
      distances.push(Math.sqrt(dx * dx + dy * dy));
    }
  }

  // Median distance as characteristic length scale
  let medianDistance = 1;
  if (distances.length > 0) {
    const sorted = [...distances].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianDistance = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
    if (medianDistance <= 0) medianDistance = 1;
  }

  // Build weight matrix: exp(-d / medianDistance)
  const weights: number[][] = Array.from({ length: n }, () => new Array(n).fill(1));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        weights[i][j] = 1;
      } else {
        const dx = centroids[i].x - centroids[j].x;
        const dy = centroids[i].y - centroids[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        weights[i][j] = Math.exp(-d / medianDistance);
      }
    }
  }

  return weights;
}

/**
 * Normalize probabilities to [0,1] by dividing by the maximum value.
 * This preserves relative ordering while making values comparable.
 */
function normalizeProbabilities(probs: number[]): number[] {
  const nonzero = probs.filter(p => p > 0);
  if (nonzero.length === 0) return probs;
  const maxVal = Math.max(...nonzero);
  if (maxVal === 0) return probs;
  return probs.map(p => p > 0 ? p / maxVal : 0);
}

/**
 * Percentile-rank significance: fraction of non-zero probabilities that are
 * less than or equal to the given probability. Returns value in [0,1].
 */
function computeSignificance(prob: number, allProbs: number[]): number {
  const nonzero = allProbs.filter(p => p > 0);
  if (nonzero.length === 0) return 0;
  let count = 0;
  for (const p of nonzero) {
    if (p <= prob) count++;
  }
  return count / nonzero.length;
}

// ─── Core Analysis ──────────────────────────────────────────────────────────

/**
 * Analyze cell-cell communication from a gene expression matrix.
 *
 * @param input - expression matrix (gene -> cluster -> mean expr), cluster list
 * @returns CommunicationResult with interactions, centrality, pathway summary
 */
export function analyzeCommunication(input: CommunicationInput): CommunicationResult {
  const { expressionMatrix, clusters, cellCounts, hillCoef = 1.0 } = input;

  const db: LRPair[] = ligandReceptorDB as LRPair[];
  const rawInteractions: LRInteraction[] = [];
  const rawProbs: number[] = [];

  // Step 1: Compute raw communication probabilities for all cluster pairs and L-R pairs
  for (const lr of db) {
    const ligandExpr = expressionMatrix[lr.ligand];
    const receptorExpr = expressionMatrix[lr.receptor];

    // Skip if neither ligand nor receptor is in the expression matrix
    if (!ligandExpr && !receptorExpr) continue;

    for (const sender of clusters) {
      for (const receiver of clusters) {
        const lExpr = ligandExpr?.[sender] ?? 0;
        const rExpr = receptorExpr?.[receiver] ?? 0;

        // Base probability: product of expression levels
        let prob = lExpr * rExpr;

        // Apply Hill scaling for cell counts (larger clusters get a boost)
        if (cellCounts) {
          const nSender = cellCounts[sender] ?? 1;
          const nReceiver = cellCounts[receiver] ?? 1;
          const nAvg = (nSender + nReceiver) / 2;
          prob *= hill(nAvg / 100, hillCoef);
        }

        rawProbs.push(prob);

        rawInteractions.push({
          ligand: lr.ligand,
          receptor: lr.receptor,
          pathway: lr.pathway,
          sender,
          receiver,
          probability: prob,
          significance: 0, // computed below
        });
      }
    }
  }

  // Step 2: Normalize probabilities
  const normalized = normalizeProbabilities(rawProbs);

  // Step 3: Compute significance and filter
  const interactions: LRInteraction[] = [];
  for (let idx = 0; idx < rawInteractions.length; idx++) {
    const interaction = rawInteractions[idx];
    const prob = normalized[idx];
    if (prob > 0) {
      interactions.push({
        ...interaction,
        probability: round(prob),
        significance: round(computeSignificance(prob, normalized)),
      });
    }
  }

  // Sort by probability descending
  interactions.sort((a, b) => b.probability - a.probability);

  // Step 4: Compute per-cluster centrality
  const centrality: Record<string, ClusterCentrality> = {};
  for (const cluster of clusters) {
    let outgoing = 0;
    let incoming = 0;

    for (const inter of interactions) {
      if (inter.sender === cluster) outgoing += inter.probability;
      if (inter.receiver === cluster) incoming += inter.probability;
    }

    const total = outgoing + incoming;
    let dominantRole: 'sender' | 'receiver' | 'mediator';
    if (total === 0) {
      dominantRole = 'mediator';
    } else {
      const ratio = outgoing / total;
      if (ratio > 0.6) dominantRole = 'sender';
      else if (ratio < 0.4) dominantRole = 'receiver';
      else dominantRole = 'mediator';
    }

    centrality[cluster] = {
      outgoingStrength: round(outgoing),
      incomingStrength: round(incoming),
      totalStrength: round(total),
      dominantRole,
    };
  }

  // Step 5: Aggregate by pathway
  const pathwayAgg: Record<string, { total: number; count: number; senders: Record<string, number>; receivers: Record<string, number> }> = {};
  for (const inter of interactions) {
    if (!pathwayAgg[inter.pathway]) {
      pathwayAgg[inter.pathway] = { total: 0, count: 0, senders: {}, receivers: {} };
    }
    pathwayAgg[inter.pathway].total += inter.probability;
    pathwayAgg[inter.pathway].count += 1;
    pathwayAgg[inter.pathway].senders[inter.sender] =
      (pathwayAgg[inter.pathway].senders[inter.sender] ?? 0) + inter.probability;
    pathwayAgg[inter.pathway].receivers[inter.receiver] =
      (pathwayAgg[inter.pathway].receivers[inter.receiver] ?? 0) + inter.probability;
  }

  const pathwaySummary: Record<string, number> = {};
  const pathwayDetails: PathwaySummary[] = [];

  for (const [pathway, agg] of Object.entries(pathwayAgg)) {
    pathwaySummary[pathway] = round(agg.total);

    const topSender = Object.entries(agg.senders)
      .sort(([, a], [, b]) => b - a)[0]?.[0] ?? '';
    const topReceiver = Object.entries(agg.receivers)
      .sort(([, a], [, b]) => b - a)[0]?.[0] ?? '';

    pathwayDetails.push({
      pathway,
      totalStrength: round(agg.total),
      interactionCount: agg.count,
      topSender,
      topReceiver,
    });
  }

  // Sort pathway details by total strength
  pathwayDetails.sort((a, b) => b.totalStrength - a.totalStrength);

  // Top interactions (top 20 by probability)
  const topInteractions = interactions.slice(0, 20);

  return {
    interactions,
    centrality,
    pathwaySummary,
    pathwayDetails,
    topInteractions,
  };
}

/**
 * Get all available L-R pairs from the database.
 */
export function getLRDatabase(): LRPair[] {
  return ligandReceptorDB as LRPair[];
}

/**
 * Get expanded L-R database (2000+ pairs).
 */
export function getExpandedLRDatabase(): LRPairExpanded[] {
  return EXPANDED_LR_DB;
}

// ─── Expanded Communication Analysis with Permutation Testing ──────────────

export interface ExpandedCommunicationInput {
  /** gene -> cluster -> mean expression */
  expressionMatrix: Record<string, Record<string, number>>;
  /** cluster identifiers */
  clusters: string[];
  /** cell counts per cluster */
  cellCounts?: Record<string, number>;
  /** Hill coefficient (default 1.5) */
  hillCoef?: number;
  /** number of permutations for p-value (default 1000) */
  nPermutations?: number;
  /** RNG seed for reproducibility */
  seed?: number;
  /** use expanded database (default true) */
  useExpandedDB?: boolean;
  /**
   * Optional precomputed spatial weight matrix [i][j] for cluster pairs.
   * When provided, communication probabilities are multiplied by the
   * corresponding weight, giving higher probability to spatially proximal
   * clusters. Use computeSpatialWeights() to generate this matrix.
   */
  spatialWeightMatrix?: number[][];
  /**
   * Optional cell positions per cluster for computing spatial weights.
   * If spatialWeightMatrix is not provided but cellPositions is, spatial
   * weights will be computed automatically. Keys are cluster labels.
   */
  cellPositions?: Map<string, { x: number; y: number }[]>;
}

export interface ExpandedLRInteraction {
  ligand: string;
  receptor: string;
  pathway: string;
  category: string;
  sender: string;
  receiver: string;
  probability: number;
  pValue: number;
  pAdj: number;
  significant: boolean;
}

export interface ExpandedCommunicationResult {
  interactions: ExpandedLRInteraction[];
  centrality: Record<string, ClusterCentrality>;
  pathwaySummary: Record<string, number>;
  pathwayDetails: PathwaySummary[];
  topInteractions: ExpandedLRInteraction[];
  network: {
    nodes: Array<{ id: string; cellType: string; nCells: number }>;
    edges: Array<{
      source: string;
      target: string;
      weight: number;
      significant: boolean;
      interactionType: 'signaling' | 'inhibition';
    }>;
  };
  stats: {
    totalInteractions: number;
    significantInteractions: number;
    nCellTypes: number;
    nPermutations: number;
    nLRPairs: number;
  };
}

/**
 * Benjamini-Hochberg FDR correction.
 */
function benjaminiHochberg(pValues: number[]): number[] {
  const n = pValues.length;
  if (n === 0) return [];

  // Create (index, p-value) pairs and sort by p-value
  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => a.p - b.p);

  const adjusted = new Array(n).fill(0);
  let prevAdj = 1;

  // Apply BH correction from largest to smallest
  for (let k = n - 1; k >= 0; k--) {
    const rank = k + 1;
    const adj = Math.min(1, indexed[k].p * n / rank);
    adjusted[indexed[k].i] = Math.min(adj, prevAdj);
    prevAdj = adjusted[indexed[k].i];
  }

  return adjusted;
}

/**
 * Analyze cell-cell communication with expanded L-R database and permutation testing.
 *
 * For each cluster pair and L-R pair:
 *   1. Compute observed communication probability
 *   2. Permutation test: shuffle cell labels nPermutations times
 *   3. p-value = fraction of permuted values >= observed
 *   4. FDR correction: Benjamini-Hochberg
 */
export function analyzeCommunicationExpanded(input: ExpandedCommunicationInput): ExpandedCommunicationResult {
  const {
    expressionMatrix,
    clusters,
    cellCounts,
    hillCoef = 1.5,
    nPermutations = 1000,
    seed = 42,
    useExpandedDB = true,
    spatialWeightMatrix: inputSpatialWeights,
    cellPositions,
  } = input;

  // Compute spatial weights from cell positions if not provided directly
  const spatialWeightMatrix = inputSpatialWeights
    ?? (cellPositions ? computeSpatialWeights(cellPositions, clusters) : undefined);

  const rng = new SeededRNG(seed);
  const db: LRPairExpanded[] = useExpandedDB ? EXPANDED_LR_DB : (ligandReceptorDB as LRPair[]).map(lr => ({
    ...lr,
    category: 'other',
  }));

  const rawInteractions: ExpandedLRInteraction[] = [];
  const rawProbs: number[] = [];

  // Step 1: Compute observed communication probabilities
  for (const lr of db) {
    const ligandExpr = expressionMatrix[lr.ligand];
    const receptorExpr = expressionMatrix[lr.receptor];

    if (!ligandExpr && !receptorExpr) continue;

    for (let si = 0; si < clusters.length; si++) {
      for (let ri = 0; ri < clusters.length; ri++) {
        const sender = clusters[si];
        const receiver = clusters[ri];
        const lExpr = ligandExpr?.[sender] ?? 0;
        const rExpr = receptorExpr?.[receiver] ?? 0;

        let prob = lExpr * rExpr;

        if (cellCounts) {
          const nSender = cellCounts[sender] ?? 1;
          const nReceiver = cellCounts[receiver] ?? 1;
          const nAvg = (nSender + nReceiver) / 2;
          prob *= hill(nAvg / 100, hillCoef);
        }

        // Apply spatial distance weighting: closer clusters get higher probability
        if (spatialWeightMatrix) {
          prob *= spatialWeightMatrix[si][ri];
        }

        rawProbs.push(prob);
        rawInteractions.push({
          ligand: lr.ligand,
          receptor: lr.receptor,
          pathway: lr.pathway,
          category: lr.category,
          sender,
          receiver,
          probability: prob,
          pValue: 1,
          pAdj: 1,
          significant: false,
        });
      }
    }
  }

  // Step 2: Normalize probabilities
  const normalized = normalizeProbabilities(rawProbs);

  // Step 3: Permutation testing for significance
  // For each L-R pair, shuffle cluster labels and recompute
  const permutationMaxProbs: number[] = [];

  for (let perm = 0; perm < nPermutations; perm++) {
    // Shuffle cluster labels
    const shuffledClusters = [...clusters];
    for (let i = shuffledClusters.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [shuffledClusters[i], shuffledClusters[j]] = [shuffledClusters[j], shuffledClusters[i]];
    }

    // Compute max probability under permutation
    let maxPermProb = 0;
    for (const lr of db) {
      const ligandExpr = expressionMatrix[lr.ligand];
      const receptorExpr = expressionMatrix[lr.receptor];
      if (!ligandExpr && !receptorExpr) continue;

      for (let si = 0; si < clusters.length; si++) {
        for (let ri = 0; ri < clusters.length; ri++) {
          const sender = shuffledClusters[si];
          const receiver = shuffledClusters[ri];
          const lExpr = ligandExpr?.[sender] ?? 0;
          const rExpr = receptorExpr?.[receiver] ?? 0;
          const prob = lExpr * rExpr;
          if (prob > maxPermProb) maxPermProb = prob;
        }
      }
    }
    permutationMaxProbs.push(maxPermProb);
  }

  // Step 4: Compute p-values
  const pValues: number[] = [];
  for (let idx = 0; idx < rawInteractions.length; idx++) {
    const obsProb = normalized[idx];
    let count = 0;
    for (const permProb of permutationMaxProbs) {
      if (permProb >= obsProb) count++;
    }
    const pValue = (count + 1) / (nPermutations + 1); // +1 for continuity
    pValues.push(pValue);
    rawInteractions[idx].pValue = round(pValue, 6);
  }

  // Step 5: FDR correction
  const pAdj = benjaminiHochberg(pValues);

  // Step 6: Build final interactions
  const interactions: ExpandedLRInteraction[] = [];
  for (let idx = 0; idx < rawInteractions.length; idx++) {
    const interaction = rawInteractions[idx];
    const prob = normalized[idx];
    if (prob > 0) {
      interaction.probability = round(prob);
      interaction.pAdj = round(pAdj[idx], 6);
      interaction.significant = pAdj[idx] < 0.05;
      interactions.push(interaction);
    }
  }

  interactions.sort((a, b) => b.probability - a.probability);

  // Step 7: Compute centrality
  const centrality: Record<string, ClusterCentrality> = {};
  for (const cluster of clusters) {
    let outgoing = 0;
    let incoming = 0;

    for (const inter of interactions) {
      if (inter.sender === cluster) outgoing += inter.probability;
      if (inter.receiver === cluster) incoming += inter.probability;
    }

    const total = outgoing + incoming;
    let dominantRole: 'sender' | 'receiver' | 'mediator';
    if (total === 0) {
      dominantRole = 'mediator';
    } else {
      const ratio = outgoing / total;
      if (ratio > 0.6) dominantRole = 'sender';
      else if (ratio < 0.4) dominantRole = 'receiver';
      else dominantRole = 'mediator';
    }

    centrality[cluster] = {
      outgoingStrength: round(outgoing),
      incomingStrength: round(incoming),
      totalStrength: round(total),
      dominantRole,
    };
  }

  // Step 8: Pathway summary
  const pathwayAgg: Record<string, { total: number; count: number; senders: Record<string, number>; receivers: Record<string, number> }> = {};
  for (const inter of interactions) {
    if (!pathwayAgg[inter.pathway]) {
      pathwayAgg[inter.pathway] = { total: 0, count: 0, senders: {}, receivers: {} };
    }
    pathwayAgg[inter.pathway].total += inter.probability;
    pathwayAgg[inter.pathway].count += 1;
    pathwayAgg[inter.pathway].senders[inter.sender] =
      (pathwayAgg[inter.pathway].senders[inter.sender] ?? 0) + inter.probability;
    pathwayAgg[inter.pathway].receivers[inter.receiver] =
      (pathwayAgg[inter.pathway].receivers[inter.receiver] ?? 0) + inter.probability;
  }

  const pathwaySummary: Record<string, number> = {};
  const pathwayDetails: PathwaySummary[] = [];

  for (const [pathway, agg] of Object.entries(pathwayAgg)) {
    pathwaySummary[pathway] = round(agg.total);
    const topSender = Object.entries(agg.senders).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '';
    const topReceiver = Object.entries(agg.receivers).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '';
    pathwayDetails.push({
      pathway,
      totalStrength: round(agg.total),
      interactionCount: agg.count,
      topSender,
      topReceiver,
    });
  }
  pathwayDetails.sort((a, b) => b.totalStrength - a.totalStrength);

  // Step 9: Build network
  const networkNodes = clusters.map(c => ({
    id: c,
    cellType: c,
    nCells: cellCounts?.[c] ?? 0,
  }));

  const edgeMap = new Map<string, { weight: number; significant: boolean; signaling: number; inhibition: number }>();
  for (const inter of interactions) {
    const key = `${inter.sender}->${inter.receiver}`;
    const iType = interactionTypeForPathway(inter.pathway);
    const existing = edgeMap.get(key);
    if (existing) {
      existing.weight += inter.probability;
      existing.significant = existing.significant || inter.significant;
      if (iType === 'inhibition') existing.inhibition += inter.probability;
      else existing.signaling += inter.probability;
    } else {
      edgeMap.set(key, {
        weight: inter.probability,
        significant: inter.significant,
        signaling: iType === 'signaling' ? inter.probability : 0,
        inhibition: iType === 'inhibition' ? inter.probability : 0,
      });
    }
  }

  const networkEdges = Array.from(edgeMap.entries()).map(([key, val]) => {
    const [source, target] = key.split('->');
    const interactionType = val.inhibition > val.signaling ? 'inhibition' as const : 'signaling' as const;
    return { source, target, weight: round(val.weight), significant: val.significant, interactionType };
  });

  const topInteractions = interactions.slice(0, 20);

  return {
    interactions,
    centrality,
    pathwaySummary,
    pathwayDetails,
    topInteractions,
    network: { nodes: networkNodes, edges: networkEdges },
    stats: {
      totalInteractions: interactions.length,
      significantInteractions: interactions.filter(i => i.significant).length,
      nCellTypes: clusters.length,
      nPermutations,
      nLRPairs: db.length,
    },
  };
}

/**
 * Get all unique pathways from the L-R database.
 */
export function getPathways(): string[] {
  const pathways = new Set<string>();
  for (const lr of ligandReceptorDB as LRPair[]) {
    pathways.add(lr.pathway);
  }
  return Array.from(pathways).sort();
}

// ─── Helpers (internal) ─────────────────────────────────────────────────────

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
