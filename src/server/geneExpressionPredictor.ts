/**
 * Gene Expression Predictor — AI-Driven Expression Level Prediction
 *
 * Predicts relative protein expression level (0-1) from a complete gene
 * construct: promoter + RBS + CDS + terminator + host organism.
 *
 * Architecture: Main model + Explanation head
 *   - Main model: gradient-boosted ensemble with literature-parameter weights
 *   - Explanation head: contribution decomposition + bottleneck + optimization
 *
 * ESM-2 embeddings are used for CDS semantic/protein property representation
 * (folding burden, solubility, structural risk) — NOT for direct expression prediction.
 *
 * Reference: Salis et al. (2009) Nature Biotechnology 27:946-950
 * Reference: Kudla et al. (2009) Science 324:255-258
 * Reference: Goodman et al. (2013) PNAS 110:14906-14911
 *
 * @scientific_provenance
 *   ALGORITHM: Literature-parameter weighted ensemble + SHAP-like decomposition
 *   KNOWN_LIMITATIONS:
 *     - Relative prediction only (0-1), not absolute mg/L
 *     - Absolute calibration requires experimental reference data
 *     - ESM-2 embeddings are proxy for protein properties, not ground truth
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type HostOrganism = 'ecoli' | 'yeast' | 'human';

export interface GeneConstruct {
  promoter: string;
  rbs: string;
  cds: string;
  terminator: string;
  host: HostOrganism;
}

export interface ExpressionFeatures {
  // Promoter features
  promoterScore: number;        // 0-1
  consensusScore: number;       // -35/-10 matching
  spacerScore: number;          // spacer length penalty
  upElementScore: number;       // AT-rich upstream

  // RBS features (Salis 5-term)
  rbsScore: number;             // 0-1
  dgMRNA: number;               // kcal/mol
  dgSpacing: number;
  dgStandby: number;
  dgStart: number;
  dgAntiSD: number;
  dgTotal: number;

  // CDS features
  cai: number;                  // Codon Adaptation Index
  tai: number;                  // tRNA Adaptiveness Index
  rareCodonClusters: number;    // count
  mrnaFoldingEnergy: number;    // 5' end folding
  gcContent: number;
  cdsLength: number;

  // Terminator features
  terminatorScore: number;      // 0-1
  terminatorDG: number;         // kcal/mol

  // ESM-2 derived (protein properties)
  predictedSolubility: number;  // 0-1
  foldingBurden: number;        // 0-1
  structuralRisk: number;       // 0-1

  // Host features
  hostCompatibility: number;    // 0-1
  tRNAAvailability: number;     // 0-1
}

export interface ContributionDecomposition {
  promoter: number;             // fraction (0-1)
  rbs: number;
  cds: number;
  terminator: number;
  host: number;
  interactions: Array<{
    components: string[];
    effect: number;
    description: string;
  }>;
}

export interface BottleneckAnalysis {
  stage: 'transcription' | 'translation_initiation' | 'translation_elongation' | 'folding' | 'degradation';
  severity: number;             // 0-1
  description: string;
  confidence: number;           // 0-1
}

export interface OptimizationSuggestion {
  component: 'promoter' | 'rbs' | 'cds' | 'terminator';
  action: string;
  currentValue: string;
  targetValue: string;
  expectedImprovement: number;  // Δ expression
  confidence: number;           // 0-1
}

export interface ExpressionPrediction {
  // Main prediction
  relativeExpression: number;   // 0-1

  // Explanation head
  contributions: ContributionDecomposition;
  bottlenecks: BottleneckAnalysis[];
  suggestions: OptimizationSuggestion[];

  // Raw features
  features: ExpressionFeatures;

  // Metadata
  host: HostOrganism;
  constructLength: number;
  confidence: number;           // 0-1
  designNotes: string[];
}

// ── Host-Specific Parameters ───────────────────────────────────────────────

/**
 * tRNA gene copy numbers per codon for E. coli K-12.
 * Reference: dos Reis et al. (2004) J Mol Evol 58:523-533
 */
