'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import { INITIAL_ITERATIONS, appendIteration } from '../../data/mockDBTL';
import { ProtocolGenerator } from '../../utils/protocol-generator';
import { AutomatedFeedbackLoop } from '../../utils/feedback-loop';
import { serializePartsToSBOL, validateSBOL } from '../../utils/sbol-serializer';
import { planGibsonAssembly, generateProvenanceRecords, exportPrimerOrderCSV } from '../../utils/assembly-planner';
import type {
  DBTLIteration,
  GeneratedProtocol,
  FeedbackLoopResult,
  QCFlag,
  NextIterationSuggestion,
  DBTLPhase,
  GeneticPart,
  SBOLDocument,
  GibsonAssemblyPlan,
  ProvenanceRecord,
} from '../../types';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { buildLearnedDeltaPack } from '../../services/learnedDeltaBuilder';
import type { DBTLLearnedFeedback } from '../../types/dbtlFeedback';
import type { LearnedDeltaPack } from '../../types/learnedDelta';
import { buildDBTLDraft } from './shared/workbenchDataflow';
import ScientificHero from './shared/ScientificHero';
import { THEME, TOOL_RESULT_PALETTE } from '../../theme';
import { SEMANTIC_RGB } from '../charts/chartTheme';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import ScientificMethodStrip from './shared/ScientificMethodStrip';
import ActionButton from './shared/ActionButton';
import ToolShell from './shared/ToolShell';
import type { ToolTab } from './shared/ToolTabBar';
import ToolTabPanel from './shared/ToolTabPanel';
import FloatingControlRail from './shared/FloatingControlRail';

/* ── Design Tokens ── */
const PHASE_PASTEL: Record<string, string> = {
  Design: THEME.lilac,
  Build:  THEME.apricot,
  Test:   THEME.coral,
  Learn:  THEME.mint,
};

const PHASES: DBTLPhase[] = ['Design', 'Build', 'Test', 'Learn'];
const DBTL_DELTA_TARGET_TOOLS = ['fbasim', 'catdes', 'dyncon', 'cellfree'];

function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.filter((item) => item.trim().length > 0)));
}

function sourceExperimentRecordIdsFromFeedback(
  result: FeedbackLoopResult | null,
  feedback: DBTLLearnedFeedback,
): string[] {
  return uniqueStrings([
    ...(result?.sourceExperimentRecordIds ?? []),
    ...feedback.sources.flatMap((source) => [
      ...(source.sourceExperimentRecordIds ?? []),
      ...(source.experimentRecordId ? [source.experimentRecordId] : []),
    ]),
  ]);
}

function sourceProvenanceIdsFromFeedback(feedback: DBTLLearnedFeedback): string[] {
  return uniqueStrings(feedback.sources.flatMap((source) =>
    source.provenanceEntryId ? [source.provenanceEntryId] : []
  ));
}

/* ── Timeline (preserved) ── */
function Timeline({ iterations }: { iterations: DBTLIteration[] }) {
  const maxResult = Math.max(...iterations.map(i => i.result));
  const targetThreshold = maxResult * 0.72;

  return (
    <svg role="img" aria-label="Chart"
      viewBox={`0 0 520 ${Math.max(360, iterations.length * 60 + 40)}`}
      style={{ width: '100%', height: '100%' }}
    >
      <rect width="520" height={Math.max(360, iterations.length * 60 + 40)} fill="#05070b" rx="14" />
      <rect x="18" y="18" width="484" height={Math.max(320, iterations.length * 60)} rx="14" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" />
      <text x="36" y="14" fontFamily={THEME.SANS} fontSize="10" fill={THEME.paperLabel} letterSpacing="0.12em">DBTL AUDIT TIMELINE</text>
      <text x="36" y="28" fontFamily={THEME.SANS} fontSize="11" fill={THEME.paperValue}>Iteration trace with phase identity, result magnitude, and pass gate</text>
      {iterations.length > 1 && (
        <polyline
          points={iterations
            .map((it, i) => `${160 + (it.result / maxResult) * 280},${30 + i * 60 + 33}`)
            .join(' ')}
          fill="none"
          stroke="#FF7F00"
          strokeWidth={1.8}
          strokeDasharray="4 2"
          strokeOpacity={0.75}
        />
      )}
      <line x1={160} y1={20} x2={160} y2={30 + iterations.length * 60} stroke="rgba(255,255,255,0.08)" />
      <line x1={160 + (targetThreshold / maxResult) * 280} y1={20} x2={160 + (targetThreshold / maxResult) * 280} y2={30 + iterations.length * 60} stroke="rgba(255,139,31,0.24)" strokeDasharray="5 4" />
      {iterations.map((it, i) => {
        const y = 30 + i * 60;
        const barW = (it.result / maxResult) * 280;
        const phaseColor = PHASE_PASTEL[it.phase] ?? 'rgba(255,255,255,0.4)';
        return (
          <g key={it.id}>
            <rect x={4} y={y + 8} width={60} height={18} rx="3"
              fill={phaseColor} fillOpacity={0.15} stroke={phaseColor} strokeWidth={1} />
            <text x={34} y={y + 20} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={phaseColor}>
              {it.phase.toUpperCase()}
            </text>
            <text x={80} y={y + 20} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.3)">
              #{it.id}
            </text>
            <text x={100} y={y + 20} fontFamily={THEME.SANS} fontSize="10" fill="rgba(255,255,255,0.5)">
              {it.hypothesis.slice(0, 40)}{it.hypothesis.length > 40 ? '…' : ''}
            </text>
            <rect x={160} y={y + 28} width={barW} height={10} rx="2"
              fill={it.passed ? `rgba(${SEMANTIC_RGB.pass}, 0.42)` : `rgba(${SEMANTIC_RGB.fail}, 0.36)`}
              stroke={it.passed ? `rgba(${SEMANTIC_RGB.pass}, 0.72)` : `rgba(${SEMANTIC_RGB.fail}, 0.58)`}
              strokeWidth={1}
            />
            <text x={160 + barW + 6} y={y + 38} fontFamily={THEME.MONO} fontSize="10"
              fill={it.passed ? `rgba(${SEMANTIC_RGB.pass}, 0.85)` : `rgba(${SEMANTIC_RGB.fail}, 0.78)`}>
              {it.result} {it.unit}
            </text>
            <circle cx={440} cy={y + 22} r={5}
              fill={it.passed ? `rgba(${SEMANTIC_RGB.pass}, 0.75)` : `rgba(${SEMANTIC_RGB.fail}, 0.7)`} />
            <line x1={4} y1={y + 52} x2={480} y2={y + 52} stroke="rgba(255,255,255,0.04)" />
          </g>
        );
      })}
      <text x={160 + (targetThreshold / maxResult) * 280 + 4} y={18} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,139,31,0.78)">
        target band
      </text>
      <text x={160} y={30 + iterations.length * 60 + 16} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.2)">
        0
      </text>
      <text x={440} y={30 + iterations.length * 60 + 16} fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.2)">
        {maxResult.toFixed(0)} {iterations[0]?.unit}
      </text>
    </svg>
  );
}

