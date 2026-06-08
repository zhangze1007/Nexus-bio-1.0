'use client';
/**
 * RawJsonDrawer — Power-user escape hatch for the raw model response.
 *
 * Not a cosmetic toggle. The audit repositions NEXAI around plain-language
 * research prompts, which means the structured JSON envelope must stay
 * available but out of sight by default. This drawer:
 *
 *   • is closed by default (no JSON leaks into the reading flow)
 *   • pretty-prints the raw response when it parses as JSON
 *   • falls back to verbatim text when it doesn't
 *   • surfaces provider, parse strategy, and `parseError` (from PR-1)
 *     so the user can see *why* the structured contract was skipped
 *   • exposes copy-to-clipboard so the response is debuggable without
 *     round-tripping through devtools
 *
 * The drawer is intentionally persistent across queries — users should
 * be able to open it, run a new query, and keep inspecting without it
 * collapsing on them.
 */
import { useState } from 'react';
import { TOOL_TOKENS as T } from '../shared/ToolShell';
import type { ParseErrorInfo } from './ResultPanel';
import { THEME } from '../../../theme';

export interface RawJsonDrawerProps {
  open: boolean;
  onToggle: (next: boolean) => void;
  rawText: string | null;
  provider?: string | null;
  parseError?: ParseErrorInfo | null;
  /** When true, the model answered in prose — the drawer still opens but
   *  labels the content as "raw text response" instead of "raw JSON". */
  isProse?: boolean;
}

function prettyPrint(raw: string | null): { body: string; isJson: boolean } {
  if (!raw) return { body: '', isJson: false };
  try {
    const parsed = JSON.parse(raw);
    return { body: JSON.stringify(parsed, null, 2), isJson: true };
  } catch {
    return { body: raw, isJson: false };
  }
}

export default function RawJsonDrawer({
  open,
  onToggle,
  rawText,
  provider,
  parseError,
  isProse,
}: RawJsonDrawerProps) {
  const [copied, setCopied] = useState(false);
  const { body, isJson } = prettyPrint(rawText);

  async function handleCopy() {
    if (!rawText) return;
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard denied — swallow; the user can still select the text
    }
  }

  const label = isJson ? 'Raw structured response' : isProse ? 'Raw text response' : 'Raw model response';

  return (
    <div
      data-testid="nexai-raw-json-drawer"
      style={{
        borderRadius: 'var(--nb-radius-md)',
        border: `1px solid ${THEME.BORDER}`,
        background: THEME.PANEL_INSET,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(!open)}
        aria-expanded={open}
        aria-controls="nexai-raw-json-body"
        data-testid="nexai-raw-json-toggle"
        style={{
          width: '100%',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: THEME.MONO,
          fontSize: 'var(--nb-fs-xs)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: THEME.LABEL,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
              fontFamily: THEME.MONO,
              fontSize: 'var(--nb-fs-xs)',
              color: THEME.LABEL,
            }}
          >
            ▸
          </span>
          <span>{label}</span>
        </span>
        <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
          {provider && (
            <span
              style={{
                fontFamily: THEME.MONO,
                fontSize: 'var(--nb-fs-xs)',
                padding: '2px 6px',
                borderRadius: '6px',
                background: 'rgba(175,195,214,0.12)',
                border: '1px solid rgba(175,195,214,0.24)',
                color: THEME.VALUE,
                letterSpacing: '0.04em',
                textTransform: 'none',
              }}
            >
              {provider}
            </span>
          )}
          {parseError && parseError.code !== 'NO_OBJECT' && (
            <span
              style={{
                fontFamily: THEME.MONO,
                fontSize: 'var(--nb-fs-xs)',
                padding: '2px 6px',
                borderRadius: '6px',
                background: 'rgba(250,128,114,0.16)',
                border: '1px solid rgba(250,128,114,0.34)',
                color: '#FA8072',
                letterSpacing: '0.04em',
                textTransform: 'none',
              }}
            >
              {parseError.code}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div
          id="nexai-raw-json-body"
          data-testid="nexai-raw-json-body"
          style={{
            borderTop: `1px solid ${THEME.BORDER}`,
            padding: '10px 14px 14px',
            display: 'grid',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <span
              style={{
                fontFamily: THEME.MONO,
                fontSize: 'var(--nb-fs-xs)',
                color: THEME.LABEL,
                letterSpacing: '0.06em',
              }}
            >
              {rawText ? `${rawText.length.toLocaleString()} chars · ${isJson ? 'parsed as JSON' : 'plain text'}` : 'no response captured yet'}
            </span>
            {rawText && (
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: 'var(--nb-fs-xs)',
                  padding: '4px 10px',
                  borderRadius: 'var(--nb-radius-sm)',
                  border: `1px solid ${THEME.BORDER}`,
                  background: 'transparent',
                  cursor: 'pointer',
                  color: THEME.VALUE,
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          {parseError && parseError.code !== 'NO_OBJECT' && (
            <p
              style={{
                margin: 0,
                fontFamily: THEME.SANS,
                fontSize: 'var(--nb-fs-sm)',
                color: THEME.LABEL,
                lineHeight: 1.55,
              }}
            >
              Backend reported <code style={{ fontFamily: THEME.MONO }}>{parseError.code}</code>: {parseError.message}
            </p>
          )}
          <pre
            style={{
              margin: 0,
              padding: '10px 12px',
              borderRadius: 'var(--nb-radius-md)',
              background: 'rgba(10,14,22,0.7)',
              border: '1px solid rgba(255,255,255,0.06)',
              fontFamily: THEME.MONO,
              fontSize: 'var(--nb-fs-sm)',
              lineHeight: 1.5,
              color: THEME.VALUE,
              maxHeight: '340px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {body || 'No raw response captured yet. Run a query to populate this drawer.'}
          </pre>
        </div>
      )}
    </div>
  );
}
