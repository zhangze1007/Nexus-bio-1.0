'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  runFullCFSPipeline,
  generateDefaultConstructs,
  generateDefaultParameters,
} from '../../../services/CellFreeEngine';
import type {
  CFSFullResult,
  GeneConstruct,
  CFSParameters,
  PlateReaderDataPoint,
} from '../../../services/CellFreeEngine';
import { useWorkbenchStore } from '../../../store/workbenchStore';
import type { ProvenanceEntry } from '../../../types/assumptions';
import { createProvenanceEntry } from '../../../utils/provenance';
import { buildCellFreeSeed } from '../shared/workbenchDataflow';
import { calibrateParameters } from '../../../server/mcmcCalibration';
import type { CalibrationResult } from '../../../server/mcmcCalibration';
import { getBRENDAKinetics } from '../../../services/database/brendaClient';
import type { BRENDAKinetics } from '../../../services/database/brendaClient';
import { getIvivExpressionLabel } from './sharedComponents';

export interface CellFreeState {
  constructs: GeneConstruct[];
  setConstructs: React.Dispatch<React.SetStateAction<GeneConstruct[]>>;
  params: CFSParameters;
  setParams: React.Dispatch<React.SetStateAction<CFSParameters>>;
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  userData: PlateReaderDataPoint[] | null;
  setUserData: React.Dispatch<React.SetStateAction<PlateReaderDataPoint[] | null>>;
  brendaEcInput: string;
  setBrendaEcInput: React.Dispatch<React.SetStateAction<string>>;
  brendaData: BRENDAKinetics | null;
  brendaSource: 'live' | 'mock';
  brendaLoading: boolean;
  brendaApplied: boolean;
  calibrationResult: CalibrationResult | null;
  calibrationLoading: boolean;
  cellfreeError: string | null;
  setCellfreeError: React.Dispatch<React.SetStateAction<string | null>>;
  pipelineResult: {
    predictedYield: number; robustnessScore: number; energyDepletionTime: number;
    recommendedConstruct: string; confidenceLevel: string;
  } | null;
  setPipelineResult: React.Dispatch<React.SetStateAction<CellFreeState['pipelineResult']>>;
  pipelineLoading: boolean;
  setPipelineLoading: React.Dispatch<React.SetStateAction<boolean>>;
  pipelineError: string | null;
  setPipelineError: React.Dispatch<React.SetStateAction<string | null>>;
  handleCalibrate: () => void;
  handleBrendaLookup: () => void;
  handleApplyBrenda: () => void;
  handleClearBrenda: () => void;
  handleCsvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  result: CFSFullResult | null;
  simError: string | null;
  sim: CFSFullResult['simulation'];
  fit: CFSFullResult['fitting'];
  iviv: CFSFullResult['iviv'];
  invitroMaxProtein: number;
  exportData: Record<string, unknown>[];
}

