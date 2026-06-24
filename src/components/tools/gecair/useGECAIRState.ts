'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { CIRCUIT_NODES, hillInhibition } from '../../../data/mockGECAIR';
import type { GateType } from '../../../data/mockGECAIR';
import { runGillespie } from '../../../server/gillespieSSA';
import type { StochasticModel, GillespieResult } from '../../../server/gillespieSSA';
import { useWorkbenchStore } from '../../../store/workbenchStore';
import { resolveGateOutput, PROTEIN_DEGRADATION_RATE, GILLESPIE_SEED_OFFSET } from './sharedComponents';

export interface GECAIRState {
  inputA: number;
  setInputA: (v: number) => void;
  inputB: number;
  setInputB: (v: number) => void;
  gateType: GateType;
  setGateType: (g: GateType) => void;
  circuitType: 'repressilator' | 'toggle_switch' | 'logic_cascade';
  setCircuitType: (c: 'repressilator' | 'toggle_switch' | 'logic_cascade') => void;
  togglePerturbation: 'A' | 'B';
  setTogglePerturbation: (p: 'A' | 'B') => void;
  activeTab: string;
  setActiveTab: (t: string) => void;
  stochasticMode: boolean;
  setStochasticMode: (v: boolean) => void;
  ensembleRuns: number;
  setEnsembleRuns: (n: number) => void;
  simError: string | null;
  setSimError: (e: string | null) => void;
  gillespieErrorRef: React.MutableRefObject<string | null>;
  pipelineResult: { recommendedGate: string; outputLevel: number; noiseScore: number; stability: string; optimizationSteps: number } | null;
  setPipelineResult: (r: GECAIRState['pipelineResult']) => void;
  pipelineLoading: boolean;
  setPipelineLoading: (v: boolean) => void;
  pipelineError: string | null;
  setPipelineError: (e: string | null) => void;
  recommendedGate: GateType;
  recommendedInputA: number;
  recommendedInputB: number;
  outA: number;
  outB: number;
  finalOutput: number;
  noiseScore: number;
  exportData: { gateType: GateType; inputA: string; inputB: string; output: string; noiseScore: string };
  figureMeta: { eyebrow: string; title: string; caption: string };
  stochasticEnsemble: {
    runs: GillespieResult[];
    resampled: Record<string, number[][]>;
    stats: Record<string, { mean: number[]; std: number[]; fano: number[]; cv: number[] }>;
    timeGrid: number[];
    speciesIds: string[];
    maxTime: number;
  } | null;
  buildRepressilatorStochastic: () => StochasticModel;
  buildToggleSwitchStochastic: () => StochasticModel;
  buildLogicCascadeStochastic: () => StochasticModel;
  OMEGA: number;
}

