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
 *       does not account for spatial proximity, secretion kinetics, or
 *       competitive inhibition.
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
    edges: Array<{ source: string; target: string; weight: number; significant: boolean }>;
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
  } = input;

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

    for (const sender of clusters) {
      for (const receiver of clusters) {
        const lExpr = ligandExpr?.[sender] ?? 0;
        const rExpr = receptorExpr?.[receiver] ?? 0;

        let prob = lExpr * rExpr;

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

  const edgeMap = new Map<string, { weight: number; significant: boolean }>();
  for (const inter of interactions) {
    const key = `${inter.sender}->${inter.receiver}`;
    const existing = edgeMap.get(key);
    if (existing) {
      existing.weight += inter.probability;
      existing.significant = existing.significant || inter.significant;
    } else {
      edgeMap.set(key, { weight: inter.probability, significant: inter.significant });
    }
  }

  const networkEdges = Array.from(edgeMap.entries()).map(([key, val]) => {
    const [source, target] = key.split('->');
    return { source, target, weight: round(val.weight), significant: val.significant };
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