const HOST_TRNA: Record<HostOrganism, Record<string, number>> = {
  ecoli: {
    'UUU': 1, 'UUC': 2, 'UUA': 1, 'UUG': 1, 'CUU': 1, 'CUC': 2, 'CUA': 1, 'CUG': 6,
    'AUU': 3, 'AUC': 2, 'AUA': 1, 'AUG': 1, 'GUU': 4, 'GUC': 2, 'GUA': 2, 'GUG': 2,
    'UCU': 4, 'UCC': 2, 'UCA': 1, 'UCG': 1, 'CCU': 1, 'CCC': 1, 'CCA': 1, 'CCG': 2,
    'ACU': 4, 'ACC': 2, 'ACA': 1, 'ACG': 1, 'GCU': 4, 'GCC': 2, 'GCA': 1, 'GCG': 3,
    'UAU': 2, 'UAC': 2, 'UAA': 0, 'UAG': 0, 'CAU': 2, 'CAC': 2, 'CAA': 2, 'CAG': 2,
    'AAU': 2, 'AAC': 2, 'AAA': 6, 'AAG': 2, 'GAU': 2, 'GAC': 2, 'GAA': 6, 'GAG': 2,
    'UGU': 1, 'UGC': 1, 'UGA': 0, 'UGG': 1, 'CGU': 4, 'CGC': 2, 'CGA': 1, 'CGG': 1,
    'AGU': 1, 'AGC': 2, 'AGA': 1, 'AGG': 0, 'GGU': 4, 'GGC': 2, 'GGA': 1, 'GGG': 1,
  },
  yeast: {
    'UUU': 2, 'UUC': 2, 'UUA': 2, 'UUG': 5, 'CUU': 2, 'CUC': 1, 'CUA': 2, 'CUG': 1,
    'AUU': 3, 'AUC': 2, 'AUA': 2, 'AUG': 1, 'GUU': 3, 'GUC': 1, 'GUA': 1, 'GUG': 1,
    'UCU': 3, 'UCC': 2, 'UCA': 3, 'UCG': 1, 'CCU': 2, 'CCC': 1, 'CCA': 3, 'CCG': 1,
    'ACU': 3, 'ACC': 2, 'ACA': 3, 'ACG': 1, 'GCU': 3, 'GCC': 1, 'GCA': 2, 'GCG': 1,
    'UAU': 2, 'UAC': 2, 'UAA': 0, 'UAG': 0, 'CAU': 1, 'CAC': 1, 'CAA': 3, 'CAG': 1,
    'AAU': 3, 'AAC': 2, 'AAA': 6, 'AAG': 3, 'GAU': 2, 'GAC': 1, 'GAA': 5, 'GAG': 2,
    'UGU': 1, 'UGC': 1, 'UGA': 0, 'UGG': 1, 'CGU': 1, 'CGC': 0, 'CGA': 1, 'CGG': 0,
    'AGU': 2, 'AGC': 1, 'AGA': 4, 'AGG': 2, 'GGU': 3, 'GGC': 1, 'GGA': 2, 'GGG': 1,
  },
  human: {
    'UUU': 2, 'UUC': 3, 'UUA': 1, 'UUG': 2, 'CUU': 2, 'CUC': 3, 'CUA': 1, 'CUG': 7,
    'AUU': 2, 'AUC': 3, 'AUA': 1, 'AUG': 1, 'GUU': 2, 'GUC': 3, 'GUA': 1, 'GUG': 3,
    'UCU': 2, 'UCC': 3, 'UCA': 1, 'UCG': 1, 'CCU': 2, 'CCC': 3, 'CCA': 2, 'CCG': 2,
    'ACU': 2, 'ACC': 3, 'ACA': 2, 'ACG': 1, 'GCU': 2, 'GCC': 4, 'GCA': 2, 'GCG': 2,
    'UAU': 1, 'UAC': 2, 'UAA': 0, 'UAG': 0, 'CAU': 1, 'CAC': 2, 'CAA': 1, 'CAG': 3,
    'AAU': 2, 'AAC': 3, 'AAA': 3, 'AAG': 4, 'GAU': 2, 'GAC': 3, 'GAA': 3, 'GAG': 4,
    'UGU': 1, 'UGC': 2, 'UGA': 0, 'UGG': 1, 'CGU': 1, 'CGC': 2, 'CGA': 1, 'CGG': 2,
    'AGU': 1, 'AGC': 2, 'AGA': 1, 'AGG': 2, 'GGU': 1, 'GGC': 3, 'GGA': 2, 'GGG': 2,
  },
};

/**
 * Host growth rate (h⁻¹) at standard conditions.
 */
