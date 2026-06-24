'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { INITIAL_ITERATIONS, appendIteration } from '../../../data/mockDBTL';
import { ProtocolGenerator } from '../../../utils/protocol-generator';
import { AutomatedFeedbackLoop } from '../../../utils/feedback-loop';
import { serializePartsToSBOL, validateSBOL } from '../../../utils/sbol-serializer';
import { planGibsonAssembly, generateProvenanceRecords, exportPrimerOrderCSV } from '../../../utils/assembly-planner';
import type {
  DBTLIteration,
  GeneratedProtocol,
  FeedbackLoopResult,
  DBTLPhase,
  GeneticPart,
  SBOLDocument,
  GibsonAssemblyPlan,
  ProvenanceRecord,
} from '../../../types';
import { useWorkbenchStore } from '../../../store/workbenchStore';
import { buildLearnedDeltaPack } from '../../../services/learnedDeltaBuilder';
import type { LearnedDeltaPack } from '../../../types/learnedDelta';
import { buildDBTLDraft } from '../shared/workbenchDataflow';
import type { ToolTab } from '../shared/ToolTabBar';
import {
  PHASES,
  DBTL_DELTA_TARGET_TOOLS,
  sourceExperimentRecordIdsFromFeedback,
  sourceProvenanceIdsFromFeedback,
} from './sharedComponents';

