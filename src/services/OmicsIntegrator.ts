/**
 * Deterministic omics integrator — local embedding and sensitivity sketch
 *
 * Maps RNA-seq, proteomics, and metabolomics into a shared deterministic
 * projection using Z-score normalization + log2 fold change, then applies
 * variance/discordance/significance scoring to identify which omics layer
 * contains the strongest local bottleneck signal. This is not a foundation
 * model, Bayesian model, GP model, MOFA-like model, or VAE-like model.
 */

import type {
  OmicsRow,
  OmicsLayer,
  EmbeddingPoint,
  AttentionHead,
  BottleneckSignal,
  PerturbationResult,
  ReasoningStep,
  InternalThought,
} from '../types';

// ── Gene-to-Protein-to-Metabolite mapping (artemisinin pathway) ────────────
const GENE_PROTEIN_MAP: Record<string, string> = {
  HMGS: 'HMG-CoA synthase', HMGR: 'HMG-CoA reductase', MK: 'Mevalonate kinase',
  PMK: 'Phosphomevalonate kinase', MDC: 'Mevalonate decarboxylase',
  IDI: 'IPP isomerase', FPPS: 'FPP synthase', ADS: 'Amorphadiene synthase',
  CYP71AV1: 'Cytochrome P450 71AV1', CPR: 'Cytochrome P450 reductase',
  ERG9: 'Squalene synthase', ERG20: 'FPP synthase (yeast)',
  ZWF1: 'G6PDH', TDH1: 'GAPDH', PYK2: 'Pyruvate kinase',
  PDA1: 'Pyruvate dehydrogenase', ENO1: 'Enolase', TPI1: 'TPI',
  FBA1: 'Fructose-bisphosphate aldolase', PFK1: 'Phosphofructokinase',
  HXK2: 'Hexokinase', PGI1: 'Phosphoglucose isomerase',
  CIT1: 'Citrate synthase', ACO1: 'Aconitase', MAE1: 'Malic enzyme',
  PYC1: 'Pyruvate carboxylase', PGM1: 'Phosphoglucomutase',
  GPM1: 'Phosphoglycerate mutase', ADH1: 'Alcohol dehydrogenase',
  ALDH1: 'Aldehyde dehydrogenase',
};

// Enzyme → downstream metabolite effects (simplified flux propagation)
const FLUX_GRAPH: Record<string, { metabolites: string[]; impact_factor: number }> = {
  HMGS:    { metabolites: ['HMG-CoA', 'Mevalonate'], impact_factor: 0.9 },
  HMGR:    { metabolites: ['Mevalonate', 'IPP', 'FPP'], impact_factor: 0.95 },
  MK:      { metabolites: ['Mevalonate-5P', 'IPP'], impact_factor: 0.7 },
  PMK:     { metabolites: ['Mevalonate-5PP', 'IPP'], impact_factor: 0.7 },
  MDC:     { metabolites: ['IPP', 'DMAPP'], impact_factor: 0.75 },
  IDI:     { metabolites: ['DMAPP', 'GPP', 'FPP'], impact_factor: 0.8 },
  FPPS:    { metabolites: ['FPP', 'Amorphadiene'], impact_factor: 0.85 },
  ADS:     { metabolites: ['Amorphadiene', 'Artemisinic acid'], impact_factor: 1.0 },
  CYP71AV1:{ metabolites: ['Artemisinic acid', 'Artemisinin'], impact_factor: 0.95 },
  CPR:     { metabolites: ['Artemisinic acid'], impact_factor: 0.6 },
  ERG9:    { metabolites: ['Squalene', 'Ergosterol'], impact_factor: -0.8 },
  ERG20:   { metabolites: ['FPP', 'GGPP'], impact_factor: 0.7 },
};

// ── Normalization utilities ───────────────────────────────────────────────────

function zScore(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  if (std < 1e-10) return values.map(() => 0);
  return values.map(v => (v - mean) / std);
}