/* ── Apple-style Cycle Progress Ring ── */
function CycleProgressRing({
  currentPhase,
  iterationCount,
}: {
  currentPhase: DBTLPhase;
  iterationCount: number;
}) {
  const phaseIndex = PHASES.indexOf(currentPhase);
  const progress = (phaseIndex + 1) / PHASES.length; // 0.25 → 1.0
  const size = 140;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0' }}>
      <svg role="img" aria-label="Chart" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="pathd-progress-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={THEME.blue} />
            <stop offset="50%" stopColor={THEME.indigo} />
            <stop offset="100%" stopColor={THEME.orange} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={THEME.progressTrack} strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="url(#pathd-progress-ring)" strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        />
      </svg>
      {/* Center labels (overlaid) */}
      <div style={{
        marginTop: -size + stroke,
        width: size,
        height: size - stroke * 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{
          fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', fontWeight: 600,
          color: THEME.orange, letterSpacing: '0.04em',
        }}>
          {currentPhase.toUpperCase()}
        </span>
        <span style={{
          fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-lg)', fontWeight: 700,
          color: THEME.paperValue, marginTop: '2px',
        }}>
          {iterationCount}
        </span>
        <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>
          iterations
        </span>
      </div>
    </div>
  );
}

/* ── Main Page Component ── */
export default function DBTLflowPage() {
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
    setIterations(prev => appendIteration(prev, hypothesis.trim(), numericResult, unit.trim() || liveDraft.unit, passed, liveDraft.notes));
    setHypothesis('');
    setResult('');
    setActivityTone('success');
    setActivityMessage(`Iteration #${iterations.length + 1} committed to the ledger at ${numericResult.toFixed(1)} ${unit.trim() || liveDraft.unit}.`);
  }

  function handleGenerateProtocol() {
    const protocolSource = draftIteration ?? latestIteration;
    if (!protocolSource) return;
    const proto = generator.generate(protocolSource);
    setGeneratedProtocol(proto);
    setProtocolExpanded(true);
    setActivityTone('success');
    setActivityMessage(`Protocol generated for ${protocolSource.phase.toLowerCase()} iteration #${protocolSource.id}.`);
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
    const constructName = hypothesis.trim()
      ? hypothesis.trim().slice(0, 48).replace(/[^a-z0-9]+/gi, '_')
      : 'ADS_Expression_Cassette';
    const doc = serializePartsToSBOL(SHOWCASE_PARTS, constructName);
    setSbolDoc(doc);
    setSbolValidation(validateSBOL(doc));
    setActivityTone('success');
    setActivityMessage(`SBOL package generated with ${doc.components.length} components and ${doc.interactions.length} interactions.`);
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
  const DEMO_SEQ = 'ATGCTTCAGCTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCAATTTTGATTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGG';

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
    const plan = planGibsonAssembly(seq, 'ADS_Cassette', { maxFragmentLength: 800, overlapLength: 30 });
    setAssemblyPlan(plan);
    setAssemblyProvenance(generateProvenanceRecords(plan));
    setAssemblyExpanded(true);
    setActivityTone('success');
    setActivityMessage(`Assembly plan generated for ${plan.fragments.length} fragments with ${plan.primers.length} primers.`);
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

  /* ── Shared input style ── */
  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '5px 8px',
    boxSizing: 'border-box',
    background: THEME.paperSurfaceStrong,
    border: `1px solid ${THEME.paperBorder}`,
    borderRadius: 'var(--nb-radius-sm)',
    color: THEME.paperValue,
    fontFamily: THEME.MONO,
    fontSize: 'var(--nb-fs-sm)',
    outline: '2px solid rgba(175,195,214,0.5)',
    outlineOffset: '2px',
  };

  const sectionLabel: React.CSSProperties = {
    fontFamily: THEME.SANS,
    fontSize: 'var(--nb-fs-xs)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: THEME.paperLabel,
    margin: '0 0 12px',
  };

  /* ── Tab definitions ── */
  const tabs: ToolTab[] = [
    { id: 'cycle', label: 'Cycle' },
    { id: 'iterations', label: 'Iterations' },
    { id: 'protocol', label: 'Protocol' },
    { id: 'deltapack', label: 'Delta Pack' },
    { id: 'gibson', label: 'Gibson Assembly' },
    { id: 'closedloop', label: 'Closed-Loop' },
  ];

  /* ── Render ── */
  return (
    <ToolShell
      moduleId="dbtlflow"
      title="DBTL Cycle Tracker"
      description="Design-Build-Test-Learn cycle management with protocol generation and SBOL export"
      formula="Cycle: D→B→T→L→D'"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={['protocol', 'deltapack', 'gibson']}
    >
      {/* ═══════ CYCLE TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="cycle">
        <div style={{ padding: '0 16px 4px' }}>
          <ScientificHero
            eyebrow="Stage 4 · Test, Learn, Reseed"
            title="Closed-loop iteration is now an explicit governed object"
            summary="DBTLflow is no longer just a list of experiments. It is the workbench’s decision gate: draft learning stays visible, committed learning becomes canonical, and approved typed deltas are required before upstream reseeding."
            aside={
              <>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Current loop status
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.value, fontWeight: 700 }}>
                  {hasCommittedFeedback ? 'Committed learn loop is active' : 'Draft learn loop awaiting commit'}
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.label, lineHeight: 1.55 }}>
                  {feedbackGateLabel}
                </div>
              </>
            }
            signals={[
              {
                label: 'Current Phase',
                value: currentPhase,
                detail: `${displayIterations.length} total recorded iterations in the visible cycle.`,
                tone: 'neutral',
              },
              {
                label: 'Pass Rate',
                value: `${passRate}%`,
                detail: `Committed pass rate ${committedPassRate}% across the canonical reviewable record.`,
                tone: Number(passRate) >= 70 ? 'cool' : 'warm',
              },
              {
                label: 'Best Result',
                value: `${bestIteration.result} ${bestIteration.unit}`,
                detail: bestIteration.hypothesis,
                tone: 'cool',
              },
              {
                label: 'Improvement Velocity',
                value: `${improvementRate}/${unit}`,
                detail: hasCommittedFeedback ? 'Approved typed deltas are still required before seed builders can apply changes.' : 'Learning is still visible, but not yet cleared for upstream reseeding.',
                tone: hasCommittedFeedback ? 'warm' : 'alert',
              },
            ]}
          />
        </div>

        <div style={{ padding: '0 16px 6px' }}>
          <div
            style={{
              borderRadius: 'var(--nb-radius-md)',
              border: `1px solid ${hasCommittedFeedback ? 'rgba(158,215,199,0.22)' : 'rgba(255,192,128,0.24)'}`,
              background: hasCommittedFeedback ? 'rgba(158,215,199,0.10)' : 'rgba(255,192,128,0.08)',
              padding: '8px 10px',
              display: 'grid',
              gap: '3px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Closed-loop gate
              </span>
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: '999px',
                  border: `1px solid ${hasCommittedFeedback ? 'rgba(158,215,199,0.3)' : 'rgba(255,192,128,0.3)'}`,
                  background: hasCommittedFeedback ? 'rgba(158,215,199,0.16)' : 'rgba(255,192,128,0.14)',
                  color: hasCommittedFeedback ? 'rgba(224,244,238,0.92)' : 'rgba(255,219,180,0.92)',
                  fontFamily: THEME.MONO,
                  fontSize: 'var(--nb-fs-xs)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {hasCommittedFeedback ? 'Feedback Applied' : 'Awaiting Commit'}
              </span>
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.paperValue, lineHeight: 1.45 }}>
              {feedbackGateLabel}
            </div>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, lineHeight: 1.4 }}>
              committed pass rate {committedPassRate}% · committed improvement {committedImprovementRate} · latest committed phase {latestCommittedIteration?.phase ?? 'Design'}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px 4px' }}>
          <ScientificMethodStrip
            label="Campaign bench"
            items={[
              {
                title: 'Draft iteration',
                detail: 'Hypothesis, result, and pass/fail stay editable on the left so the next cycle enters the record with explicit context instead of becoming anonymous row data.',
                accent: THEME.apricot,
                note: `phase ${currentPhase}`,
              },
              {
                title: 'Governed figure',
                detail: 'Progress ring, phase legend, and iteration timeline are merged into one figure frame so experimental history reads like a ledger panel, not a utility dashboard.',
                accent: THEME.sky,
                note: `${displayIterations.length} visible iterations`,
              },
              {
                title: 'Reseeding gate',
                detail: 'Automation, provenance, and feedback remain attached on the right so only governed learn output can return upstream.',
                accent: THEME.mint,
                note: hasCommittedFeedback ? 'committed feedback live' : 'draft feedback only',
              },
            ]}
          />
        </div>

        <div style={{ padding: '0 16px 6px' }}>
          <div
            style={{
              borderRadius: 'var(--nb-radius-md)',
              border: `1px solid ${activityTone === 'error'
                ? 'rgba(232,163,161,0.34)'
                : draftIteration
                  ? 'rgba(175,195,214,0.32)'
                  : 'rgba(191,220,205,0.32)'}`,
              background: activityTone === 'error'
                ? 'rgba(232,163,161,0.10)'
                : draftIteration
                  ? 'rgba(175,195,214,0.10)'
                  : 'rgba(191,220,205,0.10)',
              padding: '8px 10px',
              display: 'grid',
              gap: '3px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Draft + action status
              </span>
              {draftIteration && (
                <span
                  style={{
                    padding: '2px 7px',
                    borderRadius: '999px',
                    border: '1px solid rgba(175,195,214,0.34)',
                    background: 'rgba(175,195,214,0.16)',
                    color: THEME.paperValue,
                    fontFamily: THEME.MONO,
                    fontSize: 'var(--nb-fs-xs)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  Previewing draft iteration #{draftIteration.id}
                </span>
              )}
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.paperValue, lineHeight: 1.45 }}>
              {activityMessage
                ?? (draftIteration
                  ? `The figure and campaign cards are previewing your current draft at ${draftIteration.result.toFixed(1)} ${draftIteration.unit} before commit.`
                  : 'Commit a new iteration or generate a protocol to create a visible experimental artifact.')}
            </div>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>
              {draftIteration
                ? `${draftIteration.phase} preview · ${draftIteration.passed ? 'pass' : 'fail'} gate · commit required for canonical history`
                : 'canonical history updates only after + Add Iteration'}
            </div>
          </div>
        </div>

        <div className="nb-tool-panels" style={{ flex: 1 }}>

          {/* ═══════ LEFT PANEL: Input + Protocol ═══════ */}
          <div className="nb-tool-sidebar" style={{
            width: '260px', flexShrink: 0, padding: '16px',
            borderRight: `1px solid ${THEME.paperBorder}`, background: THEME.sepiaPanelMuted,
          }}>
            <p style={sectionLabel}>Add Iteration</p>

            {/* Hypothesis */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.paperLabel, display: 'block', marginBottom: '4px' }}>
                Hypothesis
              </label>
              <textarea
                value={hypothesis}
                onChange={e => setHypothesis(e.target.value)}
                placeholder="Describe the engineering hypothesis..."
                rows={3}
                style={{
                  ...inputBase,
                  padding: '6px 8px',
                  fontFamily: THEME.SANS,
                  fontSize: 'var(--nb-fs-sm)',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Result + Unit */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.paperLabel, display: 'block', marginBottom: '4px' }}>
                  Result
                </label>
                <input
                  type="number"
                  value={result}
                  onChange={e => setResult(e.target.value)}
                  placeholder="0.0"
                  style={inputBase}
                />
              </div>
              <div style={{ width: '70px' }}>
                <label style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.paperLabel, display: 'block', marginBottom: '4px' }}>
                  Unit
                </label>
                <input
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  style={{ ...inputBase, padding: '5px 6px', fontSize: 'var(--nb-fs-sm)' }}
                />
              </div>
            </div>

            {/* Pass / Fail */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {([true, false] as const).map(p => (
                <button aria-label={p ? 'Mark iteration as pass' : 'Mark iteration as fail'} key={String(p)} onClick={() => setPassed(p)}
                  className={`nb-tool-toggle ${passed === p ? 'nb-tool-toggle--active' : ''}`}
                  style={{
                  flex: 1, padding: '6px',
                  background: passed === p ? (p ? 'rgba(191,220,205,0.2)' : 'rgba(232,163,161,0.18)') : undefined,
                  borderColor: passed === p ? (p ? 'rgba(191,220,205,0.34)' : 'rgba(232,163,161,0.34)') : undefined,
                  borderRadius: 'var(--nb-radius-sm)',
                  color: passed === p ? THEME.paperValue : undefined,
                }}>
                  {p ? '✓ Pass' : '✗ Fail'}
                </button>
              ))}
            </div>

            {/* Add iteration button */}
            <ActionButton
              variant="primary"
              size="md"
              aria-label="Add DBTL iteration"
              onClick={addIteration}
              disabled={!hypothesis.trim() || !result.trim()}
              style={{ width: '100%' }}
            >
              + Add Iteration
            </ActionButton>

            {/* Best Result */}
            <div style={{
              marginTop: '16px', padding: '10px',
              background: 'rgba(191,220,205,0.18)', borderRadius: 'var(--nb-radius-md)',
              border: '1px solid rgba(191,220,205,0.34)',
            }}>
              <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Best Result
              </p>
              <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-md)', color: THEME.paperValue, margin: '0 0 4px' }}>
                {bestIteration?.result} {bestIteration?.unit}
              </p>
              <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: 0, lineHeight: 1.4 }}>
                {bestIteration?.hypothesis.slice(0, 60)}…
              </p>
            </div>

            {/* ── Protocol Generation ── */}
            <div style={{ marginTop: '16px' }}>
              <p style={sectionLabel}>Protocol Generation</p>
              <ActionButton
                variant="secondary"
                size="md"
                aria-label="Generate protocol"
                onClick={handleGenerateProtocol}
                disabled={!latestIteration}
                style={{ width: '100%', background: 'rgba(207,196,227,0.2)', borderColor: 'rgba(207,196,227,0.34)' }}
              >
                ⚗ Generate Protocol
              </ActionButton>

              {generatedProtocol && (
                <div style={{ background: THEME.paperSurfaceStrong, border: `1px solid ${THEME.paperBorder}`, borderRadius: 'var(--nb-radius-xl)', marginTop: '10px', padding: '12px' }}>
                  <div
                    onClick={() => setProtocolExpanded(prev => !prev)}
                    style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, fontWeight: 500 }}>
                      {generatedProtocol.metadata.protocolName}
                    </span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>
                      {protocolExpanded ? '▾' : '▸'}
                    </span>
                  </div>

                  {protocolExpanded && (
                    <div style={{ marginTop: '8px' }}>
                      <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: '0 0 4px' }}>
                        {generatedProtocol.metadata.description}
                      </p>
                      <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: '0 0 8px' }}>
                        API {generatedProtocol.api_version} · {generatedProtocol.labware.length} labware · {generatedProtocol.pipetting_logic.length} steps
                      </p>
                      <ActionButton
                        variant="secondary"
                        size="sm"
                        aria-label="Download Python protocol"
                        onClick={handleDownloadProtocol}
                        style={{ width: '100%', background: 'rgba(207,196,227,0.22)', borderColor: 'rgba(207,196,227,0.34)' }}
                      >
                        ↓ Download .py
                      </ActionButton>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── SBOL 3.0 Export ── */}
            <div style={{ marginTop: '16px' }}>
              <p style={sectionLabel}>SBOL 3.0 Export</p>
              <ActionButton
                variant="secondary"
                size="md"
                aria-label="Serialize to SBOL 3.0"
                onClick={handleSBOLExport}
                style={{ width: '100%', background: 'rgba(175,195,214,0.2)', borderColor: 'rgba(175,195,214,0.34)' }}
              >
                ◎ Serialize to SBOL 3.0
              </ActionButton>
              {sbolDoc && (
                <div style={{ background: THEME.paperSurfaceStrong, border: `1px solid ${THEME.paperBorder}`, borderRadius: 'var(--nb-radius-xl)', marginTop: '10px', padding: '12px' }}>
                  <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, fontWeight: 500, margin: '0 0 6px' }}>
                    {sbolDoc.name}
                  </p>
                  <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: '0 0 8px' }}>
                    {sbolDoc.components.length} components · {sbolDoc.interactions.length} interactions
                  </p>
                  {sbolValidation.map((v, i) => (
                    <p key={i} style={{
                      fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', margin: '0 0 3px', lineHeight: 1.3,
                      color: v.startsWith('VALID') ? THEME.mint :
                             v.startsWith('ERROR') ? THEME.coral :
                             THEME.apricot,
                    }}>
                      {v}
                    </p>
                  ))}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <ActionButton
                      variant="secondary"
                      size="sm"
                      aria-label="Download SBOL as RDF/XML"
                      onClick={() => handleDownloadSBOL('xml')}
                      style={{ flex: 1, background: 'rgba(175,195,214,0.22)', borderColor: 'rgba(175,195,214,0.34)' }}
                    >
                      ↓ RDF/XML
                    </ActionButton>
                    <ActionButton
                      variant="secondary"
                      size="sm"
                      aria-label="Download SBOL as Turtle"
                      onClick={() => handleDownloadSBOL('turtle')}
                      style={{ flex: 1, background: 'rgba(207,196,227,0.22)', borderColor: 'rgba(207,196,227,0.34)' }}
                    >
                      ↓ Turtle
                    </ActionButton>
                  </div>
                </div>
              )}
            </div>

            {/* ── Gibson Assembly Planner ── */}
            <div style={{ marginTop: '16px' }}>
              <p style={sectionLabel}>Gibson Assembly</p>
              <textarea
                value={seqInput} onChange={e => setSeqInput(e.target.value)}
                placeholder="Paste target DNA (ATCG)… or leave empty for demo"
                rows={2}
                style={{ ...inputBase, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', resize: 'vertical', marginBottom: '8px' }}
              />
              {assemblyError && (
                <div style={{ marginBottom: '8px' }}>
                  <SimErrorBanner message={assemblyError} />
                </div>
              )}
              <ActionButton
                variant="secondary"
                size="md"
                aria-label="Plan Gibson assembly"
                onClick={handlePlanAssembly}
                style={{ width: '100%', background: 'rgba(191,220,205,0.2)', borderColor: 'rgba(191,220,205,0.34)' }}
              >
                🧬 Plan Assembly
              </ActionButton>
              {assemblyPlan && (
                <div style={{ background: THEME.paperSurfaceStrong, border: `1px solid ${THEME.paperBorder}`, borderRadius: 'var(--nb-radius-xl)', marginTop: '10px', padding: '12px' }}>
                  <div onClick={() => setAssemblyExpanded(p => !p)}
                    style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, fontWeight: 500 }}>
                      {assemblyPlan.targetName}
                    </span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>
                      {assemblyExpanded ? '▾' : '▸'}
                    </span>
                  </div>
                  {assemblyExpanded && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '10px' }}>
                        {([
                          ['Target', assemblyPlan.targetLength + ' bp'],
                          ['Fragments', String(assemblyPlan.fragments.length)],
                          ['Primers', String(assemblyPlan.primers.length)],
                          ['Overlap', assemblyPlan.overlapLength + ' bp'],
                          ['Tm Range', assemblyPlan.expectedTmRange[0].toFixed(1) + '–' + assemblyPlan.expectedTmRange[1].toFixed(1) + ' °C'],
                          ['Tm Spread', assemblyPlan.tmSpread.toFixed(1) + ' °C'],
                        ] as const).map(([lbl, val]) => (
                          <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>{lbl}</span>
                            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, textAlign: 'right' }}>{val}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{
                        height: '4px', borderRadius: '2px', marginBottom: '8px',
                        background: 'rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: '2px',
                          width: Math.min(100, assemblyPlan.tmSpread * 20) + '%',
                          background: assemblyPlan.tmSpread <= 3 ? 'rgba(120,220,160,0.7)' :
                                     assemblyPlan.tmSpread <= 5 ? 'rgba(231,199,169,0.78)' : 'rgba(232,163,161,0.78)',
                        }} />
                      </div>
                      {assemblyPlan.warnings.length > 0 && (
                        <div style={{ marginBottom: '8px' }}>
                          {assemblyPlan.warnings.map((w, i) => (
                            <p key={i} style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.apricot, margin: '0 0 3px', lineHeight: 1.3 }}>
                              ⚠ {w}
                            </p>
                          ))}
                        </div>
                      )}
                      <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
                        Fragment Map
                      </p>
                      <div style={{ display: 'flex', gap: '2px', marginBottom: '10px' }}>
                        {assemblyPlan.fragments.map((f, i) => {
                          const colors = ['rgba(191,220,205,0.34)', 'rgba(207,196,227,0.34)', 'rgba(175,195,214,0.34)', 'rgba(232,163,161,0.34)'];
                          const borders = ['rgba(191,220,205,0.58)', 'rgba(207,196,227,0.58)', 'rgba(175,195,214,0.58)', 'rgba(232,163,161,0.58)'];
                          return (
                            <div key={f.id} style={{
                              flex: f.length / assemblyPlan.targetLength,
                              height: '16px', borderRadius: '3px',
                              background: colors[i % 4], border: '1px solid ' + borders[i % 4],
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue }}>{f.length}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                        <ActionButton
                          variant="secondary"
                          size="sm"
                          aria-label="Download primers as CSV"
                          onClick={handleDownloadPrimers}
                          style={{ flex: 1, background: 'rgba(191,220,205,0.22)', borderColor: 'rgba(191,220,205,0.34)' }}
                        >
                          ↓ Primers CSV
                        </ActionButton>
                        <ActionButton
                          variant="secondary"
                          size="sm"
                          aria-label="Generate OT-2 protocol"
                          onClick={handleGenerateGibsonProtocol}
                          style={{ flex: 1, background: 'rgba(175,195,214,0.22)', borderColor: 'rgba(175,195,214,0.34)' }}
                        >
                          ⚗ OT-2 Protocol
                        </ActionButton>
                      </div>
                      <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: 0 }}>
                        Provenance: {assemblyPlan.provenanceId.slice(0, 8)}…
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ═══════ CENTER: Progress Ring + Timeline ═══════ */}
          <div className="nb-tool-center" style={{ flex: 1, background: THEME.sepiaPanelMuted, padding: '12px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <ScientificFigureFrame
              eyebrow={figureMeta.eyebrow}
              title={figureMeta.title}
              caption={figureMeta.caption}
              legend={[
                { label: 'Phase', value: currentPhase, accent: PHASE_PASTEL[currentPhase] },
                { label: 'Pass rate', value: `${passRate}%`, accent: THEME.mint },
                { label: 'Best result', value: `${bestIteration.result} ${bestIteration.unit}`, accent: THEME.apricot },
                { label: 'Feedback', value: hasCommittedFeedback ? 'Committed' : 'Draft only', accent: hasCommittedFeedback ? THEME.sky : THEME.coral },
              ]}
              footer={
                <div style={{ display: 'grid', gap: '6px' }}>
                  <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.paperValue, lineHeight: 1.55 }}>
                    The central panel now behaves like an experimental ledger figure. Phase state, campaign trajectory, and governance status stay in one reading path so loop health can be judged at a glance.
                  </div>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>
                    latest iteration #{latestIteration?.id ?? '—'} · {latestIteration?.result ?? '—'} {latestIteration?.unit ?? ''} · feedback {hasCommittedFeedback ? 'requires approved delta' : 'still locked'}
                  </div>
                </div>
              }
              minHeight="100%"
            >
              <div style={{ background: THEME.paperSurfaceStrong, border: `1px solid ${THEME.paperBorder}`, borderRadius: 'var(--nb-radius-xl)', padding: '8px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <CycleProgressRing currentPhase={currentPhase} iterationCount={displayIterations.length} />

                <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {PHASES.map(p => {
                    const isActive = p === currentPhase;
                    return (
                      <div key={p} style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--nb-radius-sm)',
                        background: isActive ? `${PHASE_PASTEL[p]}33` : THEME.paperSurfaceMuted,
                        border: `1px solid ${isActive ? `${PHASE_PASTEL[p]}66` : THEME.paperBorder}`,
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: PHASE_PASTEL[p],
                          opacity: isActive ? 1 : 0.5,
                        }} />
                        <span style={{
                          fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
                          color: isActive ? THEME.paperValue : THEME.paperLabel,
                          fontWeight: isActive ? 600 : 400,
                        }}>
                          {p}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ minHeight: 0 }}>
                <Timeline iterations={displayIterations} />
              </div>
            </ScientificFigureFrame>
          </div>

          {/* ═══════ RIGHT PANEL: Campaign Summary + Automation Control Center ═══════ */}
          <div className="nb-tool-right" style={{
            width: '260px', flexShrink: 0, padding: '16px',
            borderLeft: `1px solid ${THEME.paperBorder}`, background: THEME.sepiaPanelMuted,
          }}>
            {/* Campaign Summary (preserved) */}
            <p style={sectionLabel}>Campaign Summary</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <MetricCard label="Total Iterations" value={displayIterations.length} highlight />
              <MetricCard label="Best Titer" value={bestIteration?.result ?? 0} unit={bestIteration?.unit} />
              <MetricCard label="Avg Improvement" value={improvementRate} unit={bestIteration?.unit + '/cycle'} />
              <MetricCard label="Pass Rate" value={passRate} unit="%" />
            </div>

            {/* ── Automation Control Center ── */}
            <div style={{ background: THEME.paperSurfaceStrong, border: `1px solid ${THEME.paperBorder}`, borderRadius: 'var(--nb-radius-xl)', padding: '14px' }}>
              <p style={{ ...sectionLabel, margin: '0 0 10px' }}>Automation Control Center</p>

              {/* CSV Upload drop zone */}
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '14px 8px',
                borderRadius: 'var(--nb-radius-md)',
                border: `2px dashed ${THEME.paperBorderStrong}`,
                background: THEME.paperSurfaceMuted,
                cursor: 'pointer',
                marginBottom: '12px',
                transition: 'border-color 0.2s',
              }}>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.paperValue, marginBottom: '4px' }}>
                  {feedbackLoading ? '⏳ Processing…' : '↑ Upload Test CSV'}
                </span>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>
                  .csv with assay metadata, units, instrument, operator
                </span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  style={{ display: 'none' }}
                />
              </label>

              {feedbackError && (
                <div style={{ marginBottom: '12px' }}>
                  <SimErrorBanner message={feedbackError} />
                </div>
              )}

              {/* Feedback Results */}
              {feedbackResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                  {/* Test Summary */}
                  <div style={{
                    padding: '10px', borderRadius: 'var(--nb-radius-md)',
                    background: THEME.paperSurfaceMuted,
                    border: `1px solid ${THEME.paperBorder}`,
                  }}>
                    <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
                      Test Summary
                    </p>
                    {([
                      ['Mean Yield', feedbackResult.test_summary.mean_yield.toFixed(2)],
                      ['Std Dev', feedbackResult.test_summary.std_yield.toFixed(2)],
                      ['Best Sample', feedbackResult.test_summary.best_sample],
                      ['Worst Sample', feedbackResult.test_summary.worst_sample],
                    ] as const).map(([lbl, val]) => (
                      <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>{lbl}</span>
                        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, textAlign: 'right' }}>{val}</span>
                      </div>
                    ))}
                  </div>

                  {/* QC Flags */}
                  {feedbackResult.qc_flags.length > 0 && (
                    <div>
                      <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
                        QC Flags ({feedbackResult.qc_flags.length})
                      </p>
                      {feedbackResult.qc_flags.map((flag: QCFlag, idx: number) => (
                        <div key={idx} style={{
                          padding: '8px', borderRadius: 'var(--nb-radius-sm)', marginBottom: '6px',
                          background: flag.flag_type === 'sensor_anomaly'
                            ? 'rgba(231,199,169,0.18)'
                            : 'rgba(232,163,161,0.18)',
                          border: `1px solid ${flag.flag_type === 'sensor_anomaly'
                            ? 'rgba(231,199,169,0.34)'
                            : 'rgba(232,163,161,0.34)'}`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PHASE_PASTEL.Build }}>
                              {flag.flag_type === 'sensor_anomaly' ? '⚠' : '◆'} {flag.sample_id}
                            </span>
                            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, textAlign: 'right' }}>
                              {flag.measured_value.toFixed(1)} / {flag.theoretical_max.toFixed(1)}
                            </span>
                          </div>
                          <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: 0, lineHeight: 1.3 }}>
                            {flag.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Next Iteration Suggestions */}
                  {feedbackResult.next_iteration_suggestions.length > 0 && (
                    <div>
                      <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
                        Suggested Next Iteration
                      </p>
                      {feedbackResult.next_iteration_suggestions.map((s: NextIterationSuggestion, idx: number) => (
                        <div key={idx} style={{
                          padding: '8px', borderRadius: 'var(--nb-radius-sm)', marginBottom: '6px',
                          background: 'rgba(191,220,205,0.18)',
                          border: '1px solid rgba(191,220,205,0.34)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: PHASE_PASTEL.Learn, fontWeight: 500 }}>
                              {s.parameter}
                            </span>
                            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, textAlign: 'right' }}>
                              +{s.predicted_improvement_percent.toFixed(1)}%
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>
                              {s.current_value}
                            </span>
                            <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>→</span>
                            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, textAlign: 'right' }}>
                              {s.suggested_value}
                            </span>
                          </div>
                          <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: 0, lineHeight: 1.3 }}>
                            {s.rationale}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Optimization Objective */}
                  <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: 0, textAlign: 'center' }}>
                    objective: {feedbackResult.optimization_objective}
                  </p>
                </div>
              )}
            </div>

            {/* ── Delta Pack Approval Gate ── */}
            {learnedDeltaPacks.length > 0 && (
              <div style={{ background: THEME.paperSurfaceStrong, border: `1px solid ${THEME.paperBorder}`, borderRadius: 'var(--nb-radius-xl)', padding: '14px', marginTop: '16px' }}>
                <p style={{ ...sectionLabel, margin: '0 0 10px' }}>
                  Delta Pack Approval Gate
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {learnedDeltaPacks.map((pack) => {
                    const statusColor = pack.humanGateStatus === 'approved'
                      ? THEME.mint
                      : pack.humanGateStatus === 'rejected'
                        ? THEME.coral
                        : THEME.apricot;
                    const statusBg = pack.humanGateStatus === 'approved'
                      ? 'rgba(158,215,199,0.18)'
                      : pack.humanGateStatus === 'rejected'
                        ? 'rgba(232,163,161,0.18)'
                        : 'rgba(231,199,169,0.18)';
                    const statusBorder = pack.humanGateStatus === 'approved'
                      ? 'rgba(158,215,199,0.34)'
                      : pack.humanGateStatus === 'rejected'
                        ? 'rgba(232,163,161,0.34)'
                        : 'rgba(231,199,169,0.34)';
                    const entryCount = Object.keys(pack.changedBounds).length
                      + Object.keys(pack.changedPriors).length
                      + Object.keys(pack.changedWeights).length;
                    return (
                      <div
                        key={pack.deltaPackId}
                        style={{
                          padding: '10px',
                          borderRadius: 'var(--nb-radius-md)',
                          background: statusBg,
                          border: `1px solid ${statusBorder}`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, fontWeight: 600 }}>
                            Iteration #{pack.iteration} Delta Pack
                          </span>
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: '999px',
                              border: `1px solid ${statusBorder}`,
                              background: statusBg,
                              color: statusColor,
                              fontFamily: THEME.MONO,
                              fontSize: 'var(--nb-fs-xs)',
                              letterSpacing: '0.05em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {pack.humanGateStatus}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>Classification</span>
                            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue }}>{pack.classification}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>Target tools</span>
                            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue }}>{pack.targetToolIds.join(', ')}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>Delta entries</span>
                            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue }}>{entryCount}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>Sources</span>
                            <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue }}>{pack.sourceExperimentRecordIds.length} record(s)</span>
                          </div>
                        </div>

                        {pack.notes && (
                          <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: '0 0 8px', lineHeight: 1.3 }}>
                            {pack.notes}
                          </p>
                        )}

                        {pack.humanGateStatus === 'pending' && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <ActionButton
                              variant="primary"
                              size="sm"
                              aria-label={`Approve delta pack for iteration ${pack.iteration}`}
                              onClick={() => approveDeltaPack(pack.deltaPackId)}
                              style={{ flex: 1 }}
                            >
                              Approve
                            </ActionButton>
                            <ActionButton
                              variant="destructive"
                              size="sm"
                              aria-label={`Reject delta pack for iteration ${pack.iteration}`}
                              onClick={() => rejectDeltaPack(pack.deltaPackId)}
                              style={{ flex: 1 }}
                            >
                              Reject
                            </ActionButton>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Provenance Tracker ── */}
            {assemblyProvenance.length > 0 && (
              <div style={{ background: THEME.paperSurfaceStrong, border: `1px solid ${THEME.paperBorder}`, borderRadius: 'var(--nb-radius-xl)', padding: '14px', marginTop: '16px' }}>
                <p style={{ ...sectionLabel, margin: '0 0 10px' }}>
                  Data Provenance ({assemblyProvenance.length} records)
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {assemblyProvenance.map(p => {
                    const tc: Record<string, string> = {
                      fragment: THEME.mint,
                      primer: THEME.sky,
                      assembly: THEME.lilac,
                      transformant: THEME.coral,
                      culture: THEME.apricot,
                    };
                    const clr = tc[p.sampleType] ?? THEME.paperValue;
                    return (
                      <div key={p.uuid} style={{ padding: '8px', borderRadius: 'var(--nb-radius-sm)', background: THEME.paperSurfaceMuted, border: `1px solid ${THEME.paperBorder}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: clr }}>{p.sampleType.toUpperCase()}</span>
                          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, textAlign: 'right' }}>
                            {p.well ? 'Well ' + p.well : ''}{p.slot ? ' · Slot ' + p.slot : ''}
                          </span>
                        </div>
                        <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.paperValue, margin: '0 0 2px', lineHeight: 1.3 }}>{p.label}</p>
                        <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel, margin: 0 }}>{p.uuid}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </ToolTabPanel>

      {/* ═══════ ITERATIONS TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="iterations">
        <div style={{ padding: '16px' }}>
          <ScientificFigureFrame
            eyebrow="Iteration History"
            title="All recorded iterations"
            caption={`${displayIterations.length} iterations across ${new Set(displayIterations.map(i => i.phase)).size} phases`}
          >
            <Timeline iterations={displayIterations} />
          </ScientificFigureFrame>
          <div style={{ marginTop: '16px', display: 'grid', gap: '8px' }}>
            {displayIterations.map((it) => (
              <div key={it.id} style={{
                padding: '10px 12px',
                borderRadius: 'var(--nb-radius-md)',
                border: `1px solid ${THEME.BORDER}`,
                background: THEME.PANEL_INSET,
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <span style={{
                  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                  color: PHASE_PASTEL[it.phase] ?? THEME.LABEL,
                  fontWeight: 700, minWidth: '60px',
                }}>{it.phase}</span>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, flex: 1 }}>
                  {it.hypothesis}
                </span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, fontWeight: 600 }}>
                  {it.result} {it.unit}
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: '999px',
                  background: it.passed ? 'rgba(191,220,205,0.16)' : 'rgba(232,163,161,0.16)',
                  color: it.passed ? THEME.MINT : THEME.CORAL,
                  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', fontWeight: 600,
                }}>{it.passed ? 'PASS' : 'FAIL'}</span>
              </div>
            ))}
          </div>
        </div>
      </ToolTabPanel>

      {/* ═══════ PROTOCOL TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="protocol">
        <div style={{ padding: '16px', maxWidth: '640px' }}>
          <ActionButton
            variant="secondary"
            size="md"
            aria-label="Generate protocol"
            onClick={handleGenerateProtocol}
            disabled={!latestIteration}
            style={{ background: 'rgba(207,196,227,0.2)', borderColor: 'rgba(207,196,227,0.34)', marginBottom: '16px' }}
          >
            ⚗ Generate Protocol
          </ActionButton>
          {generatedProtocol && (
            <ScientificFigureFrame
              eyebrow="Protocol"
              title={generatedProtocol.metadata.protocolName}
              caption={`API ${generatedProtocol.api_version} · ${generatedProtocol.labware.length} labware · ${generatedProtocol.pipetting_logic.length} steps`}
            >
              <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.LABEL, lineHeight: 1.6, margin: '0 0 12px' }}>
                {generatedProtocol.metadata.description}
              </p>
              <ActionButton variant="secondary" size="sm" onClick={handleDownloadProtocol}>
                ↓ Download .py
              </ActionButton>
            </ScientificFigureFrame>
          )}
          <div style={{ marginTop: '24px' }}>
            <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
              SBOL 3.0 Export
            </p>
            <ActionButton
              variant="secondary"
              size="md"
              onClick={handleSBOLExport}
              style={{ background: 'rgba(175,195,214,0.2)', borderColor: 'rgba(175,195,214,0.34)', marginBottom: '12px' }}
            >
              ◎ Serialize to SBOL 3.0
            </ActionButton>
            {sbolDoc && (
              <div style={{ background: THEME.PANEL_INSET, border: `1px solid ${THEME.BORDER}`, borderRadius: 'var(--nb-radius-lg)', padding: '14px' }}>
                <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, fontWeight: 600, margin: '0 0 6px' }}>{sbolDoc.name}</p>
                <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, margin: '0 0 8px' }}>{sbolDoc.components.length} components · {sbolDoc.interactions.length} interactions</p>
                {sbolValidation.map((v, i) => (
                  <p key={i} style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', margin: '0 0 3px', color: v.startsWith('VALID') ? THEME.MINT : v.startsWith('ERROR') ? THEME.CORAL : THEME.APRICOT }}>{v}</p>
                ))}
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <ActionButton variant="secondary" size="sm" onClick={() => handleDownloadSBOL('xml')}>↓ RDF/XML</ActionButton>
                  <ActionButton variant="secondary" size="sm" onClick={() => handleDownloadSBOL('turtle')}>↓ Turtle</ActionButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </ToolTabPanel>

      {/* ═══════ DELTA PACK TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="deltapack">
        <div style={{ padding: '16px' }}>
          {computedDeltaPacks.length > 0 || learnedDeltaPacks.length > 0 ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              {[...learnedDeltaPacks].reverse().map((pack) => {
                const entryCount = Object.keys(pack.changedBounds).length + Object.keys(pack.changedPriors).length + Object.keys(pack.changedWeights).length;
                const statusBg = pack.humanGateStatus === 'approved' ? 'rgba(191,220,205,0.16)' : pack.humanGateStatus === 'rejected' ? 'rgba(232,163,161,0.16)' : 'rgba(231,199,169,0.14)';
                const statusBorder = pack.humanGateStatus === 'approved' ? 'rgba(191,220,205,0.34)' : pack.humanGateStatus === 'rejected' ? 'rgba(232,163,161,0.34)' : 'rgba(231,199,169,0.28)';
                const statusColor = pack.humanGateStatus === 'approved' ? THEME.MINT : pack.humanGateStatus === 'rejected' ? THEME.CORAL : THEME.APRICOT;
                return (
                  <div key={pack.deltaPackId} style={{ background: THEME.PANEL_INSET, border: `1px solid ${THEME.BORDER}`, borderRadius: 'var(--nb-radius-lg)', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, fontWeight: 600 }}>Iteration {pack.iteration}</span>
                      <span style={{ padding: '2px 7px', borderRadius: '999px', border: `1px solid ${statusBorder}`, background: statusBg, color: statusColor, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{pack.humanGateStatus}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>Classification</span><span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE }}>{pack.classification}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>Target tools</span><span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE }}>{pack.targetToolIds.join(', ')}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>Delta entries</span><span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE }}>{entryCount}</span></div>
                    </div>
                    {pack.humanGateStatus === 'pending' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <ActionButton variant="primary" size="sm" onClick={() => approveDeltaPack(pack.deltaPackId)} style={{ flex: 1 }}>Approve</ActionButton>
                        <ActionButton variant="destructive" size="sm" onClick={() => rejectDeltaPack(pack.deltaPackId)} style={{ flex: 1 }}>Reject</ActionButton>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: THEME.LABEL, fontFamily: THEME.SANS }}>
              <p style={{ fontSize: 'var(--nb-fs-md)', margin: '0 0 8px' }}>No delta packs yet</p>
              <p style={{ fontSize: 'var(--nb-fs-sm)', margin: 0 }}>Commit iterations with feedback to generate delta packs for approval.</p>
            </div>
          )}
          {assemblyProvenance.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>Data Provenance ({assemblyProvenance.length} records)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {assemblyProvenance.map(p => {
                  const clr: Record<string, string> = { fragment: THEME.MINT, primer: THEME.SKY, assembly: THEME.LILAC, transformant: THEME.CORAL, culture: THEME.APRICOT };
                  return (
                    <div key={p.uuid} style={{ padding: '8px', borderRadius: 'var(--nb-radius-sm)', background: THEME.PANEL_INSET, border: `1px solid ${THEME.BORDER}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: clr[p.sampleType] ?? THEME.VALUE }}>{p.sampleType.toUpperCase()}</span>
                        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>{p.well ? 'Well ' + p.well : ''}{p.slot ? ' · Slot ' + p.slot : ''}</span>
                      </div>
                      <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE, margin: '0 0 2px', lineHeight: 1.3 }}>{p.label}</p>
                      <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, margin: 0 }}>{p.uuid}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ToolTabPanel>

      {/* ═══════ GIBSON ASSEMBLY TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="gibson">
        <div style={{ padding: '16px', maxWidth: '640px' }}>
          <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>Gibson Assembly Planner</p>
          <textarea
            value={seqInput} onChange={e => setSeqInput(e.target.value)}
            placeholder="Paste target DNA (ATCG)… or leave empty for demo"
            rows={3}
            style={{ width: '100%', padding: '8px', borderRadius: 'var(--nb-radius-md)', border: `1px solid ${THEME.BORDER}`, background: THEME.PANEL_INSET, color: THEME.VALUE, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', resize: 'vertical', marginBottom: '8px' }}
          />
          {assemblyError && <div style={{ marginBottom: '8px' }}><SimErrorBanner message={assemblyError} /></div>}
          <ActionButton
            variant="secondary"
            size="md"
            onClick={handlePlanAssembly}
            style={{ background: 'rgba(191,220,205,0.2)', borderColor: 'rgba(191,220,205,0.34)', marginBottom: '16px' }}
          >
            🧬 Plan Assembly
          </ActionButton>
          {assemblyPlan && (
            <ScientificFigureFrame
              eyebrow="Assembly Plan"
              title={assemblyPlan.targetName}
              caption={`${assemblyPlan.targetLength} bp · ${assemblyPlan.fragments.length} fragments · ${assemblyPlan.primers.length} primers`}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                {([['Overlap', assemblyPlan.overlapLength + ' bp'], ['Tm Range', assemblyPlan.expectedTmRange[0].toFixed(1) + '–' + assemblyPlan.expectedTmRange[1].toFixed(1) + ' °C'], ['Tm Spread', assemblyPlan.tmSpread.toFixed(1) + ' °C']] as const).map(([lbl, val]) => (
                  <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>{lbl}</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE }}>{val}</span>
                  </div>
                ))}
              </div>
              <div style={{ height: '4px', borderRadius: '2px', marginBottom: '8px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '2px', width: Math.min(100, assemblyPlan.tmSpread * 20) + '%', background: assemblyPlan.tmSpread <= 3 ? 'rgba(120,220,160,0.7)' : assemblyPlan.tmSpread <= 5 ? 'rgba(231,199,169,0.78)' : 'rgba(232,163,161,0.78)' }} />
              </div>
              {assemblyPlan.warnings.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  {assemblyPlan.warnings.map((w, i) => <p key={i} style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.APRICOT, margin: '0 0 3px' }}>⚠ {w}</p>)}
                </div>
              )}
              <p style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', margin: '0 0 6px' }}>Fragment Map</p>
              <div style={{ display: 'flex', gap: '2px' }}>
                {assemblyPlan.fragments.map((f, i) => {
                  const colors = ['rgba(191,220,205,0.34)', 'rgba(207,196,227,0.34)', 'rgba(175,195,214,0.34)', 'rgba(232,163,161,0.34)'];
                  return (
                    <div key={f.id} style={{ flex: f.length / assemblyPlan.targetLength, height: '16px', borderRadius: '3px', background: colors[i % 4], border: '1px solid ' + colors[i % 4].replace('0.34', '0.58'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE }}>{f.length}</span>
                    </div>
                  );
                })}
              </div>
            </ScientificFigureFrame>
          )}
        </div>
      </ToolTabPanel>

      {/* ── Closed-Loop DBTL Tab ──────────────────────────────────────────── */}
      <ToolTabPanel activeId={activeTab} tabId="closedloop">
        <ClosedLoopDBTLPanel />
      </ToolTabPanel>

      {/* ═══════ Footer: Export ═══════ */}
      <div style={{
        borderTop: `1px solid ${THEME.BORDER}`, padding: '8px 16px',
        display: 'flex', gap: '8px', flexShrink: 0, background: THEME.PANEL_MUTED,
      }}>
        <ExportButton label="Export JSON" data={displayIterations} filename="dbtlflow-iterations" format="json" />
        <ExportButton label="Export CSV" data={displayIterations} filename="dbtlflow-iterations" format="csv" />
      </div>
    </ToolShell>
  );
}

