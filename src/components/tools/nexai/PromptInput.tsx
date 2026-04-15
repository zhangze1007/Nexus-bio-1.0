'use client';
/**
 * PromptInput — Plain-language research prompt surface.
 *
 * This is not a CLI relabelled as prose. The audit calls for a Copilot
 * input that accepts how researchers actually describe problems ("Compare
 * two fermentation bottlenecks in the current pathway"), not shell-style
 * queries. The component is a multi-line textarea with:
 *   • a long placeholder that teaches the input shape
 *   • three example-prompt chips surfaced on idle so researchers can see
 *     the kind of question the Copilot expects without guessing
 *   • history cycle via ArrowUp / ArrowDown (audit: keep recent-query recall)
 *   • the slash-key shortcut that predates this rebuild is preserved
 *
 * Event contract:
 *   onSubmit(query) fires on Enter (without Shift), or when the send
 *   button is clicked. Parent owns loading and query state.
 */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TOOL_TOKENS as T } from '../shared/ToolShell';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

const AXON_ACCENT = PATHD_THEME.blue;

export interface PromptInputProps {
  query: string;
  setQuery: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  history: string[];
  placeholder?: string;
  /** Idle-state example prompts. Exactly three is intentional — more than
   *  three turns the idle surface into a menu. */
  examples?: string[];
  /** Hide the examples row when there's already a result on screen. */
  hideExamples?: boolean;
}

const DEFAULT_PLACEHOLDER =
  'Describe the research question in plain language — e.g. "Which bottleneck in the amorphadiene route should we redesign first, and why?"';

const DEFAULT_EXAMPLES = [
  'Summarise the current pathway bottlenecks and recommend the next tool to run.',
  'Compare the evidence for two candidate enzymes in the active workbench.',
  'Explain the thermodynamic risk in the current pathway using the attached evidence.',
];

export default function PromptInput({
  query,
  setQuery,
  onSubmit,
  loading,
  history,
  placeholder,
  examples = DEFAULT_EXAMPLES,
  hideExamples = false,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [histIdx, setHistIdx] = useState(-1);
  const [btnHover, setBtnHover] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && e.target === document.body) {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.nativeEvent as KeyboardEvent).isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
      return;
    }
    if (e.key === 'ArrowUp' && e.currentTarget.selectionStart === 0) {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(next);
      if (history[next]) setQuery(history[next]);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(histIdx - 1, -1);
      setHistIdx(next);
      setQuery(next < 0 ? '' : (history[next] ?? ''));
    }
  };

  const showExamples = !hideExamples && !query.trim() && !loading;
  const shownExamples = examples.slice(0, 3);

  return (
    <div
      data-testid="nexai-prompt-input"
      style={{
        display: 'grid',
        gap: '10px',
        padding: '12px',
        borderRadius: '20px',
        border: `1px solid ${loading ? 'rgba(175,195,214,0.34)' : 'rgba(255,255,255,0.08)'}`,
        background: '#05070b',
        boxShadow: '0 18px 48px rgba(4,10,16,0.26)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div
          aria-hidden
          style={{
            flexShrink: 0,
            minWidth: '36px',
            height: '36px',
            borderRadius: '12px',
            display: 'grid',
            placeItems: 'center',
            background: loading ? 'rgba(175,195,214,0.12)' : 'rgba(175,195,214,0.08)',
            border: '1px solid rgba(175,195,214,0.18)',
          }}
        >
          {loading ? (
            <span style={{ display: 'flex', gap: '3px' }}>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.22 }}
                  style={{
                    display: 'block',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: AXON_ACCENT,
                  }}
                />
              ))}
            </span>
          ) : (
            <span
              style={{
                fontFamily: T.MONO,
                fontSize: '11px',
                fontWeight: 700,
                color: PATHD_THEME.label,
              }}
            >
              /
            </span>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHistIdx(-1);
          }}
          onKeyDown={handleKey}
          placeholder={placeholder ?? DEFAULT_PLACEHOLDER}
          rows={2}
          disabled={loading}
          aria-label="Plain-language research prompt"
          style={{
            flex: 1,
            resize: 'none',
            minHeight: '44px',
            maxHeight: '140px',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: T.SANS,
            fontSize: '14px',
            lineHeight: 1.55,
            color: PATHD_THEME.value,
            caretColor: AXON_ACCENT,
            letterSpacing: '-0.01em',
          }}
        />

        <motion.button
          aria-label="Ask Axon"
          onClick={onSubmit}
          disabled={loading || !query.trim()}
          whileTap={{ scale: 0.96 }}
          onMouseEnter={() => setBtnHover(true)}
          onMouseLeave={() => setBtnHover(false)}
          style={{
            flexShrink: 0,
            minHeight: '44px',
            minWidth: '112px',
            padding: '0 18px',
            borderRadius: '14px',
            border: 'none',
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
            fontFamily: T.SANS,
            fontSize: '13px',
            fontWeight: 700,
            background: loading
              ? 'rgba(255,255,255,0.08)'
              : btnHover
                ? '#ffffff'
                : '#f4f7fb',
            color: loading ? PATHD_THEME.label : '#111318',
            opacity: !loading && !query.trim() ? 0.45 : 1,
            boxShadow: !loading && btnHover ? '0 2px 12px rgba(0,0,0,0.22)' : 'none',
            transition: 'background 0.15s, box-shadow 0.15s',
          }}
        >
          {loading ? 'Asking…' : 'Ask Axon'}
        </motion.button>
      </div>

      {showExamples && shownExamples.length > 0 && (
        <div
          data-testid="nexai-prompt-examples"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            paddingTop: '2px',
          }}
        >
          <span
            style={{
              fontFamily: T.MONO,
              fontSize: '9px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: PATHD_THEME.label,
              alignSelf: 'center',
              marginRight: '4px',
            }}
          >
            Try
          </span>
          {shownExamples.map((example, i) => (
            <button
              key={`${i}-${example.slice(0, 24)}`}
              type="button"
              onClick={() => setQuery(example)}
              style={{
                flex: '1 1 0',
                minWidth: '0',
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: '10px',
                border: '1px solid rgba(175,195,214,0.2)',
                background: 'rgba(175,195,214,0.06)',
                cursor: 'pointer',
                fontFamily: T.SANS,
                fontSize: '11px',
                lineHeight: 1.45,
                color: PATHD_THEME.value,
              }}
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