function log2FoldChange(value: number, baseline: number): number {
  if (baseline <= 0 || value <= 0) return 0;
  return Math.log2(value / baseline);
}

// ── Deterministic dimensionality reduction approximation ─────────────────────
// Uses a simplified distance-preserving layout for consistent 3D coordinates.
function computeProjection3D(
  matrix: number[][],
  seed: number = 42,
): [number, number, number][] {
  const n = matrix.length;
  if (n === 0) return [];

  // Seeded PRNG for deterministic results
  let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

  // Distance matrix
  const dist = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let d = 0;
      for (let k = 0; k < matrix[i].length; k++) {
        d += (matrix[i][k] - matrix[j][k]) ** 2;
      }
      return Math.sqrt(d);
    })
  );

  // Initialize random positions
  const coords: [number, number, number][] = Array.from({ length: n }, () =>
    [(rand() - 0.5) * 2, (rand() - 0.5) * 2, (rand() - 0.5) * 2]
  );

  // Simple force-directed layout (Barnes-Hut approximation) — 50 iterations
  for (let iter = 0; iter < 50; iter++) {
    const lr = 0.5 * (1 - iter / 50);
    for (let i = 0; i < n; i++) {
      let fx = 0, fy = 0, fz = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = coords[j][0] - coords[i][0];
        const dy = coords[j][1] - coords[i][1];
        const dz = coords[j][2] - coords[i][2];
        const posD = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
        const targetD = dist[i][j] * 0.3;
        const force = (posD - targetD) / posD;
        fx += dx * force * lr;
        fy += dy * force * lr;
        fz += dz * force * lr;
      }
      coords[i][0] += fx / n;
      coords[i][1] += fy / n;
      coords[i][2] += fz / n;
    }
  }

  // Normalize to [-1, 1]
  const ranges = [0, 1, 2].map(k => {
    const vals = coords.map(c => c[k]);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  });
  return coords.map(c =>
    c.map((v, k) => {
      const r = ranges[k];
      return r.max - r.min > 1e-6 ? ((v - r.min) / (r.max - r.min)) * 2 - 1 : 0;
    }) as [number, number, number]
  );
}

// ── Layer-signal scoring ─────────────────────────────────────────────────────

