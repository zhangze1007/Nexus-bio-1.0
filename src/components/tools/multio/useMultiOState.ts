'use client';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { OMICS_DATA } from '../../../data/mockMultiO';
import { OmicsFoundationModel } from '../../../services/OmicsIntegrator';
import {
  extractMOFAFactors,
  computeMetabolicEfficiency,
  exportEmbeddingsWithEfficiency,
} from '../../../services/MOIEngine';
import type {
  MOFAResult,
  VAETrainingResult,
  VAEPerturbationPrediction,
} from '../../../services/MOIEngine';
import { runMOFA } from '../../../server/mofaPlus';
import type { MOFAResult as MOFAPlusResultType } from '../../../server/mofaPlus';
import { analyzeFluxomics } from '../../../modules/fluxomics/fluxomicsEngine';
import type { FluxomicsResult } from '../../../modules/fluxomics/types';
import type { StepDef } from '../shared/WorkflowStepper';
import type {
  OmicsRow,
  OmicsLayer,
  EmbeddingPoint,
  BottleneckSignal,
  PerturbationResult,
} from '../../../types';
import type { ProvenanceEntry } from '../../../types/assumptions';
import { useWorkbenchStore } from '../../../store/workbenchStore';
import { useUIStore } from '../../../store/uiStore';
import { useVAEWorker } from '../../../hooks/useVAEWorker';
import { createProvenanceEntry } from '../../../utils/provenance';
import { findPreferredGene } from './multiOHelpers';

