'use client';
/**
 * NEXAIPage — Axon Copilot surface.
 *
 * Post-audit composition: prompt → result → evidence → raw-output drawer.
 * The heavy-lifting components live in ./nexai/. This page owns only:
 *   • workbench context injection into the prompt
 *   • Groq/Gemini call via /api/analyze (and the Semantic Scholar sidecar)
 *   • parseError plumbing (PR-1 meta field) through to ResultPanel
 *   • workbench payload sync
 *
 * The audit's deferred pieces (agentic orchestrator, automation drawer,
 * external literature API expansion, evidence tree viz) are NOT started
 * here — see PR-2b / PR-3 notes.
 */
import { useState, useEffect, useMemo } from 'react';
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
import PromptInput from './nexai/PromptInput';
import ResultPanel, { ParseErrorInfo } from './nexai/ResultPanel';
import EvidencePanel from './nexai/EvidencePanel';
import RawJsonDrawer from './nexai/RawJsonDrawer';
import AutomationDrawer from './nexai/AutomationDrawer';
import AxonLogPanel from '../ide/AxonLogPanel';
import AxonPlanPanel from '../ide/AxonPlanPanel';
import AgentSessionViewer from '../ide/AgentSessionViewer';
import { routeIntent, type IntentRoute } from '../../services/axonIntentRouter';
import { buildWorkbenchCopilotContext } from '../../services/axonContext';
import { useAxonOrchestrator } from '../../providers/AxonOrchestratorProvider';
import { domainCategoryLabel } from '../../services/axonDomainClassifier';

const PRESET_QUERIES = [
  'Summarise current pathway bottlenecks and recommend the next tool to run.',
  'Compare the evidence for two candidate enzymes in the active workbench.',
  'Explain the thermodynamic risk in the current pathway using attached evidence.',
];

function extractYear(citation?: string): number | null {
  if (!citation) return null;
  const m = citation.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0]) : null;
}

