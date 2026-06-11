'use client';
/**
 * CopilotSlideOver — Right-anchored Axon overlay.
 *
 * This is the primary "Ask Axon" entry point across every /tools/* page.
 * It slides in from the right and provides a lightweight copilot surface
 * without navigating away from the current tool page. The full NEXAI
 * experience lives at /tools/nexai — the slide-over is the quick-access
 * variant that keeps the user in situ.
 *
 * State: fully local. ToolsLayoutShell is persistent across tool routes,
 * so the slide-over's query/result state survives cross-tool navigation.
 *
 * z-index: 96 — above the floating button (95), below topbar (100).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2 } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { useAxonOrchestratorOptional } from '../../providers/AxonOrchestratorProvider';
import {
  buildWorkbenchCopilotContext,
  composeCopilotQuery,
  type ConversationTurn,
} from '../../services/axonContext';
import ResearchAnswerRenderer from '../tools/shared/ResearchAnswerRenderer';
import { THEME } from '../../theme';

const SLIDE_WIDTH = 420;

export default function CopilotSlideOver() {
  const open = useUIStore((s) => s.copilotOpen);
  const close = () => useUIStore.getState().setCopilotOpen(false);

  // Workbench context — pulled field-by-field so the component only
  // re-renders when the narrow slice we feed into the copilot changes.
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const evidenceItems = useWorkbenchStore((s) => s.evidenceItems);
  const selectedEvidenceIds = useWorkbenchStore((s) => s.selectedEvidenceIds);
  const nextRecommendations = useWorkbenchStore((s) => s.nextRecommendations);
  const currentToolId = useWorkbenchStore((s) => s.currentToolId);

  const axon = useAxonOrchestratorOptional();

  const workbenchContext = useMemo(
    () =>
      buildWorkbenchCopilotContext({
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
        currentToolId,
      }),
    [
      project,
      analyzeArtifact,
      evidenceItems,
      selectedEvidenceIds,
      nextRecommendations,
      currentToolId,
    ],
  );

  const queueCounts = useMemo(() => {
    const tasks = axon?.tasks ?? [];
    return {
      running: tasks.filter((t) => t.status === 'running').length,
      pending: tasks.filter((t) => t.status === 'pending').length,
    };
  }, [axon?.tasks]);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    provider?: string;
    timestamp: number;
  }>>([]);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cancel in-flight request on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Focus prompt when opened + focus trap.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => textareaRef.current?.focus());

    const panel = panelRef.current;
    if (!panel) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    panel.addEventListener('keydown', handleTab);
    return () => panel.removeEventListener('keydown', handleTab);
  }, [open]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function submit() {
    const q = query.trim();
    if (!q || loading) return;

    // Add user message to conversation
    setMessages(prev => [...prev, { role: 'user', content: q, timestamp: Date.now() }]);
    setQuery('');
    setLoading(true);
    setError(null);

    // Cancel previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Build conversation history from the current messages state.
      // We snapshot before the new user message was added, but React
      // batches the setState above so `messages` still holds the prior
      // state at this point. We include the new user turn explicitly.
      const historyForApi: ConversationTurn[] = [
        ...messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content: q },
      ];

      const composedQuery = composeCopilotQuery(q, workbenchContext, historyForApi);
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchQuery: composedQuery,
          history: historyForApi,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('No response from Axon');

      // Add assistant message to conversation
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: text,
        provider: data?.meta?.provider ?? 'groq',
        timestamp: Date.now(),
      }]);
    } catch (err) {
      // Silently ignore aborted requests
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (controller.signal.aborted) return;

      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${errMsg}`,
        timestamp: Date.now(),
      }]);
    }
    setLoading(false);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.nativeEvent as KeyboardEvent).isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="copilot-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={close}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 96,
              background: 'rgba(4,10,16,0.38)',
            }}
          />

          {/* Panel */}
          <motion.aside
            key="copilot-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Axon Copilot"
            data-testid="copilot-slide-over"
            initial={{ x: SLIDE_WIDTH + 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: SLIDE_WIDTH + 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: SLIDE_WIDTH,
              maxWidth: '90vw',
              zIndex: 97,
              display: 'flex',
              flexDirection: 'column',
              background: `linear-gradient(180deg, ${THEME.PANEL_MUTED} 0%, ${THEME.PANEL_BG} 100%)`,
              borderLeft: `1px solid ${THEME.BORDER}`,
              boxShadow: '-16px 0 48px rgba(4,10,16,0.35)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                padding: '14px 16px 12px',
                borderBottom: `1px solid ${THEME.BORDER}`,
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'grid', gap: '2px' }}>
                <span style={{ fontFamily: THEME.MONO, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: THEME.LABEL }}>
                  Axon Copilot
                </span>
                <span style={{ fontFamily: THEME.SANS, fontSize: '12px', fontWeight: 700, color: THEME.VALUE }}>
                  Ask anything about the active research
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                {axon?.agenticMode && (queueCounts.running > 0 || queueCounts.pending > 0) && (
                  <span
                    data-testid="copilot-queue-badge"
                    title="Agentic queue status"
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: '10px',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      border: '1px solid rgba(175,195,214,0.34)',
                      background: 'rgba(175,195,214,0.14)',
                      color: THEME.VALUE,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {queueCounts.running}R · {queueCounts.pending}Q
                  </span>
                )}
                <Link
                  href="/tools/nexai"
                  onClick={close}
                  title="Open full Copilot view"
                  data-testid="copilot-fullview-link"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    borderRadius: '12px',
                    border: `1px solid ${THEME.BORDER}`,
                    background: 'transparent',
                    color: THEME.LABEL,
                    textDecoration: 'none',
                  }}
                >
                  <Maximize2 size={14} />
                </Link>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close copilot"
                  data-testid="copilot-close"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    borderRadius: '12px',
                    border: `1px solid ${THEME.BORDER}`,
                    background: 'transparent',
                    color: THEME.LABEL,
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Prompt */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${THEME.BORDER}`,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: `1px solid ${loading ? 'rgba(175,195,214,0.34)' : 'rgba(255,255,255,0.08)'}`,
                  background: '#05070b',
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKey}
                  onFocus={(e) => { e.currentTarget.style.outline = '2px solid rgba(175,195,214,0.5)'; e.currentTarget.style.outlineOffset = '2px'; }}
                  onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
                  placeholder='e.g. "Which bottleneck should we tackle first?"'
                  rows={2}
                  disabled={loading}
                  aria-label="Copilot prompt"
                  style={{
                    flex: 1,
                    resize: 'none',
                    minHeight: '40px',
                    maxHeight: '100px',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontFamily: THEME.SANS,
                    fontSize: '13px',
                    lineHeight: 1.5,
                    color: THEME.VALUE,
                    caretColor: THEME.SKY,
                  }}
                />
                <button
                  type="button"
                  onClick={submit}
                  disabled={loading || !query.trim()}
                  style={{
                    flexShrink: 0,
                    minHeight: '36px',
                    padding: '0 14px',
                    borderRadius: '12px',
                    border: '1px solid rgba(175, 195, 214, 0.2)',
                    cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: THEME.SANS,
                    fontSize: '12px',
                    fontWeight: 700,
                    background: 'rgba(175, 195, 214, 0.18)',
                    color: THEME.VALUE,
                    opacity: !loading && !query.trim() ? 0.4 : 1,
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  {loading ? 'Asking…' : 'Ask'}
                </button>
              </div>
              {/*
               * Context indicator — surfaces the workbench state that will
               * be appended to the next prompt. When no context is active,
               * show a muted "no active context" hint so users know the
               * copilot is running without grounding.
               */}
              <div
                data-testid="copilot-context-indicator"
                data-has-context={workbenchContext.hasContext || undefined}
                title={
                  workbenchContext.hasContext
                    ? 'Your next question will include this bounded workbench context.'
                    : 'No workbench context available — the copilot will answer generically.'
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '10px',
                  padding: '6px 10px',
                  borderRadius: '12px',
                  border: `1px solid ${
                    workbenchContext.hasContext
                      ? 'rgba(175,195,214,0.32)'
                      : 'rgba(255,255,255,0.06)'
                  }`,
                  background: workbenchContext.hasContext
                    ? 'rgba(175,195,214,0.08)'
                    : 'transparent',
                  fontFamily: THEME.MONO,
                  fontSize: '10px',
                  color: workbenchContext.hasContext
                    ? THEME.VALUE
                    : THEME.LABEL,
                  lineHeight: 1.4,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: workbenchContext.hasContext
                      ? THEME.SKY
                      : 'rgba(175,195,214,0.28)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {workbenchContext.hasContext ? 'Using context' : 'No context'}
                </span>
                <span
                  style={{
                    color: THEME.LABEL,
                    textTransform: 'none',
                    letterSpacing: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  {workbenchContext.summaryOneLine}
                </span>
              </div>
            </div>

            {/* Result area */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '14px 16px',
              }}
            >
              {error && (
                <div
                  data-testid="copilot-error"
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid rgba(250,128,114,0.42)',
                    background: 'rgba(250,128,114,0.12)',
                    fontFamily: THEME.SANS,
                    fontSize: '12px',
                    color: THEME.VALUE,
                    lineHeight: 1.6,
                    marginBottom: '10px',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Conversation messages */}
              {messages.length === 0 && !loading && (
                <div
                  data-testid="copilot-idle"
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    minHeight: '180px',
                    textAlign: 'center',
                    padding: '24px',
                  }}
                >
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <span style={{ fontFamily: THEME.MONO, fontSize: '28px', color: 'rgba(36,29,24,0.08)' }}>⬡</span>
                    <span style={{ fontFamily: THEME.SANS, fontSize: '13px', color: THEME.VALUE }}>
                      Ask Axon about the active research
                    </span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: '10px', color: THEME.LABEL }}>
                      Axon synthesises evidence, explains bottlenecks, and recommends the next scientific move.
                    </span>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  data-testid={msg.role === 'user' ? 'copilot-user-message' : 'copilot-answer'}
                  style={{
                    borderRadius: '12px',
                    background: msg.role === 'user'
                      ? 'rgba(175, 195, 214, 0.12)'
                      : THEME.PANEL_GLASS_STRONG,
                    border: `1px solid ${msg.role === 'user'
                      ? 'rgba(175, 195, 214, 0.15)'
                      : THEME.BORDER}`,
                    padding: '12px 14px',
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: msg.role === 'user' ? '85%' : '100%',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{
                      fontFamily: THEME.MONO, fontSize: '11px',
                      padding: '1px 5px', borderRadius: '4px',
                      background: msg.role === 'user' ? 'rgba(175,195,214,0.12)' : 'rgba(163,195,214,0.12)',
                      color: msg.role === 'user' ? THEME.LABEL : THEME.SKY,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {msg.role === 'user' ? 'You' : 'Axon'}
                    </span>
                    {msg.provider && (
                      <span style={{
                        fontFamily: THEME.MONO, fontSize: '11px',
                        padding: '1px 5px', borderRadius: '4px',
                        background: 'rgba(175,195,214,0.10)',
                        color: THEME.LABEL,
                      }}>
                        {msg.provider}
                      </span>
                    )}
                    <span style={{ fontFamily: THEME.MONO, fontSize: '11px', color: THEME.LABEL, opacity: 0.5 }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {msg.role === 'user' ? (
                    <p style={{ fontFamily: THEME.SANS, fontSize: '12px', lineHeight: 1.6, color: THEME.VALUE, margin: 0, whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </p>
                  ) : (
                    <ResearchAnswerRenderer answer={msg.content} compact />
                  )}
                </div>
              ))}

              {loading && (
                <div style={{
                  display: 'flex', gap: '4px', padding: '12px',
                  justifyContent: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: '5px', height: '5px', borderRadius: '50%',
                      background: THEME.SKY,
                      animation: `axon-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '10px 16px',
                borderTop: `1px solid ${THEME.BORDER}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <span style={{ fontFamily: THEME.MONO, fontSize: '10px', color: THEME.LABEL }}>
                Ctrl+K to toggle · Esc to close
              </span>
              <Link
                href="/tools/nexai"
                onClick={close}
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: '11px',
                  fontWeight: 600,
                  color: THEME.VALUE,
                  textDecoration: 'none',
                }}
              >
                Full Copilot view →
              </Link>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