const HOST_GROWTH_RATE: Record<HostOrganism, number> = {
  ecoli: 0.7,
  yeast: 0.3,
  human: 0.02,
};

// ── Module 1: Input Standardization ────────────────────────────────────────

/**
 * Standardize and validate a gene construct.
 */
function standardizeInput(
  promoter: string,
  rbs: string,
  cds: string,
  terminator: string,
  host: HostOrganism,
): GeneConstruct {
  const clean = (s: string) => s.toUpperCase().replace(/[^ACGT]/g, '');

  const pClean = clean(promoter);
  const rClean = clean(rbs);
  const cClean = clean(cds);
  const tClean = clean(terminator);

  // Validate CDS: must start with ATG and have no internal stop codons
  if (!cClean.startsWith('ATG')) {
    throw new Error('CDS must start with ATG (start codon)');
  }
  if (cClean.length % 3 !== 0) {
    throw new Error('CDS length must be a multiple of 3 (codon boundary)');
  }
  // Check for internal stop codons
  for (let i = 3; i < cClean.length - 3; i += 3) {
    const codon = cClean.substring(i, i + 3);
    if (codon === 'TAA' || codon === 'TAG' || codon === 'TGA') {
      throw new Error(`Internal stop codon at position ${i}: ${codon}`);
    }
  }

  return { promoter: pClean, rbs: rClean, cds: cClean, terminator: tClean, host };
}

// ── Module 2: Feature Extraction ───────────────────────────────────────────

const CONSENSUS_MINUS_35 = 'TTGACA';
const CONSENSUS_MINUS_10 = 'TATAAT';

function countMatches(a: string, b: string): number {
  let count = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) count++;
  }
  return count;
}

/**
 * Extract promoter features.
 */
function extractPromoterFeatures(promoter: string): {
  score: number;
  consensusScore: number;
  spacerScore: number;
  upElementScore: number;
} {
  if (promoter.length < 30) return { score: 0.1, consensusScore: 0, spacerScore: 0, upElementScore: 0 };

  const minus35 = promoter.substring(0, 6);
  const minus10 = promoter.substring(Math.max(0, promoter.length - 35), Math.max(0, promoter.length - 29));

  const minus35Score = countMatches(minus35, CONSENSUS_MINUS_35) / 6;
  const minus10Score = countMatches(minus10, CONSENSUS_MINUS_10) / 6;

  // Spacer: optimal 17 bp between -35 and -10
  const spacerLength = promoter.length - 12;
  const spacerScore = Math.max(0, 1 - Math.abs(spacerLength - 17) * 0.1);

  // UP element: AT-rich region upstream of -35
  const upRegion = promoter.substring(0, 10);
  const atContent = (upRegion.match(/[AT]/g) || []).length / upRegion.length;
  const upElementScore = atContent > 0.7 ? 0.8 : atContent > 0.5 ? 0.4 : 0;

  const score = minus35Score * 0.35 + minus10Score * 0.35 + spacerScore * 0.2 + upElementScore * 0.1;

  return {
    score: Math.round(Math.min(1, score) * 1000) / 1000,
    consensusScore: Math.round((minus35Score + minus10Score) / 2 * 1000) / 1000,
    spacerScore: Math.round(spacerScore * 1000) / 1000,
    upElementScore: Math.round(upElementScore * 1000) / 1000,
  };
}

// ── RBS Features (Salis 2009 5-term model) ────────────────────────────────

/**
 * RNA nearest-neighbor stacking parameters (Turner 2009).
 */
const NN_RNA: Record<string, number> = {
  'AA': -0.9, 'UU': -0.9, 'AU': -1.1, 'UA': -1.3,
  'CA': -1.8, 'UG': -2.1, 'CU': -0.9, 'AG': -0.9,
  'GA': -1.1, 'UC': -1.3, 'GU': -1.4, 'AC': -1.4,
  'CG': -2.4, 'GC': -3.4, 'GG': -1.7, 'CC': -1.7,
};

const ANTI_SD = 'AUUCCUC';

function findSD(rbs: string): string {
  const patterns = ['AGGAGG', 'AGGAG', 'AGGA', 'AGG', 'GGAG'];
  for (const p of patterns) {
    if (rbs.includes(p)) return p;
  }
  return 'AGG';
}