function pathwayToResult(pathway: GeneratedPathway, query: string, provider: string): NEXAIResult {
  const nodes = (pathway.nodes || []).slice(0, 14);
  const bottlenecks = (pathway as any).bottleneck_enzymes || [];
  const axon = (pathway as any).axon_interaction;

  const W = 600, H = 420;
  const citations: CitationNode[] = nodes.map((n, i) => {
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

type ResultMode = 'pathway' | 'text' | 'idle';
type SurfaceView = 'answer' | 'evidence' | 'session';

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
  const [resultMode, setResultMode] = useState<ResultMode>('idle');
  const [surfaceView, setSurfaceView] = useState<SurfaceView>('answer');
  const [history, setHistory] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  // PR-1 meta plumbing — the backend tells us when structured parsing
  // failed. We surface it to ResultPanel and RawJsonDrawer so the failure
  // is visible rather than silently coerced.
  const [parseError, setParseError] = useState<ParseErrorInfo | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [rawDrawerOpen, setRawDrawerOpen] = useState(false);

  // PR-3 — agentic mode + queue now come from the shared provider.
  //
  // Before PR-3 the orchestrator lived in a local useRef here, so the
  // queue vanished on cross-tool navigation and the AutomationDrawer
  // only worked on this page. The provider at ToolsLayoutShell level
  // now owns the orchestrator, adapter registry, and writeback — this
  // page is just one of several consumers.
  const axon = useAxonOrchestrator();
  const {
    tasks,
    agenticMode,
    toggleAgenticMode,
    clearTerminal,
    cancelTask,
    retryTask,
    reorderTask,
    logs,
    activePlan,
    planAndRun,
    session,
    lastClassification,
  } = axon;
  const [routeHint, setRouteHint] = useState<IntentRoute | null>(null);
  const [secondaryOpen, setSecondaryOpen] = useState(false);

  // PR-5: when agentic mode flips on and a session already has activity,
  // default the reading surface to 'session' so the viewer is the first
  // thing users see. When it flips off, fall back to 'answer'.
  useEffect(() => {
    if (!agenticMode && surfaceView === 'session') {
      setSurfaceView('answer');
    }
  }, [agenticMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
      validity: 'real',
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

    // PR-4: routing + planning gate. When agentic mode is on we (a) run
    // the lightweight intent router to keep the existing route-hint chip
    // working, and (b) hand the query to the deterministic planner so
    // multi-step requests (e.g. "design a pathway and run FBA on it")
    // get a dependency-aware plan instead of a single-tool enqueue. The
    // planner emits a 0-step plan with a warning when neither keyword
    // matches, so it is safe to call unconditionally here.
    if (agenticMode) {
      const targetProduct = analyzeArtifact?.targetProduct ?? project?.targetProduct;
      const route = routeIntent(activeQuery, { targetProduct });
      setRouteHint(route);
      const copilotContext = buildWorkbenchCopilotContext({
        targetProduct: null,
        project: project
          ? { title: project.title, targetProduct: project.targetProduct }
          : null,
        analyzeArtifact: analyzeArtifact
          ? {
              targetProduct: analyzeArtifact.targetProduct,
              bottleneckAssumptions: analyzeArtifact.bottleneckAssumptions,
              thermodynamicConcerns: analyzeArtifact.thermodynamicConcerns,
              pathwayCandidates: analyzeArtifact.pathwayCandidates,
            }
          : null,
        evidenceItems: evidenceItems.map((e) => ({
          id: e.id,
          title: e.title,
          year: e.year,
        })),
        selectedEvidenceIds,
        nextRecommendations: nextRecommendations.map((r) => ({
          toolId: r.toolId,
          reason: r.reason,
        })),
        currentToolId: 'nexai',
      });
      planAndRun({ request: activeQuery, context: copilotContext });
      // PR-5: session viewer is the center of gravity when agentic is on.
      setSurfaceView('session');
    } else {
      setRouteHint(null);
    }

    setLoading(true);
    setApiError(null);
    setParseError(null);
    appendConsole({ level: 'info', module: 'nexai', message: `Query: "${activeQuery.slice(0, 60)}${activeQuery.length > 60 ? '…' : ''}"` });

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
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchQuery: contextualQuery }),
      });

      const data = await res.json();
      const answerText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const meta = data?.meta ?? {};
      const resolvedProvider: string = meta.provider ?? 'groq';
      const backendParseError: ParseErrorInfo | null = meta.parseError
        ? {
            code: meta.parseError.code as ParseErrorInfo['code'],
            message: meta.parseError.message ?? 'Backend could not parse model output as JSON',
          }
        : null;

      if (!res.ok || !answerText) throw new Error(data?.error ?? `HTTP ${res.status}`);

      setRawText(answerText);
      setProvider(resolvedProvider);
      setParseError(backendParseError);

      let pathway: GeneratedPathway | null = null;
      if (!backendParseError || backendParseError.code === 'NO_OBJECT') {
        try {
          const parsed = JSON.parse(answerText);
          if (parsed?.nodes?.length) pathway = parsed as GeneratedPathway;
        } catch { /* prose answer — fine */ }
      }

      if (pathway) {
        setResult(pathwayToResult(pathway, activeQuery, resolvedProvider));
        setResultMode('pathway');
        setSurfaceView('answer');
        const bottlenecks = (pathway as any).bottleneck_enzymes?.length ?? 0;
        appendConsole({ level: 'success', module: 'nexai', message: `Axon: ${pathway.nodes.length} nodes · ${bottlenecks} bottleneck(s) · ${resolvedProvider}` });
      } else {
        // Plain text or malformed — both render via ResultPanel, which
        // branches on parseError. We still set a result so confidence,
        // citation, and recent-query UI have something to display.
        setResult({
          query: activeQuery,
          answer: answerText.slice(0, 1200),
          citations: [],
          confidence: 0.75,
          generatedAt: Date.now(),
        });
        setResultMode('text');
        setSurfaceView('answer');
        if (backendParseError && backendParseError.code !== 'NO_OBJECT') {
          appendConsole({
            level: 'warn',
            module: 'nexai',
            message: `Axon: ${backendParseError.code} — raw output preserved · ${resolvedProvider}`,
          });
        } else {
          appendConsole({ level: 'success', module: 'nexai', message: `Axon: text response · ${resolvedProvider}` });
        }
      }

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

  const isUngrounded = Boolean(result) && result.citations.length === 0;
  const malformedParse =
    parseError && (parseError.code === 'INVALID_SYNTAX' || parseError.code === 'EMPTY');

  return (
    <ToolShell
      moduleId="nexai"
      title="Axon Copilot"
      description="Nexus-Bio hub surface — ask in plain language across every tool and workbench object"
      grid="'presets graph stats' 'presets graph stats'"
      columns="200px 1fr 200px"
      rows="1fr 1fr"
      gap={6}
      hero={
        <>
          <ScientificHero
            eyebrow="Nexus-Bio Hub · Axon Copilot"
            title="Central copilot for the whole platform"
            summary="Axon is the hub surface, not a tool page. Ask in plain language — this full view is the deep reading room; the slide-over (⌘K from any tool) is the quick-access variant. Both hit the same synthesis pipeline."
            aside={
              <>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Current scope
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '13px', color: PATHD_THEME.value, fontWeight: 700 }}>
                  {analyzeArtifact?.targetProduct ?? project?.targetProduct ?? project?.title ?? 'Scientific workbench'}
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.55 }}>
                  {contextPrompt || 'Ask Axon to synthesise evidence, explain a bottleneck, or route the next scientific action.'}
                </div>
              </>
            }
            signals={[
              {
                label: 'Answer Mode',
                value: result ? resultMode.toUpperCase() : 'IDLE',
                detail: resultMode === 'pathway'
                  ? 'Structured pathway JSON from the analysis route.'
                  : resultMode === 'text'
                    ? (malformedParse ? 'Model returned malformed structured output; raw fallback shown.' : 'Plain-language research synthesis.')
                    : 'No active answer yet.',
                tone: malformedParse ? 'alert' : resultMode === 'pathway' ? 'cool' : resultMode === 'text' ? 'warm' : 'neutral',
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
                detail: loading ? 'Axon is currently synthesising a response.' : 'Recent query state remains part of the canonical workbench object graph.',
                tone: loading ? 'alert' : 'neutral',
              },
            ]}
          />
          <ScientificMethodStrip
            label="Research synthesis desk"
            items={[
              {
                title: 'Prompt context',
                detail: 'The active target product, evidence graph, and queued next-step recommendations seed the research prompt so Axon starts from the workbench state.',
                accent: PATHD_THEME.apricot,
                note: `${selectedEvidenceIds.length} selected evidence item(s)`,
              },
              {
                title: 'Reading surface',
                detail: 'The written synthesis is the default reading plane. Evidence graph and raw structured output remain one click away for power users.',
                accent: PATHD_THEME.sky,
                note: `${result?.citations.length ?? 0} citation nodes`,
              },
              {
                title: 'Structured contract',
                detail: 'When the model fails to produce the structured envelope we asked for, the failure is surfaced explicitly rather than coerced into a plausible brief.',
                accent: PATHD_THEME.mint,
                note: malformedParse ? (parseError!.code) : (parseError?.code === 'NO_OBJECT' ? 'prose' : 'ok'),
              },
            ]}
          />
        </>
      }
      footer={
        <ExportButton label="Export Result" data={result} filename="nexai-result" format="json" disabled={!result} />
      }
    >
      {/* ── Left rail: quick queries + citation index ──────── */}
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

          {result && result.citations.length > 0 && (
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

      {/* ── Center: reading surface (prompt → result → evidence → raw) ── */}
      <ModuleCard area="graph" flush>
        <ScientificFigureFrame
          eyebrow={result && surfaceView === 'evidence' ? 'Evidence map' : 'Research brief'}
          title={result
            ? 'Read the written synthesis first, then inspect the evidence map'
            : 'Ask Axon for a workbench-grounded research brief'}
          caption={result
            ? 'The primary surface opens on prose and structured takeaways. The citation network and raw model response remain available as secondary views.'
            : 'Axon opens as a text-first research desk. Once a result exists, the written brief becomes the default reading surface; evidence and raw JSON stay available on demand.'}
          legend={[
            { label: 'Mode', value: result ? resultMode : 'idle', accent: PATHD_THEME.lilac },
            { label: 'Agentic', value: agenticMode ? `on · ${tasks.length} task${tasks.length === 1 ? '' : 's'}` : 'off', accent: PATHD_THEME.mint },
            { label: 'Surface', value: result ? surfaceView : 'answer', accent: PATHD_THEME.apricot },
            { label: 'Confidence', value: result ? `${(result.confidence * 100).toFixed(0)}%` : '—', accent: PATHD_THEME.mint },
            { label: 'Citations', value: `${result?.citations.length ?? 0}`, accent: PATHD_THEME.sky },
            { label: 'Parse', value: parseError?.code === 'NO_OBJECT' ? 'prose' : parseError?.code ?? 'ok', accent: PATHD_THEME.lilac },
          ]}
          minHeight="100%"
        >
          <div
            style={{
              padding: '12px',
              display: 'grid',
              gridTemplateRows: 'auto auto auto minmax(0, 1fr) auto auto',
              gap: '12px',
              minHeight: '560px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
                padding: '6px 10px',
                borderRadius: '12px',
                border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                background: PATHD_THEME.panelSurface,
              }}
            >
              <div style={{ display: 'grid', gap: '2px' }}>
                <span style={{ fontFamily: T.MONO, fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: PATHD_THEME.label }}>
                  Axon mode
                </span>
                <span style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.value, lineHeight: 1.5 }}>
                  {agenticMode
                    ? 'Agentic — qualifying PATHD / FBASIM prompts are queued as real tool runs.'
                    : 'Copilot — plain-language synthesis only. Raw JSON and automation stay out of the way.'}
                </span>
                {agenticMode && routeHint && routeHint.kind === 'none' && (
                  <span
                    data-testid="nexai-route-hint-none"
                    style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label }}
                  >
                    Not routed — {routeHint.reason}
                  </span>
                )}
                {agenticMode && routeHint && routeHint.kind !== 'none' && (
                  <span
                    data-testid={`nexai-route-hint-${routeHint.kind}`}
                    style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.value }}
                  >
                    Routed to {routeHint.kind.toUpperCase()} — {routeHint.reason}
                  </span>
                )}
              </div>
              <button
                type="button"
                data-testid="nexai-agentic-toggle"
                aria-pressed={agenticMode}
                onClick={toggleAgenticMode}
                style={{
                  minHeight: '30px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  border: `1px solid ${agenticMode ? 'rgba(147,203,82,0.42)' : PATHD_THEME.sepiaPanelBorder}`,
                  background: agenticMode ? 'rgba(147,203,82,0.18)' : 'transparent',
                  color: agenticMode ? PATHD_THEME.value : PATHD_THEME.label,
                  fontFamily: T.MONO,
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                {agenticMode ? 'Agentic on' : 'Agentic off'}
              </button>
            </div>

            <PromptInput
              query={query}
              setQuery={setQuery}
              onSubmit={runQuery}
              loading={loading}
              history={history}
              placeholder={contextPrompt || undefined}
              examples={PRESET_QUERIES}
              hideExamples={Boolean(result)}
            />

            {(result || agenticMode) && (
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
                    ...(agenticMode ? [['session', 'Agent session'] as const] : []),
                    ['answer', 'Written answer'] as const,
                    ['evidence', 'Evidence map'] as const,
                  ]).map(([view, label]) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => setSurfaceView(view)}
                      aria-pressed={surfaceView === view}
                      data-testid={`nexai-surface-${view}`}
                      style={{
                        minHeight: '32px',
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

            <div style={{ minHeight: 0, overflowY: 'auto' }}>
              {surfaceView === 'session' && agenticMode ? (
                <AgentSessionViewer session={session} />
              ) : surfaceView === 'evidence' && result ? (
                <EvidencePanel citations={result.citations} />
              ) : (
                <ResultPanel
                  result={result}
                  rawText={rawText}
                  parseError={parseError}
                  loading={loading}
                  apiError={apiError}
                />
              )}
            </div>

            {rawText && (
              <RawJsonDrawer
                open={rawDrawerOpen}
                onToggle={setRawDrawerOpen}
                rawText={rawText}
                provider={provider}
                parseError={parseError}
                isProse={parseError?.code === 'NO_OBJECT'}
              />
            )}

            <AutomationDrawer
              enabled={agenticMode}
              tasks={tasks}
              onClear={clearTerminal}
              onCancel={cancelTask}
              onRetry={retryTask}
              onReorder={reorderTask}
            />
            {agenticMode && (
              <div
                data-testid="nexai-secondary-panels"
                style={{
                  borderRadius: '14px',
                  border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                  background: PATHD_THEME.panelInset,
                  padding: '8px 10px',
                  display: 'grid',
                  gap: '8px',
                }}
              >
                <button
                  type="button"
                  data-testid="nexai-secondary-toggle"
                  aria-expanded={secondaryOpen}
                  onClick={() => setSecondaryOpen((v) => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 6px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: PATHD_THEME.label,
                    fontFamily: T.MONO,
                    fontSize: '10px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span aria-hidden>{secondaryOpen ? '▾' : '▸'}</span>
                  <span>
                    Secondary panels · Plan · Execution trace
                    {lastClassification ? ` · ${domainCategoryLabel(lastClassification.category)}` : ''}
                  </span>
                </button>
                {secondaryOpen && (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    <AxonPlanPanel plan={activePlan} />
                    <div
                      data-testid="nexai-axon-log"
                      style={{
                        borderRadius: '12px',
                        border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                        background: 'rgba(5,7,11,0.35)',
                        padding: '10px 12px',
                        display: 'grid',
                        gap: '8px',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: T.MONO,
                          fontSize: '10px',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: PATHD_THEME.label,
                        }}
                      >
                        Execution trace
                      </div>
                      <AxonLogPanel logs={logs} maxRows={60} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScientificFigureFrame>
      </ModuleCard>

      {/* ── Right rail: stats + posture ──────────────────── */}
      <ModuleCard area="stats" title="Query Stats">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <MetricCard label="Confidence" value={result ? (result.confidence * 100).toFixed(0) + '%' : '—'} highlight={!!result} />
          <MetricCard label="Citations" value={result?.citations.length ?? 0} />
          <MetricCard label="Databases" value={6} unit="sources" />
          <MetricCard label="Model" value={provider ?? 'llama-3.3'} />

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
                ? malformedParse
                  ? 'Model returned malformed structured output — the raw response is preserved in the drawer for manual inspection.'
                  : isUngrounded
                    ? 'Axon returned a synthesis, but it is not yet citation-backed in the visible evidence graph.'
                    : 'Axon is framed as a synthesis desk that turns literature structure into route-level scientific guidance.'
                : 'This panel will become an evidence-backed routing summary once a query is run.'}
            </div>
          </div>
        </div>
      </ModuleCard>
    </ToolShell>
  );
}
