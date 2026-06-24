'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useUIStore } from '../../../store/uiStore';
import { useWorkbenchStore } from '../../../store/workbenchStore';
import { usePersistedState } from '../../ide/shared/usePersistedState';
import {
  runBioreactor,
  DEFAULT_CONTROLLER,
  DEFAULT_PARAMS,
  DEFAULT_HILL,
  analyzeConvergence,
  analyzeMetabolicBurden,
  mapControlGainToRBS,
  hillFeedback,
  SPONTANEOUS_LOSS_RATE,
  PROTEIN_TURNOVER_RATE,
  O2_CONSUMPTION_COEFF,
} from '../../../data/mockDynCon';
import { runMPC } from '../../../server/modelPredictiveControl';
import type { ODEState, HillParams } from '../../../types';
import type { DynConOverrides } from '../../../data/mockDynCon';
import { buildDynConSeed } from '../shared/workbenchDataflow';

export type DynConStateReturn = ReturnType<typeof useDynConState>;

export function useDynConState() {
  const chartRef = useRef<SVGSVGElement>(null);
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const fbaPayload = useWorkbenchStore((s) => s.toolPayloads.fbasim);
  const cethxPayload = useWorkbenchStore((s) => s.toolPayloads.cethx);
  const catalystPayload = useWorkbenchStore((s) => s.toolPayloads.catdes);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const kineticsPayload = useWorkbenchStore((s) => s.toolPayloads.kinetics);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);

  /* ── PID state (persisted) ─────────────────────────────────────────────── */
  const [kp, setKp] = usePersistedState('nexus-bio:dyncon:kp', DEFAULT_CONTROLLER.kp);
  const [ki, setKi] = usePersistedState('nexus-bio:dyncon:ki', DEFAULT_CONTROLLER.ki);
  const [kd, setKd] = usePersistedState('nexus-bio:dyncon:kd', DEFAULT_CONTROLLER.kd);
  const [setpoint, setSetpoint] = usePersistedState('nexus-bio:dyncon:setpoint', DEFAULT_CONTROLLER.setpoint);

  /* ── Hill state (persisted) ────────────────────────────────────────────── */
  const [vmax, setVmax] = usePersistedState('nexus-bio:dyncon:vmax', DEFAULT_HILL.Vmax);
  const [hillKd, setHillKd] = usePersistedState('nexus-bio:dyncon:hillKd', DEFAULT_HILL.Kd);
  const [hillN, setHillN] = usePersistedState('nexus-bio:dyncon:hillN', DEFAULT_HILL.n);

  /* ── Advanced overrides (persisted) ──────────────────────────────────────── */
  const [spontaneousLossRate, setSpontaneousLossRate] = usePersistedState('nexus-bio:dyncon:spontaneousLossRate', SPONTANEOUS_LOSS_RATE);
  const [o2ConsumptionCoeff, setO2ConsumptionCoeff] = usePersistedState('nexus-bio:dyncon:o2ConsumptionCoeff', O2_CONSUMPTION_COEFF);
  const [burdenPenalty, setBurdenPenalty] = usePersistedState('nexus-bio:dyncon:burdenPenalty', 0.4);

  /* ── MPC mode (persisted) ──────────────────────────────────────────────── */
  const [controlMode, setControlMode] = usePersistedState<'pid' | 'mpc'>('nexus-bio:dyncon:controlMode', 'pid');
  const [mpcPredHorizon, setMpcPredHorizon] = usePersistedState('nexus-bio:dyncon:mpcPredHorizon', 10);
  const [mpcCtrlHorizon, setMpcCtrlHorizon] = usePersistedState('nexus-bio:dyncon:mpcCtrlHorizon', 4);
  const [mpcStateWeight, setMpcStateWeight] = usePersistedState('nexus-bio:dyncon:mpcStateWeight', 10.0);
  const [mpcControlWeight, setMpcControlWeight] = usePersistedState('nexus-bio:dyncon:mpcControlWeight', 0.5);
  const [mpcResult, setMpcResult] = useState<{
    trajectory: ODEState[];
    controlSignals: number[];
    cost: number;
    feasible: boolean;
    predictedTrajectory: ODEState[];
    constraintViolations: { time: number; variable: string; value: number; bound: string }[];
  } | null>(null);

  // Pipeline state
  const [pipelineResult, setPipelineResult] = useState<{
    optimalKp: number; optimalKi: number; optimalKd: number;
    costReduction: number; iterations: number; convergenceMetric: number;
  } | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('trajectory');
  const [workflowStep, setWorkflowStep] = useState(0);
  const recommendedSeed = useMemo(
    () => buildDynConSeed(fbaPayload, cethxPayload, catalystPayload, dbtlPayload),
    [catalystPayload?.updatedAt, cethxPayload?.updatedAt, dbtlPayload?.feedbackSource, dbtlPayload?.result.improvementRate, dbtlPayload?.result.latestPhase, dbtlPayload?.result.passRate, dbtlPayload?.updatedAt, fbaPayload?.updatedAt],
  );

  // Seed signature guard: only re-apply when seed values actually change
  const seedSignature = useMemo(
    () => `${recommendedSeed.controller.kp}|${recommendedSeed.controller.ki}|${recommendedSeed.controller.kd}|${recommendedSeed.controller.setpoint}|${recommendedSeed.hill.vmax}|${recommendedSeed.hill.kd}|${recommendedSeed.hill.n}`,
    [recommendedSeed.controller.kp, recommendedSeed.controller.ki, recommendedSeed.controller.kd, recommendedSeed.controller.setpoint, recommendedSeed.hill.vmax, recommendedSeed.hill.kd, recommendedSeed.hill.n],
  );
  const lastAppliedSeedRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastAppliedSeedRef.current === seedSignature) return;
    setKp(recommendedSeed.controller.kp);
    setKi(recommendedSeed.controller.ki);
    setKd(recommendedSeed.controller.kd);
    setSetpoint(recommendedSeed.controller.setpoint);
    // Hill parameters seeded from kinetic simulation when available
    if (kineticsPayload?.result) {
      const kv = kineticsPayload.result;
      // vmax from kinetics Vmax (normalized to Hill scale)
      setVmax(Math.min(2, Math.max(0.2, kv.vmax)));
      // hillKd seeded from Km (Michaelis constant → Hill dissociation constant)
      setHillKd(Math.min(200, Math.max(5, kv.km * 40)));
    } else {
      setVmax(recommendedSeed.hill.vmax);
      setHillKd(recommendedSeed.hill.kd);
    }
    setHillN(recommendedSeed.hill.n);
    lastAppliedSeedRef.current = seedSignature;
  }, [
    seedSignature,
    kineticsPayload?.result,
    recommendedSeed.controller.kd,
    recommendedSeed.controller.ki,
    recommendedSeed.controller.kp,
    recommendedSeed.controller.setpoint,
    recommendedSeed.hill.kd,
    recommendedSeed.hill.n,
    recommendedSeed.hill.vmax,
    setHillKd,
    setHillN,
    setKd,
    setKi,
    setKp,
    setSetpoint,
    setVmax,
  ]);

  const hill: HillParams = useMemo(() => ({ Vmax: vmax, Kd: hillKd, n: hillN }), [vmax, hillKd, hillN]);

  const overrides: DynConOverrides = useMemo(() => ({
    spontaneousLossRate,
    o2ConsumptionCoeff,
    burdenPenalty,
  }), [spontaneousLossRate, o2ConsumptionCoeff, burdenPenalty]);

  /* ── MPC state-transition model (discrete-time, 1 Euler step) ─────────── */
  const mpcModelStateRef = useRef<{
    p: typeof DEFAULT_PARAMS;
    hill: HillParams;
    overrides: DynConOverrides;
  }>({ p: DEFAULT_PARAMS, hill, overrides });
  mpcModelStateRef.current = { p: DEFAULT_PARAMS, hill, overrides };

  const mpcModelFn = useMemo(
    () => (state: number[], control: number[]): number[] => {
      const { p, hill: h, overrides: ov } = mpcModelStateRef.current;
      const spontaneousLoss = ov.spontaneousLossRate ?? SPONTANEOUS_LOSS_RATE;
      const o2Coeff = ov.o2ConsumptionCoeff ?? O2_CONSUMPTION_COEFF;
      const burdenCoeff = ov.burdenPenalty ?? 0.4;
      const airflowScale = Math.max(0, Math.min(3, control[0]));
      const dt = 1.0;

      const X = Math.max(0, state[0]);
      const S = Math.max(0, state[1]);
      const P = Math.max(0, state[2]);
      const O_norm = Math.max(0, Math.min(1.2, state[3]));
      const FPP = Math.max(0, state[4]);
      const ADS = Math.max(0, Math.min(2.0, state[5]));
      const V = Math.max(0.1, state[6]);
      const O = O_norm * p.OstarSat;

      const muO = O > 0 ? O / (p.Ko + O) : 0;
      const muBase = p.muMax * (S / (p.Ks + S)) * muO;
      const fppInhib = 1 / (1 + (FPP / p.fppToxicThreshold) ** 2);
      const prodInhib = 1 / (1 + (P / p.productToxicThreshold) ** 2);
      const burdenRaw = Math.min(1, ADS / p.maxBurdenTolerance);
      const burdenPen = Math.max(0, 1 - burdenRaw * burdenCoeff);
      const mu = muBase * fppInhib * prodInhib * burdenPen;

      const dilution = p.feedRate / V;
      const dX = mu * X - dilution * X;
      const dS = p.feedRate * (p.feedConc - S) / V - dX / p.Yxs;
      const dFPP = p.kFPP * X - ADS * FPP * p.fppDegradation - FPP * spontaneousLoss - dilution * FPP;
      const adsTarget = hillFeedback(FPP, h);
      const dADS = (adsTarget - ADS) * PROTEIN_TURNOVER_RATE;
      const dP = p.kADS * ADS * FPP - dilution * P;
      const dO_full = p.kLa * airflowScale * (p.OstarSat - O) - mu * X * o2Coeff;
      const dO = dO_full / p.OstarSat;

      const Xn = Math.max(0, X + dt * dX);
      const Sn = Math.max(0, S + dt * dS);
      const Pn = Math.max(0, P + dt * dP);
      const On = Math.max(0, Math.min(1.2, O_norm + dt * dO));
      const FPPn = Math.max(0, FPP + dt * dFPP);
      const ADSn = Math.max(0, Math.min(2.0, ADS + dt * dADS));
      const Vn = Math.max(0.1, V + dt * p.feedRate);

      return [Xn, Sn, Pn, On, FPPn, ADSn, Vn];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ── MPC simulation ────────────────────────────────────────────────────── */
  const pidSimulation = useMemo(() => {
    try {
      const t = runBioreactor({ kp, ki, kd, setpoint }, DEFAULT_PARAMS, 100, 1.0, hill, overrides);
      return { trajectory: t, simError: null as string | null };
    } catch (e) {
      return { trajectory: [] as ODEState[], simError: e instanceof Error ? e.message : 'Simulation failed' };
    }
  }, [kp, ki, kd, setpoint, hill, overrides]);

  const mpcSimulation = useMemo(() => {
    if (controlMode !== 'mpc') return null;
    try {
      const params = DEFAULT_PARAMS;
      const initialState = [
        0.5,                     // X (biomass)
        20.0,                    // S (substrate)
        0.0,                     // P (product)
        1.0,                     // O_norm (dissolved O2, normalized)
        10.0,                    // FPP
        hill.Vmax * 0.8,        // ADS
        2.0,                     // V (volume)
      ];

      const predHorizon = Math.max(2, Math.min(20, mpcPredHorizon));
      const ctrlHorizon = Math.max(1, Math.min(predHorizon, mpcCtrlHorizon));

      const mpcConfig = {
        predictionHorizon: predHorizon,
        controlHorizon: ctrlHorizon,
        dt: 1.0,
        setpoint: [0, 0, 0, setpoint, 0, 0, 0],
        stateConstraints: {
          min: [0, 0, 0, 0, 0, 0, 0.1],
          max: [50, 100, 50, 1.2, 300, 2.0, 20],
        },
        controlConstraints: { min: [0], max: [3] },
        costWeights: {
          state: [0.1, 0.01, 1.0, mpcStateWeight, 0.05, 0.1, 0.01],
          control: [mpcControlWeight],
        },
      };

      const result = runMPC(initialState, mpcConfig, mpcModelFn, 100);

      const toODEState = (idx: number): ODEState => ({
        time: (idx + 1) * 1.0,
        biomass: result.trajectories[0][idx + 1],
        substrate: result.trajectories[1][idx + 1],
        product: result.trajectories[2][idx + 1],
        dissolvedO2: result.trajectories[3][idx + 1],
        fpp: result.trajectories[4][idx + 1],
        adsExpression: result.trajectories[5][idx + 1],
        volume: result.trajectories[6][idx + 1],
      });

      const trajectory = Array.from({ length: 100 }, (_, i) => toODEState(i));

      const lastIdx = 99;
      const currentState = [
        result.trajectories[0][lastIdx],
        result.trajectories[1][lastIdx],
        result.trajectories[2][lastIdx],
        result.trajectories[3][lastIdx],
        result.trajectories[4][lastIdx],
        result.trajectories[5][lastIdx],
        result.trajectories[6][lastIdx],
      ];
      const lastControl = result.controlSignals[lastIdx];
      const predictedStates: ODEState[] = [toODEState(lastIdx)];
      let prevState = currentState;
      for (let k = 0; k < predHorizon; k++) {
        const nextState = mpcModelFn(prevState, [lastControl]);
        predictedStates.push({
          time: lastIdx + 1 + k + 1,
          biomass: nextState[0],
          substrate: nextState[1],
          product: nextState[2],
          dissolvedO2: nextState[3],
          fpp: nextState[4],
          adsExpression: nextState[5],
          volume: nextState[6],
        });
        prevState = nextState;
      }

      const violations: { time: number; variable: string; value: number; bound: string }[] = [];
      trajectory.forEach((s, i) => {
        if (s.fpp !== undefined && s.fpp > params.fppToxicThreshold) {
          violations.push({ time: s.time, variable: 'FPP', value: s.fpp, bound: `< ${params.fppToxicThreshold} uM` });
        }
        if (s.product > params.productToxicThreshold) {
          violations.push({ time: s.time, variable: 'Product', value: s.product, bound: `< ${params.productToxicThreshold} g/L` });
        }
      });

      return {
        trajectory,
        controlSignals: result.controlSignals,
        cost: result.cost,
        feasible: result.feasible,
        predictedTrajectory: predictedStates,
        constraintViolations: violations,
        simError: null as string | null,
      };
    } catch (e) {
      return {
        trajectory: [] as ODEState[],
        controlSignals: [] as number[],
        cost: 0,
        feasible: false,
        predictedTrajectory: [] as ODEState[],
        constraintViolations: [] as { time: number; variable: string; value: number; bound: string }[],
        simError: e instanceof Error ? e.message : 'MPC simulation failed',
      };
    }
  }, [controlMode, mpcPredHorizon, mpcCtrlHorizon, mpcStateWeight, mpcControlWeight, setpoint, hill, mpcModelFn]);

  useEffect(() => {
    if (controlMode === 'mpc' && mpcSimulation) {
      setMpcResult({
        trajectory: mpcSimulation.trajectory,
        controlSignals: mpcSimulation.controlSignals,
        cost: mpcSimulation.cost,
        feasible: mpcSimulation.feasible,
        predictedTrajectory: mpcSimulation.predictedTrajectory,
        constraintViolations: mpcSimulation.constraintViolations,
      });
    }
  }, [controlMode, mpcSimulation]);

  /* ── Active simulation results ─────────────────────────────────────────── */
  const trajectory = controlMode === 'mpc' && mpcResult && mpcResult.trajectory.length > 0
    ? mpcResult.trajectory
    : pidSimulation.trajectory;
  const simError = controlMode === 'mpc' && mpcResult
    ? (mpcSimulation?.simError ?? null)
    : pidSimulation.simError;

  const last = trajectory[trajectory.length - 1];
  const productTiter = last?.product ?? 0;
  const productivity = last ? productTiter / last.time : 0;

  const doRmse = useMemo(() => {
    const errors = trajectory.map(t => (t.dissolvedO2 - setpoint) ** 2);
    return Math.sqrt(errors.reduce((a, b) => a + b, 0) / errors.length);
  }, [trajectory, setpoint]);

  /* ── Derived analytics ──────────────────────────────────────────────────── */
  const convergence = useMemo(() => analyzeConvergence(trajectory, setpoint), [trajectory, setpoint]);
  const burden = useMemo(() => analyzeMetabolicBurden(trajectory), [trajectory]);
  const rbsMapping = useMemo(() => mapControlGainToRBS(kp, ki, kd), [kp, ki, kd]);

  const currentFPP = last?.fpp ?? 0;
  const currentADS = last?.adsExpression ?? 0;

  /* ── Console logging ─────────────────────────────────────────────────── */
  const appendConsole = useUIStore((s) => s.appendConsole);
  useEffect(() => {
    if (simError) {
      appendConsole({ level: 'error', module: 'DYNCON', message: `Simulation error: ${simError}` });
    } else if (trajectory.length > 0) {
      if (controlMode === 'mpc' && mpcResult) {
        appendConsole({
          level: 'info',
          module: 'DYNCON',
          message: `MPC sim complete — Np=${mpcPredHorizon} Nc=${mpcCtrlHorizon} Q_DO2=${mpcStateWeight} R=${mpcControlWeight} | Product=${productTiter.toFixed(2)} g/L | Cost=${mpcResult.cost.toFixed(2)} | ${mpcResult.feasible ? 'Feasible' : 'Constraint violations'} | RMSE=${doRmse.toFixed(3)}`,
        });
      } else {
        appendConsole({
          level: 'info',
          module: 'DYNCON',
          message: `ODE sim complete — Kp=${kp} Ki=${ki} Kd=${kd} SP=${setpoint} | Product=${productTiter.toFixed(2)} g/L | RMSE=${doRmse.toFixed(3)} | ${convergence.isStable ? 'Stable' : 'Unstable'}`,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trajectory, simError]);

  /* ── Read FBA snapshot from canonical workbench state ────────────────── */
  const fba = fbaPayload;

  useEffect(() => {
    if (last && !simError) {
      const now = Date.now();
      setToolPayload('dyncon', {
        validity: 'partial',
        toolId: 'dyncon',
        targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
        sourceArtifactId: analyzeArtifact?.id,
        controller: { kp, ki, kd, setpoint },
        hill: { vmax, kd: hillKd, n: hillN },
        result: {
          productTiter,
          productivity,
          doRmse,
          stable: convergence.isStable,
          burdenIndex: burden.burdenIndex,
          currentFPP,
          adsExpression: currentADS,
          rbsPart: rbsMapping.rbsName,
        },
        updatedAt: now,
      });
    }
  }, [analyzeArtifact?.id, analyzeArtifact?.targetProduct, burden.burdenIndex, convergence.isStable, currentADS, currentFPP, doRmse, hillKd, hillN, kd, ki, kp, last, productTiter, productivity, project?.targetProduct, project?.title, rbsMapping.rbsName, setToolPayload, setpoint, simError, vmax]);

  return {
    chartRef,
    kp, setKp, ki, setKi, kd, setKd, setpoint, setSetpoint,
    vmax, setVmax, hillKd, setHillKd, hillN, setHillN,
    spontaneousLossRate, setSpontaneousLossRate,
    o2ConsumptionCoeff, setO2ConsumptionCoeff,
    burdenPenalty, setBurdenPenalty,
    controlMode, setControlMode,
    mpcPredHorizon, setMpcPredHorizon,
    mpcCtrlHorizon, setMpcCtrlHorizon,
    mpcStateWeight, setMpcStateWeight,
    mpcControlWeight, setMpcControlWeight,
    mpcResult,
    pipelineResult, setPipelineResult,
    pipelineLoading, setPipelineLoading,
    pipelineError, setPipelineError,
    activeTab, setActiveTab,
    workflowStep, setWorkflowStep,
    hill, overrides, mpcModelFn,
    pidSimulation, mpcSimulation,
    trajectory, simError,
    last, productTiter, productivity, doRmse,
    convergence, burden, rbsMapping,
    currentFPP, currentADS,
    fba, fbaPayload, cethxPayload,
    project, analyzeArtifact,
  };
}