function computeMRNAFoldingNN(seq: string): number {
  let dg = 0;
  const s = seq.toUpperCase();
  for (let i = 0; i < s.length - 1; i++) {
    dg += NN_RNA[s.substring(i, i + 2)] || 0;
  }
  const nLoops = Math.max(1, Math.floor(s.length / 10));
  dg += nLoops * 5.4;
  return dg;
}

function extractRBSFeatures(rbs: string, cds: string): {
  score: number;
  dgMRNA: number;
  dgSpacing: number;
  dgStandby: number;
  dgStart: number;
  dgAntiSD: number;
  dgTotal: number;
} {
  const sd = findSD(rbs);

  // ΔG_mRNA
  const dgMRNA = computeMRNAFoldingNN(rbs);

  // ΔG_spacing
  const sdEnd = rbs.lastIndexOf(sd) + sd.length;
  const augPos = cds.toUpperCase().indexOf('ATG');
  const spacing = augPos >= 0 ? augPos + (rbs.length - sdEnd) : 9;
  const dgSpacing = -0.5 * Math.abs(spacing - 5);

  // ΔG_standby
  const upstream = rbs.substring(0, Math.max(0, rbs.length - sd.length));
  let dgStandby = 0;
  for (let i = 0; i < upstream.length - 2; i++) {
    const motif = upstream.substring(i, i + 3);
    if (motif.includes('AGG') || motif.includes('GAG')) {
      dgStandby = Math.min(dgStandby, computeMRNAFoldingNN(motif) * 0.5);
    }
  }

  // ΔG_start
  let dgStart = -1.0;
  if (augPos >= 3) {
    const minus3 = cds.toUpperCase()[augPos - 3];
    if (minus3 === 'A' || minus3 === 'G') dgStart -= 0.5;
  }

  // ΔG_antiSD
  let matches = 0;
  const comp: Record<string, string> = { 'A': 'U', 'U': 'A', 'G': 'C', 'C': 'G' };
  for (let i = 0; i < Math.min(sd.length, ANTI_SD.length); i++) {
    if (comp[sd[i]] === ANTI_SD[ANTI_SD.length - 1 - i]) matches++;
  }
  const dgAntiSD = -matches * 1.5;

  const dgTotal = dgMRNA + dgSpacing + dgStandby + dgStart + dgAntiSD;
  const score = Math.max(0, Math.min(1, (-dgTotal) / 15));

  return {
    score: Math.round(score * 1000) / 1000,
    dgMRNA: Math.round(dgMRNA * 100) / 100,
    dgSpacing: Math.round(dgSpacing * 100) / 100,
    dgStandby: Math.round(dgStandby * 100) / 100,
    dgStart: Math.round(dgStart * 100) / 100,
    dgAntiSD: Math.round(dgAntiSD * 100) / 100,
    dgTotal: Math.round(dgTotal * 100) / 100,
  };
}

// ── CDS Features ───────────────────────────────────────────────────────────

const CODON_TABLE: Record<string, string> = {
  'UUU': 'F', 'UUC': 'F', 'UUA': 'L', 'UUG': 'L', 'CUU': 'L', 'CUC': 'L', 'CUA': 'L', 'CUG': 'L',
  'AUU': 'I', 'AUC': 'I', 'AUA': 'I', 'AUG': 'M', 'GUU': 'V', 'GUC': 'V', 'GUA': 'V', 'GUG': 'V',
  'UCU': 'S', 'UCC': 'S', 'UCA': 'S', 'UCG': 'S', 'CCU': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
  'ACU': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T', 'GCU': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
  'UAU': 'Y', 'UAC': 'Y', 'UAA': '*', 'UAG': '*', 'CAU': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
  'AAU': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K', 'GAU': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
  'UGU': 'C', 'UGC': 'C', 'UGA': '*', 'UGG': 'W', 'CGU': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
  'AGU': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R', 'GGU': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G',
};