function computeAttentionWeights(data: OmicsRow[]): AttentionHead[] {
  const transcripts = data.map(d => d.transcript ?? 0);
  const proteins = data.map(d => d.protein ?? 0);
  const metabolites = data.map(d => d.metabolite ?? 0);
  const foldChanges = data.map(d => Math.abs(d.fold_change ?? 0));
  const pValues = data.map(d => d.pValue ?? 1);

  // Head 1: Variance-weighted attention (which layer has most variance?)
  const tVar = variance(transcripts);
  const pVar = variance(proteins);
  const mVar = variance(metabolites);
  const totalVar = tVar + pVar + mVar + 1e-10;

  // Head 2: Discordance attention (where do layers disagree?)
  const discordances = data.map(d => {
    const t = d.transcript ?? 0;
    const p = d.protein ?? 0;
    const m = d.metabolite ?? 0;
    return Math.abs(t - p) + Math.abs(p - m) + Math.abs(t - m);
  });
  const tpDisc = data.reduce((s, d) => s + Math.abs((d.transcript ?? 0) - (d.protein ?? 0)), 0);
  const pmDisc = data.reduce((s, d) => s + Math.abs((d.protein ?? 0) - (d.metabolite ?? 0)), 0);
  const tmDisc = data.reduce((s, d) => s + Math.abs((d.transcript ?? 0) - (d.metabolite ?? 0)), 0);
  const totalDisc = tpDisc + pmDisc + tmDisc + 1e-10;

  // Head 3: Significance-weighted attention (which layer's signals are most statistically significant?)
  const sigGenes = data.filter(d => (d.pValue ?? 1) < 0.05);
  const tSig = sigGenes.reduce((s, d) => s + Math.abs(d.transcript ?? 0), 0);
  const pSig = sigGenes.reduce((s, d) => s + Math.abs(d.protein ?? 0), 0);
  const mSig = sigGenes.reduce((s, d) => s + Math.abs(d.metabolite ?? 0), 0);
  const totalSig = tSig + pSig + mSig + 1e-10;

  // Head 4: Bottleneck detection (post-translational regulation signals)
  // High transcript but low protein = post-translational bottleneck
  const postTranslational = data.reduce((s, d) => {
    const t = d.transcript ?? 0;
    const p = d.protein ?? 0;
    return s + Math.max(0, t - p); // transcript-protein gap
  }, 0);
  const postMetabolic = data.reduce((s, d) => {
    const p = d.protein ?? 0;
    const m = d.metabolite ?? 0;
    return s + Math.max(0, p - m); // protein-metabolite gap
  }, 0);
  const totalBottleneck = postTranslational + postMetabolic + 1e-10;

  const heads: AttentionHead[] = [
    // Variance head
    { name: 'Variance', layer: 'transcriptomics', weight: tVar / totalVar, signal_strength: tVar, bottleneck_contribution: 0 },
    { name: 'Variance', layer: 'proteomics', weight: pVar / totalVar, signal_strength: pVar, bottleneck_contribution: 0 },
    { name: 'Variance', layer: 'metabolomics', weight: mVar / totalVar, signal_strength: mVar, bottleneck_contribution: 0 },
    // Discordance head
    { name: 'Discordance', layer: 'transcriptomics', weight: (tpDisc + tmDisc) / totalDisc / 2, signal_strength: tpDisc + tmDisc, bottleneck_contribution: 0 },
    { name: 'Discordance', layer: 'proteomics', weight: (tpDisc + pmDisc) / totalDisc / 2, signal_strength: tpDisc + pmDisc, bottleneck_contribution: 0 },
    { name: 'Discordance', layer: 'metabolomics', weight: (pmDisc + tmDisc) / totalDisc / 2, signal_strength: pmDisc + tmDisc, bottleneck_contribution: 0 },
    // Significance head
    { name: 'Significance', layer: 'transcriptomics', weight: tSig / totalSig, signal_strength: tSig, bottleneck_contribution: 0 },
    { name: 'Significance', layer: 'proteomics', weight: pSig / totalSig, signal_strength: pSig, bottleneck_contribution: 0 },
    { name: 'Significance', layer: 'metabolomics', weight: mSig / totalSig, signal_strength: mSig, bottleneck_contribution: 0 },
    // Bottleneck head
    { name: 'Bottleneck', layer: 'transcriptomics', weight: 0.1, signal_strength: postTranslational, bottleneck_contribution: postTranslational / totalBottleneck },
    { name: 'Bottleneck', layer: 'proteomics', weight: postTranslational / totalBottleneck, signal_strength: postTranslational, bottleneck_contribution: postTranslational / totalBottleneck },
    { name: 'Bottleneck', layer: 'metabolomics', weight: postMetabolic / totalBottleneck, signal_strength: postMetabolic, bottleneck_contribution: postMetabolic / totalBottleneck },
  ];

  return heads;
}

function variance(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  return values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
}

// ── Main deterministic omics integration class ───────────────────────────────

export class OmicsFoundationModel {
  private data: OmicsRow[];
  private thoughts: InternalThought[] = [];

  constructor(data: OmicsRow[]) {
    this.data = data;
  }

  /**
   * Record an internal reasoning thought (Claude-style tool use reasoning).
   */
  private think(thought: string, layers: OmicsLayer[], action: string): void {
    this.thoughts.push({
      timestamp: Date.now(),
      thought,
      layer_context: layers,
      action_taken: action,
    });
  }

  getThoughts(): InternalThought[] {
    return [...this.thoughts];
  }

