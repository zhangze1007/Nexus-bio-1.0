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
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ToolShell, { TOOL_TOKENS as T } from './shared/ToolShell';
import ModuleCard from './shared/ModuleCard';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import type { NEXAIResult, CitationNode, GeneratedPathway, BottleneckEnzyme } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { workflowStatusLabel } from '../workbench/workflowExperience';
import ScientificHero from './shared/ScientificHero';
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
import { buildWorkbenchCopilotContext, composeCopilotQuery } from '../../services/axonContext';
import { verifyCitationsBatch, mergeVerificationResults, computeVerificationSummary } from '../../services/citationVerifier';
import { useAxonOrchestrator } from '../../providers/AxonOrchestratorProvider';
import { domainCategoryLabel } from '../../services/axonDomainClassifier';
import { ChatMessage, type ChatMessageProps } from './nexai/ChatMessage';
import { ContextChips } from './nexai/ContextChips';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { THEME } from '../../theme';
import { PAPER_THEME } from '../charts/chartTheme';
import { routeQuery, formatSolverResult, setCachedResponse } from '../../services/cognitiveRouter';
import { computeConfidenceFromResult } from '../../services/confidenceEngine';
import WorkflowStepper from './shared/WorkflowStepper';
import ConfidenceBadge from './shared/ConfidenceBadge';
import ResultSummaryPanel from './shared/ResultSummaryPanel';

// ── Named constants ──
const MAX_MESSAGES = 50;
const MAX_HISTORY = 20;
const MAX_ANSWER_LENGTH = 1200;
const MAX_PREVIEW_LENGTH = 180;
const SEMANTIC_SCHOLAR_LIMIT = 5;
const AUTO_VERIFY_COUNT = 3;
const PATHWAY_WIDTH = 600;
const PATHWAY_HEIGHT = 420;
const MAX_PATHWAY_NODES = 14;

const PRESET_QUERIES = [
  'Summarise current pathway bottlenecks and recommend the next tool to run.',
  'Compare the evidence for two candidate enzymes in the active workbench.',
  'Explain the thermodynamic risk in the current pathway using attached evidence.',
];

/** Extract publication year from citation string. Prefers structured year field if available. */
function extractYear(citation?: string, structuredYear?: number | null): number | null {
  if (structuredYear) return structuredYear;
  if (!citation) return null;
  const m = citation.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0]) : null;
}

function pathwayToResult(pathway: GeneratedPathway, query: string, provider: string): NEXAIResult {
  const nodes = (pathway.nodes || []).slice(0, MAX_PATHWAY_NODES);
  const bottlenecks = pathway.bottleneck_enzymes ?? [];
  const axon = pathway.axon_interaction;

  const W = PATHWAY_WIDTH, H = PATHWAY_HEIGHT;
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
        .map((b: BottleneckEnzyme) => `${b.enzyme} (${b.efficiency_percent}% efficiency, ${b.yield_loss_percent}% yield loss)`)
        .join('; ');
      answer += `\n\nBottleneck enzymes identified: ${bList}.`;
      if (axon.options?.length) answer += ` Recommended: ${axon.options.join(' or ')}.`;
    }
  } else if (bottlenecks.length > 0) {
    const b = bottlenecks[0];
    answer = `Axon identified ${nodes.length} pathway nodes for "${query}". Primary bottleneck: ${b.enzyme} at ${b.efficiency_percent}% efficiency (${b.yield_loss_percent}% yield loss). ${b.evidence || ''}`;
  } else {
    answer = `Axon mapped ${nodes.length} nodes across the ${query} pathway. Quality Index: ${((nodes.reduce((s, n) => s + (n.confidenceScore ?? 0.7), 0) / Math.max(nodes.length, 1)) * 100).toFixed(0)}%. Source: ${provider}.`;
  }

  const avgConfidence = nodes.reduce((s, n) => s + (n.confidenceScore ?? 0.7), 0) / Math.max(nodes.length, 1);
  return { query, answer, citations, confidence: avgConfidence, generatedAt: Date.now() };
}

type ResultMode = 'pathway' | 'text' | 'idle';
type SurfaceView = 'answer' | 'evidence' | 'session';

