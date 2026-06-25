"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildProEvolCampaignInput } from "../../../data/proevolMockCampaign";
import type { ProEvolArtifact } from "../../../domain/proevolArtifact";
import { campaignToArtifact } from "../../../domain/proevolArtifact";
import { GaussianProcess } from "../../../server/gaussianProcess";
import type { AcquisitionType, BOTrajectoryResult } from "../../../services/boTrajectory";
import { runBOTrajectory } from "../../../services/boTrajectory";
import type { ConservationResult } from "../../../services/ProEvolCampaignEngine";
import {
  analyzeConservation,
  buildProEvolCampaign,
  type designMutantLibrary,
  type designSequences,
  type predictFitness,
  type scanMutations,
} from "../../../services/ProEvolCampaignEngine";
import { buildProEvolResearchSummary } from "../../../services/proevolAnalysis";
import { useWorkbenchStore } from "../../../store/workbenchStore";
import { THEME } from "../../../theme";
import type { ToolTab } from "../shared/ToolTabBar";
import { csvToArtifact, parseCSV } from "./sharedComponents";

export function useProEvolState() {
  const project = useWorkbenchStore((state) => state.project);
  const analyzeArtifact = useWorkbenchStore((state) => state.analyzeArtifact);
  const catalystPayload = useWorkbenchStore((state) => state.toolPayloads.catdes);
  const cethxPayload = useWorkbenchStore((state) => state.toolPayloads.cethx);
  const fbaPayload = useWorkbenchStore((state) => state.toolPayloads.fbasim);
  const setToolPayload = useWorkbenchStore((state) => state.setToolPayload);

  const [totalRounds, setTotalRounds] = useState(4);
  const [librarySize, setLibrarySize] = useState(16);
  const [survivorCount, setSurvivorCount] = useState(5);
  const [selectionStringency, setSelectionStringency] = useState(0.65);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [showParams, setShowParams] = useState(false);

  // ── CSV upload state ────────────────────────────────────────────────────
  const [csvArtifact, setCsvArtifact] = useState<ProEvolArtifact | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("landscape");
  const [proevolError, setProevolError] = useState<string | null>(null);

  // ── Mutation Scanner state ───────────────────────────────────────────
  const [scanSequence, setScanSequence] = useState("");
  const [pdbText, setPdbText] = useState<string | null>(null);
  const [pdbLoading, setPdbLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ReturnType<typeof scanMutations> | null>(null);
  const [conservationResult, setConservationResult] = useState<ConservationResult | null>(null);
  const [fitnessResult, setFitnessResult] = useState<ReturnType<typeof predictFitness>["predictions"] | null>(null);

  // ── Sequence Design state ────────────────────────────────────────────
  const [designResult, setDesignResult] = useState<ReturnType<typeof designSequences> | null>(null);
  const [libraryResult, setLibraryResult] = useState<ReturnType<typeof designMutantLibrary> | null>(null);
  const [designLoading, setDesignLoading] = useState(false);
  const [useESM2, setUseESM2] = useState(false);
  const [esm2Loading, setEsm2Loading] = useState(false);

  // ── ML-Guided mode (Gaussian Process) ────────────────────────────────
  const [mlMode, setMlMode] = useState(false);
  const [gpPredictions, setGpPredictions] = useState<Array<{ mean: number; variance: number }>>([]);
  const [eiScores, setEiScores] = useState<number[]>([]);
  const [suggestedVariantId, setSuggestedVariantId] = useState<string | null>(null);
  const [gpError, setGpError] = useState<string | null>(null);

  // ── BO Trajectory simulation ────────────────────────────────────────
  const [boResult, setBoResult] = useState<BOTrajectoryResult | null>(null);
  const [boRunning, setBoRunning] = useState(false);
  const [boError, setBoError] = useState<string | null>(null);
  const [boAcqType, setBoAcqType] = useState<AcquisitionType>("EI");
  const [boRounds, setBoRounds] = useState(5);
  const [boBatchSize, setBoBatchSize] = useState(10);

  // ── CSV upload handler ──────────────────────────────────────────────────
  const handleCSVUpload = useCallback(
    (file: File) => {
      setIsParsing(true);
      setUploadError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result;
          if (typeof text !== "string") throw new Error("Failed to read file.");
          const parsed = parseCSV(text);
          const targetProduct =
            analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || "Target Product";
          const artifact = csvToArtifact(parsed, targetProduct);
          setCsvArtifact(artifact);
          setUploadFileName(file.name);
          setUploadError(null);
        } catch (err) {
          setUploadError(err instanceof Error ? err.message : "Unknown error parsing CSV.");
          setCsvArtifact(null);
          setUploadFileName(null);
        } finally {
          setIsParsing(false);
        }
      };
      reader.onerror = () => {
        setUploadError("Failed to read file.");
        setIsParsing(false);
      };
      reader.readAsText(file);
    },
    [analyzeArtifact?.targetProduct, project?.targetProduct, project?.title],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleCSVUpload(file);
      // Reset input so re-uploading the same file triggers onChange
      e.target.value = "";
    },
    [handleCSVUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files?.[0];
      if (file) {
        if (!file.name.endsWith(".csv")) {
          setUploadError("Please upload a .csv file.");
          return;
        }
        handleCSVUpload(file);
      }
    },
    [handleCSVUpload],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const clearCSV = useCallback(() => {
    setCsvArtifact(null);
    setUploadError(null);
    setUploadFileName(null);
  }, []);

  const campaignInput = useMemo(
    () =>
      buildProEvolCampaignInput({
        project,
        analyzeArtifact,
        catalyst: catalystPayload,
        fba: fbaPayload,
        cethx: cethxPayload,
        totalRounds,
        librarySize,
        survivorCount,
        selectionStringency,
      }),
    [
      analyzeArtifact,
      catalystPayload,
      cethxPayload,
      fbaPayload,
      librarySize,
      project,
      selectionStringency,
      survivorCount,
      totalRounds,
    ],
  );

  const campaign = useMemo(() => buildProEvolCampaign(campaignInput), [campaignInput]);
  const targetProduct = analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || "Target Product";
  const artifact = useMemo(() => campaignToArtifact({ campaign, targetProduct }), [campaign, targetProduct]);
  const research = useMemo(() => buildProEvolResearchSummary(artifact), [artifact]);

  // Real analysis from CSV data (overrides synthetic when CSV is uploaded)
  const csvResearch = useMemo(() => (csvArtifact ? buildProEvolResearchSummary(csvArtifact) : null), [csvArtifact]);

  // When CSV is present, use real analysis; otherwise use synthetic
  const activeResearch = csvResearch ?? research;
  const activeArtifact = csvArtifact ?? artifact;
  const bandSemantic = activeArtifact.provenance.bandSemantic;

  const focusedVariant =
    (selectedVariantId ? campaign.variantIndex[selectedVariantId] : undefined) ??
    campaign.currentRoundResult.selectedSurvivors[0] ??
    campaign.leadVariant;

  useEffect(() => {
    if (!selectedVariantId || !campaign.variantIndex[selectedVariantId]) {
      setSelectedVariantId(campaign.leadVariant.id);
    }
  }, [campaign.leadVariant.id, campaign.variantIndex, selectedVariantId]);

  useEffect(() => {
    setToolPayload("proevol", {
      toolId: "proevol",
      targetProduct,
      sourceArtifactId: analyzeArtifact?.id,
      campaignName: campaign.name,
      targetProtein: campaign.targetProtein,
      wildTypeLabel: campaign.wildTypeLabel,
      currentRound: campaign.currentRound,
      totalRounds: campaign.totalRounds,
      librarySize: campaign.librarySize,
      survivorCount: campaign.survivorCount,
      selectionStringency: campaign.selectionStringency,
      provenance: campaign.provenance,
      validity: artifact.provenance.validity,
      result: {
        leadVariantName: campaign.leadVariant.name,
        leadVariantScore: campaign.leadVariant.score.composite,
        leadMutationString: campaign.leadVariant.mutationString,
        selectedThisRound: campaign.currentRoundResult.selectedSurvivors.length,
        rejectedThisRound: campaign.currentRoundResult.rejectedVariants.length,
        diversityIndex: activeResearch.lastRoundShannon?.mean ?? 0,
        convergenceState: campaign.convergenceSignal.state,
        recommendation: campaign.nextRoundRecommendation.summary,
      },
      updatedAt: Date.now(),
    });
  }, [
    activeResearch.lastRoundShannon,
    analyzeArtifact?.id,
    artifact.provenance.validity,
    campaign,
    setToolPayload,
    targetProduct,
  ]);

  // ── Exports ────────────────────────────────────────────────────────────
  const trajectoryExport = useMemo(
    () =>
      activeResearch.trajectories.flatMap((t) =>
        t.points.map((p) => ({
          variantId: t.variantId,
          variant: t.label,
          family: t.familyLabel,
          round: p.roundNumber,
          frequency: p.frequency,
          bandLower: p.lower,
          bandUpper: p.upper,
          bandSemantic,
          totalReads: p.totalReads,
        })),
      ),
    [bandSemantic, activeResearch.trajectories],
  );
  const enrichmentExport = useMemo(
    () =>
      activeResearch.enrichment.map((e) => ({
        variantId: e.variantId,
        variant: e.label,
        family: e.familyLabel,
        mutations: e.mutationString,
        mutationBurden: e.mutationBurden,
        finalFrequency: e.finalFrequency,
        bandLower: e.finalFrequencyCi.lower,
        bandUpper: e.finalFrequencyCi.upper,
        bandSemantic,
        log2EnrichmentVsWildType: e.log2EnrichmentVsWildType,
        log2EnrichmentAcrossRounds: e.log2EnrichmentAcrossRounds,
        meanSelectionCoefficient: e.meanSelectionCoefficient,
        totalReadsLastRound: e.totalReadsLastRound,
      })),
    [bandSemantic, activeResearch.enrichment],
  );
  const diversityExport = useMemo(
    () =>
      activeResearch.diversity.map((d) => ({
        round: d.roundNumber,
        shannonBits: d.shannonBits.mean,
        shannonBandLower: d.shannonBits.lower,
        shannonBandUpper: d.shannonBits.upper,
        topShare: d.topShare.mean,
        topShareBandLower: d.topShare.lower,
        topShareBandUpper: d.topShare.upper,
        bandSemantic,
        effectiveVariantCount: d.effectiveVariantCount,
        observedVariantCount: d.observedVariantCount,
      })),
    [bandSemantic, activeResearch.diversity],
  );

  const exportSuffix = bandSemantic === "modeled" ? "-modeled" : "-experiment";
  const lead = campaign.leadVariant;
  const wt = campaign.wildType;

  // ── ML-Guided GP analysis ────────────────────────────────────────────
  const mlVariants = useMemo(() => {
    return Object.values(campaign.variantIndex);
  }, [campaign.variantIndex]);

  const runGPAnalysis = useCallback(() => {
    if (mlVariants.length < 3) return;

    // Encode each variant as a feature vector:
    // [predictedActivity, predictedStability, predictedExpression, predictedSpecificity, mutationBurden]
    const X: number[][] = mlVariants.map((v) => [
      v.predictedActivity,
      v.predictedStability,
      v.predictedExpression,
      v.predictedSpecificity,
      v.mutationBurden,
    ]);

    // Fitness = composite score
    const y: number[] = mlVariants.map((v) => v.score.composite);

    // Fit GP with RBF kernel
    const gp = new GaussianProcess({
      kernel: "rbf",
      lengthScale: 10.0,
      signalVariance: 1.0,
      noiseVariance: 0.1,
    });

    try {
      gp.fit(X, y);

      // Predict for all variants
      const predictions = gp.predict(X);
      setGpPredictions(predictions);

      // Compute Expected Improvement against current best
      const bestY = Math.max(...y);
      const ei = gp.expectedImprovement(X, bestY, 0.1);
      setEiScores(ei);

      // Suggest variant with highest EI (excluding already-lead)
      let maxEi = -Infinity;
      let bestIdx = 0;
      for (let i = 0; i < ei.length; i++) {
        if (ei[i] > maxEi) {
          maxEi = ei[i];
          bestIdx = i;
        }
      }
      setSuggestedVariantId(mlVariants[bestIdx]?.id ?? null);
      setGpError(null);
    } catch (gpErr) {
      console.warn("GP analysis failed:", gpErr);
      setGpError(gpErr instanceof Error ? gpErr.message : "GP analysis failed");
      setGpPredictions([]);
      setEiScores([]);
      setSuggestedVariantId(null);
    }
  }, [mlVariants]);

  // Run GP analysis when ML mode is toggled on
  useEffect(() => {
    if (mlMode) {
      runGPAnalysis();
    } else {
      setGpPredictions([]);
      setEiScores([]);
      setSuggestedVariantId(null);
      setGpError(null);
    }
  }, [mlMode, runGPAnalysis]);

  // ── BO Trajectory handler ───────────────────────────────────────────
  const runBOSimulation = useCallback(() => {
    if (mlVariants.length < 3) return;

    setBoRunning(true);
    setBoError(null);
    setBoResult(null);

    // Use the same feature encoding as the GP analysis
    const X: number[][] = mlVariants.map((v) => [
      v.predictedActivity,
      v.predictedStability,
      v.predictedExpression,
      v.predictedSpecificity,
      v.mutationBurden,
    ]);
    const y: number[] = mlVariants.map((v) => v.score.composite);

    try {
      const result = runBOTrajectory(X, y, {
        nRounds: boRounds,
        batchSize: boBatchSize,
        acquisitionType: boAcqType,
        stoppingThreshold: 0.01,
        optimizeHyperparams: true,
      });
      setBoResult(result);
    } catch (err) {
      setBoError(err instanceof Error ? err.message : "BO simulation failed");
    } finally {
      setBoRunning(false);
    }
  }, [mlVariants, boRounds, boBatchSize, boAcqType]);

  // Build GP data rows for the ML tab table
  const gpTableRows = useMemo(() => {
    if (!mlMode || gpPredictions.length === 0) return [];
    return mlVariants.map((v, i) => ({
      id: v.id,
      name: v.name,
      mutationString: v.mutationString,
      composite: v.score.composite,
      gpMean: gpPredictions[i]?.mean ?? 0,
      gpStd: Math.sqrt(gpPredictions[i]?.variance ?? 0),
      ei: eiScores[i] ?? 0,
      suggested: v.id === suggestedVariantId,
      selected: v.status === "selected",
    }));
  }, [mlMode, gpPredictions, eiScores, mlVariants, suggestedVariantId]);

  const tabs: ToolTab[] = [
    { id: "landscape", label: "Landscape", accent: THEME.SKY },
    { id: "scanner", label: "Mutation Scanner", accent: THEME.CORAL },
    { id: "design", label: "Sequence Design", accent: THEME.MINT },
    { id: "trajectory", label: "Trajectory", accent: THEME.LILAC },
    { id: "library", label: "Library", accent: THEME.APRICOT },
    { id: "ml", label: "ML-Guided", accent: THEME.LILAC },
  ];

  return {
    // Store values
    project,
    analyzeArtifact,
    catalystPayload,
    cethxPayload,
    fbaPayload,
    setToolPayload,
    // Campaign parameters
    totalRounds,
    setTotalRounds,
    librarySize,
    setLibrarySize,
    survivorCount,
    setSurvivorCount,
    selectionStringency,
    setSelectionStringency,
    selectedVariantId,
    setSelectedVariantId,
    showParams,
    setShowParams,
    // CSV upload
    csvArtifact,
    setCsvArtifact,
    uploadError,
    setUploadError,
    uploadFileName,
    isParsing,
    fileInputRef,
    handleCSVUpload,
    handleFileInputChange,
    handleDrop,
    handleDragOver,
    clearCSV,
    // Tabs
    activeTab,
    setActiveTab,
    tabs,
    // Error
    proevolError,
    setProevolError,
    // Campaign computed
    campaign,
    targetProduct,
    artifact,
    research,
    activeResearch,
    activeArtifact,
    bandSemantic,
    focusedVariant,
    exportSuffix,
    lead,
    wt,
    // Exports
    trajectoryExport,
    enrichmentExport,
    diversityExport,
    // Mutation Scanner
    scanSequence,
    setScanSequence,
    pdbText,
    setPdbText,
    pdbLoading,
    setPdbLoading,
    scanResult,
    setScanResult,
    conservationResult,
    setConservationResult,
    fitnessResult,
    setFitnessResult,
    // Sequence Design
    designResult,
    setDesignResult,
    libraryResult,
    setLibraryResult,
    designLoading,
    setDesignLoading,
    useESM2,
    setUseESM2,
    esm2Loading,
    setEsm2Loading,
    // ML-Guided
    mlMode,
    setMlMode,
    gpPredictions,
    setGpPredictions,
    eiScores,
    setEiScores,
    suggestedVariantId,
    setSuggestedVariantId,
    gpError,
    setGpError,
    // BO
    boResult,
    setBoResult,
    boRunning,
    setBoRunning,
    boError,
    setBoError,
    boAcqType,
    setBoAcqType,
    boRounds,
    setBoRounds,
    boBatchSize,
    setBoBatchSize,
    // ML computed
    mlVariants,
    gpTableRows,
    runGPAnalysis,
    runBOSimulation,
  };
}

export type ProEvolState = ReturnType<typeof useProEvolState>;