/* ── Hook ── */
export function useDBTLState() {
  const generator = useMemo(() => new ProtocolGenerator(), []);
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const catalystPayload = useWorkbenchStore((s) => s.toolPayloads.catdes);
  const dynconPayload = useWorkbenchStore((s) => s.toolPayloads.dyncon);
  const cellfreePayload = useWorkbenchStore((s) => s.toolPayloads.cellfree);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);

  // Iteration state (preserved)
  const [iterations, setIterations] = useState<DBTLIteration[]>(INITIAL_ITERATIONS);
  const [hypothesis, setHypothesis] = useState('');
  const [result, setResult] = useState('');
  const [unit, setUnit] = useState('mg/L');
  const [passed, setPassed] = useState(true);
  const liveDraft = useMemo(
    () => buildDBTLDraft(project, analyzeArtifact, catalystPayload, dynconPayload, cellfreePayload),
    [analyzeArtifact?.generatedAt, analyzeArtifact?.id, catalystPayload?.updatedAt, cellfreePayload?.updatedAt, dynconPayload?.updatedAt, project?.id, project?.updatedAt],
  );

  useEffect(() => {
    setHypothesis(liveDraft.hypothesis);
    setResult(String(liveDraft.result));
    setUnit(liveDraft.unit);
    setPassed(liveDraft.passed);
  }, [liveDraft.hypothesis, liveDraft.passed, liveDraft.result, liveDraft.unit]);

  // Protocol state
  const [generatedProtocol, setGeneratedProtocol] = useState<GeneratedProtocol | null>(null);
  const [protocolExpanded, setProtocolExpanded] = useState(false);
  const [activityMessage, setActivityMessage] = useState<string | null>(null);
  const [activityTone, setActivityTone] = useState<'info' | 'success' | 'error'>('info');

  // Feedback loop state
  const [feedbackResult, setFeedbackResult] = useState<FeedbackLoopResult | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('cycle');
  const [dbtlError, setDbtlError] = useState<string | null>(null);
  const liveIteration = useMemo<DBTLIteration>(() => ({
    id: iterations.length + 1,
    phase: liveDraft.phase,
    hypothesis: liveDraft.hypothesis,
    result: liveDraft.result,
    unit: liveDraft.unit,
    passed: liveDraft.passed,
    notes: `Live handoff: ${liveDraft.notes}`,
  }), [iterations.length, liveDraft]);
  const parsedDraftResult = Number.parseFloat(result);
  const draftIteration = useMemo<DBTLIteration | null>(() => {
    if (!hypothesis.trim() || !result.trim() || Number.isNaN(parsedDraftResult)) return null;
    return {
      id: iterations.length + 1,
      phase: PHASES[iterations.length % PHASES.length],
      hypothesis: hypothesis.trim(),
      result: parsedDraftResult,
      unit: unit.trim() || liveDraft.unit,
      passed,
      notes: `Draft iteration preview: ${liveDraft.notes}`,
    };
  }, [hypothesis, iterations.length, liveDraft.notes, liveDraft.unit, parsedDraftResult, passed, result, unit]);
  const displayIterations = useMemo(() => {
    const activeIteration = draftIteration ?? liveIteration;
    const latest = iterations[iterations.length - 1];
    if (
      latest
      && latest.hypothesis === activeIteration.hypothesis
      && latest.result === activeIteration.result
      && latest.unit === activeIteration.unit
    ) {
      return iterations;
    }
    return [...iterations, activeIteration];
  }, [draftIteration, iterations, liveIteration]);
  const committedIterations = iterations;
  const committedBestIteration = committedIterations.reduce((a, b) => (b.result > a.result ? b : a), committedIterations[0]);
  const committedImprovementRate =
    committedIterations.length > 1
      ? ((committedIterations[committedIterations.length - 1].result - committedIterations[0].result) / (committedIterations.length - 1)).toFixed(2)
      : '0';
  const committedPassRate = ((committedIterations.filter(i => i.passed).length / committedIterations.length) * 100).toFixed(0);
  const latestCommittedIteration = committedIterations[committedIterations.length - 1];
  const hasCommittedFeedback = iterations.length > INITIAL_ITERATIONS.length || Boolean(feedbackResult);

  // Derived values (preserved)
  const bestIteration = displayIterations.reduce((a, b) => (b.result > a.result ? b : a), displayIterations[0]);
  const improvementRate =
    displayIterations.length > 1
      ? ((displayIterations[displayIterations.length - 1].result - displayIterations[0].result) / (displayIterations.length - 1)).toFixed(2)
      : '0';
  const passRate = ((displayIterations.filter(i => i.passed).length / displayIterations.length) * 100).toFixed(0);

  const latestIteration = displayIterations[displayIterations.length - 1];
  const currentPhase: DBTLPhase = latestIteration?.phase ?? 'Design';
  const feedbackGateLabel = hasCommittedFeedback
    ? `Committed feedback recorded · iteration #${latestCommittedIteration?.id ?? '—'} requires approved typed deltas before reseeding`
    : 'Draft-only feedback · upstream reseeding remains locked until committed, typed, and approved deltas exist';
  const computedDeltaPacks = useMemo<LearnedDeltaPack[]>(() => {
    if (!hasCommittedFeedback || !latestCommittedIteration) return [];
    const sourceExperimentRecordIds = sourceExperimentRecordIdsFromFeedback(feedbackResult, liveDraft.feedback);
    if (sourceExperimentRecordIds.length === 0) return [];

    const sourceDbtlRunId = `dbtlflow:iteration:${latestCommittedIteration.id}`;
    return [
      buildLearnedDeltaPack({
        deltaPackId: `learned-delta-pack-v1:${sourceDbtlRunId}`,
        iteration: latestCommittedIteration.id,
        sourceDbtlRunId,
        sourceExperimentRecordIds,
        sourceProvenanceIds: sourceProvenanceIdsFromFeedback(liveDraft.feedback),
        targetToolIds: DBTL_DELTA_TARGET_TOOLS,
        learnedMetrics: liveDraft.feedback.learnedMetrics,
        createdAt: new Date().toISOString(),
        createdBy: 'dbtlflow',
        notes: 'Pending DBTL loop-back delta pack. Seed builders ignore this pack until humanGateStatus is approved.',
      }),
    ];
  }, [feedbackResult, hasCommittedFeedback, latestCommittedIteration, liveDraft.feedback]);

  // Mutable delta packs state — allows human approval/rejection
  const [learnedDeltaPacks, setLearnedDeltaPacks] = useState<LearnedDeltaPack[]>([]);
  useEffect(() => {
    setLearnedDeltaPacks((prev) => {
      // Merge: preserve any human gate decisions already made on matching packs
      const prevStatusMap = new Map(prev.map((p) => [p.deltaPackId, p.humanGateStatus]));
      return computedDeltaPacks.map((pack) => {
        const existingStatus = prevStatusMap.get(pack.deltaPackId);
        if (existingStatus && existingStatus !== 'pending') {
          return { ...pack, humanGateStatus: existingStatus };
        }
        return pack;
      });
    });
  }, [computedDeltaPacks]);

  function approveDeltaPack(deltaPackId: string) {
    setLearnedDeltaPacks((prev) =>
      prev.map((p) =>
        p.deltaPackId === deltaPackId ? { ...p, humanGateStatus: 'approved' as const } : p,
      ),
    );
    setActivityTone('success');
    setActivityMessage(`Delta pack approved. Upstream seed builders can now apply these learned parameters.`);
  }

  function rejectDeltaPack(deltaPackId: string) {
    setLearnedDeltaPacks((prev) =>
      prev.map((p) =>
        p.deltaPackId === deltaPackId ? { ...p, humanGateStatus: 'rejected' as const } : p,
      ),
    );
    setActivityTone('info');
    setActivityMessage(`Delta pack rejected. Upstream seed builders will not apply these learned parameters.`);
  }
  const figureMeta = useMemo(() => ({
    eyebrow: 'Campaign figure',
    title: `DBTL is framed as a governed experimental ledger with ${currentPhase.toLowerCase()} in focus`,
    caption: 'The page now treats the loop as a scientific record: cycle state, iteration trajectory, and promotion status are read together instead of being scattered across utility cards.',
  }), [currentPhase]);

  useEffect(() => {
    setToolPayload('dbtlflow', {
      validity: 'partial',
      toolId: 'dbtlflow',
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
      sourceArtifactId: analyzeArtifact?.id,
      proposedPhase: liveDraft.phase,
      draftHypothesis: liveDraft.hypothesis,
      measuredResult: liveDraft.result,
      unit: liveDraft.unit,
      passed: liveDraft.passed,
      feedbackSource: hasCommittedFeedback ? 'committed' : 'draft',
      feedbackIterationId: latestCommittedIteration?.id ?? null,
      result: {
        bestIteration: committedBestIteration.id,
        improvementRate: parseFloat(committedImprovementRate),
        passRate: parseFloat(committedPassRate),
        latestPhase: latestCommittedIteration?.phase ?? currentPhase,
        feedback: liveDraft.feedback,
        learnedDeltaPacks,
        learnedParameters: liveDraft.learnedParameters,
      },
      updatedAt: Date.now(),
    });
  }, [
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    committedBestIteration.id,
    committedImprovementRate,
    committedPassRate,
    currentPhase,
    hasCommittedFeedback,
    learnedDeltaPacks,
    liveDraft.feedback,
    liveDraft.hypothesis,
    liveDraft.learnedParameters,
    liveDraft.passed,
    liveDraft.phase,
    liveDraft.result,
    liveDraft.unit,
    latestCommittedIteration?.id,
    latestCommittedIteration?.phase,
    project?.targetProduct,
    project?.title,
    setToolPayload,
  ]);

  /* ── Handlers ── */
  function addIteration() {
    if (!hypothesis.trim() || !result.trim()) return;
    const numericResult = Number.parseFloat(result);
    if (Number.isNaN(numericResult)) {
      setActivityTone('error');
      setActivityMessage('Iteration not added. Result must be a valid number.');
      return;
    }
    try {
      setIterations(prev => appendIteration(prev, hypothesis.trim(), numericResult, unit.trim() || liveDraft.unit, passed, liveDraft.notes));
      setHypothesis('');
      setResult('');
      setActivityTone('success');
      setActivityMessage(`Iteration #${iterations.length + 1} committed to the ledger at ${numericResult.toFixed(1)} ${unit.trim() || liveDraft.unit}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add iteration';
      setDbtlError(msg);
    }
  }

  function handleGenerateProtocol() {
    const protocolSource = draftIteration ?? latestIteration;
    if (!protocolSource) return;
    try {
      const proto = generator.generate(protocolSource);
      setGeneratedProtocol(proto);
      setProtocolExpanded(true);
      setActivityTone('success');
      setActivityMessage(`Protocol generated for ${protocolSource.phase.toLowerCase()} iteration #${protocolSource.id}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Protocol generation failed';
      setDbtlError(msg);
    }
  }

  function handleDownloadProtocol() {
    if (!generatedProtocol) return;
    const blob = new Blob([generatedProtocol.python_code], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedProtocol.metadata.protocolName.replace(/\s+/g, '_')}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !latestIteration) return;
    setFeedbackLoading(true);
    setFeedbackError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const csvText = reader.result as string;
      try {
        const fbResult = await AutomatedFeedbackLoop(csvText, latestIteration, 10, 20);
        setFeedbackResult(fbResult);
      } catch (error) {
        setFeedbackResult(null);
        setFeedbackError(error instanceof Error ? error.message : 'Authority-backed DBTL validation failed');
      } finally {
        setFeedbackLoading(false);
      }
    };
    reader.readAsText(file);
  }

  // ── SBOL 3.0 Export ──
  const [sbolDoc, setSbolDoc] = useState<SBOLDocument | null>(null);
  const [sbolValidation, setSbolValidation] = useState<string[]>([]);
  const SHOWCASE_PARTS: GeneticPart[] = useMemo(() => [
    { id: 'pGAL1', type: 'promoter', strength: 0.85, label: 'GAL1 Promoter' },
    { id: 'B0034', type: 'rbs', strength: 1.0, label: 'RBS B0034' },
    { id: 'ADS_CDS', type: 'cds', strength: 0.9, label: 'ADS (Amorphadiene Synthase)' },
    { id: 'T_CYC1', type: 'terminator', strength: 0.95, label: 'CYC1 Terminator' },
  ], []);

  function handleSBOLExport() {
    try {
      const constructName = hypothesis.trim()
        ? hypothesis.trim().slice(0, 48).replace(/[^a-z0-9]+/gi, '_')
        : 'ADS_Expression_Cassette';
      const doc = serializePartsToSBOL(SHOWCASE_PARTS, constructName);
      setSbolDoc(doc);
      setSbolValidation(validateSBOL(doc));
      setActivityTone('success');
      setActivityMessage(`SBOL package generated with ${doc.components.length} components and ${doc.interactions.length} interactions.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SBOL export failed';
      setDbtlError(msg);
    }
  }

  function handleDownloadSBOL(format: 'xml' | 'turtle') {
    if (!sbolDoc) return;
    const content = format === 'xml' ? sbolDoc.serializedXml : sbolDoc.serializedTurtle;
    const mimeType = format === 'xml' ? 'application/rdf+xml' : 'text/turtle';
    const ext = format === 'xml' ? '.rdf' : '.ttl';
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = sbolDoc.displayId + ext;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  // ── Gibson Assembly ──
  const [assemblyPlan, setAssemblyPlan] = useState<GibsonAssemblyPlan | null>(null);
  const [assemblyProvenance, setAssemblyProvenance] = useState<ProvenanceRecord[]>([]);
  const [seqInput, setSeqInput] = useState('');
  const [assemblyExpanded, setAssemblyExpanded] = useState(false);
  const [assemblyError, setAssemblyError] = useState<string | null>(null);

  function handlePlanAssembly() {
    const rawSequence = seqInput.trim().toUpperCase();
    if (rawSequence && /[^ATCG]/.test(rawSequence)) {
      setAssemblyError('Assembly planning accepts DNA sequences with A, T, C, and G only.');
      setActivityTone('error');
      setActivityMessage('Assembly plan not generated. Remove non-DNA characters and try again.');
      return;
    }
    const seq = rawSequence || DEMO_SEQ;
    if (rawSequence && seq.length < 100) {
      setAssemblyError('Assembly planning needs at least 100 bp of DNA to build a meaningful fragment map.');
      setActivityTone('error');
      setActivityMessage('Assembly plan not generated. Provide a longer DNA sequence or use the demo cassette.');
      return;
    }
    setAssemblyError(null);
    try {
      const plan = planGibsonAssembly(seq, 'ADS_Cassette', { maxFragmentLength: 800, overlapLength: 30 });
      setAssemblyPlan(plan);
      setAssemblyProvenance(generateProvenanceRecords(plan));
      setAssemblyExpanded(true);
      setActivityTone('success');
      setActivityMessage(`Assembly plan generated for ${plan.fragments.length} fragments with ${plan.primers.length} primers.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Assembly planning failed';
      setDbtlError(msg);
    }
  }

  function handleDownloadPrimers() {
    if (!assemblyPlan) return;
    const csv = exportPrimerOrderCSV(assemblyPlan);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = assemblyPlan.targetName + '_primers.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function handleGenerateGibsonProtocol() {
    if (!assemblyPlan) return;
    const proto = generator.generateGibsonAssembly(assemblyPlan, assemblyProvenance);
    setGeneratedProtocol(proto);
    setProtocolExpanded(true);
  }

  /* ── Tab definitions ── */
  const tabs: ToolTab[] = [
    { id: 'cycle', label: 'Cycle' },
    { id: 'iterations', label: 'Iterations' },
    { id: 'protocol', label: 'Protocol' },
    { id: 'deltapack', label: 'Delta Pack' },
    { id: 'gibson', label: 'Gibson Assembly' },
    { id: 'closedloop', label: 'Closed-Loop' },
  ];

  return {
    // Workbench store
    project,
    analyzeArtifact,
    // Iterations
    iterations,
    hypothesis,
    setHypothesis,
    result,
    setResult,
    unit,
    setUnit,
    passed,
    setPassed,
    addIteration,
    displayIterations,
    committedIterations,
    // Protocol
    generatedProtocol,
    protocolExpanded,
    setProtocolExpanded,
    handleGenerateProtocol,
    handleDownloadProtocol,
    // Feedback
    feedbackResult,
    feedbackLoading,
    feedbackError,
    handleCSVUpload,
    // SBOL
    sbolDoc,
    sbolValidation,
    handleSBOLExport,
    handleDownloadSBOL,
    // Assembly
    assemblyPlan,
    assemblyProvenance,
    seqInput,
    setSeqInput,
    assemblyExpanded,
    setAssemblyExpanded,
    assemblyError,
    handlePlanAssembly,
    handleDownloadPrimers,
    handleGenerateGibsonProtocol,
    // Derived
    bestIteration,
    improvementRate,
    passRate,
    latestIteration,
    currentPhase,
    feedbackGateLabel,
    hasCommittedFeedback,
    committedBestIteration,
    committedImprovementRate,
    committedPassRate,
    latestCommittedIteration,
    liveDraft,
    draftIteration,
    figureMeta,
    // Delta packs
    learnedDeltaPacks,
    computedDeltaPacks,
    approveDeltaPack,
    rejectDeltaPack,
    // UI state
    activeTab,
    setActiveTab,
    dbtlError,
    setDbtlError,
    activityMessage,
    activityTone,
    // Tabs
    tabs,
  };
}

/* ── Demo Sequence (constant, moved here from component scope) ── */
export const DEMO_SEQ = 'ATGCTTCAGCTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCAATTTTGATTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGG';