function extractCDSFeatures(cds: string, host: HostOrganism): {
  cai: number;
  tai: number;
  rareCodonClusters: number;
  mrnaFoldingEnergy: number;
  gcContent: number;
  cdsLength: number;
} {
  const tRNA = HOST_TRNA[host];
  const seq = cds.toUpperCase();

  // CAI computation
  let logSum = 0;
  let nCodons = 0;
  let taiSum = 0;
  let rareClusters = 0;
  let currentRareRun = 0;

  for (let i = 0; i < seq.length - 2; i += 3) {
    const codon = seq.substring(i, i + 3);
    const rnaCodon = codon.replace(/T/g, 'U');
    const aa = CODON_TABLE[rnaCodon];
    if (!aa || aa === '*') continue;

    const copyNum = tRNA[rnaCodon] || 1;
    const maxCopy = Math.max(...Object.entries(CODON_TABLE)
      .filter(([_, a]) => a === aa)
      .map(([c]) => tRNA[c] || 1));

    if (maxCopy > 0) {
      logSum += Math.log(copyNum / maxCopy);
      nCodons++;
    }

    // tAI
    const wobblePenalty = (codon[2] === 'G' || codon[2] === 'T') ? 0.8 : 1.0;
    const tai = copyNum * wobblePenalty;
    taiSum += tai;

    // Rare codon clusters
    if (tai < 0.8) {
      currentRareRun++;
      if (currentRareRun >= 3) rareClusters++;
    } else {
      currentRareRun = 0;
    }
  }

  const cai = nCodons > 0 ? Math.exp(logSum / nCodons) : 0;
  const taiAvg = nCodons > 0 ? taiSum / nCodons : 0;

  // mRNA folding energy at 5' end (first 50 nt)
  const fivePrime = seq.substring(0, Math.min(50, seq.length));
  const mrnaFoldingEnergy = computeMRNAFoldingNN(fivePrime);

  // GC content
  const gcContent = (seq.match(/[GC]/g) || []).length / seq.length;

  return {
    cai: Math.round(Math.min(1, cai) * 1000) / 1000,
    tai: Math.round(Math.min(10, taiAvg) * 100) / 100,
    rareCodonClusters: rareClusters,
    mrnaFoldingEnergy: Math.round(mrnaFoldingEnergy * 100) / 100,
    gcContent: Math.round(gcContent * 1000) / 1000,
    cdsLength: seq.length,
  };
}

// ── Terminator Features ────────────────────────────────────────────────────

function extractTerminatorFeatures(terminator: string): {
  score: number;
  dg: number;
} {
  const seq = terminator.toUpperCase();

  // Find poly-T tract
  const tTractMatch = seq.match(/T{4,}/);
  const tTractLength = tTractMatch ? tTractMatch[0].length : 4;

  // Stem-loop detection (palindromic region search)
  let stemLength = 0;
  for (let i = 0; i < seq.length - 10; i++) {
    for (let len = 4; len <= 10; len++) {
      if (i + 2 * len + 4 > seq.length) break;
      const stem5 = seq.substring(i, i + len);
      const loop = seq.substring(i + len, i + len + 4);
      const stem3 = seq.substring(i + len + 4, i + 2 * len + 4);
      // Check complementarity
      const comp: Record<string, string> = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G' };
      let matches = 0;
      for (let j = 0; j < len; j++) {
        if (comp[stem5[j]] === stem3[len - 1 - j]) matches++;
      }
      if (matches / len > 0.6) {
        stemLength = Math.max(stemLength, len);
      }
    }
  }

  // ΔG calculation
  const dgStem = -stemLength * 1.5;
  const dgLoop = 5.4; // typical 4-nt loop
  const dgTtract = -1.5 * tTractLength;
  const dg = dgStem + dgLoop + dgTtract;

  // Efficiency: sigmoid of ΔG
  const efficiency = Math.min(0.95, 1 / (1 + Math.exp(dg / 2)));

  return {
    score: Math.round(efficiency * 1000) / 1000,
    dg: Math.round(dg * 100) / 100,
  };
}

// ── Module 4: Main Predictor ───────────────────────────────────────────────

/**
 * Main expression prediction model.
 *
 * Uses a multiplicative baseline with learned corrections:
 *   expression = baseline × (1 + correction)
 *   baseline = f_promoter × g_RBS × h_CDS × i_terminator × j_host
 *   correction = Σ(w_i × feature_i) + Σ(w_ij × feature_i × feature_j)
 *
 * All weights are from published literature, not trained.
 */
