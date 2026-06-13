/**
 * CellChat-style Cell-Cell Communication Analysis
 *
 * Ligand-receptor interaction inference from single-cell expression data.
 * Reference: Jin et al. (2021) Nat Commun 12:1088
 *
 * Algorithm:
 *   For each cluster pair (i, j) and each L-R pair:
 *     1. P(L in sender) = mean expression of ligand in cluster i
 *     2. P(R in receiver) = mean expression of receptor in cluster j
 *     3. Communication probability = P(L) * P(R) * Hill(n_cells)
 *     4. Aggregate by pathway for network-level summary
 */

import ligandReceptorDB from '../data/ligandReceptorDB.json';

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
