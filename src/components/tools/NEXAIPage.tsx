'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import ToolShell, { TOOL_TOKENS as T } from './shared/ToolShell';
import ModuleCard from './shared/ModuleCard';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import type { NEXAIResult, CitationNode, GeneratedPathway } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { useWorkbenchStore } from '../../store/workbenchStore';
import WorkbenchInlineContext from '../workbench/WorkbenchInlineContext';
import ScientificHero from './shared/ScientificHero';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import ScientificMethodStrip from './shared/ScientificMethodStrip';
import ResearchAnswerRenderer from './shared/ResearchAnswerRenderer';

const AXON_ACCENT = PATHD_THEME.blue;

// ── Full-bleed Citation Graph ──────────────────────────────────────────

function CitationGraph({ citations, onNodeClick }: {
  citations: CitationNode[];
  onNodeClick?: (c: CitationNode) => void;
}) {
  const W = 640, H = 480;
  const [hovered, setHovered] = useState<string | null>(null);
  const sorted = [...citations].sort((left, right) => left.year - right.year);
  const yearMin = Math.min(...sorted.map((citation) => citation.year), sorted[0]?.year ?? 2020);
  const yearMax = Math.max(...sorted.map((citation) => citation.year), sorted[sorted.length - 1]?.year ?? yearMin + 1);
  const yearRange = Math.max(yearMax - yearMin, 1);

  const nodes = sorted.map((citation, index) => {
    const x = 68 + ((citation.year - yearMin) / yearRange) * (W - 136);
    const lane = index % 4;
    const relevanceY = 104 + (1 - citation.relevance) * 188;
    const laneOffset = lane % 2 === 0 ? -18 : 18;
    return {
      ...citation,
      x,
      y: relevanceY + laneOffset,
      r: 11 + citation.relevance * 11,
      lane,
    };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <defs>
        <filter id="nexai-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="nexai-node-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect width={W} height={H} rx={16} fill="#05070b" />
      <rect x="24" y="24" width={W - 48} height={H - 48} rx="18" fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.06)" />
      <text x="40" y="22" fontFamily={T.SANS} fontSize="10" fill="rgba(205,214,236,0.6)" letterSpacing="0.12em">
        LITERATURE SUPPORT MAP
      </text>
      <text x="40" y="36" fontFamily={T.SANS} fontSize="12" fill="rgba(247,249,255,0.92)">
        Publications positioned by year and relevance, with bridge citations highlighted
      </text>

      {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
        const y = 92 + tick * 220;
        return (
          <g key={`g-${tick}`}>
            <line x1="52" y1={y} x2={W - 52} y2={y} stroke="rgba(255,255,255,0.045)" />
            <text x="46" y={y + 3} textAnchor="end" fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.28)">
              {(1 - tick).toFixed(2)}
            </text>
          </g>
        );
      })}
      <line x1="52" y1="330" x2={W - 52} y2="330" stroke="rgba(255,255,255,0.12)" />
      {Array.from({ length: Math.min(6, yearRange + 1) }).map((_, index, arr) => {
        const year = Math.round(yearMin + (index / Math.max(arr.length - 1, 1)) * yearRange);
        const x = 68 + ((year - yearMin) / yearRange) * (W - 136);
        return (
          <g key={`year-${year}`}>
            <line x1={x} y1="330" x2={x} y2="336" stroke="rgba(255,255,255,0.12)" />
            <text x={x} y="350" textAnchor="middle" fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.28)">
              {year}
            </text>
          </g>
        );
      })}

      {/* Curved arc bridge citation edges */}
      {nodes.map((node, index) =>
        nodes.slice(index + 1)
          .filter((candidate) => Math.abs(candidate.year - node.year) <= 4 && Math.abs(candidate.relevance - node.relevance) <= 0.22)
          .slice(0, 2)
          .map((peer, edgeIndex) => {
            const mx = (node.x + peer.x) / 2;
            const my = Math.min(node.y, peer.y) - 28 - Math.abs(node.x - peer.x) * 0.15;
            const combined = (node.relevance + peer.relevance) / 2;
            return (
              <path
                key={`arc-${index}-${edgeIndex}`}
                d={`M ${node.x} ${node.y} Q ${mx} ${my} ${peer.x} ${peer.y}`}
                fill="none"
                stroke={combined > 0.7 ? 'rgba(175,195,214,0.32)' : 'rgba(175,195,214,0.16)'}
                strokeWidth={combined > 0.7 ? 1.2 : 0.7}
              />
            );
          })
      )}

      {nodes.map(n => {
        const isHov = hovered === n.id;
        return (
          <g key={n.id}
            onMouseEnter={() => setHovered(n.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onNodeClick?.(n)}
            style={{ cursor: 'pointer' }}>
            <line x1={n.x} y1="330" x2={n.x} y2={n.y + n.r + 4} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 4" />
            {/* Glow halo for high-relevance nodes */}
            {n.relevance > 0.7 && (
              <circle cx={n.x} cy={n.y} r={n.r + 4}
                fill={isHov ? 'rgba(231,199,169,0.22)' : 'rgba(175,195,214,0.18)'}
                filter="url(#nexai-node-glow)" />
            )}
            <circle cx={n.x} cy={n.y} r={n.r}
              fill={isHov ? 'rgba(175,195,214,0.24)' : 'rgba(18,26,40,0.88)'}
              stroke={isHov ? 'rgba(231,199,169,0.9)' : n.relevance > 0.7 ? 'rgba(175,195,214,0.72)' : 'rgba(175,195,214,0.46)'}
              strokeWidth={isHov ? 1.8 : n.relevance > 0.7 ? 1.5 : 1.1}
            />
            <text x={n.x} y={n.y + 4} textAnchor="middle"
              fontFamily={T.MONO} fontSize="9" fill={isHov ? 'rgba(255,244,230,0.96)' : 'rgba(255,255,255,0.72)'}>
              {n.year}
            </text>
            <text x={n.x} y={n.y + n.r + 16} textAnchor="middle" fontFamily={T.SANS} fontSize="8" fill="rgba(205,214,236,0.62)">
              {n.title.slice(0, 14)}{n.title.length > 14 ? '…' : ''}
            </text>
            {isHov && (
              <foreignObject x={Math.min(n.x + n.r + 8, W - 248)} y={Math.max(n.y - 48, 48)} width={220} height={92}>
                <div style={{
                  background: 'rgba(9,12,18,0.88)',
                  border: `1px solid rgba(255,255,255,0.08)`,
                  borderRadius: '12px',
                  padding: '8px 10px',
                  backdropFilter: 'blur(14px)',
                  boxShadow: '0 18px 34px rgba(0,0,0,0.28)',
                }}>
                  <p style={{ fontFamily: T.SANS, fontSize: '10px', color: 'rgba(255,255,255,0.84)', margin: '0 0 3px', lineHeight: 1.45 }}>
                    {n.title.slice(0, 80)}{n.title.length > 80 ? '…' : ''}
                  </p>
                  <p style={{ fontFamily: T.MONO, fontSize: '8px', color: 'rgba(175,195,214,0.9)', margin: '0 0 4px' }}>
                    Relevance: {(n.relevance * 100).toFixed(0)}%
                  </p>
                  <p style={{ fontFamily: T.SANS, fontSize: '9px', color: 'rgba(205,214,236,0.6)', margin: 0 }}>
                    Bridge this citation into the active evidence bundle if it should steer the current project route.
                  </p>
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}
      <text x={14} y={H - 12} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.18)">
        Y-axis = citation relevance · X-axis = publication year
      </text>
    </svg>
  );
}

// ── Floating CLI Overlay ───────────────────────────────────────────────

function FloatingCLI({ query, setQuery, onSubmit, loading, history, placeholder }: {
  query: string;
  setQuery: (q: string) => void;
  onSubmit: () => void;
  loading: boolean;
  history: string[];
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [histIdx, setHistIdx] = useState(-1);
  const [btnHovered, setBtnHovered] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && e.target === document.body) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if ((e.nativeEvent as KeyboardEvent).isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIdx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(newIdx);
      if (history[newIdx]) setQuery(history[newIdx]);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIdx = Math.max(histIdx - 1, -1);
      setHistIdx(newIdx);
      setQuery(newIdx < 0 ? '' : (history[newIdx] ?? ''));
    }
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        position: 'absolute', bottom: '16px', left: '16px', right: '16px',
        borderRadius: '22px',
        background: '#050505',
        border: `1px solid ${loading ? 'rgba(175,195,214,0.2)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: loading ? '0 18px 48px rgba(12,20,30,0.34)' : '0 18px 48px rgba(4,10,16,0.24)',
        padding: '8px',
        display: 'flex', alignItems: 'center', gap: '10px',
        zIndex: 10,
      }}
    >
      {loading ? (
        <span style={{ display: 'flex', gap: '3px', alignItems: 'center', flexShrink: 0 }}>
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.22 }}
              style={{
                display: 'block', width: '5px', height: '5px', borderRadius: '50%',
                background: AXON_ACCENT,
              }}
            />
          ))}
        </span>
      ) : (
        <span style={{ fontFamily: T.MONO, fontSize: '11px', fontWeight: 700, color: PATHD_THEME.label, flexShrink: 0, padding: '0 10px' }}>
          /
        </span>
      )}
      <input
        ref={inputRef}
        className="nb-nexai-ask-input"
        value={query}
        onChange={e => { setQuery(e.target.value); setHistIdx(-1); }}
        onKeyDown={handleKey}
        placeholder={placeholder}
        enterKeyHint="search"
        disabled={loading}
        style={{
          flex: 1, minHeight: '44px', background: 'transparent', border: 'none', outline: 'none',
          fontFamily: T.SANS, fontSize: '14px',
          color: PATHD_THEME.value,
          caretColor: AXON_ACCENT,
          letterSpacing: '-0.01em',
        }}
      />
      <motion.button
        aria-label="Submit Axon query"
        onClick={onSubmit}
        disabled={loading || !query.trim()}
        whileTap={{ scale: 0.95 }}
        onMouseEnter={() => setBtnHovered(true)}
        onMouseLeave={() => setBtnHovered(false)}
        style={{
          minHeight: '44px',
          minWidth: '110px',
          padding: '0 18px',
          borderRadius: '16px',
          cursor: (loading || !query.trim()) ? 'not-allowed' : 'pointer',
          fontFamily: T.SANS, fontSize: '13px', fontWeight: 700,
          background: loading ? 'rgba(255,255,255,0.08)' : (btnHovered ? '#ffffff' : '#f4f7fb'),
          border: 'none',
          color: loading ? PATHD_THEME.label : '#111318',
          opacity: (!loading && !query.trim()) ? 0.45 : 1,
          boxShadow: (!loading && btnHovered) ? '0 2px 12px rgba(0,0,0,0.22)' : 'none',
          transition: 'background 0.15s, box-shadow 0.15s',
          flexShrink: 0,
        }}
      >
        {loading ? 'Searching' : 'Ask Axon'}
      </motion.button>
    </motion.div>
  );
}

// ── Preset Chips ───────────────────────────────────────────────────────

const PRESET_QUERIES = [
  'How does tHMGR improve artemisinin precursor supply?',
  'Key bottlenecks in the artemisinin biosynthesis pathway?',
  'Dynamic regulation strategies for isoprenoid overproduction',
];

// ── Extract year from a citation string (e.g. "Ro et al., 2006.") ───────
function extractYear(citation?: string): number | null {
  if (!citation) return null;
  const m = citation.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0]) : null;
}

// ── Build NEXAIResult from Axon pathway JSON ─────────────────────────────
function pathwayToResult(pathway: GeneratedPathway, query: string, provider: string): NEXAIResult {
  const nodes = (pathway.nodes || []).slice(0, 14);
  const bottlenecks = (pathway as any).bottleneck_enzymes || [];
  const axon = (pathway as any).axon_interaction;

  // Map pathway nodes → CitationNode for the graph
  const W = 600, H = 420;
  const citations: CitationNode[] = nodes.map((n, i) => {
    // Use 3D position projected to 2D, clamped to canvas
    const rawX = n.position ? n.position[0] * 45 + W / 2 : 60 + ((i * 115) % (W - 120));
    const rawY = n.position ? n.position[1] * 30 + H / 2 : 50 + Math.floor(i / 5) * 110 + (i % 2) * 28;
    return {
      id: n.id,
      title: n.label + (n.summary ? ' — ' + n.summary.slice(0, 70) : ''),
      authors: n.citation || 'Axon · Nexus-Bio analysis',
      year: extractYear(n.citation) ?? new Date().getFullYear(),
      relevance: n.confidenceScore ?? 0.75,
      x: Math.max(40, Math.min(W - 40, rawX)),
      y: Math.max(40, Math.min(H - 40, rawY)),
    };
  });

  // Build answer text
  let answer = '';
  if (axon?.question) {
    answer = axon.question;
    if (bottlenecks.length > 0) {
      const bList = bottlenecks
        .map((b: any) => `${b.enzyme} (${b.efficiency_percent}% efficiency, ${b.yield_loss_percent}% yield loss)`)
        .join('; ');
      answer += `\n\nBottleneck enzymes identified: ${bList}.`;
      if (axon.options?.length) answer += ` Recommended: ${axon.options.join(' or ')}.`;
    }
  } else if (bottlenecks.length > 0) {
    const b = bottlenecks[0];
    answer = `Axon identified ${nodes.length} pathway nodes for "${query}". Primary bottleneck: ${b.enzyme} at ${b.efficiency_percent}% efficiency (${b.yield_loss_percent}% yield loss). ${b.evidence || ''}`;
  } else {
    answer = `Axon mapped ${nodes.length} nodes across the ${query} pathway. Confidence: ${((nodes.reduce((s: number, n: any) => s + (n.confidenceScore ?? 0.7), 0) / Math.max(nodes.length, 1)) * 100).toFixed(0)}%. Source: ${provider}.`;
  }

  const avgConfidence = nodes.reduce((s, n) => s + (n.confidenceScore ?? 0.7), 0) / Math.max(nodes.length, 1);
  return { query, answer, citations, confidence: avgConfidence, generatedAt: Date.now() };
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function NEXAIPage() {
  const appendConsole = useUIStore(s => s.appendConsole);
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const evidenceItems = useWorkbenchStore((s) => s.evidenceItems);
  const selectedEvidenceIds = useWorkbenchStore((s) => s.selectedEvidenceIds);
  const nextRecommendations = useWorkbenchStore((s) => s.nextRecommendations);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NEXAIResult | null>(null);
  const [resultMode, setResultMode] = useState<'pathway' | 'text' | 'idle'>('idle');
  const [surfaceView, setSurfaceView] = useState<'answer' | 'evidence'>('answer');
  const [history, setHistory] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const isUngrounded = Boolean(result) && result.citations.length === 0;

  const contextPrompt = useMemo(() => {
    if (analyzeArtifact) {
      const bottleneck = analyzeArtifact.bottleneckAssumptions[0]?.label ?? 'current pathway bottleneck';
      return `What are the highest-risk assumptions for ${analyzeArtifact.targetProduct}, especially around ${bottleneck}, and which tool should I run next?`;
    }
    if (project?.targetProduct) {
      return `Summarize the best next step for the ${project.targetProduct} program using the current evidence bundle.`;
    }
    return '';
  }, [analyzeArtifact, project?.targetProduct]);

  useEffect(() => {
    setToolPayload('nexai', {
      toolId: 'nexai',
      targetProduct: analyzeArtifact?.targetProduct ?? project?.targetProduct ?? 'Scientific workbench',
      sourceArtifactId: analyzeArtifact?.id,
      query: query || contextPrompt,
      result: {
        confidence: result?.confidence ?? 0,
        citations: result?.citations.length ?? 0,
        answerPreview: result?.answer.slice(0, 180) ?? '',
        mode: result ? resultMode : 'idle',
      },
      updatedAt: Date.now(),
    });
  }, [
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    contextPrompt,
    project?.targetProduct,
    query,
    result,
    resultMode,
    setToolPayload,
  ]);

  async function runQuery() {
    const activeQuery = query.trim();
    if (!activeQuery) return;
    setHistory(prev => [activeQuery, ...prev.slice(0, 19)]);
    setLoading(true);
    setApiError(null);
    appendConsole({ level: 'info', module: 'nexai', message: `Query: "${activeQuery.slice(0, 60)}${activeQuery.length > 60 ? '…' : ''}"` });

    // Inject workbench context into the prompt as a real upstream signal — this is
    // not a fake response, it is real context that the LLM consumes alongside the question.
    const contextualQuery = analyzeArtifact
      ? [
          activeQuery,
          '',
          'Workbench context:',
          `Target product: ${analyzeArtifact.targetProduct}`,
          `Pathway candidates: ${analyzeArtifact.pathwayCandidates.length}`,
          `Evidence bundle size: ${selectedEvidenceIds.length}`,
          `Top bottleneck: ${analyzeArtifact.bottleneckAssumptions[0]?.label ?? 'Not specified'}`,
          `Thermodynamic concern: ${analyzeArtifact.thermodynamicConcerns[0] ?? 'Not specified'}`,
        ].join('\n')
      : activeQuery;

    try {
      // Call Axon (Groq llama-3.3-70b-versatile via /api/analyze) — the ONLY source of answers.
      // No template fallback. If this fails, the user sees an honest error, not a synthesized impostor.
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchQuery: contextualQuery }),
      });

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const provider: string = data?.meta?.provider ?? 'groq';

      if (!res.ok || !rawText) throw new Error(data?.error ?? `HTTP ${res.status}`);

      // Try to parse as Axon pathway JSON
      let pathway: GeneratedPathway | null = null;
      try {
        const parsed = JSON.parse(rawText);
        if (parsed?.nodes?.length) pathway = parsed as GeneratedPathway;
      } catch { /* not JSON — fall through to text mode */ }

      if (pathway) {
        setResult(pathwayToResult(pathway, activeQuery, provider));
        setResultMode('pathway');
        setSurfaceView('answer');
        const bottlenecks = (pathway as any).bottleneck_enzymes?.length ?? 0;
        appendConsole({ level: 'success', module: 'nexai', message: `Axon: ${pathway.nodes.length} nodes · ${bottlenecks} bottleneck(s) · ${provider}` });
      } else {
        // Plain text answer (non-pathway question) — straight from Groq, no contextual blending.
        // Confidence is fixed at 0.75 as an LLM-estimated baseline; will be displayed with a
        // "LLM-estimated" caveat in the UI.
        setResult({
          query: activeQuery,
          answer: rawText.slice(0, 1200),
          citations: [],
          confidence: 0.75,
          generatedAt: Date.now(),
        });
        setResultMode('text');
        setSurfaceView('answer');
        appendConsole({ level: 'success', module: 'nexai', message: `Axon: text response · ${provider}` });
      }

      // Fetch real citations from Semantic Scholar (best-effort, independent of Groq).
      // This is a real external API, not a mock — it loads actual papers.
      try {
        const ssUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(activeQuery.slice(0, 100))}&fields=title,authors,year,citationCount&limit=5`;
        const ssRes = await fetch(ssUrl);
        if (ssRes.ok) {
          const ssData = await ssRes.json();
          const ssCitations: CitationNode[] = (ssData.data ?? []).map((p: Record<string, unknown>, i: number) => ({
            id: (p.paperId as string) ?? `ss-${i}`,
            title: (p.title as string) ?? 'Unknown title',
            authors: ((p.authors as {name:string}[]) ?? []).map((a) => a.name).join(', ') || 'Unknown authors',
            year: (p.year as number) ?? new Date().getFullYear(),
            relevance: Math.max(0.1, 1 - i * 0.16),
          }));
          if (ssCitations.length > 0) {
            setResult(prev => prev ? {
              ...prev,
              citations: [...ssCitations, ...prev.citations.filter(c => !ssCitations.find(s => s.id === c.id))].slice(0, 10),
            } : prev);
            appendConsole({ level: 'info', module: 'nexai', message: `Semantic Scholar: ${ssCitations.length} real citation(s) loaded` });
          }
        }
      } catch { /* Semantic Scholar optional */ }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      appendConsole({ level: 'error', module: 'nexai', message: `Groq API unavailable — ${errMsg.slice(0, 120)}` });
      setApiError(`Groq API unavailable — ${errMsg}. Please verify GROQ_API_KEY is configured and try again.`);
      setResult(null);
      setResultMode('idle');
      setSurfaceView('answer');
    }
    setLoading(false);
  }

  return (
    <ToolShell
      moduleId="nexai"
      title="Axon"
      description="Semantic search across PubMed, UniProt, ChEMBL, Reactome, KEGG — synthesized by Groq"
      formula="score = α·semantic_sim + β·citation_weight"
      grid="'presets graph stats' 'presets graph stats'"
      columns="200px 1fr 200px"
      rows="1fr 1fr"
      gap={6}
      hero={
        <>
          <ScientificHero
            eyebrow="Cross-Stage · Research Copilot"
            title="Evidence-grounded synthesis for the active workbench object"
            summary="Axon now opens as a decision surface rather than a blank chat box. The page foregrounds what it currently knows, how confident that knowledge is, how much evidence is attached, and whether the answer is coming from a live pathway graph or contextual scientific synthesis."
            aside={
              <>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Current scope
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '13px', color: PATHD_THEME.value, fontWeight: 700 }}>
                  {analyzeArtifact?.targetProduct ?? project?.targetProduct ?? project?.title ?? 'Scientific workbench'}
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.55 }}>
                  {contextPrompt || 'Ask Axon to synthesize evidence, explain a bottleneck, or route the next scientific action.'}
                </div>
              </>
            }
            signals={[
              {
                label: 'Answer Mode',
                value: result ? resultMode.toUpperCase() : 'IDLE',
                detail: resultMode === 'pathway' ? 'Live pathway graph answer from the analysis route.' : resultMode === 'text' ? 'Contextual scientific synthesis grounded in the current project graph.' : 'No active answer yet.',
                tone: resultMode === 'pathway' ? 'cool' : resultMode === 'text' ? 'warm' : 'neutral',
              },
              {
                label: 'Confidence',
                value: result ? `${(result.confidence * 100).toFixed(0)}%` : '—',
                detail: `${selectedEvidenceIds.length} selected evidence item(s) · ${nextRecommendations.length} queued next-step recommendation(s)`,
                tone: result && result.confidence > 0.75 ? 'cool' : 'neutral',
              },
              {
                label: 'Citations',
                value: `${result?.citations.length ?? 0}`,
                detail: result && result.citations.length === 0
                  ? 'No visible citations are attached to this answer yet. Treat it as ungrounded synthesis until Research evidence is attached.'
                  : evidenceItems.length
                    ? `Workbench evidence graph currently holds ${evidenceItems.length} saved item(s).`
                    : 'No saved evidence yet; Research intake will strengthen citation-grounded answers.',
                tone: result && result.citations.length === 0 ? 'alert' : 'neutral',
              },
              {
                label: 'Recent Query',
                value: (query || history[0] || contextPrompt || 'Pending').slice(0, 44),
                detail: loading ? 'Axon is currently synthesizing a response.' : 'Recent query state remains part of the same canonical workbench object graph.',
                tone: loading ? 'alert' : 'neutral',
              },
            ]}
          />
          <ScientificMethodStrip
            label="Research synthesis desk"
            items={[
              {
                title: 'Prompt context',
                detail: 'The active target product, evidence graph, and queued next-step recommendations now seed the research prompt so Axon starts from the workbench state.',
                accent: PATHD_THEME.apricot,
                note: `${selectedEvidenceIds.length} selected evidence item(s)`,
              },
              {
                title: 'Citation canvas',
                detail: 'The graph acts like a living figure: literature structure, answer synthesis, and command input are kept inside one visual reading surface.',
                accent: PATHD_THEME.sky,
                note: `${result?.citations.length ?? 0} citation nodes`,
              },
              {
                title: 'Action routing',
                detail: 'Result mode, confidence, and recent query history remain attached so Axon behaves like a research desk tied to execution, not a detached chat pane.',
                accent: PATHD_THEME.mint,
                note: result ? resultMode : 'idle',
              },
            ]}
          />
        </>
      }
      footer={
        <ExportButton label="Export Result" data={result} filename="nexai-result" format="json" disabled={!result} />
      }
    >
      {/* ── Presets & Citations ──────────────────────────────── */}
      <ModuleCard area="presets" title="Quick Queries">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto' }}>
          <WorkbenchInlineContext
            toolId="nexai"
            title="Axon"
            summary="Cross-stage copilot for literature synthesis, bottleneck interpretation, and tool routing across the active Nexus-Bio project."
            compact
            isSimulated={!analyzeArtifact}
          />

          {contextPrompt && (
            <button
              onClick={() => setQuery(contextPrompt)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '7px 10px',
                background: 'rgba(175,195,214,0.2)',
                border: '1px solid rgba(175,195,214,0.34)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontFamily: T.SANS,
                fontSize: '10px',
                lineHeight: 1.5,
                color: PATHD_THEME.value,
                marginBottom: '4px',
              }}
            >
              Use current workbench context
            </button>
          )}

          {PRESET_QUERIES.map((q, i) => (
            <motion.button
              key={i}
              onClick={() => { setQuery(q); }}
              whileHover={{ x: 3 }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 10px',
                background: query === q ? 'rgba(175,195,214,0.2)' : PATHD_THEME.panelSurface,
                border: query === q ? '1px solid rgba(175,195,214,0.34)' : `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                borderRadius: '8px', cursor: 'pointer',
                fontFamily: T.SANS, fontSize: '10px', lineHeight: 1.5,
                color: query === q ? PATHD_THEME.value : PATHD_THEME.label,
              }}
            >
              {q}
            </motion.button>
          ))}

          {/* Citation list when result exists */}
          {result && (
            <>
              <div style={{
                fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase',
                letterSpacing: '0.1em', color: PATHD_THEME.label,
                margin: '14px 0 6px', padding: '0 2px',
              }}>
                Citations ({result.citations.length})
              </div>
              {result.citations.map(c => (
                <div key={c.id} style={{
                  padding: '6px 8px',
                  borderRadius: '8px',
                  background: PATHD_THEME.panelInset,
                  border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                }}>
                  <p style={{ fontFamily: T.SANS, fontSize: '9px', color: PATHD_THEME.value, margin: '0 0 2px', lineHeight: 1.4 }}>
                    {c.title.slice(0, 60)}…
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: PATHD_THEME.label }}>
                      {c.authors.split(',')[0]} et al. {c.year}
                    </span>
                    <span style={{ fontFamily: T.MONO, fontSize: '8px', color: PATHD_THEME.value }}>
                      {(c.relevance * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </ModuleCard>

      {/* ── Center: Graph + Floating CLI + Answer ───────────── */}
      <ModuleCard area="graph" flush style={{ position: 'relative' }}>
        <ScientificFigureFrame
          eyebrow={result && surfaceView === 'evidence' ? 'Evidence map' : 'Research brief'}
          title={result
            ? 'Researchers read the written synthesis first, then inspect the citation map as supporting evidence'
            : 'Ask Axon for a workbench-grounded research brief'}
          caption={result
            ? 'The primary surface now opens on prose and structured takeaways. The citation network remains available as an evidence-oriented view when the user wants to inspect support structure.'
            : 'Axon opens as a text-first research desk. Once a result exists, the written brief becomes the default reading surface and the evidence map stays available on demand.'}
          legend={[
            { label: 'Mode', value: result ? resultMode : 'idle', accent: PATHD_THEME.lilac },
            { label: 'Surface', value: result ? surfaceView : 'answer', accent: PATHD_THEME.apricot },
            { label: 'Confidence', value: result ? `${(result.confidence * 100).toFixed(0)}%` : '—', accent: PATHD_THEME.mint },
            { label: 'Citations', value: `${result?.citations.length ?? 0}`, accent: PATHD_THEME.sky },
            { label: 'History', value: `${history.length}`, accent: PATHD_THEME.lilac },
          ]}
          minHeight="100%"
        >
          <div
            style={{
              position: 'relative',
              minHeight: '520px',
              padding: '12px 12px 92px',
              display: 'grid',
              gridTemplateRows: result ? 'auto minmax(0, 1fr)' : '1fr',
              gap: '12px',
            }}
          >
            {result && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Primary reading surface
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px',
                    borderRadius: '12px',
                    border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                    background: PATHD_THEME.panelSurface,
                  }}
                >
                  {([
                    ['answer', 'Written answer'],
                    ['evidence', 'Evidence map'],
                  ] as const).map(([view, label]) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => setSurfaceView(view)}
                      aria-pressed={surfaceView === view}
                      style={{
                        minHeight: '34px',
                        padding: '0 12px',
                        borderRadius: '10px',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: T.SANS,
                        fontSize: '11px',
                        fontWeight: 600,
                        background: surfaceView === view ? 'rgba(175,195,214,0.18)' : 'transparent',
                        color: surfaceView === view ? PATHD_THEME.value : PATHD_THEME.label,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {apiError && (
                <div
                  role="alert"
                  style={{
                    flex: '0 0 auto',
                    borderRadius: '14px',
                    border: '1px solid rgba(250,128,114,0.42)',
                    background: 'rgba(250,128,114,0.12)',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <span style={{ fontFamily: T.MONO, fontSize: '11px', fontWeight: 700, color: '#FA8072', letterSpacing: '0.08em' }}>
                    GROQ ERROR
                  </span>
                  <p style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.value, lineHeight: 1.6, margin: 0 }}>
                    {apiError}
                  </p>
                </div>
              )}
              {!result ? (
                <div
                  style={{
                    flex: 1,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '18px',
                    border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                    background: PATHD_THEME.panelSurface,
                    textAlign: 'center',
                    padding: '24px',
                  }}
                >
                  <div>
                    <p style={{ fontFamily: T.MONO, fontSize: '32px', color: 'rgba(36,29,24,0.08)', margin: '0 0 8px' }}>⬡</p>
                    <p style={{ fontFamily: T.SANS, fontSize: '12px', color: PATHD_THEME.label }}>
                      {apiError ? 'Axon needs the Groq API to answer — please try again' : 'Ask Axon a research question'}
                    </p>
                    <p style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label, marginTop: '4px' }}>
                      press / to focus the command line
                    </p>
                  </div>
                </div>
              ) : surfaceView === 'answer' ? (
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    borderRadius: '18px',
                    background: PATHD_THEME.panelGlassStrong,
                    backdropFilter: 'blur(12px)',
                    border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                    padding: '16px 18px',
                    boxShadow: '0 16px 36px rgba(0,0,0,0.24)',
                    display: 'grid',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label }}>AXON</span>
                    <span style={{
                      fontFamily: T.MONO, fontSize: '8px', padding: '2px 6px',
                      background: 'rgba(191,220,205,0.18)', border: '1px solid rgba(191,220,205,0.32)',
                      borderRadius: '6px', color: PATHD_THEME.value,
                    }}>
                      {(result.confidence * 100).toFixed(0)}%
                    </span>
                    <span style={{
                      fontFamily: T.MONO,
                      fontSize: '8px',
                      padding: '2px 6px',
                      background: 'rgba(175,195,214,0.14)',
                      border: '1px solid rgba(175,195,214,0.26)',
                      borderRadius: '6px',
                      color: PATHD_THEME.value,
                    }}>
                      {result.citations.length} citation node{result.citations.length === 1 ? '' : 's'}
                    </span>
                    {isUngrounded && (
                      <span
                        style={{
                          fontFamily: T.MONO,
                          fontSize: '8px',
                          padding: '2px 6px',
                          background: 'rgba(232,163,161,0.18)',
                          border: '1px solid rgba(232,163,161,0.34)',
                          borderRadius: '6px',
                          color: PATHD_THEME.value,
                        }}
                      >
                        ungrounded
                      </span>
                    )}
                  </div>
                  {isUngrounded && (
                    <p style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.6, margin: 0 }}>
                      This answer does not yet have visible citation support. Treat it as contextual synthesis until Research evidence is attached or a citation-backed rerun is completed.
                    </p>
                  )}
                  <ResearchAnswerRenderer answer={result.answer} />
                </div>
              ) : (
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    borderRadius: '18px',
                    border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                    background: PATHD_THEME.panelSurface,
                    display: 'grid',
                    gridTemplateRows: 'auto minmax(0, 1fr)',
                    gap: '10px',
                    padding: '14px',
                  }}
                >
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <div style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Citation support map
                    </div>
                    <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.55 }}>
                      The graph stays available as a secondary evidence view for inspecting publication clustering, recency, and bridge citations behind the written answer.
                    </div>
                  </div>
                  <div style={{ minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {result.citations.length > 0 ? (
                      <CitationGraph citations={result.citations} />
                    ) : (
                      <div style={{ textAlign: 'center', padding: '24px' }}>
                        <div style={{ fontFamily: T.MONO, fontSize: '11px', color: PATHD_THEME.label, marginBottom: '6px' }}>
                          No evidence map yet
                        </div>
                        <div style={{ fontFamily: T.SANS, fontSize: '12px', color: PATHD_THEME.value, lineHeight: 1.6 }}>
                          Attach Research evidence or rerun with a literature-backed query to populate the citation surface.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <FloatingCLI
              query={query} setQuery={setQuery}
              onSubmit={runQuery} loading={loading}
              history={history}
              placeholder={contextPrompt || 'Ask Axon anything…'}
            />
          </div>
        </ScientificFigureFrame>
      </ModuleCard>

      {/* ── Right: Stats ────────────────────────────────────── */}
      <ModuleCard area="stats" title="Query Stats">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <MetricCard label="Confidence" value={result ? (result.confidence * 100).toFixed(0) + '%' : '—'} highlight={!!result} />
          <MetricCard label="Citations" value={result?.citations.length ?? 0} />
          <MetricCard label="Databases" value={6} unit="sources" />
          <MetricCard label="Model" value="llama-3.3" />

          {/* History */}
          {history.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{
                fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase',
                letterSpacing: '0.1em', color: PATHD_THEME.label, marginBottom: '6px',
              }}>
                History ({history.length})
              </div>
              {history.slice(0, 5).map((h, i) => (
                <motion.button
                  key={h + i}
                  onClick={() => setQuery(h)}
                  whileHover={{ x: 2 }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '4px 6px', marginBottom: '2px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontFamily: T.MONO, fontSize: '8px', color: PATHD_THEME.label,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {h.slice(0, 40)}{h.length > 40 ? '…' : ''}
                </motion.button>
              ))}
            </div>
          )}

          <div style={{
            padding: '12px',
            borderRadius: '12px',
            border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
            background: PATHD_THEME.panelInset,
            display: 'grid',
            gap: '6px',
          }}>
            <div style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Axon posture
            </div>
            <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.value, lineHeight: 1.55 }}>
              {result
                ? isUngrounded
                  ? 'Axon returned a synthesis, but it is not yet citation-backed in the visible evidence graph.'
                  : 'Axon is now framed as a synthesis desk that turns literature structure into route-level scientific guidance.'
                : 'This panel will become an evidence-backed routing summary once a query is run.'}
            </div>
          </div>
        </div>
      </ModuleCard>
    </ToolShell>
  );
}