export default React.memo(function NEXAIPage() {
  const appendConsole = useUIStore(s => s.appendConsole);
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const evidenceItems = useWorkbenchStore((s) => s.evidenceItems);
  const selectedEvidenceIds = useWorkbenchStore((s) => s.selectedEvidenceIds);
  const nextRecommendations = useWorkbenchStore((s) => s.nextRecommendations);
  const workflowControl = useWorkbenchStore((s) => s.workflowControl);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [result, setResult] = useState<NEXAIResult | null>(null);
  const [resultMode, setResultMode] = useState<ResultMode>('idle');
  const [surfaceView, setSurfaceView] = useState<SurfaceView>('answer');
  const [history, setHistory] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [routingTier, setRoutingTier] = useState<string | null>(null);
  const [workflowStep, setWorkflowStep] = useState<'idle' | 'classify' | 'route' | 'execute' | 'synthesize'>('idle');

  // ── Conversation state for chat-style interface ──
  const [messages, setMessages] = useState<Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    confidence?: number;
    citations?: number;
    actions?: ChatMessageProps['actions'];
  }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // PR-1 meta plumbing — the backend tells us when structured parsing
  // failed. We surface it to ResultPanel and RawJsonDrawer so the failure
  // is visible rather than silently coerced.
  const [parseError, setParseError] = useState<ParseErrorInfo | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [rawDrawerOpen, setRawDrawerOpen] = useState(false);

  // Citation verification state
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const verifyAbortRef = useRef<AbortController | null>(null);

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

  // Cancel in-flight request on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-verify first 3 citations when a new result arrives
  useEffect(() => {
    if (result?.citations && result.citations.length > 0 && !verified) {
      const controller = new AbortController();
      const toVerify = result.citations.slice(0, AUTO_VERIFY_COUNT);
      verifyCitationsBatch(toVerify, controller.signal).then(batchResults => {
        const merged = mergeVerificationResults(result.citations, batchResults);
        setResult(prev => prev ? { ...prev, citations: merged } : prev);
        setVerified(true);
      }).catch(() => {});
      return () => controller.abort();
    }
  }, [result?.citations, verified]);

  const contextPrompt = useMemo(() => {
    if (workflowControl.status === 'blocked' || workflowControl.status === 'gated' || workflowControl.status === 'demoOnly') {
      return `Review the current workflow gate (${workflowControl.status}) and explain what evidence or upstream node is required before ${workflowControl.nextRecommendedNode ?? workflowControl.currentToolId ?? 'the next tool'} can advance.`;
    }
    if (analyzeArtifact) {
      const bottleneck = analyzeArtifact.bottleneckAssumptions[0]?.label ?? 'current pathway bottleneck';
      return `What are the highest-risk assumptions for ${analyzeArtifact.targetProduct}, especially around ${bottleneck}, and which tool should I run next?`;
    }
    if (project?.targetProduct) {
      return `Summarize the best next step for the ${project.targetProduct} program using the current evidence bundle.`;
    }
    return '';
  }, [analyzeArtifact, project?.targetProduct, workflowControl]);

  const copilotContext = useMemo(() => buildWorkbenchCopilotContext({
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
    workflowControl,
  }), [analyzeArtifact, evidenceItems, nextRecommendations, project, selectedEvidenceIds, workflowControl]);

  useEffect(() => {
    setToolPayload('nexai', {
      validity: result ? 'real' : 'demo',
      toolId: 'nexai',
      targetProduct: analyzeArtifact?.targetProduct ?? project?.targetProduct ?? 'Scientific workbench',
      sourceArtifactId: analyzeArtifact?.id,
      query: query || contextPrompt,
      result: {
        confidence: result?.confidence ?? 0,
        citations: result?.citations.length ?? 0,
        answerPreview: result?.answer.slice(0, MAX_PREVIEW_LENGTH) ?? '',
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

    // Add user message to conversation (cap at MAX_MESSAGES)
    setMessages(prev => [...prev.slice(-(MAX_MESSAGES - 1)), {
      role: 'user',
      content: activeQuery,
      timestamp: Date.now(),
    }]);

    // Cancel any in-flight request to prevent race conditions
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setHistory(prev => [activeQuery, ...prev.slice(0, MAX_HISTORY - 1)]);

    // Agentic mode: route + plan
    if (agenticMode) {
      const targetProduct = analyzeArtifact?.targetProduct ?? project?.targetProduct;
      const route = routeIntent(activeQuery, { targetProduct });
      setRouteHint(route);
      planAndRun({ request: activeQuery, context: copilotContext });
      setSurfaceView('session');
    } else {
      setRouteHint(null);
    }

    setLoading(true);
    setApiError(null);
    setParseError(null);
    setVerified(false);
    setWorkflowStep('classify');
    appendConsole({ level: 'info', module: 'nexai', message: `Query: "${activeQuery.slice(0, 60)}${activeQuery.length > 60 ? '…' : ''}"` });

    // ── Cognitive Kernel: tier routing ──
    const routing = routeQuery(activeQuery, typeof copilotContext === 'string' ? copilotContext : JSON.stringify(copilotContext).substring(0, 200));
    setRoutingTier(routing.tier);
    setWorkflowStep('route');
    appendConsole({ level: 'info', module: 'nexai', message: `Router: ${routing.tier} — ${routing.reason}` });

    const contextualQuery = composeCopilotQuery(activeQuery, copilotContext);

    let resolvedProvider = 'cognitive-kernel';
    try {
      setWorkflowStep('execute');
      let answerText = '';
      let solverResult: unknown = null;
      let solverName = '';

      // ── Tier 0: Cache hit ──
      if (routing.tier === 'cache' && routing.cachedResponse) {
        const cached = routing.cachedResponse;
        answerText = typeof cached.result === 'string' ? cached.result :
          (cached.result as Record<string, unknown>)?.text as string ?? JSON.stringify(cached.result);
        resolvedProvider = 'cache';
        appendConsole({ level: 'info', module: 'nexai', message: `Cache hit — $0 cost, <10ms` });
      }

      // ── Tier 1: Solver direct ──
      else if (routing.tier === 'solver-direct' && routing.solver) {
        solverName = routing.solver;
        const pipelineRes = await fetch(`/api/pipeline/${routing.solver}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          signal: controller.signal,
        });
        if (!pipelineRes.ok) throw new Error(`Pipeline ${routing.solver} failed (${pipelineRes.status})`);
        const pipelineData = await pipelineRes.json();
        solverResult = pipelineData.result;
        answerText = formatSolverResult(routing.solver, solverResult);
        resolvedProvider = `solver:${routing.solver}`;
        appendConsole({ level: 'success', module: 'nexai', message: `Solver direct: ${routing.solver} — $0 cost` });
      }

      // ── Tier 2: Solver + LLM explain ──
      else if (routing.tier === 'solver-explain' && routing.solver) {
        solverName = routing.solver;
        try {
          const pipelineRes = await fetch(`/api/pipeline/${routing.solver}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
            signal: controller.signal,
          });
          if (pipelineRes.ok) {
            const pipelineData = await pipelineRes.json();
            solverResult = pipelineData.result;
          }
        } catch { /* solver failed — proceed with LLM only */ }

        // Send solver result to LLM for explanation
        const llmQuery = solverResult
          ? `${contextualQuery}\n\n[Solver result from ${routing.solver}]:\n${JSON.stringify(solverResult, null, 2).substring(0, 2000)}`
          : contextualQuery;

        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchQuery: llmQuery }),
          signal: controller.signal,
        });
        const data = await res.json();
        answerText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        resolvedProvider = data?.meta?.provider ?? 'groq';
        if (!res.ok || !answerText) throw new Error(data?.error ?? `HTTP ${res.status}`);
        appendConsole({ level: 'success', module: 'nexai', message: `Solver + LLM: ${routing.solver} + ${resolvedProvider}` });
      }

      // ── Tier 3: LLM reasoning ──
      else {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchQuery: contextualQuery }),
          signal: controller.signal,
        });
        const data = await res.json();
        answerText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        resolvedProvider = data?.meta?.provider ?? 'groq';
        if (!res.ok || !answerText) throw new Error(data?.error ?? `HTTP ${res.status}`);
        appendConsole({ level: 'success', module: 'nexai', message: `LLM reasoning: ${resolvedProvider}` });
      }

      setRawText(answerText);
      setProvider(resolvedProvider);
      setParseError(null);

      // Try to parse as pathway JSON
      let pathway: GeneratedPathway | null = null;
      try {
        const parsed = JSON.parse(answerText);
        if (parsed?.nodes?.length) pathway = parsed as GeneratedPathway;
      } catch { /* prose answer — fine */ }

      // ── Unified confidence via confidenceEngine ──
      const confidenceResult = computeConfidenceFromResult(
        solverResult,
        solverName,
        [],  // citations added later
        undefined,
        answerText,
      );

      // Build the result once and reuse for both state and conversation
      setWorkflowStep('synthesize');
      const pathwayResult = pathway ? pathwayToResult(pathway, activeQuery, resolvedProvider) : null;
      const textResult: NEXAIResult = {
        query: activeQuery,
        answer: answerText.slice(0, MAX_ANSWER_LENGTH),
        citations: [],
        confidence: confidenceResult.overall,
        generatedAt: Date.now(),
      };
      const activeResult = pathwayResult ?? textResult;

      setResult(activeResult);
      setResultMode(pathway ? 'pathway' : 'text');
      setSurfaceView('answer');

      if (pathway) {
        const bottlenecks = pathway.bottleneck_enzymes?.length ?? 0;
        appendConsole({ level: 'success', module: 'nexai', message: `Axon: ${pathway.nodes.length} nodes · ${bottlenecks} bottleneck(s) · ${resolvedProvider}` });
      } else {
        appendConsole({ level: 'success', module: 'nexai', message: `Response: ${confidenceResult.badge} confidence (${confidenceResult.level}) · ${routing.tier}` });
      }

      try {
        const ssUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(activeQuery.slice(0, 100))}&fields=title,authors,year,citationCount&limit=${SEMANTIC_SCHOLAR_LIMIT}`;
        const ssRes = await fetch(ssUrl, { signal: controller.signal });
        if (ssRes.ok) {
          const ssData = await ssRes.json();
          // Normalize relevance from citationCount rather than positional rank
          const maxCitations = Math.max(1, ...((ssData.data ?? []) as Record<string, unknown>[]).map(
            (p) => (p.citationCount as number) ?? 0,
          ));
          const ssCitations: CitationNode[] = (ssData.data ?? []).map((p: Record<string, unknown>, i: number) => ({
            id: (p.paperId as string) ?? `ss-${i}`,
            title: (p.title as string) ?? 'Unknown title',
            authors: ((p.authors as {name:string}[]) ?? []).map((a) => a.name).join(', ') || 'Unknown authors',
            year: (p.year as number) ?? new Date().getFullYear(),
            relevance: Math.max(0.1, ((p.citationCount as number) ?? 0) / maxCitations),
          }));
          if (ssCitations.length > 0) {
            setResult(prev => prev ? {
              ...prev,
              citations: [...ssCitations, ...prev.citations.filter(c => !ssCitations.find(s => s.id === c.id))].slice(0, 10),
            } : prev);
            appendConsole({ level: 'info', module: 'nexai', message: `Semantic Scholar: ${ssCitations.length} real citation(s) loaded` });
          }
        }
      } catch (ssErr) {
        // Surface a subtle warning when Semantic Scholar enrichment fails
        appendConsole({ level: 'warn', module: 'nexai', message: `Semantic Scholar enrichment unavailable: ${ssErr instanceof Error ? ssErr.message.slice(0, 80) : 'network error'}` });
      }

      // Add assistant message to conversation (reuse activeResult, cap at MAX_MESSAGES)
      setMessages(prev => [...prev.slice(-(MAX_MESSAGES - 1)), {
        role: 'assistant',
        content: activeResult.answer,
        timestamp: Date.now(),
        confidence: activeResult.confidence,
        citations: activeResult.citations?.length ?? 0,
        actions: [], // Will be populated by next_steps in future
      }]);

    } catch (e) {
      // Silently ignore aborted requests
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (controller.signal.aborted) return;

      const errMsg = e instanceof Error ? e.message : String(e);
      const providerLabel = resolvedProvider ?? 'AI';
      appendConsole({ level: 'error', module: 'nexai', message: `${providerLabel} API unavailable — ${errMsg.slice(0, 120)}` });
      setApiError(`${providerLabel} API unavailable — ${errMsg}. Please verify your API key is configured and try again.`);
      setResult(null);
      setResultMode('idle');
      setSurfaceView('answer');
      setWorkflowStep('idle');

      // Add error message to conversation (cap at MAX_MESSAGES)
      setMessages(prev => [...prev.slice(-(MAX_MESSAGES - 1)), {
        role: 'system',
        content: `Error: ${errMsg.slice(0, 200)}`,
        timestamp: Date.now(),
      }]);
    }
    setLoading(false);
  }

  async function verifyCitations() {
    if (!result || result.citations.length === 0) return;

    // Cancel any in-flight verification
    verifyAbortRef.current?.abort();
    const controller = new AbortController();
    verifyAbortRef.current = controller;

    setVerifying(true);
    setVerified(false);
    appendConsole({ level: 'info', module: 'nexai', message: `Verifying ${result.citations.length} citation(s) against PubMed...` });

    try {
      const results = await verifyCitationsBatch(result.citations, controller.signal);
      const merged = mergeVerificationResults(result.citations, results);
      const summary = computeVerificationSummary(merged);

      setResult(prev => prev ? { ...prev, citations: merged } : prev);
      setVerified(true);

      appendConsole({
        level: 'success',
        module: 'nexai',
        message: `PubMed verification: ${summary.verified} verified, ${summary.unverified} partial, ${summary.notFound} not found`,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      appendConsole({ level: 'warn', module: 'nexai', message: `Citation verification failed: ${e instanceof Error ? e.message : String(e)}` });
    }
    setVerifying(false);
  }

  const isUngrounded = result !== null && result.citations.length === 0;
  const malformedParse =
    parseError && (parseError.code === 'INVALID_SYNTAX' || parseError.code === 'EMPTY');
  const workflowRisk = workflowControl.status === 'blocked'
    ? 'Blocked upstream artifact'
    : workflowControl.status === 'gated'
      ? 'Human/evidence gate'
      : workflowControl.status === 'demoOnly'
        ? 'Demo/simulated output'
        : workflowControl.uncertainty === null && workflowControl.currentToolId
          ? 'Uncertainty unresolved'
          : 'No active workflow gate';

  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <ToolShell
      moduleId="nexai"
      title="Axon Copilot"
      description="Nexus-Bio hub surface — ask in plain language across every tool and workbench object"
      grid={isMobile ? "'graph'" : "'presets graph stats' 'presets graph stats'"}
      columns={isMobile ? '1fr' : '200px 1fr 200px'}
      rows={isMobile ? '1fr' : '1fr 1fr'}
      gap={6}
      hero={
        <>
          <ScientificHero
            eyebrow="Nexus-Bio Hub · Axon Copilot"
            title="Central copilot for the whole platform"
            summary="Axon is the hub surface, not a tool page. Ask in plain language — this full view is the deep reading room; the slide-over (⌘K from any tool) is the quick-access variant. Both hit the same synthesis pipeline."
            aside={
              <>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Current scope
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, fontWeight: 700 }}>
                  {analyzeArtifact?.targetProduct ?? project?.targetProduct ?? project?.title ?? 'Scientific workbench'}
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.LABEL, lineHeight: 1.55 }}>
                  {contextPrompt || 'Ask Axon to synthesise evidence, explain a bottleneck, or route the next scientific action.'}
                </div>
              </>
            }
            signals={[
              {
                label: 'Answer Mode',
                value: result ? resultMode.toUpperCase() : 'IDLE',
                detail: resultMode === 'pathway'
                  ? 'Pathway JSON analysis'
                  : resultMode === 'text'
                    ? (malformedParse ? 'Malformed output; raw fallback.' : 'Research synthesis')
                    : 'No active answer.',
                tone: malformedParse ? 'alert' : resultMode === 'pathway' ? 'cool' : resultMode === 'text' ? 'warm' : 'neutral',
              },
              {
                label: 'Quality Index',
                value: result ? `${(result.confidence * 100).toFixed(0)}` : '—',
                detail: `${selectedEvidenceIds.length} evidence · ${nextRecommendations.length} queued`,
                tone: result && result.confidence > 0.75 ? 'cool' : 'neutral',
              },
              {
                label: 'Workflow',
                value: workflowControl.status.toUpperCase(),
                detail: workflowControl.nextRecommendedNode
                  ? `Next: ${workflowControl.nextRecommendedNode.toUpperCase()}${workflowControl.humanGateRequired ? ' · gate' : ''}`
                  : workflowControl.explanation,
                tone: workflowControl.status === 'blocked' || workflowControl.status === 'gated' || workflowControl.status === 'demoOnly' ? 'alert' : 'neutral',
              },
              {
                label: 'Citations',
                value: `${result?.citations.length ?? 0}`,
                detail: result && result.citations.length === 0
                  ? 'No citations attached.'
                  : verified
                    ? (() => {
                        const summary = computeVerificationSummary(result!.citations);
                        return `PubMed: ${summary.verified} verified, ${summary.unverified} partial`;
                      })()
                    : evidenceItems.length
                      ? `${evidenceItems.length} saved item(s).`
                      : 'No saved evidence yet.',
                tone: result && result.citations.length === 0 ? 'alert' : 'neutral',
              },
              {
                label: 'Recent Query',
                value: (query || history[0] || contextPrompt || 'Pending').slice(0, 44),
                detail: loading ? 'Synthesising response.' : 'Query state tracked.',
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
                accent: THEME.APRICOT,
                note: `${selectedEvidenceIds.length} selected evidence item(s)`,
              },
              {
                title: 'Reading surface',
                detail: 'The written synthesis is the default reading plane. Evidence graph and raw structured output remain one click away for power users.',
                accent: THEME.SKY,
                note: `${result?.citations.length ?? 0} citation nodes`,
              },
              {
                title: 'Structured contract',
                detail: 'When the model fails to produce the structured envelope we asked for, the failure is surfaced explicitly rather than coerced into a plausible brief.',
                accent: THEME.MINT,
                note: malformedParse ? (parseError?.code ?? 'unknown') : (parseError?.code === 'NO_OBJECT' ? 'prose' : 'ok'),
              },
            ]}
          />
        </>
      }
      footer={
        <ExportButton label="Export Result" data={result} filename="nexai-result" format="json" disabled={!result} />
      }
    >
      {/* ── Left rail: quick queries + citation index (hidden on mobile) ── */}
      {!isMobile && <ModuleCard area="presets" title="Quick Queries">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto' }}>
          {contextPrompt && (
            <button
              className="nb-tool-toggle"
              onClick={() => setQuery(contextPrompt)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '7px 10px',
                background: 'rgba(175,195,214,0.2)',
                border: '1px solid rgba(175,195,214,0.34)',
                borderRadius: 'var(--nb-radius-sm)',
                cursor: 'pointer',
                fontFamily: THEME.SANS,
                fontSize: 'var(--nb-fs-xs)',
                lineHeight: 1.5,
                color: THEME.VALUE,
                marginBottom: '4px',
              }}
            >
              Use current workbench context
            </button>
          )}

          {PRESET_QUERIES.map((q, i) => (
            <button
              key={i}
              onClick={() => { setQuery(q); }}
              className={`nb-tool-toggle${query === q ? ' nb-tool-toggle--active' : ''}`}
              aria-label={`Use preset query: ${q}`}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 10px',
                borderRadius: 'var(--nb-radius-sm)',
                fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', lineHeight: 1.5,
              }}
            >
              {q}
            </button>
          ))}

          {result && result.citations.length > 0 && (
            <>
              <div style={{
                fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase',
                letterSpacing: '0.1em', color: THEME.LABEL,
                margin: '14px 0 6px', padding: '0 2px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>Citations ({result.citations.length})</span>
                {!verified && (
                  <button
                    type="button"
                    className="nb-tool-toggle"
                    onClick={verifyCitations}
                    disabled={verifying}
                    data-testid="nexai-verify-citations"
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--nb-radius-sm)',
                      border: `1px solid ${THEME.BORDER}`,
                      background: verifying ? 'rgba(175,195,214,0.18)' : 'transparent',
                      color: THEME.VALUE,
                      fontFamily: THEME.MONO,
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: verifying ? 'wait' : 'pointer',
                    }}
                  >
                    {verifying ? 'Verifying...' : 'Verify'}
                  </button>
                )}
              </div>
              {result.citations.map(c => {
                const statusColor = c.verificationStatus === 'verified'
                  ? THEME.SUCCESS_HIGH
                  : c.verificationStatus === 'unverified'
                    ? THEME.RISK_MEDIUM
                    : c.verificationStatus === 'not_found'
                      ? THEME.RISK_HIGH
                      : THEME.LABEL;
                const statusLabel = c.verificationStatus === 'verified'
                  ? 'Verified'
                  : c.verificationStatus === 'unverified'
                    ? 'Partial'
                    : c.verificationStatus === 'not_found'
                      ? 'Not found'
                      : '';
                return (
                  <div key={c.id} style={{
                    padding: '6px 8px',
                    borderRadius: 'var(--nb-radius-sm)',
                    background: THEME.PANEL_INSET,
                    border: `1px solid ${THEME.BORDER}`,
                  }}>
                    <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE, margin: '0 0 2px', lineHeight: 1.4 }}>
                      {c.title.slice(0, 60)}…
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>
                        {c.authors.split(',')[0]} et al. {c.year}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {statusLabel && (
                          <span style={{
                            fontFamily: THEME.MONO,
                            fontSize: '11px',
                            fontWeight: 700,
                            color: statusColor,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}>
                            {statusLabel}
                          </span>
                        )}
                        <ConfidenceBadge value={c.relevance} />
                      </div>
                    </div>
                    {c.pmid && (
                      <div style={{ fontFamily: THEME.MONO, fontSize: '11px', color: THEME.LABEL, marginTop: '2px' }}>
                        PMID: {c.pmid}{c.journal ? ` · ${c.journal}` : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </ModuleCard>}

      {/* ── Center: clean chat interface with subtle surface ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: '560px',
          background: 'rgba(10, 12, 16, 0.6)',
          borderRadius: 'var(--nb-radius-lg)',
          border: `1px solid ${PAPER_THEME.border}`,
          overflow: 'hidden',
        }}
      >
          <div
            style={{
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              flex: 1,
              minHeight: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
                padding: '4px 0',
              }}
            >
              <div style={{ display: 'grid', gap: '2px' }}>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', letterSpacing: '0.08em', textTransform: 'uppercase', color: THEME.LABEL }}>
                  Axon mode
                </span>
                <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, lineHeight: 1.5 }}>
                  {agenticMode
                    ? 'Agentic — qualifying PATHD / FBASIM prompts are queued as real tool runs.'
                    : 'Copilot — plain-language synthesis only. Raw JSON and automation stay out of the way.'}
                </span>
                {agenticMode && routeHint && routeHint.kind === 'none' && (
                  <span
                    data-testid="nexai-route-hint-none"
                    style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}
                  >
                    Not routed — {routeHint.reason}
                  </span>
                )}
                {agenticMode && routeHint && routeHint.kind !== 'none' && (
                  <span
                    data-testid={`nexai-route-hint-${routeHint.kind}`}
                    style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE }}
                  >
                    Routed to {routeHint.kind.toUpperCase()} — {routeHint.reason}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="nb-tool-toggle"
                data-testid="nexai-agentic-toggle"
                aria-pressed={agenticMode}
                onClick={toggleAgenticMode}
                style={{
                  minHeight: '30px',
                  padding: '0 12px',
                  borderRadius: 'var(--nb-radius-md)',
                  border: `1px solid ${agenticMode ? 'rgba(147,203,82,0.42)' : THEME.BORDER}`,
                  background: agenticMode ? 'rgba(147,203,82,0.18)' : 'transparent',
                  color: agenticMode ? THEME.VALUE : THEME.LABEL,
                  fontFamily: THEME.MONO,
                  fontSize: 'var(--nb-fs-xs)',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                {agenticMode ? 'Agentic on' : 'Agentic off'}
              </button>
            </div>

            {/* ── Context chips: what Axon knows about the workbench ── */}
            <ContextChips />

            {/* ── Divider between controls and messages ── */}
            <div style={{ height: '1px', background: PAPER_THEME.border, margin: '2px 0' }} />

            {/* ── Conversation messages ── */}
            {messages.length > 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: '10px',
                maxHeight: '280px', overflowY: 'auto',
                padding: '4px 0',
              }}>
                {messages.map((msg, i) => (
                  <ChatMessage key={i} {...msg} />
                ))}
                {loading && (
                  <ChatMessage role="assistant" content="" isLoading timestamp={Date.now()} />
                )}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div
                data-testid="nexai-conversation-empty"
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  minHeight: '100px',
                  padding: '16px',
                  borderRadius: 'var(--nb-radius-md)',
                  border: `1px dashed ${THEME.BORDER}`,
                  background: 'rgba(255,255,255,0.015)',
                  textAlign: 'center',
                }}
              >
                <div style={{ display: 'grid', gap: '4px' }}>
                  <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    No messages yet
                  </div>
                  <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.DIM, lineHeight: 1.5 }}>
                    Ask Axon a question to start the conversation.
                  </div>
                </div>
              </div>
            )}

            <PromptInput
              query={query}
              setQuery={setQuery}
              onSubmit={runQuery}
              onStop={() => { abortRef.current?.abort(); setLoading(false); }}
              loading={loading}
              history={history}
              placeholder={contextPrompt || undefined}
              examples={PRESET_QUERIES}
              hideExamples={Boolean(result)}
            />

            {(result || agenticMode) && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Primary reading surface
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px',
                    borderRadius: 'var(--nb-radius-md)',
                    border: `1px solid ${THEME.BORDER}`,
                    background: THEME.PANEL_SURFACE,
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
                      className={`nb-tool-toggle ${surfaceView === view ? 'nb-tool-toggle--active' : ''}`}
                      onClick={() => setSurfaceView(view)}
                      aria-pressed={surfaceView === view}
                      data-testid={`nexai-surface-${view}`}
                      style={{
                        minHeight: '32px',
                        padding: '0 12px',
                        borderRadius: 'var(--nb-radius-md)',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: THEME.SANS,
                        fontSize: 'var(--nb-fs-sm)',
                        fontWeight: 600,
                        background: surfaceView === view ? 'rgba(175,195,214,0.18)' : 'transparent',
                        color: surfaceView === view ? THEME.VALUE : THEME.LABEL,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Workflow stepper: Cognitive Router tier progression ── */}
            {(loading || result) && (
              <WorkflowStepper
                steps={[
                  { id: 'classify', label: 'Classify', status: workflowStep === 'classify' ? 'active' : loading || result ? 'done' : 'pending' },
                  { id: 'route', label: 'Route', status: workflowStep === 'route' ? 'active' : ['execute', 'synthesize'].includes(workflowStep) || result ? 'done' : 'pending' },
                  { id: 'execute', label: 'Execute', status: workflowStep === 'execute' ? 'active' : workflowStep === 'synthesize' || result ? 'done' : 'pending' },
                  { id: 'synthesize', label: 'Synthesize', status: workflowStep === 'synthesize' ? 'active' : result ? 'done' : 'pending' },
                ]}
                activeIndex={workflowStep === 'classify' ? 0 : workflowStep === 'route' ? 1 : workflowStep === 'execute' ? 2 : 3}
              />
            )}

            {/* ── Result summary: compact metrics above detail view ── */}
            {result && surfaceView === 'answer' && (
              <ResultSummaryPanel
                metrics={[
                  { label: 'Confidence', value: `${(result.confidence * 100).toFixed(0)}%`, accent: result.confidence > 0.7 ? THEME.MINT : result.confidence > 0.4 ? THEME.APRICOT : THEME.CORAL },
                  { label: 'Citations', value: result.citations.length },
                  { label: 'Provider', value: provider ?? 'groq' },
                  { label: 'Tier', value: routingTier ?? '—' },
                ]}
              />
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
                  borderRadius: 'var(--nb-radius-md)',
                  border: `1px solid ${THEME.BORDER}`,
                  background: THEME.PANEL_INSET,
                  padding: '8px 10px',
                  display: 'grid',
                  gap: '8px',
                }}
              >
                <button
                  type="button"
                  className="nb-tool-toggle"
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
                    color: THEME.LABEL,
                    fontFamily: THEME.MONO,
                    fontSize: 'var(--nb-fs-xs)',
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
                        borderRadius: 'var(--nb-radius-md)',
                        border: `1px solid ${THEME.BORDER}`,
                        background: 'rgba(5,7,11,0.35)',
                        padding: '10px 12px',
                        display: 'grid',
                        gap: '8px',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: THEME.MONO,
                          fontSize: 'var(--nb-fs-xs)',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: THEME.LABEL,
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
      </div>

      {/* ── Right rail: stats + posture (hidden on mobile, collapsed when no result) ── */}
      {!isMobile && <ModuleCard area="stats" title="Query Stats">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {result ? (
            <>
              <MetricCard label="Quality Index" value={`${(result.confidence * 100).toFixed(0)}`} highlight />
              <MetricCard label="Citations" value={result.citations.length} />
              <MetricCard label="Model" value={provider ?? 'groq'} />
              {verified && (() => {
                const summary = computeVerificationSummary(result.citations);
                return (
                  <div style={{
                    padding: '8px',
                    borderRadius: 'var(--nb-radius-sm)',
                    background: THEME.PANEL_INSET,
                    border: `1px solid ${THEME.BORDER}`,
                    display: 'grid',
                    gap: '4px',
                  }}>
                    <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      PubMed verification
                    </div>
                    <div style={{ display: 'flex', gap: '8px', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)' }}>
                      <span style={{ color: THEME.SUCCESS_HIGH }}>{summary.verified} verified</span>
                      <span style={{ color: THEME.RISK_MEDIUM }}>{summary.unverified} partial</span>
                      <span style={{ color: THEME.RISK_HIGH }}>{summary.notFound} missing</span>
                    </div>
                    <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE }}>
                      {(summary.verificationRate * 100).toFixed(0)}% verification rate
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <div style={{
              padding: '16px', textAlign: 'center',
              color: THEME.LABEL, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
            }}>
              Ask a question to see stats
            </div>
          )}

          <div style={{
            padding: '12px',
            borderRadius: 'var(--nb-radius-md)',
            border: `1px solid ${THEME.BORDER}`,
            background: THEME.PANEL_INSET,
            display: 'grid',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Workflow supervisor
              </div>
              <span style={{
                padding: '2px 7px',
                borderRadius: '999px',
                border: `1px solid ${THEME.BORDER}`,
                background: THEME.CHIP_NEUTRAL,
                color: workflowControl.status === 'blocked' || workflowControl.status === 'gated' || workflowControl.status === 'demoOnly'
                  ? THEME.APRICOT
                  : THEME.VALUE,
                fontFamily: THEME.MONO,
                fontSize: 'var(--nb-fs-xs)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                {workflowStatusLabel(workflowControl.status)}
              </span>
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, lineHeight: 1.55 }}>
              {workflowControl.explanation}
            </div>
            <div style={{ display: 'grid', gap: '5px', fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, lineHeight: 1.45 }}>
              <span>state · {workflowControl.machineState}</span>
              <span>current · {workflowControl.currentToolId?.toUpperCase() ?? 'NONE'}</span>
              <span>next · {workflowControl.nextRecommendedNode?.toUpperCase() ?? 'NONE'}</span>
              <span>risk · {workflowRisk}</span>
              <span>confidence · {workflowControl.confidence === null ? 'unknown' : workflowControl.confidence.toFixed(2)}</span>
              <span>uncertainty · {workflowControl.uncertainty === null ? 'unknown' : workflowControl.uncertainty.toFixed(2)}</span>
              <span>missing evidence · {workflowControl.missingEvidence.have}/{workflowControl.missingEvidence.minRequired}{workflowControl.missingEvidence.kinds.length ? ` ${workflowControl.missingEvidence.kinds.join(', ')}` : ''}</span>
              <span>demo/simulated · {workflowControl.isDemoOnly ? 'yes' : 'no'}</span>
              <span>human gate · {workflowControl.humanGateRequired ? 'required' : 'not required'}</span>
            </div>
          </div>

          {history.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{
                fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase',
                letterSpacing: '0.1em', color: THEME.LABEL, marginBottom: '6px',
              }}>
                History ({history.length})
              </div>
              {history.slice(0, 5).map((h, i) => (
                <button
                  key={h + i}
                  onClick={() => setQuery(h)}
                  className="nb-tool-toggle"
                  aria-label={`Reuse query: ${h.slice(0, 40)}`}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '4px 6px', marginBottom: '2px',
                    fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {h.slice(0, 40)}{h.length > 40 ? '…' : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      </ModuleCard>}
    </ToolShell>
  );
});
