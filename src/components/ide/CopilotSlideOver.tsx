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
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2 } from 'lucide-react';
import { T } from './tokens';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import { useUIStore } from '../../store/uiStore';
import ResearchAnswerRenderer from '../tools/shared/ResearchAnswerRenderer';

const SLIDE_WIDTH = 420;

export default function CopilotSlideOver() {
  const open = useUIStore((s) => s.copilotOpen);
  const close = () => useUIStore.getState().setCopilotOpen(false);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus prompt when opened.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
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

  async function submit() {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchQuery: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('No response from Axon');
      setAnswer(text);
      setProvider(data?.meta?.provider ?? 'groq');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setAnswer(null);
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
            role="dialog"
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
              background: `linear-gradient(180deg, ${PATHD_THEME.sepiaPanelMuted} 0%, ${PATHD_THEME.sepiaPanel} 100%)`,
              borderLeft: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
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
                borderBottom: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'grid', gap: '2px' }}>
                <span style={{ fontFamily: T.MONO, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: PATHD_THEME.label }}>
                  Axon Copilot
                </span>
                <span style={{ fontFamily: T.SANS, fontSize: '12px', fontWeight: 700, color: PATHD_THEME.value }}>
                  Ask anything about the active research
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
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
                    borderRadius: '10px',
                    border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                    background: 'transparent',
                    color: PATHD_THEME.label,
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
                    borderRadius: '10px',
                    border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                    background: 'transparent',
                    color: PATHD_THEME.label,
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
                borderBottom: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '14px',
                  border: `1px solid ${loading ? 'rgba(175,195,214,0.34)' : 'rgba(255,255,255,0.08)'}`,
                  background: '#05070b',
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKey}
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
                    fontFamily: T.SANS,
                    fontSize: '13px',
                    lineHeight: 1.5,
                    color: PATHD_THEME.value,
                    caretColor: PATHD_THEME.blue,
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
                    borderRadius: '10px',
                    border: 'none',
                    cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: T.SANS,
                    fontSize: '12px',
                    fontWeight: 700,
                    background: '#f4f7fb',
                    color: '#111318',
                    opacity: !loading && !query.trim() ? 0.4 : 1,
                  }}
                >
                  {loading ? 'Asking…' : 'Ask'}
                </button>
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
                    fontFamily: T.SANS,
                    fontSize: '12px',
                    color: PATHD_THEME.value,
                    lineHeight: 1.6,
                    marginBottom: '10px',
                  }}
                >
                  {error}
                </div>
              )}

              {!answer && !loading && !error && (
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
                    <span style={{ fontFamily: T.MONO, fontSize: '28px', color: 'rgba(36,29,24,0.08)' }}>⬡</span>
                    <span style={{ fontFamily: T.SANS, fontSize: '13px', color: PATHD_THEME.value }}>
                      Ask Axon about the active research
                    </span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label }}>
                      Axon synthesises evidence, explains bottlenecks, and recommends the next scientific move.
                    </span>
                  </div>
                </div>
              )}

              {answer && (
                <div
                  data-testid="copilot-answer"
                  style={{
                    borderRadius: '14px',
                    background: PATHD_THEME.panelGlassStrong,
                    border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label }}>AXON</span>
                    {provider && (
                      <span style={{
                        fontFamily: T.MONO, fontSize: '8px',
                        padding: '2px 6px', borderRadius: '6px',
                        background: 'rgba(175,195,214,0.14)',
                        border: '1px solid rgba(175,195,214,0.26)',
                        color: PATHD_THEME.value,
                      }}>
                        {provider}
                      </span>
                    )}
                  </div>
                  <ResearchAnswerRenderer answer={answer} compact />
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '10px 16px',
                borderTop: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label }}>
                Ctrl+K to toggle · Esc to close
              </span>
              <Link
                href="/tools/nexai"
                onClick={close}
                style={{
                  fontFamily: T.SANS,
                  fontSize: '11px',
                  fontWeight: 600,
                  color: PATHD_THEME.value,
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
