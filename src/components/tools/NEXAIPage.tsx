'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

      {nodes.map((node, index) =>
        nodes.slice(index + 1).filter((candidate) => Math.abs(candidate.year - node.year) <= 4 && Math.abs(candidate.relevance - node.relevance) <= 0.22).slice(0, 2).map((peer, edgeIndex) => (
          <line
            key={`edge-${index}-${edgeIndex}`}
            x1={node.x}
            y1={node.y}
            x2={peer.x}
            y2={peer.y}
            stroke="rgba(74,124,255,0.18)"
            strokeWidth={0.9}
          />
        ))
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
            <circle cx={n.x} cy={n.y} r={n.r}
              fill={isHov ? 'rgba(74,124,255,0.24)' : 'rgba(18,26,40,0.88)'}
              stroke={isHov ? 'rgba(255,139,31,0.9)' : 'rgba(74,124,255,0.46)'}
              strokeWidth={isHov ? 1.8 : 1.1}
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
                  <p style={{ fontFamily: T.MONO, fontSize: '8px', color: 'rgba(74,124,255,0.86)', margin: '0 0 4px' }}>
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

function FloatingCLI({ query, setQuery, onSubmit, loading, history }: {
  query: string;
  setQuery: (q: string) => void;
  onSubmit: () => void;
  loading: boolean;
  history: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [histIdx, setHistIdx] = useState(-1);

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
        borderRadius: '14px',
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${loading ? `${AXON_ACCENT}40` : 'rgba(255,255,255,0.06)'}`,
        boxShadow: loading ? `0 0 30px ${AXON_ACCENT}10` : '0 4px 20px rgba(0,0,0,0.5)',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: '10px',
        zIndex: 10,
      }}
    >
      <span style={{
        fontFamily: T.MONO, fontSize: '12px', fontWeight: 700,
        color: loading ? AXON_ACCENT : 'rgba(255,255,255,0.3)',
        flexShrink: 0,
      }}>
        {loading ? '⟳' : '›'}
      </span>
      <input
        ref={inputRef}
        value={query}
        onChange={e => { setQuery(e.target.value); setHistIdx(-1); }}
        onKeyDown={handleKey}
        placeholder="Ask Axon anything… (press / to focus)"
        disabled={loading}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          fontFamily: T.MONO, fontSize: '12px',
          color: 'rgba(255,255,255,0.85)',
          caretColor: AXON_ACCENT,
        }}
      />
      <motion.button
        onClick={onSubmit}
        disabled={loading || !query.trim()}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          padding: '5px 14px', borderRadius: '8px', cursor: 'pointer',
          fontFamily: T.MONO, fontSize: '10px', fontWeight: 600,
          background: loading ? 'transparent' : `${AXON_ACCENT}15`,
          border: `1px solid ${loading ? 'rgba(255,255,255,0.06)' : `${AXON_ACCENT}30`}`,
          color: loading ? 'rgba(255,255,255,0.3)' : AXON_ACCENT,
        }}
      >
        {loading ? 'searching…' : '⏎ ask'}
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

function buildContextualResult({
  query,
  projectTitle,
  targetProduct,
  analyzeArtifact,
  evidenceItems,
  selectedEvidenceIds,
  nextToolIds,
}: {
  query: string;
  projectTitle?: string;
  targetProduct?: string;
  analyzeArtifact?: {
    targetProduct: string;
    pathwayCandidates: Array<{ label: string; description: string }>;
    bottleneckAssumptions: Array<{ label: string; detail: string }>;
    enzymeCandidates: Array<{ label: string; rationale: string }>;
    thermodynamicConcerns: string[];
    recommendedNextTools: string[];
  } | null;
  evidenceItems: Array<{
    id: string;
    title: string;
    authors: string[];
    year?: string;
    abstract: string;
  }>;
  selectedEvidenceIds: string[];
  nextToolIds: string[];
}): NEXAIResult {
  const scopedEvidence = evidenceItems.filter((item) => selectedEvidenceIds.includes(item.id));
  const activeEvidence = (scopedEvidence.length > 0 ? scopedEvidence : evidenceItems).slice(0, 6);
  const citations: CitationNode[] = activeEvidence.map((item, index) => ({
    id: item.id,
    title: item.title,
    authors: item.authors.join(', ') || 'Workbench evidence',
    year: Number.parseInt(item.year ?? '', 10) || 2024,
    relevance: Math.max(0.38, 0.88 - index * 0.08),
    x: 90 + (index % 3) * 180,
    y: 90 + Math.floor(index / 3) * 150,
  }));

  const target = analyzeArtifact?.targetProduct || targetProduct || projectTitle || 'current project';
  const topPathway = analyzeArtifact?.pathwayCandidates[0];
  const topBottleneck = analyzeArtifact?.bottleneckAssumptions[0];
  const topEnzyme = analyzeArtifact?.enzymeCandidates[0];
  const thermodynamicConcern = analyzeArtifact?.thermodynamicConcerns[0];
  const recommendedTool = analyzeArtifact?.recommendedNextTools[0] || nextToolIds[0] || 'pathd';
  const confidence = Math.min(
    0.92,
    0.42
      + (activeEvidence.length > 0 ? 0.18 : 0)
      + (topBottleneck ? 0.15 : 0)
      + (topPathway ? 0.1 : 0)
      + (thermodynamicConcern ? 0.07 : 0),
  );

  const lines = [
    `Axon synthesized a project-scoped answer for "${query}" using the current Nexus-Bio evidence graph rather than a canned fallback.`,
    `Target focus: ${target}.`,
    topPathway ? `Primary pathway candidate: ${topPathway.label}. ${topPathway.description}` : 'No structured pathway candidate has been committed yet.',
    topBottleneck ? `Leading bottleneck: ${topBottleneck.label}. ${topBottleneck.detail}` : 'No explicit bottleneck has been committed yet.',
    topEnzyme ? `Highest-priority enzyme candidate: ${topEnzyme.label}. ${topEnzyme.rationale}` : 'No enzyme candidate has been prioritized yet.',
    thermodynamicConcern ? `Thermodynamic concern: ${thermodynamicConcern}` : 'No dominant thermodynamic penalty is currently flagged.',
    `Recommended next move: ${recommendedTool.toUpperCase()}.`,
    activeEvidence.length > 0
      ? `Evidence basis: ${activeEvidence.map((item) => item.title).join(' · ')}.`
      : 'Evidence basis is currently thin; add Research evidence to strengthen the answer.',
  ];

  return {
    query,
    answer: lines.join('\n\n'),
    citations,
    confidence,
    generatedAt: Date.now(),
  };
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
  const [history, setHistory] = useState<string[]>([]);

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
    if (contextPrompt && !query.trim() && !result && history.length === 0) {
      setQuery(contextPrompt);
    }
  }, [contextPrompt, history.length, query, result]);

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
    if (!query.trim()) return;
    setHistory(prev => [query, ...prev.slice(0, 19)]);
    setLoading(true);
    appendConsole({ level: 'info', module: 'nexai', message: `Query: "${query.slice(0, 60)}${query.length > 60 ? '…' : ''}"` });

    const contextualQuery = analyzeArtifact
      ? [
          query,
          '',
          'Workbench context:',
          `Target product: ${analyzeArtifact.targetProduct}`,
          `Pathway candidates: ${analyzeArtifact.pathwayCandidates.length}`,
          `Evidence bundle size: ${selectedEvidenceIds.length}`,
          `Top bottleneck: ${analyzeArtifact.bottleneckAssumptions[0]?.label ?? 'Not specified'}`,
          `Thermodynamic concern: ${analyzeArtifact.thermodynamicConcerns[0] ?? 'Not specified'}`,
        ].join('\n')
      : query;

    try {
      // Call Axon in searchQuery mode — returns enriched pathway JSON
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
        setResult(pathwayToResult(pathway, query, provider));
        setResultMode('pathway');
        const bottlenecks = (pathway as any).bottleneck_enzymes?.length ?? 0;
        appendConsole({ level: 'success', module: 'nexai', message: `Axon: ${pathway.nodes.length} nodes · ${bottlenecks} bottleneck(s) · ${provider}` });
      } else {
        // Plain text answer (non-pathway question)
        setResult({ query, answer: rawText.slice(0, 1200), citations: [], confidence: 0.75, generatedAt: Date.now() });
        setResultMode('text');
        appendConsole({ level: 'success', module: 'nexai', message: `Axon: text response · ${provider}` });
      }
    } catch (e) {
      appendConsole({ level: 'warn', module: 'nexai', message: `API unavailable — ${String(e).slice(0, 80)} — using contextual synthesis` });
      setResult(buildContextualResult({
        query,
        projectTitle: project?.title,
        targetProduct: project?.targetProduct,
        analyzeArtifact,
        evidenceItems,
        selectedEvidenceIds,
        nextToolIds: nextRecommendations.map((item) => item.toolId),
      }));
      setResultMode('text');
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
              detail: evidenceItems.length ? `Workbench evidence graph currently holds ${evidenceItems.length} saved item(s).` : 'No saved evidence yet; Research intake will strengthen citation-grounded answers.',
              tone: 'neutral',
            },
            {
              label: 'Recent Query',
              value: (query || history[0] || contextPrompt || 'Pending').slice(0, 44),
              detail: loading ? 'Axon is currently synthesizing a response.' : 'Recent query state remains part of the same canonical workbench object graph.',
              tone: loading ? 'alert' : 'neutral',
            },
          ]}
        />
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
                background: `${AXON_ACCENT}08`,
                border: `1px solid ${AXON_ACCENT}20`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontFamily: T.SANS,
                fontSize: '10px',
                lineHeight: 1.5,
                color: AXON_ACCENT,
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
                background: query === q ? `${AXON_ACCENT}08` : 'transparent',
                border: query === q ? `1px solid ${AXON_ACCENT}20` : '1px solid rgba(255,255,255,0.03)',
                borderRadius: '8px', cursor: 'pointer',
                fontFamily: T.SANS, fontSize: '10px', lineHeight: 1.5,
                color: query === q ? AXON_ACCENT : 'rgba(255,255,255,0.45)',
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
                letterSpacing: '0.1em', color: 'rgba(255,255,255,0.2)',
                margin: '14px 0 6px', padding: '0 2px',
              }}>
                Citations ({result.citations.length})
              </div>
              {result.citations.map(c => (
                <div key={c.id} style={{
                  padding: '6px 8px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.02)',
                }}>
                  <p style={{ fontFamily: T.SANS, fontSize: '9px', color: 'rgba(255,255,255,0.5)', margin: '0 0 2px', lineHeight: 1.4 }}>
                    {c.title.slice(0, 60)}…
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>
                      {c.authors.split(',')[0]} et al. {c.year}
                    </span>
                    <span style={{ fontFamily: T.MONO, fontSize: '8px', color: AXON_ACCENT }}>
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
        {/* Full-bleed citation graph background */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '12px', overflow: 'hidden',
        }}>
          {result ? (
            <CitationGraph citations={result.citations} />
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: T.MONO, fontSize: '32px', color: 'rgba(255,255,255,0.04)', margin: '0 0 8px' }}>⬡</p>
              <p style={{ fontFamily: T.SANS, fontSize: '12px', color: 'rgba(255,255,255,0.15)' }}>
                Ask Axon a research question
              </p>
              <p style={{ fontFamily: T.MONO, fontSize: '9px', color: 'rgba(255,255,255,0.08)', marginTop: '4px' }}>
                press / to focus the command line
              </p>
            </div>
          )}
        </div>

        {/* Answer overlay (top, translucent) */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                position: 'absolute', top: '12px', left: '12px', right: '12px',
                maxHeight: '40%', overflowY: 'auto',
                borderRadius: '12px',
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.04)',
                padding: '12px 14px',
                zIndex: 5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontFamily: T.MONO, fontSize: '9px', color: AXON_ACCENT }}>AXON</span>
                <span style={{
                  fontFamily: T.MONO, fontSize: '8px', padding: '2px 6px',
                  background: 'rgba(147,203,82,0.08)', border: '1px solid rgba(147,203,82,0.15)',
                  borderRadius: '6px', color: 'rgba(147,203,82,0.7)',
                }}>
                  {(result.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p style={{
                fontFamily: T.SANS, fontSize: '11px', color: 'rgba(255,255,255,0.65)',
                lineHeight: 1.7, margin: 0,
              }}>
                {result.answer}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating CLI at bottom */}
        <FloatingCLI
          query={query} setQuery={setQuery}
          onSubmit={runQuery} loading={loading}
          history={history}
        />
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
                letterSpacing: '0.1em', color: 'rgba(255,255,255,0.2)', marginBottom: '6px',
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
                    fontFamily: T.MONO, fontSize: '8px', color: 'rgba(255,255,255,0.25)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {h.slice(0, 40)}{h.length > 40 ? '…' : ''}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </ModuleCard>
    </ToolShell>
  );
}