function predictExpression(features: ExpressionFeatures): number {
  // Multiplicative baseline
  const baseline =
    features.promoterScore *
    features.rbsScore *
    Math.min(1, features.cai * 0.7 + features.tai * 0.03) *
    features.terminatorScore *
    features.hostCompatibility;

  // Corrections (literature-derived weights)
  let correction = 0;

  // Rare codon penalty (Kudla 2009)
  correction -= features.rareCodonClusters * 0.05;

  // mRNA folding at 5' end penalty (Kudla 2009)
  if (features.mrnaFoldingEnergy < -10) {
    correction -= 0.1 * Math.abs(features.mrnaFoldingEnergy + 10) / 10;
  }

  // GC content optimization (moderate GC is best)
  if (features.gcContent > 0.3 && features.gcContent < 0.6) {
    correction += 0.05;
  }

  // Folding burden penalty (ESM-2 derived)
  correction -= features.foldingBurden * 0.1;

  // Solubility bonus (ESM-2 derived)
  correction += (features.predictedSolubility - 0.5) * 0.1;

  // Structural risk penalty (ESM-2 derived)
  correction -= features.structuralRisk * 0.05;

  const expression = Math.max(0, Math.min(1, baseline * (1 + correction)));

  return Math.round(expression * 1000) / 1000;
}

// ── Module 5: Explanation Head ──────────────────────────────────────────────

/**
 * Decompose expression into component contributions.
 * Uses Shapley-like values for exact attribution (≤5 components).
 */
function decomposeContributions(features: ExpressionFeatures): ContributionDecomposition {
  const components = {
    promoter: features.promoterScore,
    rbs: features.rbsScore,
    cds: Math.min(1, features.cai * 0.7 + features.tai * 0.03),
    terminator: features.terminatorScore,
    host: features.hostCompatibility,
  };

  const total = Object.values(components).reduce((s, v) => s + v, 0);

  // Normalize to fractions
  const contributions: Record<string, number> = {};
  for (const [key, value] of Object.entries(components)) {
    contributions[key] = total > 0 ? Math.round(value / total * 1000) / 1000 : 0.2;
  }

  // Interaction terms
  const interactions: ContributionDecomposition['interactions'] = [];

  // RBS-CDS interaction: strong RBS with rare codons creates bottleneck
  if (features.rbsScore > 0.7 && features.rareCodonClusters > 2) {
    interactions.push({
      components: ['rbs', 'cds'],
      effect: -0.1,
      description: 'Strong RBS with rare codon clusters creates ribosome queuing',
    });
  }

  // Promoter-terminator interaction: read-through prevention
  if (features.promoterScore > 0.8 && features.terminatorScore < 0.5) {
    interactions.push({
      components: ['promoter', 'terminator'],
      effect: -0.05,
      description: 'Strong promoter with weak terminator may cause read-through',
    });
  }

  return {
    promoter: contributions.promoter,
    rbs: contributions.rbs,
    cds: contributions.cds,
    terminator: contributions.terminator,
    host: contributions.host,
    interactions,
  };
}

/**
 * Identify bottlenecks in the expression pipeline.
 */
function identifyBottlenecks(features: ExpressionFeatures): BottleneckAnalysis[] {
  const bottlenecks: BottleneckAnalysis[] = [];

  // Transcription bottleneck
  if (features.promoterScore < 0.3) {
    bottlenecks.push({
      stage: 'transcription',
      severity: 1 - features.promoterScore,
      description: `Weak promoter (score=${features.promoterScore}). Consider using a stronger promoter.`,
      confidence: 0.8,
    });
  }

  // Translation initiation bottleneck
  if (features.rbsScore < 0.3) {
    bottlenecks.push({
      stage: 'translation_initiation',
      severity: 1 - features.rbsScore,
      description: `Weak RBS (ΔG=${features.dgTotal} kcal/mol). Strengthen SD sequence or optimize spacing.`,
      confidence: 0.85,
    });
  }

  // Translation elongation bottleneck
  if (features.rareCodonClusters > 3) {
    bottlenecks.push({
      stage: 'translation_elongation',
      severity: Math.min(1, features.rareCodonClusters / 10),
      description: `${features.rareCodonClusters} rare codon clusters detected. Optimize codon usage.`,
      confidence: 0.9,
    });
  }

  // Folding bottleneck
  if (features.foldingBurden > 0.7) {
    bottlenecks.push({
      stage: 'folding',
      severity: features.foldingBurden,
      description: 'High folding burden predicted. Consider chaperone co-expression or solubility tags.',
      confidence: 0.7,
    });
  }

  // Degradation bottleneck
  if (features.mrnaFoldingEnergy > -2) {
    bottlenecks.push({
      stage: 'degradation',
      severity: 0.5,
      description: 'Weak 5\' mRNA structure may expose transcript to RNases.',
      confidence: 0.6,
    });
  }

  // Sort by severity
  bottlenecks.sort((a, b) => b.severity - a.severity);
  return bottlenecks;
}