/* ── Closed-Loop DBTL Panel ─────────────────────────────────────────────── */

function ClosedLoopDBTLPanel() {
  const [acquisition, setAcquisition] = useState<'EI' | 'UCB' | 'PI'>('EI');
  const [result, setResult] = useState<import('../../server/closedLoopDBTLEngine').DBTLResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRun = useCallback(async () => {
    setLoading(true);
    try {
      const { createCampaign, runClosedLoopDBTL } = await import('../../server/closedLoopDBTLEngine');
      const campaign = createCampaign('DBTL Optimization', [
        { name: 'temperature', type: 'continuous', bounds: [30, 40] },
        { name: 'pH', type: 'continuous', bounds: [6.0, 8.0] },
        { name: 'inducer_conc', type: 'continuous', bounds: [0.01, 10] },
      ], 'maximize');
      const res = runClosedLoopDBTL(campaign, acquisition, 3);
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [acquisition]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <div style={{
        background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 16,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        border: `1px solid ${THEME.BORDER}`,
      }}>
        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Acquisition Function
        </span>
        <select value={acquisition} onChange={(e) => setAcquisition(e.target.value as 'EI' | 'UCB' | 'PI')}
          style={{ padding: '4px 8px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)' }}
        >
          <option value="EI">Expected Improvement (Jones 1998)</option>
          <option value="UCB">Upper Confidence Bound (Srinivas 2012)</option>
          <option value="PI">Probability of Improvement</option>
        </select>
        <button onClick={handleRun} disabled={loading} className="nb-tool-toggle"
          style={{ padding: '6px 14px', fontSize: 'var(--nb-fs-sm)', opacity: loading ? 0.4 : 1 }}
        >
          {loading ? 'Optimizing...' : 'Run Closed-Loop DBTL'}
        </button>
        {result && (
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.4)' }}>
            Round {result.convergence.round} | Best: {result.convergence.bestValue} | Converged: {result.convergence.converged ? 'Yes' : 'No'}
          </span>
        )}
      </div>

      {result && (
        <>
          {/* Suggestions */}
          <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12, border: `1px solid ${THEME.BORDER}` }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginBottom: 6 }}>Next Experiments</div>
            {result.suggestions.map((s, i) => (
              <div key={i} style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: 'rgba(255,255,255,0.7)', marginBottom: 6, padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                <span style={{ color: THEME.SKY }}>#{i + 1}</span>
                {Object.entries(s.parameters).map(([k, v]) => (
                  <span key={k} style={{ marginLeft: 8 }}>
                    {k}=<span style={{ fontFamily: THEME.MONO }}>{(v as number).toFixed(2)}</span>
                  </span>
                ))}
                <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                  [{s.acquisitionType}={s.acquisitionValue.toFixed(4)}]
                </span>
              </div>
            ))}
          </div>

          {/* Convergence */}
          <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12, border: `1px solid ${THEME.BORDER}` }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginBottom: 6 }}>Design Notes</div>
            {result.designNotes.map((n, i) => (
              <div key={i} style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>• {n}</div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
