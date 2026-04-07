'use client';
import { useEffect, useMemo, useState } from 'react';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
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
import WorkbenchInlineContext from '../workbench/WorkbenchInlineContext';
import { buildDBTLDraft } from './shared/workbenchDataflow';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import ScientificHero from './shared/ScientificHero';
import { T, TOOL_RESULT_PALETTE} from '../ide/tokens';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import ScientificMethodStrip from './shared/ScientificMethodStrip';

/* ── Design Tokens ── */
const PHASE_PASTEL: Record<string, string> = {
  Design: PATHD_THEME.lilac,
  Build:  PATHD_THEME.apricot,
  Test:   PATHD_THEME.coral,
  Learn:  PATHD_THEME.mint,
};

const PANEL_BG = PATHD_THEME.sepiaPanelMuted;
const BORDER = PATHD_THEME.paperBorder;
const LABEL = PATHD_THEME.paperLabel;
const VALUE = PATHD_THEME.paperValue;
const INPUT_BG = PATHD_THEME.paperSurfaceStrong;
const INPUT_BORDER = PATHD_THEME.paperBorder;
const INPUT_TEXT = PATHD_THEME.paperValue;

const GLASS: React.CSSProperties = {
  borderRadius: '24px',
  background: PATHD_THEME.paperSurfaceStrong,
  border: `1px solid ${PATHD_THEME.paperBorder}`,
};

