/**
 * MultiO Multi-Omics Integration Pipeline
 *
 * Unidirectional pipeline: Data Loader → Factor Analyzer → Interpreter
 *
 * Agent A (Loader): Prepares multi-omics data matrices
 * Agent B (Analyzer): Runs factorization (MOFA+) + dimensionality reduction
 * Agent C (Interpreter): Identifies significant factors + top loading features
 *
 * Every numerical conclusion comes from real solver calls.
 *
 * @scientific_provenance
 *   ALGORITHM: Pipeline orchestration — MOFA+ multi-view factorization + loading-based feature interpretation
 *   REFERENCE: N/A — orchestration only; delegates to mofaPlus engine
 *     MOFA+: Argelaguet R, Velten B, Arnol D, et al. (2018) "Multi-Omics Factor Analysis—a framework for unsupervised integration of multi-omics data sets" Mol Syst Biol 14:e8124
 *   KNOWN_LIMITATIONS:
 *     - Pathway enrichment arrays are always empty; no KEGG/GO annotation integration
 *     - Variance explained is computed as var(Z) * sum(W^2), a simplified proxy, not the full R² metric used by MOFA+
 *     - Top features selected by absolute loading magnitude; no permutation testing for significance
 *     - Factor count auto-capped at min(features/3, 10); no elbow or Bayesian information criterion
 *     - No batch correction or confounder adjustment before factorization
 */

import { runMOFA, type MOFAInput, type MOFAResult } from './mofaPlus';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface OmicsDataset {
  viewName: string;           // e.g., 'transcriptomics', 'proteomics'
  data: number[][];           // [samples × features]
  featureNames: string[];
  sampleNames: string[];
}

export interface MultiOmicsSpec {
  datasets: OmicsDataset[];
  nFactors: number;
  maxIterations: number;
  convergenceThreshold: number;
}

export interface FactorInterpretation {
  factorId: number;
  varianceExplained: number;  // per-view
  topFeatures: Array<{ feature: string; loading: number; view: string }>;
  pathwayEnrichment: Array<{ pathway: string; pValue: number; genes: string[] }>;
}

export interface MultiOmicsResult {
  spec: MultiOmicsSpec;
  mofa: MOFAResult;
  factorInterpretations: FactorInterpretation[];
  sampleEmbedding: Array<{ sample: string; factors: number[] }>;
  allSolverCalls: Array<{ solver: string; description: string }>;
}

// ── Agent A: Data Loader ────────────────────────────────────────────────────

/**
 * Prepare data matrices for MOFA+ input.
 */
function prepareData(
  datasets: OmicsDataset[],
): {
  mofaInput: MOFAInput;
  solverCalls: Array<{ solver: string; description: string }>;
} {
  const solverCalls: Array<{ solver: string; description: string }> = [];
  solverCalls.push({ solver: 'data::prepare', description: `${datasets.length} views, ${datasets[0]?.sampleNames.length ?? 0} samples` });

  const views: Record<string, number[][]> = {};
  for (const ds of datasets) {
    views[ds.viewName] = ds.data;
  }

  const mofaInput: MOFAInput = {
    views,
    nFactors: Math.min(10, Math.max(2, Math.floor(Math.min(...datasets.map(d => d.data[0]?.length ?? 0)) / 3))),
  };

  return { mofaInput, solverCalls };
}

// ── Agent B: Factor Analyzer ────────────────────────────────────────────────

/**
 * Run MOFA+ factorization.
 */
function analyzeFactors(
  mofaInput: MOFAInput,
): {
  result: MOFAResult;
  solverCalls: Array<{ solver: string; description: string }>;
} {
  const solverCalls: Array<{ solver: string; description: string }> = [];
  solverCalls.push({ solver: 'mofaPlus::runMOFA', description: `${mofaInput.nFactors} factors, ${Object.keys(mofaInput.views).length} views` });

  const result = runMOFA(mofaInput);
  return { result, solverCalls };
}

// ── Agent C: Interpreter ────────────────────────────────────────────────────

/**
 * Interpret factors: identify top features and compute variance explained.
 */
function interpretFactors(
  mofaResult: MOFAResult,
  datasets: OmicsDataset[],
): {
  interpretations: FactorInterpretation[];
  sampleEmbedding: Array<{ sample: string; factors: number[] }>;
  solverCalls: Array<{ solver: string; description: string }>;
} {
  const solverCalls: Array<{ solver: string; description: string }> = [];
  solverCalls.push({ solver: 'interpret::factors', description: `${mofaResult.factors[0]?.length ?? 0} factor interpretations` });

  const interpretations: FactorInterpretation[] = [];

  const nFactors = mofaResult.factors[0]?.length ?? 0;
  for (let f = 0; f < nFactors; f++) {
    // Get loadings for each view
    const topFeatures: Array<{ feature: string; loading: number; view: string }> = [];

    for (const ds of datasets) {
      const loadings = mofaResult.loadings[ds.viewName]?.[f] ?? [];
      const featureLoadings = ds.featureNames.map((name, i) => ({
        feature: name,
        loading: loadings[i] ?? 0,
        view: ds.viewName,
      }));

      // Sort by absolute loading, take top 10
      featureLoadings.sort((a, b) => Math.abs(b.loading) - Math.abs(a.loading));
      topFeatures.push(...featureLoadings.slice(0, 10));
    }

    // Variance explained per view
    const varianceExplainedView: Record<string, number> = {};
    for (const ds of datasets) {
      const factorScores = mofaResult.factors.map((row: number[]) => row[f] ?? 0);
      const loadings = mofaResult.loadings[ds.viewName]?.map((row: number[]) => row[f] ?? 0) ?? [];
      // Variance = var(Z_f) * sum(W_f^2)
      const zVar = variance(factorScores);
      const wSumSq = loadings.reduce((s: number, w: number) => s + w * w, 0);
      varianceExplainedView[ds.viewName] = Math.round(zVar * wSumSq * 1000) / 1000;
    }

    interpretations.push({
      factorId: f,
      varianceExplained: varianceExplainedView[datasets[0]?.viewName] ?? 0,
      topFeatures: topFeatures.sort((a, b) => Math.abs(b.loading) - Math.abs(a.loading)).slice(0, 20),
      pathwayEnrichment: [],  // would need KEGG/GO annotation
    });
  }

  // Sample embedding
  const sampleEmbedding = mofaResult.factors.map((row: number[], i: number) => ({
    sample: datasets[0]?.sampleNames[i] ?? `sample_${i}`,
    factors: row,
  }));

  return { interpretations, sampleEmbedding, solverCalls };
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((s, v) => s + v, 0) / values.length;
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
}

// ── Pipeline Entry Point ────────────────────────────────────────────────────

export function runMultiOmicsPipeline(spec: MultiOmicsSpec): MultiOmicsResult {
  const allSolverCalls: Array<{ solver: string; description: string }> = [];

  // Agent A: Prepare data
  const { mofaInput, solverCalls: prepCalls } = prepareData(spec.datasets);
  allSolverCalls.push(...prepCalls);

  // Agent B: Factor analysis
  const { result: mofa, solverCalls: analysisCalls } = analyzeFactors(mofaInput);
  allSolverCalls.push(...analysisCalls);

  // Agent C: Interpret
  const { interpretations, sampleEmbedding, solverCalls: interpCalls } = interpretFactors(mofa, spec.datasets);
  allSolverCalls.push(...interpCalls);

  return { spec, mofa, factorInterpretations: interpretations, sampleEmbedding, allSolverCalls };
}