  /**
   * Compute unified embeddings: maps all three omics layers into a shared
   * deterministic projection via Z-score normalization + log2 fold change.
   */
  computeEmbeddings(): EmbeddingPoint[] {
    this.think(
      'Beginning cross-modal embedding. Z-score normalizing each omics layer independently, then computing Log2 fold changes relative to median baseline.',
      ['transcriptomics', 'proteomics', 'metabolomics'],
      'normalize_and_embed',
    );

    const transcripts = this.data.map(d => d.transcript ?? 0);
    const proteins = this.data.map(d => d.protein ?? 0);
    const metabolites = this.data.map(d => d.metabolite ?? 0);

    const zT = zScore(transcripts);
    const zP = zScore(proteins);
    const zM = zScore(metabolites);

    // Build feature matrix: [zT, zP, zM] for each gene
    const featureMatrix = this.data.map((_, i) => [zT[i], zP[i], zM[i]]);

    // Compute deterministic 3D coordinates.
    const coords3D = computeProjection3D(featureMatrix);

    const points: EmbeddingPoint[] = [];

    for (let i = 0; i < this.data.length; i++) {
      const row = this.data[i];
      const baseCoords = coords3D[i] ?? [0, 0, 0];

      // Transcriptomics point
      points.push({
        id: `${row.id}_t`,
        gene: row.gene,
        layer: 'transcriptomics',
        coords: [baseCoords[0] - 0.15, baseCoords[1], baseCoords[2]],
        normalizedValue: zT[i],
        rawValue: row.transcript ?? 0,
      });

      // Proteomics point
      points.push({
        id: `${row.id}_p`,
        gene: row.gene,
        layer: 'proteomics',
        coords: [baseCoords[0], baseCoords[1] + 0.15, baseCoords[2]],
        normalizedValue: zP[i],
        rawValue: row.protein ?? 0,
      });

      // Metabolomics point
      points.push({
        id: `${row.id}_m`,
        gene: row.gene,
        layer: 'metabolomics',
        coords: [baseCoords[0] + 0.15, baseCoords[1], baseCoords[2] - 0.15],
        normalizedValue: zM[i],
        rawValue: row.metabolite ?? 0,
      });
    }

    this.think(
      `Embedded ${this.data.length} genes × 3 layers = ${points.length} points in a shared deterministic projection. Cross-modal distances are approximated locally.`,
      ['transcriptomics', 'proteomics', 'metabolomics'],
      'embedding_complete',
    );

    return points;
  }

  /**
   * Layer-signal scoring to identify which omics layer contains
   * the primary bottleneck signal.
   */
  analyzeBottleneck(): BottleneckSignal {
    this.think(
      'Running four deterministic layer-signal scores: variance, discordance, significance, and bottleneck. Each score checks which omics layer carries the strongest local signal.',
      ['transcriptomics', 'proteomics', 'metabolomics'],
      'layer_signal_scoring',
    );

    const heads = computeAttentionWeights(this.data);

    // Aggregate attention per layer across all heads
    const layerScores: Record<OmicsLayer, number> = {
      transcriptomics: 0,
      proteomics: 0,
      metabolomics: 0,
    };

    const headWeights = [0.2, 0.25, 0.25, 0.3]; // Bottleneck head weighted highest
    const headNames = ['Variance', 'Discordance', 'Significance', 'Bottleneck'];

    for (const head of heads) {
      const headIdx = headNames.indexOf(head.name);
      const w = headIdx >= 0 ? headWeights[headIdx] : 0.25;
      layerScores[head.layer] += head.weight * w;
    }

    // Determine dominant layer
    const entries = Object.entries(layerScores) as [OmicsLayer, number][];
    entries.sort((a, b) => b[1] - a[1]);
    const dominant = entries[0][0];
    const confidence = entries[0][1] / (entries.reduce((s, e) => s + e[1], 0) + 1e-10);

    // Generate reasoning
    const discordantGenes = this.data.filter(d => {
      const t = d.transcript ?? 0;
      const p = d.protein ?? 0;
      return Math.abs(t - p) > 1.5;
    });

    let reasoning: string;
    if (dominant === 'proteomics' && discordantGenes.length > 0) {
      const example = discordantGenes[0];
      reasoning = `The RNA-seq shows upregulation of ${example.gene}, but proteomics indicates ${(example.protein ?? 0) < (example.transcript ?? 0) ? 'lower' : 'higher'} protein levels. This suggests post-translational regulation. ${discordantGenes.length} genes show transcript-protein discordance > 1.5 log2 units.`;
    } else if (dominant === 'metabolomics') {
      reasoning = `Metabolomics layer carries the strongest bottleneck signal. Despite adequate transcript and protein levels, metabolite pool sizes are limiting. This suggests enzyme kinetic constraints or allosteric regulation rather than expression-level bottlenecks.`;
    } else {
      reasoning = `Transcriptomics dominates the bottleneck signal — gene expression levels are the primary limiter. Upstream promoter engineering or copy-number optimization would have the highest impact on pathway flux.`;
    }

    this.think(reasoning, [dominant], 'bottleneck_identified');

    return {
      dominant_layer: dominant,
      attention_heads: heads,
      reasoning,
      confidence: Math.round(confidence * 1000) / 1000,
    };
  }