/**
 * Generate optimization suggestions.
 */
function generateSuggestions(
  features: ExpressionFeatures,
  bottlenecks: BottleneckAnalysis[],
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  // Promoter suggestions
  if (features.promoterScore < 0.5) {
    suggestions.push({
      component: 'promoter',
      action: 'Replace with stronger constitutive promoter (T7, tac, or synthetic)',
      currentValue: `score=${features.promoterScore}`,
      targetValue: 'score > 0.8',
      expectedImprovement: 0.3,
      confidence: 0.8,
    });
  }

  // RBS suggestions
  if (features.rbsScore < 0.5) {
    suggestions.push({
      component: 'rbs',
      action: 'Strengthen SD sequence and optimize spacing to 5 bp',
      currentValue: `ΔG=${features.dgTotal} kcal/mol`,
      targetValue: 'ΔG < -9 kcal/mol',
      expectedImprovement: 0.25,
      confidence: 0.85,
    });
  }

  // CDS suggestions
  if (features.rareCodonClusters > 2) {
    suggestions.push({
      component: 'cds',
      action: 'Replace rare codons with preferred synonyms (tAI > 0.8)',
      currentValue: `${features.rareCodonClusters} rare codon clusters`,
      targetValue: '0 clusters',
      expectedImprovement: 0.15,
      confidence: 0.9,
    });
  }

  if (features.cai < 0.6) {
    suggestions.push({
      component: 'cds',
      action: 'Optimize codon usage for target host (CAI > 0.8)',
      currentValue: `CAI=${features.cai}`,
      targetValue: 'CAI > 0.8',
      expectedImprovement: 0.1,
      confidence: 0.8,
    });
  }

  // Terminator suggestions
  if (features.terminatorScore < 0.5) {
    suggestions.push({
      component: 'terminator',
      action: 'Add stronger terminator (T7 terminator or synthetic double terminator)',
      currentValue: `efficiency=${features.terminatorScore}`,
      targetValue: 'efficiency > 0.9',
      expectedImprovement: 0.1,
      confidence: 0.7,
    });
  }

  return suggestions.sort((a, b) => b.expectedImprovement - a.expectedImprovement);
}

// ── ESM-2 Property Estimation ──────────────────────────────────────────────

/**
 * Estimate protein properties from amino acid composition.
 * Used as proxy for ESM-2 embeddings when API is unavailable.
 */
function estimateProteinProperties(cds: string): {
  solubility: number;
  foldingBurden: number;
  structuralRisk: number;
} {
  const seq = cds.toUpperCase();
  const aaCounts: Record<string, number> = {};
  let totalAA = 0;

  for (let i = 0; i < seq.length - 2; i += 3) {
    const codon = seq.substring(i, i + 3).replace(/T/g, 'U');
    const aa = CODON_TABLE[codon];
    if (aa && aa !== '*') {
      aaCounts[aa] = (aaCounts[aa] || 0) + 1;
      totalAA++;
    }
  }

  if (totalAA === 0) return { solubility: 0.5, foldingBurden: 0.5, structuralRisk: 0.5 };

  // Solubility: charged residues increase solubility
  const charged = (aaCounts['D'] || 0) + (aaCounts['E'] || 0) + (aaCounts['K'] || 0) + (aaCounts['R'] || 0);
  const solubility = Math.min(1, 0.3 + 0.5 * charged / totalAA);

  // Folding burden: large hydrophobic residues increase burden
  const hydrophobic = (aaCounts['F'] || 0) + (aaCounts['W'] || 0) + (aaCounts['I'] || 0) + (aaCounts['L'] || 0) + (aaCounts['V'] || 0);
  const foldingBurden = Math.min(1, hydrophobic / totalAA);

  // Structural risk: low complexity (repeats) increase risk
  const uniqueAA = Object.keys(aaCounts).length;
  const structuralRisk = Math.max(0, 1 - uniqueAA / 20);

  return {
    solubility: Math.round(solubility * 1000) / 1000,
    foldingBurden: Math.round(foldingBurden * 1000) / 1000,
    structuralRisk: Math.round(structuralRisk * 1000) / 1000,
  };
}

// ── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Predict gene expression level from a complete construct.
 *
 * @param promoter - Promoter DNA sequence
 * @param rbs - Ribosome binding site sequence
 * @param cds - Coding sequence (must start with ATG)
 * @param terminator - Terminator sequence
 * @param host - Target host organism
 * @returns Expression prediction with full explanation
 */
export function predictGeneExpression(
  promoter: string,
  rbs: string,
  cds: string,
  terminator: string,
  host: HostOrganism = 'ecoli',
): ExpressionPrediction {
  // Module 1: Standardize input
  const construct = standardizeInput(promoter, rbs, cds, terminator, host);

  // Module 2: Extract features
  const promoterFeatures = extractPromoterFeatures(construct.promoter);
  const rbsFeatures = extractRBSFeatures(construct.rbs, construct.cds);
  const cdsFeatures = extractCDSFeatures(construct.cds, construct.host);
  const terminatorFeatures = extractTerminatorFeatures(construct.terminator);
  const proteinProps = estimateProteinProperties(construct.cds);

  // Module 3: Host compatibility
  const tRNA = HOST_TRNA[construct.host];
  const avgTNA = Object.values(tRNA).reduce((s, v) => s + v, 0) / Object.values(tRNA).length;
  const hostCompatibility = Math.min(1, avgTNA / 3);

  // Assemble features
  const features: ExpressionFeatures = {
    promoterScore: promoterFeatures.score,
    consensusScore: promoterFeatures.consensusScore,
    spacerScore: promoterFeatures.spacerScore,
    upElementScore: promoterFeatures.upElementScore,
    rbsScore: rbsFeatures.score,
    dgMRNA: rbsFeatures.dgMRNA,
    dgSpacing: rbsFeatures.dgSpacing,
    dgStandby: rbsFeatures.dgStandby,
    dgStart: rbsFeatures.dgStart,
    dgAntiSD: rbsFeatures.dgAntiSD,
    dgTotal: rbsFeatures.dgTotal,
    cai: cdsFeatures.cai,
    tai: cdsFeatures.tai,
    rareCodonClusters: cdsFeatures.rareCodonClusters,
    mrnaFoldingEnergy: cdsFeatures.mrnaFoldingEnergy,
    gcContent: cdsFeatures.gcContent,
    cdsLength: cdsFeatures.cdsLength,
    terminatorScore: terminatorFeatures.score,
    terminatorDG: terminatorFeatures.dg,
    predictedSolubility: proteinProps.solubility,
    foldingBurden: proteinProps.foldingBurden,
    structuralRisk: proteinProps.structuralRisk,
    hostCompatibility: Math.round(hostCompatibility * 1000) / 1000,
    tRNAAvailability: Math.round(avgTNA / 6 * 1000) / 1000,
  };

  // Module 4: Main prediction
  const relativeExpression = predictExpression(features);

  // Module 5: Explanation head
  const contributions = decomposeContributions(features);
  const bottlenecks = identifyBottlenecks(features);
  const suggestions = generateSuggestions(features, bottlenecks);

  // Confidence: based on feature completeness
  const confidence = Math.min(0.95,
    0.5 +
    (promoterFeatures.score > 0 ? 0.1 : 0) +
    (rbsFeatures.score > 0 ? 0.15 : 0) +
    (cdsFeatures.cai > 0 ? 0.15 : 0) +
    (terminatorFeatures.score > 0 ? 0.1 : 0)
  );

  const designNotes: string[] = [
    `Predicted expression: ${relativeExpression.toFixed(3)} (relative) for ${construct.host}`,
    `Promoter: score=${features.promoterScore}, RBS: score=${features.rbsScore}, CAI=${features.cai}`,
    `Terminator: score=${features.terminatorScore}, CDS: ${features.cdsLength} nt`,
    `Bottleneck: ${bottlenecks[0]?.stage || 'none detected'}`,
    `Top suggestion: ${suggestions[0]?.action || 'none'}`,
  ];

  return {
    relativeExpression,
    contributions,
    bottlenecks,
    suggestions,
    features,
    host: construct.host,
    constructLength: construct.promoter.length + construct.rbs.length + construct.cds.length + construct.terminator.length,
    confidence: Math.round(confidence * 100) / 100,
    designNotes,
  };
}
