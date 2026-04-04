'use client';
import { useState, useMemo } from 'react';
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
import { T, TOOL_RESULT_PALETTE} from '../ide/tokens';

/* ── Design Tokens ── */
const PHASE_PASTEL: Record<string, string> = {
  Design: '#5151CD',
  Build:  '#FFFB1F',
  Test:   '#FA8072',
  Learn:  '#F0FDFA',
};

const PANEL_BG = '#000000';
const BORDER = 'rgba(255,255,255,0.06)';
const LABEL = 'rgba(255,255,255,0.45)';
const VALUE = 'rgba(255,255,255,0.65)';
const INPUT_BG = 'rgba(255,255,255,0.05)';
const INPUT_BORDER = 'rgba(255,255,255,0.08)';
const INPUT_TEXT = 'rgba(255,255,255,0.7)';

const GLASS: React.CSSProperties = {
  borderRadius: '24px',
  backdropFilter: 'blur(12px)',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const PHASES: DBTLPhase[] = ['Design', 'Build', 'Test', 'Learn'];

/* ── Timeline (preserved) ── */
function Timeline({ iterations }: { iterations: DBTLIteration[] }) {
  const maxResult = Math.max(...iterations.map(i => i.result));

  return (
    <svg role="img" aria-label="Chart"
      viewBox={`0 0 520 ${Math.max(360, iterations.length * 60 + 40)}`}
      style={{ width: '100%', height: '100%' }}
    >
      <rect width="520" height={Math.max(360, iterations.length * 60 + 40)} fill="#050505" />
      {iterations.length > 1 && (
        <polyline
          points={iterations
            .map((it, i) => `${160 + (it.result / maxResult) * 280},${30 + i * 60 + 20}`)
            .join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}
      <line x1={160} y1={20} x2={160} y2={30 + iterations.length * 60} stroke="rgba(255,255,255,0.08)" />
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
  const color = PHASE_PASTEL[currentPhase] ?? '#5151CD';

  const size = 140;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0' }}>
      <svg role="img" aria-label="Chart" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
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
          color, letterSpacing: '0.04em',
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

  // Iteration state (preserved)
  const [iterations, setIterations] = useState<DBTLIteration[]>(INITIAL_ITERATIONS);
  const [hypothesis, setHypothesis] = useState('');
  const [result, setResult] = useState('');
  const [unit, setUnit] = useState('mg/L');
  const [passed, setPassed] = useState(true);

  // Protocol state
  const [generatedProtocol, setGeneratedProtocol] = useState<GeneratedProtocol | null>(null);
  const [protocolExpanded, setProtocolExpanded] = useState(false);

  // Feedback loop state
  const [feedbackResult, setFeedbackResult] = useState<FeedbackLoopResult | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Derived values (preserved)
  const bestIteration = iterations.reduce((a, b) => (b.result > a.result ? b : a), iterations[0]);
  const improvementRate =
    iterations.length > 1
      ? ((iterations[iterations.length - 1].result - iterations[0].result) / iterations.length).toFixed(2)
      : '0';
  const passRate = ((iterations.filter(i => i.passed).length / iterations.length) * 100).toFixed(0);

  const latestIteration = iterations[iterations.length - 1];
  const currentPhase: DBTLPhase = latestIteration?.phase ?? 'Design';

  /* ── Handlers ── */
  function addIteration() {
    if (!hypothesis.trim() || !result.trim()) return;
    setIterations(prev => appendIteration(prev, hypothesis, parseFloat(result), unit, passed));
    setHypothesis('');
    setResult('');
  }

  function handleGenerateProtocol() {
    if (!latestIteration) return;
    const proto = generator.generate(latestIteration);
    setGeneratedProtocol(proto);
    setProtocolExpanded(true);
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
    const reader = new FileReader();
    reader.onload = () => {
      const csvText = reader.result as string;
      try {
        const fbResult = AutomatedFeedbackLoop(csvText, latestIteration, 10, 20);
        setFeedbackResult(fbResult);
      } catch {
        setFeedbackResult(null);
      }
      setFeedbackLoading(false);
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
    const doc = serializePartsToSBOL(SHOWCASE_PARTS, 'ADS_Expression_Cassette');
    setSbolDoc(doc);
    setSbolValidation(validateSBOL(doc));
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
  const DEMO_SEQ = 'ATGCTTCAGCTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCAATTTTGATTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGAAGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGGTTTTCAAGGATGCTTCAGCTTTTCAAGGATCCAATTTTGGTAACGCCAGGTTTTCTCCTCTTCCTGG';

  function handlePlanAssembly() {
    const seq = seqInput.trim() || DEMO_SEQ;
    const plan = planGibsonAssembly(seq, 'ADS_Cassette', { maxFragmentLength: 800, overlapLength: 30 });
    setAssemblyPlan(plan);
    setAssemblyProvenance(generateProvenanceRecords(plan));
    setAssemblyExpanded(true);
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
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#050505' }}>
        <AlgorithmInsight
          title="Design-Build-Test-Learn Tracker"
          description="Iterative experimental optimization. Each cycle records a hypothesis, measured result, and learning for the next design."
          formula="Cycle: D→B→T→L→D'"
        />

        <div className="nb-tool-panels" style={{ flex: 1 }}>

          {/* ═══════ LEFT PANEL: Input + Protocol ═══════ */}
          <div style={{
            width: '260px', flexShrink: 0, overflowY: 'auto', padding: '16px',
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
                  background: passed === p ? (p ? 'rgba(120,220,160,0.12)' : 'rgba(255,80,80,0.1)') : 'transparent',
                  border: `1px solid ${passed === p ? (p ? 'rgba(120,220,160,0.3)' : 'rgba(255,80,80,0.3)') : INPUT_BORDER}`,
                  borderRadius: '8px',
                  color: passed === p ? (p ? 'rgba(120,220,160,0.9)' : 'rgba(255,100,80,0.9)') : LABEL,
                  fontFamily: T.SANS, fontSize: '11px', cursor: 'pointer',
                }}>
                  {p ? '✓ Pass' : '✗ Fail'}
                </button>
              ))}
            </div>

            {/* Add iteration button */}
            <button aria-label="Action" onClick={addIteration} disabled={!hypothesis.trim() || !result.trim()} style={{
              width: '100%', padding: '8px',
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${INPUT_BORDER}`,
              borderRadius: '8px',
              color: VALUE,
              fontFamily: T.SANS, fontSize: '11px', cursor: 'pointer',
            }}>
              + Add Iteration
            </button>

            {/* Best Result */}
            <div style={{
              marginTop: '16px', padding: '10px',
              background: 'rgba(120,220,160,0.06)', borderRadius: '10px',
              border: '1px solid rgba(120,220,160,0.15)',
            }}>
              <p style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Best Result
              </p>
              <p style={{ fontFamily: T.MONO, fontSize: '14px', color: 'rgba(120,220,160,0.85)', margin: '0 0 4px' }}>
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
                background: 'rgba(81,81,205,0.08)',
                border: '1px solid rgba(81,81,205,0.2)',
                borderRadius: '8px',
                color: PHASE_PASTEL.Design,
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
                        background: 'rgba(81,81,205,0.1)',
                        border: '1px solid rgba(81,81,205,0.2)',
                        borderRadius: '6px',
                        color: PHASE_PASTEL.Design,
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
                background: 'rgba(255,31,255,0.08)',
                border: '1px solid rgba(255,31,255,0.2)',
                borderRadius: '8px', color: '#FF1FFF',
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
                      color: v.startsWith('VALID') ? 'rgba(120,220,160,0.8)' :
                             v.startsWith('ERROR') ? 'rgba(255,100,80,0.8)' :
                             'rgba(255,251,31,0.8)',
                    }}>
                      {v}
                    </p>
                  ))}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <button aria-label="Action" onClick={() => handleDownloadSBOL('xml')} style={{
                      flex: 1, padding: '5px', background: 'rgba(255,31,255,0.1)',
                      border: '1px solid rgba(255,31,255,0.2)', borderRadius: '6px',
                      color: '#FF1FFF', fontFamily: T.MONO, fontSize: '9px', cursor: 'pointer',
                    }}>↓ RDF/XML</button>
                    <button aria-label="Action" onClick={() => handleDownloadSBOL('turtle')} style={{
                      flex: 1, padding: '5px', background: 'rgba(81,81,205,0.1)',
                      border: '1px solid rgba(81,81,205,0.2)', borderRadius: '6px',
                      color: '#5151CD', fontFamily: T.MONO, fontSize: '9px', cursor: 'pointer',
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
              <button aria-label="Action" onClick={handlePlanAssembly} style={{
                width: '100%', padding: '8px',
                background: 'rgba(240,253,250,0.08)',
                border: '1px solid rgba(240,253,250,0.2)',
                borderRadius: '8px', color: '#F0FDFA',
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
                                     assemblyPlan.tmSpread <= 5 ? 'rgba(255,251,31,0.7)' : 'rgba(255,100,80,0.7)',
                        }} />
                      </div>
                      {assemblyPlan.warnings.length > 0 && (
                        <div style={{ marginBottom: '8px' }}>
                          {assemblyPlan.warnings.map((w, i) => (
                            <p key={i} style={{ fontFamily: T.SANS, fontSize: '9px', color: 'rgba(255,251,31,0.8)', margin: '0 0 3px', lineHeight: 1.3 }}>
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
                          const colors = ['rgba(240,253,250,0.3)', 'rgba(255,31,255,0.3)', 'rgba(81,81,205,0.3)', 'rgba(250,128,114,0.3)'];
                          const borders = ['rgba(240,253,250,0.5)', 'rgba(255,31,255,0.5)', 'rgba(81,81,205,0.5)', 'rgba(250,128,114,0.5)'];
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
                          flex: 1, padding: '5px', background: 'rgba(240,253,250,0.1)',
                          border: '1px solid rgba(240,253,250,0.2)', borderRadius: '6px',
                          color: '#F0FDFA', fontFamily: T.MONO, fontSize: '9px', cursor: 'pointer',
                        }}>↓ Primers CSV</button>
                        <button aria-label="Action" onClick={handleGenerateGibsonProtocol} style={{
                          flex: 1, padding: '5px', background: 'rgba(81,81,205,0.1)',
                          border: '1px solid rgba(81,81,205,0.2)', borderRadius: '6px',
                          color: '#5151CD', fontFamily: T.MONO, fontSize: '9px', cursor: 'pointer',
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
          <div style={{ flex: 1, overflow: 'auto', background: '#050505', padding: '12px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ ...GLASS, padding: '8px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <CycleProgressRing currentPhase={currentPhase} iterationCount={iterations.length} />

              {/* Phase legend */}
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {PHASES.map(p => {
                  const isActive = p === currentPhase;
                  return (
                    <div key={p} style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: isActive ? `${PHASE_PASTEL[p]}18` : 'transparent',
                      border: `1px solid ${isActive ? `${PHASE_PASTEL[p]}40` : 'rgba(255,255,255,0.06)'}`,
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: PHASE_PASTEL[p],
                        opacity: isActive ? 1 : 0.3,
                      }} />
                      <span style={{
                        fontFamily: T.SANS, fontSize: '10px',
                        color: isActive ? PHASE_PASTEL[p] : LABEL,
                        fontWeight: isActive ? 600 : 400,
                      }}>
                        {p}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
              <Timeline iterations={iterations} />
            </div>
          </div>

          {/* ═══════ RIGHT PANEL: Campaign Summary + Automation Control Center ═══════ */}
          <div style={{
            width: '260px', flexShrink: 0, overflowY: 'auto', padding: '16px',
            borderLeft: `1px solid ${BORDER}`, background: PANEL_BG,
          }}>
            {/* Campaign Summary (preserved) */}
            <p style={sectionLabel}>Campaign Summary</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <MetricCard label="Total Iterations" value={iterations.length} highlight />
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
                border: '2px dashed rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.02)',
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

              {/* Feedback Results */}
              {feedbackResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                  {/* Test Summary */}
                  <div style={{
                    padding: '10px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
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
                            ? 'rgba(255,251,31,0.08)'
                            : 'rgba(250,128,114,0.08)',
                          border: `1px solid ${flag.flag_type === 'sensor_anomaly'
                            ? 'rgba(255,251,31,0.2)'
                            : 'rgba(250,128,114,0.2)'}`,
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
                          background: 'rgba(240,253,250,0.06)',
                          border: '1px solid rgba(240,253,250,0.15)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontFamily: T.SANS, fontSize: '10px', color: PHASE_PASTEL.Learn, fontWeight: 500 }}>
                              {s.parameter}
                            </span>
                            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: 'rgba(120,220,160,0.85)', textAlign: 'right' }}>
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
                    const tc: Record<string, string> = { fragment: '#F0FDFA', primer: '#5151CD', assembly: '#FF1FFF', transformant: '#FA8072', culture: '#FFFB1F' };
                    const clr = tc[p.sampleType] ?? VALUE;
                    return (
                      <div key={p.uuid} style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
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
          <ExportButton label="Export JSON" data={iterations} filename="dbtlflow-iterations" format="json" />
          <ExportButton label="Export CSV" data={iterations} filename="dbtlflow-iterations" format="csv" />
        </div>
      </div>
    </>
  );
}