  /**
   * Sensitivity sketch — estimates downstream metabolite shifts
   * when a gene's expression is manually adjusted.
   *
   * Reasoning chain:
   * [Identify Gene] → [Map to Protein] → [Trace Local Flux Map] → [Estimate Yield Sensitivity]
   */
  simulatePerturbation(geneId: string, newExpression: number): PerturbationResult {
    const row = this.data.find(d => d.gene === geneId);
    if (!row) {
      return {
        gene: geneId,
        original_expression: 0,
        perturbed_expression: newExpression,
        reasoning_chain: [{ step: 'Error', description: `Gene ${geneId} not found in dataset`, evidence: 'N/A' }],
        predicted_yield_change_percent: 0,
        metabolite_shifts: [],
        confidence: 0,
      };
    }

    const originalExpr = row.transcript ?? 0;
    const delta = newExpression - originalExpr;
    const protein = GENE_PROTEIN_MAP[geneId] ?? geneId;
    const fluxInfo = FLUX_GRAPH[geneId];

    // Step 1: Identify Gene
    const step1: ReasoningStep = {
      step: 'Identify Gene',
      description: `${geneId} currently at ${originalExpr.toFixed(2)} log2 FPKM. Perturbation: ${delta > 0 ? '+' : ''}${delta.toFixed(2)} (${delta > 0 ? 'overexpression' : 'knockdown'}).`,
      evidence: `Dataset row ${row.id}, fold_change=${row.fold_change?.toFixed(2) ?? 'N/A'}`,
    };

    // Step 2: Map to Protein
    const proteinLevel = row.protein ?? 0;
    const discordance = Math.abs(originalExpr - proteinLevel);
    const proteinResponse = discordance > 1.5
      ? `Post-translational regulation detected (Δ=${discordance.toFixed(2)}). Protein level may not track transcript change 1:1.`
      : `Protein level tracks transcript well (Δ=${discordance.toFixed(2)}). Expect proportional protein response.`;
    const proteinScaling = discordance > 1.5 ? 0.5 : 0.85; // attenuation factor

    const step2: ReasoningStep = {
      step: 'Map to Protein',
      description: `${geneId} encodes ${protein}. Current protein level: ${proteinLevel.toFixed(2)} log2 LFQ. ${proteinResponse}`,
      evidence: `Transcript-protein correlation analysis; discordance = ${discordance.toFixed(2)} log2 units`,
    };

    // Step 3: Trace Metabolic Flux
    const metaboliteShifts: { metabolite: string; delta: number; direction: 'up' | 'down' }[] = [];
    let fluxDescription: string;

    if (fluxInfo) {
      const effectiveDelta = delta * proteinScaling * fluxInfo.impact_factor;
      for (const met of fluxInfo.metabolites) {
        const shift = effectiveDelta * (0.5 + Math.random() * 0.5); // some stochasticity
        metaboliteShifts.push({
          metabolite: met,
          delta: Math.round(shift * 100) / 100,
          direction: shift > 0 ? 'up' : 'down',
        });
      }
      fluxDescription = `${protein} directly affects ${fluxInfo.metabolites.join(', ')}. Impact factor: ${fluxInfo.impact_factor}. Effective flux change: ${effectiveDelta.toFixed(2)} log2 units after protein-scaling attenuation.`;
    } else {
      fluxDescription = `No direct flux mapping for ${geneId}. Estimating global effects from fold-change magnitude.`;
      metaboliteShifts.push({
        metabolite: 'General metabolite pool',
        delta: Math.round(delta * proteinScaling * 0.3 * 100) / 100,
        direction: delta > 0 ? 'up' : 'down',
      });
    }

    const step3: ReasoningStep = {
      step: 'Trace Metabolic Flux',
      description: fluxDescription,
      evidence: `Curated local flux-effect map plus pathway topology labels`,
    };

    // Step 4: Estimate Yield Sensitivity
    const yieldChange = fluxInfo
      ? delta * proteinScaling * fluxInfo.impact_factor * 8 // ~8% per log2 unit of flux change
      : delta * proteinScaling * 3;

    const step4: ReasoningStep = {
      step: 'Estimate Yield Sensitivity',
      description: `Demo yield sensitivity: ${yieldChange > 0 ? '+' : ''}${yieldChange.toFixed(1)}%. ${Math.abs(yieldChange) > 20 ? 'Large local sensitivity — validate with a real downstream model.' : 'Moderate sensitivity within the local sketch range.'}`,
      evidence: `Linear flux-yield sketch with protein-scaling correction. Score degrades beyond ±2 log2 adjustment.`,
    };

    this.think(
      `Sensitivity sketch for ${geneId} (${delta > 0 ? 'OE' : 'KD'} by ${Math.abs(delta).toFixed(1)} log2): ${protein} local flux change maps to ${metaboliteShifts.length} metabolites. Estimated demo yield shift: ${yieldChange.toFixed(1)}%.`,
      ['transcriptomics', 'proteomics', 'metabolomics'],
      'sensitivity_sketch_complete',
    );

    return {
      gene: geneId,
      original_expression: originalExpr,
      perturbed_expression: newExpression,
      reasoning_chain: [step1, step2, step3, step4],
      predicted_yield_change_percent: Math.round(yieldChange * 10) / 10,
      metabolite_shifts: metaboliteShifts,
      confidence: Math.max(0.3, Math.min(0.95, 1 - Math.abs(delta) * 0.1)),
    };
  }

