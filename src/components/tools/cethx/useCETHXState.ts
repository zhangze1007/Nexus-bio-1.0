"use client";
/**
 * useCETHXState — Custom hook encapsulating all CETHX state, effects, and derived computations.
 * Extracted from CETHXPage.tsx for modularity.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PathwayKey } from "../../../data/mockCETHX";
import { computeThermo, PATHWAY_STEPS } from "../../../data/mockCETHX";
import { computeDGAtConditions, getPrecomputedDGMap, PHYSIOLOGICAL } from "../../../data/precomputedDG";
import { KEGG_REACTIONS } from "../../../hooks/useEquilibrator";
import type { TFAReaction, TFAResult } from "../../../server/tfaEngine";
import { runTFA } from "../../../server/tfaEngine";
import type { PubChemCompound } from "../../../services/database/pubchemClient";
import { searchPubChemCompound } from "../../../services/database/pubchemClient";
import { calcTransformedGibbs, calcTransformedKeq } from "../../../services/thermoEngine";
import { useUIStore } from "../../../store/uiStore";
import type { WorkbenchState } from "../../../store/workbenchStore";
import { useWorkbenchStore } from "../../../store/workbenchStore";
import type { ThermoStep } from "../../../types";
import type { ProvenanceEntry } from "../../../types/assumptions";
import { createProvenanceEntry } from "../../../utils/provenance";
import { buildCETHXSeed } from "../shared/workbenchDataflow";
import type { StepFeasibility } from "./sharedComponents";
import {
  classifyFeasibility,
  FEASIBILITY_TONE,
  GLYCOLYSIS_TFA_REACTIONS,
  STEP_PROTON_STOICH,
} from "./sharedComponents";

// ── Thermo result type ──────────────────────────────────────────────────
export interface CETHXThermoResult {
  steps: Array<ReturnType<typeof computeThermo>["steps"][number] & { cumulative: number; uncertainty?: number }>;
  atp_yield: number;
  nadh_yield: number;
  entropy_production: number;
  dissipation_kJ_per_mol: number;
  gibbs_free_energy: number;
  efficiency: number;
}

// ── Feasibility result type ─────────────────────────────────────────────
export interface CETHXFeasibilityResult {
  stepResults: Array<{
    step: string;
    deltaG: number;
    feasibility: StepFeasibility;
    tone: "cool" | "neutral" | "warm";
    keq: number;
  }>;
  feasibleCount: number;
  marginalCount: number;
  infeasibleCount: number;
  overallFeasible: boolean;
}

// ── Pipeline result type ────────────────────────────────────────────────
export interface CETHXPipelineResult {
  totalDeltaG: number;
  atpYield: number;
  nadhYield: number;
  efficiency: number;
  feasible: boolean;
  limitingStep: string;
  bottlenecks: string[];
}

// ── Hook return type ────────────────────────────────────────────────────
export interface CETHXState {
  // Pathway selection
  pathway: PathwayKey;
  setPathway: (p: PathwayKey) => void;
  // Conditions
  tempC: number;
  setTempC: (t: number) => void;
  pH: number;
  setPH: (p: number) => void;
  // Equilibrator
  equilibratorData: Map<string, { dG_prime: number; dG_prime_uncertainty: number }>;
  isRealData: boolean;
  equilibratorLoaded: boolean;
  isLoadingEquilibrator: boolean;
  setIsEquilibratorData: (d: Map<string, { dG_prime: number; dG_prime_uncertainty: number }>) => void;
  setIsRealData: (b: boolean) => void;
  setIsLoadingEquilibrator: (b: boolean) => void;
  // PubChem
  compoundQuery: string;
  setCompoundQuery: (q: string) => void;
  pubchemData: PubChemCompound | null;
  pubchemSource: "live" | "mock";
  pubchemLoading: boolean;
  handleCompoundSearch: () => Promise<void>;
  // Custom thermo data upload
  customThermoData: Array<{ reaction: string; deltaG: number; keq?: number }> | null;
  setCustomThermoData: (d: Array<{ reaction: string; deltaG: number; keq?: number }> | null) => void;
  customThermoHeaders: string[];
  setCustomThermoHeaders: (h: string[]) => void;
  customThermoRows: Record<string, string>[];
  setCustomThermoRows: (r: Record<string, string>[]) => void;
  customThermoError: string | null;
  setCustomThermoError: (e: string | null) => void;
  // Active tab
  activeTab: string;
  setActiveTab: (t: string) => void;
  // Pipeline
  pipelineResult: CETHXPipelineResult | null;
  setPipelineResult: (r: CETHXPipelineResult | null) => void;
  pipelineLoading: boolean;
  setPipelineLoading: (b: boolean) => void;
  pipelineError: string | null;
  setPipelineError: (e: string | null) => void;
  // TFA
  tfaReactions: TFAReaction[];
  setTfaReactions: (r: TFAReaction[]) => void;
  tfaResult: TFAResult | null;
  setTfaResult: (r: TFAResult | null) => void;
  handleRunTFA: () => void;
  // Derived
  thermo: CETHXThermoResult;
  limitingStep: string | null;
  feasibilityData: CETHXFeasibilityResult;
  // Upstream data
  fba: WorkbenchState["toolPayloads"]["fbasim"];
  // Equilibrator retry
  retryEquilibrator: () => void;
}

export default function useCETHXState(): CETHXState {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const pathdPayload = useWorkbenchStore((s) => s.toolPayloads.pathd);
  const fbaPayload = useWorkbenchStore((s) => s.toolPayloads.fbasim);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);

  const [pathway, setPathway] = useState<PathwayKey>("glycolysis");
  const [tempC, setTempC] = useState(37);
  const [pH, setPH] = useState(7.4);
  const [equilibratorData, setEquilibratorData] = useState<
    Map<string, { dG_prime: number; dG_prime_uncertainty: number }>
  >(new Map());
  const [isRealData, setIsRealData] = useState(false);
  const [equilibratorLoaded, setEquilibratorLoaded] = useState(false);
  const [isLoadingEquilibrator, setIsLoadingEquilibrator] = useState(false);

  // PubChem compound lookup
  const [compoundQuery, setCompoundQuery] = useState("");
  const [pubchemData, setPubchemData] = useState<PubChemCompound | null>(null);
  const [pubchemSource, setPubchemSource] = useState<"live" | "mock">("mock");
  const [pubchemLoading, setPubchemLoading] = useState(false);

  // Custom thermodynamic data upload
  const [customThermoData, setCustomThermoData] = useState<Array<{
    reaction: string;
    deltaG: number;
    keq?: number;
  }> | null>(null);
  const [customThermoHeaders, setCustomThermoHeaders] = useState<string[]>([]);
  const [customThermoRows, setCustomThermoRows] = useState<Record<string, string>[]>([]);
  const [customThermoError, setCustomThermoError] = useState<string | null>(null);

  const recommendedSeed = useMemo(
    () => buildCETHXSeed(project, analyzeArtifact, fbaPayload, pathdPayload),
    [
      analyzeArtifact?.generatedAt,
      analyzeArtifact?.id,
      fbaPayload?.updatedAt,
      pathdPayload?.updatedAt,
      project?.id,
      project?.updatedAt,
    ],
  );

  // Seed signature guard: only re-apply when seed values actually change
  const seedSignature = useMemo(
    () => `${recommendedSeed.pathway}|${recommendedSeed.tempC}|${recommendedSeed.pH}`,
    [recommendedSeed.pathway, recommendedSeed.tempC, recommendedSeed.pH],
  );
  const lastAppliedSeedRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastAppliedSeedRef.current === seedSignature) return;
    setPathway(recommendedSeed.pathway);
    setTempC(recommendedSeed.tempC);
    setPH(recommendedSeed.pH);
    lastAppliedSeedRef.current = seedSignature;
  }, [seedSignature, recommendedSeed.pathway, recommendedSeed.tempC, recommendedSeed.pH]);

  // Shared eQuilibrator fetch logic
  const fetchEquilibrator = useCallback((currentPathway: PathwayKey, currentPH: number, currentTempC: number) => {
    const reactions = KEGG_REACTIONS[currentPathway];
    if (!reactions) return;

    setIsLoadingEquilibrator(true);
    const newData = new Map<string, { dG_prime: number; dG_prime_uncertainty: number }>();

    const fetchAll = async () => {
      try {
        const promises = Object.entries(reactions).map(async ([stepName, formula]) => {
          try {
            const response = await fetch("/api/equilibrator", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reaction: formula,
                pH: currentPH,
                temperature: currentTempC + 273.15,
                ionic_strength: 0.25,
              }),
            });

            if (response.ok) {
              const result = await response.json();
              if (!result.error && result.dG_prime !== undefined) {
                newData.set(stepName, {
                  dG_prime: result.dG_prime,
                  dG_prime_uncertainty: result.dG_prime_uncertainty || 0,
                });
              }
            }
          } catch {
            // Individual reaction failed - skip
          }
        });

        await Promise.allSettled(promises);

        // Only upgrade if eQuilibrator returned data for all steps
        if (newData.size >= Object.keys(reactions).length) {
          setEquilibratorData(newData);
          setIsRealData(true);
          setEquilibratorLoaded(true);
        }
        // Otherwise keep the pre-computed data (already set above)
      } catch {
        // eQuilibrator unavailable — pre-computed data remains active
      } finally {
        setIsLoadingEquilibrator(false);
      }
    };

    fetchAll();
  }, []);

  // Load pre-computed ΔG data immediately (published reference values),
  // then attempt eQuilibrator sidecar in background for potential upgrade.
  useEffect(() => {
    // Step 1: Immediately load pre-computed data from published references
    const isPhysiological =
      Math.abs(pH - PHYSIOLOGICAL.pH) < 0.05 && Math.abs(tempC - PHYSIOLOGICAL.temperature_C) < 0.5;

    const precomputedMap = isPhysiological
      ? getPrecomputedDGMap(pathway)
      : computeDGAtConditions(pathway, pH, tempC, 0.25);

    if (precomputedMap.size > 0) {
      setEquilibratorData(precomputedMap);
      setIsRealData(true);
      setEquilibratorLoaded(false);
    }

    // Step 2: Try eQuilibrator sidecar in background for real-time data
    fetchEquilibrator(pathway, pH, tempC);
  }, [pathway, tempC, pH, fetchEquilibrator]);

  // PubChem compound lookup handler
  const handleCompoundSearch = useCallback(async () => {
    if (!compoundQuery.trim()) return;
    setPubchemLoading(true);
    try {
      const result = await searchPubChemCompound(compoundQuery.trim());
      setPubchemData(result.data);
      setPubchemSource(result.source);
    } finally {
      setPubchemLoading(false);
    }
  }, [compoundQuery]);

  // Compute thermo with eQuilibrator data when available,
  // otherwise apply Alberty transform via calcTransformedGibbs from thermoEngine.
  const thermo = useMemo(() => {
    const T = tempC + 273.15;
    const ionicStrength = 0.25; // physiological ionic strength (M)

    let stepsWithCumulative: CETHXThermoResult["steps"];
    let totalDeltaG: number;

    // Source 1: eQuilibrator API data (best)
    if (isRealData && equilibratorData.size > 0) {
      const baseThermo = computeThermo(PATHWAY_STEPS[pathway], tempC, pH);
      const mergedSteps = baseThermo.steps.map((step) => {
        const realData = equilibratorData.get(step.step);
        if (realData) {
          return { ...step, deltaG: realData.dG_prime, uncertainty: realData.dG_prime_uncertainty };
        }
        return step;
      });

      // Apply custom thermo data overrides
      const customOverrides = customThermoData ? new Map(customThermoData.map((d) => [d.reaction, d])) : null;
      const overriddenSteps = customOverrides
        ? mergedSteps.map((step) => {
            const custom = customOverrides.get(step.step);
            return custom ? { ...step, deltaG: custom.deltaG } : step;
          })
        : mergedSteps;

      let cum = 0;
      stepsWithCumulative = overriddenSteps.map((step) => {
        cum += step.deltaG;
        return { ...step, cumulative: cum };
      });
      totalDeltaG = cum;
    } else {
      // Source 2: Alberty-transformed reference ΔG° via calcTransformedGibbs (local real calculation)
      const refSteps = PATHWAY_STEPS[pathway];
      const stoich = STEP_PROTON_STOICH[pathway];

      const transformedSteps = refSteps.map((refStep, i) => {
        const { nH, dz2 } = stoich?.[i] ?? { nH: 0, dz2: 0 };
        const transformedDG = calcTransformedGibbs(refStep.deltaG, pH, ionicStrength, T, nH, dz2);
        return { ...refStep, deltaG: transformedDG, uncertainty: Math.abs(transformedDG) * 0.15 };
      });

      // Apply custom thermo data overrides
      const customOverrides = customThermoData ? new Map(customThermoData.map((d) => [d.reaction, d])) : null;
      const overriddenSteps = customOverrides
        ? transformedSteps.map((step) => {
            const custom = customOverrides.get(step.step);
            return custom ? { ...step, deltaG: custom.deltaG } : step;
          })
        : transformedSteps;

      let cum = 0;
      stepsWithCumulative = overriddenSteps.map((step) => {
        cum += step.deltaG;
        return { ...step, cumulative: cum };
      });
      totalDeltaG = cum;
    }

    const atpNet = stepsWithCumulative.reduce((a, s) => a + s.atpYield, 0);
    const nadhYield = stepsWithCumulative.reduce((a, s) => a + (s.nadhYield ?? 0), 0);
    const dissipationKJ = -totalDeltaG;
    const entropyChange = dissipationKJ / T;
    const efficiency = Math.max(0, Math.min(100, (-totalDeltaG / 2870) * 100));
    return {
      steps: stepsWithCumulative,
      atp_yield: atpNet,
      nadh_yield: nadhYield,
      entropy_production: entropyChange,
      dissipation_kJ_per_mol: dissipationKJ,
      gibbs_free_energy: totalDeltaG,
      efficiency,
    };
  }, [pathway, tempC, pH, isRealData, equilibratorData, customThermoData]);

  const limitingStep = useMemo(
    () => [...thermo.steps].sort((left, right) => right.deltaG - left.deltaG)[0]?.step ?? null,
    [thermo.steps],
  );

  // Per-step feasibility classification using the transformed ΔG values
  const feasibilityData = useMemo(() => {
    const stepResults = thermo.steps.map((s) => ({
      step: s.step,
      deltaG: s.deltaG,
      feasibility: classifyFeasibility(s.deltaG),
      tone: FEASIBILITY_TONE[classifyFeasibility(s.deltaG)],
      keq: calcTransformedKeq(s.deltaG, tempC + 273.15),
    }));
    const feasibleCount = stepResults.filter((r) => r.feasibility === "feasible").length;
    const marginalCount = stepResults.filter((r) => r.feasibility === "marginal").length;
    const infeasibleCount = stepResults.filter((r) => r.feasibility === "infeasible").length;
    const overallFeasible = infeasibleCount === 0;
    return { stepResults, feasibleCount, marginalCount, infeasibleCount, overallFeasible };
  }, [thermo.steps, tempC]);

  // Workbench payload sync
  useEffect(() => {
    const now = Date.now();
    const upstreamProvenance = [fbaPayload?.runProvenance, pathdPayload?.runProvenance]
      .filter((entry): entry is ProvenanceEntry => Boolean(entry))
      .map((entry) => `${entry.toolId}:${entry.timestamp}`);

    const assumptions = equilibratorLoaded
      ? [
          "cethx.equilibrator_backend",
          "cethx.alberty_transform",
          "cethx.condition_aware",
          "cethx.uncertainty_calculated",
        ]
      : [
          "cethx.precomputed_reference_data",
          "cethx.alberty_transform",
          "cethx.condition_aware_ph_ionic",
          "cethx.uncertainty_estimated",
          "cethx.lehninger_reference_dg0",
          "cethx.atp_yields_hardcoded",
          "cethx.proton_stoich_estimated",
        ];

    const evidence = equilibratorLoaded
      ? [
          {
            id: `cethx-${now}`,
            source: "computation" as const,
            reference: "Beber et al. 2022, Nucleic Acids Research. DOI: 10.1093/nar/gkab1106",
            confidence: "high" as const,
            notes: `Condition-aware ΔG' at pH ${pH}, ${tempC}°C, I=0.25M. Alberty transform applied via eQuilibrator 3 (ComponentContribution).`,
          },
        ]
      : [
          {
            id: `cethx-${now}`,
            source: "computation" as const,
            reference:
              "Lehninger Principles of Biochemistry (Nelson & Cox); NIST Webbook; Alberty (2003) Thermodynamics of Biochemical Reactions",
            confidence: "medium" as const,
            notes: `Pre-computed ΔG' from Lehninger/NIST reference ΔG° at pH ${pH}, ${tempC}°C, I=0.25M. Alberty transform with Debye-Hückel ionic strength correction. Proton stoichiometry from KEGG reaction equations.`,
          },
        ];

    setToolPayload("cethx", {
      validity: "real",
      runProvenance: createProvenanceEntry({
        toolId: "cethx",
        outputAssumptions: assumptions,
        evidence,
        upstreamProvenance,
      }),
      toolId: "cethx",
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || "Target Product",
      sourceArtifactId: analyzeArtifact?.id,
      pathway,
      tempC,
      pH,
      result: {
        atpYield: thermo.atp_yield,
        nadhYield: thermo.nadh_yield,
        gibbsFreeEnergy: thermo.gibbs_free_energy,
        entropyProduction: thermo.entropy_production,
        efficiency: thermo.efficiency,
        limitingStep,
      },
      updatedAt: now,
    });
  }, [
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    fbaPayload?.runProvenance,
    pathdPayload?.runProvenance,
    pathway,
    pH,
    project?.targetProduct,
    project?.title,
    setToolPayload,
    tempC,
    thermo,
    isRealData,
  ]);

  // Console logging
  const appendConsole = useUIStore((s) => s.appendConsole);
  useEffect(() => {
    const source = equilibratorLoaded ? "eQuilibrator" : "precomputed";
    appendConsole({
      level: thermo.gibbs_free_energy < 0 ? "info" : "warn",
      module: "CETHX",
      message: `CETHX ${source} — ${pathway} @ ${tempC}°C pH${pH} | ΔG'=${thermo.gibbs_free_energy.toFixed(1)} kJ/mol | feasible=${feasibilityData.overallFeasible}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thermo, isRealData]);

  const fba = fbaPayload;

  const [activeTab, setActiveTab] = useState("waterfall");

  // Pipeline state
  const [pipelineResult, setPipelineResult] = useState<CETHXPipelineResult | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // TFA state — pre-populated with glycolysis fragment
  const [tfaReactions, setTfaReactions] = useState<TFAReaction[]>(GLYCOLYSIS_TFA_REACTIONS);
  const [tfaResult, setTfaResult] = useState<TFAResult | null>(null);

  const handleRunTFA = useCallback(() => {
    if (tfaReactions.length === 0) return;
    const result = runTFA({
      reactions: tfaReactions,
      conditions: { pH, ionicStrength: 0.1, temperature: tempC + 273.15 },
    });
    setTfaResult(result);
  }, [tfaReactions, pH, tempC]);

  // Retry handler for equilibrator
  const retryEquilibrator = useCallback(() => {
    const reactions = KEGG_REACTIONS[pathway];
    if (!reactions) return;
    setIsLoadingEquilibrator(true);
    const newData = new Map<string, { dG_prime: number; dG_prime_uncertainty: number }>();
    Promise.allSettled(
      Object.entries(reactions).map(async ([stepName, formula]) => {
        try {
          const response = await fetch("/api/equilibrator", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reaction: formula, pH, temperature: tempC + 273.15, ionic_strength: 0.25 }),
          });
          if (response.ok) {
            const result = await response.json();
            if (!result.error && result.dG_prime !== undefined) {
              newData.set(stepName, {
                dG_prime: result.dG_prime,
                dG_prime_uncertainty: result.dG_prime_uncertainty || 0,
              });
            }
          }
        } catch {
          /* skip */
        }
      }),
    ).then(() => {
      if (newData.size > 0) {
        setEquilibratorData(newData);
        setIsRealData(true);
      }
      setIsLoadingEquilibrator(false);
    });
  }, [pathway, pH, tempC]);

  return {
    pathway,
    setPathway,
    tempC,
    setTempC,
    pH,
    setPH,
    equilibratorData,
    isRealData,
    equilibratorLoaded,
    isLoadingEquilibrator,
    setIsEquilibratorData: setEquilibratorData,
    setIsRealData,
    setIsLoadingEquilibrator,
    compoundQuery,
    setCompoundQuery,
    pubchemData,
    pubchemSource,
    pubchemLoading,
    handleCompoundSearch,
    customThermoData,
    setCustomThermoData,
    customThermoHeaders,
    setCustomThermoHeaders,
    customThermoRows,
    setCustomThermoRows,
    customThermoError,
    setCustomThermoError,
    activeTab,
    setActiveTab,
    pipelineResult,
    setPipelineResult,
    pipelineLoading,
    setPipelineLoading,
    pipelineError,
    setPipelineError,
    tfaReactions,
    setTfaReactions,
    tfaResult,
    setTfaResult,
    handleRunTFA,
    thermo,
    limitingStep,
    feasibilityData,
    fba,
    retryEquilibrator,
  };
}