export function useCellFreeState(): CellFreeState {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const catalystPayload = useWorkbenchStore((s) => s.toolPayloads.catdes);
  const dynconPayload = useWorkbenchStore((s) => s.toolPayloads.dyncon);
  const cethxPayload = useWorkbenchStore((s) => s.toolPayloads.cethx);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);

  const [constructs, setConstructs] = useState<GeneConstruct[]>(() => generateDefaultConstructs());
  const [params, setParams] = useState<CFSParameters>(() => generateDefaultParameters());
  const recommendedSeed = useMemo(
    () => buildCellFreeSeed(project, analyzeArtifact, catalystPayload, dynconPayload, cethxPayload, dbtlPayload),
    [analyzeArtifact?.generatedAt, analyzeArtifact?.id, catalystPayload?.updatedAt, cethxPayload?.updatedAt, dbtlPayload?.feedbackSource, dbtlPayload?.result.improvementRate, dbtlPayload?.result.latestPhase, dbtlPayload?.result.passRate, dbtlPayload?.updatedAt, dynconPayload?.updatedAt, project?.id, project?.updatedAt],
  );

  const seedSignature = useMemo(
    () => JSON.stringify({
      ids: recommendedSeed.constructs.map((c) => c.id),
      temp: recommendedSeed.params.temperature,
      time: recommendedSeed.params.simulationTime,
      ribo: recommendedSeed.params.ribosomeTotal,
      atp: recommendedSeed.params.initialEnergy.atp,
    }),
    [recommendedSeed],
  );
  const lastAppliedSeedRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastAppliedSeedRef.current === seedSignature) return;
    setConstructs(recommendedSeed.constructs);
    setParams(recommendedSeed.params);
    lastAppliedSeedRef.current = seedSignature;
  }, [seedSignature, recommendedSeed]);

  const [activeTab, setActiveTab] = useState('timecourse');
  const [userData, setUserData] = useState<PlateReaderDataPoint[] | null>(null);
  const [brendaEcInput, setBrendaEcInput] = useState('');
  const [brendaData, setBrendaData] = useState<BRENDAKinetics | null>(null);
  const [brendaSource, setBrendaSource] = useState<'live' | 'mock'>('mock');
  const [brendaLoading, setBrendaLoading] = useState(false);
  const [brendaApplied, setBrendaApplied] = useState(false);
  const [calibrationResult, setCalibrationResult] = useState<CalibrationResult | null>(null);
  const [calibrationLoading, setCalibrationLoading] = useState(false);
  const [cellfreeError, setCellfreeError] = useState<string | null>(null);

  const [pipelineResult, setPipelineResult] = useState<{
    predictedYield: number; robustnessScore: number; energyDepletionTime: number;
    recommendedConstruct: string; confidenceLevel: string;
  } | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const handleCalibrate = useCallback(() => {
    setCalibrationLoading(true);
    try {
      const timepoints = userData
        ? Array.from(new Set(userData.map(d => d.time))).sort((a, b) => a - b)
        : [0, 30, 60, 90, 120];
      const observations = userData
        ? { protein: timepoints.map(t => userData.filter(d => d.time === t).reduce((sum, d) => sum + d.fluorescence, 0) / Math.max(1, userData.filter(d => d.time === t).length)) }
        : { protein: [0, 0.5, 1.2, 1.8, 2.1] };
      const data = { timepoints, observations };
      const result = calibrateParameters(data, {
        nSamples: 200,
        burnIn: 50,
        priorRanges: { k_tx: [0.01, 5], k_tl: [0.1, 20], d_mRNA: [0.001, 0.5] },
      }, (params) => {
        const { k_tx, k_tl, d_mRNA } = params;
        return {
          protein: data.timepoints.map(t => (k_tx * k_tl / d_mRNA) * (1 - Math.exp(-d_mRNA * t))),
        };
      });
      setCalibrationResult(result);
    } catch (calibrationError) {
      console.warn('Calibration failed:', calibrationError);
      setCalibrationResult(null);
      const msg = calibrationError instanceof Error ? calibrationError.message : 'MCMC calibration failed';
      setCellfreeError(msg);
    } finally {
      setCalibrationLoading(false);
    }
  }, [userData]);

  const handleBrendaLookup = useCallback(async () => {
    if (!brendaEcInput.trim()) return;
    setBrendaLoading(true);
    try {
      const result = await getBRENDAKinetics(brendaEcInput.trim());
      setBrendaData(result.data);
      setBrendaSource(result.source);
      setBrendaApplied(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'BRENDA lookup failed';
      setCellfreeError(msg);
    } finally {
      setBrendaLoading(false);
    }
  }, [brendaEcInput]);

  const handleApplyBrenda = useCallback(() => {
    if (!brendaData) return;
    const km = brendaData.km.length > 0 ? brendaData.km[0].value : undefined;
    const kcat = brendaData.kcat.length > 0 ? brendaData.kcat[0].value : undefined;
    if (km === undefined && kcat === undefined) return;
    setParams(prev => ({
      ...prev,
      ...(km !== undefined ? { brendaKm: km } : {}),
      ...(kcat !== undefined ? { brendaKcat: kcat } : {}),
    }));
    setBrendaApplied(true);
  }, [brendaData]);

  const handleClearBrenda = useCallback(() => {
    setParams(prev => {
      const next = { ...prev };
      delete next.brendaKm;
      delete next.brendaKcat;
      return next;
    });
    setBrendaApplied(false);
  }, []);

  const { data: result, error: simError } = useMemo(() => {
    try { return { data: runFullCFSPipeline(constructs, params, userData ?? undefined), error: null as string | null }; }
    catch (e) {
      const errMsg = e instanceof Error ? e.message : 'CFS pipeline failed';
      try { return { data: runFullCFSPipeline([], generateDefaultParameters()), error: errMsg }; }
      catch (fallbackErr) {
        console.warn('CFS fallback also failed:', fallbackErr);
        try {
          return { data: runFullCFSPipeline([], generateDefaultParameters()), error: errMsg };
        } catch (finalErr) {
          console.error('CFS all fallbacks failed:', finalErr);
          return { data: null as CFSFullResult | null, error: errMsg };
        }
      }
    }
  }, [constructs, params, userData]);

  const handleCsvUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.trim().split('\n');
      const data: PlateReaderDataPoint[] = [];
      lines.slice(1).forEach((line, i) => {
        const cols = line.split(',').map(s => s.trim());
        const time = Number(cols[0]);
        const fluorescence = Number(cols[1]);
        if (isNaN(time) || isNaN(fluorescence)) return;
        const concentration = cols.length >= 3 ? Number(cols[2]) : 0;
        const well = cols.length >= 4 ? cols[3] : `R${i + 1}`;
        data.push({ time, fluorescence, concentration: isNaN(concentration) ? 0 : concentration, well });
      });
      setUserData(data);
    };
    reader.readAsText(file);
  }, []);

  const fallbackSim = useMemo(() => runFullCFSPipeline([], generateDefaultParameters()).simulation, []);
  const sim = result?.simulation ?? fallbackSim;
  const fit = result?.fitting ?? null;
  const iviv = result?.iviv ?? null;

  const invitroMaxProtein = useMemo(
    () => result ? Math.max(...sim.steadyState.map((entry) => entry.maxProtein), 0) : 0,
    [result, sim.steadyState],
  );

  useEffect(() => {
    if (simError || !result) return;
    const now = Date.now();
    const upstreamProvenance = [cethxPayload?.runProvenance, catalystPayload?.runProvenance, dynconPayload?.runProvenance]
      .filter((entry): entry is ProvenanceEntry => Boolean(entry))
      .map((entry) => `${entry.toolId}:${entry.timestamp}`);
    setToolPayload('cellfree', {
      validity: 'demo',
      runProvenance: createProvenanceEntry({
        toolId: 'cellfree',
        outputAssumptions: [
          'cellfree.parameters_unsourced',
          'cellfree.tx_tl_kinetics_ref',
          'cellfree.no_chassis_specificity',
          'cellfree.lm_fitting_local',
          'cellfree.iviv_heuristic_unfit',
          ...(brendaApplied ? ['cellfree.brenda_constants_applied'] : []),
        ],
        evidence: [{
          id: `cellfree-${now}`,
          source: brendaApplied ? (brendaSource === 'live' ? 'database' : 'mock') : 'mock',
          reference: brendaApplied
            ? `BRENDA: Km=${params.brendaKm ?? '—'} mM, Kcat=${params.brendaKcat ?? '—'} 1/s seeded into ODE and LM fitter.`
            : 'MOCK_DATA: no calibrated source for the bundled cell-free parameter defaults.',
          confidence: brendaApplied ? (brendaSource === 'live' ? 'high' : 'demo') : 'demo',
          notes: brendaApplied
            ? 'BRENDA constants injected as initial guesses for LM optimizer and as construct kinetic overrides.'
            : 'Tier/code mismatch is preserved honestly; no parameter calibration or chassis-specific TXTL model is claimed.',
        }],
        upstreamProvenance,
      }),
      toolId: 'cellfree',
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
      sourceArtifactId: analyzeArtifact?.id,
      targetConstruct: constructs[1]?.name || constructs[0]?.name || 'Primary construct',
      constructCount: constructs.length,
      temperature: params.temperature,
      simulationTime: params.simulationTime,
      result: {
        totalProteinYield: sim.totalProteinYield,
        energyDepletionTime: sim.energyDepletionTime,
        isResourceLimited: sim.isResourceLimited,
        invitroMaxProtein,
        invivoExpression: iviv?.invivo_expression ?? null,
        confidence: iviv?.confidence ?? null,
        brendaOverrides: sim.brendaOverrides,
      },
      updatedAt: now,
    });
  }, [
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    brendaApplied,
    brendaSource,
    catalystPayload?.runProvenance,
    constructs,
    cethxPayload?.runProvenance,
    dynconPayload?.runProvenance,
    invitroMaxProtein,
    iviv?.confidence,
    iviv?.invivo_expression,
    params.brendaKcat,
    params.brendaKm,
    params.simulationTime,
    params.temperature,
    project?.targetProduct,
    project?.title,
    setToolPayload,
    sim.brendaOverrides,
    sim.energyDepletionTime,
    sim.isResourceLimited,
    sim.totalProteinYield,
    simError,
    result,
  ]);

  const exportData = useMemo(() => {
    if (!result) return [];
    const rows: Record<string, unknown>[] = [];
    sim.genes.forEach(g => {
      g.time.forEach((t, i) => {
        rows.push({ gene: g.geneName, time: t, protein: g.protein[i], mRNA: g.mRNA[i] });
      });
    });
    return rows;
  }, [sim, result]);

  return {
    constructs, setConstructs,
    params, setParams,
    activeTab, setActiveTab,
    userData, setUserData,
    brendaEcInput, setBrendaEcInput,
    brendaData, brendaSource, brendaLoading, brendaApplied,
    calibrationResult, calibrationLoading,
    cellfreeError, setCellfreeError,
    pipelineResult, setPipelineResult,
    pipelineLoading, setPipelineLoading,
    pipelineError, setPipelineError,
    handleCalibrate,
    handleBrendaLookup,
    handleApplyBrenda,
    handleClearBrenda,
    handleCsvUpload,
    result, simError,
    sim, fit, iviv,
    invitroMaxProtein,
    exportData,
  };
}