export function useGECAIRState(): GECAIRState {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const catalystPayload = useWorkbenchStore((s) => s.toolPayloads.catdes);
  const dynconPayload = useWorkbenchStore((s) => s.toolPayloads.dyncon);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);
  const [inputA, setInputA] = useState(0.8);
  const [inputB, setInputB] = useState(0.3);
  const [gateType, setGateType] = useState<GateType>('NOT');
  const [circuitType, setCircuitType] = useState<'repressilator' | 'toggle_switch' | 'logic_cascade'>('repressilator');
  const [togglePerturbation, setTogglePerturbation] = useState<'A' | 'B'>('A');
  const [activeTab, setActiveTab] = useState('circuit');
  const [stochasticMode, setStochasticMode] = useState(false);
  const [ensembleRuns, setEnsembleRuns] = useState(10);
  const [simError, setSimError] = useState<string | null>(null);
  const gillespieErrorRef = useRef<string | null>(null);

  // Pipeline state
  const [pipelineResult, setPipelineResult] = useState<{
    recommendedGate: string; outputLevel: number; noiseScore: number;
    stability: string; optimizationSteps: number;
  } | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const recommendedGate = useMemo<GateType>(() => {
    if ((catalystPayload?.result.totalMetabolicDrain ?? 0) > 0.45) return 'NAND';
    if (dynconPayload?.result.stable && catalystPayload?.result.isViable) return 'AND';
    if ((dynconPayload?.result.doRmse ?? 0) > 0.08) return 'OR';
    return 'NOT';
  }, [catalystPayload?.result.isViable, catalystPayload?.result.totalMetabolicDrain, dynconPayload?.result.doRmse, dynconPayload?.result.stable]);
  const recommendedInputA = useMemo(
    () => Math.min(1, Math.max(0, dynconPayload?.controller.setpoint ?? 0.6)),
    [dynconPayload?.controller.setpoint],
  );
  const recommendedInputB = useMemo(
    () => Math.min(1, Math.max(0, (catalystPayload?.result.totalMetabolicDrain ?? 0.3) + 0.15)),
    [catalystPayload?.result.totalMetabolicDrain],
  );

  useEffect(() => {
    setInputA(recommendedInputA);
    setInputB(recommendedInputB);
    setGateType(recommendedGate);
  }, [recommendedGate, recommendedInputA, recommendedInputB]);

  // ── Stochastic model builders ──
  const OMEGA = 100; // volume scaling factor (arbitrary units)

  function buildRepressilatorStochastic(): StochasticModel {
    return {
      species: [
        { id: 'mA', initialCount: 10 * OMEGA },
        { id: 'mB', initialCount: 5 * OMEGA },
        { id: 'mC', initialCount: 3 * OMEGA },
        { id: 'pA', initialCount: 100 * OMEGA },
        { id: 'pB', initialCount: 50 * OMEGA },
        { id: 'pC', initialCount: 30 * OMEGA },
      ],
      reactions: [
        { id: 'txnA', reactants: {}, products: { mA: 1 }, rate: 0.216 * OMEGA, hillRepression: { species: 'pC', K: 100 * OMEGA, n: 2 } },
        { id: 'txnB', reactants: {}, products: { mB: 1 }, rate: 0.216 * OMEGA, hillRepression: { species: 'pA', K: 100 * OMEGA, n: 2 } },
        { id: 'txnC', reactants: {}, products: { mC: 1 }, rate: 0.216 * OMEGA, hillRepression: { species: 'pB', K: 100 * OMEGA, n: 2 } },
        { id: 'tlA', reactants: { mA: 1 }, products: { mA: 1, pA: 1 }, rate: 0.2 },
        { id: 'tlB', reactants: { mB: 1 }, products: { mB: 1, pB: 1 }, rate: 0.2 },
        { id: 'tlC', reactants: { mC: 1 }, products: { mC: 1, pC: 1 }, rate: 0.2 },
        { id: 'deg_mA', reactants: { mA: 1 }, products: {}, rate: 1.0 },
        { id: 'deg_mB', reactants: { mB: 1 }, products: {}, rate: 1.0 },
        { id: 'deg_mC', reactants: { mC: 1 }, products: {}, rate: 1.0 },
        { id: 'deg_pA', reactants: { pA: 1 }, products: {}, rate: PROTEIN_DEGRADATION_RATE },
        { id: 'deg_pB', reactants: { pB: 1 }, products: {}, rate: PROTEIN_DEGRADATION_RATE },
        { id: 'deg_pC', reactants: { pC: 1 }, products: {}, rate: PROTEIN_DEGRADATION_RATE },
      ],
    };
  }

  function buildToggleSwitchStochastic(): StochasticModel {
    const stateA = togglePerturbation === 'A';
    return {
      species: [
        { id: 'mA', initialCount: (stateA ? 20 : 2) * OMEGA },
        { id: 'mB', initialCount: (stateA ? 2 : 20) * OMEGA },
        { id: 'pA', initialCount: (stateA ? 200 : 20) * OMEGA },
        { id: 'pB', initialCount: (stateA ? 20 : 200) * OMEGA },
      ],
      reactions: [
        { id: 'txnA', reactants: {}, products: { mA: 1 }, rate: 0.216 * OMEGA, hillRepression: { species: 'pB', K: 100 * OMEGA, n: 2.5 } },
        { id: 'txnB', reactants: {}, products: { mB: 1 }, rate: 0.216 * OMEGA, hillRepression: { species: 'pA', K: 100 * OMEGA, n: 2.5 } },
        { id: 'tlA', reactants: { mA: 1 }, products: { mA: 1, pA: 1 }, rate: 0.2 },
        { id: 'tlB', reactants: { mB: 1 }, products: { mB: 1, pB: 1 }, rate: 0.2 },
        { id: 'deg_mA', reactants: { mA: 1 }, products: {}, rate: 1.0 },
        { id: 'deg_mB', reactants: { mB: 1 }, products: {}, rate: 1.0 },
        { id: 'deg_pA', reactants: { pA: 1 }, products: {}, rate: PROTEIN_DEGRADATION_RATE },
        { id: 'deg_pB', reactants: { pB: 1 }, products: {}, rate: PROTEIN_DEGRADATION_RATE },
      ],
    };
  }

  function buildLogicCascadeStochastic(): StochasticModel {
    return {
      species: [
        { id: 'mA', initialCount: 10 * OMEGA },
        { id: 'mB', initialCount: 3 * OMEGA },
        { id: 'mC', initialCount: 1 * OMEGA },
        { id: 'pA', initialCount: 80 * OMEGA },
        { id: 'pB', initialCount: 30 * OMEGA },
        { id: 'pC', initialCount: 10 * OMEGA },
      ],
      reactions: [
        { id: 'txnA', reactants: {}, products: { mA: 1 }, rate: 1.5 * OMEGA },
        { id: 'txnB', reactants: {}, products: { mB: 1 }, rate: 0.216 * OMEGA, hillRepression: { species: 'pA', K: 100 * OMEGA, n: 2 } },
        { id: 'txnC', reactants: {}, products: { mC: 1 }, rate: 0.216 * OMEGA, hillRepression: { species: 'pB', K: 100 * OMEGA, n: 2 } },
        { id: 'tlA', reactants: { mA: 1 }, products: { mA: 1, pA: 1 }, rate: 0.2 },
        { id: 'tlB', reactants: { mB: 1 }, products: { mB: 1, pB: 1 }, rate: 0.2 },
        { id: 'tlC', reactants: { mC: 1 }, products: { mC: 1, pC: 1 }, rate: 0.2 },
        { id: 'deg_mA', reactants: { mA: 1 }, products: {}, rate: 1.0 },
        { id: 'deg_mB', reactants: { mB: 1 }, products: {}, rate: 1.0 },
        { id: 'deg_mC', reactants: { mC: 1 }, products: {}, rate: 1.0 },
        { id: 'deg_pA', reactants: { pA: 1 }, products: {}, rate: PROTEIN_DEGRADATION_RATE },
        { id: 'deg_pB', reactants: { pB: 1 }, products: {}, rate: PROTEIN_DEGRADATION_RATE },
        { id: 'deg_pC', reactants: { pC: 1 }, products: {}, rate: PROTEIN_DEGRADATION_RATE },
      ],
    };
  }

  // Ensemble stochastic simulation
  const stochasticEnsemble = useMemo(() => {
    if (!stochasticMode) return null;

    const model = circuitType === 'repressilator' ? buildRepressilatorStochastic()
      : circuitType === 'toggle_switch' ? buildToggleSwitchStochastic()
      : buildLogicCascadeStochastic();

    const maxTime = 300;
    const N = ensembleRuns;
    const runs: GillespieResult[] = [];
    for (let i = 0; i < N; i++) {
      runs.push(runGillespie(model, { maxTime, seed: i * 1000 + GILLESPIE_SEED_OFFSET }));
    }

    const gridPoints = 60;
    const dt = maxTime / gridPoints;
    const speciesIds = model.species.map(s => s.id);

    const resampled: Record<string, number[][]> = {};
    for (const id of speciesIds) {
      resampled[id] = [];
      for (let r = 0; r < N; r++) {
        const row: number[] = [];
        for (let g = 0; g <= gridPoints; g++) {
          const t = g * dt;
          const times = runs[r].times;
          const traj = runs[r].trajectories[id];
          let idx = 0;
          while (idx < times.length - 1 && times[idx + 1] <= t) idx++;
          row.push(traj[idx]);
        }
        resampled[id].push(row);
      }
    }

    const stats: Record<string, { mean: number[]; std: number[]; fano: number[]; cv: number[] }> = {};
    for (const id of speciesIds) {
      const mean: number[] = [];
      const std: number[] = [];
      const fano: number[] = [];
      const cv: number[] = [];
      for (let g = 0; g <= gridPoints; g++) {
        const values = resampled[id].map(run => run[g]);
        const m = values.reduce((a, b) => a + b, 0) / N;
        const v = values.reduce((a, b) => a + (b - m) ** 2, 0) / (N - 1);
        mean.push(m);
        std.push(Math.sqrt(v));
        fano.push(m > 0 ? v / m : 0);
        cv.push(m > 0 ? Math.sqrt(v) / m : 0);
      }
      stats[id] = { mean, std, fano, cv };
    }

    const timeGrid = Array.from({ length: gridPoints + 1 }, (_, i) => i * dt);
    return { runs, resampled, stats, timeGrid, speciesIds, maxTime };
  }, [stochasticMode, circuitType, ensembleRuns, togglePerturbation]);

  const outA = hillInhibition(inputA);
  const outB = hillInhibition(inputB);
  const finalOutput = resolveGateOutput(outA, outB, gateType);

  // Test both positive and negative perturbations for worst-case sensitivity
  const delta = 0.05;
  const noiseScore = Math.max(
    Math.abs(resolveGateOutput(hillInhibition(Math.max(0, Math.min(1, inputA + delta))), outB, gateType) - finalOutput),
    Math.abs(resolveGateOutput(hillInhibition(Math.max(0, Math.min(1, inputA - delta))), outB, gateType) - finalOutput),
    Math.abs(resolveGateOutput(outA, hillInhibition(Math.max(0, Math.min(1, inputB + delta))), gateType) - finalOutput),
    Math.abs(resolveGateOutput(outA, hillInhibition(Math.max(0, Math.min(1, inputB - delta))), gateType) - finalOutput),
  );

  const exportData = useMemo(() => ({
    gateType,
    inputA: inputA.toFixed(3),
    inputB: inputB.toFixed(3),
    output: finalOutput.toFixed(3),
    noiseScore: noiseScore.toFixed(4),
  }), [gateType, inputA, inputB, finalOutput, noiseScore]);
  const figureMeta = useMemo(() => ({
    eyebrow: 'Circuit figure',
    title: `${gateType} logic is framed as a control-system figure with parts, response space, and state ledger`,
    caption: 'The main panel keeps genetic architecture, transfer behavior, and combinatorial output in one evidence surface so gate choice reads like a scientific design decision instead of a toy toggle.',
  }), [gateType]);

  useEffect(() => {
    setToolPayload('gecair', {
      validity: 'partial',
      toolId: 'gecair',
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
      sourceArtifactId: analyzeArtifact?.id,
      gateType,
      inputA,
      inputB,
      result: {
        outputLevel: finalOutput,
        nodeAOutput: outA,
        nodeBOutput: outB,
        noiseScore,
        circuitComplexity: CIRCUIT_NODES.reduce((sum, node) => sum + node.parts.length, 0),
      },
      updatedAt: Date.now(),
    });
  }, [
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    finalOutput,
    gateType,
    inputA,
    inputB,
    noiseScore,
    outA,
    outB,
    project?.targetProduct,
    project?.title,
    setToolPayload,
  ]);

  return {
    inputA, setInputA, inputB, setInputB,
    gateType, setGateType, circuitType, setCircuitType,
    togglePerturbation, setTogglePerturbation,
    activeTab, setActiveTab,
    stochasticMode, setStochasticMode, ensembleRuns, setEnsembleRuns,
    simError, setSimError, gillespieErrorRef,
    pipelineResult, setPipelineResult, pipelineLoading, setPipelineLoading, pipelineError, setPipelineError,
    recommendedGate, recommendedInputA, recommendedInputB,
    outA, outB, finalOutput, noiseScore,
    exportData, figureMeta,
    stochasticEnsemble,
    buildRepressilatorStochastic, buildToggleSwitchStochastic, buildLogicCascadeStochastic,
    OMEGA,
  };
}