export function useMultiOState() {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const cellfreePayload = useWorkbenchStore((s) => s.toolPayloads.cellfree);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const fbaPayload = useWorkbenchStore((s) => s.toolPayloads.fbasim);
  const scspatialPayload = useWorkbenchStore((s) => s.toolPayloads.scspatial);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);
  const devMode = useUIStore((s) => s.devMode);
  const [activeTab, setActiveTab] = useState('embedding');
  /* Layer toggles */
  const [showTranscript, setShowTranscript] = useState(true);
  const [showProtein, setShowProtein] = useState(true);
  const [showMetabolite, setShowMetabolite] = useState(true);

  /* Thresholds */
  const [fcThreshold, setFcThreshold] = useState(1.5);
  const [pvThreshold, setPvThreshold] = useState(0.05);

  /* Data upload state — use uploaded data when available, fallback to demo data */
  const [uploadedData, setUploadedData] = useState<OmicsRow[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeData = uploadedData ?? OMICS_DATA;
  const dataSource = uploadedData ? 'uploaded' : 'demo';

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const geneIdx = headers.findIndex(h => h === 'gene' || h === 'gene_name' || h === 'symbol');
      const transcriptIdx = headers.findIndex(h => h === 'transcript' || h === 'mrna' || h === 'rna' || h === 'expression');
      const proteinIdx = headers.findIndex(h => h === 'protein' || h === 'proteomics');
      const metaboliteIdx = headers.findIndex(h => h === 'metabolite' || h === 'metabolomics');
      const fcIdx = headers.findIndex(h => h === 'fold_change' || h === 'fc' || h === 'log2fc');
      const pvIdx = headers.findIndex(h => h === 'pvalue' || h === 'p_value' || h === 'padj');

      if (geneIdx < 0) return; // need at least gene column

      const parsed: OmicsRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        const gene = cols[geneIdx];
        if (!gene) continue;
        parsed.push({
          id: `u${i}`,
          gene,
          transcript: transcriptIdx >= 0 ? parseFloat(cols[transcriptIdx]) || 0 : 0,
          protein: proteinIdx >= 0 ? parseFloat(cols[proteinIdx]) || 0 : 0,
          metabolite: metaboliteIdx >= 0 ? parseFloat(cols[metaboliteIdx]) || 0 : 0,
          fold_change: fcIdx >= 0 ? parseFloat(cols[fcIdx]) || 0 : 0,
          pValue: pvIdx >= 0 ? parseFloat(cols[pvIdx]) || 1 : 1,
        });
      }
      if (parsed.length > 0) setUploadedData(parsed);
    };
    reader.readAsText(file);
  }, []);

  /* Perturbation state */
  const [selectedGene, setSelectedGene] = useState<string>(activeData[0]?.gene ?? '');
  const [perturbedExpr, setPerturbedExpr] = useState<number>(4);
  const [perturbResult, setPerturbResult] = useState<PerturbationResult | null>(null);
  const [multioError, setMultioError] = useState<string | null>(null);

  /* Deterministic local integration model */
  const { data: model, error: simError } = useMemo(() => {
    try { return { data: new OmicsFoundationModel(activeData), error: null as string | null }; }
    catch (e) { return { data: new OmicsFoundationModel(activeData), error: e instanceof Error ? e.message : 'Model init failed' }; }
  }, []);
  const embeddings = useMemo(() => model.computeEmbeddings(), [model]);
  const bottleneck = useMemo(() => model.analyzeBottleneck(), [model]);
  const correlations = useMemo(() => model.computeCorrelationMatrix(), [model]);

  /* MOI Engine — ALS factors / linear embedding / Efficiency */
  const mofaResult = useMemo(() => extractMOFAFactors(activeData, 5), []);

  /* MOFA+ variational Bayes factor analysis */
  const [mofaPlusResult, setMofaPlusResult] = useState<MOFAPlusResultType | null>(null);
  const [mofaPlusLoading, setMofaPlusLoading] = useState(false);
  const handleRunMOFA = useCallback(() => {
    setMofaPlusLoading(true);
    try {
      const views: Record<string, number[][]> = {};
      views.transcriptomics = activeData.map(r => [r.transcript ?? 0]);
      views.proteomics = activeData.map(r => [r.protein ?? 0]);
      views.metabolomics = activeData.map(r => [r.metabolite ?? 0]);
      const result = runMOFA({ views, nFactors: 5 });
      setMofaPlusResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'MOFA+ analysis failed';
      setMultioError(msg);
    } finally {
      setMofaPlusLoading(false);
    }
  }, []);
  const { result: vaeResult, loading: vaeLoading, error: vaeError, train: trainVAE } = useVAEWorker({
    data: activeData,
    latentDim: 8,
    beta: 0.5,
    epochs: 100,
    lr: 0.005,
  });

  /* Auto-train linear embedding on mount */
  useEffect(() => { trainVAE(); }, [trainVAE]);

  /* Fluxomics state */
  const [fluxomicsResult, setFluxomicsResult] = useState<FluxomicsResult | null>(null);
  const [fluxomicsLoading, setFluxomicsLoading] = useState(false);
  const handleRunFluxomics = useCallback(() => {
    setFluxomicsLoading(true);
    try {
      const fluxEstimates = activeData.map((row, i) => ({
        reactionId: `R_${row.gene}`,
        flux: Math.abs(row.transcript ?? 0) * 0.5 + Math.abs(row.protein ?? 0) * 0.3 + Math.abs(row.metabolite ?? 0) * 0.2,
        confidence: 0.5 + Math.random() * 0.4,
      }));
      const geneExpression: Record<string, number> = {};
      activeData.forEach(row => {
        geneExpression[`R_${row.gene}`] = (row.transcript ?? 0) / 10;
      });
      const result = analyzeFluxomics({
        fluxEstimates,
        geneExpression,
        growthRate: 0.45,
      });
      setFluxomicsResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fluxomics analysis failed';
      setMultioError(msg);
    } finally {
      setFluxomicsLoading(false);
    }
  }, [activeData]);

  /* 13C-MFA state */
  const [mfa13cResult, setMfa13cResult] = useState<import('../../../server/mfa13CEngine').MFAResult | null>(null);
  const [mfa13cLoading, setMfa13cLoading] = useState(false);
  const [mfa13cMCResult, setMfa13cMCResult] = useState<ReturnType<typeof import('../../../server/mfa13CEngine').monteCarloConfidenceIntervals> | null>(null);
  const [mfa13cMCTrials, setMfa13cMCTrials] = useState(100);
  const handleRunMFA13C = useCallback(async () => {
    setMfa13cLoading(true);
    try {
      const { run13CMFA, monteCarloConfidenceIntervals } = await import('../../../server/mfa13CEngine');
      const metabolites: import('../../../server/mfa13CEngine').Metabolite[] = [
        { id: 'glucose', name: 'Glucose', nCarbon: 6 },
        { id: 'pyruvate', name: 'Pyruvate', nCarbon: 3 },
        { id: 'acetyl_coa', name: 'Acetyl-CoA', nCarbon: 2 },
        { id: 'citrate', name: 'Citrate', nCarbon: 6 },
      ];
      const reactions: import('../../../server/mfa13CEngine').Reaction[] = [
        {
          id: 'GLYCOLYSIS',
          substrates: [{ metabolite: 'glucose', stoichiometry: 1 }],
          products: [{ metabolite: 'pyruvate', stoichiometry: 2 }],
          atomMapping: { glucose: ['C1', 'C2', 'C3'] },
        },
        {
          id: 'PDH',
          substrates: [{ metabolite: 'pyruvate', stoichiometry: 1 }],
          products: [{ metabolite: 'acetyl_coa', stoichiometry: 1 }],
          atomMapping: { pyruvate: ['C1', 'C2'] },
        },
        {
          id: 'CS',
          substrates: [{ metabolite: 'acetyl_coa', stoichiometry: 1 }],
          products: [{ metabolite: 'citrate', stoichiometry: 1 }],
          atomMapping: { acetyl_coa: ['C1', 'C2'] },
        },
      ];
      const measuredMIDs: Record<string, number[]> = {};
      const nMet = Math.min(activeData.length, metabolites.length);
      for (let i = 0; i < nMet; i++) {
        const met = metabolites[i];
        const row = activeData[i];
        const raw = [row.transcript ?? 0, row.protein ?? 0, row.metabolite ?? 0];
        const total = raw.reduce((s, v) => s + Math.abs(v), 0) || 1;
        const mid = new Array(met.nCarbon + 1).fill(0);
        const normalized = raw.map(v => Math.abs(v) / total);
        for (let j = 0; j < Math.min(normalized.length, mid.length); j++) {
          mid[j] = normalized[j];
        }
        const remaining = 1 - mid.reduce((s, v) => s + v, 0);
        if (remaining > 0) {
          for (let j = normalized.length; j < mid.length; j++) mid[j] = remaining / (mid.length - normalized.length);
        }
        measuredMIDs[met.id] = mid;
      }
      const input: import('../../../server/mfa13CEngine').MFAInput = {
        metabolites,
        reactions,
        labelSubstrate: 'glucose',
        labelPattern: [0, 1, 2],
        measuredMIDs,
        objectiveReaction: 'CS',
      };
      const result = run13CMFA(input);
      setMfa13cResult(result);
      const mcResult = monteCarloConfidenceIntervals(input, mfa13cMCTrials);
      setMfa13cMCResult(mcResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '13C-MFA analysis failed';
      setMultioError(msg);
    } finally {
      setMfa13cLoading(false);
    }
  }, [activeData, mfa13cMCTrials]);

  /* Workflow stepper */
  const workflowSteps: StepDef[] = useMemo(() => [
    { id: 'input', label: 'Data Input', status: 'done', detail: `${activeData.length} genes` },
    { id: 'vae', label: 'Linear Embedding', status: vaeLoading ? 'active' : vaeResult ? 'done' : 'pending', detail: vaeResult ? `${vaeResult.latentDim}D` : undefined },
    { id: 'cluster', label: 'Clustering', status: vaeResult ? 'done' : 'pending', detail: `${Object.keys(mofaResult.factors).length > 0 ? mofaResult.factors.length : '—'} clusters` },
    { id: 'integrate', label: 'Integration', status: mofaResult.totalVarianceExplained > 0 ? 'done' : 'pending', detail: `${(mofaResult.totalVarianceExplained * 100).toFixed(0)}% var` },
    { id: 'predict', label: 'Prediction', status: perturbResult ? 'done' : 'pending', detail: perturbResult ? `${perturbResult.predicted_yield_change_percent >= 0 ? '+' : ''}${perturbResult.predicted_yield_change_percent.toFixed(1)}%` : undefined },
  ], [activeData, vaeLoading, vaeResult, mofaResult, perturbResult]);
  const efficiencyScores = useMemo(() => computeMetabolicEfficiency(activeData), []);
  const vaeEmbeddings = useMemo(
    () => vaeResult ? exportEmbeddingsWithEfficiency(vaeResult, efficiencyScores) : [],
    [vaeResult, efficiencyScores],
  );

  /* Local embedding perturbation state */
  const [vaePerturbGene, setVaePerturbGene] = useState<string>(activeData[0]?.gene ?? '');
  const [vaePerturbFC, setVaePerturbFC] = useState<number>(2.0);
  const [vaePerturbResult, setVaePerturbResult] = useState<VAEPerturbationPrediction | null>(null);

  // Pipeline state
  const [pipelineResult, setPipelineResult] = useState<{
    topFactors: number; varianceExplained: number; dominantView: string;
    keyGenes: string[]; converged: boolean;
  } | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  /* Derived data */
  const filtered = useMemo(
    () => activeData.filter(r => Math.abs(r.fold_change ?? 0) > 0),
    [],
  );

  const significant = filtered.filter(
    r => (r.pValue ?? 1) < pvThreshold && Math.abs(r.fold_change ?? 0) > fcThreshold,
  );
  const upregulated = significant.filter(r => (r.fold_change ?? 0) > 0).length;
  const downregulated = significant.filter(r => (r.fold_change ?? 0) < 0).length;

  const thoughts = useMemo(() => model.getThoughts(), [model, perturbResult]);

  const activeLayers: Record<OmicsLayer, boolean> = {
    transcriptomics: showTranscript,
    proteomics: showProtein,
    metabolomics: showMetabolite,
  };

  /* Layer signal scores aggregated per layer */
  const layerSignals = useMemo(() => {
    const acc: Record<OmicsLayer, number> = { transcriptomics: 0, proteomics: 0, metabolomics: 0 };
    bottleneck.layer_signals.forEach(h => { acc[h.layer] += h.weight; });
    return acc;
  }, [bottleneck]);
  const maxSignal = Math.max(...Object.values(layerSignals), 0.01);

  /* Gene list for perturbation dropdown */
  const geneNames = useMemo(() => [...new Set(activeData.map(r => r.gene))], []);
  const preferredGene = useMemo(
    () => findPreferredGene([
      analyzeArtifact?.bottleneckAssumptions?.[0]?.label ?? '',
      analyzeArtifact?.enzymeCandidates?.[0]?.label ?? '',
      analyzeArtifact?.targetProduct ?? '',
      project?.targetProduct ?? '',
    ], activeData),
    [
      analyzeArtifact?.bottleneckAssumptions,
      analyzeArtifact?.enzymeCandidates,
      analyzeArtifact?.targetProduct,
      project?.targetProduct,
      activeData,
    ],
  );

  /* Correlation label helper */
  const corrLabel = (a: OmicsLayer, b: OmicsLayer) => {
    const short: Record<OmicsLayer, string> = { transcriptomics: 'T', proteomics: 'P', metabolomics: 'M' };
    return `${short[a]}↔${short[b]}`;
  };

  // FBA flux weighting
  const fbaFluxWeight = useMemo(() => {
    if (!fbaPayload?.result.topFluxes?.length) return 1;
    const REACTION_TO_GENES: Record<string, string[]> = {
      PFK: ['pfkA', 'pfkB'], PYK: ['pykF', 'pykA'], GAPD: ['gapA'],
      PGI: ['zwf'], ENO: ['eno'], PDH: ['ppc'], CS: ['sdhA'], MDH: ['sucA'], FBA: ['gpmA'],
    };
    const geneUpper = selectedGene.toUpperCase();
    for (const { reactionId, flux } of fbaPayload.result.topFluxes) {
      const genes = REACTION_TO_GENES[reactionId];
      if (genes?.some((g) => g.toUpperCase() === geneUpper)) {
        return 1 + Math.abs(flux) * 0.02;
      }
    }
    return 1;
  }, [fbaPayload?.result.topFluxes, selectedGene]);

  const handleSimulate = useCallback(() => {
    try {
      const weightedExpr = perturbedExpr * fbaFluxWeight;
      const result = model.simulatePerturbation(selectedGene, weightedExpr);
      setPerturbResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Perturbation simulation failed';
      setMultioError(msg);
    }
  }, [model, selectedGene, perturbedExpr, fbaFluxWeight]);

  useEffect(() => {
    if (preferredGene) {
      setSelectedGene(preferredGene);
      setVaePerturbGene(preferredGene);
    }
  }, [preferredGene]);

  useEffect(() => {
    const now = Date.now();
    const topEfficiency = [...efficiencyScores].sort((left, right) => right.score - left.score)[0];
    const upstreamProvenance = [cellfreePayload?.runProvenance, dbtlPayload?.runProvenance, fbaPayload?.runProvenance, scspatialPayload?.runProvenance]
      .filter((entry): entry is ProvenanceEntry => Boolean(entry))
      .map((entry) => `${entry.toolId}:${entry.timestamp}`);
    setToolPayload('multio', {
      validity: 'demo',
      runProvenance: createProvenanceEntry({
        toolId: 'multio',
        outputAssumptions: [
          'multio.deterministic_demo_only',
          'multio.no_reference_model',
          'multio.no_bayesian_gp_posterior',
          'multio.not_mofa_plus',
          'multio.not_vae',
          'multio.no_umap',
          'multio.deterministic_no_uncertainty',
          'multio.linear_perturbation',
        ],
        evidence: [{
          id: `multio-${now}`,
          source: 'computation',
          reference: 'Deterministic local computation: linear factor decomposition, linear projection, and sensitivity-style perturbation.',
          confidence: 'demo',
          notes: 'Uncertainty fields are placeholders from deterministic losses, not Bayesian posterior uncertainty.',
        }],
        upstreamProvenance,
      }),
      toolId: 'multio',
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
      sourceArtifactId: analyzeArtifact?.id,
      selectedGene,
      activeView: activeTab,
      thresholds: {
        fc: fcThreshold,
        pv: pvThreshold,
      },
      result: {
        significantCount: significant.length,
        dominantLayer: bottleneck.dominant_layer,
        bottleneckGene: selectedGene,
        bottleneckConfidence: bottleneck.confidence,
        mofaVarianceExplained: mofaResult.totalVarianceExplained,
        topEfficiencyGene: topEfficiency?.gene ?? '—',
        topEfficiencyScore: topEfficiency?.score ?? 0,
        vaeElbo: vaeResult?.elbo ?? 0,
      },
      updatedAt: now,
    });
  }, [
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    bottleneck.confidence,
    bottleneck.dominant_layer,
    cellfreePayload?.runProvenance,
    dbtlPayload?.runProvenance,
    fbaPayload?.runProvenance,
    scspatialPayload?.runProvenance,
    efficiencyScores,
    fcThreshold,
    mofaResult.totalVarianceExplained,
    project?.targetProduct,
    project?.title,
    pvThreshold,
    selectedGene,
    setToolPayload,
    significant.length,
    vaeResult?.elbo,
  ]);

  return {
    // Stores
    project,
    analyzeArtifact,
    scspatialPayload,
    devMode,
    // Tab
    activeTab,
    setActiveTab,
    // Layer toggles
    showTranscript, setShowTranscript,
    showProtein, setShowProtein,
    showMetabolite, setShowMetabolite,
    activeLayers,
    // Thresholds
    fcThreshold, setFcThreshold,
    pvThreshold, setPvThreshold,
    // Data
    activeData,
    dataSource,
    uploadedData, setUploadedData,
    fileInputRef,
    handleFileUpload,
    filtered,
    significant,
    upregulated,
    downregulated,
    // Model
    model,
    simError,
    embeddings,
    bottleneck,
    correlations,
    thoughts,
    layerSignals,
    maxSignal,
    // MOFA
    mofaResult,
    // MOFA+
    mofaPlusResult, setMofaPlusResult,
    mofaPlusLoading,
    handleRunMOFA,
    // VAE
    vaeResult, vaeLoading, vaeError,
    vaeEmbeddings,
    // Perturbation
    selectedGene, setSelectedGene,
    perturbedExpr, setPerturbedExpr,
    perturbResult,
    handleSimulate,
    geneNames,
    preferredGene,
    // VAE perturbation
    vaePerturbGene, setVaePerturbGene,
    vaePerturbFC, setVaePerturbFC,
    vaePerturbResult, setVaePerturbResult,
    // Pipeline
    pipelineResult, setPipelineResult,
    pipelineLoading, setPipelineLoading,
    pipelineError, setPipelineError,
    // Fluxomics
    fluxomicsResult,
    fluxomicsLoading,
    handleRunFluxomics,
    // 13C-MFA
    mfa13cResult,
    mfa13cLoading,
    mfa13cMCResult,
    mfa13cMCTrials, setMfa13cMCTrials,
    handleRunMFA13C,
    // Derived
    efficiencyScores,
    workflowSteps,
    multioError, setMultioError,
    corrLabel,
    // FBA
    fbaFluxWeight,
  };
}
