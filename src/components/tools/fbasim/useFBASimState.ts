"use client";
/**
 * useFBASimState.ts — Custom hook encapsulating ALL FBASim state, effects,
 * and handlers. Extracted from FBASimPage.tsx for modularity.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CommunityFBAOutput, FBAOutput } from "../../../data/mockFBA";
import { BASE_REACTIONS, REACTION_DEFS } from "../../../data/mockFBA";
import type { FBAArtifact } from "../../../domain/toolDataContract";
import type { BiGGModel, BiGGReaction } from "../../../services/database/biggClient";
import { getModelReactions, listBiGGModels } from "../../../services/database/biggClient";
import type { FallbackResult } from "../../../services/database/fetchWithFallback";
import { useArtifactStore } from "../../../store/artifactStore";
import {
  solveAuthorityCommunityFBAWithProvenance,
  solveAuthorityFBAWithProvenance,
  solveDynamicModelFBA,
  solveFSEOF,
  solveOptKnock,
} from "../../../services/FBAAuthorityClient";
import { useUIStore } from "../../../store/uiStore";
import { useWorkbenchStore } from "../../../store/workbenchStore";
import type { ProvenanceEntry } from "../../../types/assumptions";
import { usePersistedState } from "../../ide/shared/usePersistedState";
import { buildFBASeed } from "../shared/workbenchDataflow";
import { createEmptyCommunityOutput, createEmptyFBAOutput, round, type SimMode } from "./fbaHelpers";
import type { FSEOFResultType, OptKnockResultType, PipelineResult } from "./sharedComponents";

export interface FBASimState {
  // Sim mode
  simMode: SimMode;
  setSimMode: (m: SimMode) => void;
  chartRef: React.RefObject<SVGSVGElement | null>;

  // Single-species state
  glucoseUptake: number;
  setGlucoseUptake: (v: number) => void;
  oxygenUptake: number;
  setOxygenUptake: (v: number) => void;
  objective: "biomass" | "atp" | "product";
  setObjective: (o: "biomass" | "atp" | "product") => void;
  knockouts: string[];
  setKnockouts: React.Dispatch<React.SetStateAction<string[]>>;
  singleResult: FBAOutput;
  singleRunProvenance: ProvenanceEntry | undefined;
  singleError: string | null;
  setSingleError: (e: string | null) => void;
  singleLoading: boolean;

  // Community state
  ecoliGlucose: number;
  setEcoliGlucose: (v: number) => void;
  ecoliOxygen: number;
  setEcoliOxygen: (v: number) => void;
  ecoliKO: string[];
  setEcoliKO: React.Dispatch<React.SetStateAction<string[]>>;
  yeastGlucose: number;
  setYeastGlucose: (v: number) => void;
  yeastOxygen: number;
  setYeastOxygen: (v: number) => void;
  yeastKO: string[];
  setYeastKO: React.Dispatch<React.SetStateAction<string[]>>;
  communityResult: CommunityFBAOutput;
  communityRunProvenance: ProvenanceEntry | undefined;
  communityError: string | null;
  setCommunityError: (e: string | null) => void;
  communityLoading: boolean;

  // Strain Design state
  fseofResult: FSEOFResultType | null;
  setFseofResult: (r: FSEOFResultType | null) => void;
  optknockResult: OptKnockResultType | null;
  setOptknockResult: (r: OptKnockResultType | null) => void;
  strainDesignLoading: boolean;
  strainDesignError: string | null;
  setStrainDesignError: (e: string | null) => void;
  pipelineResult: PipelineResult | null;
  pipelineLoading: boolean;
  pipelineError: string | null;
  setPipelineLoading: (v: boolean) => void;
  setPipelineResult: (r: PipelineResult | null) => void;
  setPipelineError: (e: string | null) => void;

  // Seed / notice
  recommendedSeed: ReturnType<typeof buildFBASeed>;
  seedOverwriteNotice: string | null;
  setSeedOverwriteNotice: (n: string | null) => void;
  lastAppliedSeedRef: React.MutableRefObject<string | null>;

  // Tab
  activeTab: string;
  setActiveTab: (t: string) => void;

  // BiGG model selector
  biggModels: BiGGModel[];
  biggResult: FallbackResult<BiGGModel[]> | null;
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  biggLoading: boolean;
  loadedReactions: BiGGReaction[] | null;
  loadedObjectiveId: string;
  modelLoading: boolean;
  handleLoadModel: () => void;

  // Handlers
  toggleKO: (id: string) => void;
  toggleEcoliKO: (id: string) => void;
  toggleYeastKO: (id: string) => void;
  handleRunFSEOF: () => Promise<void>;
  handleRunOptKnock: () => Promise<void>;
  handleRunPipeline: () => Promise<void>;
  handleSendToProEvol: () => void;

  // Derived
  top5: Array<{ id: string; name: string; flux: number }>;
  maxTopFlux: number;
  figureMeta: { eyebrow: string; title: string; caption: string };
  exportData: FBAOutput | CommunityFBAOutput;
  defaultStrainReactions: Array<{ id: string; lb: number; ub: number; stoichiometry: Record<string, number> }>;
}

export function useFBASimState(): FBASimState {
  const [simMode, setSimMode] = useState<SimMode>("single");
  const chartRef = useRef<SVGSVGElement>(null);
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const pathdPayload = useWorkbenchStore((s) => s.toolPayloads.pathd);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);

  // Single-species state (persisted)
  const [glucoseUptake, setGlucoseUptake] = usePersistedState("nexus-bio:fba:glucose", 10);
  const [oxygenUptake, setOxygenUptake] = usePersistedState("nexus-bio:fba:oxygen", 12);
  const [objective, setObjective] = useState<"biomass" | "atp" | "product">("biomass");
  const [knockouts, setKnockouts] = useState<string[]>([]);

  // Community state (persisted)
  const [ecoliGlucose, setEcoliGlucose] = usePersistedState("nexus-bio:fba:ecoli-glucose", 10);
  const [ecoliOxygen, setEcoliOxygen] = usePersistedState("nexus-bio:fba:ecoli-oxygen", 12);
  const [ecoliKO, setEcoliKO] = useState<string[]>([]);
  const [yeastGlucose, setYeastGlucose] = usePersistedState("nexus-bio:fba:yeast-glucose", 8);
  const [yeastOxygen, setYeastOxygen] = usePersistedState("nexus-bio:fba:yeast-oxygen", 6);
  const [yeastKO, setYeastKO] = useState<string[]>([]);
  const [singleResult, setSingleResult] = useState<FBAOutput>(() => createEmptyFBAOutput());
  const [singleRunProvenance, setSingleRunProvenance] = useState<ProvenanceEntry | undefined>(undefined);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleLoading, setSingleLoading] = useState(true);
  const [communityResult, setCommunityResult] = useState<CommunityFBAOutput>(() => createEmptyCommunityOutput());
  const [communityRunProvenance, setCommunityRunProvenance] = useState<ProvenanceEntry | undefined>(undefined);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [communityLoading, setCommunityLoading] = useState(true);

  // Strain Design state (FSEOF + OptKnock)
  const [fseofResult, setFseofResult] = useState<FSEOFResultType | null>(null);
  const [optknockResult, setOptknockResult] = useState<OptKnockResultType | null>(null);
  const [strainDesignLoading, setStrainDesignLoading] = useState(false);
  const [strainDesignError, setStrainDesignError] = useState<string | null>(null);

  // Strain Design Pipeline state
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const recommendedSeed = useMemo(
    () => buildFBASeed(project, analyzeArtifact, dbtlPayload, pathdPayload),
    [
      analyzeArtifact?.generatedAt,
      analyzeArtifact?.id,
      dbtlPayload?.feedbackSource,
      dbtlPayload?.result.improvementRate,
      dbtlPayload?.result.latestPhase,
      dbtlPayload?.result.passRate,
      dbtlPayload?.updatedAt,
      pathdPayload?.updatedAt,
      project?.id,
      project?.updatedAt,
    ],
  );

  // P1.2: track the seed signature that was last applied
  const seedSignature = useMemo(
    () =>
      `${recommendedSeed.mode}|${recommendedSeed.objective}|${recommendedSeed.glucoseUptake}|${recommendedSeed.oxygenUptake}|${recommendedSeed.knockouts.join(",")}`,
    [
      recommendedSeed.glucoseUptake,
      recommendedSeed.knockouts,
      recommendedSeed.mode,
      recommendedSeed.objective,
      recommendedSeed.oxygenUptake,
    ],
  );
  const lastAppliedSeedRef = useRef<string | null>(null);
  const lastExpectedRef = useRef<{ eg: number; eo: number; yg: number; yo: number } | null>(null);
  const [seedOverwriteNotice, setSeedOverwriteNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("flux");

  // BiGG model selector state
  const [biggModels, setBiggModels] = useState<BiGGModel[]>([]);
  const [biggResult, setBiggResult] = useState<FallbackResult<BiGGModel[]> | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("e_coli_core");
  const [biggLoading, setBiggLoading] = useState(false);
  const [loadedReactions, setLoadedReactions] = useState<BiGGReaction[] | null>(null);
  const [loadedObjectiveId, setLoadedObjectiveId] = useState<string>("BIOMASS");
  const [modelLoading, setModelLoading] = useState(false);

  // ── Effects ─────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setBiggLoading(true);
    listBiGGModels()
      .then((result) => {
        if (cancelled) return;
        setBiggResult(result);
        setBiggModels(result.data);
        if (result.data.length > 0 && !result.data.find((m) => m.bigg_id === selectedModel)) {
          setSelectedModel(result.data[0].bigg_id);
        }
      })
      .finally(() => {
        if (!cancelled) setBiggLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-load default BiGG model on mount instead of falling back to legacy network
  useEffect(() => {
    if (selectedModel && !loadedReactions && !modelLoading && biggModels.length > 0) {
      handleLoadModel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel, biggModels.length]);

  useEffect(() => {
    if (lastAppliedSeedRef.current === seedSignature) return;

    const expectedEcoliGlc = Math.max(3, round(recommendedSeed.glucoseUptake * 0.58));
    const expectedEcoliO2 = Math.max(3, round(recommendedSeed.oxygenUptake * 0.65));
    const expectedYeastGlc = Math.max(2, round(recommendedSeed.glucoseUptake * 0.42));
    const expectedYeastO2 = Math.max(2, round(recommendedSeed.oxygenUptake * 0.45));

    if (lastAppliedSeedRef.current !== null && lastExpectedRef.current !== null) {
      const prev = lastExpectedRef.current;
      const localDiverged =
        ecoliGlucose !== prev.eg || ecoliOxygen !== prev.eo || yeastGlucose !== prev.yg || yeastOxygen !== prev.yo;
      if (localDiverged) {
        setSeedOverwriteNotice(
          'Upstream seed changed but your manual edits are preserved. Click "Apply seed" to accept the new upstream values, or ignore to keep your edits.',
        );
        lastAppliedSeedRef.current = seedSignature;
        lastExpectedRef.current = {
          eg: expectedEcoliGlc,
          eo: expectedEcoliO2,
          yg: expectedYeastGlc,
          yo: expectedYeastO2,
        };
        return;
      }
    }

    setSimMode(recommendedSeed.mode);
    setObjective(recommendedSeed.objective);
    setGlucoseUptake(recommendedSeed.glucoseUptake);
    setOxygenUptake(recommendedSeed.oxygenUptake);
    setKnockouts(recommendedSeed.knockouts);
    setEcoliGlucose(expectedEcoliGlc);
    setEcoliOxygen(expectedEcoliO2);
    setYeastGlucose(expectedYeastGlc);
    setYeastOxygen(expectedYeastO2);
    setEcoliKO(recommendedSeed.knockouts.slice(0, 1));
    setYeastKO(recommendedSeed.knockouts.slice(1));
    lastAppliedSeedRef.current = seedSignature;
    lastExpectedRef.current = { eg: expectedEcoliGlc, eo: expectedEcoliO2, yg: expectedYeastGlc, yo: expectedYeastO2 };
  }, [
    seedSignature,
    recommendedSeed.glucoseUptake,
    recommendedSeed.knockouts,
    recommendedSeed.mode,
    recommendedSeed.objective,
    recommendedSeed.oxygenUptake,
    ecoliGlucose,
    ecoliOxygen,
    yeastGlucose,
    yeastOxygen,
    setEcoliGlucose,
    setEcoliOxygen,
    setGlucoseUptake,
    setOxygenUptake,
    setObjective,
    setYeastGlucose,
    setYeastOxygen,
  ]);

  useEffect(() => {
    if (loadedReactions) return;
    const controller = new AbortController();
    setSingleLoading(true);
    setSingleError(null);

    solveAuthorityFBAWithProvenance({ objective, glucoseUptake, oxygenUptake, knockouts }, controller.signal)
      .then(({ result, provenance }) => {
        setSingleResult(result);
        setSingleRunProvenance(provenance);
        setSingleError(null);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setSingleResult(createEmptyFBAOutput());
        setSingleRunProvenance(undefined);
        setSingleError(error instanceof Error ? error.message : "Authoritative FBA solve failed");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSingleLoading(false);
        }
      });

    return () => controller.abort();
  }, [glucoseUptake, knockouts, loadedReactions, objective, oxygenUptake]);

  useEffect(() => {
    if (!loadedReactions || loadedReactions.length === 0) return;
    const controller = new AbortController();
    setSingleLoading(true);
    setSingleError(null);

    solveDynamicModelFBA(
      {
        reactions: loadedReactions,
        objectiveId: loadedObjectiveId,
        glucoseUptake,
        oxygenUptake,
        knockouts,
      },
      controller.signal,
    )
      .then(({ result, provenance }) => {
        setSingleResult(result);
        setSingleRunProvenance(provenance);
        setSingleError(null);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setSingleResult(createEmptyFBAOutput());
        setSingleRunProvenance(undefined);
        setSingleError(error instanceof Error ? error.message : "BiGG model FBA solve failed");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSingleLoading(false);
        }
      });

    return () => controller.abort();
  }, [loadedReactions, loadedObjectiveId, glucoseUptake, knockouts, oxygenUptake]);

  useEffect(() => {
    const controller = new AbortController();
    setCommunityLoading(true);
    setCommunityError(null);

    solveAuthorityCommunityFBAWithProvenance(
      {
        objective,
        ecoli: { glucoseUptake: ecoliGlucose, oxygenUptake: ecoliOxygen, knockouts: ecoliKO },
        yeast: { glucoseUptake: yeastGlucose, oxygenUptake: yeastOxygen, knockouts: yeastKO },
      },
      controller.signal,
    )
      .then(({ result, provenance }) => {
        setCommunityResult(result);
        setCommunityRunProvenance(provenance);
        setCommunityError(null);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setCommunityResult(createEmptyCommunityOutput());
        setCommunityRunProvenance(undefined);
        setCommunityError(error instanceof Error ? error.message : "Authority-backed two-species demo failed");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCommunityLoading(false);
        }
      });

    return () => controller.abort();
  }, [ecoliGlucose, ecoliKO, ecoliOxygen, objective, yeastGlucose, yeastKO, yeastOxygen]);

  const top5 = useMemo(() => {
    return REACTION_DEFS.map((r) => ({ ...r, flux: singleResult.fluxes[r.id] ?? 0 }))
      .sort((a, b) => Math.abs(b.flux) - Math.abs(a.flux))
      .slice(0, 5);
  }, [singleResult]);

  const maxTopFlux = Math.abs(top5[0]?.flux ?? 1) || 1;

  const figureMeta = useMemo(() => {
    if (simMode === "single") {
      return {
        eyebrow: "Figure A · Host Flux State",
        title: "Constraint-resolved flux map for the active host context",
        caption:
          "The central flux map is framed as a model figure: objective, uptake limits, and sensitivity-coefficient interpretation are treated as part of the same scientific panel.",
      };
    }
    return {
      eyebrow: "Figure B · Two-Species Demo Exchange",
      title: "Independent host solves with illustrative exchange",
      caption:
        "Two-species demo mode becomes a comparative figure where strain-specific optima and post-hoc exchange-like values are read together without claiming shared-pool stoichiometric coupling.",
    };
  }, [simMode]);

  // ── Handlers ─────────────────────────────────────────────────────────

  const toggleKO = useCallback((id: string) => {
    setKnockouts((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));
  }, []);

  const toggleEcoliKO = useCallback((id: string) => {
    setEcoliKO((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));
  }, []);

  const toggleYeastKO = useCallback((id: string) => {
    setYeastKO((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));
  }, []);

  const handleLoadModel = useCallback(() => {
    if (modelLoading || !selectedModel) return;
    setModelLoading(true);
    setLoadedReactions(null);
    setSingleError(null);
    getModelReactions(selectedModel)
      .then((result) => {
        if (result.data.reactions.length > 0) {
          setLoadedReactions(result.data.reactions);
          const bioRxn = result.data.reactions.find(
            (r) => r.id.toLowerCase().includes("biomass") || r.name.toLowerCase().includes("biomass"),
          );
          setLoadedObjectiveId(bioRxn?.id ?? result.data.reactions[0].id);
        }
      })
      .catch((err) => {
        setLoadedReactions(null);
        setSingleError(`Failed to load model: ${err instanceof Error ? err.message : String(err)}`);
      })
      .finally(() => {
        setModelLoading(false);
      });
  }, [modelLoading, selectedModel]);

  const defaultStrainReactions = useMemo(
    () =>
      BASE_REACTIONS.map((r) => ({
        id: r.id,
        lb: r.lb,
        ub: r.ub,
        stoichiometry: {} as Record<string, number>,
      })),
    [],
  );

  const handleRunFSEOF = useCallback(async () => {
    setStrainDesignLoading(true);
    try {
      const reactions = loadedReactions ?? defaultStrainReactions;
      const result = await solveFSEOF({
        reactions: reactions.map((r) => ({ id: r.id, lb: r.lb, ub: r.ub, stoichiometry: r.stoichiometry })),
        objectiveId: loadedObjectiveId || "BIOMASS",
        productReactionId: "PRODUCT",
      });
      setFseofResult(result.result as FSEOFResultType);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "FSEOF analysis failed";
      setStrainDesignError(msg);
    } finally {
      setStrainDesignLoading(false);
    }
  }, [defaultStrainReactions, loadedObjectiveId, loadedReactions]);

  const handleRunOptKnock = useCallback(async () => {
    setStrainDesignLoading(true);
    try {
      const reactions = loadedReactions ?? defaultStrainReactions;
      const result = await solveOptKnock({
        reactions: reactions.map((r) => ({ id: r.id, lb: r.lb, ub: r.ub, stoichiometry: r.stoichiometry })),
        objectiveId: loadedObjectiveId || "BIOMASS",
        productReactionId: "PRODUCT",
        maxKnockouts: 3,
      });
      setOptknockResult(result.result as OptKnockResultType);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OptKnock analysis failed";
      setStrainDesignError(msg);
    } finally {
      setStrainDesignLoading(false);
    }
  }, [defaultStrainReactions, loadedObjectiveId, loadedReactions]);

  const handleRunPipeline = useCallback(async () => {
    setPipelineLoading(true);
    setPipelineError(null);
    try {
      const res = await fetch("/api/pipeline/fbasim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          species: "ecoli",
          objective,
          glucoseUptake,
          oxygenUptake,
          knockouts,
          maxKnockouts: 3,
          growthFractionConstraint: 0.1,
        }),
      });
      if (!res.ok) throw new Error(`Pipeline failed (${res.status})`);
      const data = await res.json();
      setPipelineResult(data.result);
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : "Pipeline failed");
    } finally {
      setPipelineLoading(false);
    }
  }, [glucoseUptake, knockouts, objective, oxygenUptake]);

  const handleSendToProEvol = useCallback(() => {
    if (!pipelineResult?.bestDesign) return;
    localStorage.setItem(
      "nexus-bio:fbasim-to-proevol",
      JSON.stringify({
        targetReaction: pipelineResult.bestDesign.strategy.knockouts[0] ?? "PRODUCT",
        knockouts: pipelineResult.bestDesign.strategy.knockouts,
      }),
    );
    window.location.href = "/tools/proevol";
  }, [pipelineResult]);

  const exportData = simMode === "single" ? singleResult : communityResult;

  // ── Console logging ───────────────────────────────────────────────────
  const appendConsole = useUIStore((s) => s.appendConsole);
  useEffect(() => {
    if ((simMode === "single" && singleLoading) || (simMode === "community" && communityLoading)) {
      return;
    }
    const error = simMode === "single" ? singleError : communityError;
    if (error) {
      appendConsole({ level: "error", module: "FBASIM", message: `FBA error: ${error}` });
    } else if (simMode === "single") {
      appendConsole({
        level: "info",
        module: "FBASIM",
        message: `FBA complete — μ=${singleResult.growthRate.toFixed(4)} h⁻¹ | ATP=${singleResult.atpYield.toFixed(1)} mol/mol | C-eff=${singleResult.carbonEfficiency.toFixed(1)}% | KO=[${knockouts.join(",") || "none"}]`,
      });
    } else {
      appendConsole({
        level: "info",
        module: "FBASIM",
        message: `Two-species heuristic demo — E.coli μ=${communityResult.ecoli.growthRate.toFixed(4)} | Yeast μ=${communityResult.yeast.growthRate.toFixed(4)} | blended μ=${communityResult.communityGrowthRate.toFixed(4)}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appendConsole,
    communityError,
    communityLoading,
    communityResult,
    simMode,
    singleError,
    singleLoading,
    singleResult,
  ]);

  useEffect(() => {
    const now = Date.now();
    const activeResult =
      simMode === "single"
        ? singleResult
        : {
            fluxes: communityResult.ecoli.fluxes,
            growthRate: communityResult.communityGrowthRate,
            atpYield: (communityResult.ecoli.atpYield + communityResult.yeast.atpYield) / 2,
            nadhProduction: (communityResult.ecoli.nadhProduction + communityResult.yeast.nadhProduction) / 2,
            carbonEfficiency: (communityResult.ecoli.carbonEfficiency + communityResult.yeast.carbonEfficiency) / 2,
            feasible: communityResult.feasible,
            sensitivityCoefficients: {
              glc:
                (communityResult.ecoli.sensitivityCoefficients.glc +
                  communityResult.yeast.sensitivityCoefficients.glc) /
                2,
              o2:
                (communityResult.ecoli.sensitivityCoefficients.o2 + communityResult.yeast.sensitivityCoefficients.o2) /
                2,
              atp:
                (communityResult.ecoli.sensitivityCoefficients.atp +
                  communityResult.yeast.sensitivityCoefficients.atp) /
                2,
            },
          };

    if (singleLoading || communityLoading) return;
    if (singleError && simMode === "single") return;
    if (communityError && simMode === "community") return;

    setToolPayload("fbasim", {
      validity: simMode === "single" ? "partial" : "demo",
      runProvenance: simMode === "single" ? singleRunProvenance : communityRunProvenance,
      toolId: "fbasim",
      targetProduct: recommendedSeed.targetProduct,
      pathwayFocus: recommendedSeed.pathwayFocus,
      sourceArtifactId: analyzeArtifact?.id,
      mode: simMode,
      objective,
      glucoseUptake,
      oxygenUptake,
      knockouts,
      result: {
        growthRate: activeResult.growthRate,
        atpYield: activeResult.atpYield,
        nadhProduction: activeResult.nadhProduction,
        carbonEfficiency: activeResult.carbonEfficiency,
        feasible: activeResult.feasible,
        sensitivityCoefficients: activeResult.sensitivityCoefficients,
        topFluxes: Object.entries(activeResult.fluxes)
          .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
          .slice(0, 5)
          .map(([reactionId, flux]) => ({ reactionId, flux })),
      },
      updatedAt: now,
    });

    // Store artifact for inter-tool data flow
    const fbaArtifact: FBAArtifact = {
      type: "fba",
      species: "ecoli",
      objective,
      fluxes: activeResult.fluxes,
      shadowPrices: activeResult.sensitivityCoefficients ?? {},
      growthRate: activeResult.growthRate,
      atpYield: activeResult.atpYield,
      carbonEfficiency: activeResult.carbonEfficiency,
      feasible: activeResult.feasible,
      bottleneckReactions: Object.entries(activeResult.fluxes)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 5)
        .map(([id, flux]) => ({ id, flux, shadowPrice: 0 })),
      knockouts,
      timestamp: now,
    };
    useArtifactStore.getState().setFBA(fbaArtifact);
  }, [
    analyzeArtifact?.id,
    communityLoading,
    communityError,
    communityRunProvenance,
    communityResult,
    glucoseUptake,
    knockouts,
    objective,
    oxygenUptake,
    recommendedSeed.pathwayFocus,
    recommendedSeed.targetProduct,
    setToolPayload,
    simMode,
    singleLoading,
    singleError,
    singleResult,
    singleRunProvenance,
  ]);

  return {
    simMode,
    setSimMode,
    chartRef,
    glucoseUptake,
    setGlucoseUptake,
    oxygenUptake,
    setOxygenUptake,
    objective,
    setObjective,
    knockouts,
    setKnockouts,
    singleResult,
    singleRunProvenance,
    singleError,
    setSingleError,
    singleLoading,
    ecoliGlucose,
    setEcoliGlucose,
    ecoliOxygen,
    setEcoliOxygen,
    ecoliKO,
    setEcoliKO,
    yeastGlucose,
    setYeastGlucose,
    yeastOxygen,
    setYeastOxygen,
    yeastKO,
    setYeastKO,
    communityResult,
    communityRunProvenance,
    communityError,
    setCommunityError,
    communityLoading,
    fseofResult,
    setFseofResult,
    optknockResult,
    setOptknockResult,
    strainDesignLoading,
    strainDesignError,
    setStrainDesignError,
    pipelineResult,
    setPipelineResult,
    pipelineLoading,
    setPipelineLoading,
    pipelineError,
    setPipelineError,
    recommendedSeed,
    seedOverwriteNotice,
    setSeedOverwriteNotice,
    lastAppliedSeedRef,
    activeTab,
    setActiveTab,
    biggModels,
    biggResult,
    selectedModel,
    setSelectedModel,
    biggLoading,
    loadedReactions,
    loadedObjectiveId,
    modelLoading,
    handleLoadModel,
    toggleKO,
    toggleEcoliKO,
    toggleYeastKO,
    handleRunFSEOF,
    handleRunOptKnock,
    handleRunPipeline,
    handleSendToProEvol,
    top5,
    maxTopFlux,
    figureMeta,
    exportData,
    defaultStrainReactions,
  };
}