const PHASES: DBTLPhase[] = ['Design', 'Build', 'Test', 'Learn'];

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
      <text x="36" y="14" fontFamily={T.SANS} fontSize="9" fill={LABEL} letterSpacing="0.12em">DBTL AUDIT TIMELINE</text>
      <text x="36" y="28" fontFamily={T.SANS} fontSize="11" fill={VALUE}>Iteration trace with phase identity, result magnitude, and pass gate</text>
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
            <text x={34} y={y + 20} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={phaseColor}>
              {it.phase.toUpperCase()}
            </text>
            <text x={80} y={y + 20} fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.3)">
              #{it.id}
            </text>
            <text x={100} y={y + 20} fontFamily={T.SANS} fontSize="9" fill="rgba(255,255,255,0.5)">
              {it.hypothesis.slice(0, 40)}{it.hypothesis.length > 40 ? '…' : ''}
            </text>
            <rect x={160} y={y + 28} width={barW} height={10} rx="2"
              fill={it.passed ? 'rgba(147,203,82,0.4)' : 'rgba(255,80,80,0.3)'}
              stroke={it.passed ? 'rgba(147,203,82,0.7)' : 'rgba(255,80,80,0.5)'}
              strokeWidth={1}
            />
            <text x={160 + barW + 6} y={y + 38} fontFamily={T.MONO} fontSize="9"
              fill={it.passed ? 'rgba(147,203,82,0.8)' : 'rgba(255,100,80,0.7)'}>
              {it.result} {it.unit}
            </text>
            <circle cx={440} cy={y + 22} r={5}
              fill={it.passed ? 'rgba(147,203,82,0.7)' : 'rgba(255,80,80,0.6)'} />
            <line x1={4} y1={y + 52} x2={480} y2={y + 52} stroke="rgba(255,255,255,0.04)" />
          </g>
        );
      })}
      <text x={160 + (targetThreshold / maxResult) * 280 + 4} y={18} fontFamily={T.MONO} fontSize="7" fill="rgba(255,139,31,0.78)">
        target band
      </text>
      <text x={160} y={30 + iterations.length * 60 + 16} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.2)">
        0
      </text>
      <text x={440} y={30 + iterations.length * 60 + 16} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.2)">
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
            <stop offset="0%" stopColor={PATHD_THEME.blue} />
            <stop offset="50%" stopColor={PATHD_THEME.indigo} />
            <stop offset="100%" stopColor={PATHD_THEME.orange} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={PATHD_THEME.progressTrack} strokeWidth={stroke}
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
          fontFamily: T.SANS, fontSize: '11px', fontWeight: 600,
          color: PATHD_THEME.orange, letterSpacing: '0.04em',
        }}>
          {currentPhase.toUpperCase()}
        </span>
        <span style={{
          fontFamily: T.MONO, fontSize: '20px', fontWeight: 700,
          color: VALUE, marginTop: '2px',
        }}>
          {iterationCount}
        </span>
        <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>
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
      ? ((committedIterations[committedIterations.length - 1].result - committedIterations[0].result) / committedIterations.length).toFixed(2)
      : '0';
  const committedPassRate = ((committedIterations.filter(i => i.passed).length / committedIterations.length) * 100).toFixed(0);
  const latestCommittedIteration = committedIterations[committedIterations.length - 1];
  const hasCommittedFeedback = iterations.length > INITIAL_ITERATIONS.length || Boolean(feedbackResult);

  // Derived values (preserved)
  const bestIteration = displayIterations.reduce((a, b) => (b.result > a.result ? b : a), displayIterations[0]);
  const improvementRate =
    displayIterations.length > 1
      ? ((displayIterations[displayIterations.length - 1].result - displayIterations[0].result) / displayIterations.length).toFixed(2)
      : '0';
  const passRate = ((displayIterations.filter(i => i.passed).length / displayIterations.length) * 100).toFixed(0);

  const latestIteration = displayIterations[displayIterations.length - 1];
  const currentPhase: DBTLPhase = latestIteration?.phase ?? 'Design';
  const feedbackGateLabel = hasCommittedFeedback
    ? `Committed feedback unlocked · iteration #${latestCommittedIteration?.id ?? '—'} now eligible to reseed upstream tools`
    : 'Draft-only feedback · upstream reseeding remains locked until a new iteration is committed';
  const figureMeta = useMemo(() => ({
    eyebrow: 'Campaign figure',
    title: `DBTL is framed as a governed experimental ledger with ${currentPhase.toLowerCase()} in focus`,
    caption: 'The page now treats the loop as a scientific record: cycle state, iteration trajectory, and promotion status are read together instead of being scattered across utility cards.',
  }), [currentPhase]);

  useEffect(() => {
    setToolPayload('dbtlflow', {
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
    background: INPUT_BG,
    border: `1px solid ${INPUT_BORDER}`,
    borderRadius: '8px',
    color: INPUT_TEXT,
    fontFamily: T.MONO,
    fontSize: '12px',
    outline: 'none',
  };

  const sectionLabel: React.CSSProperties = {
    fontFamily: T.SANS,
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: LABEL,
    margin: '0 0 12px',
  };

  /* ── Render ── */
  return (
    <>
      <div className="nb-tool-page" style={{ background: PANEL_BG }}>
        <AlgorithmInsight
          title="Design-Build-Test-Learn Tracker"
          description="Iterative experimental optimization. Each cycle records a hypothesis, measured result, and learning for the next design."
          formula="Cycle: D→B→T→L→D'"
        />

        <div style={{ padding: '0 16px 6px' }}>
          <WorkbenchInlineContext
            toolId="dbtlflow"
            title="DBTL Workflow"
            summary="DBTL is the governed feedback engine of the workbench: only committed Learn output is allowed to reseed upstream tools, so experiment feedback stays traceable, reviewable, and safe to trust."
            compact
            isSimulated={!analyzeArtifact}
          />
        </div>

        <div style={{ padding: '0 16px 4px' }}>
          <ScientificHero
            eyebrow="Stage 4 · Test, Learn, Reseed"
            title="Closed-loop iteration is now an explicit governed object"
            summary="DBTLflow is no longer just a list of experiments. It is the workbench’s decision gate: draft learning stays visible, committed learning becomes canonical, and only canonical learning is allowed to reseed upstream design, simulation, and control steps."
            aside={
              <>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Current loop status
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '13px', color: PATHD_THEME.value, fontWeight: 700 }}>
                  {hasCommittedFeedback ? 'Committed learn loop is active' : 'Draft learn loop awaiting commit'}
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.55 }}>
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
                detail: hasCommittedFeedback ? 'Upstream reseeding is unlocked for the latest committed learning package.' : 'Learning is still visible, but not yet cleared for upstream reseeding.',
                tone: hasCommittedFeedback ? 'warm' : 'alert',
              },
            ]}
          />
        </div>

        <div style={{ padding: '0 16px 6px' }}>
          <div
            style={{
              borderRadius: '14px',
              border: `1px solid ${hasCommittedFeedback ? 'rgba(158,215,199,0.22)' : 'rgba(255,192,128,0.24)'}`,
              background: hasCommittedFeedback ? 'rgba(158,215,199,0.10)' : 'rgba(255,192,128,0.08)',
              padding: '8px 10px',
              display: 'grid',
              gap: '3px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Closed-loop gate
              </span>
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: '999px',
                  border: `1px solid ${hasCommittedFeedback ? 'rgba(158,215,199,0.3)' : 'rgba(255,192,128,0.3)'}`,
                  background: hasCommittedFeedback ? 'rgba(158,215,199,0.16)' : 'rgba(255,192,128,0.14)',
                  color: hasCommittedFeedback ? 'rgba(224,244,238,0.92)' : 'rgba(255,219,180,0.92)',
                  fontFamily: T.MONO,
                  fontSize: '9px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {hasCommittedFeedback ? 'Feedback Applied' : 'Awaiting Commit'}
              </span>
            </div>
            <div style={{ fontFamily: T.SANS, fontSize: '11px', color: VALUE, lineHeight: 1.45 }}>
              {feedbackGateLabel}
            </div>
            <div style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL, lineHeight: 1.4 }}>
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
                accent: PATHD_THEME.apricot,
                note: `phase ${currentPhase}`,
              },
              {
                title: 'Governed figure',
                detail: 'Progress ring, phase legend, and iteration timeline are merged into one figure frame so experimental history reads like a ledger panel, not a utility dashboard.',
                accent: PATHD_THEME.sky,
                note: `${displayIterations.length} visible iterations`,
              },
              {
                title: 'Reseeding gate',
                detail: 'Automation, provenance, and feedback remain attached on the right so only governed learn output can return upstream.',
                accent: PATHD_THEME.mint,
                note: hasCommittedFeedback ? 'committed feedback live' : 'draft feedback only',
              },
            ]}
          />
        </div>

        <div style={{ padding: '0 16px 6px' }}>
          <div
            style={{
              borderRadius: '14px',
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
              <span style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Draft + action status
              </span>
              {draftIteration && (
                <span
                  style={{
                    padding: '2px 7px',
                    borderRadius: '999px',
                    border: '1px solid rgba(175,195,214,0.34)',
                    background: 'rgba(175,195,214,0.16)',
                    color: VALUE,
                    fontFamily: T.MONO,
                    fontSize: '9px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  Previewing draft iteration #{draftIteration.id}
                </span>
              )}
            </div>
            <div style={{ fontFamily: T.SANS, fontSize: '11px', color: VALUE, lineHeight: 1.45 }}>
              {activityMessage
                ?? (draftIteration
                  ? `The figure and campaign cards are previewing your current draft at ${draftIteration.result.toFixed(1)} ${draftIteration.unit} before commit.`
                  : 'Commit a new iteration or generate a protocol to create a visible experimental artifact.')}
            </div>
            <div style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL }}>
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
            borderRight: `1px solid ${BORDER}`, background: PANEL_BG,
          }}>
            <p style={sectionLabel}>Add Iteration</p>

            {/* Hypothesis */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL, display: 'block', marginBottom: '4px' }}>
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
                  fontFamily: T.SANS,
                  fontSize: '11px',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Result + Unit */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL, display: 'block', marginBottom: '4px' }}>
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
                <label style={{ fontFamily: T.SANS, fontSize: '11px', color: LABEL, display: 'block', marginBottom: '4px' }}>
                  Unit
                </label>
                <input
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  style={{ ...inputBase, padding: '5px 6px', fontSize: '11px' }}
                />
              </div>
            </div>

            {/* Pass / Fail */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {([true, false] as const).map(p => (
                <button aria-label="Action" key={String(p)} onClick={() => setPassed(p)} style={{
                  flex: 1, padding: '6px',
                  background: passed === p ? (p ? 'rgba(191,220,205,0.2)' : 'rgba(232,163,161,0.18)') : PATHD_THEME.paperSurfaceStrong,
                  border: `1px solid ${passed === p ? (p ? 'rgba(191,220,205,0.34)' : 'rgba(232,163,161,0.34)') : INPUT_BORDER}`,
                  borderRadius: '8px',
                  color: passed === p ? VALUE : LABEL,
                  fontFamily: T.SANS, fontSize: '11px', cursor: 'pointer',
                }}>
                  {p ? '✓ Pass' : '✗ Fail'}
                </button>
              ))}
            </div>

            {/* Add iteration button */}
            <button aria-label="Action" onClick={addIteration} disabled={!hypothesis.trim() || !result.trim()} style={{
              width: '100%', padding: '8px',
              background: PATHD_THEME.paperSurfaceStrong,
              border: `1px solid ${INPUT_BORDER}`,
              borderRadius: '8px',
              color: VALUE,
              fontFamily: T.SANS, fontSize: '11px', cursor: 'pointer',
              boxShadow: '0 10px 18px rgba(96,74,56,0.08)',
            }}>
              + Add Iteration
            </button>

            {/* Best Result */}
            <div style={{
              marginTop: '16px', padding: '10px',
              background: 'rgba(191,220,205,0.18)', borderRadius: '10px',
              border: '1px solid rgba(191,220,205,0.34)',
            }}>
              <p style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Best Result
              </p>
              <p style={{ fontFamily: T.MONO, fontSize: '14px', color: VALUE, margin: '0 0 4px' }}>
                {bestIteration?.result} {bestIteration?.unit}
              </p>
              <p style={{ fontFamily: T.SANS, fontSize: '10px', color: LABEL, margin: 0, lineHeight: 1.4 }}>
                {bestIteration?.hypothesis.slice(0, 60)}…
              </p>
            </div>

            {/* ── Protocol Generation ── */}
            <div style={{ marginTop: '16px' }}>
              <p style={sectionLabel}>Protocol Generation</p>
              <button aria-label="Action" onClick={handleGenerateProtocol} disabled={!latestIteration} style={{
                width: '100%', padding: '8px',
                background: 'rgba(207,196,227,0.2)',
                border: '1px solid rgba(207,196,227,0.34)',
                borderRadius: '8px',
                color: VALUE,
                fontFamily: T.SANS, fontSize: '11px', cursor: 'pointer',
                opacity: latestIteration ? 1 : 0.4,
              }}>
                ⚗ Generate Protocol
              </button>

              {generatedProtocol && (
                <div style={{ ...GLASS, marginTop: '10px', padding: '12px' }}>
                  <div
                    onClick={() => setProtocolExpanded(prev => !prev)}
                    style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontFamily: T.SANS, fontSize: '10px', color: VALUE, fontWeight: 500 }}>
                      {generatedProtocol.metadata.protocolName}
                    </span>
                    <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
                      {protocolExpanded ? '▾' : '▸'}
                    </span>
                  </div>

                  {protocolExpanded && (
                    <div style={{ marginTop: '8px' }}>
                      <p style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL, margin: '0 0 4px' }}>
                        {generatedProtocol.metadata.description}
                      </p>
                      <p style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL, margin: '0 0 8px' }}>
                        API {generatedProtocol.api_version} · {generatedProtocol.labware.length} labware · {generatedProtocol.pipetting_logic.length} steps
                      </p>
                      <button aria-label="Action" onClick={handleDownloadProtocol} style={{
                        width: '100%', padding: '6px',
                        background: 'rgba(207,196,227,0.22)',
                        border: '1px solid rgba(207,196,227,0.34)',
                        borderRadius: '6px',
                        color: VALUE,
                        fontFamily: T.MONO, fontSize: '10px', cursor: 'pointer',
                      }}>
                        ↓ Download .py
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── SBOL 3.0 Export ── */}
            <div style={{ marginTop: '16px' }}>
              <p style={sectionLabel}>SBOL 3.0 Export</p>
              <button aria-label="Action" onClick={handleSBOLExport} style={{
                width: '100%', padding: '8px',
                background: 'rgba(175,195,214,0.2)',
                border: '1px solid rgba(175,195,214,0.34)',
                borderRadius: '8px', color: VALUE,
                fontFamily: T.SANS, fontSize: '11px', cursor: 'pointer',
              }}>
                ◎ Serialize to SBOL 3.0
              </button>
              {sbolDoc && (
                <div style={{ ...GLASS, marginTop: '10px', padding: '12px' }}>
                  <p style={{ fontFamily: T.SANS, fontSize: '10px', color: VALUE, fontWeight: 500, margin: '0 0 6px' }}>
                    {sbolDoc.name}
                  </p>
                  <p style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL, margin: '0 0 8px' }}>
                    {sbolDoc.components.length} components · {sbolDoc.interactions.length} interactions
                  </p>
                  {sbolValidation.map((v, i) => (
                    <p key={i} style={{
                      fontFamily: T.MONO, fontSize: '9px', margin: '0 0 3px', lineHeight: 1.3,
                      color: v.startsWith('VALID') ? PATHD_THEME.mint :
                             v.startsWith('ERROR') ? PATHD_THEME.coral :
                             PATHD_THEME.apricot,
                    }}>
                      {v}
                    </p>
                  ))}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <button aria-label="Action" onClick={() => handleDownloadSBOL('xml')} style={{
                      flex: 1, padding: '5px', background: 'rgba(175,195,214,0.22)',
                      border: '1px solid rgba(175,195,214,0.34)', borderRadius: '6px',
                      color: VALUE, fontFamily: T.MONO, fontSize: '9px', cursor: 'pointer',
                    }}>↓ RDF/XML</button>
                    <button aria-label="Action" onClick={() => handleDownloadSBOL('turtle')} style={{
                      flex: 1, padding: '5px', background: 'rgba(207,196,227,0.22)',
                      border: '1px solid rgba(207,196,227,0.34)', borderRadius: '6px',
                      color: VALUE, fontFamily: T.MONO, fontSize: '9px', cursor: 'pointer',
                    }}>↓ Turtle</button>
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
                style={{ ...inputBase, fontFamily: T.MONO, fontSize: '10px', resize: 'vertical', marginBottom: '8px' }}
              />
              {assemblyError && (
                <div style={{ marginBottom: '8px' }}>
                  <SimErrorBanner message={assemblyError} />
                </div>
              )}
              <button aria-label="Action" onClick={handlePlanAssembly} style={{
                width: '100%', padding: '8px',
                background: 'rgba(191,220,205,0.2)',
                border: '1px solid rgba(191,220,205,0.34)',
                borderRadius: '8px', color: VALUE,
                fontFamily: T.SANS, fontSize: '11px', cursor: 'pointer',
              }}>
                🧬 Plan Assembly
              </button>
              {assemblyPlan && (
                <div style={{ ...GLASS, marginTop: '10px', padding: '12px' }}>
                  <div onClick={() => setAssemblyExpanded(p => !p)}
                    style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '10px', color: VALUE, fontWeight: 500 }}>
                      {assemblyPlan.targetName}
                    </span>
                    <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
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
                            <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>{lbl}</span>
                            <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE, textAlign: 'right' }}>{val}</span>
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
                            <p key={i} style={{ fontFamily: T.SANS, fontSize: '9px', color: PATHD_THEME.apricot, margin: '0 0 3px', lineHeight: 1.3 }}>
                              ⚠ {w}
                            </p>
                          ))}
                        </div>
                      )}
                      <p style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
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
                              <span style={{ fontFamily: T.MONO, fontSize: '7px', color: VALUE }}>{f.length}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                        <button aria-label="Action" onClick={handleDownloadPrimers} style={{
                          flex: 1, padding: '5px', background: 'rgba(191,220,205,0.22)',
                          border: '1px solid rgba(191,220,205,0.34)', borderRadius: '6px',
                          color: VALUE, fontFamily: T.MONO, fontSize: '9px', cursor: 'pointer',
                        }}>↓ Primers CSV</button>
                        <button aria-label="Action" onClick={handleGenerateGibsonProtocol} style={{
                          flex: 1, padding: '5px', background: 'rgba(175,195,214,0.22)',
                          border: '1px solid rgba(175,195,214,0.34)', borderRadius: '6px',
                          color: VALUE, fontFamily: T.MONO, fontSize: '9px', cursor: 'pointer',
                        }}>⚗ OT-2 Protocol</button>
                      </div>
                      <p style={{ fontFamily: T.MONO, fontSize: '8px', color: LABEL, margin: 0 }}>
                        Provenance: {assemblyPlan.provenanceId.slice(0, 8)}…
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ═══════ CENTER: Progress Ring + Timeline ═══════ */}
          <div className="nb-tool-center" style={{ flex: 1, background: PANEL_BG, padding: '12px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <ScientificFigureFrame
              eyebrow={figureMeta.eyebrow}
              title={figureMeta.title}
              caption={figureMeta.caption}
              legend={[
                { label: 'Phase', value: currentPhase, accent: PHASE_PASTEL[currentPhase] },
                { label: 'Pass rate', value: `${passRate}%`, accent: PATHD_THEME.mint },
                { label: 'Best result', value: `${bestIteration.result} ${bestIteration.unit}`, accent: PATHD_THEME.apricot },
                { label: 'Feedback', value: hasCommittedFeedback ? 'Committed' : 'Draft only', accent: hasCommittedFeedback ? PATHD_THEME.sky : PATHD_THEME.coral },
              ]}
              footer={
                <div style={{ display: 'grid', gap: '6px' }}>
                  <div style={{ fontFamily: T.SANS, fontSize: '11px', color: VALUE, lineHeight: 1.55 }}>
                    The central panel now behaves like an experimental ledger figure. Phase state, campaign trajectory, and governance status stay in one reading path so loop health can be judged at a glance.
                  </div>
                  <div style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
                    latest iteration #{latestIteration?.id ?? '—'} · {latestIteration?.result ?? '—'} {latestIteration?.unit ?? ''} · feedback {hasCommittedFeedback ? 'eligible for reseeding' : 'still locked'}
                  </div>
                </div>
              }
              minHeight="100%"
            >
              <div style={{ ...GLASS, padding: '8px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <CycleProgressRing currentPhase={currentPhase} iterationCount={displayIterations.length} />

                <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {PHASES.map(p => {
                    const isActive = p === currentPhase;
                    return (
                      <div key={p} style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        background: isActive ? `${PHASE_PASTEL[p]}33` : PATHD_THEME.paperSurfaceMuted,
                        border: `1px solid ${isActive ? `${PHASE_PASTEL[p]}66` : PATHD_THEME.paperBorder}`,
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: PHASE_PASTEL[p],
                          opacity: isActive ? 1 : 0.5,
                        }} />
                        <span style={{
                          fontFamily: T.SANS, fontSize: '10px',
                          color: isActive ? VALUE : LABEL,
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
            borderLeft: `1px solid ${BORDER}`, background: PANEL_BG,
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
            <div style={{ ...GLASS, padding: '14px' }}>
              <p style={{ ...sectionLabel, margin: '0 0 10px' }}>Automation Control Center</p>

              {/* CSV Upload drop zone */}
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '14px 8px',
                borderRadius: '12px',
                border: `2px dashed ${PATHD_THEME.paperBorderStrong}`,
                background: PATHD_THEME.paperSurfaceMuted,
                cursor: 'pointer',
                marginBottom: '12px',
                transition: 'border-color 0.2s',
              }}>
                <span style={{ fontFamily: T.SANS, fontSize: '11px', color: VALUE, marginBottom: '4px' }}>
                  {feedbackLoading ? '⏳ Processing…' : '↑ Upload Test CSV'}
                </span>
                <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>
                  .csv with sample_id, yield columns
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
                    padding: '10px', borderRadius: '12px',
                    background: PATHD_THEME.paperSurfaceMuted,
                    border: `1px solid ${PATHD_THEME.paperBorder}`,
                  }}>
                    <p style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
                      Test Summary
                    </p>
                    {([
                      ['Mean Yield', feedbackResult.test_summary.mean_yield.toFixed(2)],
                      ['Std Dev', feedbackResult.test_summary.std_yield.toFixed(2)],
                      ['Best Sample', feedbackResult.test_summary.best_sample],
                      ['Worst Sample', feedbackResult.test_summary.worst_sample],
                    ] as const).map(([lbl, val]) => (
                      <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ fontFamily: T.SANS, fontSize: '10px', color: LABEL }}>{lbl}</span>
                        <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE, textAlign: 'right' }}>{val}</span>
                      </div>
                    ))}
                  </div>

                  {/* QC Flags */}
                  {feedbackResult.qc_flags.length > 0 && (
                    <div>
                      <p style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
                        QC Flags ({feedbackResult.qc_flags.length})
                      </p>
                      {feedbackResult.qc_flags.map((flag: QCFlag, idx: number) => (
                        <div key={idx} style={{
                          padding: '8px', borderRadius: '8px', marginBottom: '6px',
                          background: flag.flag_type === 'sensor_anomaly'
                            ? 'rgba(231,199,169,0.18)'
                            : 'rgba(232,163,161,0.18)',
                          border: `1px solid ${flag.flag_type === 'sensor_anomaly'
                            ? 'rgba(231,199,169,0.34)'
                            : 'rgba(232,163,161,0.34)'}`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PHASE_PASTEL.Build }}>
                              {flag.flag_type === 'sensor_anomaly' ? '⚠' : '◆'} {flag.sample_id}
                            </span>
                            <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE, textAlign: 'right' }}>
                              {flag.measured_value.toFixed(1)} / {flag.theoretical_max.toFixed(1)}
                            </span>
                          </div>
                          <p style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL, margin: 0, lineHeight: 1.3 }}>
                            {flag.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Next Iteration Suggestions */}
                  {feedbackResult.next_iteration_suggestions.length > 0 && (
                    <div>
                      <p style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
                        Suggested Next Iteration
                      </p>
                      {feedbackResult.next_iteration_suggestions.map((s: NextIterationSuggestion, idx: number) => (
                        <div key={idx} style={{
                          padding: '8px', borderRadius: '8px', marginBottom: '6px',
                          background: 'rgba(191,220,205,0.18)',
                          border: '1px solid rgba(191,220,205,0.34)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontFamily: T.SANS, fontSize: '10px', color: PHASE_PASTEL.Learn, fontWeight: 500 }}>
                              {s.parameter}
                            </span>
                            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE, textAlign: 'right' }}>
                              +{s.predicted_improvement_percent.toFixed(1)}%
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>
                              {s.current_value}
                            </span>
                            <span style={{ fontFamily: T.SANS, fontSize: '10px', color: LABEL }}>→</span>
                            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE, textAlign: 'right' }}>
                              {s.suggested_value}
                            </span>
                          </div>
                          <p style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL, margin: 0, lineHeight: 1.3 }}>
                            {s.rationale}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Optimization Objective */}
                  <p style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL, margin: 0, textAlign: 'center' }}>
                    objective: {feedbackResult.optimization_objective}
                  </p>
                </div>
              )}
            </div>

            {/* ── Provenance Tracker ── */}
            {assemblyProvenance.length > 0 && (
              <div style={{ ...GLASS, padding: '14px', marginTop: '16px' }}>
                <p style={{ ...sectionLabel, margin: '0 0 10px' }}>
                  Data Provenance ({assemblyProvenance.length} records)
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {assemblyProvenance.map(p => {
                    const tc: Record<string, string> = {
                      fragment: PATHD_THEME.mint,
                      primer: PATHD_THEME.sky,
                      assembly: PATHD_THEME.lilac,
                      transformant: PATHD_THEME.coral,
                      culture: PATHD_THEME.apricot,
                    };
                    const clr = tc[p.sampleType] ?? VALUE;
                    return (
                      <div key={p.uuid} style={{ padding: '8px', borderRadius: '8px', background: PATHD_THEME.paperSurfaceMuted, border: `1px solid ${PATHD_THEME.paperBorder}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontFamily: T.MONO, fontSize: '9px', color: clr }}>{p.sampleType.toUpperCase()}</span>
                          <span style={{ fontFamily: T.MONO, fontSize: '8px', color: LABEL, textAlign: 'right' }}>
                            {p.well ? 'Well ' + p.well : ''}{p.slot ? ' · Slot ' + p.slot : ''}
                          </span>
                        </div>
                        <p style={{ fontFamily: T.SANS, fontSize: '9px', color: VALUE, margin: '0 0 2px', lineHeight: 1.3 }}>{p.label}</p>
                        <p style={{ fontFamily: T.MONO, fontSize: '7px', color: LABEL, margin: 0 }}>{p.uuid}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══════ Footer: Export ═══════ */}
        <div style={{
          borderTop: `1px solid ${BORDER}`, padding: '8px 16px',
          display: 'flex', gap: '8px', flexShrink: 0, background: PANEL_BG,
        }}>
          <ExportButton label="Export JSON" data={displayIterations} filename="dbtlflow-iterations" format="json" />
          <ExportButton label="Export CSV" data={displayIterations} filename="dbtlflow-iterations" format="csv" />
        </div>
      </div>
    </>
  );
}