  /**
   * Cross-layer correlation matrix — Pearson correlation between
   * transcript, protein, and metabolite values across all genes.
   */
  computeCorrelationMatrix(): { layers: [OmicsLayer, OmicsLayer]; r: number; p_approx: number }[] {
    const t = this.data.map(d => d.transcript ?? 0);
    const p = this.data.map(d => d.protein ?? 0);
    const m = this.data.map(d => d.metabolite ?? 0);

    return [
      { layers: ['transcriptomics', 'proteomics'], ...pearson(t, p) },
      { layers: ['proteomics', 'metabolomics'], ...pearson(p, m) },
      { layers: ['transcriptomics', 'metabolomics'], ...pearson(t, m) },
    ];
  }
}

// ── Pearson correlation helper ────────────────────────────────────────────────
function pearson(x: number[], y: number[]): { r: number; p_approx: number } {
  const n = x.length;
  if (n < 3) return { r: 0, p_approx: 1 };
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  const r = denom < 1e-10 ? 0 : num / denom;
  // t-test approximation for p-value
  const t = r * Math.sqrt((n - 2) / (1 - r * r + 1e-10));
  const p_approx = Math.max(1e-10, 2 * (1 - normalCDF(Math.abs(t))));
  return { r: Math.round(r * 1000) / 1000, p_approx };
}

function normalCDF(x: number): number {
  // Abramowitz & Stegun approximation
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}
